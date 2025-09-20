import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/webcontainer', () => {
  const mockWebcontainer = {
    workdir: '/tmp/workdir',
    fs: { writeFile: vi.fn() },
    internal: { watchPaths: vi.fn() },
    on: vi.fn(),
  };

  return {
    webcontainer: Promise.resolve(mockWebcontainer),
    webcontainerContext: { loaded: true },
  };
});

import { WorkbenchStore } from '~/lib/stores/workbench';

describe('WorkbenchStore deployment flow', () => {
  let store: WorkbenchStore;

  beforeEach(() => {
    vi.unstubAllGlobals();
    store = new WorkbenchStore();
  });

  afterEach(() => {
    store.cancelDeploymentPolling();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('updates deployment state to success after requestDeployment', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: 'success', previewUrl: 'https://preview.example', deploymentId: 'abc123' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    vi.stubGlobal('fetch', fetchMock);

    store.setDeployDialogOpen(true);

    const state = await store.requestDeployment();

    expect(fetchMock).toHaveBeenCalledWith('/api/deploy', { method: 'POST' });
    expect(state.status).toBe('success');
    expect(state.previewUrl).toBe('https://preview.example');
    expect(store.deployDialogOpen.get()).toBe(false);
  });

  it('marks deployment as error when polling fails', async () => {
    store.deploymentState.set({ status: 'queued', deploymentId: 'abc123', updatedAt: Date.now() });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('failed', { status: 500 })));

    await store.pollDeploymentStatus();

    const state = store.deploymentState.get();
    expect(state.status).toBe('error');
    expect(state.error).toContain('failed');
  });

  it('polls until deployment succeeds when queued', async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deploymentId: 'abc123', status: 'queued' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'building' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'success', previewUrl: 'https://preview.example' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const initial = await store.requestDeployment();
    expect(initial.status).toBe('queued');

    await vi.advanceTimersByTimeAsync(5000);
    expect(store.deploymentState.get().status).toBe('building');

    await vi.advanceTimersByTimeAsync(5000);

    const finalState = store.deploymentState.get();

    expect(finalState.status).toBe('success');
    expect(finalState.previewUrl).toBe('https://preview.example');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
