import { useStore } from '@nanostores/react';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { workbenchStore } from '~/lib/stores/workbench';

export function DeployDialog() {
  const open = useStore(workbenchStore.deployDialogOpen);
  const deployment = useStore(workbenchStore.deploymentState);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setLocalError(null);
    }
  }, [open]);

  useEffect(() => {
    if (deployment.status !== 'error') {
      setLocalError(null);
    }
  }, [deployment.status]);

  const deploymentError = useMemo(() => {
    if (deployment.status !== 'error') {
      return null;
    }

    return deployment.error ?? 'Deployment failed. Please try again.';
  }, [deployment.error, deployment.status]);

  const handleClose = () => {
    workbenchStore.setDeployDialogOpen(false);
  };

  const handleDeploy = async () => {
    setIsSubmitting(true);
    setLocalError(null);

    try {
      await workbenchStore.requestDeployment();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start deployment';
      setLocalError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const unsavedFilesCount = useMemo(() => unsavedFiles.size, [unsavedFiles]);

  return (
    <DialogRoot open={open}>
      <Dialog onBackdrop={handleClose} onClose={handleClose}>
        <DialogTitle>Deploy Preview</DialogTitle>
        <DialogDescription>
          <div className="space-y-3 text-sm leading-relaxed">
            <p>
              Trigger a temporary deployment to generate a live preview URL. Figplit will build the current project
              using your saved files.
            </p>
            {unsavedFilesCount > 0 && (
              <p className="text-amber-500">
                You have {unsavedFilesCount} unsaved {unsavedFilesCount === 1 ? 'file' : 'files'}. Save them before
                deploying to ensure the preview is up to date.
              </p>
            )}
            {(localError || deploymentError) && <p className="text-rose-500">{localError ?? deploymentError}</p>}
          </div>
        </DialogDescription>
        <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
          <DialogButton type="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </DialogButton>
          <DialogButton type="primary" onClick={handleDeploy} disabled={isSubmitting}>
            <span className="inline-flex items-center gap-2">
              {isSubmitting && <span className="i-svg-spinners:90-ring-with-bg text-base" />}
              <span>{isSubmitting ? 'Starting deployment…' : 'Deploy'}</span>
            </span>
          </DialogButton>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
