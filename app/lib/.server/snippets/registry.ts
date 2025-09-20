import type { Messages } from '~/lib/.server/llm/stream-text';
import type { LandingSnippet } from '~/lib/snippets/landing-snippets';
import { landingSnippetLibrary } from '~/lib/snippets/landing-snippets';

export type SnippetRecord = LandingSnippet;

const SNIPPET_PATH_PATTERN = /\/snippets\/([\w-]+)\.tsx/gi;

function getSnippetIndex() {
  const index = new Map<string, SnippetRecord>();

  for (const snippet of landingSnippetLibrary) {
    index.set(snippet.id.toLowerCase(), snippet);
    index.set(snippet.file.replace(/^snippets\//, '').replace(/\.tsx$/, '').toLowerCase(), snippet);
  }

  return index;
}

const snippetIndex = getSnippetIndex();

function lookupSnippet(identifier: string) {
  return snippetIndex.get(identifier.toLowerCase()) ?? null;
}

function collectSnippetsFromContent(content: string) {
  const matched = new Map<string, SnippetRecord>();

  for (const match of content.matchAll(SNIPPET_PATH_PATTERN)) {
    const [, slug] = match;

    const snippet = lookupSnippet(slug);

    if (snippet) {
      matched.set(snippet.id, snippet);
    }
  }

  for (const snippet of landingSnippetLibrary) {
    if (matched.has(snippet.id)) {
      continue;
    }

    if (content.toLowerCase().includes(snippet.id.toLowerCase())) {
      matched.set(snippet.id, snippet);
    }
  }

  return matched;
}

export function findSnippetsInMessages(messages: Messages): SnippetRecord[] {
  const results = new Map<string, SnippetRecord>();

  for (const message of messages) {
    const content = message.content;

    if (!content) {
      continue;
    }

    const matches = collectSnippetsFromContent(content);

    for (const [id, snippet] of matches) {
      results.set(id, snippet);
    }
  }

  return Array.from(results.values());
}
