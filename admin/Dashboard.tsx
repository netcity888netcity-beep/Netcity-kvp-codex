import React, { useState } from 'react';
import {
  Bot, BrainCircuit, CheckCircle2, CircleUserRound, Cpu, FileKey2,
  Fingerprint, HeartPulse, History, Link2, LockKeyhole, LogOut,
  Menu, Network, Radio, ShieldCheck, WalletCards, X,
} from 'lucide-react';
import type { KvpHumanState } from './src/gateway';

interface DashboardProps {
  userName?: string;
  userRole?: string;
  userEmail?: string;
  humanState?: KvpHumanState | null;
  gatewayStatus?: 'verified';
  onLogout?: () => void;
}

const offlineIdentity = {
  principalId: 'principal:directormira',
  accountId: 'account:principal:directormira',
  currency: 'NCY',
};

const pages = {
  home: ['Центр человека', 'Единое состояние протокола NetCity-KVP.'],
  passport: ['Цифровой паспорт', 'Идентичность, согласия и доверенные привязки.'],
  wallet: ['Внутренний счёт', 'Закрытый NCY ledger, связанный с KVP principal.'],
  assistants: ['Ассистенты', 'Делегированные помощники без владения идентичностью.'],
  bridges: ['Мосты', 'Добровольные интерфейсы устройств и исследовательских данных.'],
  evidence: ['Свидетельства', 'Локальный журнал состояний и границ доверия.'],
} as const;

type Page = keyof typeof pages;

const Dashboard: React.FC<DashboardProps> = ({
  userName = 'DirectorMira',
  userRole = 'Owner Architect',
  userEmail = 'netcity888netcity@gmail.com',
  humanState = null,
  gatewayStatus = 'verified',
  onLogout = () => {},
}) => {
  const [page, setPage] = useState<Page>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const identity = {
    principalId: humanState?.identity.principal_id ?? offlineIdentity.principalId,
    accountId: humanState?.wallet.account_id ?? offlineIdentity.accountId,
    currency: humanState?.wallet.currency ?? offlineIdentity.currency,
    status: humanState?.identity.status ?? 'ACTIVE',
    revision: humanState?.identity.revision ?? 1,
    balanceMinor: humanState?.wallet.balance_minor ?? 0,
  };
  const gatewayLabel = 'M2 SESSION VERIFIED';

  const nav = [
    ['home', 'Центр', CircleUserRound],
    ['passport', 'Паспорт', Fingerprint],
    ['wallet', 'Кошелёк', WalletCards],
    ['assistants', 'Ассистенты', Bot],
    ['bridges', 'Мосты', BrainCircuit],
    ['evidence', 'Свидетельства', History],
  ] as const;

  const open = (next: Page) => {
    setPage(next);
    setNotice('');
    setSidebarOpen(false);
  };

  const statusCard = (title: string, value: string, detail: string, icon: React.ElementType, target: Page) => {
    const Icon = icon;
    return <button className="human-card" onClick={() => open(target)}><span className="human-icon"><Icon /></span><span><small>{title}</small><strong>{value}</strong><em>{detail}</em></span><b>→</b></button>;
  };

  const renderHome = () => <>
    <section className="human-hero">
      <div><div className="eyebrow">Human ↔ Interface ↔ Protocol</div><h2>Человек в центре.<br />Технологии — вокруг.</h2><p>NetCity-KVP объединяет цифровую идентичность, внутренний счёт, ассистентов и добровольные мосты в одном управляемом интерфейсе.</p></div>
      <div className="human-orbit" aria-hidden="true"><span>HUMAN</span><i /><i /><i /></div>
    </section>
    <div className="human-grid">
      {statusCard('Паспорт', identity.status, identity.principalId, Fingerprint, 'passport')}
      {statusCard('Внутренний счёт', `${identity.balanceMinor} ${identity.currency}`, 'Closed-loop sandbox', WalletCards, 'wallet')}
      {statusCard('Ассистенты', assistantEnabled ? '1 LOCAL' : 'DISABLED', 'Без финансовых полномочий', Bot, 'assistants')}
      {statusCard('Мосты', 'RESEARCH', 'Устройства не подключены', BrainCircuit, 'bridges')}
    </div>
    <section className="principle"><ShieldCheck /><div><strong>Принцип суверенности</strong><p>Человек владеет согласиями и может отключить любой внешний мост. Ассистент не может изменить паспорт, подписать перевод или активировать биоинтерфейс.</p></div></section>
  </>;

  const renderPassport = () => <section className="protocol-panel">
    <div className="panel-heading"><span className="human-icon"><Fingerprint /></span><div><h2>NetCity Digital Identity</h2><p>Прототип цифровой идентичности, не государственный документ.</p></div><span className={`state-chip ${identity.status === 'ACTIVE' ? 'good' : 'warning'}`}>{identity.status}</span></div>
    <dl className="identity-fields"><div><dt>Имя интерфейса</dt><dd>{humanState?.identity.display_name ?? userName}</dd></div><div><dt>KVP Principal</dt><dd>{identity.principalId}</dd></div><div><dt>Login attribute</dt><dd>{humanState?.identity.login_email ?? userEmail}</dd></div><div><dt>Роль интерфейса</dt><dd>{userRole}</dd></div><div><dt>Identity revision</dt><dd>{identity.revision} · authenticated fixture</dd></div><div><dt>Платёжная привязка</dt><dd>1 principal → 1 internal account</dd></div></dl>
    <div className="consent-list"><h3>Согласия и полномо��ия</h3><div><CheckCircle2 /> Локальная аутентификация <span>разрешено</span></div><div><CheckCircle2 /> Просмотр собственного счёта <span>разрешено</span></div><div><LockKeyhole /> Ассистент: платёжная подпись <span>запрещено</span></div><div><LockKeyhole /> BioLink / nervous-system data <span>нет согласия</span></div></div>
  </section>;

  const renderWallet = () => <section className="protocol-panel">
    <div className="panel-heading"><span className="human-icon"><WalletCards /></span><div><h2>Внутренний счёт</h2><p>NCY — тестовая единица закрытого контура без обмена на фиат.</p></div><span className="state-chip">SANDBOX</span></div>
    <div className="balance"><small>Доступный баланс</small><strong>{identity.balanceMinor} <span>{identity.currency}</span></strong><code>{identity.accountId}</code></div>
    <div className="ledger-facts"><div><b>Double entry</b><span>каждая операция сбалансирована</span></div><div><b>Identity bound</b><span>счёт вычислен из principal ID</span></div><div><b>Exactly once</b><span>повтор command ID не списывает дважды</span></div></div>
    <button className="action" onClick={() => setNotice('Переводы заблокированы: M2 fixture работает только на чтение, durable ledger не подключён.')}><LockKeyhole size={17} /> Перевод недоступен в M2</button>
  </section>;

  const renderAssistants = () => <section className="protocol-panel">
    <div className="panel-heading"><span className="human-icon"><Bot /></span><div><h2>Контур ассистентов</h2><p>Помощник действует только в пределах явно выданных capabilities.</p></div><span className={`state-chip ${assistantEnabled ? 'good' : ''}`}>{assistantEnabled ? 'LOCAL' : 'OFF'}</span></div>
    <div className="assistant-card"><Cpu /><div><strong>NetCity Local Assistant</strong><p>Mock/local режим, inference и внешние providers отключены.</p><div className="capabilities"><span>status.read</span><span>identity.self.read</span><span className="denied">wallet.transfer ×</span><span className="denied">bridge.activate ×</span></div></div><button className="secondary-action" onClick={() => { setAssistantEnabled((value) => !value); setNotice('Локальный статус ассистента изменён. Внешний inference не выполнялся.'); }}>{assistantEnabled ? 'Отключить' : 'Включить локально'}</button></div>
  </section>;

  const renderBridges = () => <section className="protocol-panel">
    <div className="panel-heading"><span className="human-icon"><BrainCircuit /></span><div><h2>Мосты человека</h2><p>Research-контур. Устройства и биосигналы не подключены.</p></div><span className="state-chip warning">RESEARCH</span></div>
    <div className="bridge-list"><div><HeartPulse /><span><b>BioLink</b><small>Импорт измерений только от сертифицированных устройств и с отзывным согласием.</small></span><em>DISCONNECTED</em></div><div><Radio /><span><b>Nervous-system interface</b><small>Нет аппаратного адаптера, медицинских claims или активного воздействия.</small></span><em>NOT IMPLEMENTED</em></div><div><Network /><span><b>DNA / biological layer</b><small>Только vision/research. Генетические данные не собираются и биологические вмешательства не выполняются.</small></span><em>VISION ONLY</em></div></div>
  </section>;

  const renderEvidence = () => <section className="protocol-panel">
    <div className="panel-heading"><span className="human-icon"><FileKey2 /></span><div><h2>Свидетельства протокола</h2><p>Только наблюдаемые свойства текущей реализации.</p></div></div>
    <div className="evidence-list"><div><CheckCircle2 /><span><b>KVP sessions</b><small>expiry, revocation, replay ordering</small></span><code>TESTED</code></div><div><CheckCircle2 /><span><b>Identity registry</b><small>unique email, lifecycle, self-read isolation</small></span><code>TESTED</code></div><div><CheckCircle2 /><span><b>Payment ledger</b><small>identity binding, double entry, idempotency</small></span><code>TESTED</code></div><div><LockKeyhole /><span><b>Production transport</b><small>mTLS daemon and durable persistence</small></span><code>PLANNED</code></div><div><LockKeyhole /><span><b>BioLink / DNA bridge</b><small>no implemented or clinically validated capability</small></span><code>RESEARCH</code></div></div>
  </section>;

  const content = { home: renderHome, passport: renderPassport, wallet: renderWallet, assistants: renderAssistants, bridges: renderBridges, evidence: renderEvidence }[page]();

  return <div className="dashboard human-console">
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}><div className="side-brand brand"><span className="brand-mark">N</span>NETCITY–KVP</div><button aria-label="Закрыть меню" onClick={() => setSidebarOpen(false)} className="close"><X /></button><nav className="nav">{nav.map(([id, label, Icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => open(id)}><Icon size={18} />{label}</button>)}</nav><button className="logout" onClick={onLogout}><LogOut size={18} />Завершить сеанс</button></aside>
    {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}
    <main className="content"><header className="topbar"><div><button aria-label="Открыть меню" onClick={() => setSidebarOpen(true)} className="menu-toggle"><Menu /></button><div className="eyebrow">NETCITY–KVP · HUMAN PROTOCOL M1</div><h1>{pages[page][0]}</h1><p className="muted">{pages[page][1]}</p></div><div className="owner-block"><strong>{userName}</strong><span className={`gateway-state ${gatewayStatus}`}><i className="signal-dot" /> {gatewayLabel}</span><span>Identity {identity.status.toLowerCase()}</span></div></header>{notice && <div className="notice"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice('')}>×</button></div>}<div className="page-body">{content}</div></main>
  </div>;
};

export default Dashboard;
