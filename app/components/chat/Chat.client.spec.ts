import { describe, expect, it, vi } from 'vitest';
import { createOnFinishHandler } from './chat-usage';

describe('createOnFinishHandler', () => {
  it('captures usage from the finish event', () => {
    const setUsage = vi.fn();
    const handler = createOnFinishHandler(setUsage);
    const usage = { promptTokens: 120, completionTokens: 80, totalTokens: 200 };

    handler({ role: 'assistant', content: '' } as any, { usage });

    expect(setUsage).toHaveBeenCalledWith(usage);
  });
});
