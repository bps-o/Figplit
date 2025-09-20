import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages } = await request.json<{ messages: Messages }>();

  const stream = new SwitchableStream();

  try {
    const runStream = async () => {
      const result = await streamText(messages, context.cloudflare.env, {
        toolChoice: 'none',
        onFinish: async ({ text: content, finishReason, usage }) => {
          try {
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
