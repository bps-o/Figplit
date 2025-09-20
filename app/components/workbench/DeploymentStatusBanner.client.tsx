import { useStore } from '@nanostores/react';
import { useEffect } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';

const statusMessages = {
  triggering: 'Starting deployment…',
  queued: 'Deployment queued. Waiting for the build to begin…',
  building: 'Deployment in progress. Hang tight while we generate your preview…',
  success: 'Preview deployed successfully.',
  error: 'Deployment failed.',
} as const;

const statusIcons = {
  triggering: 'i-svg-spinners:90-ring-with-bg',
  queued: 'i-svg-spinners:90-ring-with-bg',
  building: 'i-svg-spinners:90-ring-with-bg',
  success: 'i-ph:check-circle-duotone',
  error: 'i-ph:warning-octagon-duotone',
} as const;

const accentClasses = {
  triggering: 'text-bolt-elements-textSecondary',
  queued: 'text-bolt-elements-textSecondary',
  building: 'text-bolt-elements-textSecondary',
  success: 'text-emerald-400',
  error: 'text-rose-500',
} as const;

export function DeploymentStatusBanner() {
  const deployment = useStore(workbenchStore.deploymentState);

  useEffect(() => {
    workbenchStore.resumeDeploymentPolling();
  }, []);

  if (deployment.status === 'idle') {
    return null;
  }

  const status = deployment.status === 'triggering' ? 'triggering' : deployment.status;
  const message = statusMessages[status];
  const icon = statusIcons[status];
  const accent = accentClasses[status];

  return (
    <div
      className={classNames(
        'ml-3 flex items-center gap-2 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 px-3 py-1.5 text-sm text-bolt-elements-textSecondary shadow-sm',
        {
          'border-emerald-500/40 text-emerald-200': status === 'success',
          'border-rose-500/40 text-rose-200': status === 'error',
        },
      )}
    >
      <div className={classNames('text-base', accent, icon)} />
      <span className="flex-1">
        {status === 'error' && deployment.error ? `${message} ${deployment.error}` : message}
      </span>
      {deployment.previewUrl && status === 'success' && (
        <a
          href={deployment.previewUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-bolt-elements-item-contentAccent underline-offset-4 hover:underline"
        >
          Open preview
        </a>
      )}
      <IconButton
        icon="i-ph:x"
        size="md"
        onClick={() => {
          workbenchStore.dismissDeployment();
        }}
      />
    </div>
  );
}
