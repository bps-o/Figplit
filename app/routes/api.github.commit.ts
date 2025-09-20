import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { z } from 'zod';
import {
  createBranchRef,
  createCommit,
  createPullRequest,
  createTree,
  fetchBranchRef,
  fetchCommit,
  fetchRepository,
  updateBranchRef,
} from '~/utils/github.server';
import { SESSION_KEYS, getSessionStorage } from '~/utils/session.server';

const fileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
});

const commitSchema = z.object({
  repository: z.string().min(1),
  baseBranch: z.string().min(1),
  newBranch: z.string().min(1),
  commitMessage: z.string().min(1),
  prTitle: z.string().optional(),
  prBody: z.string().optional(),
  files: z.array(fileSchema).nonempty(),
});

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const sessionStorage = getSessionStorage(env);
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const token = session.get(SESSION_KEYS.githubToken);

  if (!token || typeof token !== 'string') {
    return json({ error: 'Not authenticated with GitHub' }, { status: 401 });
  }

  let payload: z.infer<typeof commitSchema>;

  try {
    const data = await request.json();
    payload = commitSchema.parse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid payload';
    return json({ error: message }, { status: 400 });
  }

  const [owner, repo] = payload.repository.split('/');

  if (!owner || !repo) {
    return json({ error: 'Repository must be in the format owner/name' }, { status: 400 });
  }

  if (payload.baseBranch === payload.newBranch) {
    return json({ error: 'New branch must be different from the base branch' }, { status: 400 });
  }

  try {
    await fetchRepository(token, owner, repo);

    const baseCommitSha = await fetchBranchRef(token, owner, repo, payload.baseBranch);
    await createBranchRef(token, owner, repo, payload.newBranch, baseCommitSha);

    const baseCommit = await fetchCommit(token, owner, repo, baseCommitSha);
    const treeSha = await createTree(token, owner, repo, payload.files, baseCommit.tree.sha);
    const commit = await createCommit(token, owner, repo, payload.commitMessage, treeSha, baseCommitSha);

    await updateBranchRef(token, owner, repo, payload.newBranch, commit.sha);

    let pullRequest = null;

    if (payload.prTitle) {
      pullRequest = await createPullRequest(
        token,
        owner,
        repo,
        payload.prTitle,
        payload.newBranch,
        payload.baseBranch,
        payload.prBody,
      );
    }

    return json({
      success: true,
      commitSha: commit.sha,
      branch: payload.newBranch,
      pullRequest,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create commit';
    return json({ error: message }, { status: 500 });
  }
}
