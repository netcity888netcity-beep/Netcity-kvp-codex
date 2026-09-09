import type { StudioCatalog } from './studio-api';

export interface StudioProviderSettingsRequest {
  provider_id: string;
  api_key?: string;
  endpoint?: string;
  models?: string[];
  enabled?: boolean;
}

export interface StudioProviderSettingsResponse {
  ok: true;
  provider_id: string;
  catalog: StudioCatalog;
}

export async function saveStudioProviderSettings(
  request: StudioProviderSettingsRequest,
): Promise<StudioProviderSettingsResponse> {
  const response = await fetch('/api/studio/settings', {
    method: 'POST',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const value = await response.json() as StudioProviderSettingsResponse & { error?: string };
  if (!response.ok) throw new Error(value.error ?? `Provider settings returned HTTP ${response.status}`);
  return value;
}
