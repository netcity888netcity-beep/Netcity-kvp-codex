import {
  Atom,
  CircleHelp,
  Database,
  Hexagon,
  LayoutDashboard,
  Orbit,
  ScrollText,
  Settings2,
  Waypoints,
} from 'lucide-react'

const ITEMS = [
  { id: 'console', label: 'Operator console', icon: LayoutDashboard },
  { id: 'lattice', label: 'Neural lattice', icon: Atom },
  { id: 'agents', label: 'Agent mesh', icon: Orbit },
  { id: 'traces', label: 'Execution traces', icon: Waypoints },
  { id: 'memory', label: 'Local memory', icon: Database },
  { id: 'evidence', label: 'Evidence ledger', icon: ScrollText },
]

export default function IconRail({ active = 'console', onChange }) {
  return (
    <aside className="hud-panel depth-1 flex w-full shrink-0 flex-row items-center gap-1 overflow-x-auto p-2 xl:w-[66px] xl:flex-col xl:overflow-visible xl:py-3">
      <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-mint/25 bg-mint/[0.06] text-mint shadow-[inset_0_0_18px_rgba(125,246,209,0.08)] xl:grid">
        <div className="relative grid place-items-center">
          <Hexagon size={23} strokeWidth={1.4} />
          <span className="absolute font-mono text-[8px] font-bold">K</span>
        </div>
      </div>

      <div className="mx-1 hidden h-px w-8 bg-line/60 xl:block" />

      <div className="flex flex-row items-center gap-1 xl:flex-col">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={active === item.id}
              onClick={() => onChange?.(item.id)}
              className={`rail-item ${active === item.id ? 'active' : ''}`}
            >
              <Icon size={17} strokeWidth={1.5} />
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex flex-row items-center gap-1 xl:ml-0 xl:mt-auto xl:flex-col">
        <button
          type="button"
          title="Help"
          aria-label="Help"
          className="rail-item h-9 w-9"
        >
          <CircleHelp size={16} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          title="Settings"
          aria-label="Settings"
          className="rail-item h-9 w-9"
        >
          <Settings2 size={16} strokeWidth={1.5} />
        </button>
        <span className="hidden h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_10px_rgba(125,246,209,0.9)] xl:block" />
      </div>
    </aside>
  )
}
