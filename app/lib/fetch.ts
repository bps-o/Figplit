import type { RequestInit as NodeFetchRequestInit } from 'node-fetch';

type CommonRequest = Omit<RequestInit, 'body'> & { body?: BodyInit | null };

export async function request(url: string, init?: CommonRequest): Promise<Response> {
  if (import.meta.env.DEV) {
    const nodeFetch = await import('node-fetch');
    const https = await import('node:https');

    const agent = url.startsWith('https') ? new https.Agent({ rejectUnauthorized: false }) : undefined;
    const requestInit: NodeFetchRequestInit = {
      ...(init ? (init as NodeFetchRequestInit) : {}),
      agent,
    };

    return nodeFetch.default(url, requestInit) as unknown as Response;
  }

  return fetch(url, init);
}
