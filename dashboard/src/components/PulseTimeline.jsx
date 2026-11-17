import { useCallback, useEffect, useState } from 'react'
import { Activity, Radio, Zap } from 'lucide-react'
import { SUBSTRATES, linkQuality } from '../data/substrates'
import StateChip from './StateChip'

const KINDS = [
  { id: 'intent', label: 'INTENT', tone: '#8fe3b0' },
  { id: 'evidence', label: 'EVIDENCE', tone: '#7df6d1' },
  { id: 'power', label: 'POWER', tone: '#ffb86b' },
  { id: 'consent', label: 'CONSENT', tone: '#b9a3ff' },
]

function hex(length) {
  return Array.from({ length }, () => '0123456789abcdef'[(Math.random() * 16) | 0]).join('')
}

function makePulse(index) {
  const from = SUBSTRATES[(Math.random() * SUBSTRATES.length) | 0]
  let to = SUBSTRATES[(Math.random() * SUBSTRATES.length) | 0]
  if (to.id === from.id) to = SUBSTRATES[(SUBSTRATES.indexOf(from) + 1) % SUBSTRATES.length]
  const kind = KINDS[(Math.random() * KINDS.length) | 0]
  return {
    id: `${Date.now()}-${index}`,
    time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    from,
    to,
    kind,
    strength: (0.5 + Math.random() * 0.5),
    hash: hex(6),
  }
}

export default function PulseTimeline({ engineState = 'IDLE', telemetry, onCommand }) {
  const [pulses, setPulses] = useState(() => Array.from({ length: 5 }, (_, index) => makePulse(index)))
  const linked = engineState === 'ACTIVE'
  const degraded = linkQuality(telemetry) < 0.72

  const emit = useCallback(
    (announce) => {
      setPulses((previous) => [makePulse(0), ...previous].slice(0, 8))
      if (announce) onCommand?.('Neural pulse emitted across the substrate lattice.')
    },
    [onCommand],
  )

  useEffect(() => {
    if (!linked) return undefined
    const timer = setInterval(() => emit(false), 3400)
    return () => clearInterval(timer)
  }, [linked, emit])

  return (
    <section className="hud-panel relative flex flex-col">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[5px] border border-bio/25 bg-bio/[0.07] text-bio">
            <Activity size={14} strokeWidth={1.7} />
          </div>
          <div>
            <p className="eyebrow">Perception bridge / signal stream</p>
            <h2 className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink">NEURAL PULSES</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StateChip linked={linked} degraded={degraded} />
          <span className="chip hidden sm:inline-flex">
            <Radio size={10} />
            {linked ? 'STREAMING' : 'IDLE'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="neuro-pulse-list space-y-2.5">
          {pulses.map((pulse, index) => (
            <div
              key={pulse.id}
              className={`neuro-pulse ${index === 0 ? 'is-new' : ''}`}
              style={{ '--pulse-tone': pulse.kind.tone }}
            >
              <span className="neuro-pulse__dot" style={{ borderColor: pulse.kind.tone }} />
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="data-text text-[8px] text-dim">{pulse.time}</span>
                  <span className="font-mono text-[8px] font-bold tracking-[0.12em]" style={{ color: pulse.kind.tone }}>
                    {pulse.kind.label}
                  </span>
                </span>
                <span className="data-text text-[8px] text-muted">{pulse.hash}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="flex items-center gap-1 font-mono text-[8px] tracking-[0.1em] text-ink">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: pulse.from.hex }} />
                  {pulse.from.short}
                </span>
                <span className="h-px w-4 bg-gradient-to-r from-mint/40 to-ice/40" />
                <span className="text-mint">&rsaquo;</span>
                <span className="flex items-center gap-1 font-mono text-[8px] tracking-[0.1em] text-ink">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: pulse.to.hex }} />
                  {pulse.to.short}
                </span>
                <span className="ml-auto data-text text-[8px] text-dim">
                  {(pulse.strength * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => emit(true)}
          className="mt-3 flex items-center justify-center gap-2 border border-bio/40 bg-bio/[0.08] px-3 py-2 font-mono text-[9px] font-bold tracking-[0.16em] text-bio transition-colors hover:border-bio/70 hover:bg-bio/[0.16] xl:mt-auto"
        >
          <Zap size={12} strokeWidth={1.9} />
          EMIT NEURAL PULSE
        </button>
      </div>
    </section>
  )
}
