import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { action, loader } from '~/routes/api.deploy';

const baseContext = {
  cloudflare: {
    env: {
      DEPLOY_HOOK_URL: 'https://deploy.example/hook',
      DEPLOY_STATUS_URL: 'https://deploy.example/status',
      DEPLOY_STATUS_TOKEN: 'token-123',
    },
  },
};

describe('api.deploy route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('triggers the deploy hook and returns normalized data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'abc123', url: 'https://preview.example', status: 'success' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('http://localhost/api/deploy', { method: 'POST' });
    const response = await action({ request, context: baseContext as any, params: {} } as any);
    const body = await response.json();

    expect(fetchMock).toHaveBeenCalledWith('https://deploy.example/hook', { method: 'POST' });
    expect(body).toEqual({ deploymentId: 'abc123', previewUrl: 'https://preview.example', status: 'success' });
  });

  it('returns an error when the deploy hook fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('failed', {
          status: 500,
          headers: { 'content-type': 'text/plain' },
        }),
      ),
    );

    const request = new Request('http://localhost/api/deploy', { method: 'POST' });
    const response = await action({ request, context: baseContext as any, params: {} } as any);

    expect(response.status).toBe(502);

    const body = await response.json();
    expect(body.error).toContain('Failed to trigger deployment');
  });

  it('fetches deployment status with authorization', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ result: { id: 'abc123', status: 'success', preview_url: 'https://preview.example' } }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('http://localhost/api/deploy?deploymentId=abc123');
    const response = await loader({ request, context: baseContext as any, params: {} } as any);
    const body = await response.json();

    expect(fetchMock).toHaveBeenCalledWith('https://deploy.example/status/abc123', {
      headers: { Authorization: 'Bearer token-123' },
    });
    expect(body).toEqual({ deploymentId: 'abc123', previewUrl: 'https://preview.example', status: 'success' });
  });

  it('returns 400 when deploymentId is missing', async () => {
    const request = new Request('http://localhost/api/deploy');
    const response = await loader({ request, context: baseContext as any, params: {} } as any);
    expect(response.status).toBe(400);
  });
});
