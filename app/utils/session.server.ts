import { createCookieSessionStorage } from '@remix-run/cloudflare';

const SESSION_COOKIE_NAME = '__figplit_session';

export const SESSION_KEYS = {
  githubToken: 'github:token',
  githubUser: 'github:user',
  githubState: 'github:state',
  githubRedirect: 'github:redirect',
} as const;

type SessionKey = (typeof SESSION_KEYS)[keyof typeof SESSION_KEYS];

function createSessionStorage(env: Env) {
  const secret = env.SESSION_SECRET;

  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }

  return createCookieSessionStorage<Partial<Record<SessionKey, unknown>>>({
    cookie: {
      name: SESSION_COOKIE_NAME,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      secrets: [secret],
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  });
}

export function getSessionStorage(env: Env) {
  return createSessionStorage(env);
}
