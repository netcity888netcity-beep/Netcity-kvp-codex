import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  CloudCog,
  Cpu,
  Database,
  ExternalLink,
  Gauge,
  HardDrive,
  Layers3,
  MemoryStick,
  Network,
  Play,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  TerminalSquare,
  Wifi,
  XCircle,
} from 'lucide-react';
import {
  readOpsTelemetry,
  runOpsAction,
  type OpsAction,
  type OpsActionResult,
  type OpsTelemetry,
  type ToolState,
} from './ops-api';

const fallbackActions: OpsAction[] = [
  { id: 'audit.snapshot', label: 'Снимок аудита', detail: 'Сохранить read-only JSON отчёт', risk: 'read-only' },
  { id: 'project.checks', label: 'Проверки проекта', detail: 'cargo test, fmt, clippy и buf lint', risk: 'build' },
  { id: 'admin.build', label: 'Собрать Admin UI', detail: 'TypeScript и Vite production build', risk: 'build' },
  { id: 'open.project', label: 'Открыть проект', detail: 'Показать репозиторий в проводнике', risk: 'desktop' },
];

const toolLabels: Record<string, string> = {
  rust: 'Rust',
  cargo: 'Cargo',
  node: 'Node.js',
  npm: 'npm',
  python: 'Python',
  buf: 'Buf',
  git: 'Git',
  docker: 'Docker',
  github: 'GitHub CLI',
};

interface OpsDashboardProps {
  onExit?: () => void;
}

function formatAge(value: string | null | undefined): string {
  if (!value) return 'нет данных';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function shortVersion(value: ToolState): string {
  if (!value.installed) return 'не найден';
  if (!value.version) return 'установлен';
  return value.version.replace(/^v/, '').slice(0, 28);
}

function meterColor(value: number, inverted = false): string {
  const danger = inverted ? value < 20 : value > 85;
  const caution = inverted ? value < 35 : value > 70;
  return danger ? 'danger' : caution ? 'caution' : 'good';
}

function Sparkline({ samples }: { samples: number[] }) {
  const points = samples.length > 1 ? samples : [0, 0];
  const max = Math.max(100, ...points);
  const min = Math.min(0, ...points);
  const range = Math.max(1, max - min);
  const path = points.map((value, index) => {
    const x = (index / (points.length - 1)) * 300;
    const y = 88 - ((value - min) / range) * 68;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg className="ops-sparkline" viewBox="0 0 300 96" role="img" aria-label="История нагрузки процессора">
      <title>История нагрузки процессора</title>
      <path className="ops-sparkline-grid" d="M0 20H300M0 54H300M0 88H300" />
      <path className="ops-sparkline-line" d={path} />
    </svg>
  );
}

export default function OpsDashboard({ onExit }: OpsDashboardProps) {
  const [telemetry, setTelemetry] = useState<OpsTelemetry | null>(null);
  const [samples, setSamples] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OpsActionResult | null>(null);
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    // Telemetry collection can take several seconds on Windows. Never queue
    // overlapping requests on the single-threaded local gateway.
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const value = await readOpsTelemetry(signal);
      setTelemetry(value);
      setSamples((current) => [...current, value.compute.load_percent].slice(-24));
      setError('');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Локальный ops-сервис недоступен.');
    } finally {
      refreshInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => { void refresh(); }, 12000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  const actions = telemetry?.actions ?? fallbackActions;
  const toolEntries = useMemo(() => Object.entries(telemetry?.toolchain ?? {}), [telemetry]);
  const systemHealth = telemetry
    ? telemetry.security.firewall_enabled && telemetry.security.defender_enabled && telemetry.security.real_time_protection
    : false;

  const handleAction = async (action: OpsAction) => {
    if (runningAction) return;
    if (action.risk !== 'read-only' && !window.confirm(`Запустить сценарий «${action.label}»? Он выполнит только команды из локального allowlist.`)) return;
    setRunningAction(action.id);
    setLastResult(null);
    try {
      setLastResult(await runOpsAction(action.id));
      await refresh();
    } catch (cause) {
      setLastResult({
        id: action.id,
        success: false,
        exit_code: 1,
        output: cause instanceof Error ? cause.message : 'Сценарий не выполнен.',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      });
    } finally {
      setRunningAction(null);
    }
  };

  const cpuLoad = telemetry?.compute.load_percent ?? 0;
  const memoryLoad = telemetry?.compute.memory_used_percent ?? 0;
  const diskFree = telemetry?.storage.free_percent ?? 0;

  return (
    <section className="ops-shell" aria-label="Операционный HUD NetCity KVP">
      <div className="ops-ambient ops-ambient-one" aria-hidden="true" />
      <div className="ops-ambient ops-ambient-two" aria-hidden="true" />
      <header className="ops-command-bar">
        <div>
          <div className="eyebrow">NETCITY–KVP · LOCAL OPERATIONS HUD</div>
          <h2>Материальный контур</h2>
          <p>Телеметрия, инструменты и автоматизация проекта на одном локальном слое.</p>
        </div>
        <div className="ops-command-actions">
          <span className={`ops-live ${error ? 'offline' : 'online'}`}><i />{error ? 'BRIDGE OFFLINE' : 'LIVE · 12 SEC'}</span>
          <button className="ops-icon-button" onClick={() => void refresh()} aria-label="Обновить телеметрию" data-tooltip="Обновить телеметрию">
            <RefreshCw size={17} className={loading ? 'ops-spin' : ''} />
          </button>
          {onExit && <button className="ops-exit" onClick={onExit}>Вернуться в контур</button>}
        </div>
      </header>

      {error && (
        <div className="ops-alert" role="alert"><AlertTriangle size={17} /><span>{error}. Запустите локальный ops-сервис через `npm run ops`.</span><button onClick={() => setError('')} aria-label="Закрыть предупреждение"><XCircle size={16} /></button></div>
      )}

      <div className="ops-metric-grid">
        <article className="ops-metric">
          <div className="ops-metric-top"><span>CPU / LOAD</span><Cpu size={17} /></div>
          <strong>{telemetry ? `${cpuLoad}%` : '—'}</strong>
          <div className="ops-meter"><span className={meterColor(cpuLoad)} style={{ width: `${Math.min(100, cpuLoad)}%` }} /></div>
          <small>{telemetry?.compute.cores ?? '—'} cores · {telemetry?.compute.threads ?? '—'} threads</small>
        </article>
        <article className="ops-metric">
          <div className="ops-metric-top"><span>MEMORY / USED</span><MemoryStick size={17} /></div>
          <strong>{telemetry ? `${memoryLoad}%` : '—'}</strong>
          <div className="ops-meter"><span className={meterColor(memoryLoad)} style={{ width: `${Math.min(100, memoryLoad)}%` }} /></div>
          <small>{telemetry ? `${telemetry.compute.memory_used_gb} / ${telemetry.compute.memory_total_gb} GB` : 'ожидание данных'}</small>
        </article>
        <article className="ops-metric">
          <div className="ops-metric-top"><span>STORAGE / FREE</span><HardDrive size={17} /></div>
          <strong>{telemetry ? `${diskFree}%` : '—'}</strong>
          <div className="ops-meter"><span className={meterColor(diskFree, true)} style={{ width: `${Math.min(100, diskFree)}%` }} /></div>
          <small>{telemetry ? `${telemetry.storage.free_gb} GB on ${telemetry.storage.drive}` : 'ожидание данных'}</small>
        </article>
        <article className={`ops-metric ops-metric-health ${systemHealth ? 'healthy' : ''}`}>
          <div className="ops-metric-top"><span>SECURITY / STATE</span><ShieldCheck size={17} /></div>
          <strong>{telemetry ? (systemHealth ? 'ARMED' : 'REVIEW') : '—'}</strong>
          <div className="ops-state-line"><span className={systemHealth ? 'ops-state-dot good' : 'ops-state-dot caution'} />{telemetry?.security.exclusions_require_admin_review ? 'нужен admin review' : 'Defender + firewall'}</div>
          <small>sig {telemetry?.security.signature_version ?? '—'}</small>
        </article>
      </div>

      <div className="ops-grid-main">
        <section className="ops-panel ops-core-panel">
          <div className="ops-panel-heading">
            <div><span className="ops-kicker">CORE SIGNAL</span><h3>Пульс рабочей станции</h3></div>
            <span className="ops-badge"><Activity size={13} /> {telemetry ? formatAge(telemetry.generated_at) : 'syncing'}</span>
          </div>
          <div className="ops-core-visual">
            <div className="ops-core-orbit"><div className="ops-core-ring ring-one" /><div className="ops-core-ring ring-two" /><div className="ops-core-ring ring-three" /><span>{telemetry ? `${cpuLoad}%` : '—'}</span><small>CPU LOAD</small></div>
            <div className="ops-signal-copy"><strong>{telemetry?.host.computer_name ?? 'DESKTOP / LINKING'}</strong><p>{telemetry?.host.model ?? 'Локальный сенсор ожидает ops-сервис.'}</p><div className="ops-signal-facts"><span><Gauge size={14} /> {telemetry?.network.listeners ?? '—'} listeners</span><span><Network size={14} /> {telemetry?.network.external_connections ?? '—'} external</span><span><Wifi size={14} /> {telemetry?.network.tunnel ?? '—'}</span></div></div>
          </div>
          <div className="ops-chart-wrap"><div className="ops-chart-label"><span>CPU / последние 2 минуты</span><b>{telemetry ? `${cpuLoad}% now` : 'нет связи'}</b></div><Sparkline samples={samples} /></div>
        </section>

        <section className="ops-panel ops-security-panel">
          <div className="ops-panel-heading"><div><span className="ops-kicker">TRUST BOUNDARY</span><h3>Защитный периметр</h3></div><ShieldCheck size={18} /></div>
          <div className="ops-security-list">
            <div><span className="ops-check-icon"><Check size={15} /></span><span><b>Windows Firewall</b><small>входящий трафик: block by default</small></span><em className={telemetry?.security.firewall_enabled ? 'good' : 'muted'}>{telemetry?.security.firewall_enabled ? 'ON' : '—'}</em></div>
            <div><span className="ops-check-icon"><Check size={15} /></span><span><b>Defender runtime</b><small>real-time + behavior monitor</small></span><em className={telemetry?.security.real_time_protection ? 'good' : 'muted'}>{telemetry?.security.real_time_protection ? 'ON' : '—'}</em></div>
            <div><span className="ops-check-icon"><ScanSearch size={15} /></span><span><b>Quick scan</b><small>последнее выполнение</small></span><em>{formatAge(telemetry?.security.quick_scan)}</em></div>
            <div><span className="ops-check-icon"><AlertTriangle size={15} /></span><span><b>Historical tasks</b><small>индикаторы из security incident</small></span><em className={telemetry?.security.historical_tasks_present ? 'danger' : 'good'}>{telemetry ? telemetry.security.historical_tasks_present : '—'}</em></div>
          </div>
          <div className="ops-security-foot"><span className={telemetry?.security.exclusions_require_admin_review ? 'caution' : 'good'}><Circle size={9} fill="currentColor" /> {telemetry?.security.exclusions_require_admin_review ? 'Defender exclusions: требуется elevated review' : 'Exclusions: проверено'}</span></div>
        </section>
      </div>

      <section className="ops-panel ops-toolchain-panel">
        <div className="ops-panel-heading"><div><span className="ops-kicker">TOOLCHAIN MATRIX</span><h3>Инструменты проекта</h3></div><span className="ops-panel-note">{telemetry?.project.branch ?? 'branch —'} · {telemetry?.project.dirty_files ?? '—'} dirty files</span></div>
        <div className="ops-tool-grid">{toolEntries.length ? toolEntries.map(([id, tool]) => <div className="ops-tool" key={id}><span className={`ops-tool-icon ${tool.installed ? 'installed' : ''}`}>{tool.installed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}</span><span><b>{toolLabels[id] ?? id}</b><small>{shortVersion(tool)}</small></span><i>{tool.installed ? 'READY' : 'MISSING'}</i></div>) : <div className="ops-empty">Сервис ещё не передал матрицу инструментов.</div>}</div>
      </section>

      <div className="ops-grid-bottom">
        <section className="ops-panel ops-project-panel">
          <div className="ops-panel-heading"><div><span className="ops-kicker">PROJECT MEMORY</span><h3>Состояние KVP</h3></div><Layers3 size={18} /></div>
          <div className="ops-project-summary"><div><span>workspace</span><b>{telemetry?.project.root ?? 'D:\\project-auto\\Netcity-kvp-codex'}</b></div><div><span>last commit</span><b>{telemetry?.project.last_commit ?? 'ожидание git'}</b></div><div><span>network</span><b>{telemetry?.network.primary ?? '—'} · {telemetry?.network.link_speed ?? '—'}</b></div></div>
          <div className="ops-material-note"><Database size={16} /><span><b>Состояние сохраняется локально</b><small>Панель не отправляет телеметрию во внешние сервисы.</small></span></div>
        </section>

        <section className="ops-panel ops-actions-panel">
          <div className="ops-panel-heading"><div><span className="ops-kicker">AUTOMATION DECK</span><h3>Сценарии управления</h3></div><TerminalSquare size={18} /></div>
          <div className="ops-action-list">{actions.map((action) => <button key={action.id} className="ops-action" onClick={() => void handleAction(action)} disabled={Boolean(runningAction)}><span className="ops-action-icon">{runningAction === action.id ? <RefreshCw size={16} className="ops-spin" /> : action.risk === 'desktop' ? <ExternalLink size={16} /> : action.risk === 'build' ? <Play size={16} /> : <ScanSearch size={16} />}</span><span><b>{action.label}</b><small>{action.detail}</small></span><em className={action.risk}>{action.risk === 'read-only' ? 'SAFE' : action.risk === 'build' ? 'BUILD' : 'LOCAL'}</em></button>)}</div>
          {lastResult && <div className={`ops-result ${lastResult.success ? 'success' : 'failure'}`}><span>{lastResult.success ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}<b>{lastResult.success ? 'Сценарий завершён' : 'Сценарий остановлен'}</b></span><code>{lastResult.output || `exit ${lastResult.exit_code}`}</code></div>}
        </section>
      </div>
    </section>
  );
}
