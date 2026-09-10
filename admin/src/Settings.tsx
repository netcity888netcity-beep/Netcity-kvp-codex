import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CloudCog,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  LockKeyhole,
  RefreshCw,
  Save,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Wifi,
  XCircle,
} from 'lucide-react';
import { readStudioCatalog, type StudioCatalog, type StudioProvider } from './studio-api';
import { saveStudioProviderSettings } from './settings-api';

const statusLabels: Record<string, string> = {
  ready: 'READY',
  online: 'ONLINE',
  configured: 'CONFIGURED',
  offline: 'OFFLINE',
  credential_missing: 'KEY NEEDED',
  disabled: 'DISABLED',
};

function providerIcon(provider: StudioProvider) {
  if (provider.boundary === 'local') return <ServerCog size={17} />;
  if (provider.id === 'custom-openai') return <Sparkles size={17} />;
  return <CloudCog size={17} />;
}

function providerStatusClass(status: string) {
  if (status === 'ready' || status === 'online') return 'good';
  if (status === 'credential_missing') return 'caution';
  if (status === 'disabled' || status === 'offline') return 'muted';
  return 'configured';
}

function ProviderSettingsCard({
  provider,
  selected,
  onSelect,
}: {
  provider: StudioProvider;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`settings-provider ${selected ? 'selected' : ''}`} onClick={onSelect} type="button">
      <span className={`settings-provider-icon ${providerStatusClass(provider.status)}`}>{providerIcon(provider)}</span>
      <span className="settings-provider-copy"><b>{provider.label}</b><small>{provider.boundary === 'local' ? 'LOCAL' : 'REMOTE API'}</small></span>
      <span className={`settings-provider-status ${providerStatusClass(provider.status)}`}><i />{statusLabels[provider.status] ?? provider.status}</span>
    </button>
  );
}

export default function Settings() {
  const [catalog, setCatalog] = useState<StudioCatalog | null>(null);
  const [providerId, setProviderId] = useState('openai');
  const [endpoint, setEndpoint] = useState('');
  const [models, setModels] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const providers = catalog?.providers ?? [];
  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === providerId) ?? providers[0],
    [providerId, providers],
  );

  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    try {
      const value = await readStudioCatalog();
      setCatalog(value);
      if (!value.providers.some((provider) => provider.id === providerId)) setProviderId(value.providers[0]?.id ?? 'openai');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить настройки провайдеров.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCatalog(); }, []);

  useEffect(() => {
    if (!selectedProvider) return;
    setEndpoint(selectedProvider.endpoint ?? '');
    setModels(selectedProvider.models.map((model) => model.id).join(', '));
    setEnabled(selectedProvider.enabled);
    setApiKey('');
    setShowKey(false);
    setNotice('');
  }, [selectedProvider?.id]);

  const save = async () => {
    if (!selectedProvider) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await saveStudioProviderSettings({
        provider_id: selectedProvider.id,
        endpoint,
        models: models.split(',').map((value) => value.trim()).filter(Boolean),
        enabled,
        ...(selectedProvider.credential_env && apiKey.trim() ? { api_key: apiKey } : {}),
      });
      setCatalog(result.catalog);
      setApiKey('');
      setNotice(`Настройки «${selectedProvider.label}» сохранены. Нажми «Обновить», чтобы проверить соединение и список моделей.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Настройки не сохранены.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="settings-shell" aria-label="Настройки NetCity KVP">
      <div className="settings-atmosphere" aria-hidden="true" />
      <header className="settings-header">
        <div><div className="eyebrow">NETCITY–KVP · CONTROL PLANE</div><h2>Настройки контура</h2><p>Подключай внешние API и локальные runtimes, не передавая секреты в браузер или историю проекта.</p></div>
        <div className="settings-header-tools"><span className="settings-boundary"><ShieldCheck size={14} /> LOCAL SECRET BOUNDARY</span><button className="settings-refresh" onClick={() => void loadCatalog()} type="button"><RefreshCw size={15} className={loading ? 'settings-spin' : ''} /> Обновить</button></div>
      </header>

      {error && <div className="settings-notice error" role="alert"><XCircle size={16} /><span>{error}</span></div>}
      {notice && <div className="settings-notice"><CheckCircle2 size={16} /><span>{notice}</span></div>}

      <div className="settings-layout">
        <aside className="settings-rail">
          <div className="settings-rail-heading"><div><span className="studio-kicker">PROVIDER REGISTRY</span><h3>Провайдеры</h3></div><Wifi size={17} /></div>
          <div className="settings-provider-list">{providers.length ? providers.map((provider) => <ProviderSettingsCard key={provider.id} provider={provider} selected={provider.id === selectedProvider?.id} onSelect={() => setProviderId(provider.id)} />) : <div className="studio-loading">{loading ? 'Синхронизация...' : 'Провайдеры не найдены.'}</div>}</div>
          <div className="settings-rail-foot"><LockKeyhole size={14} /><span><b>Секреты не возвращаются</b><small>Ключ хранится через DPAPI текущего пользователя Windows.</small></span></div>
        </aside>

        <main className="settings-main">
          {selectedProvider ? <>
            <section className="settings-panel">
              <div className="settings-panel-heading"><div><span className="studio-kicker">PROVIDER SETTINGS</span><h3>{selectedProvider.label}</h3><p>{selectedProvider.boundary === 'remote' ? 'Удалённый API: данные покинут ПК только после явного запуска.' : 'Локальный runtime: endpoint должен оставаться на loopback.'}</p></div><span className={`settings-status ${providerStatusClass(selectedProvider.status)}`}><i />{statusLabels[selectedProvider.status] ?? selectedProvider.status}</span></div>
              <div className="settings-form">
                <label className="settings-field"><span>Endpoint</span><input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://api.example.com/v1" /></label>
                <label className="settings-field"><span>Модели · через запятую</span><input value={models} onChange={(event) => setModels(event.target.value)} placeholder="provider/model, provider/fast" /></label>
                {selectedProvider.credential_env && <label className="settings-field"><span>API key · {selectedProvider.credential_env}</span><div className="settings-secret-input"><KeyRound size={15} /><input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={selectedProvider.credential_configured ? 'ключ сохранён · введите новый для замены' : 'вставь ключ, он не будет показан повторно'} autoComplete="new-password" /><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? 'Скрыть ключ' : 'Показать ключ'}>{showKey ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>}
                <label className="settings-toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span><b>Разрешить провайдер</b><small>Отключённые контуры не появляются доступными для запуска.</small></span></label>
                <div className="settings-form-actions"><button className="settings-save" onClick={() => void save()} disabled={saving || selectedProvider.kind === 'mock'}><Save size={16} />{saving ? 'Сохранение...' : 'Сохранить настройки'}</button><span className="settings-configured">{selectedProvider.credential_configured ? 'Ключ настроен локально' : selectedProvider.credential_env ? 'Ключ не настроен' : 'Ключ не требуется'}</span></div>
              </div>
            </section>

            <section className="settings-panel settings-help">
              <div className="settings-panel-heading"><div><span className="studio-kicker">SAFE CONNECTION</span><h3>Как использовать сторонний API</h3></div><Link2 size={17} /></div>
              <div className="settings-help-grid"><div><b>1 · Выбери провайдера</b><p>OpenAI, OpenRouter, GitHub Models и Anthropic уже имеют готовые адаптеры.</p></div><div><b>2 · Введи ключ</b><p>Он шифруется DPAPI и используется только локальным PowerShell gateway.</p></div><div><b>3 · Укажи модели</b><p>Оставь список пустым для discovery или задай ID вручную, если endpoint его не публикует.</p></div><div><b>4 · Запусти с контролем</b><p>Sensitive-класс остаётся local-only; для remote потребуется public/internal и подтверждение.</p></div></div>
              <div className="settings-callout"><KeyRound size={15} /><span>Альтернатива: можно задать {selectedProvider.credential_env ?? 'локальные параметры'} в окружении процесса. Значение из окружения имеет приоритет над локальным хранилищем.</span></div>
            </section>
          </> : <div className="settings-empty"><ServerCog size={30} /><b>Выбери контур провайдера</b></div>}
        </main>
      </div>
      <footer className="settings-footer"><span><ShieldCheck size={14} />CREDENTIALS STAY ON THIS WINDOWS PROFILE</span><span><LockKeyhole size={14} />REMOTE REQUESTS REQUIRE EXPLICIT DATA CLASS</span></footer>
    </section>
  );
}
