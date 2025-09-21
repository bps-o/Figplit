import { useStore } from '@nanostores/react';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import {
  previewTelemetryStore,
  type PreviewAnimationSample,
  type PreviewTelemetry,
} from '~/lib/stores/preview-telemetry';
import { classNames } from '~/utils/classNames';

interface PreviewTelemetryPanelProps {
  port?: number;
}

interface SummaryRow {
  label: string;
  value: string;
}

interface NormalizedAnimationSample {
  id: string;
  label: string;
  relativeStart: number;
  relativeEnd: number;
  relativeDuration: number;
  rawDuration: number;
  playbackRate?: number;
  iterations?: number | 'infinite';
}

interface AnimationSummaryDetails {
  summary: string;
  samples: string[];
  normalizedAnimations: NormalizedAnimationSample[];
  timelineDuration: number;
  timelineOffset: number;
  timelineKey: string;
  hasAnimations: boolean;
}

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

function formatMilliseconds(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  if (Math.abs(value) >= 1000) {
    return `${numberFormatter.format(value / 1000)} s`;
  }

  return `${numberFormatter.format(value)} ms`;
}

function formatMetricValue(metric: string, value: number): string {
  const lowerMetric = metric.toLowerCase();

  if (lowerMetric.includes('time') || lowerMetric.includes('paint') || lowerMetric.includes('load')) {
    return formatMilliseconds(value);
  }

  return numberFormatter.format(value);
}

function formatDelta(value?: number, base?: number): string {
  if (typeof value !== 'number') {
    return '—';
  }

  if (typeof base === 'number') {
    return `+${formatMilliseconds(Math.max(0, value - base))}`;
  }

  return formatMilliseconds(value);
}

function buildNavigationRows(telemetry?: PreviewTelemetry): SummaryRow[] {
  const navigation = telemetry?.lastNavigation;

  if (!navigation) {
    return [];
  }

  const rows: SummaryRow[] = [
    {
      label: 'Status',
      value: navigation.ready ? 'Ready' : navigation.completedAt ? 'Completed' : 'Loading…',
    },
    {
      label: 'URL',
      value: navigation.url ?? '—',
    },
    {
      label: 'Duration',
      value: formatMilliseconds(navigation.durationMs),
    },
  ];

  rows.push({
    label: 'Started',
    value: formatMilliseconds(navigation.startedAt),
  });

  rows.push({
    label: 'Completed',
    value: formatDelta(navigation.completedAt, navigation.startedAt),
  });

  rows.push({
    label: 'Performance sampled',
    value: formatDelta(navigation.performanceRecordedAt, navigation.startedAt),
  });

  rows.push({
    label: 'Animations sampled',
    value: formatDelta(navigation.animationTimeline?.recordedAt, navigation.startedAt),
  });

  return rows;
}

function buildPerformanceRows(telemetry?: PreviewTelemetry): SummaryRow[] {
  const navigation = telemetry?.lastNavigation;
  const performance = navigation?.performance;

  if (!performance) {
    return [];
  }

  return Object.entries(performance)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([metric, value]) => ({
      label: metric.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()),
      value: formatMetricValue(metric, value),
    }));
}

function buildAnimationDetails(telemetry?: PreviewTelemetry): AnimationSummaryDetails {
  const navigation = telemetry?.lastNavigation;
  const animationTimeline = navigation?.animationTimeline;

  if (!animationTimeline || animationTimeline.animations.length === 0) {
    return {
      summary: 'No animations recorded',
      samples: [],
      normalizedAnimations: [],
      timelineDuration: 0,
      timelineOffset: 0,
      timelineKey: `${navigation?.navigationId ?? 'none'}-empty`,
      hasAnimations: false,
    };
  }

  const { animations, recordedAt } = animationTimeline;

  const samples = animations.slice(0, 3).map((animation, index) => {
    return formatAnimationSample(animation, index);
  });

  const remaining = animations.length - samples.length;
  const summaryParts = [`${animations.length} animation${animations.length === 1 ? '' : 's'}`];

  if (typeof recordedAt === 'number' && typeof navigation?.startedAt === 'number') {
    summaryParts.push(`recorded ${formatDelta(recordedAt, navigation.startedAt)}`);
  }

  if (remaining > 0) {
    summaryParts.push(`+${remaining} more`);
  }

  const normalized = normalizeAnimationSamples(animations);
  const timelineKey = [
    navigation?.navigationId ?? 'nav',
    recordedAt ?? 'time',
    animations.length,
    normalized.timelineDuration,
  ].join('-');

  return {
    summary: summaryParts.join(' • '),
    samples,
    normalizedAnimations: normalized.animations,
    timelineDuration: normalized.timelineDuration,
    timelineOffset: normalized.timelineOffset,
    timelineKey,
    hasAnimations: normalized.animations.length > 0 && normalized.timelineDuration >= 0,
  };
}

function formatAnimationSample(sample: PreviewAnimationSample, index: number) {
  const name = sample.name?.trim() || `Animation ${index + 1}`;
  const details: string[] = [];

  if (typeof sample.duration === 'number') {
    details.push(`duration ${formatMilliseconds(sample.duration)}`);
  }

  if (typeof sample.delay === 'number' && sample.delay !== 0) {
    details.push(`delay ${formatMilliseconds(sample.delay)}`);
  }

  if (typeof sample.playbackRate === 'number' && sample.playbackRate !== 1) {
    details.push(`${numberFormatter.format(sample.playbackRate)}x speed`);
  }

  if (typeof sample.iterations === 'number') {
    details.push(`${sample.iterations} iteration${sample.iterations === 1 ? '' : 's'}`);
  } else if (sample.iterations === 'infinite') {
    details.push('infinite iterations');
  }

  if (details.length === 0) {
    return name;
  }

  return `${name} (${details.join(', ')})`;
}

function normalizeAnimationSamples(animations: PreviewAnimationSample[]) {
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;

  const intermediate = animations.map((sample, index) => {
    const label = sample.name?.trim() || `Animation ${index + 1}`;
    const start = toFiniteNumber(sample.startTime, 0);
    const baseDuration = Math.max(0, toFiniteNumber(sample.duration, 0));
    let end = sample.endTime;

    if (!isFiniteNumber(end)) {
      if (baseDuration > 0) {
        end = start + baseDuration;
      } else if (isFiniteNumber(sample.currentTime) && sample.currentTime && sample.currentTime > 0) {
        end = start + sample.currentTime;
      } else {
        end = start;
      }
    }

    const finiteEnd = toFiniteNumber(end, start);
    const clampedEnd = finiteEnd < start ? start : finiteEnd;
    const computedDuration = Math.max(baseDuration, clampedEnd - start);

    if (start < minStart) {
      minStart = start;
    }

    if (clampedEnd > maxEnd) {
      maxEnd = clampedEnd;
    }

    return {
      id: `animation-${index}`,
      label,
      start,
      end: clampedEnd,
      computedDuration,
      playbackRate: isFiniteNumber(sample.playbackRate) ? sample.playbackRate : undefined,
      iterations: sample.iterations,
    };
  });

  if (!Number.isFinite(minStart)) {
    minStart = 0;
  }

  if (!Number.isFinite(maxEnd)) {
    maxEnd = minStart;
  }

  const baseDuration = Math.max(0, maxEnd - minStart);

  const normalizedAnimations: NormalizedAnimationSample[] = intermediate.map((item) => {
    const relativeStart = Math.max(0, item.start - minStart);
    const relativeEnd = Math.max(relativeStart, item.end - minStart);
    const relativeDuration = Math.max(relativeEnd - relativeStart, item.computedDuration);

    return {
      id: item.id,
      label: item.label,
      relativeStart,
      relativeEnd,
      relativeDuration,
      rawDuration: item.computedDuration,
      playbackRate: item.playbackRate,
      iterations: item.iterations,
    };
  });

  const maxRelativeEnd = normalizedAnimations.reduce((max, item) => Math.max(max, item.relativeEnd), 0);
  const finalDuration = Math.max(baseDuration, maxRelativeEnd);

  return {
    animations: normalizedAnimations,
    timelineDuration: finalDuration,
    timelineOffset: minStart,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toFiniteNumber(value: unknown, fallback: number) {
  return isFiniteNumber(value) ? value : fallback;
}

interface SummarySectionProps {
  title: string;
  rows: SummaryRow[];
  emptyLabel?: string;
}

function SummarySection({ title, rows, emptyLabel }: SummarySectionProps) {
  if (rows.length === 0) {
    return emptyLabel ? (
      <div className="flex flex-col gap-1">
        <SectionTitle>{title}</SectionTitle>
        <p className="text-xs text-bolt-elements-textSecondary">{emptyLabel}</p>
      </div>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>{title}</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={`${title}-${row.label}`} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bolt-elements-textTertiary">
              {row.label}
            </span>
            <span className="text-xs text-bolt-elements-textPrimary break-words">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-bolt-elements-textTertiary">{children}</h3>
  );
}

export const PreviewTelemetryPanel = memo(({ port }: PreviewTelemetryPanelProps) => {
  const telemetryMap = useStore(previewTelemetryStore);
  const telemetry = port !== undefined ? telemetryMap[port] : undefined;

  const navigationRows = useMemo(() => buildNavigationRows(telemetry), [telemetry]);
  const performanceRows = useMemo(() => buildPerformanceRows(telemetry), [telemetry]);
  const animationSummary = useMemo(() => buildAnimationDetails(telemetry), [telemetry]);

  return (
    <div className="border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-bolt-elements-textPrimary">Preview telemetry</span>
        {telemetry?.lastNavigation?.navigationId !== undefined && (
          <span className="text-[11px] uppercase tracking-[0.16em] text-bolt-elements-textTertiary">
            Nav #{telemetry.lastNavigation.navigationId}
          </span>
        )}
      </div>

      {port === undefined ? (
        <p className="mt-3 text-sm text-bolt-elements-textSecondary">
          Select a preview to inspect navigation performance.
        </p>
      ) : !telemetry?.lastNavigation ? (
        <p className="mt-3 text-sm text-bolt-elements-textSecondary">
          Waiting for telemetry from preview on port {port}…
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <SummarySection
            title="Navigation"
            rows={navigationRows}
            emptyLabel="Navigation details will appear after the first load."
          />
          <SummarySection
            title="Performance metrics"
            rows={performanceRows}
            emptyLabel="Performance metrics have not been reported yet."
          />
          <AnimationTimelineSection details={animationSummary} />
        </div>
      )}
    </div>
  );
});

PreviewTelemetryPanel.displayName = 'PreviewTelemetryPanel';

function AnimationTimelineSection({ details }: { details: AnimationSummaryDetails }) {
  const { summary, samples, normalizedAnimations, timelineDuration, timelineKey, hasAnimations } = details;
  const [scrubberTime, setScrubberTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const requestRef = useRef<number>();
  const previousTimestampRef = useRef<number>();

  useEffect(() => {
    const shouldPlay = hasAnimations && timelineDuration > 0;

    setScrubberTime(0);
    setIsPlaying(shouldPlay);
  }, [timelineKey, hasAnimations, timelineDuration]);

  useEffect(() => {
    if (!isPlaying || !hasAnimations || timelineDuration <= 0) {
      if (requestRef.current !== undefined) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }

      previousTimestampRef.current = undefined;

      return () => {
        if (requestRef.current !== undefined) {
          cancelAnimationFrame(requestRef.current);
          requestRef.current = undefined;
        }

        previousTimestampRef.current = undefined;
      };
    }

    const step = (timestamp: number) => {
      const previousTimestamp = previousTimestampRef.current;

      if (previousTimestamp === undefined) {
        previousTimestampRef.current = timestamp;
        requestRef.current = requestAnimationFrame(step);

        return;
      }

      const delta = timestamp - previousTimestamp;
      previousTimestampRef.current = timestamp;

      let shouldContinue = true;

      setScrubberTime((current) => {
        let next = current + delta;

        if (next >= timelineDuration) {
          if (isLooping && timelineDuration > 0) {
            const remainder = timelineDuration > 0 ? next % timelineDuration : 0;
            next = Number.isFinite(remainder) ? remainder : 0;
          } else {
            next = timelineDuration;
            shouldContinue = false;
          }
        }

        return next;
      });

      if (!shouldContinue) {
        setIsPlaying(false);

        return;
      }

      requestRef.current = requestAnimationFrame(step);
    };

    requestRef.current = requestAnimationFrame(step);

    return () => {
      if (requestRef.current !== undefined) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }

      previousTimestampRef.current = undefined;
    };
  }, [isPlaying, isLooping, hasAnimations, timelineDuration]);

  const safeDuration = timelineDuration > 0 ? timelineDuration : 1;
  const clampedScrubber = Math.max(0, Math.min(scrubberTime, safeDuration));
  const scrubberPercent = Math.max(0, Math.min(100, (clampedScrubber / safeDuration) * 100));
  const sliderStep = Math.max(1, Math.round(safeDuration / 250));
  const hasTimeline = hasAnimations && normalizedAnimations.length > 0;
  const currentLabel = hasTimeline ? formatMilliseconds(Math.min(clampedScrubber, timelineDuration)) : '—';
  const totalLabel = hasTimeline ? formatMilliseconds(timelineDuration) : '—';

  const sampleTimes = useMemo(() => {
    if (!hasTimeline) {
      return [] as number[];
    }

    if (timelineDuration <= 0) {
      return [0];
    }

    const times = [0, timelineDuration / 2, timelineDuration];

    return Array.from(
      new Map(
        times.map((time) => {
          const clamped = Math.max(0, Math.min(timelineDuration, time));

          return [Math.round(clamped * 1000) / 1000, clamped] as const;
        }),
      ).values(),
    );
  }, [hasTimeline, timelineDuration]);

  const handleScrub = (value: number) => {
    const clampedValue = Math.max(0, Math.min(value, safeDuration));

    setScrubberTime(clampedValue);
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>Animation timeline</SectionTitle>
      <p className="text-xs text-bolt-elements-textPrimary">{summary}</p>

      {hasTimeline ? (
        <>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <IconButton
                icon={isPlaying ? 'i-ph:pause-fill' : 'i-ph:play-fill'}
                size="lg"
                disabled={!hasTimeline || timelineDuration <= 0}
                onClick={() => {
                  if (!hasTimeline || timelineDuration <= 0) {
                    return;
                  }

                  setIsPlaying((previous) => !previous);
                }}
                title={isPlaying ? 'Pause playback' : 'Play timeline'}
              />
              <IconButton
                icon="i-ph:repeat"
                size="lg"
                className={classNames({
                  'text-bolt-elements-item-contentActive': isLooping,
                })}
                disabled={!hasTimeline || timelineDuration <= 0}
                onClick={() => {
                  if (!hasTimeline || timelineDuration <= 0) {
                    return;
                  }

                  setIsLooping((previous) => !previous);
                }}
                title={isLooping ? 'Looping enabled' : 'Enable looping'}
              />
              <div className="flex-1 min-w-[140px]">
                <input
                  type="range"
                  min={0}
                  max={safeDuration}
                  step={sliderStep}
                  value={clampedScrubber}
                  onChange={(event) => handleScrub(Number(event.target.value))}
                  className="w-full accent-bolt-elements-item-backgroundAccent"
                  aria-label="Scrub animation timeline"
                  disabled={!hasTimeline}
                />
              </div>
              <div className="flex items-center gap-1 text-[11px] text-bolt-elements-textSecondary">
                <span className="font-mono">{currentLabel}</span>
                <span className="text-bolt-elements-textTertiary">/</span>
                <span className="font-mono">{totalLabel}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {normalizedAnimations.map((animation) => {
                const leftPercent = (animation.relativeStart / safeDuration) * 100;
                const widthPercent = Math.max(0.75, (animation.relativeDuration / safeDuration) * 100);
                const isActive =
                  clampedScrubber >= animation.relativeStart &&
                  clampedScrubber <= animation.relativeEnd + Math.max(1, safeDuration * 0.01);

                return (
                  <div key={animation.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px] text-bolt-elements-textSecondary">
                      <span
                        className={classNames('truncate text-bolt-elements-textSecondary', {
                          'text-bolt-elements-textPrimary font-medium': isActive,
                        })}
                      >
                        {animation.label}
                      </span>
                      <span className="font-mono text-[10px] text-bolt-elements-textTertiary">
                        {formatMilliseconds(animation.rawDuration)}
                      </span>
                    </div>
                    <div className="relative h-2.5 rounded-full bg-bolt-elements-background-depth-1">
                      <div
                        className="absolute top-0 bottom-0 rounded-full bg-bolt-elements-item-backgroundAccent/40"
                        style={{
                          left: `${Math.max(0, Math.min(100, leftPercent))}%`,
                          width: `${Math.max(0.75, Math.min(100, widthPercent))}%`,
                        }}
                      />
                      <div
                        className="absolute top-[-4px] bottom-[-4px] w-[2px] rounded bg-bolt-elements-item-backgroundAccent"
                        style={{ left: `${scrubberPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {sampleTimes.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bolt-elements-textTertiary">
                Motion thumbnails
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                {sampleTimes.map((time, index) => {
                  const normalizedTime = Math.min(time, safeDuration);
                  const indicatorPercent = Math.max(0, Math.min(100, (normalizedTime / safeDuration) * 100));
                  const delta = Math.abs(clampedScrubber - normalizedTime);
                  const tolerance = Math.max(20, safeDuration * 0.05);
                  const isSelected = delta <= tolerance;
                  const activeAnimations = normalizedAnimations.filter((animation) => {
                    return (
                      normalizedTime >= animation.relativeStart &&
                      normalizedTime <= animation.relativeEnd + Math.max(1, safeDuration * 0.01)
                    );
                  });
                  const activeLabel = activeAnimations.length > 0 ? `${activeAnimations.length} active` : 'Idle';
                  const buttonClassName = classNames(
                    'flex flex-col gap-1 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-2 text-left transition-theme',
                    {
                      'border-bolt-elements-item-backgroundAccent shadow-sm text-bolt-elements-textPrimary': isSelected,
                    },
                  );

                  return (
                    <button
                      key={`thumbnail-${index}`}
                      type="button"
                      className={buttonClassName}
                      onClick={() => handleScrub(normalizedTime)}
                    >
                      <div className="flex items-center justify-between text-[11px] text-bolt-elements-textSecondary">
                        <span className="font-mono">{formatMilliseconds(normalizedTime)}</span>
                        <span className="text-bolt-elements-textTertiary">{activeLabel}</span>
                      </div>
                      <div className="relative h-12 rounded-md bg-bolt-elements-background-depth-2 overflow-hidden">
                        {normalizedAnimations.map((animation, animationIndex) => {
                          const rowHeight = 100 / normalizedAnimations.length;
                          const top = animationIndex * rowHeight;
                          const rowLeft = (animation.relativeStart / safeDuration) * 100;
                          const rowWidth = Math.max(1, (animation.relativeDuration / safeDuration) * 100);
                          const isRowActive = activeAnimations.some((active) => active.id === animation.id);
                          const barClassName = classNames('absolute bg-bolt-elements-item-backgroundAccent/30', {
                            'bg-bolt-elements-item-backgroundAccent/60': isRowActive,
                          });

                          return (
                            <div
                              key={`${animation.id}-thumb`}
                              className={barClassName}
                              style={{
                                top: `${top}%`,
                                height: `${rowHeight}%`,
                                left: `${Math.max(0, Math.min(100, rowLeft))}%`,
                                width: `${Math.max(1, Math.min(100, rowWidth))}%`,
                              }}
                            />
                          );
                        })}
                        <div
                          className="absolute top-0 bottom-0 w-[2px] bg-bolt-elements-item-backgroundAccent"
                          style={{ left: `${indicatorPercent}%` }}
                        />
                      </div>
                      {activeAnimations.length > 0 ? (
                        <ul className="text-[10px] text-bolt-elements-textSecondary">
                          {activeAnimations.map((animation) => {
                            const progress =
                              animation.relativeDuration > 0
                                ? Math.max(
                                    0,
                                    Math.min(
                                      1,
                                      (normalizedTime - animation.relativeStart) / animation.relativeDuration,
                                    ),
                                  )
                                : 0;

                            return (
                              <li key={`${animation.id}-progress`} className="flex items-center justify-between gap-2">
                                <span className="truncate">{animation.label}</span>
                                <span className="font-mono">{Math.round(progress * 100)}%</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-[10px] text-bolt-elements-textTertiary">No active animations</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {samples.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-bolt-elements-textTertiary">
                Recorded animation details
              </span>
              <ul className="list-disc space-y-1 pl-4 text-[11px] text-bolt-elements-textSecondary">
                {samples.map((sample, index) => (
                  <li key={`animation-detail-${index}`}>{sample}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-bolt-elements-textSecondary">
          Animation telemetry will appear once the preview captures motion.
        </p>
      )}
    </div>
  );
}
