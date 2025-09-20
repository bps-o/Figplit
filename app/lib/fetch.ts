type CommonRequest = Omit<RequestInit, 'body'> & { body?: BodyInit | null };
type NodeFetchRequestInit = import('node-fetch').RequestInit;

export async function request(url: string, init?: CommonRequest) {
  if (import.meta.env.DEV) {
    const nodeFetch = await import('node-fetch');
    const https = await import('node:https');

    const agent = url.startsWith('https') ? new https.Agent({ rejectUnauthorized: false }) : undefined;

    const nodeInit: NodeFetchRequestInit = { ...(init as NodeFetchRequestInit), agent };

    return nodeFetch.default(url, nodeInit);
  }

  return fetch(url, init);
}
