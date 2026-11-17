import React from 'react';

const LOGS = [
  '[SYS] AR Overlay initialized.',
  '[NEURAL] Sync rate: 98.4%.',
  '[KVP] Engine core stable.',
  '[BIO] Sleep phase tracking active.',
  '[IDENTITY] ED25519 signature verified.',
  '[NET] Local channel only — remote denied.'
];

export default function TelemetryPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.14em] text-slate-400">
        <span>AGGREGATED LOG STREAM</span>
        <span className="text-cyan-300">TAIL -F</span>
      </div>
      <div className="glass-card max-h-44 space-y-1 overflow-y-auto rounded p-2 font-mono text-[10px]">
        {LOGS.map((log, idx) => (
          <div key={idx} className="text-green-400">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}
