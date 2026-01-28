// =============================================================================
// FE-ONLY TRAIN TRACKER TYPES
// =============================================================================

// FE Environment Configuration (PLG environments in PowerBIClients project)
export interface EnvironmentConfig {
  id: number;
  name: string;
  displayName: string;
  order: number;
}

// FE Environments - VERIFIED CORRECT IDs from ADO
export const FE_ENVIRONMENTS: EnvironmentConfig[] = [
  { id: 172, name: 'EDOG', displayName: 'EDOG', order: 1 },
  { id: 190, name: 'Daily', displayName: 'Daily', order: 2 },
  { id: 191, name: 'DXT', displayName: 'DXT', order: 3 },
  { id: 192, name: 'MSIT', displayName: 'MSIT', order: 4 },
  { id: 310, name: 'Canary1', displayName: 'Canary1', order: 5 },
  { id: 300, name: 'Canary2', displayName: 'Canary2', order: 6 },
];

// Parsed PR URL
export interface ParsedPRUrl {
  organization: string;
  project: string;
  repository: string;
  pullRequestId: number;
}

// PR Information from Azure DevOps
export interface PRInfo {
  id: number;
  title: string;
  status: string;
  sourceRefName: string;
  targetRefName: string;
  repository: {
    id: string;
    name: string;
  };
  createdBy: {
    displayName: string;
  };
  creationDate: string;
  closedDate?: string;
  mergeCommitId?: string;
  url: string;
}

// Inclusion status for a single environment
export type InclusionStatus = 
  | 'included'      // PR merge commit is ancestor of build's sourceVersion
  | 'not-included'  // PR merge commit is NOT ancestor yet
  | 'in-progress'   // Build currently in progress
  | 'no-builds'     // No builds found for this environment
  | 'error';        // Failed to check

// Environment deployment status
export interface EnvironmentDeploymentStatus {
  environment: EnvironmentConfig;
  status: InclusionStatus;
  buildId?: number;
  buildNumber?: string;
  buildTimestamp?: string;
  buildUrl?: string;
  expectedDate?: string; // Expected deployment date based on train schedule
}

// Full result of checking PR deployment status
export interface PRDeploymentResult {
  prInfo: PRInfo;
  environments: EnvironmentDeploymentStatus[];
  supportedRepo: boolean;
  unsupportedMessage?: string;
}
