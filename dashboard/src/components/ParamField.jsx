import React from 'react';

const STATE_STYLES = {
  CALM: {
    bar: 'bg-[#7df6d1] shadow-[0_0_16px_rgba(125,246,209,0.55)]',
    badge: 'text-[#7df6d1] border-[#7df6d1]/30 bg-[#7df6d1]/10',
  },
  DRIFT: {
    bar: 'bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.55)]',
    badge: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  },
  HOT: {
    bar: 'bg-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.65)]',
    badge: 'text-rose-300 border-rose-500/40 bg-rose-500/15',
  },
};

export function ParamField({ streams = [], isFocused = false }) {
  return (
    <div className="space-y-3" style={{ transformStyle: 'preserve-3d' }}>
      {streams.map((stream, idx) => {
        const style = STATE_STYLES[stream.state] || STATE_STYLES.CALM;
        const zOffset = isFocused ? (idx + 1) * 8 : 0;

        return (
          <div
            key={stream.id}
            className="relative rounded-lg border border-white/10 bg-black/35 p-2.5 transition-transform duration-300"
            style={{ transform: `translateZ(${zOffset}px)` }}
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-300 tracking-wider">
                  {stream.label}
                </span>
                <span className="text-[10px] text-slate-500">
                  {stream.scaleHint}
                </span>
              </div>
              <span
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${style.badge}`}
              >
                {stream.state}
              </span>
            </div>

            {/* 3D световой луч состояния */}
            <div className="h-2 w-full rounded-full bg-slate-900/90 overflow-hidden p-[1px] border border-white/5">
              <div
                className={`h-full rounded-full param-beam ${style.bar}`}
                style={{ width: `${Math.min(100, Math.max(4, stream.intensity))}%` }}
              />
            </div>

            {isFocused && (
              <div className="mt-1.5 flex justify-between text-[10px] font-mono text-slate-400">
                <span>AGENT: {stream.agentTranslator}</span>
                <span>ATTESTATION: {stream.attestationLevel}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
