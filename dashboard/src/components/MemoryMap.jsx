import { useMemo, useState } from 'react'
import { Database, Search } from 'lucide-react'

const NAMESPACES = [
  { id: 'workspace', label: 'WORKSPACE', count: 38, hex: '#7df6d1', sample: 'src/views/LatticeView.jsx' },
  { id: 'agents', label: 'AGENTS', count: 24, hex: '#8fe3b0', sample: 'mesh.handshake / policy.gate' },
  { id: 'evidence', label: 'EVIDENCE', count: 19, hex: '#aab7ff', sample: '9f2c:7a41:be03:5dd8:e41a' },
  { id: 'kvp-core', label: 'KVP CORE', count: 16, hex: '#b9a3ff', sample: 'crates/kvp-core/src/engine.rs' },
  { id: 'docs', label: 'DOCS', count: 12, hex: '#ffb86b', sample: 'docs/kvp-architecture.md' },
  { id: 'design', label: 'DESIGN', count: 9, hex: '#ff8893', sample: 'design/concepts/ar-hud-assistant-os' },
  { id: 'proto', label: 'PROTO', count: 6, hex: '#7df6d1', sample: 'proto/netcity/kvp/v1/control.proto' },
]

const TOTAL = NAMESPACES.reduce((sum, namespace) => sum + namespace.count, 0)

function seededShuffle(list, seed = 7) {
  const result = [...list]
  let state = seed
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    const swap = state % (index + 1)
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

export default function MemoryMap({ engineState = 'IDLE', onCommand }) {
  const [selected, setSelected] = useState('workspace')

  const field = useMemo(() => {
    const cells = []
    for (const namespace of NAMESPACES) {
      for (let index = 0; index < namespace.count; index += 1) cells.push(namespace.id)
    }
    return seededShuffle(cells)
  }, [])

  const namespaceById = useMemo(
    () => Object.fromEntries(NAMESPACES.map((namespace) => [namespace.id, namespace])),
    [],
  )

  const current = namespaceById[selected]

  return (
    <section className="hud-panel relative flex flex-1 flex-col">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[5px] border border-mint/20 bg-mint/[0.05] text-mint">
            <Database size={14} strokeWidth={1.6} />
          </div>
          <div>
            <p className="eyebrow">Orientation layer / local index</p>
            <h2 className="font-mono text-[11px] font-bold tracking-[0.16em] text-ink">LOCAL MEMORY</h2>
          </div>
        </div>
        <span className="chip">
          <span className="led led-pulse text-mint" />
          {TOTAL} OBJECTS
        </span>
      </div>

      <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.6fr)] lg:items-start">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Semantic field</span>
            <span className="data-text text-[8px] text-dim">LOCAL-ONLY / NO EGRESS</span>
          </div>

          <div
            className="mt-2 grid gap-1"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(14px, 1fr))' }}
            role="list"
            aria-label="Indexed memory objects"
          >
            {field.map((namespaceId, index) => {
              const namespace = namespaceById[namespaceId]
              const active = namespaceId === selected
              return (
                <button
                  key={`${namespaceId}-${index}`}
                  type="button"
                  role="listitem"
                  title={`${namespace.label} · ${namespace.sample}`}
                  aria-label={`${namespace.label} memory object`}
                  onClick={() => setSelected(namespaceId)}
                  className="memory-cell aspect-square"
                  style={{
                    background: active ? `${namespace.hex}40` : `${namespace.hex}18`,
                    borderColor: active ? `${namespace.hex}aa` : undefined,
                    boxShadow: active ? `0 0 8px ${namespace.hex}66` : undefined,
                  }}
                />
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-line/30 pt-2">
            <span className="flex items-center gap-1.5 font-mono text-[7px] tracking-[0.12em] text-dim">
              <Search size={9} />
              {current.sample}
            </span>
            <span className="data-text text-[8px]" style={{ color: current.hex }}>
              {current.count} / {TOTAL}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {NAMESPACES.map((namespace) => (
            <button
              key={namespace.id}
              type="button"
              onClick={() => setSelected(namespace.id)}
              aria-pressed={namespace.id === selected}
              className="flex w-full items-center gap-2 border border-line/40 bg-black/20 px-2 py-1.5 text-left transition-colors hover:border-mint/35"
              style={{ borderColor: namespace.id === selected ? `${namespace.hex}66` : undefined }}
            >
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: namespace.hex, boxShadow: `0 0 8px ${namespace.hex}` }} />
              <span className="min-w-0 flex-1 truncate font-mono text-[8px] tracking-[0.12em] text-ink">{namespace.label}</span>
              <span className="data-text text-[8px] text-muted">{namespace.count}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => onCommand?.(`Reindexing local memory for ${current.label}; read-only, no remote calls.`)}
            className="mt-1 flex items-center justify-center gap-2 border border-mint/40 bg-mint/[0.08] px-3 py-2 font-mono text-[9px] font-bold tracking-[0.16em] text-mint transition-colors hover:border-mint/70 hover:bg-mint/[0.16]"
          >
            <Database size={12} strokeWidth={1.9} />
            REINDEX {current.label}
          </button>
        </div>
      </div>
    </section>
  )
}
