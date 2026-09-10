import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Braces,
  Check,
  CheckCircle2,
  Cloud,
  Code2,
  Copy,
  Cpu,
  GitBranch,
  Layers3,
  LockKeyhole,
  MessageSquare,
  Network,
  Play,
  Plus,
  RefreshCw,
  ScanSearch,
  Settings2,
  ShieldCheck,
  TerminalSquare,
  Wand2,
  XCircle,
} from 'lucide-react';
import {
  readStudioCatalog,
  runStudio,
  type StudioClassification,
  type StudioCatalog,
  type StudioMode,
  type StudioProvider,
  type StudioRunResponse,
  type StudioVector,
} from './studio-api';

interface StudioRunRecord {
  prompt: string;
  response: StudioRunResponse;
}

const classificationLabels: Record<StudioClassification, string> = {
  sensitive: 'Sensitive · local only',
  internal: 'Internal · governed egress',
  public: 'Public · remote allowed',
};

const statusLabels: Record<string, string> = {
  ready: 'READY',
  online: 'ONLINE',
  configured: 'CONFIGURED',
  offline: 'OFFLINE',
  credential_missing: 'KEY NEEDED',
  disabled: 'DISABLED',
};

function readyProviderLabel(count: number): string {
  if (count === 1) return '1 контур готов';
  if (count >= 2 && count <= 4) return `${count} контура готовы`;
  return `${count} контуров готовы`;
}

function ProviderGlyph({ kind }: { kind: string }) {
  if (kind === 'ollama') return <Cpu size={17} />;
  if (kind === 'anthropic') return <Wand2 size={17} />;
  if (kind === 'openai_responses') return <Bot size={17} />;
  return <Cloud size={17} />;
}

function statusClass(status: string): string {
  if (status === 'ready' || status === 'online') return 'good';
  if (status === 'configured') return 'configured';
  if (status === 'credential_missing') return 'caution';
  if (status === 'disabled' || status === 'offline') return 'muted';
  return 'muted';
}

function ProviderCard({
  provider,
  selected,
  onSelect,
}: {
  provider: StudioProvider;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`studio-provider ${selected ? 'selected' : ''}`} onClick={onSelect} type="button">
      <span className={`studio-provider-glyph ${statusClass(provider.status)}`}><ProviderGlyph kind={provider.kind} /></span>
      <span className="studio-provider-copy"><b>{provider.label}</b><small>{provider.boundary === 'local' ? 'LOCAL RUNTIME' : 'REMOTE CONNECTOR'}</small></span>
      <span className={`studio-provider-status ${statusClass(provider.status)}`}><i />{statusLabels[provider.status] ?? provider.status}</span>
    </button>
  );
}

function ModeButton({ mode, selected, onSelect }: { mode: StudioMode; selected: boolean; onSelect: () => void }) {
  return <button className={`studio-mode ${selected ? 'selected' : ''}`} onClick={onSelect} type="button"><span>{mode.label}</span><small>{mode.description}</small></button>;
}

function VectorButton({ vector, selected, onSelect }: { vector: StudioVector; selected: boolean; onSelect: () => void }) {
  return <button className={`studio-vector ${selected ? 'selected' : ''}`} onClick={onSelect} type="button"><span>{vector.label}</span><small>{vector.id}</small></button>;
}

export default function ModelStudio() {
  const [catalog, setCatalog] = useState<StudioCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [providerId, setProviderId] = useState('openai');
  const [modelId, setModelId] = useState('');
  const [modeId, setModeId] = useState('coder');
  const [vectorId, setVectorId] = useState('backend');
  const [vectorNote, setVectorNote] = useState('');
  const [classification, setClassification] = useState<StudioClassification>('sensitive');
  const [projectContext, setProjectContext] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [runs, setRuns] = useState<StudioRunRecord[]>([]);
  const [copied, setCopied] = useState(false);

  const refreshCatalog = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const value = await readStudioCatalog(signal);
      setCatalog(value);
      setCatalogError('');
      if (!value.providers.some((provider) => provider.id === providerId)) setProviderId(value.providers[0]?.id ?? 'openai');
      if (!value.modes.some((mode) => mode.id === modeId)) setModeId(value.modes[0]?.id ?? 'dialogue');
      if (!value.vectors.some((vector) => vector.id === vectorId)) setVectorId(value.vectors[0]?.id ?? 'backend');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setCatalogError(cause instanceof Error ? cause.message : 'Каталог провайдеров недоступен.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void refreshCatalog(controller.signal);
    return () => controller.abort();
    // The catalog is intentionally loaded once; refresh remains explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providers = catalog?.providers ?? [];
  const modes = catalog?.modes ?? [];
  const vectors = catalog?.vectors ?? [];
  const selectedProvider = providers.find((provider) => provider.id === providerId) ?? providers[0];
  const selectedMode = modes.find((mode) => mode.id === modeId) ?? modes[0];
  const selectedVector = vectors.find((vector) => vector.id === vectorId) ?? vectors[0];
  const selectedModel = selectedProvider?.models.find((model) => model.id === modelId) ?? selectedProvider?.models[0];
  const latestRun = runs[0];
  const readyProviderCount = providers.filter((provider) => provider.status === 'ready' || provider.status === 'online' || provider.status === 'configured').length;

  useEffect(() => {
    const nextModel = selectedProvider?.models[0]?.id;
    if (nextModel && !selectedProvider.models.some((model) => model.id === modelId)) setModelId(nextModel);
  }, [modelId, selectedProvider]);

  const handleRun = async () => {
    if (!selectedProvider || !selectedMode || !selectedVector || !selectedModel) {
      setRunError('Сначала выберите доступного провайдера и модель.');
      return;
    }
    if (!prompt.trim()) {
      setRunError('Введите задачу для выбранного ассистента.');
      return;
    }
    if (selectedProvider.boundary === 'remote') {
      if (classification === 'sensitive') {
        setRunError('Sensitive-контекст разрешён только локальным провайдерам.');
        return;
      }
      if (!window.confirm(`Отправить задачу провайдеру «${selectedProvider.label}»? Данные покинут этот ПК.`)) return;
    }
    setRunning(true);
    setRunError('');
    try {
      const response = await runStudio({
        provider_id: selectedProvider.id,
        model_id: selectedModel.id,
        mode_id: selectedMode.id,
        vector_id: selectedVector.id,
        vector_note: vectorNote,
        data_classification: classification,
        project_context: projectContext,
        prompt: prompt.trim(),
      });
      setRuns((current) => [{ prompt: prompt.trim(), response }, ...current].slice(0, 12));
      setPrompt('');
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : 'Ассистент не ответил.');
    } finally {
      setRunning(false);
    }
  };

  const copyLatest = async () => {
    if (!latestRun) return;
    await navigator.clipboard.writeText(latestRun.response.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="studio-shell" aria-label="NetCity KVP Model Studio">
      <div className="studio-atmosphere studio-atmosphere-left" aria-hidden="true" />
      <div className="studio-atmosphere studio-atmosphere-right" aria-hidden="true" />
      <header className="studio-header">
        <div><div className="eyebrow">NETCITY–KVP · MODEL STUDIO</div><h2>Пространство моделей</h2><p>Переключай режим мышления, провайдера и программный вектор, сохраняя контроль над границами данных.</p></div>
        <div className="studio-header-tools"><span className="studio-boundary"><ShieldCheck size={14} /> LOCAL CONTROL PLANE</span><button className="studio-refresh" onClick={() => void refreshCatalog()} type="button"><RefreshCw size={15} className={loading ? 'studio-spin' : ''} /> Обновить каталог</button></div>
      </header>

      {catalogError && <div className="studio-notice error" role="alert"><XCircle size={16} /><span>{catalogError}</span></div>}
      {!catalogError && catalog && <div className="studio-notice"><CheckCircle2 size={16} /><span>Каталог загружен. {readyProviderLabel(readyProviderCount)}; ключи провайдеров не передаются в браузер.</span><span className="studio-policy">SENSITIVE → LOCAL ONLY</span></div>}

      <div className="studio-layout">
        <aside className="studio-rail">
          <div className="studio-rail-heading"><div><span className="studio-kicker">PROVIDER MATRIX</span><h3>Контуры</h3></div><Network size={17} /></div>
          <div className="studio-provider-list">{providers.length ? providers.map((provider) => <ProviderCard key={provider.id} provider={provider} selected={provider.id === selectedProvider?.id} onSelect={() => setProviderId(provider.id)} />) : <div className="studio-loading">{loading ? 'Синхронизация...' : 'Провайдеры не найдены.'}</div>}</div>
          <div className="studio-rail-foot"><LockKeyhole size={14} /><span><b>Secret boundary</b><small>Переменные окружения читаются только локальным шлюзом.</small></span></div>
        </aside>

        <main className="studio-main">
          <section className="studio-panel studio-config-panel">
            <div className="studio-panel-heading"><div><span className="studio-kicker">INTERACTION MATRIX</span><h3>Режим работы</h3></div><span className="studio-session-badge"><MessageSquare size={13} /> ephemeral session</span></div>
            <div className="studio-mode-grid">{modes.map((mode) => <ModeButton key={mode.id} mode={mode} selected={mode.id === selectedMode?.id} onSelect={() => setModeId(mode.id)} />)}</div>
            <div className="studio-vector-heading"><div><span className="studio-kicker">PROGRAMMING VECTOR</span><h3>Направление</h3></div><span className="studio-vector-hint">можно добавить свой фокус</span></div>
            <div className="studio-vector-grid">{vectors.map((vector) => <VectorButton key={vector.id} vector={vector} selected={vector.id === selectedVector?.id} onSelect={() => setVectorId(vector.id)} />)}</div>
            <label className="studio-field studio-vector-note"><span>Свой вектор / область</span><input value={vectorNote} maxLength={160} onChange={(event) => setVectorNote(event.target.value)} placeholder="например: компилятор планов миграции" /></label>
          </section>

          <section className="studio-panel studio-composer-panel">
            <div className="studio-panel-heading"><div><span className="studio-kicker">COMPOSER</span><h3>Задача ассистенту</h3></div><span className="studio-route"><span className={`studio-route-dot ${selectedProvider?.boundary === 'remote' ? 'remote' : 'local'}`} />{selectedProvider?.label ?? 'provider'} / {selectedModel?.id ?? 'model'}</span></div>
            <div className="studio-select-row">
              <label className="studio-field"><span>Модель</span><select value={selectedModel?.id ?? ''} onChange={(event) => setModelId(event.target.value)} disabled={!selectedProvider || selectedProvider.models.length === 0}>{selectedProvider?.models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>
              <label className="studio-field"><span>Класс данных</span><select value={classification} onChange={(event) => setClassification(event.target.value as StudioClassification)}><option value="sensitive">{classificationLabels.sensitive}</option><option value="internal">{classificationLabels.internal}</option><option value="public">{classificationLabels.public}</option></select></label>
            </div>
            <label className="studio-prompt-field"><span className="sr-only">Задача ассистенту</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={32000} placeholder="Опиши цель, контекст и желаемый результат. Например: спроектируй безопасный контракт для нового KVP-адаптера..." /></label>
            <div className="studio-compose-foot"><label className="studio-check"><input type="checkbox" checked={projectContext} onChange={(event) => setProjectContext(event.target.checked)} /><span><GitBranch size={14} />добавить контекст workspace</span></label><span className="studio-char-count">{prompt.length.toLocaleString('ru-RU')} / 32 000</span><button className="studio-run" onClick={() => void handleRun()} disabled={running || !selectedModel}><span>{running ? <RefreshCw size={16} className="studio-spin" /> : <Play size={16} />}</span>{running ? 'Выполнение...' : 'Запустить вектор'}</button></div>
            {runError && <div className="studio-inline-error" role="alert"><XCircle size={15} />{runError}</div>}
          </section>

          <section className="studio-panel studio-output-panel">
            <div className="studio-panel-heading"><div><span className="studio-kicker">RESPONSE SURFACE</span><h3>Ответ и история сессии</h3></div><div className="studio-output-actions">{latestRun && <span className="studio-latency">{latestRun.response.latency_ms} ms</span>}<button className="studio-copy" onClick={() => void copyLatest()} disabled={!latestRun} type="button"><Copy size={14} />{copied ? 'Скопировано' : 'Копировать'}</button><button className="studio-new" onClick={() => { setRuns([]); setRunError(''); }} type="button"><Plus size={14} />Новая сессия</button></div></div>
            {latestRun ? <div className="studio-response"><div className="studio-response-meta"><span className="studio-response-icon"><Bot size={16} /></span><span><b>{latestRun.response.provider_label}</b><small>{latestRun.response.model_id} · {latestRun.response.mode_id} · {latestRun.response.vector_id}</small></span><span className={`studio-response-boundary ${latestRun.response.boundary}`}>{latestRun.response.boundary.toUpperCase()}</span></div><pre>{latestRun.response.content}</pre><div className="studio-warning"><ShieldCheck size={14} />{latestRun.response.warnings[0]}</div></div> : <div className="studio-empty-response"><div className="studio-empty-orbit"><Braces size={27} /></div><b>Пространство готово к задаче</b><span>Выбери режим и модель, затем отправь первый программный вектор.</span></div>}
            {runs.length > 1 && <div className="studio-session-history"><span className="studio-kicker">SESSION TRACE · {runs.length} RUNS</span>{runs.slice(1).map((run, index) => <button className="studio-history-row" key={`${run.response.request_id}-${index}`} onClick={() => setRuns((current) => [run, ...current.filter((item) => item !== run)])} type="button"><span>{run.response.mode_id}</span><b>{run.prompt.slice(0, 90)}</b><em>{run.response.provider_label} · {run.response.latency_ms} ms</em></button>)}</div>}
          </section>
        </main>
      </div>
      <footer className="studio-footer"><span><TerminalSquare size={14} />MODEL OUTPUT IS UNTRUSTED TEXT</span><span><Settings2 size={14} />FILE / SYSTEM CHANGES REQUIRE EXPLICIT LOCAL ACTION</span><span><Layers3 size={14} />{catalog?.sensitive_data_policy ?? 'local_only'} policy</span></footer>
    </section>
  );
}
