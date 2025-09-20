import type { CompletionTokenUsage } from 'ai';

const numberFormatter = new Intl.NumberFormat('en-US');

export const formatTokens = (value: number) => {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return numberFormatter.format(value);
};

export function buildTokenUsageDisplay(usage: CompletionTokenUsage | null, limit?: number) {
  if (!usage) {
    return null;
  }

  return {
    total: formatTokens(usage.totalTokens),
    limit: limit ? formatTokens(limit) : '—',
    prompt: formatTokens(usage.promptTokens),
    completion: formatTokens(usage.completionTokens),
  };
}
