import React from 'react';

/**
 * Объёмная HUD-плашка одного слоя: полупрозрачное стекло поверх зрения,
 * угловые скобки, индикатор глубины Z.
 */
export default function Plate({ code, title, z = 0, focused = false, telemetry = null, actions = null, style = null, className = '', bodyClassName = '', children }) {
  const bracket = 'pointer-events-none absolute h-4 w-4 border-cyan-300/70';

  return (
    <section
      className={`hud-panel layer-float ${focused ? 'hud-panel--focus' : ''} ${className}`}
      style={{ transformStyle: 'preserve-3d', ...(style || {}) }}
    >
      <span className={`${bracket} -top-px -left-px border-t border-l`} />
      <span className={`${bracket} -top-px -right-px border-t border-r`} />
      <span className={`${bracket} -bottom-px -left-px border-b border-l`} />
      <span className={`${bracket} -bottom-px -right-px border-b border-r`} />

      <header className="glass-strip relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="whitespace-nowrap border border-cyan-500/50 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] text-cyan-300">
            {code}
          </span>
          <h2 className="truncate font-mono text-[11px] font-bold tracking-[0.16em] text-slate-200 uppercase">
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden font-mono text-[9px] tracking-[0.14em] text-cyan-300/70 sm:inline">
            Z{z >= 0 ? '+' : ''}{z}
          </span>
          <div className="flex items-center gap-1.5">{actions}</div>
        </div>
      </header>

      {telemetry}

      <div className={`relative ${bodyClassName || 'p-4'}`}>{children}</div>
    </section>
  );
}
