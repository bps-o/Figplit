import { request as internalRequest } from '~/lib/fetch';
import type { Response as NodeFetchResponse } from 'node-fetch';

type GitHubResponse = globalThis.Response | NodeFetchResponse;

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export const GITHUB_SCOPE = 'repo user:email';

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name?: string | null;
}

export interface GitHubRepository {
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
}

export interface GitHubCommitResult {
  commitSha: string;
  branch: string;
  treeSha: string;
}

export interface GitHubPullRequestResult {
  number: number;
  url: string;
  html_url: string;
  title: string;
}

interface GitHubTreeItemInput {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
  mode?: '100644' | '100755' | '040000' | '160000' | '120000';
}

interface GitHubBlobResponse {
  sha: string;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
}

interface GitHubCommitResponse {
  sha: string;
  url: string;
  tree: { sha: string };
}

export function getGitHubAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  scope: string = GITHUB_SCOPE,
) {
  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);

  return authorizeUrl.toString();
}

export async function exchangeCodeForToken(code: string, clientId: string, clientSecret: string, redirectUri: string) {
  const response = await internalRequest(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange GitHub OAuth code (${response.status})`);
  }

  const payload = (await response.json()) as { access_token?: string; error?: string; error_description?: string };

  if (!payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'GitHub OAuth response missing access token');
  }

  return payload.access_token;
}

export async function fetchGitHubUser(token: string) {
  const response = await fetchFromGitHub('/user', token);

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user (${response.status})`);
  }

  const data = (await response.json()) as GitHubUser;

  return data;
}

export async function fetchRepository(token: string, owner: string, repo: string) {
  const response = await fetchFromGitHub(`/repos/${owner}/${repo}`, token);

  if (!response.ok) {
    throw new Error(`Failed to fetch repository ${owner}/${repo} (${response.status})`);
  }

  const data = (await response.json()) as GitHubRepository;

  return data;
}

export async function fetchBranchRef(token: string, owner: string, repo: string, branch: string) {
  const response = await fetchFromGitHub(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, token);

  if (!response.ok) {
    throw new Error(`Failed to fetch branch ${branch} (${response.status})`);
  }

  const payload = (await response.json()) as { object: { sha: string; url: string } };

  return payload.object.sha;
}

export async function createBranchRef(token: string, owner: string, repo: string, branch: string, sha: string) {
  const response = await fetchFromGitHub(`/repos/${owner}/${repo}/git/refs`, token, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha,
    }),
  });

  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message || `Failed to create branch ${branch}`);
  }
}

export async function fetchCommit(token: string, owner: string, repo: string, sha: string) {
  const response = await fetchFromGitHub(`/repos/${owner}/${repo}/git/commits/${sha}`, token);

  if (!response.ok) {
    throw new Error(`Failed to fetch commit ${sha} (${response.status})`);
  }

  const data = (await response.json()) as GitHubCommitResponse;

  return data;
}

export async function createBlob(
  token: string,
  owner: string,
  repo: string,
  content: string,
  encoding: 'utf-8' | 'base64',
) {
  const response = await fetchFromGitHub(`/repos/${owner}/${repo}/git/blobs`, token, {
    method: 'POST',
    body: JSON.stringify({ content, encoding }),
  });

  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message || 'Failed to create blob');
  }

  const data = (await response.json()) as GitHubBlobResponse;

  return data.sha;
}

export async function createTree(
  token: string,
  owner: string,
  repo: string,
  items: GitHubTreeItemInput[],
  baseTreeSha?: string,
) {
  const treeItems = await Promise.all(
    items.map(async (item) => {
      const blobSha = await createBlob(token, owner, repo, item.content, item.encoding ?? 'utf-8');

      return {
        path: item.path,
        mode: item.mode ?? '100644',
        type: 'blob',
        sha: blobSha,
      };
    }),
  );

  const response = await fetchFromGitHub(`/repos/${owner}/${repo}/git/trees`, token, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  });

  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message || 'Failed to create tree');
  }

  const data = (await response.json()) as GitHubTreeResponse;

  return data.sha;
}

export async function createCommit(
  token: string,
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentSha: string,
) {
  const response = await fetchFromGitHub(`/repos/${owner}/${repo}/git/commits`, token, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentSha],
    }),
  });

  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message || 'Failed to create commit');
  }

  const data = (await response.json()) as GitHubCommitResponse;

  return data;
}

export async function updateBranchRef(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  force = false,
) {
  const response = await fetchFromGitHub(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, {
    method: 'PATCH',
    body: JSON.stringify({
      sha,
      force,
    }),
  });

  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message || `Failed to update branch ${branch}`);
  }
}

export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body?: string,
) {
  const response = await fetchFromGitHub(`/repos/${owner}/${repo}/pulls`, token, {
    method: 'POST',
    body: JSON.stringify({ title, head, base, body }),
  });

  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message || 'Failed to create pull request');
  }

  const data = (await response.json()) as GitHubPullRequestResult;

  return data;
}

async function fetchFromGitHub(path: string, token: string, init: RequestInit = {}): Promise<GitHubResponse> {
  const url = path.startsWith('http') ? path : `${GITHUB_API_BASE}${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'Figplit',
  };

  if (init.headers) {
    const initHeaders = new Headers(init.headers);

    for (const [key, value] of initHeaders.entries()) {
      headers[key] = value;
    }
  }

  const response = await internalRequest(url, {
    ...init,
    headers,
  });

  return response as GitHubResponse;
}

async function safeReadError(response: GitHubResponse) {
  try {
    const data = await response.json();

    if (typeof data === 'object' && data && 'message' in data) {
      return String(data.message);
    }
  } catch {
    // ignore JSON errors and fall back to text
  }

  try {
    return await response.text();
  } catch {
    return undefined;
  }
}
