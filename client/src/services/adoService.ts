// FE-ONLY ADO SERVICE - Uses Merge Bases API for ancestry checking

import {
  ParsedPRUrl,
  PRInfo,
  FE_ENVIRONMENTS,
  EnvironmentDeploymentStatus,
  PRDeploymentResult,
} from '../types';

const API_VERSION = '7.1';
const POWERBI_CLIENTS_REPO_GUID = '979df5a4-0e65-463c-b88e-6cd5ca2e5df3';
const POWERBI_CLIENTS_PROJECT = 'PowerBIClients';

export function parsePRUrl(url: string): ParsedPRUrl {
  const devAzureRegex = /https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/i;
  const vstsRegex = /https:\/\/([^.]+)\.visualstudio\.com\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/i;
  
  let match = url.match(devAzureRegex);
  if (match) {
    return {
      organization: match[1],
      project: decodeURIComponent(match[2]),
      repository: decodeURIComponent(match[3]),
      pullRequestId: parseInt(match[4], 10),
    };
  }
  
  match = url.match(vstsRegex);
  if (match) {
    return {
      organization: match[1],
      project: decodeURIComponent(match[2]),
      repository: decodeURIComponent(match[3]),
      pullRequestId: parseInt(match[4], 10),
    };
  }
  
  throw new Error('Invalid PR URL format');
}

interface ADOPRResponse {
  pullRequestId: number;
  title: string;
  description: string;
  status: string;
  sourceRefName: string;
  targetRefName: string;
  repository: { id: string; name: string; project: { id: string; name: string; }; };
  createdBy: { displayName: string; uniqueName: string; };
  creationDate: string;
  closedDate?: string;
  lastMergeCommit?: { commitId: string; };
  url: string;
}

interface ADOEnvironmentDeploymentRecord {
  id: number;
  environmentId: number;
  owner: { id: number; name: string; _links?: { web?: { href: string; }; }; };
  result?: string;
  queueTime: string;
  startTime: string;
  finishTime?: string;
}

interface ADOBuild {
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  sourceVersion: string;
  startTime: string;
  finishTime?: string;
  _links?: { web?: { href: string; }; };
}

export async function checkPRDeploymentStatus(prUrl: string, pat: string): Promise<PRDeploymentResult> {
  const parsed = parsePRUrl(prUrl);
  const headers = {
    Authorization: 'Basic ' + btoa(':' + pat),
    'Content-Type': 'application/json',
  };

  // Check if FE repository (PowerBIClients) using regex to avoid encoding issues
  const isFERepo = /^powerbiclients$/i.test(parsed.repository);

  if (!isFERepo) {
    const prInfo = await fetchPRInfo(parsed, headers);
    return {
      prInfo,
      environments: [],
      supportedRepo: false,
      unsupportedMessage: 'BE (powerbi) repository is not supported yet.',
    };
  }

  const prInfo = await fetchPRInfo(parsed, headers);

  if (prInfo.status !== 'completed' || !prInfo.mergeCommitId) {
    return {
      prInfo,
      environments: FE_ENVIRONMENTS.map(env => ({ environment: env, status: 'not-included' as const })),
      supportedRepo: true,
      unsupportedMessage: 'PR is not merged yet.',
    };
  }

  // Calculate expected dates based on train schedule
  const mergeDate = prInfo.closedDate ? new Date(prInfo.closedDate) : new Date();
  const expectedDates = calculateExpectedDates(mergeDate);

  const environments: EnvironmentDeploymentStatus[] = [];
  for (const env of FE_ENVIRONMENTS) {
    const status = await checkEnvironmentStatus(parsed.organization, env.id, prInfo.mergeCommitId, headers);
    const expectedDate = expectedDates[env.name.toLowerCase()] || undefined;
    environments.push({ environment: env, ...status, expectedDate });
  }

  return { prInfo, environments, supportedRepo: true };
}

// Calculate expected deployment dates based on weekly train schedule
// Trains fork every Thursday ~10pm PST
function calculateExpectedDates(mergeDate: Date): Record<string, string> {
  // Find next Thursday (train fork day)
  const dayOfWeek = mergeDate.getDay(); // 0=Sun, 4=Thu
  let daysUntilThursday: number;
  
  if (dayOfWeek < 4) {
    daysUntilThursday = 4 - dayOfWeek;
  } else if (dayOfWeek === 4) {
    // If Thursday, check if before 10pm PST
    daysUntilThursday = mergeDate.getHours() < 22 ? 0 : 7;
  } else {
    daysUntilThursday = (11 - dayOfWeek);
  }
  
  const forkDate = new Date(mergeDate);
  forkDate.setDate(forkDate.getDate() + daysUntilThursday);
  
  // Train schedule offsets (days after fork)
  const offsets: Record<string, number> = {
    edog: 1,      // Friday
    daily: 1,     // Friday  
    dxt: 4,       // Monday
    msit: 7,      // Thursday
    canary1: 14,  // Thursday + 1 week
    canary2: 17,  // Sunday + 2 weeks
    prod: 21,     // Thursday + 3 weeks
  };
  
  const result: Record<string, string> = {};
  for (const [env, offset] of Object.entries(offsets)) {
    const expectedDate = new Date(forkDate);
    expectedDate.setDate(expectedDate.getDate() + offset);
    result[env] = expectedDate.toISOString();
  }
  
  return result;
}

async function fetchPRInfo(parsed: ParsedPRUrl, headers: Record<string, string>): Promise<PRInfo> {
  const baseUrl = 'https://dev.azure.com/' + parsed.organization + '/' + encodeURIComponent(parsed.project);
  const url = baseUrl + '/_apis/git/repositories/' + encodeURIComponent(parsed.repository) + '/pullRequests/' + parsed.pullRequestId + '?api-version=' + API_VERSION;
  
  const response = await fetch(url, { headers });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Authentication failed.');
    if (response.status === 403) throw new Error('Access denied.');
    if (response.status === 404) throw new Error('PR not found.');
    throw new Error('ADO API Error: ' + response.status);
  }

  const data: ADOPRResponse = await response.json();
  return {
    id: data.pullRequestId,
    title: data.title,
    status: data.status,
    sourceRefName: data.sourceRefName,
    targetRefName: data.targetRefName,
    repository: { id: data.repository.id, name: data.repository.name },
    createdBy: { displayName: data.createdBy.displayName },
    creationDate: data.creationDate,
    closedDate: data.closedDate,
    mergeCommitId: data.lastMergeCommit?.commitId,
    url: 'https://dev.azure.com/' + parsed.organization + '/' + encodeURIComponent(parsed.project) + '/_git/' + encodeURIComponent(parsed.repository) + '/pullrequest/' + parsed.pullRequestId,
  };
}

async function checkEnvironmentStatus(
  organization: string,
  environmentId: number,
  prMergeCommit: string,
  headers: Record<string, string>
): Promise<{ status: EnvironmentDeploymentStatus['status']; buildId?: number; buildNumber?: string; buildTimestamp?: string; buildUrl?: string; }> {
  try {
    const recordsUrl = 'https://dev.azure.com/' + organization + '/' + POWERBI_CLIENTS_PROJECT + '/_apis/distributedtask/environments/' + environmentId + '/environmentdeploymentrecords?top=30&api-version=7.1-preview.1';
    const recordsResponse = await fetch(recordsUrl, { headers });
    if (!recordsResponse.ok) return { status: 'error' };

    const recordsData = await recordsResponse.json();
    const records: ADOEnvironmentDeploymentRecord[] = recordsData.value || [];
    if (records.length === 0) return { status: 'no-builds' };

    const buildMap = new Map<number, ADOEnvironmentDeploymentRecord>();
    for (const record of records) {
      if (record.owner?.id && record.result?.toLowerCase() === 'succeeded') {
        if (!buildMap.has(record.owner.id)) buildMap.set(record.owner.id, record);
      }
    }

    const inProgressRecord = records.find(r => !r.finishTime);

    for (const [buildId, record] of buildMap) {
      const build = await fetchBuild(organization, buildId, headers);
      if (!build?.sourceVersion) continue;

      const isAncestor = await isPRIncludedInBuild(organization, prMergeCommit, build.sourceVersion, headers);
      if (isAncestor) {
        return {
          status: 'included',
          buildId: build.id,
          buildNumber: build.buildNumber,
          buildTimestamp: record.finishTime || record.startTime,
          buildUrl: build._links?.web?.href,
        };
      }
    }

    if (inProgressRecord) return { status: 'in-progress' };
    return { status: 'not-included' };
  } catch (error) {
    console.error('Error checking environment ' + environmentId + ':', error);
    return { status: 'error' };
  }
}

async function fetchBuild(organization: string, buildId: number, headers: Record<string, string>): Promise<ADOBuild | null> {
  const url = 'https://dev.azure.com/' + organization + '/' + POWERBI_CLIENTS_PROJECT + '/_apis/build/builds/' + buildId + '?api-version=' + API_VERSION;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function isPRIncludedInBuild(organization: string, prMergeCommit: string, buildSourceVersion: string, headers: Record<string, string>): Promise<boolean> {
  const url = 'https://dev.azure.com/' + organization + '/' + POWERBI_CLIENTS_PROJECT + '/_apis/git/repositories/' + POWERBI_CLIENTS_REPO_GUID + '/commits/' + prMergeCommit + '/mergebases?otherCommitId=' + buildSourceVersion + '&api-version=' + API_VERSION;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return false;

    const data = await response.json();
    const mergeBases: Array<{ commitId: string }> = data.value || [];

    return mergeBases.some(mb => 
      mb.commitId.toLowerCase() === prMergeCommit.toLowerCase() ||
      mb.commitId.toLowerCase().startsWith(prMergeCommit.toLowerCase().substring(0, 7)) ||
      prMergeCommit.toLowerCase().startsWith(mb.commitId.toLowerCase().substring(0, 7))
    );
  } catch {
    return false;
  }
}
