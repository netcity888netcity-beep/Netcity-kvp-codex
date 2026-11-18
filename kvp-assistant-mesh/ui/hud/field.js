import * as THREE from "../vendor/three.module.js";
import { createNode, createTemple, STATE_COLORS } from "./nodes.js";
import { initInteraction } from "./interaction.js";

const stage = document.getElementById("stage");
const labelsBox = document.getElementById("labels");
const templeLine = document.getElementById("temple-line");
const bridgeLine = document.getElementById("bridge-line");
const layer = document.getElementById("layer");
const layerClose = document.getElementById("layer-close");

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.FogExp2(0x05070c, 0.011);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  400
);
const isPortrait = () => window.innerWidth < 700;
const baseCam = () =>
  isPortrait() ? new THREE.Vector3(0, 12, 42) : new THREE.Vector3(0, 11, 33);
let CAM_BASE = baseCam();
camera.position.copy(CAM_BASE);

const lookBase = new THREE.Vector3(0, 0, 0);
const lookCurrent = lookBase.clone();
let camTarget = null;
let lookTarget = null;

scene.add(new THREE.GridHelper(60, 15, 0x1e4460, 0x112435).translateY(-7));

{
  const N = 900;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 70 + Math.random() * 90;
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(v) * Math.cos(u);
    pos[i * 3 + 1] = r * Math.sin(v) * Math.sin(u) * 0.6;
    pos[i * 3 + 2] = r * Math.cos(v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(
    new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x9fd4ff,
        size: 0.55,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      })
    )
  );
}

const temple = createTemple();
scene.add(temple.group);

const tag = (html, cls = "tag") => {
  const el = document.createElement("div");
  el.className = cls;
  el.innerHTML = html;
  labelsBox.appendChild(el);
  return el;
};

const templeTag = tag("ХРАМ · AUM", "tag core");

const fallback = {
  temple: "CACHE",
  assistants: [
    {
      id: "angie_556",
      name: "Энджи 5.5.6",
      sigil: "triangle-spiral",
      model_hint: "gpt-5.6",
      channel: "webview-persistent",
      state: "pending",
      last_line: null,
    },
  ],
  log: [],
};

function mergeNodes(stateDoc, manifestDoc) {
  const byId = new Map(
    ((manifestDoc && manifestDoc.assistants) || []).map((a) => [a.id, a])
  );
  const base = (stateDoc && stateDoc.assistants) || fallback.assistants;
  return base.map((s) => ({ ...((byId.get(s.id) || {})), ...s }));
}

let stateDoc = fallback;
let nodes = [];

function loadLabel(node) {
  const el = tag(
    `${node.def.name.toUpperCase()} · ${node.def.id}<span class="st">${node.state}</span>`
  );
  node.tagEl = el;
  const origSet = node.setState;
  node.setState = (s) => {
    origSet(s);
    el.querySelector(".st").textContent = s;
    el.className = "tag st-" + s;
    updateStatus();
  };
  return el;
}

function updateStatus() {
  const total = nodes.length;
  const online = nodes.filter((n) =>
    ["idle", "active", "thinking"].includes(n.state)
  ).length;
  const templeState = (stateDoc && stateDoc.temple) || "OK";
  if (total > 0 && online === total) {
    templeLine.innerHTML = `TEMPLE_${templeState} · <b>MESH_ONLINE brothers=${online}/${total}</b>`;
  } else {
    templeLine.innerHTML = `TEMPLE_${templeState} · узлы ${online}/${total}`;
  }
}

function updateBridge(node) {
  if (node && node.state === "active") {
    bridgeLine.textContent = `KVP_BRIDGE_ACTIVE ${node.def.id} channel=live`;
  } else if (node) {
    bridgeLine.textContent = `KVP_BRIDGE ${node.def.id} channel=${node.state}`;
  } else {
    bridgeLine.textContent = "";
  }
}

function fillLayer(node) {
  document.getElementById("layer-sigil").textContent = node.def.sigil || "◦";
  document.getElementById("layer-name").textContent = node.def.name;
  document.getElementById("layer-model").textContent = node.def.model_hint || "";
  document.getElementById("layer-id").textContent = node.def.id;
  document.getElementById("layer-channel").textContent = node.def.channel || "—";
  document.getElementById("layer-state").textContent = node.state;
  document.getElementById("layer-last").textContent =
    node.def.last_line || "—";
  document.querySelectorAll(".state-grid button").forEach((b) => {
    b.classList.toggle("on", b.dataset.state === node.state);
  });
}

let selected = null;

function openLayer(node) {
  selected = node;
  layer.classList.remove("hidden");
  fillLayer(node);
  updateBridge(node);
}

function closeLayer() {
  layer.classList.add("hidden");
  if (selected) {
    selected.selected = false;
    selected = null;
  }
  camTarget = null;
  lookTarget = null;
  updateBridge(null);
}

layerClose.addEventListener("click", closeLayer);

document.querySelectorAll(".state-grid button").forEach((b) => {
  b.addEventListener("click", () => {
    if (!selected) return;
    selected.setState(b.dataset.state);
    fillLayer(selected);
    updateBridge(selected);
  });
});

function build(doc) {
  stateDoc = doc || fallback;
  nodes.forEach((n) => scene.remove(n.group));
  nodes.forEach((n) => n.tagEl && n.tagEl.remove());
  const defs = mergeNodes(stateDoc, window.__meshManifest);
  nodes = defs.map((def, i) => {
    const angle =
      defs.length === 1
        ? 0.55
        : (i / defs.length) * Math.PI * 2 - Math.PI / 2;
    const node = createNode(def, angle, isPortrait() ? 8.5 : 14);
    node.setState(def.state || "pending");
    node.tagEl = loadLabel(node);
    scene.add(node.group);
    return node;
  });
  updateStatus();
  updateBridge(null);

  setTimeout(() => {
    nodes.forEach((n) => {
      if (n.state === "pending") n.setState("idle");
    });
    updateStatus();
  }, 1500);
}

const handleSelect = (node) => {
  if (selected && selected !== node) selected.selected = false;
  node.selected = true;
  const p = node.group.position.clone();
  const dir = p.clone().normalize().multiplyScalar(7);
  camTarget = p.clone().add(dir).add(new THREE.Vector3(0, 3.2, 0));
  lookTarget = p.clone();
  openLayer(node);
};

const interaction = initInteraction({
  scene,
  camera,
  renderer,
  getNodes: () => nodes,
  selectNode: handleSelect,
});

async function boot() {
  let manifest = null;
  try {
    const r = await fetch("../assistants.json");
    manifest = await r.json();
  } catch (e) {}
  window.__meshManifest = manifest;
  let doc = fallback;
  try {
    const r = await fetch("../mesh-state.json");
    if (r.ok) doc = await r.json();
  } catch (e) {}
  build(doc);
}
boot().then(() => {
  if (new URLSearchParams(location.search).has("demo")) {
    setTimeout(() => {
      const n = nodes[0];
      if (!n) return;
      n.setState("active");
      handleSelect(n);
    }, 2500);
  }
});

const clock = new THREE.Clock();
const projectV = new THREE.Vector3();

function placeTag(el, obj, dy = 0) {
  obj.getWorldPosition(projectV);
  projectV.y += dy;
  projectV.project(camera);
  const behind = projectV.z > 1;
  const half = (el.offsetWidth || 170) / 2 + 6;
  const x = Math.max(
    half,
    Math.min((projectV.x * 0.5 + 0.5) * window.innerWidth, window.innerWidth - half)
  );
  const y = (-projectV.y * 0.5 + 0.5) * window.innerHeight;
  const off = x < -80 || x > window.innerWidth + 80 || y < -40 || y > window.innerHeight + 40;
  el.style.opacity = behind || off ? "0" : "1";
  el.style.left = x + "px";
  el.style.top = y + "px";
}

function loop() {
  const t = clock.getElapsedTime();
  temple.update(t);
  nodes.forEach((n) => n.update(t));

  placeTag(templeTag, temple.group, 4.6);
  nodes.forEach((n) => placeTag(n.tagEl, n.group, 2.4));

  if (camTarget) {
    camera.position.lerp(camTarget, 0.055);
    lookCurrent.lerp(lookTarget, 0.075);
  } else {
    const drift = new THREE.Vector3(
      CAM_BASE.x + Math.sin(t * 0.11) * 3.4,
      CAM_BASE.y + Math.sin(t * 0.07) * 1.6,
      CAM_BASE.z + Math.cos(t * 0.09) * 2.2
    );
    camera.position.lerp(drift, 0.03);
    lookCurrent.lerp(lookBase, 0.05);
  }
  camera.lookAt(lookCurrent);

  interaction.updateHover();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  CAM_BASE = baseCam();
});

export { nodes, updateStatus, updateBridge, fillLayer };
