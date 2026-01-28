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

  // Check ALL environments in PARALLEL for speed (6 concurrent requests)
  // Each environment check now returns its own expectedDate based on actual deployment data
  const environmentPromises = FE_ENVIRONMENTS.map(async (env) => {
    const status = await checkEnvironmentStatus(parsed.organization, env.id, prInfo.mergeCommitId!, headers);
    return { environment: env, ...status };
  });

  const environments = await Promise.all(environmentPromises);

  return { prInfo, environments, supportedRepo: true };
}

// Calculate next deployment date based on actual deployment frequency from ADO records
function calculateNextDeploymentDate(succeededRecords: ADOEnvironmentDeploymentRecord[]): string | undefined {
  if (succeededRecords.length < 2) return undefined;
  
  // Sort by finish time descending (most recent first)
  const sortedRecords = [...succeededRecords]
    .filter(r => r.finishTime)
    .sort((a, b) => new Date(b.finishTime!).getTime() - new Date(a.finishTime!).getTime());
  
  if (sortedRecords.length < 2) return undefined;
  
  // Calculate average interval between deployments
  let totalInterval = 0;
  for (let i = 0; i < sortedRecords.length - 1; i++) {
    const current = new Date(sortedRecords[i].finishTime!).getTime();
    const previous = new Date(sortedRecords[i + 1].finishTime!).getTime();
    totalInterval += current - previous;
  }
  const avgInterval = totalInterval / (sortedRecords.length - 1);
  
  // Estimate next deployment: last deployment + average interval
  const lastDeployment = new Date(sortedRecords[0].finishTime!);
  const nextDeployment = new Date(lastDeployment.getTime() + avgInterval);
  
  // If next deployment is in the past, add another interval
  const now = new Date();
  if (nextDeployment < now) {
    const intervalsToAdd = Math.ceil((now.getTime() - nextDeployment.getTime()) / avgInterval);
    nextDeployment.setTime(nextDeployment.getTime() + intervalsToAdd * avgInterval);
  }
  
  return nextDeployment.toISOString();
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
): Promise<{ status: EnvironmentDeploymentStatus['status']; buildId?: number; buildNumber?: string; buildTimestamp?: string; buildUrl?: string; expectedDate?: string; }> {
  try {
    const recordsUrl = 'https://dev.azure.com/' + organization + '/' + POWERBI_CLIENTS_PROJECT + '/_apis/distributedtask/environments/' + environmentId + '/environmentdeploymentrecords?top=10&api-version=7.1-preview.1';
    const recordsResponse = await fetch(recordsUrl, { headers });
    if (!recordsResponse.ok) return { status: 'error' };

    const recordsData = await recordsResponse.json();
    const records: ADOEnvironmentDeploymentRecord[] = recordsData.value || [];
    if (records.length === 0) return { status: 'no-builds' };

    // Collect unique succeeded build IDs and their timestamps
    const buildMap = new Map<number, ADOEnvironmentDeploymentRecord>();
    const succeededRecords: ADOEnvironmentDeploymentRecord[] = [];
    for (const record of records) {
      if (record.owner?.id && record.result?.toLowerCase() === 'succeeded') {
        if (!buildMap.has(record.owner.id)) {
          buildMap.set(record.owner.id, record);
          succeededRecords.push(record);
        }
      }
    }

    const inProgressRecord = records.find(r => !r.finishTime);
    const buildEntries = Array.from(buildMap.entries());
    
    if (buildEntries.length === 0) {
      return inProgressRecord ? { status: 'in-progress' } : { status: 'not-included' };
    }

    // Fetch ALL builds in PARALLEL
    const buildPromises = buildEntries.map(async ([buildId, record]) => {
      const build = await fetchBuild(organization, buildId, headers);
      return { build, record };
    });
    const buildResults = await Promise.all(buildPromises);

    // Check merge bases for ALL builds in PARALLEL
    const ancestorPromises = buildResults
      .filter(({ build }) => build?.sourceVersion)
      .map(async ({ build, record }) => {
        const isAncestor = await isPRIncludedInBuild(organization, prMergeCommit, build!.sourceVersion, headers);
        return { build: build!, record, isAncestor };
      });
    const ancestorResults = await Promise.all(ancestorPromises);

    // Find all builds that include the PR
    const includedBuilds = ancestorResults.filter(r => r.isAncestor);
    
    if (includedBuilds.length > 0) {
      // Sort by timestamp to find the EARLIEST deployment (when PR first arrived)
      includedBuilds.sort((a, b) => {
        const timeA = new Date(a.record.finishTime || a.record.startTime).getTime();
        const timeB = new Date(b.record.finishTime || b.record.startTime).getTime();
        return timeA - timeB; // Ascending - earliest first
      });
      
      const earliest = includedBuilds[0];
      return {
        status: 'included',
        buildId: earliest.build.id,
        buildNumber: earliest.build.buildNumber,
        buildTimestamp: earliest.record.finishTime || earliest.record.startTime,
        buildUrl: earliest.build._links?.web?.href,
      };
    }

    if (inProgressRecord) return { status: 'in-progress' };
    
    // Calculate expected date based on actual deployment frequency
    const expectedDate = calculateNextDeploymentDate(succeededRecords);
    return { status: 'not-included', expectedDate };
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
