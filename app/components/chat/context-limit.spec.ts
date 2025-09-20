import type { CompletionTokenUsage, Message } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  buildForkSummary,
  evaluateContextLimit,
  CONTEXT_BLOCK_THRESHOLD,
  CONTEXT_WARNING_THRESHOLD,
} from './context-limit';

const LIMIT = 8000;

const createUsage = (promptTokens: number): CompletionTokenUsage => ({
  promptTokens,
  completionTokens: 0,
  totalTokens: promptTokens,
});

describe('evaluateContextLimit', () => {
  it('returns null when usage is below the warning threshold', () => {
    const result = evaluateContextLimit(createUsage(Math.floor(LIMIT * (CONTEXT_WARNING_THRESHOLD - 0.1))), LIMIT);

    expect(result).toBeNull();
  });

  it('returns a warning when usage passes the warning threshold', () => {
    const promptTokens = Math.ceil(LIMIT * CONTEXT_WARNING_THRESHOLD);
    const result = evaluateContextLimit(createUsage(promptTokens), LIMIT);

    expect(result).not.toBeNull();
    expect(result?.state).toBe('warn');
    expect(result?.promptTokens).toBe(promptTokens);
  });

  it('returns blocked when usage passes the blocking threshold', () => {
    const promptTokens = Math.ceil(LIMIT * CONTEXT_BLOCK_THRESHOLD + 1);
    const result = evaluateContextLimit(createUsage(promptTokens), LIMIT);

    expect(result).not.toBeNull();
    expect(result?.state).toBe('blocked');
    expect(result?.promptTokens).toBe(promptTokens);
  });
});

describe('buildForkSummary', () => {
  const baseMessages: Message[] = [
    { role: 'user', content: 'Draft the hero section with gradient background.' },
    { role: 'assistant', content: 'Sure thing!' },
    { role: 'user', content: 'Follow up with pricing tiers.' },
  ];

  it('summarizes artifacts and recent prompts', () => {
    const summary = buildForkSummary({
      previousChatId: '7',
      limit: LIMIT,
      usage: createUsage(6000),
      artifacts: [
        { id: 'a', title: 'Hero layout pass' },
        { id: 'b', title: 'Pricing card styling' },
      ],
      messages: baseMessages,
    });

    expect(summary).toContain('chat 7');
    expect(summary).toContain('Hero layout pass');
    expect(summary).toContain('Pricing card styling');
    expect(summary).toContain('Draft the hero section');
    expect(summary).toContain('6,000');
    expect(summary).toContain('8,000');
  });

  it('handles missing artifacts gracefully', () => {
    const summary = buildForkSummary({
      limit: LIMIT,
      usage: null,
      artifacts: [],
      messages: baseMessages,
    });

    expect(summary).toContain('No Figplit artifacts were recorded');
  });
});
