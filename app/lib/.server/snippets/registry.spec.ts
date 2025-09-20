import { describe, expect, it } from 'vitest';
import type { Messages } from '~/lib/.server/llm/stream-text';
import { landingSnippetLibrary } from '~/lib/snippets/landing-snippets';
import { findSnippetsInMessages } from './registry';

const glassSnippet = landingSnippetLibrary.find((snippet) => snippet.id === 'glass-hero-orbits');

describe('findSnippetsInMessages', () => {
  it('detects snippets referenced by file path', () => {
    const messages: Messages = [
      { role: 'user', content: "Let's reuse /snippets/glass-hero-orbits.tsx and modernize the copy." },
    ];

    const snippets = findSnippetsInMessages(messages);

    expect(snippets.some((snippet) => snippet.id === 'glass-hero-orbits')).toBe(true);
  });

  it('deduplicates snippets mentioned multiple times', () => {
    if (!glassSnippet) {
      throw new Error('Expected glass-hero-orbits snippet to exist');
    }

    const messages: Messages = [
      { role: 'user', content: `Start from ${glassSnippet.file}` },
      { role: 'assistant', content: `We will remix the ${glassSnippet.id} snippet with new colors.` },
    ];

    const snippets = findSnippetsInMessages(messages);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toMatchObject({ id: glassSnippet.id });
  });
});
