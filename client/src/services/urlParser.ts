import { ParsedPRUrl } from '../types';

/**
 * Parse Azure DevOps PR URL and extract organization, project, repository, and PR ID
 * 
 * Supported formats:
 * - https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{prId}
 * - https://{org}.visualstudio.com/{project}/_git/{repo}/pullrequest/{prId}
 * - https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{prId}?_a=overview
 */
export function parsePRUrl(url: string): ParsedPRUrl {
  // Normalize URL - remove query params and trailing slashes
  const cleanUrl = url.split('?')[0].replace(/\/+$/, '');
  
  // Pattern 1: dev.azure.com format
  // https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{prId}
  const devAzurePattern = /https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/i;
  
  // Pattern 2: {org}.visualstudio.com format
  // https://{org}.visualstudio.com/{project}/_git/{repo}/pullrequest/{prId}
  const vstsPattern = /https:\/\/([^.]+)\.visualstudio\.com\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/i;
  
  // Pattern 3: dev.azure.com with DefaultCollection (legacy)
  // https://dev.azure.com/{org}/DefaultCollection/{project}/_git/{repo}/pullrequest/{prId}
  const devAzureCollectionPattern = /https:\/\/dev\.azure\.com\/([^/]+)\/DefaultCollection\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/i;

  let match = cleanUrl.match(devAzurePattern);
  if (match) {
    return {
      organization: match[1],
      project: decodeURIComponent(match[2]),
      repository: decodeURIComponent(match[3]),
      pullRequestId: parseInt(match[4], 10),
    };
  }

  match = cleanUrl.match(vstsPattern);
  if (match) {
    return {
      organization: match[1],
      project: decodeURIComponent(match[2]),
      repository: decodeURIComponent(match[3]),
      pullRequestId: parseInt(match[4], 10),
    };
  }

  match = cleanUrl.match(devAzureCollectionPattern);
  if (match) {
    return {
      organization: match[1],
      project: decodeURIComponent(match[2]),
      repository: decodeURIComponent(match[3]),
      pullRequestId: parseInt(match[4], 10),
    };
  }

  throw new Error(
    `Invalid Azure DevOps PR URL format. Expected format: https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{prId}`
  );
}

/**
 * Validate if a string is a valid Azure DevOps PR URL
 */
export function isValidPRUrl(url: string): boolean {
  try {
    parsePRUrl(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build Azure DevOps API base URL from parsed PR URL
 */
export function buildAdoApiBaseUrl(parsed: ParsedPRUrl): string {
  return `https://dev.azure.com/${parsed.organization}/${encodeURIComponent(parsed.project)}`;
}

/**
 * Build Azure DevOps Release Management API base URL (vsrm)
 */
export function buildVsrmApiBaseUrl(parsed: ParsedPRUrl): string {
  return `https://vsrm.dev.azure.com/${parsed.organization}/${encodeURIComponent(parsed.project)}`;
}