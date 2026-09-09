export type StudioBoundary = 'local' | 'remote';
export type StudioStatus = 'ready' | 'online' | 'configured' | 'offline' | 'credential_missing' | 'disabled';
export type StudioClassification = 'public' | 'internal' | 'sensitive';

export interface StudioModel {
  id: string;
  label: string;
}

export interface StudioProvider {
  id: string;
  label: string;
  kind: string;
  boundary: StudioBoundary;
  endpoint: string | null;
  credential_env: string | null;
  credential_configured: boolean;
  enabled: boolean;
  status: StudioStatus;
  status_detail: string;
  models: StudioModel[];
}

export interface StudioMode {
  id: string;
  label: string;
  description: string;
}

export interface StudioVector {
  id: string;
  label: string;
}

export interface StudioCatalog {
  generated_at: string;
  sensitive_data_policy: 'local_only';
  providers: StudioProvider[];
  modes: StudioMode[];
  vectors: StudioVector[];
}

export interface StudioRunRequest {
  provider_id: string;
  model_id: string;
  mode_id: string;
  vector_id: string;
  vector_note: string;
  data_classification: StudioClassification;
  project_context: boolean;
  prompt: string;
}

export interface StudioRunResponse {
  ok: true;
  request_id: string;
  provider_id: string;
  provider_label: string;
  model_id: string;
  mode_id: string;
  vector_id: string;
  boundary: StudioBoundary;
  data_classification: StudioClassification;
  content: string;
  usage: Record<string, unknown> | null;
  latency_ms: number;
  warnings: string[];
}

export async function readStudioCatalog(signal?: AbortSignal): Promise<StudioCatalog> {
  const response = await fetch('/api/studio/catalog', {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });
  const value = await response.json() as StudioCatalog & { error?: string };
  if (!response.ok) throw new Error(value.error ?? `Studio catalog returned HTTP ${response.status}`);
  return value;
}

export async function runStudio(request: StudioRunRequest): Promise<StudioRunResponse> {
  const response = await fetch('/api/studio/run', {
    method: 'POST',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const value = await response.json() as StudioRunResponse & { error?: string };
  if (!response.ok) throw new Error(value.error ?? `Studio run returned HTTP ${response.status}`);
  return value;
}
