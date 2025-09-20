import type { CompletionTokenUsage } from 'ai';
import React from 'react';
import { buildTokenUsageDisplay } from './token-usage';

interface TokenUsageSummaryProps {
  usage: CompletionTokenUsage | null;
  limit?: number;
}

export function TokenUsageSummary({ usage, limit }: TokenUsageSummaryProps) {
  const details = buildTokenUsageDisplay(usage, limit);

  if (!details) {
    return null;
  }

  return (
    <div className="text-xs text-bolt-elements-textSecondary" data-testid="token-usage">
      <span className="font-semibold text-bolt-elements-textPrimary">Tokens:</span>{' '}
      <span className="font-medium text-bolt-elements-textPrimary">{details.total}</span>{' '}
      <span className="text-bolt-elements-textTertiary">/ {details.limit}</span>{' '}
      <span className="text-bolt-elements-textTertiary">
        (Prompt {details.prompt} • Completion {details.completion})
      </span>
    </div>
  );
}
