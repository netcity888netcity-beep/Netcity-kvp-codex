import { Check, FileLock2, ScrollText } from 'lucide-react'

const CHAIN = [
  {
    id: 'intent',
    label: 'INTENT CAPTURED',
    detail: 'Operator intent recorded with consent scope.',
    hash: 'a41c:2e90:7b11',
    tone: '#8fe3b0',
    time: '11:18:02',
  },
  {
    id: 'plan',
    label: 'PLAN COMPILED',
    detail: 'Reversible plan, local-only contour.',
    hash: '5d38:9f04:c2a7',
    tone: '#7df6d1',
    time: '11:18:03',
  },
  {
    id: 'authorize',
    label: 'OPERATOR AUTHORIZED',
    detail: 'Human gate passed. No auto-execute.',
    hash: 'be03:5dd8:e41a',
    tone: '#b9a3ff',
    time: '11:18:04',
  },
  {
    id: 'execute',
    label: 'EXECUTION WINDOW',
    detail: 'Allowlisted action ran on the local bus.',
    hash: '9f2c:7a41:be03',
    tone: '#7df6d1',
    time: '11:18:05',
  },
  {
    id: 'evidence',
    label: 'EVIDENCE SEALED',
    detail: 'Result anchored with trace and claim level.',
    hash: '7a41:e41a:9f2c',
    tone: '#aab7ff',
    time: '11:18:06',
  },
]

export default function ProvenanceTimeline({ evidenceCount = 14 }) {
  return (
    <section className="hud-panel relative flex flex-1 flex-col">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[5px] border border-ice/25 bg-ice/[0.06] text-ice">
            <ScrollText size={14} strokeWidth={1.6} />
          </div>
          <div>
            <p className="eyebrow">Evidence layer / provenance</p>
            <h2 className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink">PROVENANCE CHAIN</h2>
          </div>
        </div>
        <span className="chip chip--ice">
          <FileLock2 size={10} />
          {evidenceCount} SEALED
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="space-y-3.5">
          {CHAIN.map((node, index) => (
            <div key={node.id} className="prov-node">
              <span className="prov-node__marker" style={{ color: node.tone }}>
                <Check size={9} strokeWidth={2.4} />
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-ink">
                  {String(index + 1).padStart(2, '0')} · {node.label}
                </span>
                <span className="data-text text-[8px] text-dim">{node.time}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{node.detail}</p>
              <p className="mt-1 font-mono text-[7px] tracking-[0.1em] text-dim">SHA-256 {node.hash}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-line/40 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Claim level</span>
            <span className="data-text text-[8px] text-mint">SIGNED / REPLAY-RESISTANT</span>
          </div>
          <p className="mt-1.5 font-mono text-[7px] leading-relaxed tracking-[0.1em] text-dim">
            KVP DOES NOT CLAIM CONTROL OVER THIRD-PARTY CLOUD STATE. EVIDENCE COVERS THE LOCAL CONTOUR ONLY.
          </p>
        </div>
      </div>
    </section>
  )
}
