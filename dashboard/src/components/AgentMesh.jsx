import { useMemo, useState } from 'react'
import { Check, Orbit, Radio } from 'lucide-react'
import { linkQuality } from '../data/substrates'
import StateChip from './StateChip'

const CX = 180
const CY = 130
const R = 92

const AGENTS = [
  { id: 'vision', label: 'VISION', route: 'LOCAL', load: 91, hex: '#7df6d1', angle: -90, role: 'Frame and workspace perception.' },
  { id: 'synthesis', label: 'SYNTHESIS', route: 'REMOTE', load: 84, hex: '#aab7ff', angle: -18, role: 'Text and plan synthesis.' },
  { id: 'retrieval', label: 'RETRIEVAL', route: 'LOCAL', load: 88, hex: '#8fe3b0', angle: 54, role: 'Memory and index recall.' },
  { id: 'policy', label: 'POLICY', route: 'LOCAL', load: 76, hex: '#ffb86b', angle: 126, role: 'Scope and consent checks.' },
  { id: 'toolbus', label: 'TOOLBUS', route: 'LOCAL', load: 82, hex: '#b9a3ff', angle: 198, role: 'Tool routing and execution.' },
]

function polar(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

export default function AgentMesh({ engineState = 'IDLE', telemetry, onCommand }) {
  const [selected, setSelected] = useState('vision')
  const [pending, setPending] = useState(false)
  const linked = engineState === 'ACTIVE'
  const quality = linkQuality(telemetry)
  const degraded = quality < 0.72

  function choose(id) {
    setSelected(id)
    setPending(false)
  }

  const nodes = useMemo(
    () => Object.fromEntries(AGENTS.map((agent) => [agent.id, polar(agent.angle, R)])),
    [],
  )

  const current = AGENTS.find((agent) => agent.id === selected) ?? AGENTS[0]

  return (
    <section className="hud-panel relative">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[5px] border border-mint/20 bg-mint/[0.05] text-mint">
            <Orbit size={14} strokeWidth={1.6} />
          </div>
          <div>
            <p className="eyebrow">Assistant layer / mesh</p>
            <h2 className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink">AGENT MESH</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StateChip linked={linked} degraded={degraded} />
          <span className="chip hidden sm:inline-flex">{linked ? 'ROUTING' : 'STANDBY'}</span>
        </div>
      </div>

      <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)] lg:items-start">
        <div className="grid place-items-center">
          <svg
            className="w-full max-w-[400px]"
            viewBox="0 0 360 260"
            role="img"
            aria-label="Agent mesh with orchestrator at the center"
          >
            <circle cx={CX} cy={CY} r="118" fill="none" stroke="rgba(125,246,209,0.07)" strokeWidth="1" />
            <circle cx={CX} cy={CY} r="60" fill="none" stroke="rgba(170,183,255,0.07)" strokeWidth="1" strokeDasharray="2 8" />

            {AGENTS.map((agent) => {
              const node = nodes[agent.id]
              const base = `M${CX},${CY} L${node.x.toFixed(1)},${node.y.toFixed(1)}`
              const active = agent.id === selected
              return (
                <path
                  key={`link-${agent.id}`}
                  d={base}
                  className="mesh-link"
                  stroke={agent.hex}
                  strokeOpacity={active ? 0.85 : linked ? 0.4 : 0.18}
                  strokeWidth={active ? 1.8 : 1.2}
                />
              )
            })}

            <g>
              <circle cx={CX} cy={CY} r="34" className="mesh-node__disc" style={{ color: '#7df6d1' }} />
              <circle cx={CX} cy={CY} r="27" fill="none" stroke="rgba(125,246,209,0.2)" strokeWidth="1" strokeDasharray="1 5" />
              <text x={CX} y={CY - 3} textAnchor="middle" className="mesh-node__label" style={{ fill: 'var(--text-primary)', fontWeight: 700 }}>
                ORCH
              </text>
              <text x={CX} y={CY + 8} textAnchor="middle" className="mesh-node__label" style={{ fontSize: '6px' }}>
                98%
              </text>
            </g>

            {AGENTS.map((agent) => {
              const node = nodes[agent.id]
              const active = agent.id === selected
              return (
                <g
                  key={agent.id}
                  className={`mesh-node ${active ? 'is-active' : ''}`}
                  style={{ color: agent.hex }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  aria-label={`${agent.label} agent`}
                  onClick={() => choose(agent.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      choose(agent.id)
                    }
                  }}
                >
                  <circle cx={node.x} cy={node.y} r="24" className="mesh-node__ring" />
                  <circle cx={node.x} cy={node.y} r="14" className="mesh-node__disc" />
                  <circle cx={node.x} cy={node.y} r="3.4" fill={agent.hex} />
                  <text
                    x={node.x}
                    y={node.y + (agent.angle > 90 || agent.angle < -90 ? 26 : 24)}
                    textAnchor="middle"
                    className="mesh-node__label"
                  >
                    {agent.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-3">
          <div className="neuro-readout p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-bold tracking-[0.16em]" style={{ color: current.hex }}>
                {current.label}
              </span>
              <span className={`chip ${current.route === 'REMOTE' ? 'chip--ice' : ''}`}>{current.route}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{current.role}</p>
            <div className="mt-2.5">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Load</span>
                <span className="data-text text-[9px] text-ink">{current.load}%</span>
              </div>
              <div className="metric-bar mt-1.5">
                <span style={{ width: `${current.load}%`, background: current.hex, boxShadow: `0 0 12px ${current.hex}99` }} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => choose(agent.id)}
                aria-pressed={agent.id === selected}
                className="flex w-full items-center gap-2 border border-line/40 bg-black/20 px-2 py-1.5 text-left transition-colors hover:border-mint/35"
                style={{ borderColor: agent.id === selected ? `${agent.hex}66` : undefined }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: agent.hex, boxShadow: `0 0 8px ${agent.hex}` }} />
                <span className="min-w-0 flex-1 truncate font-mono text-[8px] tracking-[0.12em] text-ink">{agent.label}</span>
                <span className={`font-mono text-[7px] tracking-[0.12em] ${agent.route === 'REMOTE' ? 'text-ice' : 'text-dim'}`}>
                  {agent.route}
                </span>
                <span className="data-text w-7 text-right text-[8px] text-muted">{agent.load}%</span>
              </button>
            ))}
          </div>

          {pending ? (
            <div className="mt-1 border border-ice/40 bg-ice/[0.06] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 eyebrow">
                  <Radio size={10} className="text-ice" />
                  ROUTE PREVIEW
                </span>
                <span className="chip chip--ice">LEAVES CONTOUR</span>
              </div>

              <div className="mt-2 space-y-1.5">
                {[
                  { label: 'ROUTE', value: 'REMOTE PROVIDER', tone: 'text-ice' },
                  { label: 'DATA', value: 'WORKSPACE · 14 OBJECTS', tone: 'text-muted' },
                  { label: 'RISK', value: 'ELEVATED', tone: 'text-amber' },
                  { label: 'REVERSIBLE', value: 'PARTIAL', tone: 'text-muted' },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-2 border-t border-line/30 pt-1.5 first:border-0 first:pt-0"
                  >
                    <span className="font-mono text-[7px] tracking-[0.14em] text-dim">{row.label}</span>
                    <span className={`font-mono text-[7px] font-bold tracking-[0.14em] ${row.tone}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-2 font-mono text-[7px] leading-relaxed tracking-[0.1em] text-dim">
                EXPLICIT APPROVAL REQUIRED. NO REMOTE EXECUTION WITHOUT A CONFIRMED CLICK.
              </p>

              <div className="mt-2.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPending(false)}
                  className="flex-1 border border-line/50 bg-black/20 px-3 py-2 font-mono text-[9px] font-bold tracking-[0.14em] text-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPending(false)
                    onCommand?.(`Remote route approved for ${current.label}; preview accepted, operator owns the decision.`)
                  }}
                  className="flex flex-[2] items-center justify-center gap-2 border border-ice/60 bg-ice/[0.14] px-3 py-2 font-mono text-[9px] font-bold tracking-[0.14em] text-ice transition-colors hover:border-ice/90 hover:bg-ice/[0.22]"
                >
                  <Check size={12} strokeWidth={2.2} />
                  CONFIRM REMOTE RUN
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (current.route === 'REMOTE') {
                  setPending(true)
                  return
                }
                onCommand?.(`Local handshake staged for ${current.label}; local contour only, no egress.`)
              }}
              className={`mt-1 flex w-full items-center justify-center gap-2 border px-3 py-2 font-mono text-[9px] font-bold tracking-[0.16em] transition-colors ${
                current.route === 'REMOTE'
                  ? 'border-ice/45 bg-ice/[0.09] text-ice hover:border-ice/75 hover:bg-ice/[0.16]'
                  : 'border-mint/40 bg-mint/[0.08] text-mint hover:border-mint/70 hover:bg-mint/[0.16]'
              }`}
            >
              <Orbit size={12} strokeWidth={1.9} />
              {current.route === 'REMOTE' ? 'STAGE REMOTE HANDSHAKE' : 'STAGE LOCAL HANDSHAKE'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
