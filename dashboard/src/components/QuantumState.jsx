import { useEffect, useMemo, useState } from 'react'
import { Atom, ScanLine, Waves } from 'lucide-react'
import { ORDER, SUBSTRATE_BY_ID, SUBSTRATES, linkQuality } from '../data/substrates'
import StateChip from './StateChip'

const ENTANGLEMENTS = [
  { a: 'digital', b: 'material', strength: 0.88, label: 'CONTROL ↔ BODY' },
  { a: 'energy', b: 'material', strength: 0.81, label: 'FLUX ↔ BODY' },
  { a: 'digital', b: 'bio', strength: 0.74, label: 'CONTROL ↔ INTENT' },
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export default function QuantumState({ engineState = 'IDLE', telemetry, onCommand }) {
  const [weights, setWeights] = useState(() =>
    Object.fromEntries(SUBSTRATES.map((substrate) => [substrate.id, substrate.coherence / 100])),
  )
  const [collapsed, setCollapsed] = useState(null)

  const linked = engineState === 'ACTIVE'

  const quality = useMemo(() => linkQuality(telemetry), [telemetry])

  useEffect(() => {
    const spread = (1 - quality) * 0.5
    const timer = setInterval(() => {
      setWeights((previous) => {
        const next = {}
        for (const substrate of SUBSTRATES) {
          const noise = (Math.random() - 0.5) * (linked ? 0.16 + spread : 0.4 + spread)
          next[substrate.id] = clamp(previous[substrate.id] + noise, 0.4, 1.4)
        }
        return next
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [linked, quality])

  const { amplitudes, total } = useMemo(() => {
    const sum = ORDER.reduce((acc, id) => acc + weights[id] * weights[id], 0)
    const result = {}
    for (const id of ORDER) {
      const probability = (weights[id] * weights[id]) / sum
      result[id] = Math.sqrt(probability)
    }
    return { amplitudes: result, total: 1 }
  }, [weights])

  const decoherence = (linked ? 0.06 : 0.24) + (1 - quality) * 0.18

  function handleCollapse() {
    let roll = Math.random()
    let chosen = ORDER[ORDER.length - 1]
    for (const id of ORDER) {
      roll -= amplitudes[id] * amplitudes[id]
      if (roll <= 0) {
        chosen = id
        break
      }
    }
    setCollapsed(chosen)
    const substrate = SUBSTRATE_BY_ID[chosen]
    onCommand?.(`Quantum state collapsed to ${substrate.label} (${substrate.code}); evidence anchor written.`)
  }

  return (
    <section className="hud-panel relative flex flex-col">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[5px] border border-material/25 bg-material/[0.07] text-material">
            <Atom size={14} strokeWidth={1.6} />
          </div>
          <div>
            <p className="eyebrow">Assistant layer / state vector</p>
            <h2 className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink">QUANTUM STATE</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StateChip linked={linked} degraded={quality < 0.72} />
          <span className="chip hidden sm:inline-flex">
            <Waves size={10} />
            {linked ? 'ENTANGLED' : 'SEPARABLE'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[10px] tracking-[0.14em] text-muted">
            |&psi;&rang; = &Sigma; c<sub>i</sub> |s<sub>i</sub>&rang;
          </span>
          <span className="data-text text-[8px] text-dim">&Sigma;|c|&sup2; = {total.toFixed(2)}</span>
        </div>

        <div className="mt-2.5 space-y-2">
          {SUBSTRATES.map((substrate) => {
            const amplitude = amplitudes[substrate.id]
            const probability = amplitude * amplitude
            const active = collapsed === substrate.id
            return (
              <div key={substrate.id} className="flex items-center gap-2">
                <span className="w-9 font-mono text-[8px] tracking-[0.12em]" style={{ color: substrate.hex }}>
                  {substrate.short}
                </span>
                <div className="metric-bar flex-1">
                  <span style={{ width: `${probability * 100}%`, background: substrate.hex, boxShadow: `0 0 12px ${substrate.hex}99` }} />
                </div>
                <span className="data-text w-10 text-right text-[9px] text-ink">{amplitude.toFixed(2)}</span>
                <span className="data-text w-9 text-right text-[8px] text-dim">{(probability * 100).toFixed(0)}%</span>
                <span className={`h-1.5 w-1.5 rounded-full ${active ? 'opacity-100' : 'opacity-0'}`} style={{ background: substrate.hex, boxShadow: `0 0 8px ${substrate.hex}` }} />
              </div>
            )
          })}
        </div>

        <div className="mt-3 border-t border-line/30 pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Entanglement</span>
            <span className="data-text text-[8px] text-dim">03 PAIRS</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {ENTANGLEMENTS.map((pair) => {
              const a = SUBSTRATE_BY_ID[pair.a]
              const b = SUBSTRATE_BY_ID[pair.b]
              return (
                <div key={pair.label} className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.hex }} />
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.hex }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[7px] tracking-[0.12em] text-muted">
                    {pair.label}
                  </span>
                  <div className="h-1 w-14 overflow-hidden rounded-full bg-white/5">
                    <span className="block h-full rounded-full" style={{ width: `${pair.strength * 100}%`, background: `linear-gradient(90deg, ${a.hex}, ${b.hex})` }} />
                  </div>
                  <span className="data-text w-7 text-right text-[8px] text-muted">{(pair.strength * 100).toFixed(0)}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/30 pt-2.5">
          <span className="eyebrow">Decoherence</span>
          <span className={`data-text text-[8px] ${decoherence < 0.1 ? 'text-mint' : 'text-amber'}`}>
            {(decoherence * 100).toFixed(0)}% / T&#8322;
          </span>
        </div>

        <button
          type="button"
          onClick={handleCollapse}
          className="mt-3 flex items-center justify-center gap-2 border border-material/40 bg-material/[0.08] px-3 py-2 font-mono text-[9px] font-bold tracking-[0.16em] text-material transition-colors hover:border-material/70 hover:bg-material/[0.16]"
        >
          <ScanLine size={12} strokeWidth={1.8} />
          COLLAPSE STATE
        </button>
        <p className="mt-1.5 font-mono text-[7px] tracking-[0.12em] text-dim">
          {collapsed
            ? `LAST COLLAPSE: ${SUBSTRATE_BY_ID[collapsed].label}`
            : 'MEASUREMENT WRITES AN EVIDENCE ANCHOR.'}
        </p>
      </div>
    </section>
  )
}
