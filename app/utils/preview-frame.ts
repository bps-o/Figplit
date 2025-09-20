const FIGPLIT_PREVIEW_BRIDGE_SOURCE = `(() => {
  if (window.__figplitPreviewBridgeLoaded) {
    return;
  }

  window.__figplitPreviewBridgeLoaded = true;

  const toNumber = (value) => {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const getNavigationMetadata = () => {
    const frameElement = window.frameElement;

    if (!frameElement) {
      return {};
    }

    const dataset = frameElement.dataset ?? {};

    return {
      id: toNumber(dataset.figplitNavigationId),
      startedAt: toNumber(dataset.figplitNavigationStartedAt),
      startedAtTs: toNumber(dataset.figplitNavigationStartedAtTs),
      url: dataset.figplitNavigationUrl,
    };
  };

  let navigation = getNavigationMetadata();

  const postMessage = (type, payload = {}) => {
    if (!navigation.id || !window.parent) {
      return;
    }

    window.parent.postMessage(
      {
        source: 'figplit-preview',
        type,
        navigationId: navigation.id,
        timestamp: typeof performance?.now === 'function' ? performance.now() : Date.now(),
        ...payload,
      },
      '*',
    );
  };

  const refreshNavigationMetadata = () => {
    navigation = getNavigationMetadata();
  };

  const readyListeners = [];

  const notifyReady = () => {
    refreshNavigationMetadata();

    postMessage('preview:ready', { url: window.location.href });
  };

  if (document.readyState === 'complete') {
    setTimeout(notifyReady, 0);
  } else {
    window.addEventListener(
      'load',
      () => {
        notifyReady();

        for (const listener of readyListeners) {
          try {
            listener();
          } catch (error) {
            console.error('Figplit preview ready listener failed', error);
          }
        }
      },
      { once: true },
    );
  }

  const performanceMetrics = {};

  const reportPerformanceMetrics = () => {
    if (!navigation.id) {
      refreshNavigationMetadata();
    }

    postMessage('preview:performance', { metrics: { ...performanceMetrics } });
  };

  const mapPaintEntry = (entry) => {
    if (entry.name === 'first-contentful-paint') {
      performanceMetrics.firstContentfulPaint = entry.startTime;
    }
  };

  try {
    if (typeof PerformanceObserver === 'function') {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          switch (entry.entryType) {
            case 'navigation': {
              performanceMetrics.domContentLoaded = entry.domContentLoadedEventEnd;
              performanceMetrics.loadEventEnd = entry.loadEventEnd;
              performanceMetrics.duration = entry.duration;
              break;
            }
            case 'paint': {
              mapPaintEntry(entry);
              break;
            }
            case 'largest-contentful-paint': {
              const renderTime = entry.renderTime ?? entry.loadTime;

              if (renderTime) {
                performanceMetrics.largestContentfulPaint = renderTime;
              }

              break;
            }
            case 'layout-shift': {
              if (!entry.hadRecentInput) {
                performanceMetrics.cumulativeLayoutShift = (performanceMetrics.cumulativeLayoutShift ?? 0) + entry.value;
              }

              break;
            }
          }
        }

        reportPerformanceMetrics();
      });

      observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'layout-shift'] });

      readyListeners.push(() => {
        const navigationEntry = performance.getEntriesByType?.('navigation')?.[0];

        if (navigationEntry) {
          performanceMetrics.domContentLoaded = navigationEntry.domContentLoadedEventEnd;
          performanceMetrics.loadEventEnd = navigationEntry.loadEventEnd;
          performanceMetrics.duration = navigationEntry.duration;
        }

        for (const paintEntry of performance.getEntriesByType?.('paint') ?? []) {
          mapPaintEntry(paintEntry);
        }

        reportPerformanceMetrics();
      });
    }
  } catch (error) {
    console.error('Figplit preview metrics observer error', error);
  }

  const sampleAnimations = () => {
    refreshNavigationMetadata();

    const animations = [];

    if (typeof document.getAnimations === 'function') {
      for (const animation of document.getAnimations()) {
        const effect = animation.effect;
        const timing = effect?.getComputedTiming?.();

        animations.push({
          name: animation.animationName,
          delay: timing?.delay ?? animation.startTime ?? 0,
          duration: timing?.duration ?? undefined,
          playbackRate: animation.playbackRate,
          iterations: timing?.iterations ?? animation.effect?.timing?.iterations ?? undefined,
          easing: timing?.easing ?? animation.effect?.timing?.easing,
          fillMode: timing?.fill ?? animation.effect?.timing?.fill,
          direction: timing?.direction ?? animation.effect?.timing?.direction,
          startTime: animation.startTime ?? undefined,
          currentTime: animation.currentTime ?? undefined,
          endTime:
            animation.startTime !== null && animation.startTime !== undefined && timing?.duration && Number.isFinite(timing.duration)
              ? animation.startTime + timing.duration
              : undefined,
          keyframes: typeof effect?.getKeyframes === 'function' ? effect.getKeyframes() : undefined,
        });
      }
    }

    postMessage('preview:animation-timeline', { timeline: animations });
  };

  const scheduleAnimationSamples = () => {
    sampleAnimations();

    setTimeout(sampleAnimations, 500);
    setTimeout(sampleAnimations, 1500);
  };

  readyListeners.push(scheduleAnimationSamples);

  document.addEventListener('animationstart', () => {
    scheduleAnimationSamples();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleAnimationSamples();
    }
  });
})();`;

declare global {
  interface Window {
    __figplitPreviewBridgeLoaded?: boolean;
  }
}

interface NavigationMetadata {
  navigationId: number;
  startedAt: number;
  startedAtTs: number;
  url?: string;
}

export function applyPreviewNavigationMetadata(
  iframe: HTMLIFrameElement | null,
  metadata: NavigationMetadata,
): void {
  if (!iframe) {
    return;
  }

  iframe.dataset.figplitNavigationId = String(metadata.navigationId);
  iframe.dataset.figplitNavigationStartedAt = String(metadata.startedAt);
  iframe.dataset.figplitNavigationStartedAtTs = String(metadata.startedAtTs);

  if (metadata.url) {
    iframe.dataset.figplitNavigationUrl = metadata.url;
  }
}

export function injectPreviewBridge(iframe: HTMLIFrameElement | null): void {
  if (!iframe) {
    return;
  }

  try {
    const doc = iframe.contentDocument;

    if (!doc || doc.getElementById('figplit-preview-bridge')) {
      return;
    }

    const script = doc.createElement('script');
    script.id = 'figplit-preview-bridge';
    script.textContent = FIGPLIT_PREVIEW_BRIDGE_SOURCE;

    const target = doc.head || doc.body || doc.documentElement;

    target?.appendChild(script);
  } catch (error) {
    console.error('Failed to inject Figplit preview bridge', error);
  }
}
