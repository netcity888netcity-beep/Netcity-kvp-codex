export interface ToolState {
  installed: boolean;
  version: string | null;
  path: string | null;
}

export interface OpsAction {
  id: string;
  label: string;
  detail: string;
  risk: 'read-only' | 'build' | 'desktop';
}

export interface OpsActionResult {
  id: string;
  success: boolean;
  exit_code: number;
  output: string;
  started_at: string;
  finished_at: string;
}

export interface OpsTelemetry {
  generated_at: string;
  host: {
    computer_name: string;
    os: string;
    model: string;
  };
  compute: {
    cpu_name: string;
    cores: number;
    threads: number;
    load_percent: number;
    memory_total_gb: number;
    memory_used_gb: number;
    memory_used_percent: number;
  };
  storage: {
    drive: string;
    free_gb: number;
    total_gb: number;
    free_percent: number;
  };
  network: {
    primary: string;
    link_speed: string;
    tunnel: string;
    listeners: number;
    external_connections: number;
  };
  security: {
    firewall_enabled: boolean;
    defender_enabled: boolean;
    real_time_protection: boolean;
    tamper_protection: boolean;
    signature_version: string;
    signature_updated: string | null;
    quick_scan: string | null;
    full_scan: string | null;
    historical_tasks_present: number;
    exclusions_require_admin_review: boolean;
  };
  toolchain: Record<string, ToolState>;
  project: {
    branch: string;
    dirty_files: number;
    last_commit: string;
    root: string;
  };
  actions: OpsAction[];
}

export async function readOpsTelemetry(signal?: AbortSignal): Promise<OpsTelemetry> {
  const response = await fetch('/api/telemetry', {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Ops service returned HTTP ${response.status}`);
  return response.json() as Promise<OpsTelemetry>;
}

export async function runOpsAction(actionId: string): Promise<OpsActionResult> {
  if (!/^[a-z.]+$/.test(actionId)) throw new Error('Недопустимый идентификатор сценария.');
  const response = await fetch(`/api/actions/${encodeURIComponent(actionId)}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const value = await response.json() as OpsActionResult & { error?: string };
  if (!response.ok) throw new Error(value.error ?? `Ops action returned HTTP ${response.status}`);
  return value;
}
