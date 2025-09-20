import { redirect, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { GITHUB_SCOPE, getGitHubAuthorizeUrl } from '~/utils/github.server';
import { SESSION_KEYS, getSessionStorage } from '~/utils/session.server';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const sessionStorage = getSessionStorage(env);
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));

  const clientId = env.GITHUB_CLIENT_ID;

  if (!clientId) {
    throw new Response('GitHub OAuth is not configured', { status: 503 });
  }

  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo') ?? '/';
  const redirectUri = env.GITHUB_REDIRECT_URI ?? `${url.origin}/auth/github/callback`;
  const state = crypto.randomUUID();

  session.set(SESSION_KEYS.githubState, state);
  session.set(SESSION_KEYS.githubRedirect, redirectTo);

  const authorizeUrl = getGitHubAuthorizeUrl(clientId, redirectUri, state, GITHUB_SCOPE);

  return redirect(authorizeUrl, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session),
    },
  });
}
