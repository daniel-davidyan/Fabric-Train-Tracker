import {
  ParsedPRUrl,
  PRInfo,
  Commit,
  Build,
  DeploymentStatus,
  ADOEnvironment,
  ALL_TRACKED_ENVIRONMENTS,
} from '../types';
import { buildVsrmApiBaseUrl } from './urlParser';

const API_VERSION = '7.1';
const API_VERSION_PREVIEW = '7.1-preview.1';

// Constants
const POWERBI_CLIENTS_REPO_GUID = '979df5a4-0e65-463c-b88e-6cd5ca2e5df3';
const POWERBI_CLIENTS_REPO_NAME = 'PowerBIClients';

// ADO API Response types
interface ADOPRResponse {
  pullRequestId: number;
  title: string;
  description: string;
  status: string;
  sourceRefName: string;
  targetRefName: string;
  repository: {
    id: string;
    name: string;
    project: {
      id: string;
      name: string;
    };
  };
  createdBy: {
    displayName: string;
    uniqueName: string;
  };
  creationDate: string;
  closedDate?: string;
  lastMergeCommit?: {
    commitId: string;
  };
  lastMergeSourceCommit?: {
    commitId: string;
  };
  url: string;
}

interface ADOCommitsResponse {
  value: Commit[];
  count: number;
}

interface ADOBuildsResponse {
  value: Build[];
  count: number;
}

interface ADOBuildChangesResponse {
  value: Array<{
    id: string;
    message: string;
    type: string;
    author: {
      displayName: string;
    };
    timestamp: string;
  }>;
  count: number;
}

interface ADOEnvironmentsResponse {
  value: ADOEnvironment[];
  count: number;
}

interface ADOEnvironmentDeploymentRecord {
  id: number;
  environmentId: number;
  definition: {
    id: number;
    name: string;
  };
  owner: {
    id: number;
    name: string;
    _links?: {
      web?: {
        href: string;
      };
    };
  };
  planId: string;
  result?: string;
  queueTime: string;
  startTime: string;
  finishTime?: string;
  stageName: string;
  jobName: string;
}

interface ADOEnvironmentDeploymentRecordsResponse {
  value: ADOEnvironmentDeploymentRecord[];
  count: number;
}

// Minimal Release Interface
interface ADORelease {
  id: number;
  name: string;
  status: string;
  createdOn: string;
  artifacts: Array<{
    alias: string;
    definitionReference: {
      version: {
        id: string; // Build ID or Commit ID
        name?: string;
      };
      project: {
        id: string;
      };
    };
  }>;
  _links: {
    web: {
      href: string;
    };
  };
}

function buildDirectBaseUrl(parsed: ParsedPRUrl): string {
  return `https://dev.azure.com/${parsed.organization}/${encodeURIComponent(parsed.project)}`;
}

export class ADOService {
  private pat: string;
  private parsedUrl: ParsedPRUrl;
  private baseUrl: string;

  constructor(pat: string, parsedUrl: ParsedPRUrl) {
    this.pat = pat;
    this.parsedUrl = parsedUrl;
    this.baseUrl = buildDirectBaseUrl(parsedUrl);
  }

  private getAuthHeader(): string {
    const token = btoa(`:${this.pat}`);
    return `Basic ${token}`;
  }

  private async fetchAdo<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `ADO API Error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // Use default error message
      }

      if (response.status === 401) {
        throw new Error('Authentication failed. Please check your PAT token.');
      }
      if (response.status === 403) {
        throw new Error('Access denied. Your PAT token does not have permission.');
      }
      if (response.status === 404) {
        throw new Error('Resource not found. Please verify the PR URL is correct.');
      }

      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  async getPullRequest(): Promise<PRInfo & { closedDate?: string; mergeCommitId?: string }> {
    const url = `${this.baseUrl}/_apis/git/repositories/${encodeURIComponent(this.parsedUrl.repository)}/pullRequests/${this.parsedUrl.pullRequestId}?api-version=${API_VERSION}`;
    
    const response = await this.fetchAdo<ADOPRResponse>(url);
    
    return {
      id: response.pullRequestId,
      title: response.title,
      description: response.description || '',
      status: response.status,
      sourceRefName: response.sourceRefName,
      targetRefName: response.targetRefName,
      repository: response.repository,
      createdBy: response.createdBy,
      creationDate: response.creationDate,
      closedDate: response.closedDate,
      mergeCommitId: response.lastMergeCommit?.commitId,
      url: `https://dev.azure.com/${this.parsedUrl.organization}/${encodeURIComponent(this.parsedUrl.project)}/_git/${encodeURIComponent(this.parsedUrl.repository)}/pullrequest/${this.parsedUrl.pullRequestId}`,
    };
  }

  async getPRCommits(): Promise<Commit[]> {
    const url = `${this.baseUrl}/_apis/git/repositories/${encodeURIComponent(this.parsedUrl.repository)}/pullRequests/${this.parsedUrl.pullRequestId}/commits?api-version=${API_VERSION}`;
    
    const response = await this.fetchAdo<ADOCommitsResponse>(url);
    
    return response.value || [];
  }

  async getBuildsForBranch(branchName: string, top: number = 50, repositoryGuid?: string): Promise<Build[]> {
    const normalizedBranch = branchName.startsWith('refs/heads/') 
      ? branchName 
      : `refs/heads/${branchName}`;
    
    // Use repository GUID if provided, otherwise check for known repos requiring GUID
    let repoId = repositoryGuid || this.parsedUrl.repository;
    
    // Hard-fix for PowerBIClients: Always use GUID
    if (repoId.toLowerCase() === POWERBI_CLIENTS_REPO_NAME.toLowerCase()) {
      repoId = POWERBI_CLIENTS_REPO_GUID;
    }
    
    const url = `${this.baseUrl}/_apis/build/builds?branchName=${encodeURIComponent(normalizedBranch)}&repositoryId=${encodeURIComponent(repoId)}&repositoryType=TfsGit&$top=${top}&queryOrder=startTimeDescending&api-version=${API_VERSION}`;
    
    try {
      const response = await this.fetchAdo<ADOBuildsResponse>(url);
      return response.value || [];
    } catch (error) {
      console.warn('Could not fetch builds:', error);
      return [];
    }
  }

  /**
   * Get commits/changes that are part of a specific build
   */
  async getBuildChanges(buildId: number): Promise<string[]> {
    const url = `${this.baseUrl}/_apis/build/builds/${buildId}/changes?api-version=${API_VERSION}`;
    
    try {
      const response = await this.fetchAdo<ADOBuildChangesResponse>(url);
      return (response.value || []).map(change => change.id);
    } catch (error) {
      console.warn(`Could not fetch changes for build ${buildId}:`, error);
      return [];
    }
  }

  async getEnvironments(): Promise<ADOEnvironment[]> {
    const url = `${this.baseUrl}/_apis/distributedtask/environments?api-version=${API_VERSION_PREVIEW}`;
    
    try {
      const response = await this.fetchAdo<ADOEnvironmentsResponse>(url);
      return response.value || [];
    } catch (error) {
      console.warn('Could not fetch environments:', error);
      return [];
    }
  }

  async getEnvironmentDeploymentRecords(environmentId: number, top: number = 50): Promise<ADOEnvironmentDeploymentRecord[]> {
    const url = `${this.baseUrl}/_apis/distributedtask/environments/${environmentId}/environmentdeploymentrecords?top=${top}&api-version=${API_VERSION_PREVIEW}`;
    
    try {
      const response = await this.fetchAdo<ADOEnvironmentDeploymentRecordsResponse>(url);
      return response.value || [];
    } catch (error) {
      console.warn(`Could not fetch deployment records for environment ${environmentId}:`, error);
      return [];
    }
  }

  /**
   * Get build details by ID - needed to get sourceVersion (the commit the build was built from)
   */
  async getBuildById(buildId: number): Promise<Build | null> {
    const url = `${this.baseUrl}/_apis/build/builds/${buildId}?api-version=${API_VERSION}`;
    console.log(`      🔍 Fetching build ${buildId}: ${url}`);
    
    try {
      const response = await this.fetchAdo<Build>(url);
      console.log(`      📥 Build ${buildId}: sourceVersion=${response.sourceVersion?.substring(0, 7)}, branch=${response.sourceBranch?.replace('refs/heads/', '')}`);
      return response;
    } catch (error) {
      console.warn(`Could not fetch build ${buildId}:`, error);
      return null;
    }
  }

  /**
   * Get release details by ID (fallback for Classic Release deployments)
   */
  async getReleaseById(releaseId: number): Promise<ADORelease | null> {
    const vsrmBaseUrl = buildVsrmApiBaseUrl(this.parsedUrl);
    const url = `${vsrmBaseUrl}/_apis/release/releases/${releaseId}?api-version=${API_VERSION}`;
    console.log(`      🔍 Fetching release ${releaseId}: ${url}`);
    
    try {
      // Create a temporary fetcher for VSRM that doesn't use the default baseUrl
      // or just use fetchAdo which takes full URL
      const response = await this.fetchAdo<ADORelease>(url);
      return response;
    } catch (error) {
      console.warn(`Could not fetch release ${releaseId}:`, error);
      return null;
    }
  }

  /**
   * Check if commitA is an ancestor of commitB using Git Merge Bases API
   * If the merge base of A and B equals A, then A is an ancestor of B
   */
  async isCommitAncestor(commitA: string, commitB: string): Promise<boolean> {
    // Resolve repo ID (use GUID for PowerBIClients)
    let repoId = this.parsedUrl.repository;
    if (repoId.toLowerCase() === POWERBI_CLIENTS_REPO_NAME.toLowerCase()) {
      repoId = POWERBI_CLIENTS_REPO_GUID;
    }

    // Correct URL format: commits/{commitId}/mergebases?otherCommitId=xxx
    const url = `${this.baseUrl}/_apis/git/repositories/${encodeURIComponent(repoId)}/commits/${commitA}/mergebases?otherCommitId=${commitB}&api-version=${API_VERSION}`;
    
    console.log(`      📡 Calling merge bases API: ${url}`);
    
    try {
      const response = await this.fetchAdo<{ value: Array<{ commitId: string }> }>(url);
      const mergeBases = response.value || [];
      
      console.log(`      Merge bases response (count: ${mergeBases.length}):`, mergeBases.map(mb => mb.commitId.substring(0, 7)));
      
      // If merge base equals commitA, then commitA is an ancestor of commitB
      const isAncestor = mergeBases.some(mb => 
        mb.commitId.toLowerCase() === commitA.toLowerCase() ||
        mb.commitId.toLowerCase().startsWith(commitA.toLowerCase().substring(0, 7)) ||
        commitA.toLowerCase().startsWith(mb.commitId.toLowerCase().substring(0, 7))
      );
      
      console.log(`      Is ${commitA.substring(0, 7)} ancestor of ${commitB.substring(0, 7)}? ${isAncestor}`);
      return isAncestor;
    } catch (error) {
      console.warn(`Could not check ancestry for commits ${commitA} -> ${commitB}:`, error);
      return false;
    }
  }

  /**
   * Check if a PR's merge commit is included in a build
   * Uses two strategies:
   * 1. Quick check via Build Changes API (works for recent builds with <50 commits)
   * 2. Ancestry check via Merge Bases API (definitive, works for all)
   */
  async isCommitInBuild(prMergeCommitId: string, buildId: number, prCommitIds: string[] = []): Promise<boolean> {
    // Strategy 1: Quick check in build changes (fast, but limited to 50 commits)
    const buildChanges = await this.getBuildChanges(buildId);
    console.log(`      Build ${buildId}: ${buildChanges.length} changes in API response`);
    
    const foundInChanges = buildChanges.some(changeId =>
      changeId.toLowerCase().startsWith(prMergeCommitId.toLowerCase().substring(0, 7)) ||
      prMergeCommitId.toLowerCase().startsWith(changeId.toLowerCase().substring(0, 7)) ||
      prCommitIds.some(prCommit =>
        changeId.toLowerCase().startsWith(prCommit.toLowerCase().substring(0, 7)) ||
        prCommit.toLowerCase().startsWith(changeId.toLowerCase().substring(0, 7))
      )
    );
    
    if (foundInChanges) {
      console.log(`      ✓ Commit found directly in build changes`);
      return true;
    }
    
    // Strategy 2: Ancestry check - is prMergeCommit an ancestor of build's sourceVersion?
    const build = await this.getBuildById(buildId);
    if (!build || !build.sourceVersion) {
      console.log(`      ✗ Could not get build sourceVersion`);
      return false;
    }
    
    console.log(`      Checking ancestry: ${prMergeCommitId.substring(0, 7)} ancestor of ${build.sourceVersion.substring(0, 7)}?`);
    const isAncestor = await this.isCommitAncestor(prMergeCommitId, build.sourceVersion);
    
    if (isAncestor) {
      console.log(`      ✓ Commit is ancestor of build sourceVersion`);
    } else {
      console.log(`      ✗ Commit is NOT ancestor of build sourceVersion`);
    }
    
    return isAncestor;
  }

  detectProductPrefix(branchName: string, prTitle: string): string | null {
    const branchLower = branchName.toLowerCase();
    const titleLower = prTitle.toLowerCase();
    const prefixes = ['viz', 'plg', 'rdl', 'src'];
    
    for (const prefix of prefixes) {
      if (branchLower.includes(prefix) || titleLower.includes(prefix)) {
        return prefix.toUpperCase();
      }
    }
    return null;
  }

  /**
   * Get PLG deployments - CORRECT MODEL (per-ring independent verification)
   * 
   * PLG Deployment Model (from RM wiki):
   * - Each ring (EDOG, Daily, DXT, MSIT, Canary1, Canary2, PROD) has its OWN pipeline
   * - Daily deploys from `master` branch  
   * - DXT+ deploy from release branches (e.g., `releases/2026/02.1`)
   * - These are INDEPENDENT - don't assume linear "Daily → DXT" flow by timestamps
   * 
   * CORRECT verification for EACH ring independently:
   * 1. Get deployment records for that ring's ADO environment
   * 2. Get the build metadata (sourceBranch, sourceVersion) 
   * 3. Check if PR's merge commit is an ANCESTOR of build's sourceVersion
   * 4. This works for BOTH master-based AND release-branch-based deployments
   *    because if PR merged to main before release branch fork, the PR commit
   *    is still an ancestor of the release branch's commits
   */
  async getPLGDeployments(
    mergeCommitId?: string,
    closedDate?: string,
    _prCommitIds: string[] = []
  ): Promise<DeploymentStatus[]> {
    console.log('🚂 Checking deployments (Unified Check)...');
    
    if (!closedDate || !mergeCommitId) {
      console.warn('⚠️ No closed date or merge commit - PR might not be merged yet');
      return ALL_TRACKED_ENVIRONMENTS.map(env => ({
        environment: env.adoEnvName,
        environmentId: env.adoEnvId,
        status: 'notDeployed' as const,
        deploymentType: env.deploymentType,
      }));
    }

    console.log(`  PR merge commit: ${mergeCommitId.substring(0, 7)}`);
    console.log(`  PR closed date: ${closedDate}`);

    const deployments: DeploymentStatus[] = [];

    // Check each environment INDEPENDENTLY
    // Each ring has its own pipeline and may deploy from different branches
    for (const env of ALL_TRACKED_ENVIRONMENTS) {
      try {
        console.log(`\n  📍 ${env.displayName} (envId: ${env.adoEnvId}) [${env.product || 'PLG'}]...`);
        
        const records = await this.getEnvironmentDeploymentRecords(env.adoEnvId, 30);
        
        // Get successful deployments, newest first
        // Check deployments to find one that contains the PR
        
        // Group records by buildId to handle multi-job deployments (consolidate partials)
        const buildGroups = new Map<string, any[]>();
        records.forEach(r => {
          if (!r.owner?.id) return;
          const bid = String(r.owner.id);
          if (!buildGroups.has(bid)) buildGroups.set(bid, []);
          buildGroups.get(bid)?.push(r);
        });

        // Create a list of "best" records for each build
        const validDeployments = Array.from(buildGroups.values())
          .map(group => {
            // If any part succeeded, consider the build deployed
            const successRecord = group.find(r => r.result?.toLowerCase() === 'succeeded');
            if (successRecord) return successRecord;
            
            // If any part is running (and nothing succeeded yet), consider in progress
            const progressRecord = group.find(r => !r.result && r.startTime && !r.finishTime);
            if (progressRecord) return progressRecord;
            
            return null; // Ignore failed/other states if no success/progress
          })
          .filter(r => r !== null); // Remove nulls

        // Deep scan to handle mixed repo deployments (skip cross-repo) and 404s (Releases vs Builds)
        const maxChecks = 10;
        let successfulChecks = 0;
        let confirmedDeployment = null;
        let deploymentStatus: DeploymentStatus['status'] = 'deployed';
        
        console.log(`    📋 Scanning deployment history for ${env.displayName} (checking up to ${maxChecks} candidates from ${validDeployments.length} records)...`);
        
        for (const deployment of validDeployments) {
          if (successfulChecks >= maxChecks) break;
          
          const ownerId = deployment.owner?.id;
          if (!ownerId) continue;
          
          let sourceVersion: string | undefined;
          let buildStartTime: Date | undefined;
          let webUrl = deployment.owner?._links?.web?.href;

          // Try to get as Build first
          const build = await this.getBuildById(ownerId);
          let buildRepoName: string | undefined;
          
          if (build && build.sourceVersion) {
            sourceVersion = build.sourceVersion;
            buildStartTime = new Date(build.startTime);
            webUrl = build._links.web.href || webUrl;
            // Trying to extract repo name from build definition or repository object if available
            // Note: ADO Build object often has repository details
            if ((build as any).repository) {
                buildRepoName = (build as any).repository.name;
            }
          } else {
             // Fallback: Try to get as Release
             console.log(`    Build ${ownerId} not found or validity check failed. Trying as Release...`);
             const release = await this.getReleaseById(ownerId);
             
             if (release) {
               console.log(`    📥 Release ${ownerId} found. Checking artifacts...`);
               webUrl = release._links.web.href || webUrl;
               if (release.createdOn) buildStartTime = new Date(release.createdOn);

               // Find primary artifact (assuming it provides source version)
               // For classic releases, we look for the primary artifact which is usually the build
               const primaryArtifact = release.artifacts[0]; // Simplification: take first
               if (primaryArtifact && primaryArtifact.definitionReference?.version) {
                  const versionId = primaryArtifact.definitionReference.version.id;
                  console.log(`    Release maps to artifact version: ${versionId}`);
                  
                  // If versionId looks like a commit (40 chars hex) -> use it
                  // If it looks like a build ID (digits) -> fetch that build
                  if (/^[0-9a-f]{40}$/i.test(versionId)) {
                     sourceVersion = versionId;
                  } else {
                     // Try to fetch the artifact build
                     const artifactBuildId = parseInt(versionId);
                     if (!isNaN(artifactBuildId)) {
                       const artifactBuild = await this.getBuildById(artifactBuildId);
                       if (artifactBuild) {
                         sourceVersion = artifactBuild.sourceVersion;
                         // Use artifact timestamp if release timestamp missing? No release timestamp is deployment time.
                       }
                     }
                  }
               }
             }
          }

          if (!sourceVersion) {
             console.log(`    ⚠️ Could not resolve source version for deployment ${ownerId}. Skipping.`);
             continue; 
          }
          const prRepo = this.parsedUrl.repository.toLowerCase();
          const buildRepo = buildRepoName ? buildRepoName.toLowerCase() : '';
          
          // Determine if we can use strictly ancestry check (Same Repo) or need fuzzy time check (Cross Repo/Unknown)
          const isSameRepo = buildRepo && (buildRepo === prRepo || buildRepo.includes(prRepo) || prRepo.includes(buildRepo));
          let isMatch = false;

          if (env.product === 'PLG' && isSameRepo) {
            // PLG: Same-Repo Ancestry Check (Strict)
            // Only use this if we are SURE the build comes from the same repo.
            
            console.log(`    Checking commit ancestry (Same Repo: ${prRepo})...`);
            isMatch = await this.isCommitAncestor(mergeCommitId, sourceVersion);
          } else {
            // Cross-Repo or Unknown: Time-Based Heuristic
            // This handles PowerBIClients -> Power BI (monolith) flow
            // If Deployment Build Time > PR Merge Time + Buffer, it likely contains the PR
            if (buildStartTime) {
              const prMergeTime = new Date(closedDate);
              // Add small buffer (e.g. 15 mins) to avoid race conditions where build started before PR merge finished but picked it up
              // actually, if build started AFTER merge, it definitely has it.
              isMatch = buildStartTime > prMergeTime;
              console.log(`    Checking timestamps (Cross-Repo/Fallback): Build ${buildStartTime.toLocaleString()} > PR Merge ${prMergeTime.toLocaleString()}? ${isMatch}`);
            }
          }

          if (isMatch) {
            console.log(`    ✅ Match found in deployment metadata (Build/Release ${ownerId})`);
            confirmedDeployment = deployment;
            
            // Determine status based on deployment result
            if (!deployment.result && deployment.startTime && !deployment.finishTime) {
               deploymentStatus = 'inProgress';
            } else if (deployment.result?.toLowerCase() === 'succeeded') {
               deploymentStatus = 'deployed';
            } else {
               deploymentStatus = 'unknown';
            }
            // Update URL to point to the actual build/release
            if (confirmedDeployment.owner?._links?.web) {
               confirmedDeployment.owner._links.web.href = webUrl || confirmedDeployment.owner._links.web.href;
            }
            break;
          }
        }

        if (confirmedDeployment) {
          deployments.push({
            environment: env.adoEnvName,
            environmentId: env.adoEnvId,
            status: deploymentStatus,
            deploymentType: env.deploymentType,
            timestamp: confirmedDeployment.finishTime || confirmedDeployment.startTime || confirmedDeployment.queueTime,
            buildId: confirmedDeployment.owner?.id,
            buildNumber: confirmedDeployment.owner?.name,
            url: confirmedDeployment.owner?._links?.web?.href,
          });
        } else {
          // No deployment contains this PR yet
          deployments.push({
            environment: env.adoEnvName,
            environmentId: env.adoEnvId,
            status: 'waitingForTrain',
            deploymentType: env.deploymentType,
          });
        }
      } catch (error) {
        console.warn(`Error checking ${env.displayName}:`, error);
        deployments.push({
          environment: env.adoEnvName,
          environmentId: env.adoEnvId,
          status: 'unknown',
          deploymentType: env.deploymentType,
        });
      }
    }

    console.log('\n🏁 Deployment check complete');
    return deployments;
  }

  /**
   * Find builds on target branch (main) that contain the PR's merge commit
   * This is the CORRECT way to track where the code actually went
   */
  async findBuildsContainingCommit(
    _targetBranch: string,
    mergeCommitId: string,
    prCommitIds: string[],
    closedDate: string,
    repositoryGuid: string
  ): Promise<Build[]> {
    console.log(`🔍 Looking for builds containing commit ${mergeCommitId.substring(0, 7)}`);
    
    // Ensure we use GUID if provided string is still the name for PowerBIClients
    let repoId = repositoryGuid;
    if (repoId.toLowerCase() === POWERBI_CLIENTS_REPO_NAME.toLowerCase()) {
      repoId = POWERBI_CLIENTS_REPO_GUID;
    }
    
    // Get ALL recent builds on repository (not just CI builds on target branch)
    // This includes Release pipeline builds
    const url = `${this.baseUrl}/_apis/build/builds?repositoryId=${encodeURIComponent(repoId)}&repositoryType=TfsGit&minTime=${new Date(closedDate).toISOString()}&$top=200&queryOrder=startTimeDescending&api-version=${API_VERSION}`;
    
    let builds: Build[] = [];
    try {
      const response = await this.fetchAdo<ADOBuildsResponse>(url);
      builds = response.value || [];
      console.log(`Found ${builds.length} total builds after PR merge date (${new Date(closedDate).toLocaleDateString()})`);
    } catch (error) {
      console.warn('Could not fetch builds:', error);
      return [];
    }
    
    const buildsWithCommit: Build[] = [];
    let buildsChecked = 0;
    
    for (const build of builds) {
      // Only check builds that started after PR was closed
      if (new Date(build.startTime) < new Date(closedDate)) {
        continue;
      }
      
      buildsChecked++;
      
      // Get changes in this build
      const changes = await this.getBuildChanges(build.id);
      
      if (buildsChecked <= 3) {
        console.log(`Checking build ${build.buildNumber} (${build.id}): ${changes.length} changes`);
        if (changes.length > 0) {
          console.log(`  First few commits: ${changes.slice(0, 3).map(c => c.substring(0, 7)).join(', ')}`);
        }
      }
      
      // Check if merge commit or any PR commits are in this build
      const hasOurCommit = changes.some(changeId => 
        changeId.toLowerCase().startsWith(mergeCommitId.toLowerCase().substring(0, 7)) ||
        mergeCommitId.toLowerCase().startsWith(changeId.toLowerCase().substring(0, 7)) ||
        prCommitIds.some(prCommit => 
          changeId.toLowerCase().startsWith(prCommit.toLowerCase().substring(0, 7)) ||
          prCommit.toLowerCase().startsWith(changeId.toLowerCase().substring(0, 7))
        )
      );
      
      if (hasOurCommit) {
        console.log(`✅ Build ${build.buildNumber} (${build.id}) contains our commit`);
        buildsWithCommit.push(build);
      }
    }
    
    console.log(`Checked ${buildsChecked} builds, found ${buildsWithCommit.length} with our code`);
    
    return buildsWithCommit;
  }

  /**
   * Calculate which train the PR belongs to based on weekly fork schedule
   * Trains fork every Thursday ~10pm PST (based on Wed night code)
   * 
   * From Fabric RM docs:
   * - Fork happens weekly on Thursday
   * - PR merged before Thursday fork → goes into that week's train
   * - PR merged after Thursday fork → goes into next week's train
   */
  private getTrainForkDate(mergeDate: Date): Date {
    // Convert to PST for accurate fork calculation
    const mergeDatePST = new Date(mergeDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    
    const dayOfWeek = mergeDatePST.getDay(); // 0=Sun, 4=Thu
    
    // If merged before Thursday 10pm, use this week's Thursday
    // If merged after, use next Thursday
    let daysUntilThursday: number;
    
    if (dayOfWeek < 4) {
      // Mon-Wed → use this week's Thursday
      daysUntilThursday = 4 - dayOfWeek;
    } else if (dayOfWeek === 4) {
      // Thursday - check if before or after 10pm
      const hours = mergeDatePST.getHours();
      if (hours < 22) {
        daysUntilThursday = 0; // This Thursday
      } else {
        daysUntilThursday = 7; // Next Thursday
      }
    } else {
      // Fri-Sun → use next week's Thursday
      daysUntilThursday = (11 - dayOfWeek);
    }
    
    const forkDate = new Date(mergeDatePST);
    forkDate.setDate(forkDate.getDate() + daysUntilThursday);
    forkDate.setHours(22, 0, 0, 0); // 10pm PST
    
    return forkDate;
  }

  /**
   * Get deployments using train schedule + build verification
   * 
   * CORRECT APPROACH (per Fabric RM):
   * 1. Calculate train from merge time (Thursday cutoff)
   * 2. Try to find builds with the commit (Build Changes API)
   * 3. If found → track those builds to environments (100% accurate)
   * 4. If not found (API limits) → use train window as estimate
   */
  async getDeploymentsByMergeDate(
    closedDate: string,
    sourceBranch: string,
    prTitle: string,
    mergeCommitId?: string,
    targetBranch?: string,
    repositoryGuid?: string
  ): Promise<DeploymentStatus[]> {
    const mergeDate = new Date(closedDate);
    const trainForkDate = this.getTrainForkDate(mergeDate);
    
    console.log(`📅 PR merged: ${mergeDate.toLocaleString()}`);
    console.log(`🚂 Train fork: ${trainForkDate.toLocaleString()}`);
    
    // Try build-based approach first (most accurate)
    if (mergeCommitId && targetBranch && repositoryGuid) {
      const buildsWithCommit = await this.findBuildsContainingCommit(
        targetBranch,
        mergeCommitId,
        [],
        closedDate,
        repositoryGuid
      );
      
      if (buildsWithCommit.length > 0) {
        console.log(`✅ Found ${buildsWithCommit.length} builds with commit - using build-based tracking`);
        return this.getDeploymentsForBuilds(buildsWithCommit, sourceBranch, prTitle);
      }
      
      console.warn(`⚠️ No builds found with commit (API limits) - falling back to train window estimate`);
    }
    
    // Fallback: train window estimate
    // Based on Fabric train schedule:
    // Train forks Thursday 10pm
    // Daily/EDOG: Friday (fork + 1 day)
    // DXT: Next week Mon-Tue (fork + 4-5 days)
    // MSIT: 2 weeks after fork
    // Canary: 3 weeks after fork
    // PROD: 4 weeks after fork
    
    const searchStart = new Date(trainForkDate);
    searchStart.setDate(searchStart.getDate() + 1); // Start day AFTER fork (Friday = Daily/EDOG)
    
    const searchEnd = new Date(trainForkDate);
    searchEnd.setDate(searchEnd.getDate() + 35); // 5 weeks after fork (covers PROD)
    
    console.log(`🔍 Train window: ${searchStart.toLocaleDateString()} to ${searchEnd.toLocaleDateString()}`);
    console.log(`   (Deployments in this window should contain the PR code)`);
    
    const deployments: DeploymentStatus[] = [];
    
    // Get all environments
    const environments = await this.getEnvironments();
    // const detectedPrefix = this.detectProductPrefix(sourceBranch, prTitle);
    
    // Filter to only show PLG environments
    const plgStages = ['EDOG', 'Daily', 'DXT', 'MSIT', 'PROD-Canary1', 'PROD-Canary2', 'PROD'];
    const relevantEnvs = environments.filter(env => {
      const name = env.name.toUpperCase();
      if (!name.startsWith('PLG-')) return false;
      
      const stage = name.substring(4); // Remove "PLG-"
      return plgStages.some(s => stage === s || stage.startsWith(s));
    });
    
    console.log(`Checking ${relevantEnvs.length} environments`);
    
    // For each environment, find first successful deployment after merge date
    for (const env of relevantEnvs) {
      try {
        const records = await this.getEnvironmentDeploymentRecords(env.id, 100);
        
        // Find FIRST successful deployment in train window after fork
        const deploymentInTrainWindow = records
          .filter(r => {
            const deployDate = new Date(r.queueTime || r.startTime);
            return deployDate >= trainForkDate && 
                   deployDate <= searchEnd && 
                   r.result?.toLowerCase() === 'succeeded';
          })
          .sort((a, b) => {
            const aDate = new Date(a.queueTime || a.startTime);
            const bDate = new Date(b.queueTime || b.startTime);
            return aDate.getTime() - bDate.getTime();
          })[0];
        
        if (deploymentInTrainWindow) {
          const deployDate = new Date(deploymentInTrainWindow.queueTime || deploymentInTrainWindow.startTime);
          const daysAfterFork = Math.floor((deployDate.getTime() - trainForkDate.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`⚠️  ${env.name}: Deployment found ${daysAfterFork} days after fork (${deployDate.toLocaleDateString()}) - CANNOT VERIFY if it contains this PR`);
          
          deployments.push({
            environment: env.name,
            environmentId: env.id,
            status: 'unknown',
            timestamp: deploymentInTrainWindow.finishTime || deploymentInTrainWindow.startTime || deploymentInTrainWindow.queueTime,
            runId: deploymentInTrainWindow.owner?.id,
            url: deploymentInTrainWindow.owner?._links?.web?.href,
          });
        } else {
          console.log(`⚪ ${env.name}: No deployment in train window`);
          deployments.push({
            environment: env.name,
            environmentId: env.id,
            status: 'notDeployed',
          });
        }
      } catch (error) {
        console.warn(`Error checking ${env.name}:`, error);
        deployments.push({
          environment: env.name,
          environmentId: env.id,
          status: 'unknown',
        });
      }
    }
    
    return deployments;
  }

  /**
   * Get deployments for specific builds (most accurate method)
   */
  private async getDeploymentsForBuilds(
    builds: Build[],
    sourceBranch: string,
    prTitle: string
  ): Promise<DeploymentStatus[]> {
    const deployments: DeploymentStatus[] = [];
    const buildIds = new Set(builds.map(b => b.id));
    
    const environments = await this.getEnvironments();
    const detectedPrefix = this.detectProductPrefix(sourceBranch, prTitle);
    
    const relevantEnvs = environments.filter(env => {
      const name = env.name.toUpperCase();
      if (detectedPrefix) {
        return name.startsWith(detectedPrefix + '-');
      }
      return name.startsWith('VIZ-') || 
             name.startsWith('PLG-') || 
             name.startsWith('RDL-') || 
             name.startsWith('SRC-');
    });
    
    for (const env of relevantEnvs) {
      try {
        const records = await this.getEnvironmentDeploymentRecords(env.id, 100);
        
        const matchingDeployment = records.find(r => 
          r.owner?.id && buildIds.has(r.owner.id)
        );
        
        if (matchingDeployment) {
          deployments.push({
            environment: env.name,
            environmentId: env.id,
            status: 'deployed',
            timestamp: matchingDeployment.finishTime || matchingDeployment.startTime || matchingDeployment.queueTime,
            runId: matchingDeployment.owner?.id,
            url: matchingDeployment.owner?._links?.web?.href,
          });
        } else {
          deployments.push({
            environment: env.name,
            environmentId: env.id,
            status: 'notDeployed',
          });
        }
      } catch (error) {
        deployments.push({
          environment: env.name,
          environmentId: env.id,
          status: 'unknown',
        });
      }
    }
    
    return deployments;
  }

  /**
   * LEGACY: Get deployments by checking which builds contain the PR's code
   * This approach doesn't work well for old PRs due to Build Changes API limits
   */
  async getDeploymentsByBuildChanges(
    targetBranch: string,
    mergeCommitId: string | undefined,
    prCommitIds: string[],
    closedDate: string,
    sourceBranch: string,
    prTitle: string,
    repositoryGuid: string
  ): Promise<DeploymentStatus[]> {
    const deployments: DeploymentStatus[] = [];
    
    // If no merge commit, can't track accurately
    if (!mergeCommitId || !closedDate) {
      console.warn('⚠️ No merge commit or closed date - cannot track deployments accurately');
      return [];
    }
    
    // Find builds that contain our commits
    const buildsWithOurCode = await this.findBuildsContainingCommit(
      targetBranch,
      mergeCommitId,
      prCommitIds,
      closedDate,
      repositoryGuid
    );
    
    if (buildsWithOurCode.length === 0) {
      console.warn('⚠️ No builds found containing the PR commits');
      return [];
    }
    
    const buildIds = new Set(buildsWithOurCode.map(b => b.id));
    console.log(`Found ${buildIds.size} builds with our code:`, Array.from(buildIds));
    
    // Get all environments
    const environments = await this.getEnvironments();
    const detectedPrefix = this.detectProductPrefix(sourceBranch, prTitle);
    
    const relevantEnvs = environments.filter(env => {
      const name = env.name.toUpperCase();
      if (detectedPrefix) {
        return name.startsWith(detectedPrefix + '-');
      }
      return name.startsWith('VIZ-') || 
             name.startsWith('PLG-') || 
             name.startsWith('RDL-') || 
             name.startsWith('SRC-');
    });
    
    console.log(`Checking ${relevantEnvs.length} environments for our builds`);
    
    // For each environment, check if any deployment used one of our builds
    for (const env of relevantEnvs) {
      try {
        const records = await this.getEnvironmentDeploymentRecords(env.id, 100);
        
        // Find deployment that used one of our builds
        const ourDeployment = records.find(r => {
          const ownerIdMatch = r.owner?.id && buildIds.has(r.owner.id);
          if (ownerIdMatch) {
            console.log(`🎯 ${env.name}: Found matching deployment - build ${r.owner.id}`);
          }
          return ownerIdMatch;
        });
        
        if (ourDeployment) {
          const deployDate = new Date(ourDeployment.queueTime || ourDeployment.startTime);
          console.log(`✅ ${env.name}: Deployed with build ${ourDeployment.owner.id} on ${deployDate.toLocaleDateString()}`);
          
          let status: DeploymentStatus['status'] = 'deployed';
          if (ourDeployment.result) {
            status = ourDeployment.result.toLowerCase() === 'succeeded' ? 'deployed' :
                     ourDeployment.result.toLowerCase() === 'failed' ? 'unknown' :
                     'inProgress';
          } else if (!ourDeployment.finishTime) {
            status = 'inProgress';
          }
          
          deployments.push({
            environment: env.name,
            environmentId: env.id,
            status,
            timestamp: ourDeployment.finishTime || ourDeployment.startTime || ourDeployment.queueTime,
            runId: ourDeployment.owner?.id,
            url: ourDeployment.owner?._links?.web?.href,
          });
        } else {
          console.log(`⚪ ${env.name}: Code hasn't reached yet`);
          deployments.push({
            environment: env.name,
            environmentId: env.id,
            status: 'notDeployed',
          });
        }
      } catch (error) {
        console.warn(`Error checking ${env.name}:`, error);
        deployments.push({
          environment: env.name,
          environmentId: env.id,
          status: 'unknown',
        });
      }
    }
    
    return deployments;
  }

  /**
   * Main method - Get all deployments for the PR
   * Uses optimized PLG deployment check with specific environment IDs
   */
  async getAllDeployments(
    _sourceBranch: string, 
    _prTitle: string = '', 
    prCommitIds: string[] = [], 
    _prCreationDate: string = '',
    prMergeDate?: string,
    mergeCommitId?: string,
    _targetBranch?: string,
    _repositoryGuid?: string
  ): Promise<DeploymentStatus[]> {
    // Use the optimized PLG deployment check
    return this.getPLGDeployments(mergeCommitId, prMergeDate, prCommitIds);
  }
}

export function createADOService(pat: string, parsedUrl: ParsedPRUrl): ADOService {
  return new ADOService(pat, parsedUrl);
}