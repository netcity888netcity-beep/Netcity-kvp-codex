import { ChevronDown, Hexagon, Radio, ShieldCheck } from 'lucide-react'

function formatClock(date) {
  return date.toLocaleTimeString('en-GB', { hour12: false })
}

function formatDate(date) {
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

export default function TopBar({ now, engineState }) {
  const engineTone =
    engineState === 'ACTIVE'
      ? 'border-mint/30 bg-mint/[0.08] text-mint'
      : engineState === 'BOOTING'
        ? 'border-amber/30 bg-amber/[0.08] text-amber'
        : 'border-ice/25 bg-ice/[0.06] text-ice'

  return (
    <header className="hud-panel depth-1 relative flex flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

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
        <span className={`chip ${engineTone}`}>
          <ShieldCheck size={11} strokeWidth={1.8} />
          ENGINE {engineState}
        </span>
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
    </header>
  )
}
