import React, { useState } from 'react';

export default function CentralEngine() {
  const [isActive, setIsActive] = useState(false);

  return (
    <div className="relative flex h-56 items-center justify-center">
      {/* Статичный титановый обод + карбоновое полотно */}
      <div className="absolute inset-x-0 top-0 mx-auto h-48 w-48">
        <div className="absolute inset-0 rounded-full mat-titanium mat-grain" />
        <div className="absolute inset-[7px] rounded-full mat-carbon border border-black/50 shadow-[inset_0_6px_18px_rgba(0,0,0,0.85)]" />
      </div>

      {/* Декоративные кольца (кнопка НЕ вращается вместе с ними) */}
      <div className={`absolute inset-x-0 top-0 mx-auto h-48 w-48 ${isActive ? 'animate-spin' : ''}`}>
        <div className="absolute inset-[14px] rounded-full border border-dashed border-cyan-500/40" />
        <div className="absolute inset-[22px] rounded-full border border-cyan-500/50 animate-pulse" />
        <div className="absolute -top-1 -left-1 h-4 w-4 border-t-2 border-l-2 border-cyan-400" />
        <div className="absolute -top-1 -right-1 h-4 w-4 border-t-2 border-r-2 border-cyan-400" />
        <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-cyan-400" />
        <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-cyan-400" />
      </div>

      {/* Центральная тактильная кнопка — отдельный слой, всегда кликабельна */}
      <button
        type="button"
        aria-pressed={isActive}
        onClick={() => setIsActive((v) => !v)}
        className={`absolute inset-x-0 top-0 mx-auto flex h-32 w-32 touch-manipulation flex-col items-center justify-center rounded-full border-2 font-bold transition-all active:scale-95 ${
          isActive
            ? 'border-cyan-300 bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_40px_rgba(0,240,255,0.8)]'
            : 'border-slate-600/80 bg-slate-950/70 text-cyan-400 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),0_0_20px_rgba(0,240,255,0.25)] hover:border-cyan-500'
        }`}
      >
        <span className="text-[10px] tracking-widest opacity-80">KVP ENGINE</span>
        <span className="mt-1 text-lg tracking-wider">{isActive ? 'ONLINE' : 'STANDBY'}</span>
      </button>
    </div>
  );
}
