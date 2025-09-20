import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { SESSION_KEYS, getSessionStorage } from '~/utils/session.server';

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const sessionStorage = getSessionStorage(env);
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));

  session.unset(SESSION_KEYS.githubToken);
  session.unset(SESSION_KEYS.githubUser);

  return json(
    { success: true },
    {
      headers: {
        'Set-Cookie': await sessionStorage.commitSession(session),
      },
    },
  );
}
