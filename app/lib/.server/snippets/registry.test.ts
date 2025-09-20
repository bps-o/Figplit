import { describe, expect, it } from 'vitest';
import { findSnippetsInText, getSnippetByPath, getSnippets } from '~/lib/.server/snippets/registry';

describe('snippet registry', () => {
  it('exposes snippet metadata and code from the snippets directory', () => {
    const allSnippets = getSnippets();
    const glassSnippet = getSnippetByPath('/snippets/glass-hero-orbits.tsx');

    expect(allSnippets.length).toBeGreaterThan(0);
    expect(glassSnippet).toBeDefined();
    expect(glassSnippet?.title).toBe('Glassmorphism hero');
    expect(glassSnippet?.description).toContain('Frosted hero shell');
    expect(glassSnippet?.code).toContain('export function GlassHeroOrbits');
  });

  it('finds snippet mentions within arbitrary text', () => {
    const snippets = findSnippetsInText(
      'Blend snippets/glass-hero-orbits.tsx with /snippets/metrics-marquee.tsx and ignore repeats like /snippets/metrics-marquee.tsx.',
    );

    expect(snippets.map((snippet) => snippet.id)).toEqual(['glass-hero-orbits', 'metrics-marquee']);
  });
});
