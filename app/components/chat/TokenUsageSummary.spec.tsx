import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { TokenUsageSummary } from './TokenUsageSummary';

const mockUsage = {
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
};

describe('TokenUsageSummary', () => {
  it('renders nothing when usage is missing', () => {
    const output = renderToStaticMarkup(<TokenUsageSummary usage={null} limit={1000} />);

    expect(output).toBe('');
  });

  it('renders formatted usage details', () => {
    const output = renderToStaticMarkup(<TokenUsageSummary usage={mockUsage} limit={1000} />);

    expect(output).toContain('Tokens:');
    expect(output).toContain('150');
    expect(output).toContain('/ 1,000');
    expect(output).toContain('Prompt 100');
    expect(output).toContain('Completion 50');
  });

  it('updates when new usage is provided', () => {
    const first = renderToStaticMarkup(<TokenUsageSummary usage={mockUsage} limit={1000} />);
    const second = renderToStaticMarkup(
      <TokenUsageSummary usage={{ promptTokens: 200, completionTokens: 150, totalTokens: 350 }} limit={1000} />,
    );

    expect(first).not.toBe(second);
    expect(second).toContain('350');
    expect(second).toContain('Prompt 200');
    expect(second).toContain('Completion 150');
  });
});
