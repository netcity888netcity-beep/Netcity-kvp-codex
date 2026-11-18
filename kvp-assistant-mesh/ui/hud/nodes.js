import * as THREE from "../vendor/three.module.js";

export const STATE_COLORS = {
  pending: 0xe0a94a,
  idle: 0x7de3ff,
  active: 0x5dff9a,
  thinking: 0xb18cff,
  error: 0xff5d5d,
};

const STATE_NAMES = {
  pending: "pending",
  idle: "idle",
  active: "active",
  thinking: "thinking",
  error: "error",
};

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.28, "rgba(255,255,255,0.42)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

let GLOW = null;

export function createNode(def, angle, radius) {
  const color = new THREE.Color(STATE_COLORS[def.state] || STATE_COLORS.idle);
  const group = new THREE.Group();
  group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);

  const cloudGeo = new THREE.BufferGeometry();
  const N = 90;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    const r = 0.85 + Math.random() * 0.75;
    pos[i * 3] = r * Math.sin(v) * Math.cos(u);
    pos[i * 3 + 1] = r * Math.sin(v) * Math.sin(u);
    pos[i * 3 + 2] = r * Math.cos(v);
  }
  cloudGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const cloudMat = new THREE.PointsMaterial({
    color,
    size: 0.11,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  group.add(cloud);

  const coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), coreMat);
  group.add(core);

  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.65, 0)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 })
  );
  group.add(cage);

  if (!GLOW) GLOW = glowTexture();
  const haloMat = new THREE.SpriteMaterial({
    map: GLOW,
    color,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(6.4);
  group.add(halo);

  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 12, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  group.add(hit);

  const api = {
    def,
    group,
    hit,
    state: def.state || "pending",
    selected: false,
    phase: Math.random() * Math.PI * 2,
    shake: 0,
    setState(s) {
      api.state = s;
      const c = new THREE.Color(STATE_COLORS[s] || STATE_COLORS.idle);
      cloudMat.color.copy(c);
      coreMat.color.copy(c);
      haloMat.color.copy(c);
      cage.material.color.copy(c);
      api.shake = s === "error" ? 1 : 0;
      if (api.onState) api.onState(s);
    },
    update(t) {
      const bob = Math.sin(t * 0.9 + api.phase) * 0.35;
      group.position.y = bob;
      cloud.rotation.y = t * (api.state === "thinking" ? 1.9 : 0.35);
      cloud.rotation.x = t * 0.2;
      cage.rotation.y = -t * 0.3;
      cage.rotation.z = t * 0.14;

      let pulse = 0.5;
      let scale = 6.4;
      if (api.state === "active") pulse = 0.72 + Math.sin(t * 3) * 0.12;
      if (api.state === "thinking") {
        pulse = 0.6 + Math.sin(t * 6.5) * 0.25;
        scale = 7.2 + Math.sin(t * 6.5) * 1.2;
      }
      if (api.state === "pending") pulse = 0.3;
      if (api.state === "error") pulse = 0.55 + Math.sin(t * 22) * 0.3;
      if (api.selected) scale *= 1.22;
      haloMat.opacity = pulse;
      halo.scale.setScalar(scale);
      core.rotation.x = t * 0.8;

      if (api.shake > 0) {
        group.position.x =
          Math.cos(angle) * radius + (Math.random() - 0.5) * 0.16 * api.shake;
        group.position.z =
          Math.sin(angle) * radius + (Math.random() - 0.5) * 0.16 * api.shake;
      } else if (group.position.x !== Math.cos(angle) * radius) {
        group.position.x = Math.cos(angle) * radius;
        group.position.z = Math.sin(angle) * radius;
      }
    },
  };
  return api;
}

export function createTemple() {
  const group = new THREE.Group();

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.4, 2),
    new THREE.MeshBasicMaterial({
      color: 0x2b6f9c,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    })
  );
  group.add(shell);

  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshBasicMaterial({ color: 0x7de3ff, transparent: true, opacity: 0.16 })
  );
  group.add(inner);

  if (!GLOW) GLOW = glowTexture();
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: GLOW,
      color: 0x57c7ff,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.scale.setScalar(13);
  group.add(halo);

  return {
    group,
    update(t) {
      shell.rotation.y = t * 0.16;
      shell.rotation.x = Math.sin(t * 0.3) * 0.2;
      inner.rotation.y = -t * 0.4;
      halo.material.opacity = 0.3 + Math.sin(t * 1.4) * 0.08;
    },
  };
}

export { STATE_NAMES };
