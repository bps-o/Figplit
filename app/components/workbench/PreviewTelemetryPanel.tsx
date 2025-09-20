import { useStore } from '@nanostores/react';
import { memo, useMemo, type ReactNode } from 'react';
import {
  previewTelemetryStore,
  type PreviewAnimationSample,
  type PreviewTelemetry,
} from '~/lib/stores/preview-telemetry';

interface PreviewTelemetryPanelProps {
  port?: number;
}

interface SummaryRow {
  label: string;
  value: string;
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

function buildAnimationDetails(telemetry?: PreviewTelemetry) {
  const navigation = telemetry?.lastNavigation;
  const animationTimeline = navigation?.animationTimeline;

  if (!animationTimeline || animationTimeline.animations.length === 0) {
    return { summary: 'No animations recorded', samples: [] as string[] };
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

  return {
    summary: summaryParts.join(' • '),
    samples,
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
          <div className="flex flex-col gap-2">
            <SectionTitle>Animation samples</SectionTitle>
            <p className="text-xs text-bolt-elements-textPrimary">{animationSummary.summary}</p>
            {animationSummary.samples.length > 0 && (
              <ul className="list-disc space-y-1 pl-4 text-[11px] text-bolt-elements-textSecondary">
                {animationSummary.samples.map((sample, index) => (
                  <li key={`animation-${index}`}>{sample}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

PreviewTelemetryPanel.displayName = 'PreviewTelemetryPanel';
