import type { CompletionTokenUsage, Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('Chat');

export const createOnFinishHandler = (setUsage: (usage: CompletionTokenUsage) => void) => {
  return (_message: Message, { usage }: { usage: CompletionTokenUsage }) => {
    logger.debug('Finished streaming');
    setUsage(usage);
  };
};
