import React, { useState, useEffect } from 'react';
import { ParamField } from './ParamField';
import { ModelRoute } from './ModelRoute';
import { CitizenContext } from './CitizenContext';

const AR_LAYERS = [
  {
    id: 'core',
    code: '01 // ЯДРО',
    title: 'KVP KERNEL & TRUST SPINE',
    agent: 'Kernel-Sentinel-01',
    slotPosition: { x: 0, y: 0 },
    streams: [
      {
        id: 'kvp-seq',
        label: 'SESSION SEQUENCE & REPLAY GUARD',
        scaleHint: '1.4B state vectors → 1 invariant',
        state: 'CALM',
        intensity: 92,
        agentTranslator: 'Kernel-Sentinel-01',
        attestationLevel: 'LEVEL A (mTLS)',
      },
      {
        id: 'pg-outbox',
        label: 'POSTGRESQL COMMAND & AUDIT OUTBOX',
        scaleHint: 'Serializable Tx Queue',
        state: 'CALM',
        intensity: 88,
        agentTranslator: 'Audit-Keeper',
        attestationLevel: 'DURABLE SINK OK',
      },
    ],
  },
  {
    id: 'tech',
    code: '02 // ТЕХ',
    title: 'MODEL GATEWAY & FLEET FABRIC',
    agent: 'Router-Architect',
    slotPosition: { x: -340, y: -90 },
    streams: [
      {
        id: 'local-vllm',
        label: 'LOCAL ADAPTER BOUNDARY (vLLM / MOCK)',
        scaleHint: '8.2B weights · local_only',
        state: 'CALM',
        intensity: 76,
        agentTranslator: 'Router-Architect',
        attestationLevel: 'LEVEL A',
      },
      {
        id: 'drift-check',
        label: 'ARCHITECT OS DRIFT ANALYZER',
        scaleHint: 'Graph v2.4 vs Observed',
        state: 'DRIFT',
        intensity: 54,
        agentTranslator: 'Drift-Watcher',
        attestationLevel: 'OBSERVED',
      },
    ],
  },
  {
    id: 'civic',
    code: '03 // CIVIC',
    title: 'GOVERNANCE & PREVIEW/EVIDENCE',
    agent: 'Policy-Arbiter',
    slotPosition: { x: 340, y: -90 },
    streams: [
      {
        id: 'policy-gate',
        label: 'FAIL-CLOSED AUTHORIZATION ENGINE',
        scaleHint: 'Deny-by-default active',
        state: 'CALM',
        intensity: 96,
        agentTranslator: 'Policy-Arbiter',
        attestationLevel: 'SIGNED SNAPSHOT',
      },
    ],
  },
  {
    id: 'energy',
    code: '04 // ЭНЕРГИЯ',
    title: 'COMPUTE & THERMAL ENVELOPE',
    agent: 'Thermo-Balancer',
    slotPosition: { x: -360, y: 140 },
    streams: [
      {
        id: 'gpu-envelope',
        label: 'TENSOR CLUSTER POWER & QUOTA',
        scaleHint: '420W / 600W ceiling',
        state: 'DRIFT',
        intensity: 68,
        agentTranslator: 'Thermo-Balancer',
        attestationLevel: 'HARDWARE TELEMETRY',
      },
    ],
  },
  {
    id: 'bio',
    code: '05 // БИО',
    title: 'OPERATOR COGNITIVE LOAD & GAZE',
    agent: 'BioLink-Bridge',
    slotPosition: { x: 360, y: 140 },
    streams: [
      {
        id: 'focus-index',
        label: 'VISUAL FIELD CLARITY & FOCUS',
        scaleHint: 'Low occlusion · Gaze locked',
        state: 'CALM',
        intensity: 84,
        agentTranslator: 'BioLink-Bridge',
        attestationLevel: 'LOCAL SENSOR',
      },
    ],
  },
  {
    id: 'info',
    code: '06 // INFO',
    title: 'CONTEXT & ARTIFACT STREAM',
    agent: 'Context-Weaver',
    slotPosition: { x: -190, y: 230 },
    streams: [
      {
        id: 'ctx-refs',
        label: 'CLASSIFIED CONTEXT REFERENCES',
        scaleHint: 'Sensitive · Zero-Egress',
        state: 'CALM',
        intensity: 62,
        agentTranslator: 'Context-Weaver',
        attestationLevel: 'REDACTED',
      },
    ],
  },
  {
    id: 'ident',
    code: '07 // IDENT',
    title: 'PKI & CERTIFICATE ROTATION',
    agent: 'Vault-Warden',
    slotPosition: { x: 190, y: 230 },
    streams: [
      {
        id: 'spiffe-id',
        label: 'SPIFFE WORKLOAD & OPERATOR SAN',
        scaleHint: 'TTL 14m 20s · Overlap ready',
        state: 'CALM',
        intensity: 91,
        agentTranslator: 'Vault-Warden',
        attestationLevel: 'TLS 1.3 mTLS',
      },
    ],
  },
];

export function KvpHud() {
  const [focusedId, setFocusedId] = useState('core');
  const [locked, setLocked] = useState(false);
  const [gazeOffset, setGazeOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (locked) return;
    const onMouseMove = (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      setGazeOffset({ x: nx, y: ny });
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [locked]);

  const focusedIndex = AR_LAYERS.findIndex((l) => l.id === focusedId);

  return (
    <div
      className="ar-stage"
      style={{
        '--rx': `${(-gazeOffset.y * 5).toFixed(2)}deg`,
        '--ry': `${(gazeOffset.x * 7).toFixed(2)}deg`,
        '--gx': `${(gazeOffset.x * 40).toFixed(1)}px`,
        '--gy': `${(gazeOffset.y * 30).toFixed(1)}px`,
      }}
    >
      {/* ВЕРХНИЙ АППАРАТНЫЙ CONTEXT SPINE */}
      <header className="fixed top-4 left-6 right-6 z-50 flex items-center justify-between px-4 py-2 rounded-full hud-glass-mid font-mono text-[11px]">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-[#7df6d1] animate-scan" />
          <span className="font-bold tracking-widest text-white">
            NETCITY KVP OS // AR-HUD
          </span>
          <span className="text-slate-400 hidden md:inline">
            APPLIANCE: DEBIAN-13 IMMUTABLE · SLOT [A] ACTIVE
          </span>
        </div>

        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-emerald-300">UEFI SECURE BOOT: VERIFIED</span>
          <span className="text-emerald-300 hidden sm:inline">TPM 2.0: MEASURED</span>
          <span className="text-[#7df6d1]">READINESS: PASS</span>
          <button
            onClick={() => setLocked((v) => !v)}
            className={`px-2.5 py-0.5 rounded border cursor-pointer ${
              locked
                ? 'border-amber-400 text-amber-300 bg-amber-400/15'
                : 'border-white/20 text-slate-300 hover:border-white/40'
            }`}
          >
            {locked ? 'GAZE LOCKED' : 'GAZE ACTIVE'}
          </button>
        </div>
      </header>

      {/* 3D-МИР СЛОЁВ ВОКРУГ ЗРЕНИЯ ОПЕРАТОРА */}
      <main className="ar-world flex items-center justify-center">
        {AR_LAYERS.map((layer, index) => {
          const isFocused = layer.id === focusedId;
          const dist = Math.abs(index - focusedIndex);
          const isMidPlane = !isFocused && (dist === 1 || dist === 2);

          // Естественная глубина без искусственной компенсации масштаба
          let z = -420;
          let scale = 0.56;
          let opacity = 0.42;
          let planeClass = 'hud-glass-far';
          let x = layer.slotPosition.x * 1.15 - gazeOffset.x * 18;
          let y = layer.slotPosition.y * 1.15 - gazeOffset.y * 14;

          if (isFocused) {
            z = 110;
            scale = 1.0;
            opacity = 1;
            planeClass = 'hud-glass-focal';
            x = -gazeOffset.x * 45;
            y = -gazeOffset.y * 32;
          } else if (isMidPlane) {
            z = -160;
            scale = 0.78;
            opacity = 0.78;
            planeClass = 'hud-glass-mid';
            x = layer.slotPosition.x - gazeOffset.x * 28;
            y = layer.slotPosition.y - gazeOffset.y * 20;
          }

          return (
            <section
              key={layer.id}
              onClick={() => setFocusedId(layer.id)}
              style={{
                transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${scale})`,
                opacity,
                zIndex: isFocused ? 40 : isMidPlane ? 20 : 10,
              }}
              className={`absolute w-[440px] max-w-[92vw] rounded-2xl p-5 transition-all duration-500 ease-out cursor-pointer ${planeClass}`}
            >
              {/* Заголовок слоя и агент-переводчик */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-[#7df6d1]">
                    {layer.code} · Z:{z}px
                  </div>
                  <h2 className="text-sm font-bold tracking-wide text-white">
                    {layer.title}
                  </h2>
                </div>
                <div className="text-right font-mono">
                  <div className="text-[10px] text-slate-400">AGENT</div>
                  <div className="text-[11px] text-[#aab7ff]">{layer.agent}</div>
                </div>
              </div>

              {/* Световая интерпретация параметров (всегда видна) */}
              <ParamField streams={layer.streams} isFocused={isFocused} />

              {/* Детальные интерфейсы раскрываются только в фокальной плоскости */}
              {isFocused && layer.id === 'tech' && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <ModelRoute />
                </div>
              )}

              {isFocused && layer.id === 'civic' && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <CitizenContext />
                </div>
              )}

              {!isFocused && (
                <div className="mt-3 text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>CLICK OR SHIFT GAZE TO BRING TO FOCAL PLANE</span>
                  <span>{isMidPlane ? 'MID-PLANE' : 'PERIPHERY'}</span>
                </div>
              )}
            </section>
          );
        })}
      </main>

      {/* НИЖНЯЯ ПАНЕЛЬ БЫСТРОГО ВЫБОРА СЛОЁВ */}
      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full hud-glass-mid font-mono text-[11px]">
        {AR_LAYERS.map((layer) => {
          const active = layer.id === focusedId;
          return (
            <button
              key={layer.id}
              onClick={() => setFocusedId(layer.id)}
              className={`px-3 py-1 rounded-full transition cursor-pointer ${
                active
                  ? 'bg-[#7df6d1] text-slate-950 font-bold shadow-[0_0_16px_rgba(125,246,209,0.5)]'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              {layer.code.split('// ')[1]}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
