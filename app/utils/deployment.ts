export type NormalizedDeploymentStatus = 'queued' | 'building' | 'success' | 'error';

export interface NormalizedDeploymentResponse {
  deploymentId?: string;
  status?: NormalizedDeploymentStatus;
  previewUrl?: string;
  error?: string;
}

const statusAliases = new Map<string, NormalizedDeploymentStatus>([
  ['queued', 'queued'],
  ['pending', 'queued'],
  ['waiting', 'queued'],
  ['enqueued', 'queued'],
  ['building', 'building'],
  ['processing', 'building'],
  ['in-progress', 'building'],
  ['deploying', 'building'],
  ['running', 'building'],
  ['success', 'success'],
  ['completed', 'success'],
  ['finished', 'success'],
  ['active', 'success'],
  ['ready', 'success'],
  ['live', 'success'],
  ['error', 'error'],
  ['failed', 'error'],
  ['failure', 'error'],
  ['canceled', 'error'],
  ['cancelled', 'error'],
]);

export function mapExternalDeploymentStatus(value: unknown): NormalizedDeploymentStatus | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  return statusAliases.get(normalized);
}

export function normalizeExternalDeploymentPayload(payload: unknown): NormalizedDeploymentResponse {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const candidates = collectCandidateObjects(payload);

  const deploymentId = firstString(
    candidates.flatMap((candidate) => [candidate.deploymentId, candidate.deployment_id, candidate.id]),
  );

  const previewUrl = firstString(
    candidates.flatMap((candidate) => {
      const aliases = Array.isArray(candidate.aliases) ? candidate.aliases : [];
      return [
        candidate.previewUrl,
        candidate.preview_url,
        candidate.url,
        candidate.host,
        candidate.preview,
        ...aliases,
      ];
    }),
  );

  const status = candidates
    .flatMap((candidate) => [candidate.status, candidate.state, candidate.stage?.status])
    .map(mapExternalDeploymentStatus)
    .find((value): value is NormalizedDeploymentStatus => Boolean(value));

  const error = firstString(candidates.flatMap((candidate) => [candidate.error, candidate.message, candidate.reason]));

  return {
    deploymentId,
    status,
    previewUrl,
    error,
  };
}

export function shouldPollDeploymentStatus(status?: NormalizedDeploymentStatus) {
  return status === 'queued' || status === 'building';
}

function collectCandidateObjects(payload: object) {
  const candidates: Array<Record<string, any>> = [];

  const push = (value: unknown) => {
    if (value && typeof value === 'object') {
      candidates.push(value as Record<string, any>);
    }
  };

  push(payload);
  push((payload as any).result);
  push((payload as any).deployment);
  push((payload as any).deployment_trigger);
  push((payload as any).deploymentTrigger);
  push((payload as any).deployment_stage);
  push((payload as any).latest_stage);

  return candidates;
}

function firstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return undefined;
}
