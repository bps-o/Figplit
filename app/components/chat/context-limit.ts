import type { CompletionTokenUsage, Message } from 'ai';
import { formatTokens } from './token-usage';

export const CONTEXT_WARNING_THRESHOLD = 0.8;
export const CONTEXT_BLOCK_THRESHOLD = 0.95;

export type ContextLimitState = 'warn' | 'blocked';

export interface ContextLimitDetails {
  state: ContextLimitState;
  promptTokens: number;
  totalTokens: number;
  limit: number;
  ratio: number;
}

export interface ArtifactSummary {
  id: string;
  title: string;
}

interface BuildForkSummaryOptions {
  previousChatId?: string;
  limit: number;
  usage: CompletionTokenUsage | null;
  artifacts: ArtifactSummary[];
  messages: Message[];
  maxPrompts?: number;
  excerptLength?: number;
}

const DEFAULT_PROMPT_COUNT = 3;
const DEFAULT_PROMPT_LENGTH = 140;

export function evaluateContextLimit(usage: CompletionTokenUsage, limit: number): ContextLimitDetails | null {
  if (!limit || limit <= 0) {
    return null;
  }

  const promptTokens = usage.promptTokens ?? usage.totalTokens ?? 0;
  const ratio = promptTokens / limit;

  if (ratio >= CONTEXT_BLOCK_THRESHOLD) {
    return {
      state: 'blocked',
      promptTokens,
      totalTokens: usage.totalTokens ?? 0,
      limit,
      ratio,
    } satisfies ContextLimitDetails;
  }

  if (ratio >= CONTEXT_WARNING_THRESHOLD) {
    return {
      state: 'warn',
      promptTokens,
      totalTokens: usage.totalTokens ?? 0,
      limit,
      ratio,
    } satisfies ContextLimitDetails;
  }

  return null;
}

export function buildForkSummary({
  previousChatId,
  limit,
  usage,
  artifacts,
  messages,
  maxPrompts = DEFAULT_PROMPT_COUNT,
  excerptLength = DEFAULT_PROMPT_LENGTH,
}: BuildForkSummaryOptions): string {
  const lines: string[] = [];
  const chatLabel = previousChatId ? `chat ${previousChatId}` : 'the previous chat';

  lines.push(`Forked from ${chatLabel} to restore Figplit's context.`);

  if (usage) {
    const promptTokens = usage.promptTokens ?? usage.totalTokens ?? 0;

    lines.push(
      `Previous thread consumed approximately ${formatTokens(promptTokens)} of the ${formatTokens(limit)} available prompt tokens.`,
    );
  } else {
    lines.push('Previous thread was forked before Figplit exhausted the context window.');
  }

  if (artifacts.length > 0) {
    lines.push('', 'Figplit changes captured so far:');

    for (const artifact of artifacts) {
      const title = artifact.title.trim() || 'Untitled update';
      lines.push(`- ${title}`);
    }
  } else {
    lines.push('', 'No Figplit artifacts were recorded in the previous thread.');
  }

  const prompts = collectRecentPrompts(messages, maxPrompts, excerptLength);

  if (prompts.length > 0) {
    lines.push('', 'Recent prompts:');

    for (const prompt of prompts) {
      lines.push(`- ${prompt}`);
    }
  }

  lines.push('', 'Continue in this thread to keep your workspace and GitHub progress aligned.');

  return lines.join('\n');
}

function collectRecentPrompts(messages: Message[], maxPrompts: number, excerptLength: number) {
  const prompts = messages.filter((message) => message.role === 'user');

  return prompts
    .slice(Math.max(prompts.length - maxPrompts, 0))
    .map((message) => truncateWhitespace(message.content, excerptLength))
    .filter((content) => content.length > 0);
}

function truncateWhitespace(input: string, length: number) {
  const normalized = input.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '';
  }

  if (normalized.length <= length) {
    return normalized;
  }

  return `${normalized.slice(0, length - 1)}…`;
}
