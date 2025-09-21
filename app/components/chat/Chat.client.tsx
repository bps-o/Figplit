import { useStore } from '@nanostores/react';
import type { CompletionTokenUsage, Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore, type ArtifactState } from '~/lib/stores/workbench';
import { MAX_TOKENS } from '~/lib/llm/constants';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { estimateMessageTokens } from '~/utils/context-limit';
import { createForkSummary, type ForkSummaryResult } from '~/utils/fork-summary';
import { description as chatDescription } from '~/lib/persistence';
import { BaseChat } from './BaseChat';
import type { SnippetSuggestion, SnippetSuggestionStreamEvent } from './types';
import { createOnFinishHandler } from './chat-usage';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

const CONTEXT_WARNING_THRESHOLD = 0.75;
const CONTEXT_BLOCK_THRESHOLD = 0.95;

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory, forkChat, currentUrlId } = useChatHistory();

  return (
    <>
      {ready && (
        <ChatImpl
          initialMessages={initialMessages}
          storeMessageHistory={storeMessageHistory}
          forkChat={forkChat}
          currentUrlId={currentUrlId}
        />
      )}
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
  forkChat: (args: { messages: Message[]; description: string }) => Promise<{ id: string; urlId: string }>;
  currentUrlId?: string;
}

export const ChatImpl = memo(({ initialMessages, storeMessageHistory, forkChat, currentUrlId }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);

  const { showChat, aborted } = useStore(chatStore);

  const [animationScope, animate] = useAnimate();

  const [tokenUsage, setTokenUsage] = useState<CompletionTokenUsage | null>(null);
  const [snippetSuggestions, setSnippetSuggestions] = useState<SnippetSuggestion[]>([]);
  const streamDataLengthRef = useRef(0);
  const wasLoadingRef = useRef(false);
  const warningShownRef = useRef(false);
  const [contextBlocked, setContextBlocked] = useState(false);
  const [forkSummaryResult, setForkSummaryResult] = useState<ForkSummaryResult | null>(null);
  const [isForking, setIsForking] = useState(false);

  const {
    messages,
    isLoading,
    input,
    handleInputChange,
    setInput,
    stop,
    append,
    data: streamData,
  } = useChat({
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

  const computeForkSummary = useCallback((): ForkSummaryResult => {
    const artifactMap = workbenchStore.artifacts.get();
    const artifacts = workbenchStore.artifactIdList
      .map((id) => artifactMap[id])
      .filter((artifact): artifact is ArtifactState => Boolean(artifact));

    const changedFiles = workbenchStore
      .getChangedFiles()
      .map(({ path, isBinary }) => ({ path, isBinary }));

    return createForkSummary({ artifacts, changedFiles, originalUrlId: currentUrlId });
  }, [currentUrlId]);

  const estimatedTokens = useMemo(() => estimateMessageTokens(messages), [messages]);
  const usageRatio = MAX_TOKENS > 0 ? estimatedTokens / MAX_TOKENS : 0;
  const approachingContextLimit = usageRatio >= CONTEXT_WARNING_THRESHOLD;
  const exceededContextLimit = usageRatio >= CONTEXT_BLOCK_THRESHOLD;

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
    if (approachingContextLimit && !exceededContextLimit && !warningShownRef.current) {
      toast.warn('This chat is nearing the context window limit. Fork soon to preserve full history.');
      warningShownRef.current = true;
    }
  }, [approachingContextLimit, exceededContextLimit]);

  useEffect(() => {
    if (exceededContextLimit) {
      setContextBlocked(true);
      setForkSummaryResult(computeForkSummary());
    } else {
      setContextBlocked(false);
      setForkSummaryResult(null);
    }
  }, [exceededContextLimit, computeForkSummary]);

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

  const isSnippetSuggestionEvent = (value: unknown): value is SnippetSuggestionStreamEvent => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    if (!('type' in value) || (value as { type?: unknown }).type !== 'snippet-suggestions') {
      return false;
    }

    return Array.isArray((value as { snippets?: unknown }).snippets);
  };

  useEffect(() => {
    if (!Array.isArray(streamData)) {
      if (streamData == null) {
        streamDataLengthRef.current = 0;
      }

      return;
    }

    if (streamData.length < streamDataLengthRef.current) {
      streamDataLengthRef.current = 0;
    }

    if (streamData.length === streamDataLengthRef.current) {
      return;
    }

    const newEvents = streamData.slice(streamDataLengthRef.current);

    streamDataLengthRef.current = streamData.length;

    const newSuggestions: SnippetSuggestion[] = [];

    for (const event of newEvents) {
      if (isSnippetSuggestionEvent(event)) {
        newSuggestions.push(...event.snippets);
      }
    }

    if (newSuggestions.length === 0) {
      return;
    }

    setSnippetSuggestions((current) => {
      const next = new Map(current.map((suggestion) => [suggestion.id, suggestion]));

      for (const suggestion of newSuggestions) {
        next.set(suggestion.id, suggestion);
      }

      return Array.from(next.values());
    });
  }, [streamData]);

  useEffect(() => {
    if (isLoading && !wasLoadingRef.current) {
      setSnippetSuggestions([]);
      streamDataLengthRef.current = Array.isArray(streamData) ? streamData.length : 0;
    }

    wasLoadingRef.current = isLoading;
  }, [isLoading, streamData]);

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

    if (contextBlocked) {
      toast.info('Start a new thread to keep working with full context.');
      return;
    }

    if (_input.length === 0 || isLoading) {
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

  const handleForkThread = useCallback(async () => {
    if (!forkSummaryResult) {
      toast.error('Unable to capture a summary for the new thread.');
      return;
    }

    try {
      setIsForking(true);
      await workbenchStore.saveAllFiles();

      const refreshedSummary = computeForkSummary();
      const baseDescription = chatDescription.get();
      const nextDescription = baseDescription
        ? `${baseDescription}${baseDescription.toLowerCase().includes('fork') ? '' : ' (fork)'}`
        : refreshedSummary.description;

      const origin = window.location.origin;
      const previousUrl = currentUrlId ? `${origin}/chat/${currentUrlId}` : window.location.href;
      const messageContent = `${refreshedSummary.message}\n\nPrevious thread: ${previousUrl}`;

      const { urlId: forkUrlId } = await forkChat({
        description: nextDescription,
        messages: [{ role: 'user', content: messageContent }],
      });

      toast.success('Forked the conversation into a fresh thread.');

      window.location.href = `/chat/${forkUrlId}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fork chat.';
      toast.error(message);
    } finally {
      setIsForking(false);
    }
  }, [forkSummaryResult, computeForkSummary, forkChat, currentUrlId]);

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
      snippetSuggestions={snippetSuggestions}
      messages={messages.map((message, i) => {
        if (message.role === 'user') {
          return message;
        }

        return {
          ...message,
          content: parsedMessages[i] || '',
        };
      })}
      tokenUsage={tokenUsage}
      tokenLimit={MAX_TOKENS}
      contextWarning={approachingContextLimit && !contextBlocked}
      contextBlocked={contextBlocked}
      contextSummary={forkSummaryResult?.displayText ?? null}
      onForkThread={handleForkThread}
      isForking={isForking}
      enhancePrompt={() => {
        enhancePrompt(input, (input) => {
          setInput(input);
          scrollTextArea();
        });
      }}
    />
  );
});
