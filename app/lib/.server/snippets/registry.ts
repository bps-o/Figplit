import { landingSnippetLibrary } from '~/lib/snippets/landing-snippets';

export interface SnippetMetadata {
  id: string;
  title: string;
  description?: string;
  path: string;
  filename: string;
  bestFor?: string[];
  prompt?: string;
  docblock: string[];
}

export interface SnippetRecord extends SnippetMetadata {
  code: string;
}

interface Registry {
  entries: SnippetRecord[];
  byPath: Map<string, SnippetRecord>;
  byId: Map<string, SnippetRecord>;
}

const SNIPPET_SOURCES = import.meta.glob('../../../../snippets/**/*.{ts,tsx}', {
  as: 'raw',
  eager: true,
});

const SNIPPET_LIBRARY_BY_PATH = new Map(
  landingSnippetLibrary
    .map((snippet) => {
      const normalized = normalizeSnippetPath(snippet.file);

      if (!normalized) {
        return null;
      }

      return [normalized.toLowerCase(), snippet] as const;
    })
    .filter((entry): entry is readonly [string, (typeof landingSnippetLibrary)[number]] => entry !== null),
);

const SNIPPET_REGISTRY: Registry = buildRegistry();

const SNIPPET_MENTION_PATTERN = /(?:\/)?snippets\/[A-Za-z0-9/_-]+\.(?:t|j)sx?/gi;

function buildRegistry(): Registry {
  const entries: SnippetRecord[] = [];
  const byPath = new Map<string, SnippetRecord>();
  const byId = new Map<string, SnippetRecord>();

  for (const [modulePath, code] of Object.entries(SNIPPET_SOURCES)) {
    const relativeMatch = modulePath.match(/\/snippets\/(.+)$/);

    if (!relativeMatch) {
      continue;
    }

    const filename = relativeMatch[1];
    const normalizedPath = `/snippets/${filename}`;
    const id = filename.replace(/\.(?:t|j)sx?$/i, '');
    const docblock = extractDocblockLines(code);

    const libraryMeta = SNIPPET_LIBRARY_BY_PATH.get(normalizedPath.toLowerCase());

    const record: SnippetRecord = {
      id,
      filename,
      path: normalizedPath,
      title: libraryMeta?.title ?? toTitleCase(id),
      description: libraryMeta?.description ?? docblock[0],
      bestFor: libraryMeta?.bestFor,
      prompt: libraryMeta?.prompt,
      docblock,
      code,
    };

    entries.push(record);
    byPath.set(normalizedPath.toLowerCase(), record);
    byId.set(id.toLowerCase(), record);
  }

  entries.sort((a, b) => a.title.localeCompare(b.title));

  return {
    entries,
    byPath,
    byId,
  };
}

function extractDocblockLines(source: string): string[] {
  const match = source.match(/\/\*\*([\s\S]*?)\*\//);

  if (!match) {
    return [];
  }

  return match[1]
    .split('\n')
    .map((line) => line.trim().replace(/^\*\s?/, '').trim())
    .filter((line) => line.length > 0);
}

function toTitleCase(slug: string): string {
  return slug
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeSnippetPath(rawPath: string): string | null {
  let candidate = rawPath.trim();

  candidate = candidate.replace(/^[`'"({\[]+/, '');
  candidate = candidate.replace(/[`'"})\].,:;!?]+$/, '');
  candidate = candidate.replace(/\\/g, '/');

  if (candidate.startsWith('snippets/')) {
    candidate = `/${candidate}`;
  }

  if (!candidate.toLowerCase().startsWith('/snippets/')) {
    return null;
  }

  return candidate;
}

export function getSnippets(): SnippetRecord[] {
  return SNIPPET_REGISTRY.entries.slice();
}

export function getSnippetByPath(path: string): SnippetRecord | undefined {
  const normalized = normalizeSnippetPath(path);

  if (!normalized) {
    return undefined;
  }

  return SNIPPET_REGISTRY.byPath.get(normalized.toLowerCase());
}

export function getSnippetById(id: string): SnippetRecord | undefined {
  return SNIPPET_REGISTRY.byId.get(id.trim().toLowerCase());
}

export function findSnippetsInText(text: string): SnippetRecord[] {
  const matches = text.matchAll(SNIPPET_MENTION_PATTERN);
  const results: SnippetRecord[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const normalized = normalizeSnippetPath(match[0]);

    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    const record = SNIPPET_REGISTRY.byPath.get(key);

    if (record) {
      seen.add(key);
      results.push(record);
    }
  }

  return results;
}

export function findSnippetsInMessages(messages: Array<{ content: string }>): SnippetRecord[] {
  const seen = new Set<string>();
  const results: SnippetRecord[] = [];

  for (const message of messages) {
    const snippets = findSnippetsInText(message.content);

    for (const snippet of snippets) {
      const key = snippet.path.toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      results.push(snippet);
    }
  }

  return results;
}
