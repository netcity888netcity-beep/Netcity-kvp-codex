import React from 'react';

const FLOWS = [
  { label: 'BATTERY', pct: 76, value: '76%' },
  { label: 'SOLAR IN', pct: 18, value: '18%' },
  { label: 'DRAW', pct: 42, value: '4.2W' },
  { label: 'RESERVE', pct: 60, value: '3h 40m' }
];

const STATES = [
  { label: 'THERMAL', value: '41°C · OK', tone: 'text-cyan-300' },
  { label: 'CHARGE CYCLE', value: '312', tone: 'text-slate-300' },
  { label: 'SUSTAIN MODE', value: 'ENGAGED', tone: 'text-emerald-300' }
];

/** Энергетическая среда. */
export default function EnergyLayer() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {FLOWS.map((f) => (
          <div key={f.label} className="glass-card rounded px-3 py-2">
            <div className="flex items-baseline justify-between font-mono text-[9px] tracking-[0.14em]">
              <span className="text-slate-500">{f.label}</span>
              <span className="text-cyan-300">{f.value}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full border border-white/10 bg-black/70">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                style={{ width: `${f.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {STATES.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between border-t border-white/10 pt-1.5 first:border-0 first:pt-0"
          >
            <span className="font-mono text-[10px] tracking-[0.14em] text-slate-500">{s.label}</span>
            <span className={`font-mono text-[10px] tracking-[0.12em] ${s.tone}`}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
