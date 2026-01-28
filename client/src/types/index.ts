// PR Info from Azure DevOps
export interface PRInfo {
  id: number;
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
  url: string;
  closedDate?: string;
  mergeCommitId?: string;
}

// Commit from PR
export interface Commit {
  commitId: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  comment: string;
  url: string;
}

// Build information
export interface Build {
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  queueTime: string;
  startTime: string;
  finishTime: string;
  sourceBranch: string;
  sourceVersion: string;
  definition: {
    id: number;
    name: string;
  };
  url: string;
  _links: {
    web: {
      href: string;
    };
  };
}

// Deployment status for an environment
export interface DeploymentStatus {
  environment: string;
  environmentId?: number;
  status: 'deployed' | 'inProgress' | 'pending' | 'notDeployed' | 'waitingForTrain' | 'unknown';
  deploymentType?: 'continuous' | 'train-based';  // EDOG is continuous, others are train-based
  timestamp?: string;
  deploymentId?: number;
  releaseId?: number;
  runId?: number;
  buildId?: number;
  buildNumber?: string;
  url?: string;
}

// Full PR Status response
export interface PRStatusResponse {
  prInfo: PRInfo & { closedDate?: string; mergeCommitId?: string };
  commits: Commit[];
  builds: Build[];
  deployments: DeploymentStatus[];
  parsedUrl: ParsedPRUrl;
}

// Parsed PR URL
export interface ParsedPRUrl {
  organization: string;
  project: string;
  repository: string;
  pullRequestId: number;
}

// API Error response
export interface ApiError {
  message: string;
  code?: string;
  details?: string;
}

// ADO Environment from Pipelines API
export interface ADOEnvironment {
  id: number;
  name: string;
  description?: string;
  createdBy?: {
    displayName: string;
    id: string;
  };
  createdOn?: string;
  lastModifiedBy?: {
    displayName: string;
    id: string;
  };
  lastModifiedOn?: string;
}

// PLG Environment configuration
export interface ServiceEnvironment {
  id: string;
  name: string;
  displayName: string;
  order: number;
  type: 'pre-prod' | 'prod';
  adoEnvId: number;
  adoEnvName: string;
  deploymentType: 'continuous' | 'train-based';  // EDOG is continuous, all others are train-based
  product: 'PLG' | 'RDL' | 'VIZ'; // Added to distinguish logic
}

export type PLGEnvironment = ServiceEnvironment; // Alias for backward compatibility

// Train information
export interface TrainInfo {
  forkDate: Date;           // Thursday fork date
  trainNumber: string;      // e.g., "2026-W05" (year-week)
  isPRInTrain: boolean;     // Is the PR in this train?
  currentEnvironment?: string;  // Where the train currently is
}

// PLG Environments
export const PLG_ENVIRONMENTS: ServiceEnvironment[] = [
  { id: 'plg-edog', name: 'EDOG', displayName: 'PLG EDOG', order: 1, type: 'pre-prod', adoEnvId: 172, adoEnvName: 'PLG-EDOG', deploymentType: 'continuous', product: 'PLG' },
  { id: 'plg-daily', name: 'Daily', displayName: 'PLG Daily', order: 2, type: 'pre-prod', adoEnvId: 190, adoEnvName: 'PLG-Daily', deploymentType: 'train-based', product: 'PLG' },
  { id: 'plg-dxt', name: 'DXT', displayName: 'PLG DXT', order: 3, type: 'pre-prod', adoEnvId: 191, adoEnvName: 'PLG-DXT', deploymentType: 'train-based', product: 'PLG' },
  { id: 'plg-msit', name: 'MSIT', displayName: 'PLG MSIT', order: 4, type: 'pre-prod', adoEnvId: 192, adoEnvName: 'PLG-MSIT', deploymentType: 'train-based', product: 'PLG' },
  { id: 'plg-canary1', name: 'Canary1', displayName: 'PLG Canary 1', order: 5, type: 'prod', adoEnvId: 310, adoEnvName: 'PLG-PROD-Canary1', deploymentType: 'train-based', product: 'PLG' },
  { id: 'plg-canary2', name: 'Canary2', displayName: 'PLG Canary 2', order: 6, type: 'prod', adoEnvId: 300, adoEnvName: 'PLG-PROD-Canary2', deploymentType: 'train-based', product: 'PLG' },
  { id: 'plg-prod', name: 'PROD', displayName: 'PLG PROD', order: 7, type: 'prod', adoEnvId: 223, adoEnvName: 'PLG-PROD', deploymentType: 'train-based', product: 'PLG' },
];

export const RDL_ENVIRONMENTS: ServiceEnvironment[] = [
  { id: 'rdl-edog', name: 'EDOG', displayName: 'RDL EDOG', order: 1, type: 'pre-prod', adoEnvId: 171, adoEnvName: 'RDL-EDOG', deploymentType: 'continuous', product: 'RDL' },
  { id: 'rdl-daily', name: 'Daily', displayName: 'RDL Daily', order: 2, type: 'pre-prod', adoEnvId: 193, adoEnvName: 'RDL-Daily', deploymentType: 'train-based', product: 'RDL' },
  { id: 'rdl-dxt', name: 'DXT', displayName: 'RDL DXT', order: 3, type: 'pre-prod', adoEnvId: 194, adoEnvName: 'RDL-DXT', deploymentType: 'train-based', product: 'RDL' },
  { id: 'rdl-msit', name: 'MSIT', displayName: 'RDL MSIT', order: 4, type: 'pre-prod', adoEnvId: 195, adoEnvName: 'RDL-MSIT', deploymentType: 'train-based', product: 'RDL' },
  { id: 'rdl-canary1', name: 'Canary1', displayName: 'RDL Canary 1', order: 5, type: 'prod', adoEnvId: 382, adoEnvName: 'RDL-Canary1', deploymentType: 'train-based', product: 'RDL' },
  { id: 'rdl-canary2', name: 'Canary2', displayName: 'RDL Canary 2', order: 6, type: 'prod', adoEnvId: 383, adoEnvName: 'RDL-Canary2', deploymentType: 'train-based', product: 'RDL' },
  { id: 'rdl-prod', name: 'PROD', displayName: 'RDL PROD', order: 7, type: 'prod', adoEnvId: 384, adoEnvName: 'RDL-PROD', deploymentType: 'train-based', product: 'RDL' },
];

export const VIZ_ENVIRONMENTS: ServiceEnvironment[] = [
  { id: 'viz-edog', name: 'EDOG', displayName: 'VIZ EDOG', order: 1, type: 'pre-prod', adoEnvId: 173, adoEnvName: 'VIZ-EDOG', deploymentType: 'continuous', product: 'VIZ' },
  { id: 'viz-daily', name: 'Daily', displayName: 'VIZ Daily', order: 2, type: 'pre-prod', adoEnvId: 196, adoEnvName: 'VIZ-Daily', deploymentType: 'train-based', product: 'VIZ' },
  // Adding other VIZ envs as placeholders or partial support
  { id: 'viz-ff', name: 'FF', displayName: 'VIZ FF', order: 3, type: 'pre-prod', adoEnvId: 281, adoEnvName: 'VIZ-FF', deploymentType: 'continuous', product: 'VIZ' },
  { id: 'viz-mc', name: 'MC', displayName: 'VIZ MC', order: 4, type: 'pre-prod', adoEnvId: 293, adoEnvName: 'VIZ-MC', deploymentType: 'continuous', product: 'VIZ' },
];

export const ALL_TRACKED_ENVIRONMENTS = [
  ...PLG_ENVIRONMENTS,
  ...RDL_ENVIRONMENTS,
  ...VIZ_ENVIRONMENTS
];


// Environment stage configuration for ordering
export interface EnvironmentStage {
  key: string;
  order: number;
  displayName: string;
}

// Environment stages for PLG deployment ordering
export const ENVIRONMENT_STAGES: EnvironmentStage[] = [
  { key: 'EDOG', order: 1, displayName: 'EDOG' },
  { key: 'Daily', order: 2, displayName: 'Daily' },
  { key: 'DXT', order: 3, displayName: 'DXT' },
  { key: 'MSIT', order: 4, displayName: 'MSIT' },
  { key: 'Canary1', order: 5, displayName: 'Canary 1' },
  { key: 'PROD-Canary1', order: 5, displayName: 'Canary 1' },
  { key: 'Canary2', order: 6, displayName: 'Canary 2' },
  { key: 'PROD-Canary2', order: 6, displayName: 'Canary 2' },
  { key: 'PROD', order: 7, displayName: 'PROD' },
];

// Legacy: Environment configuration (keeping for backward compatibility)
export interface EnvironmentConfig {
  name: string;
  displayName: string;
  order: number;
  type: 'classic' | 'yaml' | 'both';
  environmentId?: number;
  definitionEnvironmentId?: number;
}

export const FABRIC_ENVIRONMENTS: EnvironmentConfig[] = [
  { name: 'edog', displayName: 'EDOG', order: 1, type: 'both' },
  { name: 'daily', displayName: 'Daily', order: 2, type: 'both' },
  { name: 'dxt', displayName: 'DXT', order: 3, type: 'both' },
  { name: 'msit', displayName: 'MSIT', order: 4, type: 'both' },
  { name: 'canary1', displayName: 'Canary 1', order: 5, type: 'both' },
  { name: 'canary2', displayName: 'Canary 2', order: 6, type: 'both' },
  { name: 'prod', displayName: 'PROD', order: 7, type: 'both' },
];