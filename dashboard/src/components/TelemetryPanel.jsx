import { useEffect, useRef } from 'react'
import { Activity, Bot, Cpu, Gauge, Radio, Terminal, Zap } from 'lucide-react'

const AGENTS = [
  { name: 'ORCHESTRATOR', route: 'LOCAL', load: 98, tone: 'mint', icon: Cpu },
  { name: 'VISION', route: 'LOCAL', load: 91, tone: 'mint', icon: Gauge },
  { name: 'SYNTHESIS', route: 'REMOTE', load: 84, tone: 'ice', icon: Zap },
]

const TONE_CLASS = {
  mint: 'text-mint',
  ice: 'text-ice',
  amber: 'text-amber',
  danger: 'text-coral',
  muted: 'text-muted',
}

function Stat({ label, value, detail, tone = 'text-ink' }) {
  return (
    <div className="border border-line/40 bg-black/20 px-2 py-2">
      <p className="eyebrow">{label}</p>
      <p className={`data-text mt-1 text-[13px] font-bold leading-none ${tone}`}>{value}</p>
      {detail ? <p className="mt-1 font-mono text-[7px] tracking-[0.14em] text-dim">{detail}</p> : null}
    </div>
  )
}

function TelemetryChart({ series }) {
  const width = 420
  const height = 128
  const points = series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * width
      const y = height - (value / 100) * height
      return `${x},${y}`
    })
    .join(' ')
  const lastValue = series[series.length - 1]
  const lastY = height - (lastValue / 100) * height

  return (
    <div className="relative mt-3 overflow-hidden border border-line/40 bg-black/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Throughput / 60 sec</span>
        <span className="flex items-center gap-1.5 font-mono text-[8px] tracking-[0.12em] text-mint">
          <span className="led led-pulse text-mint" />
          +18.4%
        </span>
      </div>

      <svg
        className="mt-1 h-[108px] w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Live KVP engine throughput telemetry"
      >
        <defs>
          <linearGradient id="telemetry-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7df6d1" stopOpacity="0.28" />
            <stop offset="55%" stopColor="#7df6d1" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#7df6d1" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="telemetry-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7df6d1" stopOpacity="0.35" />
            <stop offset="65%" stopColor="#7df6d1" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#aab7ff" stopOpacity="1" />
          </linearGradient>
        </defs>

        {[25, 50, 75].map((value) => {
          const y = height - (value / 100) * height
          return (
            <line
              key={value}
              x1="0"
              x2={width}
              y1={y}
              y2={y}
              stroke="rgba(125,246,209,0.08)"
              strokeWidth="1"
              strokeDasharray="2 6"
            />
          )
        })}

        <line
          x1="0"
          x2={width}
          y1={height - 0.7 * height}
          y2={height - 0.7 * height}
          stroke="rgba(240,198,110,0.35)"
          strokeWidth="1"
          strokeDasharray="4 5"
        />
        <text x="4" y={height - 0.7 * height - 4} fill="rgba(240,198,110,0.65)" fontSize="7" fontFamily="Space Mono, monospace">
          SLO 70
        </text>

        <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#telemetry-fill)" />
        <polyline
          points={points}
          fill="none"
          stroke="url(#telemetry-line)"
          strokeWidth="1.7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <circle cx={width - 1} cy={lastY} r="7" fill="#7df6d1" opacity="0.14" />
        <circle cx={width - 1} cy={lastY} r="2.6" fill="#7df6d1" />
      </svg>

      <div className="pointer-events-none absolute inset-y-2 right-[22%] w-px bg-gradient-to-b from-transparent via-mint/30 to-transparent" />
    </div>
  )
}

export default function TelemetryPanel({ series, logs, latency, cpu, memory }) {
  const logRef = useRef(null)
  const lastValue = series[series.length - 1]
  const throughput = ((lastValue * 34) / 1000).toFixed(1)

  useEffect(() => {
    const element = logRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [logs])

  return (
    <section className="hud-panel relative">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[5px] border border-mint/20 bg-mint/[0.05] text-mint">
            <Activity size={14} strokeWidth={1.7} />
          </div>
          <div>
            <p className="eyebrow">Perception layer</p>
            <h2 className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink">AGENT TELEMETRY</h2>
          </div>
        </div>
        <span className="chip">
          <span className="led led-pulse text-mint" />
          LIVE
        </span>
      </div>

      <div className="p-3">
        <TelemetryChart series={series} />

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Stat
            label="LATENCY"
            value={`${latency} ms`}
            detail={latency > 26 ? 'ELEVATED' : 'NOMINAL'}
            tone={latency > 26 ? 'text-amber' : 'text-mint'}
          />
          <Stat label="THROUGHPUT" value={`${throughput}k/s`} detail="LOCAL BUS" />
          <Stat label="CPU LOAD" value={`${cpu}%`} detail="8 VCPU" />
          <Stat label="MEMORY" value={`${memory}%`} detail="10.9 GB" />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Agent mesh</span>
            <span className="data-text text-[8px] text-dim">03 NODES</span>
          </div>

          <div className="mt-2 space-y-2">
            {AGENTS.map((agent) => {
              const Icon = agent.icon
              const toneClass = TONE_CLASS[agent.tone]
              return (
                <div key={agent.name} className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center border border-line/50 bg-black/20 ${toneClass}`}>
                    <Icon size={11} strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[8px] tracking-[0.12em] text-ink">{agent.name}</span>
                      <span className={`font-mono text-[7px] tracking-[0.12em] ${toneClass}`}>{agent.route}</span>
                    </div>
                    <div className={`metric-bar mt-1 ${agent.tone === 'ice' ? 'metric-bar--ice' : ''}`}>
                      <span style={{ width: `${agent.load}%` }} />
                    </div>
                  </div>
                  <span className="data-text w-7 text-right text-[8px] text-muted">{agent.load}%</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 eyebrow">
              <Terminal size={10} />
              EVENT STREAM
            </span>
            <span className="chip !px-1.5 !py-1">AUTO 2.2S</span>
          </div>

          <div
            ref={logRef}
            className="hud-scroll mt-2 max-h-[132px] space-y-1.5 overflow-y-auto border border-line/40 bg-black/25 p-2"
          >
            {logs.map((log) => (
              <div key={log.id} className="log-line">
                <span className="text-dim">{log.time}</span>
                <span className={TONE_CLASS[log.tone] ?? 'text-muted'}>{log.tag}</span>
                <span className="min-w-0 truncate text-muted" title={log.message}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-line/30 pt-2">
          <span className="flex items-center gap-1.5 font-mono text-[7px] tracking-[0.14em] text-dim">
            <Bot size={9} />
            3 AGENTS NOMINAL
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[7px] tracking-[0.14em] text-dim">
            <Radio size={9} className="text-mint" />
            LOCAL BUS
          </span>
        </div>
      </div>
    </section>
  )
}
