import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  Component,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  MeshTransmissionMaterial,
  Environment,
  Lightformer,
  RoundedBox,
  Edges,
} from '@react-three/drei';
import * as THREE from 'three';
import { dampingFactor, isPortraitSize, PORTRAIT_DOM, portraitDomFit, portraitTargets, pxToWorld } from '../spatial/layout.js';
import { composeSpatialScene } from '../spatial/compositor.js';
import {
  WORLD_STORAGE_KEY,
  enterLayer,
  restoreWorld,
  serializeWorld,
  worldTheme,
  worldToScene,
} from '../spatial/world.js';
import { ParamField } from './ParamField';
import { ModelRoute } from './ModelRoute';
import { CitizenContext } from './CitizenContext';
import { SpatialObjectNode } from './SpatialObject.jsx';
import { AR_LAYERS, KvpHud as KvpHudCSS } from './KvpHud';
import { ArchitectRuntime } from '../architect/ArchitectCore.js';
import { routeIntent } from '../architect/IntentRouter.js';
import { LayerAgent } from '../architect/LayerAgent.js';

const LAYER_IDS = new Set(AR_LAYERS.map((layer) => layer.id));

function readStoredWorld() {
  try {
    return window.localStorage.getItem(WORLD_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

/* Геометрия пространственных планов (единицы Three.js, камера z=7, fov 42) */
const PLANE_FOCAL = { key: 'focal', z: 0.9, dom: 1, w: 2.45, h: 1.72, ppu: 192 };
const PLANE_MID = { key: 'mid', z: -1.2, dom: 0.78, w: 2.35, h: 1.62, ppu: 143 };
const PLANE_FAR = { key: 'far', z: -3.0, dom: 0.56, w: 2.1, h: 1.45, ppu: 117 };

const GLASS_CLASSES = {
  focal: 'hud-glass-focal',
  mid: 'hud-glass-mid',
  far: 'hud-glass-far',
};

const PLANE_Z = { focal: 40, mid: 24, far: 12 };

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch (e) {
    return false;
  }
}

/* ---------- Содержимое слоя (тот же DOM, что и в CSS-версии) ---------- */
function SlotContent({ layer, isFocused, plane, focusedId, setFocusedId }) {
  const dist = Math.abs(
    AR_LAYERS.findIndex((l) => l.id === layer.id) -
      AR_LAYERS.findIndex((l) => l.id === focusedId),
  );
  const isMidPlane = !isFocused && (dist === 1 || dist === 2);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setFocusedId(layer.id);
      }}
      className={`cursor-pointer rounded-2xl p-5 ${GLASS_CLASSES[plane.key]}`}
      style={{ width: 440, maxWidth: '92vw' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] font-mono tracking-widest text-[#7df6d1]">
            {layer.code} · Z:{plane.z}
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

      <ParamField streams={layer.streams} isFocused={isFocused} />

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
    </div>
  );
}

/* ---------- 3D-слой: меш (текст живёт в DOM-оверлее) ---------- */
function LayerNode({
  layer,
  plane,
  isFocused,
  setFocusedId,
  index,
  groupRegistry,
  slotRegistry,
  focusedId,
  activeAccent = '#7df6d1',
  objects = [],
}) {
  const groupRef = useRef();
  const anchorRef = useRef();
  const phase = index * 1.37;
  const posZ = plane.z;

  useEffect(() => {
    groupRegistry.current[layer.id] = groupRef.current;
    return () => {
      delete groupRegistry.current[layer.id];
    };
  }, [layer.id, groupRegistry]);

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const { camera, size } = state;
    const t = state.clock.elapsedTime;
    let wx;
    let wy;

    if (isPortraitSize(size.width, size.height)) {
      const targets = portraitTargets(
        focusedId,
        size.width,
        size.height,
        slotRegistry,
        AR_LAYERS,
      );
      const target = targets[layer.id];
      const [twx, twy] = pxToWorld(
        target ? target.x : size.width / 2,
        target ? target.y : size.height / 2,
        plane.z,
        camera,
        size,
      );
      wx = twx;
      wy = twy;
    } else {
      wx = isFocused ? 0 : layer.slotPosition.x / plane.ppu;
      wy = isFocused ? 0 : -layer.slotPosition.y / plane.ppu;
      if (!isFocused) {
        wx += Math.cos(t * 0.45 + phase) * 0.02;
        wy += Math.sin(t * 0.6 + phase) * 0.035;
      }
    }

    const k = dampingFactor(dt || 0.016, 5);
    g.position.x += (wx - g.position.x) * k;
    g.position.y += (wy - g.position.y) * k;
    g.position.z = posZ;

    /* Якорная группа пространственных объектов: без масштабирования DOM */
    const a = anchorRef.current;
    if (a) {
      a.position.x += (wx - a.position.x) * k;
      a.position.y += (wy - a.position.y) * k;
      a.position.z = posZ;
    }
  });

  const onFocus = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setFocusedId(layer.id);
  };

  return (
    <>
      <group ref={groupRef} position={[0, 0, posZ]}>
        {plane.key === 'focal' ? (
          <RoundedBox
            args={[plane.w, plane.h, 0.14]}
            radius={0.055}
            smoothness={4}
            onClick={onFocus}
          >
            <MeshTransmissionMaterial
              samples={4}
              resolution={256}
              transmission={1}
              thickness={0.55}
              roughness={0.06}
              chromaticAberration={0.06}
              anisotropicBlur={0.25}
              distortion={0.12}
              distortionScale={0.25}
              temporalDistortion={0.04}
              color="#0a1218"
              attenuationDistance={0.7}
              attenuationColor="#0e2f28"
              backside={false}
            />
          </RoundedBox>
        ) : (
          <RoundedBox
            args={[plane.w, plane.h, 0.08]}
            radius={0.04}
            smoothness={3}
            onClick={onFocus}
          >
            <meshStandardMaterial
              color="#0b1118"
              metalness={0.92}
              roughness={0.26}
              envMapIntensity={1.1}
              transparent
              opacity={plane.key === 'far' ? 0.86 : 1}
            />
          </RoundedBox>
        )}

        <Edges
          scale={1.02}
          threshold={15}
          color={plane.key === 'focal' ? activeAccent : '#3f6f66'}
          style={{
            transparent: true,
            opacity: plane.key === 'focal' ? 0.55 : 0.3,
          }}
        />
      </group>

      {/* Постоянные пространственные объекты слоя (существуют всегда) */}
      <group ref={anchorRef} position={[0, 0, posZ]}>
        {objects.map((item, objectIndex) => (
          <SpatialObjectNode
            key={item.id}
            object={{
              id: item.id,
              form: item.metadata.form,
              position: item.world.position,
              scale: item.world.scale.x,
            }}
            accent={item.metadata.accent}
            active={isFocused}
            phase={objectIndex * 1.7 + index}
            onSelect={onFocus}
          />
        ))}
      </group>
    </>
  );
}

/* ---------- Проекция 3D → DOM-оверлей (без порталов drei) ---------- */
function Projection({ groupRegistry, slotRegistry, planeForRef, layers }) {
  const { camera, size } = useThree();
  const vec = useMemo(() => new THREE.Vector3(), []);
  let dbgFrames = 0;

  useFrame((state, dt) => {
    const k = Math.min(1, dt * 6);
    const cx = size.width / 2;
    const cy = size.height / 2;

    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    dbgFrames = (dbgFrames || 0) + 1;
    const remeasure = dbgFrames % 12 === 1;

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const group = groupRegistry.current[layer.id];
      const slot = slotRegistry.current[layer.id];
      if (!group || !slot || !slot.el) continue;

      const plane = planeForRef.current(layer, i);

      /* Пересчёт размеров меша под фактический DOM-контент */
      if (remeasure) {
        const content = slot.inner && slot.inner.firstElementChild;
        if (content && content.clientWidth > 0) {
          slot.cw = content.clientWidth;
          slot.ch = content.clientHeight;
        }
      }
      if (slot.cw) {
        const depth = camera.position.z - plane.z;
        const worldPerPx = (2 * depth * tanHalf) / size.height;
        const targetSX = (slot.cw * plane.dom * 1.05 * worldPerPx) / plane.w;
        const targetSY = (slot.ch * plane.dom * 1.05 * worldPerPx) / plane.h;
        group.scale.x += (targetSX - group.scale.x) * k;
        group.scale.y += (targetSY - group.scale.y) * k;
      }

      group.getWorldPosition(vec).project(camera);
      const tx = (vec.x * 0.5 + 0.5) * size.width;
      const ty = (-vec.y * 0.5 + 0.5) * size.height;

      if (!slot.init) {
        slot.x = cx;
        slot.y = cy;
        slot.s = plane.dom;
        slot.init = true;
      }

      slot.x += (tx - slot.x) * k;
      slot.y += (ty - slot.y) * k;
      slot.s += (plane.dom - slot.s) * k;

      slot.el.style.transform = `translate3d(${slot.x.toFixed(2)}px, ${slot.y.toFixed(2)}px, 0)`;
      if (slot.inner) {
        slot.inner.style.transform = `translate(-50%, -50%) scale(${slot.s.toFixed(3)})`;
      }
    }
  });

  return null;
}

/* ---------- Parallax: мир следует за взглядом ---------- */
function Rig({ locked, children }) {
  const ref = useRef();

  useFrame((state, dt) => {
    if (!ref.current) return;
    const k = Math.min(1, dt * 4);
    const px = locked ? 0 : state.pointer.x;
    const py = locked ? 0 : state.pointer.y;
    const targetY = px * 0.17;
    const targetX = -py * 0.11;
    ref.current.rotation.y += (targetY - ref.current.rotation.y) * k;
    ref.current.rotation.x += (targetX - ref.current.rotation.x) * k;
  });

  return <group ref={ref}>{children}</group>;
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    /* Портрет: камера отъезжает назад, чтобы стопка слоёв помещалась */
    camera.position.z =
      aspect >= 1.35 ? 7 : aspect >= 1 ? 8.4 : Math.min(12, 8.4 + (1 - aspect) * 4);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/* ---------- Fallback при отсутствии/сбое WebGL ---------- */
class GLBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ---------- Экран: header + Canvas + DOM-оверлей + nav ---------- */
export function KvpHud3D() {
  const [webgl] = useState(() => supportsWebGL());
  const [locked, setLocked] = useState(false);

  /* Мир постоянен: слои существуют всегда, состояние переживает переключения */
  const [world, setWorld] = useState(() => {
    const restored = restoreWorld(readStoredWorld(), AR_LAYERS);
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    if (hash && LAYER_IDS.has(hash) && restored.layers[hash]) {
      return enterLayer(restored, hash);
    }
    return restored;
  });
  const [focusedId, setFocusedId] = useState(
    () => world.activeLayerId || 'core',
  );

  /* ARCHITECT RUNTIME (Direction 02): тракт «намерение → действие» */
  const runtimeRef = useRef(new ArchitectRuntime());
  const [intent, setIntent] = useState('');
  const [routeToast, setRouteToast] = useState(null);
  const toastTimer = useRef();

  /* LAYER AGENTS (Direction 03): лог-панель телеметрии слоёв */
  const [agentLog, setAgentLog] = useState([]);
  const logSeq = useRef(0);
  const pushAgentLog = (layerId, text) => {
    logSeq.current += 1;
    const entry = {
      id: logSeq.current,
      time: new Date().toLocaleTimeString('en-GB'),
      layerId,
      text,
    };
    console.log(`Architect: Agent [${layerId.toUpperCase()}] ${text}`);
    setAgentLog((prev) => [entry, ...prev].slice(0, 3));
  };

  const focusLayer = (layerId) => {
    if (!LAYER_IDS.has(layerId)) return;
    setFocusedId(layerId);
    setWorld((current) =>
      current.layers[layerId] && current.activeLayerId !== layerId
        ? enterLayer(current, layerId)
        : current,
    );
    try {
      window.history.replaceState(null, '', '#' + layerId);
    } catch (e) {
      /* history unavailable — фокус всё равно меняется */
    }
  };

  /* Приём намерения: processIntent → routeIntent → Spatial Engine */
  const submitIntent = (value) => {
    const text = (typeof value === 'string' ? value : intent).trim();
    if (!text) return;
    const action = runtimeRef.current.processIntent(text);
    const result = routeIntent(action, {
      world,
      setWorld,
      focusLayer,
      currentLayerId: focusedId,
      onStatus: ({ layerId, status }) => pushAgentLog(layerId, status),
    });
    const label = result.layerId ? String(result.layerId).toUpperCase() : 'NONE';
    if (result.routed === 'status') {
      const detail = `[${label}] ${result.status}`;
      console.log(`Architect: Received intent -> ${detail}`);
      clearTimeout(toastTimer.current);
      setRouteToast({
        intent: text.length > 40 ? text.slice(0, 39) + '…' : text,
        label,
        detail,
      });
      toastTimer.current = setTimeout(() => setRouteToast(null), 6000);
    } else {
      console.log(`Architect: Received intent -> "${text}"`);
      console.log(`Architect: Routing to layer [${label}]`);
      if (result.routed !== 'none') {
        clearTimeout(toastTimer.current);
        setRouteToast({
          intent: text.length > 40 ? text.slice(0, 39) + '…' : text,
          label,
        });
        toastTimer.current = setTimeout(() => setRouteToast(null), 6000);
      }
    }
    setIntent('');
  };

  /* Boot: #cmd=<команда> — авто-исполнение намерения при загрузке */
  const bootIntent = useRef(
    typeof window !== 'undefined' && window.location.hash.startsWith('#cmd=')
      ? decodeURIComponent(window.location.hash.slice('#cmd='.length))
      : '',
  );
  useEffect(() => {
    if (!bootIntent.current) return;
    const cmd = bootIntent.current;
    bootIntent.current = '';
    submitIntent(cmd);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* Агент слоя: при каждом фокусе — краткий статус в лог-панель */
  useEffect(() => {
    const agent = new LayerAgent(focusedId);
    pushAgentLog(focusedId, agent.getStatus().status);
  }, [focusedId]);

  /* Память среды: мир сериализуется при каждом изменении */
  useEffect(() => {
    try {
      window.localStorage.setItem(WORLD_STORAGE_KEY, serializeWorld(world));
    } catch (e) {
      /* приватный режим — мир живёт только в сессии */
    }
  }, [world]);

  const activeTheme = worldTheme(world, focusedId);

  /* Адаптер: мир → scene graph → draw list → объекты по слоям */
  const objectsByLayer = useMemo(() => {
    const scene = worldToScene(world);
    const draw = composeSpatialScene(scene, {
      focusedId: world.activeLayerId ? 'layer:' + world.activeLayerId : null,
      viewport: {
        width: (typeof window !== 'undefined' && window.innerWidth) || 1440,
        height: (typeof window !== 'undefined' && window.innerHeight) || 900,
        pixelRatio: 1,
      },
    });
    const byLayer = {};
    for (const item of draw) {
      if (item.metadata?.kind !== 'object') continue;
      (byLayer[item.metadata.layerId] ||= []).push(item);
    }
    return byLayer;
  }, [world]);

  const groupRegistry = useRef({});
  const slotRegistry = useRef({});

  const focusedIndex = AR_LAYERS.findIndex((l) => l.id === focusedId);

  const planeFor = (layer, index) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const portrait = isPortraitSize(W, H);
    const fit = () => portraitDomFit(H, slotRegistry, focusedId, AR_LAYERS);
    if (layer.id === focusedId) {
      return portrait
        ? { ...PLANE_FOCAL, dom: PORTRAIT_DOM.focal * fit() }
        : PLANE_FOCAL;
    }
    const dist = Math.abs(index - focusedIndex);
    if (dist <= 2) {
      return portrait
        ? { ...PLANE_MID, dom: PORTRAIT_DOM.mid * fit() }
        : PLANE_MID;
    }
    return portrait
      ? { ...PLANE_FAR, dom: PORTRAIT_DOM.far * fit() }
      : PLANE_FAR;
  };
  const planeForRef = useRef(planeFor);
  planeForRef.current = planeFor;

  if (!webgl) return <KvpHudCSS />;

  return (
    <div className="ar-stage">
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
          <span className="text-emerald-300 hidden sm:inline">
            UEFI SECURE BOOT: VERIFIED
          </span>
          <span className="text-emerald-300 hidden sm:inline">
            TPM 2.0: MEASURED
          </span>
          <span className="text-[#7df6d1]">READINESS: PASS</span>
          <span className="text-[#aab7ff] hidden md:inline">RENDER: WEBGL 3D</span>
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

      {/* TRUE 3D СЦЕНА */}
      <div className="absolute inset-0">
        {/* Среда дышит в тоне активного слоя */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(120% 90% at 50% 45%, ${activeTheme.accent}1f 0%, transparent 55%)`,
            transition: 'background 700ms ease',
          }}
        />
        <GLBoundary fallback={<KvpHudCSS />}>
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 7], fov: 42, near: 0.1, far: 60 }}
            gl={{ antialias: true, alpha: true }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
            }}
          >
            <Suspense fallback={null}>
              <ResponsiveCamera />

              <ambientLight intensity={0.45} color={activeTheme.accent} />
              <pointLight
                position={[3, 2.5, 4]}
                intensity={55}
                distance={16}
                decay={2}
                color={activeTheme.accent}
              />
              <pointLight
                position={[-3.5, -1.5, 3]}
                intensity={38}
                distance={16}
                decay={2}
                color={activeTheme.secondary}
              />
              <pointLight
                position={[0, 3, -1.5]}
                intensity={22}
                distance={14}
                decay={2}
                color="#ffffff"
              />

              <Environment resolution={192} frames={1}>
                <Lightformer
                  form="rect"
                  intensity={1.6}
                  color="#7df6d1"
                  position={[0, 3, -6]}
                  scale={[8, 3, 1]}
                />
                <Lightformer
                  form="rect"
                  intensity={1.1}
                  color="#aab7ff"
                  position={[-5, 0, 1]}
                  rotation-y={Math.PI / 2}
                  scale={[6, 4, 1]}
                />
                <Lightformer
                  form="circle"
                  intensity={0.9}
                  color={activeTheme.accent}
                  position={[5, 2, 2]}
                  rotation-y={-Math.PI / 2}
                  scale={[3, 3, 1]}
                />
              </Environment>

              <Rig locked={locked}>
                {AR_LAYERS.map((layer, index) => (
                  <LayerNode
                    key={layer.id}
                    layer={layer}
                    index={index}
                    plane={planeFor(layer, index)}
                    isFocused={layer.id === focusedId}
                    setFocusedId={focusLayer}
                    groupRegistry={groupRegistry}
                    slotRegistry={slotRegistry}
                    focusedId={focusedId}
                    activeAccent={activeTheme.accent}
                    objects={objectsByLayer[layer.id] || []}
                  />
                ))}
              </Rig>

              <Projection
                groupRegistry={groupRegistry}
                slotRegistry={slotRegistry}
                planeForRef={planeForRef}
                layers={AR_LAYERS}
              />
            </Suspense>
          </Canvas>
        </GLBoundary>
      </div>

      {/* DOM-ОВЕРЛЕЙ: слои спроецированы из 3D, текст остаётся четким */}
      <div
        className="absolute inset-0 z-30"
        style={{ pointerEvents: 'none' }}
      >
        {AR_LAYERS.map((layer, index) => {
          const plane = planeFor(layer, index);
          return (
            <div
              key={layer.id}
              ref={(el) => {
                const prev = slotRegistry.current[layer.id] || {};
                slotRegistry.current[layer.id] = {
                  ...prev,
                  el,
                };
              }}
              className="absolute left-0 top-0"
              style={{ zIndex: PLANE_Z[plane.key] }}
            >
              <div
                ref={(inner) => {
                  const prev = slotRegistry.current[layer.id] || {};
                  slotRegistry.current[layer.id] = {
                    ...prev,
                    inner,
                  };
                }}
                className="pointer-events-auto"
                style={{ transformOrigin: 'center center' }}
              >
                <SlotContent
                  layer={layer}
                  isFocused={layer.id === focusedId}
                  plane={plane}
                  focusedId={focusedId}
                  setFocusedId={focusLayer}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* AGENT LOG: лог-панель телеметрии Layer Agents под шапкой */}
      {agentLog.length > 0 && (
        <div className="fixed top-[72px] left-6 right-6 z-40 px-4 py-1.5 rounded-xl hud-glass-mid font-mono text-[10px] leading-[13px] text-slate-300 space-y-0.5 pointer-events-none">
          {agentLog.map((entry) => (
            <div key={entry.id} className="truncate">
              <span className="text-slate-500">{entry.time}</span>{' '}
              <span className="text-[#7df6d1]">
                [{entry.layerId.toUpperCase()}]
              </span>{' '}
              {entry.text}
            </div>
          ))}
        </div>
      )}

      {/* ARCHITECT TOAST: отклик Мозга на намерение */}
      {routeToast && (
        <div
          className="fixed top-40 right-6 z-50 max-w-[min(340px,84vw)] px-4 py-3 rounded-xl hud-glass-mid font-mono text-[11px] space-y-1"
          style={{ borderLeft: `2px solid ${activeTheme.accent}` }}
        >
          <div className="truncate text-[#7df6d1]">
            Architect: Processing intent '{routeToast.intent}'
          </div>
          <div className="text-slate-300">
            {routeToast.detail || `Routing to layer [${routeToast.label}]`}
          </div>
        </div>
      )}

      {/* COMMAND PALETTE: ввод намерений (Architect Runtime) над навигацией */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitIntent();
        }}
        className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-[min(560px,92vw)] flex items-center gap-2 px-4 py-2.5 rounded-full hud-glass-mid font-mono text-[11px]"
      >
        <span className="shrink-0 text-[#7df6d1]">architect@netcity:~$</span>
        <input
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="намерение → Enter"
          aria-label="Intent input"
          className="min-w-0 flex-1 bg-transparent text-white placeholder:text-slate-500 outline-none"
        />
        <button
          type="submit"
          title="Отправить намерение"
          className="shrink-0 px-2 py-0.5 rounded border border-white/25 text-[#7df6d1] cursor-pointer"
        >
          ⏎
        </button>
      </form>

      {/* НИЖНЯЯ ПАНЕЛЬ БЫСТРОГО ВЫБОРА СЛОЁВ */}
      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full hud-glass-mid font-mono text-[11px]">
        {AR_LAYERS.map((layer) => {
          const active = layer.id === focusedId;
          return (
            <button
              key={layer.id}
              onClick={() => focusLayer(layer.id)}
              style={
                active
                  ? {
                      backgroundColor: activeTheme.accent,
                      boxShadow: `0 0 16px ${activeTheme.accent}80`,
                    }
                  : undefined
              }
              className={`px-3 py-1 rounded-full transition cursor-pointer ${
                active
                  ? 'text-slate-950 font-bold'
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
