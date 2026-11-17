import React, { useState } from 'react';

const PROPOSED_ACTIONS = [
  {
    id: 'act-1',
    title: 'UPDATE ALLOWLISTED RUNTIME PARAMS',
    domain: 'TECH / RUNTIME',
    risk: 'LOW',
    blocked: false,
    scope: 'Cell-A / Local Adapter vLLM-mock',
    blastRadius: '1 adapter instance, zero session drop',
    policyCheck: 'ALLOW (Role: Operator, Policy v1.4)',
  },
  {
    id: 'act-2',
    title: 'SWITCH ACTIVE MODEL & INVALIDATE CACHE',
    domain: 'FLEET / GOVERNANCE',
    risk: 'HIGH',
    blocked: true,
    blockReason: 'HIGH-RISK: Requires Two-Person Approval & Step-Up Auth (KVP v0 Policy)',
    scope: 'Production Cell-A Fleet',
    blastRadius: 'All active inference sessions drained',
    policyCheck: 'DENY (Missing second independent approval)',
  },
];

export function CitizenContext() {
  const [selectedId, setSelectedId] = useState(PROPOSED_ACTIONS[0].id);
  const [evidenceLog, setEvidenceLog] = useState([]);

  const activeAction =
    PROPOSED_ACTIONS.find((a) => a.id === selectedId) || PROPOSED_ACTIONS[0];

  const handleConfirmGesture = () => {
    if (activeAction.blocked) return;
    const commandId = `cmd-${crypto.randomUUID().slice(0, 8)}`;
    const auditId = `aud-${Date.now().toString(36)}`;
    setEvidenceLog((prev) => [
      {
        commandId,
        auditId,
        title: activeAction.title,
        state: 'COMMAND_STATE_COMPLETED',
        timestamp: new Date().toISOString().slice(11, 19) + 'Z',
      },
      ...prev.slice(0, 3),
    ]);
  };

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Выбор предлагаемого перехода состояния */}
      <div className="grid grid-cols-2 gap-2">
        {PROPOSED_ACTIONS.map((act) => (
          <button
            key={act.id}
            onClick={() => setSelectedId(act.id)}
            className={`text-left p-2 rounded border transition ${
              selectedId === act.id
                ? 'border-[#7df6d1] bg-[#7df6d1]/10 text-white'
                : 'border-white/10 bg-black/30 text-slate-400 hover:border-white/25'
            }`}
          >
            <div className="text-[10px] opacity-75">{act.domain}</div>
            <div className="truncate font-semibold mt-0.5">{act.title}</div>
          </button>
        ))}
      </div>

      {/* ФАЗА 1: PREVIEW */}
      <div className="rounded-lg border border-white/15 bg-black/45 p-3 space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] tracking-widest text-[#7df6d1]">
            PHASE 1 · PREVIEW (IMPACT & POLICY)
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              activeAction.risk === 'HIGH'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            RISK: {activeAction.risk}
          </span>
        </div>

        <div className="text-[11px] text-slate-300">
          <span className="text-slate-500">SCOPE:</span> {activeAction.scope}
        </div>
        <div className="text-[11px] text-slate-300">
          <span className="text-slate-500">BLAST RADIUS:</span> {activeAction.blastRadius}
        </div>
        <div className="text-[11px] text-slate-300">
          <span className="text-slate-500">POLICY:</span> {activeAction.policyCheck}
        </div>

        {activeAction.blocked ? (
          <div className="mt-2 p-2 rounded bg-rose-950/60 border border-rose-500/50 text-rose-200 text-[11px]">
            {activeAction.blockReason}
          </div>
        ) : (
          <button
            onClick={handleConfirmGesture}
            className="mt-2 w-full py-2 rounded bg-[#7df6d1] text-slate-950 font-bold tracking-wider hover:bg-[#5eead4] transition cursor-pointer"
          >
            CONFIRM GESTURE → ISSUE IDEMPOTENT KVP COMMAND
          </button>
        )}
      </div>

      {/* ФАЗА 2: EVIDENCE */}
      <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
        <div className="text-[10px] tracking-widest text-slate-400 mb-1.5">
          PHASE 2 · DURABLE EVIDENCE TRAIL (OUTBOX)
        </div>
        {evidenceLog.length === 0 ? (
          <div className="text-[11px] text-slate-500">
            Awaiting operator confirmation gesture...
          </div>
        ) : (
          <div className="space-y-1">
            {evidenceLog.map((ev) => (
              <div
                key={ev.commandId}
                className="flex items-center justify-between text-[10px] bg-white/5 px-2 py-1 rounded"
              >
                <span className="text-[#7df6d1]">{ev.commandId}</span>
                <span className="text-slate-300 truncate max-w-[160px]">{ev.title}</span>
                <span className="text-emerald-300">{ev.state}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
