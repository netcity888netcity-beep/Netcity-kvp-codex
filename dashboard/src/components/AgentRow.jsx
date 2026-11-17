import React from 'react';

const TONE = {
  ACTIVE: 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300',
  THINKING: 'border-indigo-400/50 bg-indigo-400/10 text-indigo-300 animate-pulse',
  IDLE: 'border-white/15 bg-white/5 text-slate-400'
};

/** Ряд агентов слоя: мультиагентная система каждой среды. */
export default function AgentRow({ agents = [] }) {
  if (!agents.length) return null;

  return (
    <div className="glass-strip relative flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2">
      <span className="font-mono text-[9px] tracking-[0.16em] text-slate-500">AGENTS</span>
      {agents.map((a) => (
        <span
          key={a.name}
          className={`flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] ${TONE[a.status] || TONE.IDLE}`}
        >
          <span className="h-1 w-1 rounded-full bg-current" />
          {a.name}
          <span className="opacity-60">{a.status}</span>
        </span>
      ))}
    </div>
  );
}
