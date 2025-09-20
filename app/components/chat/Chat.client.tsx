import { useStore } from '@nanostores/react';
import type { CompletionTokenUsage, Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { MAX_TOKENS } from '~/lib/llm/constants';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import { createOnFinishHandler } from './chat-usage';
import { buildForkSummary, evaluateContextLimit, type ContextLimitDetails } from './context-limit';
import { formatTokens } from './token-usage';
import { chatId, db, description, getNextId, setMessages } from '~/lib/persistence';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory } = useChatHistory();

  return (
    <>
      {ready && <ChatImpl initialMessages={initialMessages} storeMessageHistory={storeMessageHistory} />}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          /**
           * @todo Handle more types if we need them. This may require extra color palettes.
           */
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
    </>
  );
}

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
}

export const ChatImpl = memo(({ initialMessages, storeMessageHistory }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);

  const { showChat, aborted } = useStore(chatStore);

  const [animationScope, animate] = useAnimate();

  const [tokenUsage, setTokenUsage] = useState<CompletionTokenUsage | null>(null);
  const [contextLimit, setContextLimit] = useState<ContextLimitDetails | null>(null);
  const [forkingContext, setForkingContext] = useState(false);
  const warningToastShown = useRef(false);
  const blockedToastShown = useRef(false);

  const { messages, isLoading, input, handleInputChange, setInput, stop, append } = useChat({
    api: '/api/chat',
    onError: (error) => {
      logger.error('Request failed\n\n', error);
      toast.error('There was an error processing your request');
    },
    onFinish: createOnFinishHandler(setTokenUsage),
    initialMessages,
  });

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  useEffect(() => {
    chatStore.setKey('started', initialMessages.length > 0);
  }, []);

  useEffect(() => {
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  }, [messages, isLoading, parseMessages, initialMessages.length, storeMessageHistory]);

  useEffect(() => {
    if (!tokenUsage) {
      return;
    }

    const evaluation = evaluateContextLimit(tokenUsage, MAX_TOKENS);

    if (!evaluation) {
      setContextLimit(null);
      warningToastShown.current = false;
      blockedToastShown.current = false;

      return;
    }

    setContextLimit(evaluation);

    if (evaluation.state === 'warn' && !warningToastShown.current) {
      toast.warn(
        `You're approaching Figplit's context window (${formatTokens(evaluation.promptTokens)} of ${formatTokens(evaluation.limit)} prompt tokens). Consider forking soon to keep replies grounded.`,
      );

      warningToastShown.current = true;
    }

    if (evaluation.state === 'blocked' && !blockedToastShown.current) {
      toast.error(
        `This thread reached the context window (${formatTokens(evaluation.promptTokens)} of ${formatTokens(evaluation.limit)} prompt tokens). Fork the chat to continue working with full context.`,
      );

      blockedToastShown.current = true;
    }
  }, [tokenUsage]);

  const scrollTextArea = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  const abort = () => {
    stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();
  };

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;

      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  }, [input, textareaRef]);

  const runAnimation = async () => {
    if (chatStarted) {
      return;
    }

    await Promise.all([
      animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);

    chatStore.setKey('started', true);

    setChatStarted(true);
  };

  const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
    const _input = messageInput || input;

    if (_input.length === 0 || isLoading) {
      return;
    }

    if (contextLimit?.state === 'blocked') {
      toast.error(
        'This thread cannot accept new prompts. Fork the conversation to continue working with full context.',
      );
      return;
    }

    setTokenUsage(null);

    await workbenchStore.saveAllFiles();

    const fileModifications = workbenchStore.getFileModifcations();

    chatStore.setKey('aborted', false);

    runAnimation();

    if (fileModifications !== undefined) {
      const diff = fileModificationsToHTML(fileModifications);

      append({ role: 'user', content: `${diff}\n\n${_input}` });

      workbenchStore.resetAllFileModifications();
    } else {
      append({ role: 'user', content: _input });
    }

    setInput('');

    resetEnhancer();

    textareaRef.current?.blur();
  };

  const [messageRef, scrollRef] = useSnapScroll();
  const displayMessages = useMemo(() => {
    return messages.map((message, index) => {
      if (message.role === 'user') {
        return message;
      }

      return {
        ...message,
        content: parsedMessages[index] || '',
      };
    });
  }, [messages, parsedMessages]);

  const handleForkThread = useCallback(async () => {
    if (contextLimit?.state !== 'blocked') {
      return;
    }

    if (!db) {
      toast.error('Chat persistence is unavailable. Refresh to start a new thread.');
      return;
    }

    setForkingContext(true);

    try {
      const previousChatId = chatId.get();
      const artifactsStore = workbenchStore.artifacts.get();
      const artifactSummaries = workbenchStore.artifactIdList
        .map((messageId) => artifactsStore[messageId])
        .filter((artifact): artifact is NonNullable<typeof artifact> => Boolean(artifact))
        .map((artifact) => ({ id: artifact.id, title: artifact.title }));

      const summary = buildForkSummary({
        previousChatId,
        limit: contextLimit.limit,
        usage: tokenUsage,
        artifacts: artifactSummaries,
        messages: displayMessages,
      });

      const newChatId = await getNextId(db);
      const summaryDescription = artifactSummaries.at(-1)?.title || `Fork of chat ${previousChatId ?? newChatId}`;
      const summaryMessage: Message = {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `fork-${Date.now()}`,
        role: 'assistant',
        content: summary,
      };

      await setMessages(db, newChatId, [summaryMessage], newChatId, summaryDescription);

      chatId.set(newChatId);
      description.set(summaryDescription);

      window.location.href = `/chat/${newChatId}`;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fork the chat thread');
    } finally {
      setForkingContext(false);
    }
  }, [contextLimit, displayMessages, tokenUsage]);

  return (
    <BaseChat
      ref={animationScope}
      textareaRef={textareaRef}
      input={input}
      showChat={showChat}
      chatStarted={chatStarted}
      aborted={aborted}
      isStreaming={isLoading}
      enhancingPrompt={enhancingPrompt}
      promptEnhanced={promptEnhanced}
      sendMessage={sendMessage}
      messageRef={messageRef}
      scrollRef={scrollRef}
      handleInputChange={handleInputChange}
      handleStop={abort}
      messages={displayMessages}
      tokenUsage={tokenUsage}
      tokenLimit={MAX_TOKENS}
      contextLimit={contextLimit}
      onForkThread={handleForkThread}
      forkingContext={forkingContext}
      enhancePrompt={() => {
        enhancePrompt(input, (input) => {
          setInput(input);
          scrollTextArea();
        });
      }}
    />
  );
});
