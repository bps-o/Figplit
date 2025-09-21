import type { Message } from 'ai';

const AVG_CHARS_PER_TOKEN = 4;
const MESSAGE_OVERHEAD = 6;

function toContentString(content: Message['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join(' ');
  }

  if (content && typeof content === 'object' && 'text' in content && typeof content.text === 'string') {
    return content.text;
  }

  return '';
}

export function estimateMessageTokens(messages: Message[]): number {
  return messages.reduce((total, message) => {
    const content = toContentString(message.content);
    const contentTokens = Math.ceil(content.length / AVG_CHARS_PER_TOKEN);
    return total + contentTokens + MESSAGE_OVERHEAD;
  }, 0);
}
