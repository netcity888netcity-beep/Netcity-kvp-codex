import React from 'react';

/**
 * Домой-экран: не интерфейс, а карта слоёв.
 * Ничего не открыто — оператор вытягивает нужный слой (как заход в BIOS).
 */
export default function LayerHome({ layers, onOpen }) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-8">
      <div className="mb-7 text-center">
        <p className="font-mono text-[11px] tracking-[0.34em] text-cyan-300/80">SELECT LAYER</p>
        <h1 className="mt-2 font-mono text-xl font-bold tracking-[0.22em] text-slate-200">
          ВЫБЕРИТЕ СЛОЙ
        </h1>
        <p className="mt-1.5 font-mono text-[10px] tracking-[0.14em] text-slate-500">
          каждый слой открывается отдельно — со своим агентом и ассистентом
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {layers.map((l, i) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onOpen(l.id)}
            style={{ animationDelay: `${i * 70}ms` }}
            className="glass-card layer-enter group px-4 py-4 text-left transition-transform duration-200 hover:-translate-y-1 focus:outline-none focus-visible:outline focus-visible:outline-cyan-400"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="border border-cyan-500/50 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] text-cyan-300">
                {l.code}
              </span>
              <span className="font-mono text-[9px] text-cyan-300/60">Z{l.z >= 0 ? '+' : ''}{l.z}</span>
            </div>

            <h2 className="mt-3 font-mono text-[13px] font-bold tracking-[0.16em] text-slate-100 group-hover:text-cyan-200">
              {l.title}
            </h2>
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-slate-500">{l.desc}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {l.agents.map((a) => (
                <span
                  key={a.name}
                  className={`border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] ${
                    a.status === 'ACTIVE'
                      ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
                      : a.status === 'THINKING'
                        ? 'border-indigo-400/40 bg-indigo-400/10 text-indigo-300'
                        : 'border-white/15 bg-white/5 text-slate-500'
                  }`}
                >
                  {a.name}
                </span>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
              <span className="font-mono text-[9px] tracking-[0.16em] text-slate-600">
                {l.metrics[0].label} {l.metrics[0].value}
              </span>
              <span className="font-mono text-[10px] tracking-[0.18em] text-cyan-400/80 group-hover:text-cyan-300">
                ОТКРЫТЬ ▸
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
