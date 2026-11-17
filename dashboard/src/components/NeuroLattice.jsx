import { useEffect, useMemo, useState } from 'react'
import { Atom, Gauge, Waves } from 'lucide-react'
import { COUPLING, ORDER, SUBSTRATES, couplingAverage, linkQuality } from '../data/substrates'
import StateChip from './StateChip'

const CENTER = 180
const RADIUS = 124

function polar(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  }
}

const NODES = Object.fromEntries(
  SUBSTRATES.map((substrate) => [substrate.id, polar(substrate.angle, RADIUS)]),
)

const HEX_PATH = ORDER.map((id, index) => {
  const point = NODES[id]
  return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`
})
  .join(' ')
  .concat(' Z')

export default function NeuroLattice({ engineState = 'IDLE', telemetry, onCommand }) {
  const [selected, setSelected] = useState('digital')
  const [synced, setSynced] = useState(false)
  const [live, setLive] = useState(() =>
    Object.fromEntries(SUBSTRATES.map((substrate) => [substrate.id, substrate.coherence])),
  )

  const linked = engineState === 'ACTIVE'

  const quality = useMemo(() => linkQuality(telemetry), [telemetry])

  const degraded = quality < 0.72

  useEffect(() => {
    setSynced(false)
  }, [engineState])

  useEffect(() => {
    const active = linked || synced
    const timer = setInterval(() => {
      setLive((previous) => {
        const next = {}
        for (const substrate of SUBSTRATES) {
          const target = substrate.coherence * quality + (synced ? 4 : 0)
          const drift = (Math.random() - 0.5) * (active ? 2.4 : degraded ? 1.4 : 0.6)
          const value = Math.min(99.6, Math.max(72, previous[substrate.id] + drift))
          next[substrate.id] = value * 0.72 + target * 0.28
        }
        return next
      })
    }, 1800)

    return () => clearInterval(timer)
  }, [linked, synced, quality, degraded])

  const current = useMemo(
    () => SUBSTRATES.find((substrate) => substrate.id === selected) ?? SUBSTRATES[0],
    [selected],
  )

  const meanCoherence = useMemo(
    () => SUBSTRATES.reduce((sum, substrate) => sum + live[substrate.id], 0) / SUBSTRATES.length,
    [live],
  )

  const flowDuration = linked ? '1.9s' : synced ? '2.2s' : '3.6s'
  const CurrentIcon = current.icon

  function handleSync() {
    setSynced((previous) => {
      const next = !previous
      onCommand?.(
        next
          ? 'Neuro-sync engaged across all four substrates; coupling coherence lifted.'
          : 'Neuro-sync released; substrates returning to passive observation.',
      )
      return next
    })
  }

  return (
    <section className="hud-panel relative">
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
            <p className="eyebrow">Perception bridge / quantum-material</p>
            <h2 className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink">
              NEURAL LATTICE
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StateChip linked={linked} degraded={degraded} />
          <span className="chip hidden sm:inline-flex">
            <Waves size={10} />
            {synced ? 'SYNCHRONIZED' : 'PASSIVE'}
          </span>
          <span className={`chip hidden md:inline-flex ${degraded ? 'chip--amber' : ''}`}>
            <Gauge size={10} />
            LINK {(quality * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(258px,0.82fr)] lg:items-start">
        <div className="neuro-field" data-state={engineState}>
          <svg
            className="neuro-svg"
            viewBox="0 0 360 360"
            role="img"
            aria-label="Quantum-material neural lattice coupling four substrates"
          >
            <defs>
              <radialGradient id="neuro-hub-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#7df6d1" stopOpacity="0.32" />
                <stop offset="55%" stopColor="#b9a3ff" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#b9a3ff" stopOpacity="0" />
              </radialGradient>
            </defs>

            <circle cx={CENTER} cy={CENTER} r="150" className="neuro-hub-ring" stroke="rgba(125,246,209,0.08)" strokeWidth="1" />
            <circle cx={CENTER} cy={CENTER} r="104" className="neuro-hub-ring" stroke="rgba(170,183,255,0.06)" strokeWidth="1" strokeDasharray="2 8" />

            <path
              d={HEX_PATH}
              className="neuro-edge neuro-edge--idle"
              stroke="rgba(140,161,157,0.28)"
              strokeWidth="1"
              strokeDasharray="3 6"
            />

            {SUBSTRATES.map((substrate) => {
              const node = NODES[substrate.id]
              const active = substrate.id === selected
              const base = `M${CENTER},${CENTER} L${node.x.toFixed(1)},${node.y.toFixed(1)}`
              return (
                <g key={`edge-${substrate.id}`}>
                  <path
                    d={base}
                    className={`neuro-edge ${active ? '' : 'neuro-edge--idle'}`}
                    stroke={substrate.hex}
                    strokeOpacity={active ? 0.5 : 0.24}
                    strokeWidth={active ? 1.6 : 1}
                  />
                  <path
                    d={base}
                    className={`neuro-edge neuro-flow ${active ? '' : 'neuro-edge--idle'}`}
                    style={{ '--flow-duration': flowDuration }}
                    stroke={substrate.hex}
                    strokeOpacity={active ? 0.95 : 0.55}
                    strokeWidth={active ? 2 : 1.3}
                  />
                </g>
              )
            })}

            <circle cx={CENTER} cy={CENTER} r="58" fill="url(#neuro-hub-glow)" />
            <g className="neuro-hub-orbit" style={{ transformOrigin: '180px 180px' }}>
              <circle cx={CENTER} cy={CENTER - 58} r="2.4" fill="#7df6d1" />
            </g>
            <g className="neuro-hub-orbit neuro-hub-orbit--reverse" style={{ transformOrigin: '180px 180px' }}>
              <circle cx={CENTER} cy={CENTER - 40} r="1.8" fill="#b9a3ff" />
            </g>
            <circle cx={CENTER} cy={CENTER} r="40" className="neuro-hub__disc" />
            <circle cx={CENTER} cy={CENTER} r="32" fill="none" stroke="rgba(125,246,209,0.16)" strokeWidth="1" strokeDasharray="1 5" />
            <text x={CENTER} y={CENTER - 6} textAnchor="middle" className="neuro-hub__text">
              {meanCoherence.toFixed(1)}%
            </text>
            <text x={CENTER} y={CENTER + 8} textAnchor="middle" className="neuro-hub__sub">
              NEURO CORE
            </text>

            {SUBSTRATES.map((substrate) => {
              const node = NODES[substrate.id]
              const active = substrate.id === selected
              return (
                <g
                  key={substrate.id}
                  className={`neuro-node ${active ? 'is-active' : ''}`}
                  style={{ color: substrate.hex }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  aria-label={`${substrate.label} substrate`}
                  onClick={() => setSelected(substrate.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelected(substrate.id)
                    }
                  }}
                >
                  <circle cx={node.x} cy={node.y} r="22" className="neuro-node__halo" />
                  <circle cx={node.x} cy={node.y} r="15" className="neuro-node__disc" />
                  <circle cx={node.x} cy={node.y} r="4.4" className="neuro-node__core" />
                  <text
                    x={node.x}
                    y={node.y + (substrate.angle === 90 ? 30 : substrate.angle === -90 ? -22 : 24)}
                    textAnchor="middle"
                    className="neuro-node__label"
                  >
                    {substrate.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {SUBSTRATES.map((substrate) => {
              const Icon = substrate.icon
              return (
                <button
                  key={substrate.id}
                  type="button"
                  className="neuro-substrate-chip flex items-center gap-1.5"
                  data-active={substrate.id === selected}
                  style={{ color: substrate.hex }}
                  aria-pressed={substrate.id === selected}
                  onClick={() => setSelected(substrate.id)}
                >
                  <Icon size={11} strokeWidth={1.8} />
                  {substrate.short}
                </button>
              )
            })}
          </div>

          <div className="neuro-readout p-2.5">
            <div className="flex items-start gap-2">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-[5px] border"
                style={{ color: current.hex, borderColor: `${current.hex}55`, background: `${current.hex}14` }}
              >
                <CurrentIcon size={14} strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-bold tracking-[0.16em]" style={{ color: current.hex }}>
                    {current.label}
                  </span>
                  <span className="data-text text-[8px] text-dim">{current.code}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{current.role}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="border border-line/40 bg-black/20 px-2 py-1.5">
                <p className="eyebrow">Coherence</p>
                <p className="data-text mt-1 text-[13px] font-bold leading-none text-ink">
                  {live[current.id].toFixed(1)}%
                </p>
              </div>
              <div className="border border-line/40 bg-black/20 px-2 py-1.5">
                <p className="eyebrow">Phase</p>
                <p className="data-text mt-1 text-[13px] font-bold leading-none text-ink">
                  {current.phase}&deg;
                </p>
              </div>
              <div className="border border-line/40 bg-black/20 px-2 py-1.5">
                <p className="eyebrow">Coupling</p>
                <p className="data-text mt-1 text-[13px] font-bold leading-none text-ink">
                  {(couplingAverage(current.id) * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-line/30 pt-2">
              <span className="eyebrow">Carrier</span>
              <span className="data-text text-[8px] text-muted">{current.band}</span>
            </div>
            <p className="mt-1 truncate font-mono text-[7px] tracking-[0.1em] text-dim" title={current.trace}>
              {current.trace}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Cross-substrate coupling</span>
              <span className="data-text text-[8px] text-dim">4 &times; 4</span>
            </div>
            <div className="neuro-couplings mt-2">
              <span className="neuro-coupling neuro-coupling--head" />
              {SUBSTRATES.map((substrate) => (
                <span key={`head-${substrate.id}`} className="neuro-coupling neuro-coupling--head">
                  {substrate.short}
                </span>
              ))}
              {SUBSTRATES.map((row) => (
                <FragmentRow key={row.id} row={row} onSelect={setSelected} />
              ))}
            </div>
          </div>

          <button
            type="button"
            className="neuro-sync"
            data-synced={synced}
            aria-pressed={synced}
            onClick={handleSync}
          >
            <span className="flex items-center justify-center gap-2">
              <Waves size={13} strokeWidth={1.9} />
              {synced ? 'RELEASE NEURO-SYNC' : 'ENGAGE NEURO-SYNC'}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-material/10 px-3 py-3 sm:px-4">
        <span className="eyebrow mr-1">Substrate legend</span>
        {SUBSTRATES.map((substrate) => (
          <span key={`legend-${substrate.id}`} className="flex items-center gap-1.5 font-mono text-[7px] tracking-[0.12em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: substrate.hex, boxShadow: `0 0 8px ${substrate.hex}` }} />
            {substrate.ru}
          </span>
        ))}
        <span className="chip ml-auto hidden sm:inline-flex">
          <Atom size={10} />
          QUANTUM-MATERIAL BRIDGE
        </span>
        {telemetry ? (
          <span className="data-text flex items-center gap-2.5 text-[8px] text-dim">
            <span>LAT {telemetry.latency}MS</span>
            <span className="h-2.5 w-px bg-line" />
            <span>CPU {telemetry.cpu}%</span>
            <span className="h-2.5 w-px bg-line" />
            <span>MEM {telemetry.memory}%</span>
          </span>
        ) : null}
      </div>
    </section>
  )
}

function FragmentRow({ row, onSelect }) {
  return (
    <>
      <span className="neuro-coupling neuro-coupling--head">{row.short}</span>
      {ORDER.map((column) => {
        const value = COUPLING[row.id][column]
        const self = row.id === column
        return (
          <button
            key={`${row.id}-${column}`}
            type="button"
            className="neuro-coupling"
            data-strong={!self && value >= 0.7}
            data-self={self}
            aria-label={`${row.label} to ${column} coupling ${(value * 100).toFixed(0)} percent`}
            onClick={() => onSelect(row.id)}
          >
            {self ? '--' : Math.round(value * 100)}
          </button>
        )
      })}
    </>
  )
}
