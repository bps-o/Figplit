
import React, { useEffect, useMemo, useState } from 'react';
import { landingSnippetLibrary } from '~/lib/snippets/landing-snippets';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';

interface CustomSnippetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
}

type SnippetOption =
  | (typeof landingSnippetLibrary)[number]
  | {
      id: 'custom';
      title: string;
      description: string;
      bestFor: string[];
      file: string;
      prompt?: string;
    };

const CUSTOM_SNIPPET_OPTION: SnippetOption = {
  id: 'custom',
  title: 'Start from scratch',
  description: 'Begin with a blank animation shell and let Figplit compose a bespoke snippet from the ground up.',
  bestFor: ['Motion lab', 'Explorations', 'Net new'],
  file: 'snippets/custom-animation.tsx',
};

export function CustomSnippetDialog({ open, onOpenChange, sendMessage }: CustomSnippetDialogProps) {
  const [selectedSnippetId, setSelectedSnippetId] = useState<SnippetOption['id']>('custom');
  const [creativeBrief, setCreativeBrief] = useState('');
  const [targetFile, setTargetFile] = useState('');
  const [targetArea, setTargetArea] = useState('');
  const [snippetNickname, setSnippetNickname] = useState('CinematicMotionBlock');

  const snippetOptions = useMemo<SnippetOption[]>(() => {
    return [CUSTOM_SNIPPET_OPTION, ...landingSnippetLibrary];
  }, []);

  const selectedSnippet = useMemo(() => {
    return snippetOptions.find((snippet) => snippet.id === selectedSnippetId) ?? CUSTOM_SNIPPET_OPTION;
  }, [selectedSnippetId, snippetOptions]);

  const canSubmit = creativeBrief.trim().length > 0 && (targetFile.trim().length > 0 || targetArea.trim().length > 0);

  useEffect(() => {
    if (!open) {
      setSelectedSnippetId('custom');
      setCreativeBrief('');
      setTargetFile('');
      setTargetArea('');
      setSnippetNickname('CinematicMotionBlock');
    }
  }, [open]);

  const submitPlan = (event: React.UIEvent) => {
    event.preventDefault();

    if (!sendMessage || !canSubmit) {
      return;
    }

    const lines: string[] = [];

    if (selectedSnippet.id === 'custom') {
      lines.push(
        `Let's design a brand-new animation snippet called "${snippetNickname}". Start from a clean slate and build the composition specifically for this project.`,
      );
    } else {
      lines.push(
        `Use the snippet at ${selectedSnippet.file} as the baseline and evolve it into a custom animation called "${snippetNickname}" tailored for this project.`,
      );

      if (selectedSnippet.description) {
        lines.push(`Reference notes: ${selectedSnippet.description}`);
      }
    }

    if (creativeBrief.trim().length > 0) {
      lines.push('Creative direction:');

      for (const bullet of creativeBrief
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean)) {
        lines.push(`- ${bullet}`);
      }
    }

    lines.push('Workflow:');
    lines.push('- Iterate with me on the snippet code first. Show the updated component before applying it.');
    lines.push('- Once the snippet looks right, integrate it without rewriting the entire landing page.');

    const targetLines: string[] = [];

    if (targetFile.trim().length > 0) {
      targetLines.push(`Limit code changes to ${targetFile.trim()}.`);
    }

    if (targetArea.trim().length > 0) {
      targetLines.push(`Mount it specifically inside the ${targetArea.trim()} portion of that file.`);
    }

    targetLines.push('Avoid touching unrelated files unless a supporting dependency is absolutely required.');

    lines.push('Integration constraints:');

    for (const constraint of targetLines) {
      lines.push(`- ${constraint}`);
    }

    lines.push('Hand back a diff that isolates the targeted edits so I can review before finalizing.');

    sendMessage(event, lines.join('\n'));

    onOpenChange(false);
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog
        onBackdrop={() => onOpenChange(false)}
        onClose={() => onOpenChange(false)}
        className="max-w-[720px] w-full"
      >
        <DialogTitle>Custom animation workshop</DialogTitle>
        <DialogDescription>
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-bolt-elements-textSecondary">
                Prototype a bespoke motion snippet, iterate on it with Figplit, then deploy it exactly where it belongs
                on the page. This flow keeps edits scoped so you never have to rewrite the entire landing layout.
              </p>
            </div>
            <form
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                submitPlan(event as unknown as React.UIEvent);
              }}
            >
              <section className="space-y-3">
                <header className="space-y-1">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Starting point</h3>
                  <p className="text-xs text-bolt-elements-textSecondary">
                    Remix an existing library snippet or begin from an empty canvas.
                  </p>
                </header>
                <div className="grid gap-3 sm:grid-cols-2">
                  {snippetOptions.map((option) => {
                    const active = option.id === selectedSnippet.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedSnippetId(option.id)}
                        className={classNames(
                          'rounded-lg border px-4 py-3 text-left transition-theme',
                          active
                            ? 'border-bolt-elements-item-backgroundAccent bg-bolt-elements-item-backgroundAccent/10'
                            : 'border-bolt-elements-borderColor/60 hover:border-bolt-elements-item-backgroundAccent',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-bolt-elements-textPrimary">{option.title}</span>
                          {active ? (
                            <span className="i-ph:check-circle-duotone text-lg text-bolt-elements-item-contentAccent" />
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-bolt-elements-textSecondary leading-relaxed">
                          {option.description}
                        </p>
                        {option.bestFor?.length ? (
                          <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-bolt-elements-textTertiary">
                            {option.bestFor.join(' • ')}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <header className="space-y-1">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Give the snippet a nickname</h3>
                  <p className="text-xs text-bolt-elements-textSecondary">
                    Figplit will refer to the piece by this name while it iterates and when it integrates it into the
                    codebase.
                  </p>
                </header>
                <input
                  type="text"
                  value={snippetNickname}
                  onChange={(event) => setSnippetNickname(event.target.value)}
                  className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bolt-elements-item-backgroundAccent"
                  placeholder="e.g. AuroraHeroLoop"
                />
              </section>

              <section className="space-y-3">
                <header className="space-y-1">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Creative direction</h3>
                  <p className="text-xs text-bolt-elements-textSecondary">
                    Capture the beats, timing, and mood. Separate each idea onto its own line—we’ll turn them into a
                    checklist for the model.
                  </p>
                </header>
                <textarea
                  value={creativeBrief}
                  onChange={(event) => setCreativeBrief(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bolt-elements-item-backgroundAccent"
                  placeholder={
                    'e.g. Slow orbital motion around a central product card\nLayered glow trails that react to cursor position'
                  }
                />
              </section>

              <section className="space-y-3">
                <header className="space-y-1">
                  <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Where should it live?</h3>
                  <p className="text-xs text-bolt-elements-textSecondary">
                    Tell Figplit exactly where to mount the finished snippet so the integration stays scoped.
                  </p>
                </header>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-[0.2em] text-bolt-elements-textTertiary">
                      File
                    </label>
                    <input
                      type="text"
                      value={targetFile}
                      onChange={(event) => setTargetFile(event.target.value)}
                      className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bolt-elements-item-backgroundAccent"
                      placeholder="e.g. app/routes/index.tsx"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-[0.2em] text-bolt-elements-textTertiary">
                      Section
                    </label>
                    <input
                      type="text"
                      value={targetArea}
                      onChange={(event) => setTargetArea(event.target.value)}
                      className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bolt-elements-item-backgroundAccent"
                      placeholder="e.g. hero animation stack"
                    />
                  </div>
                </div>
              </section>

              <footer className="flex items-center justify-end gap-2 border-t border-bolt-elements-borderColor pt-4">
                <DialogButton type="secondary" onClick={() => onOpenChange(false)}>
                  Cancel
                </DialogButton>
                <DialogButton
                  type="primary"
                  onClick={(event) => {
                    if (!canSubmit) {
                      event.preventDefault();
                      return;
                    }

                    submitPlan(event);
                  }}
                >
                  Send plan to Figplit
                </DialogButton>
              </footer>
            </form>
          </div>
        </DialogDescription>
      </Dialog>
    </DialogRoot>
  );
}
