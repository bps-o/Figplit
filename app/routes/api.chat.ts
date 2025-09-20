import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { type CompletionTokenUsage } from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import { findSnippetsInMessages, type SnippetRecord } from '~/lib/.server/snippets/registry';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

const SNIPPET_CONTEXT_HEADING = 'Relevant snippet context:';

type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

interface SerializableSnippet {
  id: string;
  title: string;
  description: string | null;
  path: string;
  filename: string;
  bestFor: string[] | null;
  prompt: string | null;
  docblock: string[];
  code: string;
}

function toSerializableSnippet(snippet: SnippetRecord): SerializableSnippet {
  return {
    id: snippet.id,
    title: snippet.title,
    description: snippet.description ?? null,
    path: snippet.path,
    filename: snippet.filename,
    bestFor: snippet.bestFor ?? null,
    prompt: snippet.prompt ?? null,
    docblock: snippet.docblock,
    code: snippet.code,
  };
}

export async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages: incomingMessages } = await request.json<{ messages: Messages }>();

  const messages: Messages = incomingMessages.map((message) => ({ ...message }));

  const snippets = findSnippetsInMessages(messages);
  const snippetContext = formatSnippetContext(snippets);

  if (snippetContext) {
    const lastUserIndex = findLastUserMessageIndex(messages);

    if (lastUserIndex >= 0) {
      messages[lastUserIndex] = {
        ...messages[lastUserIndex],
        content: `${messages[lastUserIndex].content}\n\n${snippetContext}`,
      };
    } else {
      messages.push({ role: 'user', content: snippetContext });
    }
  }

  const stream = new SwitchableStream();
  const seenSnippets = new Map<string, SnippetRecord>();
  const baseOptions: StreamingOptions = {
    toolChoice: 'none',
  };
  let totalUsage: CompletionTokenUsage | null = null;

  try {
    const runStream = async () => {
      const result = await streamText(messages, context.cloudflare.env, {
        ...baseOptions,
        onFinish: async ({ text: content, finishReason, usage }) => {
          const aggregatedUsage = accumulateUsage(totalUsage, usage);
          totalUsage = aggregatedUsage;

          usage.promptTokens = aggregatedUsage.promptTokens;
          usage.completionTokens = aggregatedUsage.completionTokens;
          usage.totalTokens = aggregatedUsage.totalTokens;

          const withAssistant = [...messages, { role: 'assistant', content }];
          const matchedSnippets = findSnippetsInMessages(withAssistant);
          const newSnippets = matchedSnippets.filter((snippet) => {
            if (seenSnippets.has(snippet.id)) {
              return false;
            }

            seenSnippets.set(snippet.id, snippet);

            return true;
          });

          try {
            if (newSnippets.length > 0) {
              const suggestionPayload = {
                type: 'snippet-suggestions',
                snippets: newSnippets.map(toSerializableSnippet),
                segment: stream.switches,
              };

              result.streamData.append(suggestionPayload as unknown as JsonValue);
            }

            result.streamData.append({
              type: 'token-usage',
              usage: aggregatedUsage,
              limit: MAX_TOKENS,
              segment: stream.switches,
            });
          } finally {
            await result.streamData.close();
          }

          if (finishReason !== 'length') {
            stream.close();
            return;
          }

          if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
            throw Error('Cannot continue message: Maximum segments reached');
          }

          const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

          console.log(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

          messages.push({ role: 'assistant', content });
          messages.push({ role: 'user', content: CONTINUE_PROMPT });

          await runStream();
        },
      });

      const response = result.toDataStreamResponse({ data: result.streamData });
      const body = response.body;

      if (!body) {
        throw new Error('Failed to create AI stream body');
      }

      stream.switchSource(body);
    };

    await runStream();

    return new Response(stream.readable, {
      status: 200,
      headers: {
        contentType: 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.log(error);

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}

function formatSnippetContext(snippets: SnippetRecord[]): string | null {
  if (snippets.length === 0) {
    return null;
  }

  const sections = snippets.map((snippet) => {
    const lines: string[] = [`Snippet: ${snippet.title} (${snippet.path})`];

    if (snippet.description) {
      lines.push(`Summary: ${snippet.description}`);
    } else if (snippet.docblock.length > 0) {
      lines.push(`Summary: ${snippet.docblock[0]}`);
    }

    if (snippet.bestFor?.length) {
      lines.push(`Best for: ${snippet.bestFor.join(', ')}`);
    }

    lines.push('```tsx');
    lines.push(snippet.code.trim());
    lines.push('```');

    return lines.join('\n');
  });

  return `${SNIPPET_CONTEXT_HEADING}\n${sections.join('\n\n')}`;
}

function findLastUserMessageIndex(messages: Messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return index;
    }
  }

  return -1;
}

function accumulateUsage(previous: CompletionTokenUsage | null, usage: CompletionTokenUsage): CompletionTokenUsage {
  if (!previous) {
    return { ...usage };
  }

  return {
    promptTokens: previous.promptTokens + usage.promptTokens,
    completionTokens: previous.completionTokens + usage.completionTokens,
    totalTokens: previous.totalTokens + usage.totalTokens,
  };
}
