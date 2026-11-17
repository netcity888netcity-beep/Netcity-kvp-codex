import React from 'react';

const ROWS = [
  { label: 'AGENT ID', value: 'NETCITY-01', tone: 'text-cyan-300' },
  { label: 'OPERATOR', value: 'N. CITY / SESSION 04F2', tone: 'text-slate-200' },
  { label: 'KEY SIGNATURE', value: 'ED25519 VERIFIED', tone: 'text-cyan-300' },
  { label: 'BIOMETRIC LINK', value: 'BIO LAYER BOUND', tone: 'text-emerald-300' },
  { label: 'DIGITAL TWIN', value: 'BOUND / LOCAL ONLY', tone: 'text-emerald-300' },
  { label: 'REMOTE ACCESS', value: 'DENIED', tone: 'text-red-400' },
];

export default function IdentityLayer() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="mat-titanium grid h-12 w-12 shrink-0 place-items-center rounded-full font-mono text-sm font-bold text-slate-900 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)]">
          NC
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[13px] font-bold tracking-[0.14em] text-slate-100">IDENTITY CORE</p>
          <p className="truncate font-mono text-[10px] tracking-[0.14em] text-slate-400">
            подпись · био-привязка · цифровой двойник
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-2 border-t border-white/10 pt-1.5 first:border-0 first:pt-0"
          >
            <span className="font-mono text-[10px] tracking-[0.14em] text-slate-500">{row.label}</span>
            <span className={`flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] ${row.tone}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="glass-pane border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-center font-mono text-[10px] tracking-[0.18em] text-cyan-300">
        OPERATOR OWNS THE DECISION
      </div>
    </div>
  );
}
