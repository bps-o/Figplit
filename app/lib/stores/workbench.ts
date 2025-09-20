import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal } from '~/types/terminal';
import { unreachable } from '~/utils/unreachable';
import {
  normalizeExternalDeploymentPayload,
  shouldPollDeploymentStatus,
  type NormalizedDeploymentResponse,
  type NormalizedDeploymentStatus,
} from '~/utils/deployment';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'preview';

export type DeploymentStatus = 'idle' | 'triggering' | 'queued' | 'building' | 'success' | 'error';

export interface DeploymentState {
  status: DeploymentStatus;
  deploymentId?: string;
  previewUrl?: string;
  error?: string;
  updatedAt: number;
}

const DEPLOYMENT_POLL_INTERVAL = 5000;

function createInitialDeploymentState(): DeploymentState {
  return {
    status: 'idle',
    updatedAt: Date.now(),
  };
}

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);
  #deploymentPollTimeout?: ReturnType<typeof setTimeout>;
  #deploymentPollController?: AbortController;

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  deployDialogOpen: WritableAtom<boolean> = import.meta.hot?.data.deployDialogOpen ?? atom(false);
  githubDialogOpen: WritableAtom<boolean> = import.meta.hot?.data.githubDialogOpen ?? atom(false);
  deploymentState: WritableAtom<DeploymentState> =
    import.meta.hot?.data.deploymentState ?? atom(createInitialDeploymentState());
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
      import.meta.hot.data.deployDialogOpen = this.deployDialogOpen;
      import.meta.hot.data.githubDialogOpen = this.githubDialogOpen;
      import.meta.hot.data.deploymentState = this.deploymentState;
    }
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  get files() {
    return this.#filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setDeployDialogOpen(open: boolean) {
    this.deployDialogOpen.set(open);
  }

  setGitHubDialogOpen(open: boolean) {
    this.githubDialogOpen.set(open);
  }

  resetDeploymentState() {
    this.cancelDeploymentPolling();
    this.deploymentState.set(createInitialDeploymentState());
  }

  dismissDeployment() {
    this.resetDeploymentState();
  }

  cancelDeploymentPolling() {
    if (this.#deploymentPollTimeout) {
      clearTimeout(this.#deploymentPollTimeout);
      this.#deploymentPollTimeout = undefined;
    }

    if (this.#deploymentPollController) {
      this.#deploymentPollController.abort();
      this.#deploymentPollController = undefined;
    }
  }

  resumeDeploymentPolling() {
    const state = this.deploymentState.get();

    if (!state.deploymentId) {
      return;
    }

    if (!shouldPollDeploymentStatus(toNormalizedDeploymentStatus(state.status))) {
      return;
    }

    if (this.#deploymentPollTimeout) {
      return;
    }

    this.#scheduleDeploymentPoll(0);
  }

  async requestDeployment() {
    this.cancelDeploymentPolling();

    this.deploymentState.set({
      status: 'triggering',
      deploymentId: undefined,
      previewUrl: undefined,
      error: undefined,
      updatedAt: Date.now(),
    });

    try {
      const response = await fetch('/api/deploy', { method: 'POST' });

      if (!response.ok) {
        const message = await safeReadText(response);
        throw new Error(message || `Deployment request failed (${response.status})`);
      }

      const payload = (await safeReadJson(response)) as NormalizedDeploymentResponse;
      const previousState = this.deploymentState.get();
      const nextState = this.#normalizeDeploymentState(payload, previousState);

      this.deploymentState.set(nextState);
      this.deployDialogOpen.set(false);

      if (shouldPollDeploymentStatus(toNormalizedDeploymentStatus(nextState.status))) {
        this.#scheduleDeploymentPoll();
      }

      return nextState;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start deployment';

      this.deploymentState.set({
        status: 'error',
        error: message,
        updatedAt: Date.now(),
      });

      throw error;
    }
  }

  async pollDeploymentStatus(signal?: AbortSignal) {
    const state = this.deploymentState.get();
    const deploymentId = state.deploymentId;

    if (!deploymentId) {
      this.cancelDeploymentPolling();
      return;
    }

    try {
      const response = await fetch(`/api/deploy?deploymentId=${encodeURIComponent(deploymentId)}`, { signal });

      if (!response.ok) {
        const message = await safeReadText(response);
        throw new Error(message || `Failed to poll deployment status (${response.status})`);
      }

      const payload = (await safeReadJson(response)) as NormalizedDeploymentResponse;
      const nextState = this.#normalizeDeploymentState(payload, state);

      this.deploymentState.set(nextState);

      if (shouldPollDeploymentStatus(toNormalizedDeploymentStatus(nextState.status))) {
        this.#scheduleDeploymentPoll();
      } else {
        this.cancelDeploymentPolling();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      const message = error instanceof Error ? error.message : 'Failed to poll deployment status';

      this.deploymentState.set({
        ...state,
        status: 'error',
        error: message,
        updatedAt: Date.now(),
      });

      this.cancelDeploymentPolling();
    }
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.#filesStore.getFileModifications();
  }

  getChangedFiles() {
    const modifications = this.#filesStore.getFileModifications();

    if (!modifications) {
      return [] as Array<{ path: string; content: string; isBinary: boolean }>;
    }

    const files = this.#filesStore.files.get();
    const changed: Array<{ path: string; content: string; isBinary: boolean }> = [];

    for (const filePath of Object.keys(modifications)) {
      const entry = files[filePath];

      if (entry?.type !== 'file') {
        continue;
      }

      changed.push({ path: filePath, content: entry.content, isBinary: entry.isBinary });
    }

    return changed;
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  abortAllActions() {
    const artifacts = this.artifacts.get();

    for (const artifact of Object.values(artifacts)) {
      artifact.runner.abortAll();
    }
  }

  addArtifact({ messageId, title, id }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
      runner: new ActionRunner(webcontainer),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async addAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.addAction(data);
  }

  async runAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.runAction(data);
  }

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  #scheduleDeploymentPoll(delay = DEPLOYMENT_POLL_INTERVAL) {
    this.cancelDeploymentPolling();

    const controller = new AbortController();

    this.#deploymentPollController = controller;
    this.#deploymentPollTimeout = setTimeout(() => {
      this.pollDeploymentStatus(controller.signal).catch(() => {
        // polling errors are handled in pollDeploymentStatus
      });
    }, delay);
  }

  #normalizeDeploymentState(response: NormalizedDeploymentResponse, previous: DeploymentState): DeploymentState {
    const normalized = normalizeExternalDeploymentPayload(response);
    const status = resolveDeploymentStatus(normalized.status, previous.status);

    return {
      status,
      deploymentId: normalized.deploymentId ?? previous.deploymentId,
      previewUrl: normalized.previewUrl ?? previous.previewUrl,
      error: normalized.error,
      updatedAt: Date.now(),
    };
  }
}

export const workbenchStore = new WorkbenchStore();

async function safeReadJson(response: Response) {
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.toLowerCase().includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function resolveDeploymentStatus(
  status: DeploymentStatus | NormalizedDeploymentStatus | undefined,
  previous: DeploymentStatus,
): DeploymentStatus {
  if (status === undefined || status === null) {
    return previous === 'triggering' ? 'queued' : previous;
  }

  if (
    status === 'idle' ||
    status === 'triggering' ||
    status === 'queued' ||
    status === 'building' ||
    status === 'success' ||
    status === 'error'
  ) {
    return status;
  }

  return previous === 'triggering' ? 'queued' : previous;
}

function toNormalizedDeploymentStatus(status: DeploymentStatus | undefined): NormalizedDeploymentStatus | undefined {
  if (status === 'queued' || status === 'building' || status === 'success' || status === 'error') {
    return status;
  }

  return undefined;
}
