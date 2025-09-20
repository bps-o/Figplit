import React, { useMemo, useState } from 'react';
import { landingSnippetLibrary } from '~/lib/snippets/landing-snippets';
import { classNames } from '~/utils/classNames';

interface CustomSnippetDialogProps {
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  isStreaming?: boolean;
}

const DEFAULT_INSTRUCTIONS = 'Describe the exact visuals, copy, and motion you want Figplit to build into the snippet.';

export function CustomSnippetDialog({ sendMessage, isStreaming }: CustomSnippetDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | undefined>(landingSnippetLibrary[0]?.id);
  const [instructions, setInstructions] = useState('');

  const selectedSnippet = useMemo(() => {
    if (!selectedSnippetId) {
      return undefined;
    }

    return landingSnippetLibrary.find((snippet) => snippet.id === selectedSnippetId);
  }, [selectedSnippetId]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedSnippet) {
      return;
    }

    const trimmedInstructions = instructions.trim();
    const promptParts = [selectedSnippet.prompt.trim()];

    if (trimmedInstructions.length > 0) {
      promptParts.push(trimmedInstructions);
    }

    const prompt = promptParts.join('\n\n');

    sendMessage?.({} as React.UIEvent, prompt);

    setIsOpen(false);
    setInstructions('');
  };

  return (
    <>
      <button
        type="button"
        className={classNames(
          'text-xs font-semibold uppercase tracking-[0.25em] text-bolt-elements-textTertiary transition-theme',
          'border border-bolt-elements-borderColor/70 rounded-full px-3 py-1 hover:border-bolt-elements-item-backgroundAccent',
          'hover:text-bolt-elements-textPrimary disabled:opacity-60 disabled:cursor-not-allowed',
        )}
        onClick={() => setIsOpen(true)}
        disabled={isStreaming}
      >
        Custom snippet
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 py-8"
          role="dialog"
          aria-modal
        >
          <div className="w-full max-w-lg rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Design a custom snippet brief</h2>
                <p className="mt-1 text-sm text-bolt-elements-textSecondary">
                  Choose a base snippet and describe how Figplit should remix it for your project.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="rounded-full border border-transparent p-1 text-bolt-elements-textTertiary transition-theme hover:border-bolt-elements-borderColor hover:text-bolt-elements-textPrimary"
                onClick={() => setIsOpen(false)}
              >
                <div className="i-ph:x text-lg" />
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-2 text-sm text-bolt-elements-textSecondary">
                Base snippet
                <select
                  className="w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary focus:outline-none focus:border-bolt-elements-item-backgroundAccent"
                  value={selectedSnippetId}
                  onChange={(event) => setSelectedSnippetId(event.target.value)}
                >
                  {landingSnippetLibrary.map((snippet) => (
                    <option key={snippet.id} value={snippet.id}>
                      {snippet.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-bolt-elements-textSecondary">
                Instructions
                <textarea
                  className="min-h-[120px] rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary focus:outline-none focus:border-bolt-elements-item-backgroundAccent"
                  value={instructions}
                  placeholder={DEFAULT_INSTRUCTIONS}
                  onChange={(event) => setInstructions(event.target.value)}
                />
              </label>

              {selectedSnippet ? (
                <div className="rounded-xl border border-dashed border-bolt-elements-borderColor/80 bg-bolt-elements-background-depth-2/60 p-3 text-xs text-bolt-elements-textTertiary">
                  <p className="font-semibold uppercase tracking-[0.2em] text-bolt-elements-textSecondary">Snippets path</p>
                  <p className="mt-1 font-mono text-[11px] text-bolt-elements-textPrimary">/{selectedSnippet.file}</p>
                  <p className="mt-2 text-bolt-elements-textSecondary">{selectedSnippet.description}</p>
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-transparent px-4 py-2 text-sm font-medium text-bolt-elements-textTertiary transition-theme hover:border-bolt-elements-borderColor hover:text-bolt-elements-textPrimary"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg border border-transparent bg-bolt-elements-item-backgroundAccent px-4 py-2 text-sm font-semibold text-bolt-elements-item-contentAccent transition-theme hover:brightness-110"
                  disabled={!selectedSnippet}
                >
                  Send brief to Figplit
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
