import { useEffect, useState } from 'react'
import { ChevronDown, Hexagon, LoaderCircle, Power, Radio, ShieldCheck } from 'lucide-react'

function formatClock(date) {
  return date.toLocaleTimeString('en-GB', { hour12: false })
}

function formatDate(date) {
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

function SpineItem({ label, value, tone = 'text-muted' }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-mono text-[7px] tracking-[0.18em] text-dim">{label}</span>
      <span className={`font-mono text-[8px] font-bold tracking-[0.1em] ${tone}`}>{value}</span>
    </span>
  )
}

function SpineSep() {
  return <span className="h-3 w-px bg-line/70" aria-hidden="true" />
}

export default function TopBar({ now, engineState, onToggle }) {
  const [signalAge, setSignalAge] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setSignalAge((previous) => (engineState === 'ACTIVE' && previous >= 6 ? 0 : previous + 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [engineState])

  const engineTone =
    engineState === 'ACTIVE'
      ? 'border-mint/30 bg-mint/[0.08] text-mint'
      : engineState === 'BOOTING'
        ? 'border-amber/30 bg-amber/[0.08] text-amber'
        : 'border-ice/25 bg-ice/[0.06] text-ice'

  const signalStale = signalAge > 5
  const routeValue = engineState === 'ACTIVE' ? 'CORE-01 ⇄ LOCAL BUS' : 'CORE-01 STANDBY'
  const routeTone = engineState === 'ACTIVE' ? 'text-mint' : 'text-ice'

  return (
    <header className="hud-panel depth-1 relative flex flex-col px-3 sm:px-4">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-mint/25 bg-[linear-gradient(145deg,rgba(125,246,209,0.14),rgba(6,12,16,0.9))] text-mint shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_24px_rgba(125,246,209,0.08)]">
            <Hexagon size={25} strokeWidth={1.25} />
            <span className="absolute font-mono text-[9px] font-bold tracking-[0.02em]">K</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-[0.32em] text-mint">NETCITY</span>
              <span className="h-3 w-px bg-line" />
              <span className="font-mono text-[10px] tracking-[0.18em] text-muted">KVP OS</span>
            </div>
            <p className="truncate font-mono text-[8px] tracking-[0.2em] text-dim">
              AR OPERATOR CONSOLE / NODE CORE-01
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <span className="led led-pulse text-mint" />
            LOCAL SECURE
          </span>
          <span className="chip chip--ice">
            <Radio size={10} strokeWidth={1.8} />
            REMOTE STANDBY
          </span>
          <button
            type="button"
            onClick={onToggle}
            disabled={engineState === 'BOOTING'}
            aria-pressed={engineState === 'ACTIVE'}
            aria-label="Toggle KVP engine"
            className={`chip transition-colors hover:border-mint/45 hover:text-ink disabled:cursor-wait ${engineTone}`}
          >
            {engineState === 'BOOTING' ? (
              <LoaderCircle size={11} strokeWidth={1.8} className="animate-spin" />
            ) : engineState === 'ACTIVE' ? (
              <Power size={11} strokeWidth={1.9} />
            ) : (
              <ShieldCheck size={11} strokeWidth={1.8} />
            )}
            ENGINE {engineState}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <div className="text-right">
            <p className="data-text text-[13px] font-bold leading-none text-ink">{formatClock(now)}</p>
            <p className="mt-1 font-mono text-[8px] tracking-[0.18em] text-dim">{formatDate(now)}</p>
          </div>
          <div className="flex items-center gap-2 rounded-[6px] border border-line/50 bg-black/20 px-2 py-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-mint/30 bg-mint/10 font-mono text-[9px] font-bold text-mint">
              NC
            </span>
            <span className="hidden text-left sm:block">
              <span className="block font-mono text-[9px] tracking-[0.12em] text-ink">N. CITY</span>
              <span className="block font-mono text-[7px] tracking-[0.18em] text-dim">OPERATOR-01</span>
            </span>
            <ChevronDown size={12} className="text-dim" />
          </div>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/40 py-1.5"
        role="group"
        aria-label="Context spine"
      >
        <SpineItem label="IDENTITY" value="OPERATOR-01" tone="text-mint" />
        <SpineSep />
        <SpineItem
          label="SIGNAL"
          value={`${signalAge}s`}
          tone={signalStale ? 'text-amber' : 'text-mint'}
        />
        <SpineSep />
        <SpineItem label="BRANCH" value="main@9f2c" />
        <SpineSep />
        <SpineItem label="ROUTE" value={routeValue} tone={routeTone} />
        <SpineSep />
        <SpineItem label="DATA" value="INTERNAL / READ-MOSTLY" tone="text-ice" />
      </div>
    </header>
  )
}
