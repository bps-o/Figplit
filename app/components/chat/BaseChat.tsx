import type { Message } from 'ai';
import React, { type RefCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { landingSnippetLibrary } from '~/lib/snippets/landing-snippets';
import { classNames } from '~/utils/classNames';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';

import styles from './BaseChat.module.scss';

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  aborted?: boolean;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
}

const EXAMPLE_PROMPTS = [
  { text: 'Design a hero for an AI analytics SaaS with glassmorphism and orbital animation.' },
  { text: 'Craft a pricing page for a devtools startup with yearly/monthly toggle and gradient highlights.' },
  { text: 'Prototype a fintech landing page hero featuring staggered card reveals and subtle parallax.' },
  { text: 'Refine a launch CTA section with gradient background, badges, and an animated arrow indicator.' },
  { text: 'Recreate the Intercom-style testimonial marquee with auto-scrolling logos and blur edges.' },
];

const FEATURE_CALLOUTS = [
  {
    icon: 'i-ph:play-circle-duotone',
    title: 'Motion-aware prompts',
    description: 'Explain the choreography and Figplit plans the easing, delay, and scroll triggers for you.',
  },
  {
    icon: 'i-ph:sparkle-duotone',
    title: 'Tasteful by default',
    description: 'Color palettes, typography, and spacing start refined so you can focus on story and brand.',
  },
  {
    icon: 'i-ph:stack-duotone',
    title: 'Snippet recall',
    description: 'Reuse cinematic hero, pricing, and marquee snippets from the built-in library with one click.',
  },
];

const FEATURED_SNIPPETS = landingSnippetLibrary.slice(0, 3);
const SNIPPET_RECOMMENDATIONS = landingSnippetLibrary;

const TEXTAREA_MIN_HEIGHT = 76;

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      aborted = false,
      enhancingPrompt = false,
      promptEnhanced = false,
      messages,
      input = '',
      sendMessage,
      handleInputChange,
      enhancePrompt,
      handleStop,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex h-full w-full overflow-hidden bg-bolt-elements-background-depth-1',
        )}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[18vh] max-w-[720px] mx-auto px-6">
                <h1 className="text-5xl text-center font-bold text-bolt-elements-textPrimary mb-3 leading-tight">
                  Launch cinematic landing pages in minutes
                </h1>
                <p className="mb-6 text-center text-bolt-elements-textSecondary text-lg">
                  Pair your vision with Figplit’s taste. Prompt bespoke hero layouts, scroll choreography, and polished
                  marketing flows without wrangling boilerplate.
                </p>
                <div className="mt-8 grid gap-3 text-left md:grid-cols-3">
                  {FEATURE_CALLOUTS.map((callout) => (
                    <div
                      key={callout.title}
                      className="rounded-2xl border border-bolt-elements-borderColor/60 bg-bolt-elements-background-depth-2/80 p-4 backdrop-blur supports-[backdrop-filter]:bg-bolt-elements-background-depth-2/40"
                    >
                      <div className="flex items-center gap-2 text-bolt-elements-item-contentAccent text-sm font-semibold">
                        <div className={`${callout.icon} text-lg`} />
                        {callout.title}
                      </div>
                      <p className="mt-2 text-sm text-bolt-elements-textSecondary leading-relaxed">
                        {callout.description}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-10 text-left">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-bolt-elements-textTertiary">
                    Featured snippet starters
                  </h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {FEATURED_SNIPPETS.map((snippet) => (
                      <button
                        key={snippet.id}
                        type="button"
                        onClick={(event) => {
                          sendMessage?.(event, snippet.prompt);
                        }}
                        className="group flex flex-col items-start gap-2 rounded-xl border border-bolt-elements-borderColor/60 bg-bolt-elements-background-depth-1/80 p-4 text-left transition-theme hover:border-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent/20"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-bolt-elements-textPrimary">
                          <div className="i-ph:shapes-duotone text-base text-bolt-elements-item-contentAccent group-hover:text-bolt-elements-item-contentAccent" />
                          {snippet.title}
                        </div>
                        <p className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                          {snippet.description}
                        </p>
                        <div className="text-xs uppercase tracking-[0.2em] text-bolt-elements-textTertiary">
                          {snippet.bestFor.join(' • ')}
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-bolt-elements-textTertiary">
                    These live under <code className="font-semibold">/snippets</code>. Ask Figplit to remix them or{' '}
                    click to seed a prompt with context.
                  </p>
                </div>
              </div>
            )}
            <div
              className={classNames('pt-6 px-6', {
                'h-full flex flex-col': chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat px-4 pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                      aborted={aborted}
                    />
                  ) : null;
                }}
              </ClientOnly>
              {chatStarted ? (
                <div className="mx-auto mt-4 w-full max-w-chat px-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-bolt-elements-textTertiary">
                    Snippet recommendations
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SNIPPET_RECOMMENDATIONS.map((snippet) => (
                      <button
                        key={`recommendation-${snippet.id}`}
                        type="button"
                        onClick={(event) => {
                          sendMessage?.(event, snippet.prompt);
                        }}
                        className="group flex min-w-[180px] flex-col items-start gap-1 rounded-lg border border-bolt-elements-borderColor/60 bg-bolt-elements-background-depth-1/60 px-3 py-2 text-left transition-theme hover:border-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent/10"
                      >
                        <span className="text-sm font-semibold text-bolt-elements-textPrimary group-hover:text-bolt-elements-item-contentAccent">
                          {snippet.title}
                        </span>
                        {snippet.bestFor?.length ? (
                          <span className="text-[11px] uppercase tracking-[0.2em] text-bolt-elements-textTertiary">
                            {snippet.bestFor.join(' • ')}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div
                className={classNames('relative w-full max-w-chat mx-auto z-prompt', {
                  'sticky bottom-0': chatStarted,
                })}
              >
                <div
                  className={classNames(
                    'shadow-sm border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] rounded-lg overflow-hidden',
                  )}
                >
                  <textarea
                    ref={textareaRef}
                    className={`w-full pl-4 pt-4 pr-16 focus:outline-none resize-none text-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        if (event.shiftKey) {
                          return;
                        }

                        event.preventDefault();

                        sendMessage?.(event);
                      }
                    }}
                    value={input}
                    onChange={(event) => {
                      handleInputChange?.(event);
                    }}
                    style={{
                      minHeight: TEXTAREA_MIN_HEIGHT,
                      maxHeight: TEXTAREA_MAX_HEIGHT,
                    }}
                    placeholder="What landing page magic should Figplit design next?"
                    translate="no"
                  />
                  <ClientOnly>
                    {() => (
                      <SendButton
                        show={input.length > 0 || isStreaming}
                        isStreaming={isStreaming}
                        onClick={(event) => {
                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          sendMessage?.(event);
                        }}
                      />
                    )}
                  </ClientOnly>
                  <div className="flex justify-between text-sm p-4 pt-2">
                    <div className="flex gap-1 items-center">
                      <IconButton
                        title="Enhance prompt"
                        disabled={input.length === 0 || enhancingPrompt}
                        className={classNames({
                          'opacity-100!': enhancingPrompt,
                          'text-bolt-elements-item-contentAccent! pr-1.5 enabled:hover:bg-bolt-elements-item-backgroundAccent!':
                            promptEnhanced,
                        })}
                        onClick={() => enhancePrompt?.()}
                      >
                        {enhancingPrompt ? (
                          <>
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl"></div>
                            <div className="ml-1.5">Enhancing prompt...</div>
                          </>
                        ) : (
                          <>
                            <div className="i-bolt:stars text-xl"></div>
                            {promptEnhanced && <div className="ml-1.5">Prompt enhanced</div>}
                          </>
                        )}
                      </IconButton>
                    </div>
                    {input.length > 3 ? (
                      <div className="text-xs text-bolt-elements-textTertiary">
                        Use <kbd className="kdb">Shift</kbd> + <kbd className="kdb">Return</kbd> for a new line
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="bg-bolt-elements-background-depth-1 pb-6">{/* Ghost Element */}</div>
              </div>
            </div>
            {!chatStarted && (
              <div id="examples" className="relative w-full max-w-xl mx-auto mt-8 flex justify-center">
                <div className="flex flex-col space-y-2 [mask-image:linear-gradient(to_bottom,black_0%,transparent_180%)] hover:[mask-image:none]">
                  {EXAMPLE_PROMPTS.map((examplePrompt, index) => {
                    return (
                      <button
                        key={index}
                        onClick={(event) => {
                          sendMessage?.(event, examplePrompt.text);
                        }}
                        className="group flex items-center w-full gap-2 justify-center bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-theme"
                      >
                        {examplePrompt.text}
                        <div className="i-ph:arrow-bend-down-left" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
        </div>
      </div>
    );
  },
);
