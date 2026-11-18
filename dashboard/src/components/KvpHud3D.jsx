import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  WORLD_STORAGE_KEY,
  LAYER_THEMES,
  enterLayer,
  restoreWorld,
  serializeWorld,
} from '../spatial/world.js';
import { AR_LAYERS } from './KvpHud';
import { ArchitectRuntime } from '../architect/ArchitectCore.js';
import { routeIntent } from '../architect/IntentRouter.js';

const LAYER_IDS = new Set(AR_LAYERS.map((layer) => layer.id));
const MODE_COLORS = Object.freeze({
  idle: '#7df6d1',
  calm: '#7dd3fc',
  hot: '#ff6a3d',
});
const STATE_COLORS = Object.freeze({
  CALM: '#7df6d1',
  DRIFT: '#f0c66e',
});

/* ---------- МАТРЁШКА: всё внутри ОДНОЙ сферы (Регистратора) ----------
   Камера статична в центре (0,0,0), взгляд в -Z. Мы НАХОДИМСЯ ВНУТРИ
   огромной сферы (BackSide, r=SHELL_R) — это замкнутое технологичное
   ядро: сетка на стене, кольца света, узлы-огни, семь окон данных.
   Внутри Регистратора парят 7 сфер-слоёв (ORBIT_DIST), запертые в нём.
   Выбор сферы → она подлетает к камере и раскрывается чашей (FOCUS_R),
   Регистратор приглушается, остальные сферы гаснут; «назад» → слой
   сжимается обратно в шар, снова видны все 7 сфер внутри ядра. */
const LAYER_COUNT = AR_LAYERS.length;
const FRONT_PHI = -Math.PI / 2;
const TAU = Math.PI * 2;
const SHELL_R = 36;
const NODE_R = 35.6;
const RING_R = 35.8;
const WINDOW_R = 30;
const WINDOW_ELEV = 0.35;
const ORBIT_DIST = 18;
const SPHERE_R = 4.5;
const FOCUS_R = 8.6;
const FOCUS_PHI = Math.PI;
const FOCUS_THETA = 1.92;
const SWARM_ORBIT_SCALE = 5;
const SWARM_FOCUS_SCALE = 6.5;
const SWARM_FOCUS_Z = -5.5;
const SPHERE_ELEV = [-0.18, 0.3, -0.34, 0.12, -0.28, 0.38, -0.06];
const SPHERE_WSEG = 48;
const SPHERE_HSEG = 32;
const GRID_STEP = 4;
const WORLD_ORIGIN = new THREE.Vector3(0, 0, 0);

function layerPhi(index) {
  return FRONT_PHI + (index / LAYER_COUNT) * TAU;
}

/* Кратчайший путь поворота: цель всегда по модулю 2π ближайшая к текущей */
function shortestAngle(from, to) {
  let delta = (to - from) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return from + delta;
}

function layerYaw(layerId) {
  if (!layerId || layerId === 'all') return 0;
  const index = AR_LAYERS.findIndex((layer) => layer.id === layerId);
  if (index < 0) return 0;
  return shortestAngle(0, FRONT_PHI - layerPhi(index));
}

/* Стабильный DOM-портал для <Html>: drei при первой отрисовке получает
   target=null (canvas ещё не в документе) и на втором кадре меняет его —
   cleanup зовёт createRoot().unmount() во время рендера и стирает
   содержимое лейбла. Фиксированный портал исключает смену target. */
const HTML_PORTAL = { current: null };
function htmlPortal() {
  if (!HTML_PORTAL.current && typeof document !== 'undefined') {
    HTML_PORTAL.current = document.getElementById('root') || document.body;
  }
  return HTML_PORTAL;
}

function readStoredWorld() {
  try {
    return window.localStorage.getItem(WORLD_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

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

/* ---------- Детерминированный PRNG и активность слоёв ---------- */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function baseActivity(layerId) {
  return 0.3 + (hashString(layerId) % 40) / 100;
}

/* ---------- Геометрия сегмента сферы: стекло + решётка на одном буфере ---------- */
function makeSegmentGeometry(wseg, hseg, gridStep, boundR) {
  const cols = wseg + 1;
  const rows = hseg + 1;
  const positions = new Float32Array(cols * rows * 3);
  const normals = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const triangles = [];
  for (let iy = 0; iy < hseg; iy++) {
    for (let ix = 0; ix < wseg; ix++) {
      const a = ix + cols * iy;
      const b = ix + cols * (iy + 1);
      const c = ix + 1 + cols * (iy + 1);
      const d = ix + 1 + cols * iy;
      triangles.push(a, b, d, b, c, d);
    }
  }
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const offset = (iy * cols + ix) * 2;
      uvs[offset] = ix / wseg;
      uvs[offset + 1] = iy / hseg;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(triangles);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), boundR);

  /* Решётка wireframe делит тот же буфер позиций:
     линии морфятся вместе со сферой */
  const segments = [];
  for (let iy = 0; iy < rows; iy += gridStep) {
    for (let ix = 0; ix < wseg; ix++) {
      segments.push(iy * cols + ix, iy * cols + ix + 1);
    }
  }
  for (let ix = 0; ix < cols; ix += gridStep) {
    for (let iy = 0; iy < hseg; iy++) {
      segments.push(iy * cols + ix, (iy + 1) * cols + ix);
    }
  }
  const grid = new THREE.BufferGeometry();
  grid.setAttribute('position', geometry.getAttribute('position'));
  grid.setIndex(segments);
  grid.boundingSphere = new THREE.Sphere(new THREE.Vector3(), boundR);
  return { geometry, grid, wseg, hseg };
}

function updateSegment(parts, params) {
  const { r, phiStart, phiLen, thetaStart, thetaLen } = params;
  const { geometry, grid, wseg, hseg } = parts;
  const position = geometry.attributes.position.array;
  const normal = geometry.attributes.normal.array;
  const cols = wseg + 1;
  const rows = hseg + 1;
  let k = 0;
  for (let iy = 0; iy < rows; iy++) {
    const theta = thetaStart + (iy / hseg) * thetaLen;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    for (let ix = 0; ix < cols; ix++) {
      const phi = phiStart + (ix / wseg) * phiLen;
      const nx = -Math.cos(phi) * sinTheta;
      const ny = cosTheta;
      const nz = Math.sin(phi) * sinTheta;
      position[k] = nx * r;
      position[k + 1] = ny * r;
      position[k + 2] = nz * r;
      normal[k] = nx;
      normal[k + 1] = ny;
      normal[k + 2] = nz;
      k += 3;
    }
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.normal.needsUpdate = true;
  geometry.boundingSphere.radius = r + 1;
  grid.boundingSphere.radius = r + 1;
}

/* ---------- Rig пространства: drag-to-rotate с инерцией и возвратом в 0 ---------- */
function RigController({ rigRef, targetRef, dragRef }) {
  useFrame((_, dt) => {
    const rig = rigRef.current;
    if (!rig) return;
    const target = targetRef.current;
    const drag = dragRef.current;
    if (!drag.active) {
      /* инерция после отпускания пальца */
      target.yaw += target.vyaw;
      target.pitch = THREE.MathUtils.clamp(target.pitch + target.vpitch, -0.55, 0.55);
      const decay = Math.pow(0.9, dt * 60);
      target.vyaw *= decay;
      target.vpitch *= decay;
      if (Math.abs(target.vyaw) < 1e-5) target.vyaw = 0;
      if (Math.abs(target.vpitch) < 1e-5) target.vpitch = 0;
    }
    const k = 1 - Math.exp(-dt * 7);
    rig.rotation.y += (target.yaw - rig.rotation.y) * k;
    rig.rotation.x += (target.pitch - rig.rotation.x) * k;
  });
  return null;
}

/* ---------- Рои агентов: Points + LineSegments (нейросетевой шум в сфере) ---------- */
function LayerSwarm({ layerId, accent, activityRef, active, mode, focusRef, dimRef }) {
  const data = useMemo(() => {
    const rand = mulberry32(hashString(layerId));
    const MAX = 150;
    const EDGES = 70;
    const R = 0.62;
    const base = new Float32Array(MAX * 3);
    const pos = new Float32Array(MAX * 3);
    const vel = new Float32Array(MAX * 3);
    const phase = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) {
      let x = rand() * 2 - 1;
      let y = rand() * 2 - 1;
      let z = rand() * 2 - 1;
      let len = Math.hypot(x, y, z);
      while (len < 1e-4) {
        x = rand() * 2 - 1;
        y = rand() * 2 - 1;
        z = rand() * 2 - 1;
        len = Math.hypot(x, y, z);
      }
      const r = R * Math.cbrt(rand());
      const i3 = i * 3;
      base[i3] = (x / len) * r;
      base[i3 + 1] = (y / len) * r;
      base[i3 + 2] = (z / len) * r;
      pos[i3] = base[i3];
      pos[i3 + 1] = base[i3 + 1];
      pos[i3 + 2] = base[i3 + 2];
      vel[i3] = (rand() * 2 - 1) * 0.08;
      vel[i3 + 1] = (rand() * 2 - 1) * 0.08;
      vel[i3 + 2] = (rand() * 2 - 1) * 0.08;
      phase[i] = rand() * Math.PI * 2;
    }
    const edges = new Uint16Array(EDGES * 2);
    for (let e = 0; e < EDGES; e++) {
      const a = Math.floor(rand() * MAX);
      let b = Math.floor(rand() * MAX);
      while (b === a) b = Math.floor(rand() * MAX);
      edges[e * 2] = a;
      edges[e * 2 + 1] = b;
    }

    const pts = new THREE.BufferGeometry();
    pts.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
    const lines = new THREE.BufferGeometry();
    lines.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EDGES * 6), 3));

    return { MAX, EDGES, R, base, pos, vel, phase, edges, pts, lines };
  }, [layerId]);

  const smooth = useRef(baseActivity(layerId));
  const prevMode = useRef('idle');
  const ptsRef = useRef();
  const linesRef = useRef();

  useEffect(() => () => { data.pts.dispose(); data.lines.dispose(); }, [data]);

  const colorTarget = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const target = activityRef.current[layerId] ?? 0.35;
    smooth.current += (target - smooth.current) * (1 - Math.exp(-dt * 2.2));
    const act = smooth.current;

    const eff = active ? mode : 'idle';
    const hot = eff === 'hot';
    const calm = eff === 'calm';

    if (hot && prevMode.current !== 'hot') {
      for (let i = 0; i < data.MAX; i++) {
        const i3 = i * 3;
        const px = data.pos[i3];
        const py = data.pos[i3 + 1];
        const pz = data.pos[i3 + 2];
        const len = Math.hypot(px, py, pz) || 1e-4;
        const kick = 0.26 + (i % 5) * 0.04;
        data.vel[i3] += (px / len) * kick;
        data.vel[i3 + 1] += (py / len) * kick;
        data.vel[i3 + 2] += (pz / len) * kick;
      }
    }
    prevMode.current = eff;

    const speed = hot ? 0.62 : calm ? 0.09 : 0.17;
    const { MAX, EDGES, R, base, pos, vel, phase, edges } = data;

    for (let i = 0; i < MAX; i++) {
      const i3 = i * 3;
      let px = pos[i3];
      let py = pos[i3 + 1];
      let pz = pos[i3 + 2];

      if (calm) {
        const tx = base[i3] * 0.92 + Math.sin(t * 0.7 + phase[i]) * 0.06;
        const ty = base[i3 + 1] * 0.5 + Math.sin(base[i3] * 3.4 + t * 1.6 + phase[i]) * 0.2;
        const tz = base[i3 + 2] * 0.92 + Math.cos(t * 0.65 + phase[i]) * 0.06;
        const k = Math.min(1, dt * 3.2);
        px += (tx - px) * k;
        py += (ty - py) * k;
        pz += (tz - pz) * k;
      } else {
        if (hot) {
          const boostF = 1 + dt * 1.5;
          vel[i3] *= boostF;
          vel[i3 + 1] *= boostF;
          vel[i3 + 2] *= boostF;
          const v2 = vel[i3] * vel[i3] + vel[i3 + 1] * vel[i3 + 1] + vel[i3 + 2] * vel[i3 + 2];
          if (v2 > 1.44) {
            const c = 1.2 / Math.sqrt(v2);
            vel[i3] *= c;
            vel[i3 + 1] *= c;
            vel[i3 + 2] *= c;
          }
        }
        px += vel[i3] * speed;
        py += vel[i3 + 1] * speed;
        pz += vel[i3 + 2] * speed;
        const d = Math.sqrt(px * px + py * py + pz * pz);
        if (d > R) {
          const c = R / d;
          px *= c;
          py *= c;
          pz *= c;
          vel[i3] *= -0.9;
          vel[i3 + 1] *= -0.9;
          vel[i3 + 2] *= -0.9;
        } else if (d < 0.08) {
          const c = 0.08 / Math.max(d, 1e-4);
          px *= c;
          py *= c;
          pz *= c;
        }
      }

      pos[i3] = px;
      pos[i3 + 1] = py;
      pos[i3 + 2] = pz;
    }

    const posAttr = data.pts.getAttribute('position');
    posAttr.needsUpdate = true;

    const lineArr = data.lines.getAttribute('position').array;
    for (let e = 0; e < EDGES; e++) {
      const a = edges[e * 2] * 3;
      const b = edges[e * 2 + 1] * 3;
      const o = e * 6;
      lineArr[o] = pos[a];
      lineArr[o + 1] = pos[a + 1];
      lineArr[o + 2] = pos[a + 2];
      lineArr[o + 3] = pos[b];
      lineArr[o + 4] = pos[b + 1];
      lineArr[o + 5] = pos[b + 2];
    }
    data.lines.getAttribute('position').needsUpdate = true;

    const ptsMat = ptsRef.current.material;
    /* очки уменьшаются при фокусе: рой ближе к камере, иначе квадраты раздуваются;
       затемняющие сферы-соседи (dim) отдают приоритет раскрытому слою */
    const f = focusRef ? focusRef.current : 0;
    const dim = dimRef ? dimRef.current : 0;
    ptsMat.size = (0.06 + act * 0.07) * (1 - 0.75 * f);
    ptsMat.opacity = (0.4 + act * 0.55) * (1 - 0.6 * dim);
    colorTarget.set(accent);
    if (active && mode !== 'idle') {
      colorTarget.lerp(new THREE.Color(MODE_COLORS[mode]), 0.6);
    }
    ptsMat.color.lerp(colorTarget, 1 - Math.exp(-dt * 3));

    const lineMat = linesRef.current.material;
    lineMat.opacity = (0.07 + act * 0.45) * (1 - 0.65 * dim);
    lineMat.color.copy(ptsMat.color);
  });

  return (
    <group>
      <points ref={ptsRef} geometry={data.pts}>
        <pointsMaterial
          size={0.05}
          transparent
          opacity={0.7}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineSegments ref={linesRef} geometry={data.lines}>
        <lineBasicMaterial
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

/* ---------- Спутники: память мира (объекты Direction 01) ---------- */
function ObjectSatellites({ objects, accent }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(Math.max(1, objects.length) * 3);
    objects.forEach((obj, i) => {
      const p = obj.position || {};
      arr[i * 3] = THREE.MathUtils.clamp((p.x || 0) * 0.42, -0.62, 0.62);
      arr[i * 3 + 1] = THREE.MathUtils.clamp((p.y || 0) * 0.42, -0.62, 0.62);
      arr[i * 3 + 2] = THREE.MathUtils.clamp((p.z || 0) * 0.3, -0.5, 0.5);
    });
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, [objects]);

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <points geometry={geo}>
      <pointsMaterial
        color={accent}
        size={0.08}
        transparent
        opacity={0.95}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ---------- Шейдеры стекла и решётки ---------- */
const PANEL_VERT = `
uniform float uTime;
uniform float uAmp;
uniform float uSpeed;
uniform float uPhase;
varying vec3 vN;
varying vec3 vV;
void main() {
  float wave = sin(normal.x * 4.2 + uTime * uSpeed + uPhase) *
               sin(normal.y * 3.1 - uTime * uSpeed * 0.7 + uPhase * 0.5);
  vec3 displaced = position + normal * wave * uAmp;
  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const PANEL_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vV;
void main() {
  float fresnel = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.4);
  float band = 0.5 + 0.5 * abs(normalize(vN).y);
  float alpha = uOpacity * (0.07 + 0.72 * fresnel + 0.15 * band) + 0.05;
  gl_FragColor = vec4(uColor, min(alpha, 1.0));
}
`;

const GRID_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(uColor, uOpacity);
}
`;

/* ---------- Регистратор: главная сфера — стена ядра, сетка, свет, окна ---------- */
function MainShell({ focusedId }) {
  const base = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.05 },
      uSpeed: { value: 0.3 },
      uPhase: { value: 0 },
      uColor: { value: new THREE.Color('#2f93a8') },
    }),
    [],
  );
  const glassOpacity = useMemo(() => ({ value: 1 }), []);
  const gridOpacity = useMemo(() => ({ value: 0.16 }), []);

  /* Полная сфера из того же сегментного буфера: стекло стены + чистая
     широтно-долготная сетка (без диагоналей wireframe) */
  const parts = useMemo(() => {
    const p = makeSegmentGeometry(72, 36, 4, SHELL_R + 1);
    updateSegment(p, {
      r: SHELL_R,
      phiStart: 0,
      phiLen: TAU,
      thetaStart: 0,
      thetaLen: Math.PI,
    });
    return p;
  }, []);

  const glassMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { ...base, uOpacity: glassOpacity },
        vertexShader: PANEL_VERT,
        fragmentShader: PANEL_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    [base, glassOpacity],
  );
  const gridMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { ...base, uOpacity: gridOpacity },
        vertexShader: PANEL_VERT,
        fragmentShader: GRID_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [base, gridOpacity],
  );
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#3fbfd0',
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  /* Узлы-огни на внутренней поверхности: свет «комнаты», не звёзды */
  const nodes = useMemo(() => {
    const rand = mulberry32(4211);
    const count = 180;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      let x = rand() * 2 - 1;
      let y = rand() * 2 - 1;
      let z = rand() * 2 - 1;
      const len = Math.hypot(x, y, z) || 1;
      arr[i * 3] = (x / len) * NODE_R;
      arr[i * 3 + 1] = (y / len) * NODE_R;
      arr[i * 3 + 2] = (z / len) * NODE_R;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return geo;
  }, []);

  const ringsRef = useRef();
  const nodeMatRef = useRef();

  useEffect(
    () => () => {
      parts.geometry.dispose();
      parts.grid.dispose();
      glassMaterial.dispose();
      gridMaterial.dispose();
      ringMaterial.dispose();
      nodes.dispose();
    },
    [parts, glassMaterial, gridMaterial, ringMaterial, nodes],
  );

  const focusRef = useRef(0);

  useFrame((state, dt) => {
    const time = state.clock.elapsedTime;
    base.uTime.value = time;
    const target = focusedId !== 'all' ? 1 : 0;
    focusRef.current += (target - focusRef.current) * (1 - Math.exp(-dt * 3));
    if (Math.abs(target - focusRef.current) < 0.0005) focusRef.current = target;
    const f = focusRef.current;
    /* Регистратор остаётся вокруг, но приглушается при входе в слой */
    glassOpacity.value = 1 - 0.55 * f;
    base.uAmp.value = 0.05 - 0.02 * f;
    gridOpacity.value = 0.16 - 0.11 * f;
    ringMaterial.opacity = 0.5 - 0.32 * f;
    if (nodeMatRef.current) nodeMatRef.current.opacity = 0.5 - 0.32 * f;
    if (ringsRef.current) ringsRef.current.rotation.y = time * 0.05;
  });

  return (
    <group>
      <mesh geometry={parts.geometry} material={glassMaterial} renderOrder={-4} />
      <lineSegments geometry={parts.grid} material={gridMaterial} renderOrder={-3} />
      <group ref={ringsRef} renderOrder={-2}>
        <mesh material={ringMaterial} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[RING_R, 0.14, 8, 180]} />
        </mesh>
        <mesh material={ringMaterial} rotation={[Math.PI / 2, 0.9, 0]}>
          <torusGeometry args={[RING_R, 0.12, 8, 180]} />
        </mesh>
        <mesh material={ringMaterial} rotation={[Math.PI / 2, -0.9, 0]}>
          <torusGeometry args={[RING_R, 0.12, 8, 180]} />
        </mesh>
      </group>
      <points geometry={nodes} renderOrder={-1}>
        <pointsMaterial
          ref={nodeMatRef}
          color="#9df0e2"
          size={0.17}
          transparent
          opacity={0.5}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/* ---------- Окно данных на внутренней поверхности купола ---------- */
function DataWindow({ layer, index, focusedId, onSelect, dragRef }) {
  const accent = (LAYER_THEMES[layer.id] || { accent: '#7df6d1' }).accent;
  const phi = layerPhi(index);
  const position = useMemo(
    () => [
      -Math.cos(phi) * Math.cos(WINDOW_ELEV) * WINDOW_R,
      Math.sin(WINDOW_ELEV) * WINDOW_R,
      Math.sin(phi) * Math.cos(WINDOW_ELEV) * WINDOW_R,
    ],
    [phi],
  );

  const active = focusedId === layer.id;
  const orbit = focusedId === 'all';
  const opacity = orbit ? 0.9 : active ? 1 : 0.1;
  const interactive = orbit || active;
  const streams = layer.streams.slice(0, 2);

  const handleClick = () => {
    if (dragRef && dragRef.current && dragRef.current.moved) return;
    onSelect(active ? null : layer.id);
  };

  return (
    <group position={position}>
      <Html
        center
        portal={htmlPortal()}
        zIndexRange={[24, 1]}
        style={{
          opacity,
          transition: 'opacity 0.45s',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      >
        <div
          onClick={handleClick}
          className="font-mono select-none"
          style={{
            width: 232,
            padding: '8px 10px 7px',
            borderRadius: 10,
            background: 'rgba(5, 14, 20, 0.84)',
            border: `1px solid ${accent}66`,
            boxShadow: `0 0 18px ${accent}33, inset 0 0 14px ${accent}14`,
            color: '#d9eef2',
            cursor: interactive ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                color: accent,
                fontSize: 11,
                letterSpacing: '0.14em',
                textShadow: `0 0 8px ${accent}80`,
              }}
            >
              {layer.code}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 7.5,
                letterSpacing: '0.12em',
                color: '#7f9aa6',
              }}
            >
              {layer.agent}
            </span>
          </div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.1em',
              color: '#f2fbfd',
              marginTop: 3,
              lineHeight: 1.35,
            }}
          >
            {layer.title}
          </div>
          <div style={{ height: 1, background: `${accent}33`, margin: '6px 0 5px' }} />
          {streams.map((stream) => {
            const sc = STATE_COLORS[stream.state] || STATE_COLORS.CALM;
            return (
              <div
                key={stream.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 8.5,
                      letterSpacing: '0.05em',
                      color: '#cfe6ec',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {stream.label}
                  </div>
                  <div
                    style={{
                      fontSize: 7.5,
                      letterSpacing: '0.07em',
                      color: '#6f8a96',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {stream.scaleHint}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 8,
                      letterSpacing: '0.14em',
                      color: sc,
                      textShadow: `0 0 6px ${sc}80`,
                    }}
                  >
                    {stream.state}
                  </div>
                  <div style={{ fontSize: 8, color: '#9fd8e6' }}>{stream.intensity}%</div>
                </div>
              </div>
            );
          })}
          <div
            style={{
              fontSize: 7.5,
              letterSpacing: '0.2em',
              color: accent,
              opacity: 0.6,
              marginTop: 2,
            }}
          >
            {active ? '◂ РЕГИСТРАТОР' : '◦ ВОЙТИ В СЛОЙ'}
          </div>
        </div>
      </Html>
    </group>
  );
}

/* ---------- Сфера-реальность: полная сфера → полусфера-чаша ---------- */
function VectorSphere({
  layer,
  index,
  focusedId,
  mode,
  onSelect,
  activityRef,
  objects,
  dragRef,
  labelOpacity,
}) {
  const active = focusedId === layer.id;
  const accent = (LAYER_THEMES[layer.id] || { accent: '#7df6d1' }).accent;
  const phiCenter = layerPhi(index);
  const elev = SPHERE_ELEV[index % SPHERE_ELEV.length];
  const label = layer.code.split('// ')[1];

  const home = useMemo(
    () =>
      new THREE.Vector3(
        -Math.cos(phiCenter) * Math.cos(elev) * ORBIT_DIST,
        Math.sin(elev) * ORBIT_DIST,
        Math.sin(phiCenter) * Math.cos(elev) * ORBIT_DIST,
      ),
    [phiCenter, elev],
  );

  const parts = useMemo(
    () => makeSegmentGeometry(SPHERE_WSEG, SPHERE_HSEG, GRID_STEP, FOCUS_R + 2),
    [],
  );
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.05 },
      uSpeed: { value: 1.1 },
      uPhase: { value: phiCenter },
      uColor: { value: new THREE.Color(accent) },
    }),
    [accent, phiCenter],
  );
  const glassMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uOpacity: { value: 0.8 } },
        vertexShader: PANEL_VERT,
        fragmentShader: PANEL_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    [uniforms],
  );
  const gridMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uOpacity: { value: 0.16 } },
        vertexShader: PANEL_VERT,
        fragmentShader: GRID_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  useEffect(
    () => () => {
      parts.geometry.dispose();
      parts.grid.dispose();
      glassMaterial.dispose();
      gridMaterial.dispose();
    },
    [parts, glassMaterial, gridMaterial],
  );

  const focusRef = useRef(0);
  const dimRef = useRef(0);
  const spinRef = useRef(0);
  const shapeRef = useRef({
    r: 0,
    phiLen: 0,
    thetaLen: 0,
    phiStart: 0,
    thetaStart: 0,
    ready: false,
  });
  const rootRef = useRef();
  const spinGroupRef = useRef();
  const swarmRef = useRef();
  const colorTarget = useMemo(() => new THREE.Color(accent), [accent]);
  const modeColor = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    const time = state.clock.elapsedTime;

    /* Полёт: орбита → центр (к камере) */
    const focusTarget = active ? 1 : 0;
    focusRef.current += (focusTarget - focusRef.current) * (1 - Math.exp(-dt * 3.4));
    if (Math.abs(focusTarget - focusRef.current) < 0.0005) focusRef.current = focusTarget;
    const f = focusRef.current;
    rootRef.current.position.lerpVectors(home, WORLD_ORIGIN, f);
    /* лёгкое парение: сферы не висят мёртво, а живут внутри Регистратора */
    rootRef.current.position.y +=
      Math.sin(time * 0.55 + index * 1.7) * 0.5 * (1 - f);

    /* Погашение соседей: пока раскрыт один слой, остальные отходят в тень */
    const dimTarget = !active && focusedId !== 'all' ? 1 : 0;
    dimRef.current += (dimTarget - dimRef.current) * (1 - Math.exp(-dt * 3));
    if (Math.abs(dimTarget - dimRef.current) < 0.0005) dimRef.current = dimTarget;
    const dim = dimRef.current;

    /* Морф геометрии: полная сфера → чаша-полусфера перед камерой */
    const r = SPHERE_R + (FOCUS_R - SPHERE_R) * f;
    const phiLen = TAU + (FOCUS_PHI - TAU) * f;
    const thetaLen = Math.PI + (FOCUS_THETA - Math.PI) * f;
    const shape = shapeRef.current;
    if (
      !shape.ready ||
      Math.abs(shape.r - r) > 0.005 ||
      Math.abs(shape.phiLen - phiLen) > 0.0005 ||
      Math.abs(shape.thetaLen - thetaLen) > 0.0005
    ) {
      shape.ready = true;
      shape.r = r;
      shape.phiLen = phiLen;
      shape.thetaLen = thetaLen;
      shape.phiStart = phiCenter - phiLen * 0.5;
      shape.thetaStart = Math.PI * 0.5 - thetaLen * 0.5;
      updateSegment(parts, shape);
    }

    /* Спин: свободный на орбите, при фокусе выравнивает рот чаши к камере */
    const spinSpeed = 0.12 + (index % 3) * 0.05;
    let spin = spinRef.current + spinSpeed * dt * (1 - f);
    if (f > 0.005) {
      spin += (shortestAngle(spin, 0) - spin) * (1 - Math.exp(-dt * 6)) * f;
    }
    if (spin > TAU || spin < -TAU) spin = ((spin % TAU) + TAU) % TAU;
    spinRef.current = spin;
    spinGroupRef.current.rotation.y = spin;

    /* Рой: вглубь рта чаши (локальная азимута phiCenter), не по мировой -Z */
    const mouthX = -Math.cos(phiCenter);
    const mouthZ = Math.sin(phiCenter);
    const depth = -SWARM_FOCUS_Z * f;
    swarmRef.current.position.set(mouthX * depth, 0, mouthZ * depth);
    swarmRef.current.scale.setScalar(
      SWARM_ORBIT_SCALE + (SWARM_FOCUS_SCALE - SWARM_ORBIT_SCALE) * f,
    );

    /* Дыхание и деформация стекла: CALM/HOT читается по стене сферы */
    const activity = activityRef.current[layer.id] ?? 0.4;
    const effective = active ? mode : 'idle';
    const amp = effective === 'hot' ? 0.3 : effective === 'calm' ? 0.13 : 0.05;
    const speed = effective === 'hot' ? 4.2 : effective === 'calm' ? 0.5 : 1.1;
    const modeDamping = 1 - Math.exp(-dt * 3);
    uniforms.uTime.value = time;
    uniforms.uAmp.value += (amp - uniforms.uAmp.value) * modeDamping;
    uniforms.uSpeed.value += (speed - uniforms.uSpeed.value) * modeDamping;

    colorTarget.set(accent);
    if (active && mode !== 'idle') {
      modeColor.set(MODE_COLORS[mode] || MODE_COLORS.idle);
      colorTarget.lerp(modeColor, 0.7);
    }
    uniforms.uColor.value.lerp(colorTarget, 1 - Math.exp(-dt * 3));

    const hotGlow = effective === 'hot' ? 0.55 : effective === 'calm' ? 0.12 : 0;
    glassMaterial.uniforms.uOpacity.value =
      (0.72 + activity * 0.5 + (active ? 0.3 : 0) + hotGlow) * (1 - 0.62 * dim);
    gridMaterial.uniforms.uOpacity.value =
      (0.09 + activity * 0.14 + (active ? 0.06 : 0) + (effective === 'hot' ? 0.15 : 0)) *
      (1 - 0.55 * dim);
  });

  const allowSelect = () => !(dragRef && dragRef.current && dragRef.current.moved);

  return (
    <group ref={rootRef} position={[home.x, home.y, home.z]}>
      {/* рой первым (дальше от камеры при фокусе) — стекло поверх него */}
      <group ref={swarmRef}>
        <LayerSwarm
          layerId={layer.id}
          accent={accent}
          activityRef={activityRef}
          active={active}
          mode={mode}
          focusRef={focusRef}
          dimRef={dimRef}
        />
        {objects.length > 0 && <ObjectSatellites objects={objects} accent={accent} />}
      </group>

      <group ref={spinGroupRef}>
        <mesh
          geometry={parts.geometry}
          material={glassMaterial}
          onPointerUp={(event) => {
            event.stopPropagation();
            /* тап по стене уже открытой сферы — выход на орбиту */
            if (allowSelect()) onSelect(active ? null : layer.id);
          }}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
          }}
        />
        <lineSegments geometry={parts.grid} material={gridMaterial} />
      </group>

      <group position={[0, -(SPHERE_R + 3.4), -4]}>
        <Html center portal={htmlPortal()} zIndexRange={[18, 1]} style={{ pointerEvents: 'none' }}>
          <div
            className="font-mono text-[10px] tracking-[0.25em] whitespace-nowrap"
            style={{
              color: accent,
              opacity: labelOpacity,
              transition: 'opacity 0.4s',
              textShadow: `0 0 10px ${accent}80`,
            }}
          >
            {label}
          </div>
        </Html>
      </group>
    </group>
  );
}

/* ---------- Драйвер затухания активности ---------- */
function ActivityDriver({ activityRef, bases }) {
  useFrame((_, dt) => {
    for (const key of Object.keys(activityRef.current)) {
      const b = bases[key] ?? 0.35;
      const v = activityRef.current[key];
      if (typeof v === 'number' && v > b) {
        activityRef.current[key] = Math.max(b, v - dt * 0.22);
      }
    }
  });
  return null;
}

/* ---------- Сцена ---------- */
function SceneContent({
  focusedId,
  onSelect,
  activityRef,
  mode,
  world,
  rigRef,
  rigTargetRef,
  dragRef,
}) {
  const bases = useMemo(() => {
    const map = {};
    for (const layer of AR_LAYERS) {
      const visited = world.layers[layer.id]?.visited ?? 0;
      map[layer.id] = Math.min(0.92, baseActivity(layer.id) + visited * 0.05);
    }
    return map;
  }, [world]);

  return (
    <>
      <RigController rigRef={rigRef} targetRef={rigTargetRef} dragRef={dragRef} />
      <group ref={rigRef}>
        {AR_LAYERS.map((layer, index) => (
          <VectorSphere
            key={layer.id}
            layer={layer}
            index={index}
            focusedId={focusedId}
            mode={mode}
            onSelect={onSelect}
            activityRef={activityRef}
            objects={world.layers[layer.id]?.objects ?? []}
            dragRef={dragRef}
            labelOpacity={
              focusedId === 'all' ? 0.9 : focusedId === layer.id ? 0 : 0.22
            }
          />
        ))}
        {AR_LAYERS.map((layer, index) => (
          <DataWindow
            key={layer.id}
            layer={layer}
            index={index}
            focusedId={focusedId}
            onSelect={onSelect}
            dragRef={dragRef}
          />
        ))}
      </group>
      <MainShell focusedId={focusedId} />
      <ActivityDriver activityRef={activityRef} bases={bases} />
    </>
  );
}

/* ---------- Экран: ассоциативная графика + единственное текстовое поле ---------- */
export function KvpHud3D() {
  const [webgl] = useState(() => supportsWebGL());

  const initialHash =
    typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  const initialFocused =
    initialHash && LAYER_IDS.has(initialHash) ? initialHash : 'all';

  /* Мир постоянен: память слоёв переживает перезагрузки */
  const [world, setWorld] = useState(() => {
    const restored = restoreWorld(readStoredWorld(), AR_LAYERS);
    if (initialHash && LAYER_IDS.has(initialHash) && restored.layers[initialHash]) {
      return enterLayer(restored, initialHash);
    }
    return restored;
  });

  const [focusedId, setFocusedId] = useState(initialFocused);
  const [mode, setMode] = useState('idle');
  const [intent, setIntent] = useState('');
  const [telegram, setTelegram] = useState(null);

  const runtimeRef = useRef(new ArchitectRuntime());
  const activityRef = useRef({});
  /* Rig пространства: drag-вращение с инерцией (см. RigController) */
  const rigRef = useRef(null);
  const rigTargetRef = useRef({
    yaw: layerYaw(initialFocused),
    pitch: 0,
    vyaw: 0,
    vpitch: 0,
  });
  const dragRef = useRef({ active: false, moved: false, x: 0, y: 0, sx: 0, sy: 0 });
  const suppressMissedRef = useRef(false);

  if (Object.keys(activityRef.current).length === 0) {
    for (const layer of AR_LAYERS) {
      activityRef.current[layer.id] = baseActivity(layer.id);
    }
  }

  const boost = (layerId, amount) => {
    if (!layerId) return;
    const current = activityRef.current[layerId] ?? 0.35;
    activityRef.current[layerId] = Math.min(1, current + amount);
  };

  /* Фокус слоя: сфера подлетает к камере и раскрывается полусферой */
  const focusLayer = (layerId) => {
    if (!LAYER_IDS.has(layerId)) return;
    const index = AR_LAYERS.findIndex((layer) => layer.id === layerId);
    const target = rigTargetRef.current;
    target.yaw = shortestAngle(target.yaw, FRONT_PHI - layerPhi(index));
    target.pitch = 0;
    target.vyaw = 0;
    target.vpitch = 0;
    setFocusedId(layerId);
    setTelegram(null);
    setWorld((current) =>
      current.layers[layerId] && current.activeLayerId !== layerId
        ? enterLayer(current, layerId)
        : current,
    );
    boost(layerId, 0.45);
    try {
      window.history.replaceState(null, '', '#' + layerId);
    } catch (e) {
      /* history unavailable */
    }
    console.log(`Architect: Received intent -> Routing to layer [${layerId.toUpperCase()}]`);
  };

  /* Выход на орбиту: сфера сжимается обратно, rig крутится кратчайшим путём */
  const exitToOrbit = () => {
    setFocusedId('all');
    setTelegram(null);
    const target = rigTargetRef.current;
    target.yaw = shortestAngle(target.yaw, 0);
    target.pitch = 0;
    target.vyaw = 0;
    target.vpitch = 0;
    try {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
    } catch (e) {
      /* history unavailable */
    }
    console.log('Architect: Received intent -> exit to registrar');
  };

  /* Тап по сфере — вход в слой; тап по фону/стене — выход */
  const selectSphere = (layerId) => {
    if (!layerId) {
      exitToOrbit();
      return;
    }
    focusLayer(layerId);
  };

  /* Drag-to-rotate: палец вращает кольцо сфер. Жест > 12px
     подавляет выход по тапу на фон. */
  const handlePointerDown = (event) => {
    suppressMissedRef.current = false;
    dragRef.current = {
      active: true,
      moved: false,
      x: event.clientX,
      y: event.clientY,
      sx: event.clientX,
      sy: event.clientY,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) <= 12) return;
      drag.moved = true;
      suppressMissedRef.current = true;
    }
    const target = rigTargetRef.current;
    target.yaw += dx * 0.005;
    target.pitch = THREE.MathUtils.clamp(target.pitch + dy * 0.004, -0.55, 0.55);
    target.vyaw = dx * 0.005;
    target.vpitch = dy * 0.004;
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(WORLD_STORAGE_KEY, serializeWorld(world));
    } catch (e) {
      /* приватный режим — мир живёт только в сессии */
    }
  }, [world]);

  /* Приём намерения: processIntent → routeIntent → визуальный отклик роя */
  const submitIntent = (value) => {
    const text = (typeof value === 'string' ? value : intent).trim();
    if (!text) return;
    const action = runtimeRef.current.processIntent(text);
    const currentLayer =
      focusedId === 'all' ? world.activeLayerId || 'core' : focusedId;
    const result = routeIntent(action, {
      world,
      setWorld,
      focusLayer,
      currentLayerId: currentLayer,
      exitToOrbit,
      onStatus: () => {},
      onMood: (mood) => setMode(mood),
    });

    if (result.routed === 'exit') {
      exitToOrbit();
    } else if (result.routed === 'status') {
      setMode(result.mood);
      /* статус из орбиты = вход в сферу: rig поворачивается к слою,
         телеграмма ложится поверх уже сфокусированной сферы */
      if (focusedId === 'all') focusLayer(result.layerId);
      setTelegram({ layerId: result.layerId, status: result.status, mood: result.mood });
      boost(result.layerId, 0.45);
      console.log(
        `Architect: Received intent -> [${result.layerId.toUpperCase()}] ${result.status} (${result.mood.toUpperCase()})`,
      );
    } else if (result.routed === 'mood') {
      console.log(`Architect: Received intent -> mood ${result.mood.toUpperCase()}`);
    } else if (result.routed === 'object') {
      boost(result.layerId, 0.55);
      console.log(`Architect: Spawned @ [${result.layerId.toUpperCase()}] ${result.objectId}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    /* жест продолжается за пределами канваса — слушаем глобально */
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!webgl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05090d]">
        <div className="font-mono text-xs tracking-[0.3em] text-[#7df6d1]">
          WEBGL REQUIRED // ASSOCIATIVE INTERFACE OFFLINE
        </div>
      </div>
    );
  }

  const modeColor = MODE_COLORS[mode] || MODE_COLORS.idle;
  const telegramAccent = telegram
    ? (LAYER_THEMES[telegram.layerId] || { accent: '#7df6d1' }).accent
    : '#7df6d1';

  return (
    <div
      className="relative h-screen overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 50% 46%, #0a1a22 0%, #06101a 48%, #03070c 100%)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
      >
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          camera={{ position: [0, 0, 0], fov: 55, near: 0.05, far: 150 }}
          onPointerMissed={() => {
            if (!suppressMissedRef.current) selectSphere(null);
          }}
        >
          <SceneContent
            focusedId={focusedId}
            onSelect={selectSphere}
            activityRef={activityRef}
            mode={mode}
            world={world}
            rigRef={rigRef}
            rigTargetRef={rigTargetRef}
            dragRef={dragRef}
          />
        </Canvas>
      </div>

      {/* BACK: возврат на орбиту пальцем из любого слоя */}
      {focusedId !== 'all' && (
        <button
          type="button"
          data-ui="back"
          onClick={exitToOrbit}
          aria-label="Вернуться в Регистратор"
          className="fixed top-4 left-4 z-50 px-4 py-2.5 rounded-full font-mono text-[11px] font-bold tracking-[0.18em] select-none active:scale-95 transition-transform cursor-pointer"
          style={{
            color: '#04141c',
            background:
              'radial-gradient(circle at 32% 26%, #eafffa 0%, #7df6d1 52%, #2fae90 100%)',
            border: '1px solid #d9fff5aa',
            boxShadow:
              '0 0 20px #7df6d190, inset 0 1px 0 #ffffffdd, inset 0 -4px 7px #0b4a3caa',
            textShadow: '0 1px 0 #ffffff70',
            transform: 'perspective(300px) rotateX(10deg)',
          }}
        >
          ← РЕГИСТРАТОР
        </button>
      )}

      {/* TELEGRAM: телеметрия слоя поверх сцены (DOM-слой, без канваса) */}
      {telegram && focusedId !== 'all' && (
        <div
          data-ui="telegram"
          className="fixed left-1/2 -translate-x-1/2 top-[24%] z-40 px-4 py-2 rounded-full font-mono text-[11px] tracking-[0.14em] whitespace-nowrap select-none"
          style={{
            pointerEvents: 'none',
            color: '#dffdf5',
            background: 'rgba(6, 20, 28, 0.82)',
            border: `1px solid ${telegramAccent}90`,
            boxShadow: `0 0 16px ${telegramAccent}55, inset 0 0 12px ${telegramAccent}22`,
            textShadow: `0 0 8px ${telegramAccent}`,
          }}
        >
          TELEGRAM // {telegram.status}
          <span style={{ color: MODE_COLORS[telegram.mood] || MODE_COLORS.idle }}>
            {' '}
            [{(telegram.mood || 'idle').toUpperCase()}]
          </span>
        </div>
      )}

      {/* COMMAND PALETTE — единственный способ взаимодействия */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitIntent();
        }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(560px,92vw)] flex items-center gap-2 px-4 py-2.5 rounded-full hud-glass-mid font-mono text-[11px]"
      >
        <span className="shrink-0" style={{ color: modeColor }}>
          architect@netcity:~$
        </span>
        <input
          value={intent}
          onChange={(event) => setIntent(event.target.value)}
          placeholder="ассоциативный ввод → Enter"
          aria-label="Intent input"
          className="min-w-0 flex-1 bg-transparent text-white placeholder:text-slate-500 outline-none"
        />
        <button
          type="submit"
          title="Отправить намерение"
          className="shrink-0 px-2 py-0.5 rounded border border-white/25 cursor-pointer"
          style={{ color: modeColor }}
        >
          ⏎
        </button>
      </form>
    </div>
  );
}
