import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { PortDropdown } from './PortDropdown';
import { PreviewTelemetryPanel } from './PreviewTelemetryPanel';
import {
  beginPreviewNavigation,
  completePreviewNavigation,
  recordPreviewAnimationTimeline,
  recordPreviewPerformanceMetrics,
  type PreviewAnimationSample,
  type PreviewPerformanceMetrics,
} from '~/lib/stores/preview-telemetry';

type PreviewTelemetryMessage =
  | {
      source: 'figplit-preview';
      type: 'preview:ready';
      navigationId?: number;
      timestamp?: number;
      url?: string;
    }
  | {
      source: 'figplit-preview';
      type: 'preview:performance';
      navigationId?: number;
      timestamp?: number;
      metrics: PreviewPerformanceMetrics;
    }
  | {
      source: 'figplit-preview';
      type: 'preview:animation-timeline';
      navigationId?: number;
      timestamp?: number;
      timeline: PreviewAnimationSample[];
    };

function isPreviewTelemetryMessage(data: unknown): data is PreviewTelemetryMessage {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const base = data as Record<string, unknown>;

  if (base.source !== 'figplit-preview' || typeof base.type !== 'string') {
    return false;
  }

  if (base.type === 'preview:performance') {
    return typeof base.metrics === 'object' && base.metrics !== null;
  }

  if (base.type === 'preview:animation-timeline') {
    return Array.isArray(base.timeline);
  }

  return true;
}

const getRelativeTimestamp = () => {
  const hasHighResolutionTimer = typeof performance !== 'undefined' && typeof performance.now === 'function';
  return hasHighResolutionTimer ? performance.now() : Date.now();
};

export const Preview = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const hasSelectedPreview = useRef(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const activePort = activePreview?.port;

  const [url, setUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();
  const navigationCounterRef = useRef(0);
  const lastNavigationIdRef = useRef<number | undefined>();

  useEffect(() => {
    if (!activePreview) {
      setUrl('');
      setIframeUrl(undefined);
      lastNavigationIdRef.current = undefined;

      return;
    }

    const { baseUrl } = activePreview;

    setUrl(baseUrl);
    setIframeUrl(baseUrl);
  }, [activePreview]);

  useEffect(() => {
    navigationCounterRef.current = 0;
    lastNavigationIdRef.current = undefined;
  }, [activePort]);

  const startNavigation = useCallback(
    (nextUrl?: string) => {
      if (activePort === undefined || !nextUrl) {
        return;
      }

      const navigationId = navigationCounterRef.current + 1;
      navigationCounterRef.current = navigationId;
      lastNavigationIdRef.current = navigationId;

      beginPreviewNavigation({
        port: activePort,
        navigationId,
        url: nextUrl,
        startedAt: getRelativeTimestamp(),
      });
    },
    [activePort],
  );

  useEffect(() => {
    if (iframeUrl) {
      startNavigation(iframeUrl);
    }
  }, [iframeUrl, startNavigation]);

  const validateUrl = useCallback(
    (value: string) => {
      if (!activePreview) {
        return false;
      }

      const { baseUrl } = activePreview;

      if (value === baseUrl) {
        return true;
      } else if (value.startsWith(baseUrl)) {
        return ['/', '?', '#'].includes(value.charAt(baseUrl.length));
      }

      return false;
    },
    [activePreview],
  );

  const findMinPortIndex = useCallback(
    (minIndex: number, preview: { port: number }, index: number, array: { port: number }[]) => {
      return preview.port < array[minIndex].port ? index : minIndex;
    },
    [],
  );

  // when previews change, display the lowest port if user hasn't selected a preview
  useEffect(() => {
    if (previews.length > 1 && !hasSelectedPreview.current) {
      const minPortIndex = previews.reduce(findMinPortIndex, 0);

      setActivePreviewIndex(minPortIndex);
    }
  }, [previews]);

  const reloadPreview = useCallback(() => {
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;

      startNavigation(currentSrc);
      iframeRef.current.src = currentSrc;
    }
  }, [startNavigation]);

  const handleIframeLoad = useCallback(() => {
    if (activePort === undefined || lastNavigationIdRef.current === undefined) {
      return;
    }

    completePreviewNavigation({
      port: activePort,
      navigationId: lastNavigationIdRef.current,
      completedAt: getRelativeTimestamp(),
    });
  }, [activePort]);

  useEffect(() => {
    if (activePort === undefined) {
      return undefined;
    }

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (!isPreviewTelemetryMessage(event.data)) {
        return;
      }

      const navigationId = event.data.navigationId ?? lastNavigationIdRef.current;

      if (navigationId === undefined) {
        return;
      }

      const timestamp = typeof event.data.timestamp === 'number' ? event.data.timestamp : getRelativeTimestamp();

      switch (event.data.type) {
        case 'preview:ready': {
          completePreviewNavigation({
            port: activePort,
            navigationId,
            completedAt: timestamp,
            markReady: true,
          });
          break;
        }
        case 'preview:performance': {
          recordPreviewPerformanceMetrics({
            port: activePort,
            navigationId,
            metrics: event.data.metrics,
            recordedAt: timestamp,
          });
          break;
        }
        case 'preview:animation-timeline': {
          recordPreviewAnimationTimeline({
            port: activePort,
            navigationId,
            timeline: event.data.timeline,
            recordedAt: timestamp,
          });
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [activePort]);

  return (
    <div className="w-full h-full flex flex-col">
      {isPortDropdownOpen && (
        <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
      )}
      <div className="bg-bolt-elements-background-depth-2 p-2 flex items-center gap-1.5">
        <IconButton icon="i-ph:arrow-clockwise" onClick={reloadPreview} />
        <div
          className="flex items-center gap-1 flex-grow bg-bolt-elements-preview-addressBar-background border border-bolt-elements-borderColor text-bolt-elements-preview-addressBar-text rounded-full px-3 py-1 text-sm hover:bg-bolt-elements-preview-addressBar-backgroundHover hover:focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within:bg-bolt-elements-preview-addressBar-backgroundActive
        focus-within-border-bolt-elements-borderColorActive focus-within:text-bolt-elements-preview-addressBar-textActive"
        >
          <input
            ref={inputRef}
            className="w-full bg-transparent outline-none"
            type="text"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && validateUrl(url)) {
                setIframeUrl(url);

                if (inputRef.current) {
                  inputRef.current.blur();
                }
              }
            }}
          />
        </div>
        {previews.length > 1 && (
          <PortDropdown
            activePreviewIndex={activePreviewIndex}
            setActivePreviewIndex={setActivePreviewIndex}
            isDropdownOpen={isPortDropdownOpen}
            setHasSelectedPreview={(value) => (hasSelectedPreview.current = value)}
            setIsDropdownOpen={setIsPortDropdownOpen}
            previews={previews}
          />
        )}
      </div>
      <div className="flex-1 border-t border-bolt-elements-borderColor flex flex-col overflow-hidden">
        <PreviewTelemetryPanel port={activePort} />
        <div className="flex-1">
          {activePreview ? (
            <iframe
              ref={iframeRef}
              className="border-none w-full h-full bg-white"
              src={iframeUrl}
              onLoad={handleIframeLoad}
            />
          ) : (
            <div className="flex w-full h-full justify-center items-center bg-white">No preview available</div>
          )}
        </div>
      </div>
    </div>
  );
});
