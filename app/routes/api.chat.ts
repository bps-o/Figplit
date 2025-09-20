import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import { findSnippetsInMessages, type SnippetRecord } from '~/lib/.server/snippets/registry';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages } = await request.json<{ messages: Messages }>();

  const stream = new SwitchableStream();
  const seenSnippets = new Map<string, SnippetRecord>();
  const baseOptions: StreamingOptions = {
    toolChoice: 'none',
  };

  try {
    const runStream = async () => {
      const result = await streamText(messages, context.cloudflare.env, {
        ...baseOptions,
        onFinish: async ({ text: content, finishReason, usage }) => {
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
              result.streamData.append({
                type: 'snippet-suggestions',
                snippets: newSnippets,
                segment: stream.switches,
              });
            }

            result.streamData.append({
              type: 'token-usage',
              usage,
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

      const response = result.toAIStreamResponse({ data: result.streamData });
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
