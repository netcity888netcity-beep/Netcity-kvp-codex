import * as THREE from "../vendor/three.module.js";

export function initInteraction({ scene, camera, renderer, getNodes, selectNode }) {
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let hovered = null;
  let down = null;

  function setPtr(e) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    ptr.x = (cx / w) * 2 - 1;
    ptr.y = -(cy / h) * 2 + 1;
    return { cx, cy };
  }

  function pick() {
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(
      getNodes().map((n) => n.hit),
      false
    );
    if (!hits.length) return null;
    return getNodes().find((n) => n.hit === hits[0].object) || null;
  }

  function onDown(e) {
    const { cx, cy } = setPtr(e);
    down = { cx, cy, t: Date.now() };
  }

  function onUp(e) {
    if (!down) return;
    const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const moved = Math.hypot(cx - down.cx, cy - down.cy);
    const dt = Date.now() - down.t;
    down = null;
    if (moved > 8 || dt > 500) return;
    setPtr(e);
    const node = pick();
    if (node) selectNode(node);
  }

  function onMove(e) {
    setPtr(e);
  }

  window.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointermove", onMove);

  function updateHover() {
    const node = pick();
    if (node !== hovered) {
      hovered = node;
      renderer.domElement.style.cursor = node ? "pointer" : "default";
    }
  }

  return { updateHover };
}
