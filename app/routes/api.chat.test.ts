import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { chatAction } from '~/routes/api.chat';

const streamTextMock = vi.hoisted(() => vi.fn());

vi.mock('~/lib/.server/llm/stream-text', () => ({
  streamText: streamTextMock,
}));

beforeEach(() => {
  streamTextMock.mockReset();
  streamTextMock.mockResolvedValue({
    streamData: {
      append: vi.fn(),

      close: vi.fn().mockResolvedValue(undefined),
    },
    toDataStreamResponse: () =>

      new Response(
        new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      ),
  });
});

describe('chatAction', () => {
  it('augments the final user message with snippet context when mentions are present', async () => {
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'assistant', content: 'Hello! How can I help today?' },
          {
            role: 'user',
            content: 'Remix the hero using /snippets/glass-hero-orbits.tsx and refine animations.',
          },
        ],
      }),
    });

    const context = { cloudflare: { env: {} } };

    const response = await chatAction({
      context,
      request,
      params: {},
    } as unknown as ActionFunctionArgs);

    expect(response).toBeInstanceOf(Response);
    expect(streamTextMock).toHaveBeenCalledTimes(1);

    const [messages] = streamTextMock.mock.calls[0];
    const lastMessage = messages[messages.length - 1];

    expect(lastMessage.content).toContain('Remix the hero using /snippets/glass-hero-orbits.tsx');
    expect(lastMessage.content).toContain('Relevant snippet context:');
    expect(lastMessage.content).toContain('export function GlassHeroOrbits');
  });
});
