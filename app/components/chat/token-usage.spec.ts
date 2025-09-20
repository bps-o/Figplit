import { describe, expect, it } from 'vitest';
import { buildTokenUsageDisplay, formatTokens } from './token-usage';

describe('buildTokenUsageDisplay', () => {
  it('returns formatted parts when usage is provided', () => {
    const usage = { promptTokens: 120, completionTokens: 80, totalTokens: 200 };
    const result = buildTokenUsageDisplay(usage, 8192);

    expect(result).toEqual({
      total: formatTokens(usage.totalTokens),
      limit: formatTokens(8192),
      prompt: formatTokens(usage.promptTokens),
      completion: formatTokens(usage.completionTokens),
    });
  });

  it('returns null when usage is missing', () => {
    expect(buildTokenUsageDisplay(null, 8192)).toBeNull();
  });
});
