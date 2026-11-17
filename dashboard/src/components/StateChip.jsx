const TONE = {
  LINKED: { chip: '', led: 'text-mint' },
  OBSERVING: { chip: 'chip--ice', led: 'text-ice' },
  DEGRADED: { chip: 'chip--amber', led: 'text-amber' },
}

export function resolveState({ linked = false, degraded = false } = {}) {
  if (degraded) return 'DEGRADED'
  return linked ? 'LINKED' : 'OBSERVING'
}

export default function StateChip({ linked = false, degraded = false, label }) {
  const state = resolveState({ linked, degraded })
  const tone = TONE[state]

  return (
    <span className={`chip ${tone.chip}`} title={state}>
      <span className={`led led-pulse ${tone.led}`} />
      {label ?? state}
    </span>
  )
}
