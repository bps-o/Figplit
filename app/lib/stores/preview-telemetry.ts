import { map } from 'nanostores';

export interface PreviewPerformanceMetrics {
  domContentLoaded?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  totalBlockingTime?: number;
  cumulativeLayoutShift?: number;
  timeToInteractive?: number;
  [key: string]: number | undefined;
}

export interface PreviewAnimationSample {
  name?: string;
  delay?: number;
  duration?: number;
  playbackRate?: number;
  iterations?: number | 'infinite';
  easing?: string;
  fillMode?: string;
  direction?: string;
  startTime?: number;
  endTime?: number;
  keyframes?: unknown;
  [key: string]: unknown;
}

export interface AnimationTimelineSnapshot {
  recordedAt: number;
  recordedAtTs: number;
  animations: PreviewAnimationSample[];
}

export interface PreviewNavigationSnapshot {
  navigationId: number;
  url?: string;
  startedAt: number;
  startedAtTs: number;
  completedAt?: number;
  completedAtTs?: number;
  durationMs?: number;
  ready?: boolean;
  performance?: PreviewPerformanceMetrics;
  performanceRecordedAt?: number;
  performanceRecordedAtTs?: number;
  animationTimeline?: AnimationTimelineSnapshot;
}

export interface PreviewTelemetry {
  port: number;
  ready: boolean;
  lastNavigationId?: number;
  lastNavigation?: PreviewNavigationSnapshot;
}

export type PreviewTelemetryMap = Record<number, PreviewTelemetry>;

export const previewTelemetryStore = map<PreviewTelemetryMap>({});

function updatePreviewTelemetry(port: number, updater: (previous: PreviewTelemetry) => PreviewTelemetry) {
  const current = previewTelemetryStore.get();
  const previous = current[port] ?? { port, ready: false };
  const next = updater(previous);

  if (next === previous) {
    return;
  }

  previewTelemetryStore.set({
    ...current,
    [port]: next,
  });
}

export function beginPreviewNavigation(options: {
  port: number;
  navigationId: number;
  url?: string;
  startedAt: number;
  startedAtTs?: number;
}) {
  const { port, navigationId, url, startedAt, startedAtTs } = options;

  updatePreviewTelemetry(port, (previous) => ({
    ...previous,
    ready: false,
    lastNavigationId: navigationId,
    lastNavigation: {
      navigationId,
      url,
      startedAt,
      startedAtTs: startedAtTs ?? Date.now(),
    },
  }));
}

export function completePreviewNavigation(options: {
  port: number;
  navigationId: number;
  completedAt: number;
  completedAtTs?: number;
  markReady?: boolean;
}) {
  const { port, navigationId, completedAt, completedAtTs, markReady = true } = options;

  updatePreviewTelemetry(port, (previous) => {
    if (previous.lastNavigationId !== navigationId || !previous.lastNavigation) {
      return previous;
    }

    const durationMs = Math.max(0, completedAt - previous.lastNavigation.startedAt);

    return {
      ...previous,
      ready: markReady,
      lastNavigation: {
        ...previous.lastNavigation,
        completedAt,
        completedAtTs: completedAtTs ?? Date.now(),
        durationMs,
        ready: markReady,
      },
    };
  });
}

export function recordPreviewPerformanceMetrics(options: {
  port: number;
  navigationId: number;
  metrics: PreviewPerformanceMetrics;
  recordedAt: number;
  recordedAtTs?: number;
}) {
  const { port, navigationId, metrics, recordedAt, recordedAtTs } = options;

  updatePreviewTelemetry(port, (previous) => {
    if (previous.lastNavigationId !== navigationId || !previous.lastNavigation) {
      return previous;
    }

    return {
      ...previous,
      lastNavigation: {
        ...previous.lastNavigation,
        performance: {
          ...previous.lastNavigation.performance,
          ...metrics,
        },
        performanceRecordedAt: recordedAt,
        performanceRecordedAtTs: recordedAtTs ?? Date.now(),
      },
    };
  });
}

export function recordPreviewAnimationTimeline(options: {
  port: number;
  navigationId: number;
  timeline: PreviewAnimationSample[];
  recordedAt: number;
  recordedAtTs?: number;
}) {
  const { port, navigationId, timeline, recordedAt, recordedAtTs } = options;

  updatePreviewTelemetry(port, (previous) => {
    if (previous.lastNavigationId !== navigationId || !previous.lastNavigation) {
      return previous;
    }

    return {
      ...previous,
      lastNavigation: {
        ...previous.lastNavigation,
        animationTimeline: {
          animations: timeline,
          recordedAt,
          recordedAtTs: recordedAtTs ?? Date.now(),
        },
      },
    };
  });
}

export function resetPreviewTelemetry(port: number) {
  updatePreviewTelemetry(port, () => ({ port, ready: false }));
}

export function removePreviewTelemetry(port: number) {
  const current = previewTelemetryStore.get();

  if (!(port in current)) {
    return;
  }

  const next = { ...current };
  delete next[port];

  previewTelemetryStore.set(next);
}
