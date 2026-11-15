import {
  Check,
  Cpu,
  LoaderCircle,
  LockKeyhole,
  Power,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

const STATE_META = {
  IDLE: {
    label: 'STANDBY',
    core: 'IDLE',
    sub: 'AWAITING OPERATOR',
    color: 'text-ice',
    chip: 'chip--ice',
    button: 'ENGAGE KVP ENGINE',
    auth: 'LOCKED',
    trace: 0,
  },
  BOOTING: {
    label: 'CALIBRATING',
    core: 'SYNC',
    sub: 'HANDSHAKE IN PROGRESS',
    color: 'text-amber',
    chip: 'chip--amber',
    button: 'CALIBRATING...',
    auth: 'PENDING',
    trace: 2,
  },
  ACTIVE: {
    label: 'ENGAGED',
    core: 'LIVE',
    sub: 'OPERATOR OWNED',
    color: 'text-mint',
    chip: '',
    button: 'RELEASE CONTROL',
    auth: 'UNLOCKED',
    trace: 3,
  },
}

const CAPABILITIES = [
  { label: 'LOCAL REASONING', value: 100, tone: 'mint' },
  { label: 'TOOL ROUTING', value: 86, tone: 'ice' },
  { label: 'EVIDENCE SEAL', value: 74, tone: 'amber' },
]

const TRACE_STEPS = ['INTENT', 'PLAN', 'AUTHORIZE', 'EXECUTE', 'EVIDENCE']

function MetricRow({ label, value, suffix = '%', bar, tone = 'mint' }) {
  const barTone =
    tone === 'ice' ? 'metric-bar--ice' : tone === 'amber' ? 'metric-bar--amber' : ''

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="eyebrow">{label}</span>
        <span className="data-text text-[10px] font-bold text-ink">
          {value}
          {suffix}
        </span>
      </div>
      <div className={`metric-bar mt-1.5 ${barTone}`}>
        <span style={{ width: `${Math.min(100, Math.max(2, bar ?? value))}%` }} />
      </div>
    </div>
  )
}

export default function KvpEngine({
  engineState,
  onToggle,
  latency,
  confidence,
  session = '04F2',
}) {
  const meta = STATE_META[engineState] ?? STATE_META.IDLE

  return (
    <section className="hud-panel hud-panel--focus relative">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at 50% 44%, rgba(125,246,209,0.08), transparent 36%), radial-gradient(ellipse at 16% 100%, rgba(170,183,255,0.05), transparent 42%)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mint/40 to-transparent" />

      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[5px] border border-mint/20 bg-mint/[0.05] text-mint">
            <Cpu size={14} strokeWidth={1.6} />
          </div>
          <div>
            <p className="eyebrow">Execution layer / core-01</p>
            <h1 className="font-mono text-[12px] font-bold tracking-[0.18em] text-ink">KVP ENGINE</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`chip ${meta.chip}`}>
            <span className="led led-pulse text-current" />
            {meta.label}
          </span>
          <span className="chip hidden sm:inline-flex">
            <Sparkles size={10} strokeWidth={1.8} />
            LOCAL CONTOUR
          </span>
        </div>
      </div>

      <div className="grid gap-5 p-3 sm:p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(300px,1.15fr)_minmax(0,0.9fr)] lg:items-center lg:gap-4 xl:gap-6">
        <div className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1 lg:grid-cols-1">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Engine state</span>
              <span className="data-text text-[8px] text-dim">SESSION {session}</span>
            </div>
            <p
              aria-live="polite"
              className={`data-text mt-2 text-[21px] font-bold leading-none tracking-[0.08em] ${meta.color}`}
            >
              {meta.label}
            </p>
            <p className="mt-1.5 font-mono text-[8px] tracking-[0.18em] text-muted">{meta.sub}</p>
            <div className="tick-rule mt-3" />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            <MetricRow label="SYNC" value={100} />
            <MetricRow
              label="LATENCY"
              value={latency}
              suffix="ms"
              bar={Math.min(100, latency * 3)}
              tone={latency > 26 ? 'amber' : 'mint'}
            />
            <MetricRow label="CONFIDENCE" value={confidence.toFixed(1)} bar={confidence} />
          </div>

          <div className="hidden items-center gap-2 border border-line/40 bg-black/20 px-2.5 py-2 lg:flex">
            <ShieldCheck size={13} className="shrink-0 text-mint" />
            <span className="font-mono text-[8px] leading-relaxed tracking-[0.12em] text-muted">
              OPERATOR OWNS THE DECISION
            </span>
          </div>
        </div>

        <div className="order-1 flex min-w-0 flex-col items-center lg:order-2">
          <div className="core-stage core-crosshair" data-state={engineState}>
            <div className="core-ring core-ring-outer" />
            <div className="core-ring core-ring-ticks" />
            <div className="core-ring core-ring-dashed" />
            <div className="core-glow" />
            <div className="core-orbit">
              <span />
            </div>
            <div className="core-orbit core-orbit--reverse">
              <span />
            </div>
            <div className="core-disc">
              <div className="core-scan" />
              <div className="relative z-10 px-4">
                <p className="eyebrow">KVP CORE</p>
                <p className={`data-text text-glow mt-1.5 text-[30px] font-bold leading-none tracking-[0.06em] ${meta.color}`}>
                  {meta.core}
                </p>
                <p className="mt-1.5 font-mono text-[7px] tracking-[0.2em] text-muted">{meta.sub}</p>
              </div>
            </div>

            <span className="core-label left-0 top-[16%] hidden sm:block">CH-01 / LOCAL</span>
            <span className="core-label right-0 top-[16%] hidden sm:block">SYNC 100%</span>
            <span className="core-label bottom-[16%] left-0 hidden sm:block">{latency} MS</span>
            <span className="core-label bottom-[16%] right-0 hidden sm:block">SAFE</span>
          </div>

          <div className="mt-4 w-full max-w-[280px]">
            <button
              type="button"
              className="btn-engage"
              data-state={engineState}
              disabled={engineState === 'BOOTING'}
              aria-pressed={engineState === 'ACTIVE'}
              onClick={onToggle}
            >
              <span className="flex items-center justify-center gap-2">
                {engineState === 'BOOTING' ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Power size={14} strokeWidth={1.8} />
                )}
                {meta.button}
              </span>
            </button>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="eyebrow">Operator authorization</span>
              <span className={`data-text text-[8px] ${engineState === 'ACTIVE' ? 'text-mint' : 'text-muted'}`}>
                {meta.auth}
              </span>
            </div>
          </div>
        </div>

        <div className="order-3">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Active capabilities</span>
            <span className="data-text text-[8px] text-dim">03 / 03</span>
          </div>

          <div className="mt-2.5 space-y-2.5">
            {CAPABILITIES.map((capability) => (
              <MetricRow
                key={capability.label}
                label={capability.label}
                value={capability.value}
                tone={capability.tone}
              />
            ))}
          </div>

          <div className="mt-3 border border-line/50 bg-black/20 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 eyebrow">
                <ShieldCheck size={11} className="text-mint" />
                SAFETY INTERLOCK
              </span>
              <span className="flex items-center gap-1 font-mono text-[7px] tracking-[0.16em] text-mint">
                <span className="led led-pulse text-mint" />
                ARMED
              </span>
            </div>

            <div className="mt-2 space-y-1.5">
              {[
                { label: 'LOCAL-ONLY SCOPE', value: 'ENFORCED' },
                { label: 'APPROVAL GATE', value: engineState === 'ACTIVE' ? 'PASSED' : 'ARMED' },
                { label: 'EVIDENCE CAPTURE', value: 'ON' },
              ].map((check) => (
                <div
                  key={check.label}
                  className="flex items-center justify-between gap-2 border-t border-line/30 pt-1.5 first:border-0 first:pt-0"
                >
                  <span className="flex items-center gap-1.5 font-mono text-[7px] tracking-[0.12em] text-muted">
                    {check.value === 'ARMED' ? (
                      <LockKeyhole size={9} className="text-amber" />
                    ) : (
                      <Check size={9} className="text-mint" />
                    )}
                    {check.label}
                  </span>
                  <span className="font-mono text-[7px] tracking-[0.12em] text-dim">{check.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-mint/10 px-3 py-3 sm:px-4">
        <span className="eyebrow mr-1">Execution trace</span>
        {TRACE_STEPS.map((step, index) => (
          <span key={step} className="trace-node" data-active={index === meta.trace}>
            {step}
          </span>
        ))}
        <span className="chip ml-auto hidden sm:inline-flex">
          <ShieldCheck size={10} />
          OPERATOR OWNED
        </span>
      </div>
    </section>
  )
}
