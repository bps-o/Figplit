import type { ArtifactState } from '~/lib/stores/workbench';
import { WORK_DIR } from './constants';

interface ChangedFileSummary {
  path: string;
  isBinary: boolean;
}

interface ForkSummaryInput {
  artifacts: ArtifactState[];
  changedFiles: ChangedFileSummary[];
  originalUrlId?: string;
}

export interface ForkSummaryResult {
  displayText: string;
  message: string;
  description: string;
}

export function createForkSummary({ artifacts, changedFiles, originalUrlId }: ForkSummaryInput): ForkSummaryResult {
  const artifactItems = Array.from(
    new Set(
      artifacts
        .map((artifact) => artifact.title?.trim())
        .filter((title): title is string => Boolean(title)),
    ),
  );

  const fileItems = changedFiles.map((file) => {
    const relativePath = toRelativePath(file.path);
    return file.isBinary ? `Binary asset updated: ${relativePath}` : `Updated ${relativePath}`;
  });

  const bulletItems = [...artifactItems, ...fileItems];

  if (bulletItems.length === 0) {
    bulletItems.push('No tracked Figplit artifacts or file deltas were found.');
  }

  const displayText = bulletItems.map((item) => `• ${item}`).join('\n');

  const summaryHeader = originalUrlId
    ? `Forked from Figplit chat ${originalUrlId}.`
    : 'Forked from the previous Figplit conversation.';

  const bulletBlock = bulletItems.map((item) => `- ${item}`).join('\n');

  const message = `${summaryHeader}\n\nSummary of changes so far:\n${bulletBlock}\n\nPlease continue iterating from here with this context.`;

  const description = artifactItems[0] ?? 'Forked Figplit session';

  return { displayText, message, description };
}

function toRelativePath(path: string) {
  if (path.startsWith(`${WORK_DIR}/`)) {
    return path.slice(WORK_DIR.length + 1);
  }

  if (path.startsWith(WORK_DIR)) {
    return path.slice(WORK_DIR.length);
  }

  return path;
}
