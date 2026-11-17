import React from 'react';

const DEFAULT_GATEWAY_CONFIG = {
  policy: 'local_only',
  defaultClassification: 'sensitive',
  providers: [
    {
      name: 'mock',
      boundary: 'local',
      enabled: true,
      models: ['mock/local-echo'],
      attestation: 'LEVEL A (mTLS Workload Cert)',
    },
    {
      name: 'github_models',
      boundary: 'remote',
      enabled: false,
      models: [],
      credentialEnv: 'GITHUB_MODELS_TOKEN',
      attestation: 'PROVIDER EVIDENCE ONLY (No KVP Cache Proof)',
    },
  ],
};

export function ModelRoute({ config = DEFAULT_GATEWAY_CONFIG }) {
  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-slate-400">EGRESS POLICY</span>
        <span className="px-2 py-0.5 rounded bg-[#7df6d1]/15 text-[#7df6d1] border border-[#7df6d1]/40">
          {config.policy.toUpperCase()} · DEFAULT:{config.defaultClassification.toUpperCase()}
        </span>
      </div>

      {/* Физическое ребро Trust Boundary */}
      <div className="relative grid grid-cols-1 gap-2.5">
        {config.providers.map((prov) => {
          const isLocal = prov.boundary === 'local';
          return (
            <div
              key={prov.name}
              className={`rounded-lg p-3 border ${
                isLocal
                  ? 'border-[#7df6d1]/40 bg-[#7df6d1]/5'
                  : 'border-[#aab7ff]/30 bg-[#aab7ff]/5'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-100">
                  {prov.name}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    prov.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {prov.enabled ? 'ENABLED' : 'FAIL-CLOSED / DISABLED'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex justify-between">
                <span>BOUNDARY: {prov.boundary.toUpperCase()}</span>
                <span>
                  MODELS: {prov.models.length > 0 ? prov.models.join(', ') : 'NONE'}
                </span>
              </div>

              <div className="mt-1.5 pt-1.5 border-t border-white/5 text-[10px] text-slate-400">
                CLAIM: <span className="text-slate-200">{prov.attestation}</span>
              </div>

              {!isLocal && (
                <div className="mt-1 text-[10px] text-rose-300/90">
                  BLOCKED FOR SENSITIVE PAYLOADS (PolicyViolationError before dispatch)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
