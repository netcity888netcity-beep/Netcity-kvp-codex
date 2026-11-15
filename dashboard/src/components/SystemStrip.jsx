import { Check, FileLock2, Radio, ShieldCheck } from 'lucide-react'

function SignalBars({ active = 4, tone = 'mint' }) {
  const heights = ['h-1.5', 'h-2', 'h-2.5', 'h-3', 'h-3.5']
  const litClass = tone === 'ice' ? 'bg-ice shadow-[0_0_8px_rgba(170,183,255,0.5)]' : 'bg-mint shadow-[0_0_8px_rgba(125,246,209,0.5)]'

  return (
    <div className="flex h-4 items-end gap-1" aria-hidden="true">
      {heights.map((height, index) => (
        <span
          key={height}
          className={`w-1 rounded-sm ${height} ${index < active ? litClass : 'bg-line/60'}`}
        />
      ))}
    </div>
  )
}

export default function SystemStrip({ latency, evidenceCount = 14, engineState }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <section className="hud-panel depth-1 relative p-3">
        <span className="corner corner-tl" />
        <span className="corner corner-br" />

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 eyebrow">
            <Radio size={10} className="text-mint" />
            LOCAL CONTOUR
          </span>
          <SignalBars active={4} />
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="data-text text-[19px] font-bold leading-none text-mint">SECURE</p>
            <p className="mt-1 font-mono text-[7px] tracking-[0.16em] text-dim">LOOPBACK / 127.0.0.1</p>
          </div>
          <span className="data-text text-[10px] text-muted">{latency} ms</span>
        </div>

        <div className="mt-2 border-t border-line/30 pt-1.5">
          <p className="font-mono text-[7px] tracking-[0.14em] text-dim">NO EXTERNAL EGRESS DETECTED</p>
        </div>
      </section>

      <section className="hud-panel depth-1 relative p-3">
        <span className="corner corner-tl" />
        <span className="corner corner-br" />

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 eyebrow">
            <ShieldCheck size={10} className="text-amber" />
            SAFETY INTERLOCK
          </span>
          <span className="flex items-center gap-1 font-mono text-[7px] tracking-[0.14em] text-mint">
            <span className="led led-pulse text-mint" />
            2 / 2
          </span>
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="data-text text-[19px] font-bold leading-none text-amber">ARMED</p>
            <p className="mt-1 font-mono text-[7px] tracking-[0.16em] text-dim">HUMAN GATE REQUIRED</p>
          </div>
          <span className="chip !px-1.5 !py-1">{engineState}</span>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-line/30 pt-1.5">
          <span className="flex items-center gap-1 font-mono text-[7px] tracking-[0.12em] text-muted">
            <Check size={8} className="text-mint" />
            LOCAL SCOPE
          </span>
          <span className="flex items-center gap-1 font-mono text-[7px] tracking-[0.12em] text-muted">
            <Check size={8} className="text-mint" />
            NO AUTO-EXECUTE
          </span>
        </div>
      </section>

      <section className="hud-panel depth-1 relative p-3">
        <span className="corner corner-tl" />
        <span className="corner corner-br" />

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 eyebrow">
            <FileLock2 size={10} className="text-ice" />
            EVIDENCE LEDGER
          </span>
          <span className="font-mono text-[7px] tracking-[0.14em] text-ice">CHAIN INTACT</span>
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="data-text text-[19px] font-bold leading-none text-ink">SEALED</p>
            <p className="mt-1 font-mono text-[7px] tracking-[0.16em] text-dim">{evidenceCount} EVENTS / LOCAL</p>
          </div>
          <span className="data-text text-[10px] text-muted">SHA</span>
        </div>

        <div className="mt-2 border-t border-line/30 pt-1.5">
          <p className="truncate font-mono text-[7px] tracking-[0.08em] text-dim">
            9f2c:7a41:be03:5dd8:e41a
          </p>
        </div>
      </section>
    </div>
  )
}
