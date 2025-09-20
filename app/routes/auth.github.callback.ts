import { redirect, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { exchangeCodeForToken, fetchGitHubUser } from '~/utils/github.server';
import { SESSION_KEYS, getSessionStorage } from '~/utils/session.server';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const sessionStorage = getSessionStorage(env);
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = session.get(SESSION_KEYS.githubState);
  const redirectTo = (session.get(SESSION_KEYS.githubRedirect) as string | undefined) ?? '/';

  session.unset(SESSION_KEYS.githubState);
  session.unset(SESSION_KEYS.githubRedirect);

  if (!code || !state || typeof storedState !== 'string' || storedState !== state) {
    const redirectUrl = new URL(redirectTo, url.origin);
    redirectUrl.searchParams.set('github_error', 'invalid_state');

    return redirect(redirectUrl.toString(), {
      headers: {
        'Set-Cookie': await sessionStorage.commitSession(session),
      },
    });
  }

  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const redirectUri = env.GITHUB_REDIRECT_URI ?? `${url.origin}/auth/github/callback`;

  if (!clientId || !clientSecret) {
    throw new Response('GitHub OAuth is not configured', { status: 503 });
  }

  try {
    const token = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
    const user = await fetchGitHubUser(token);

    session.set(SESSION_KEYS.githubToken, token);
    session.set(SESSION_KEYS.githubUser, user);
  } catch (error) {
    const redirectUrl = new URL(redirectTo, url.origin);
    redirectUrl.searchParams.set('github_error', error instanceof Error ? error.message : 'oauth_failed');

    return redirect(redirectUrl.toString(), {
      headers: {
        'Set-Cookie': await sessionStorage.commitSession(session),
      },
    });
  }

  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session),
    },
  });
}
