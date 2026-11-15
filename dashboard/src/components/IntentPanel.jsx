import { useState } from 'react'
import { ArrowUpRight, Check, FileLock2, ShieldCheck, Sparkles } from 'lucide-react'

const SCOPE = ['WORKSPACE', 'LOCAL-ONLY', 'READ-MOSTLY']

function GateRow({ label, value, tone = 'text-mint' }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-line/30 pt-1.5 first:border-0 first:pt-0">
      <span className="font-mono text-[7px] tracking-[0.14em] text-muted">{label}</span>
      <span className={`flex items-center gap-1 font-mono text-[7px] tracking-[0.14em] ${tone}`}>
        <Check size={9} strokeWidth={2} />
        {value}
      </span>
    </div>
  )
}

export default function IntentPanel({ engineState, intent, onCommand }) {
  const [draft, setDraft] = useState('')
  const authorized = engineState === 'ACTIVE'

  function handleSubmit(event) {
    event.preventDefault()
    const command = draft.trim()
    if (!command) return
    onCommand?.(command)
    setDraft('')
  }

  return (
    <section className="hud-panel relative xl:flex-1">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[5px] border border-ice/20 bg-ice/[0.05] text-ice">
            <ShieldCheck size={14} strokeWidth={1.7} />
          </div>
          <div>
            <p className="eyebrow">Assistant layer</p>
            <h2 className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink">INTENT / AUTHORIZATION</h2>
          </div>
        </div>
        <span className="chip chip--ice">PREVIEW</span>
      </div>

      <div className="p-3">
        <div className="border border-line/40 bg-black/20 p-2.5">
          <div className="flex items-start gap-2">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-ice" />
            <div>
              <p className="eyebrow">Current intent</p>
              <p className="mt-1.5 break-words text-[11px] leading-relaxed text-ink">{intent}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="border border-line/40 bg-black/20 px-2 py-2">
            <p className="eyebrow">Risk</p>
            <p className="data-text mt-1 text-[12px] font-bold text-mint">LOW</p>
          </div>
          <div className="border border-line/40 bg-black/20 px-2 py-2">
            <p className="eyebrow">Reversible</p>
            <p className="data-text mt-1 text-[12px] font-bold text-ink">FULL</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SCOPE.map((item) => (
            <span key={item} className="chip">
              {item}
            </span>
          ))}
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Decision gate</span>
            <span
              className={`font-mono text-[7px] tracking-[0.14em] ${authorized ? 'text-mint' : 'text-amber'}`}
            >
              {authorized ? 'AUTHORIZED' : 'AWAITING OPERATOR'}
            </span>
          </div>

          <div className="mt-2 space-y-1.5 border border-line/40 bg-black/20 p-2.5">
            <GateRow label="RISK PREVIEW" value="LOW" />
            <GateRow label="LOCAL SCOPE" value="ENFORCED" />
            <GateRow label="EVIDENCE CAPTURE" value="ON" tone="text-ice" />
          </div>
        </div>

        <div className="mt-3 border-t border-line/30 pt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 eyebrow">
              <FileLock2 size={10} />
              EVIDENCE ANCHOR
            </span>
            <span className="font-mono text-[7px] tracking-[0.14em] text-mint">SEALED</span>
          </div>
          <p className="mt-1 break-all font-mono text-[8px] tracking-[0.08em] text-dim">
            SHA-256 9f2c:7a41:be03:5dd8:e41a
          </p>
        </div>

        <form className="mt-3 flex items-stretch gap-1.5" onSubmit={handleSubmit}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={140}
            aria-label="Stage operator intent"
            placeholder="Stage operator intent..."
            className="min-w-0 flex-1 border border-line/50 bg-black/30 px-2 py-1.5 font-mono text-[9px] tracking-[0.06em] text-ink caret-mint outline-none transition-colors placeholder:text-dim/80 focus:border-mint/40"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Stage intent"
            className="grid w-8 shrink-0 place-items-center border border-mint/30 bg-mint/[0.08] text-mint transition-colors hover:border-mint/60 hover:bg-mint/[0.14] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowUpRight size={13} strokeWidth={2} />
          </button>
        </form>

        <p className="mt-2 font-mono text-[7px] leading-relaxed tracking-[0.14em] text-dim">
          OPERATOR OWNS THE DECISION. NO REMOTE EXECUTION WITHOUT EXPLICIT APPROVAL.
        </p>
      </div>
    </section>
  )
}
