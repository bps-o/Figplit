import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import type { GitHubUser } from '~/utils/github.server';
import { SESSION_KEYS, getSessionStorage } from '~/utils/session.server';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env;
  const sessionStorage = getSessionStorage(env);
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const token = session.get(SESSION_KEYS.githubToken);
  const user = session.get(SESSION_KEYS.githubUser) as GitHubUser | undefined;

  if (!token || typeof token !== 'string') {
    return json({ authenticated: false });
  }

  return json({ authenticated: true, user });
}
