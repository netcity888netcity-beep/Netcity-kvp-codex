import { FileLock2, ScanLine, ShieldCheck, Zap } from 'lucide-react'

const TRACES = [
  { time: '11:18:04', intent: 'workspace.scan', route: 'LOCAL', status: 'SEALED', tone: 'mint' },
  { time: '11:15:42', intent: 'context.index', route: 'LOCAL', status: 'SEALED', tone: 'mint' },
  { time: '11:11:09', intent: 'plan.preview', route: 'LOCAL', status: 'SEALED', tone: 'ice' },
  { time: '11:04:55', intent: 'remote.ping', route: 'REMOTE', status: 'STANDBY', tone: 'amber' },
  { time: '10:58:12', intent: 'evidence.seal', route: 'LOCAL', status: 'SEALED', tone: 'mint' },
  { time: '10:52:37', intent: 'index.rebuild', route: 'LOCAL', status: 'SEALED', tone: 'mint' },
]

const QUICK = [
  { label: 'SCAN WORKSPACE', intent: 'Scan workspace and stage a read-only inventory report.', icon: ScanLine },
  { label: 'BUILD SAFE PLAN', intent: 'Build a reversible execution plan with local-only scope.', icon: ShieldCheck },
  { label: 'SEAL EVIDENCE', intent: 'Seal the current evidence chain and anchor its hash.', icon: FileLock2 },
]

const TONE_TEXT = {
  mint: 'text-mint',
  ice: 'text-ice',
  amber: 'text-amber',
}

export default function TraceLedger({ onCommand }) {
  return (
    <section className="hud-panel relative flex flex-1 flex-col">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[5px] border border-mint/20 bg-mint/[0.05] text-mint">
            <FileLock2 size={14} strokeWidth={1.7} />
          </div>
          <div>
            <p className="eyebrow">Evidence layer</p>
            <h2 className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink">TRACE LEDGER</h2>
          </div>
        </div>
        <span className="chip">
          <span className="led led-pulse text-mint" />
          14 SEALED
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="grid grid-cols-[54px_minmax(0,1fr)_auto] gap-x-2 border-b border-line/40 pb-1.5 sm:grid-cols-[58px_minmax(0,1fr)_62px_74px]">
          <span className="eyebrow">TIME</span>
          <span className="eyebrow">INTENT HASH</span>
          <span className="eyebrow hidden sm:block">ROUTE</span>
          <span className="eyebrow text-right">STATE</span>
        </div>

        <div className="mt-1 divide-y divide-line/25">
          {TRACES.map((trace) => (
            <div
              key={trace.time}
              className="grid grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-x-2 py-2 sm:grid-cols-[58px_minmax(0,1fr)_62px_74px]"
            >
              <span className="data-text text-[9px] text-dim">{trace.time}</span>
              <span className="truncate font-mono text-[9px] tracking-[0.06em] text-muted" title={trace.intent}>
                {trace.intent}
              </span>
              <span
                className={`hidden font-mono text-[7px] tracking-[0.12em] sm:block ${
                  trace.route === 'REMOTE' ? 'text-ice' : 'text-dim'
                }`}
              >
                {trace.route}
              </span>
              <span
                className={`flex items-center justify-end gap-1 font-mono text-[7px] tracking-[0.12em] ${
                  TONE_TEXT[trace.tone]
                }`}
              >
                <span className={`led ${TONE_TEXT[trace.tone]}`} />
                {trace.status}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-line/40 pt-3 xl:mt-auto">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Quick staging</span>
            <span className="font-mono text-[7px] tracking-[0.14em] text-dim">NO EXECUTION</span>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {QUICK.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => onCommand?.(action.intent)}
                  className="group flex items-center justify-center gap-1.5 border border-line/50 bg-black/20 px-2 py-2 font-mono text-[8px] tracking-[0.12em] text-muted transition-all hover:border-mint/45 hover:bg-mint/[0.07] hover:text-mint"
                >
                  <Icon size={11} strokeWidth={1.7} className="shrink-0" />
                  <span className="truncate">{action.label}</span>
                  <Zap size={9} strokeWidth={1.7} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
