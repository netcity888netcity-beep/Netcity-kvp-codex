import React from 'react';

/** Телеметрия конкретного слоя: полосы метрик в шапке плашки. */
export default function LayerTelemetry({ metrics = [] }) {
  if (!metrics.length) return null;

  return (
    <div className="glass-strip relative grid grid-cols-3 gap-3 border-b border-white/10 px-4 py-2">
      {metrics.map((m) => (
        <div key={m.label} className="min-w-0">
          <div className="flex items-baseline justify-between gap-1 font-mono text-[9px] tracking-[0.14em]">
            <span className="truncate text-slate-500">{m.label}</span>
            <span className="shrink-0 text-cyan-300">{m.value}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full border border-white/10 bg-black/60">
            <div
              className={`h-full ${m.pct >= 70 ? 'bg-cyan-400' : m.pct >= 30 ? 'bg-cyan-500/70' : 'bg-slate-500'}`}
              style={{ width: `${Math.max(2, Math.min(100, m.pct))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
