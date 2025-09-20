import { describe, expect, it, vi } from 'vitest';
import { ActionRunner } from './action-runner';
import type { ActionCallbackData } from './message-parser';

describe('ActionRunner', () => {
  const createShellAction = (actionId: string, content = 'echo "hello"'): ActionCallbackData => ({
    artifactId: 'artifact-1',
    messageId: 'message-1',
    actionId,
    action: {
      type: 'shell',
      content,
    },
  });

  it('abortAll aborts running and pending actions', async () => {
    let resolveExit!: (value: number) => void;
    const exitPromise = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });

    const kill = vi.fn();
    const pipeTo = vi.fn(() => Promise.resolve());

    const spawn = vi.fn(async () => ({
      kill,
      exit: exitPromise,
      output: { pipeTo },
    }));

    const runner = new ActionRunner(Promise.resolve({ spawn } as any));

    const runningAction = createShellAction('action-1');
    const pendingAction = createShellAction('action-2', 'echo "pending"');

    runner.addAction(runningAction);
    runner.runAction(runningAction);
    runner.addAction(pendingAction);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(runner.actions.get()[runningAction.actionId].status).toBe('running');
    expect(runner.actions.get()[pendingAction.actionId].status).toBe('pending');

    runner.abortAll();

    expect(kill).toHaveBeenCalledTimes(1);
    expect(runner.actions.get()[runningAction.actionId].status).toBe('aborted');
    expect(runner.actions.get()[pendingAction.actionId].status).toBe('aborted');

    resolveExit(0);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runner.actions.get()[runningAction.actionId].status).toBe('aborted');
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
