/**
 * NetCity Spatial Engine — deterministic scene composition.
 * Produces renderer-neutral draw descriptors from a scene graph.
 */
import { getWorldTransform } from './scene.js';

function effectiveOpacity(scene, id) {
  let opacity = 1;
  let node = scene.nodes[id];
  while (node) {
    opacity *= node.opacity;
    node = node.parentId ? scene.nodes[node.parentId] : null;
  }
  return opacity;
}
export function composeSpatialScene(scene, {
  focusedId = null,
  includeHidden = false,
  viewport = { width: 1, height: 1, pixelRatio: 1 },
} = {}) {
  if (!Number.isFinite(viewport.width) || viewport.width <= 0 ||
      !Number.isFinite(viewport.height) || viewport.height <= 0) {
    throw new RangeError('viewport width and height must be positive finite numbers');
  }
  const visible = Object.values(scene.nodes).filter((node) => {
    if (!includeHidden && (!node.visible || !node.enabled)) return false;
    let parentId = node.parentId;
    while (parentId) {
      const parent = scene.nodes[parentId];
      if (!parent || (!includeHidden && (!parent.visible || !parent.enabled))) return false;
      parentId = parent.parentId;
    }
    return true;
  });
  return visible
    .map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      layer: node.layer,
      world: getWorldTransform(scene, node.id),
      opacity: effectiveOpacity(scene, node.id),
      focused: node.id === focusedId,
      bounds: node.bounds,
      metadata: node.metadata,
    }))
    .sort((a, b) => a.layer - b.layer || a.world.position.z - b.world.position.z || a.id.localeCompare(b.id))
    .map((item, index) => ({ ...item, drawOrder: index, viewport: { ...viewport } }));
}
