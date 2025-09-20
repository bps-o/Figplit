import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { normalizeExternalDeploymentPayload, type NormalizedDeploymentResponse } from '~/utils/deployment';

export async function action({ context, request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const { DEPLOY_HOOK_URL } = context.cloudflare.env;

  if (!DEPLOY_HOOK_URL) {
    return json({ error: 'Deploy hook is not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(DEPLOY_HOOK_URL, { method: 'POST' });

    if (!response.ok) {
      const message = await safeReadText(response);
      return json({ error: 'Failed to trigger deployment', details: message }, { status: 502 });
    }

    const payload = await safeReadJson(response);
    const normalized = normalizeExternalDeploymentPayload(payload);

    const status = normalized.status ?? (normalized.previewUrl ? 'success' : 'queued');

    const result: NormalizedDeploymentResponse = {
      ...normalized,
      status,
    };

    return json(result, { status: 200 });
  } catch (error) {
    console.error('Deployment hook failed', error);

    return json({ error: 'Failed to trigger deployment' }, { status: 500 });
  }
}

export async function loader({ context, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const deploymentId = url.searchParams.get('deploymentId');

  if (!deploymentId) {
    return json({ error: 'deploymentId is required' }, { status: 400 });
  }

  const { DEPLOY_STATUS_URL, DEPLOY_STATUS_TOKEN } = context.cloudflare.env;

  if (!DEPLOY_STATUS_URL) {
    return json({ error: 'Deployment status URL is not configured' }, { status: 500 });
  }

  const statusUrl = buildStatusUrl(DEPLOY_STATUS_URL, deploymentId);

  try {
    const response = await fetch(statusUrl, {
      headers: DEPLOY_STATUS_TOKEN ? { Authorization: `Bearer ${DEPLOY_STATUS_TOKEN}` } : undefined,
    });

    if (!response.ok) {
      const message = await safeReadText(response);
      return json({ error: message || 'Failed to fetch deployment status' }, { status: response.status });
    }

    const payload = await safeReadJson(response);
    const normalized = normalizeExternalDeploymentPayload(payload);

    const status = normalized.status ?? 'queued';
    const result: NormalizedDeploymentResponse = {
      ...normalized,
      deploymentId: normalized.deploymentId ?? deploymentId,
      status,
    };

    return json(result, { status: 200 });
  } catch (error) {
    console.error('Failed to poll deployment status', error);

    return json({ error: 'Failed to fetch deployment status' }, { status: 500 });
  }
}

async function safeReadJson(response: Response) {
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.toLowerCase().includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function buildStatusUrl(baseUrl: string, deploymentId: string) {
  const url = new URL(baseUrl);
  const normalizedPath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
  url.pathname = `${normalizedPath}/${encodeURIComponent(deploymentId)}`;

  return url.toString();
}
