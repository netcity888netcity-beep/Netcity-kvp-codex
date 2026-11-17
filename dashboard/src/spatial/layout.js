/**
 * NetCity Spatial Engine — layout primitives.
 *
 * Pure layout/projection helpers shared by spatial surfaces. This module does
 * not depend on React, Three.js, the KVP core, or device capabilities.
 */

export const PORTRAIT_DOM = Object.freeze({ focal: 0.7, mid: 0.45, far: 0.32 });
export const PORTRAIT_TOP = 64;
export const PORTRAIT_BOTTOM = 72;

export function isPortraitSize(width, height) {
  return width < height * 1.05;
}

function stackGroups(focusedId, layers) {
  const focusedIndex = layers.findIndex((layer) => layer.id === focusedId);
  const mids = [];
  const fars = [];

  layers.forEach((layer, index) => {
    if (index === focusedIndex) return;
    if (Math.abs(index - focusedIndex) <= 2) mids.push(layer);
    else fars.push(layer);
  });

  const topPair = fars.slice(0, 2);
  const botPair = fars.slice(2);
  const topH = topPair.length ? 240 * PORTRAIT_DOM.far : 0;
  const botH = botPair.length ? 240 * PORTRAIT_DOM.far : 0;
  const above = [];
  const below = [];
  let aboveHeight = 0;
  let belowHeight = 0;

  mids.forEach((layer) => {
    const height = 330 * PORTRAIT_DOM.mid;
    if (aboveHeight + topH <= belowHeight + botH) {
      above.push(layer);
      aboveHeight += height;
    } else {
      below.push(layer);
      belowHeight += height;
    }
  });

  return { above, below, topPair, botPair };
}

function measured(slotRegistry, id, key, fallback) {
  return slotRegistry?.current?.[id]?.[key] || fallback;
}

export function portraitDomFit(height, slotRegistry, focusedId, layers) {
  if (!layers.length) return 1;
  const { above, below, topPair, botPair } = stackGroups(focusedId, layers);
  let contentHeight =
    measured(slotRegistry, focusedId, 'ch', 400) * PORTRAIT_DOM.focal;

  above.forEach((layer) => {
    contentHeight += measured(slotRegistry, layer.id, 'ch', 330) * PORTRAIT_DOM.mid;
  });
  below.forEach((layer) => {
    contentHeight += measured(slotRegistry, layer.id, 'ch', 330) * PORTRAIT_DOM.mid;
  });
  if (topPair.length) {
    contentHeight += Math.max(...topPair.map((layer) =>
      measured(slotRegistry, layer.id, 'ch', 240))) * PORTRAIT_DOM.far;
  }
  if (botPair.length) {
    contentHeight += Math.max(...botPair.map((layer) =>
      measured(slotRegistry, layer.id, 'ch', 240))) * PORTRAIT_DOM.far;
  }

  const blocks =
    (topPair.length ? 1 : 0) + above.length + 1 + below.length +
    (botPair.length ? 1 : 0);
  const gap = Math.max(8, height * 0.012);
  const total = contentHeight + Math.max(0, blocks - 1) * gap;
  const usable = Math.max(240, height - PORTRAIT_TOP - PORTRAIT_BOTTOM);
  return Math.min(1, (usable * 0.99) / total);
}

/** Screen-space targets for all spatial layers in portrait orientation. */
export function portraitTargets(focusedId, width, height, slotRegistry, layers) {
  if (!layers.length) return {};
  const fit = portraitDomFit(height, slotRegistry, focusedId, layers);
  const domFocal = PORTRAIT_DOM.focal * fit;
  const domMid = PORTRAIT_DOM.mid * fit;
  const domFar = PORTRAIT_DOM.far * fit;
  const gap = Math.max(8, height * 0.012);
  const { above, below, topPair, botPair } = stackGroups(focusedId, layers);

  const hOf = (id, fallback) => measured(slotRegistry, id, 'ch', fallback);
  const wOf = (id, fallback) => measured(slotRegistry, id, 'cw', fallback);
  const focalHeight = hOf(focusedId, 400) * domFocal;
  const aboveHeights = above.map((layer) => hOf(layer.id, 330) * domMid);
  const belowHeights = below.map((layer) => hOf(layer.id, 330) * domMid);
  const topHeight = topPair.length
    ? Math.max(...topPair.map((layer) => hOf(layer.id, 240))) * domFar : 0;
  const bottomHeight = botPair.length
    ? Math.max(...botPair.map((layer) => hOf(layer.id, 240))) * domFar : 0;
  const topWidth = topPair.length
    ? Math.max(...topPair.map((layer) => wOf(layer.id, 330))) * domFar : 0;
  const bottomWidth = botPair.length
    ? Math.max(...botPair.map((layer) => wOf(layer.id, 330))) * domFar : 0;

  const blocks =
    (topPair.length ? 1 : 0) + above.length + 1 + below.length +
    (botPair.length ? 1 : 0);
  const totalHeight =
    topHeight + aboveHeights.reduce((sum, value) => sum + value, 0) +
    focalHeight + belowHeights.reduce((sum, value) => sum + value, 0) +
    bottomHeight + Math.max(0, blocks - 1) * gap;
  const usable = Math.max(240, height - PORTRAIT_TOP - PORTRAIT_BOTTOM);
  let y = PORTRAIT_TOP + Math.max(0, (usable - totalHeight) / 2);
  const centerX = width / 2;
  const targets = {};

  if (topPair.length) {
    const centerY = y + topHeight / 2;
    const offset = topWidth / 2 + gap / 2;
    if (topPair[0]) targets[topPair[0].id] = { x: centerX - offset, y: centerY };
    if (topPair[1]) targets[topPair[1].id] = { x: centerX + offset, y: centerY };
    y += topHeight + gap;
  }

  above.forEach((layer, index) => {
    targets[layer.id] = { x: centerX, y: y + aboveHeights[index] / 2 };
    y += aboveHeights[index] + gap;
  });
  targets[focusedId] = { x: centerX, y: y + focalHeight / 2 };
  y += focalHeight + gap;

  below.forEach((layer, index) => {
    targets[layer.id] = { x: centerX, y: y + belowHeights[index] / 2 };
    y += belowHeights[index] + gap;
  });

  if (botPair.length) {
    const centerY = y + bottomHeight / 2;
    const offset = bottomWidth / 2 + gap / 2;
    if (botPair[0]) targets[botPair[0].id] = { x: centerX - offset, y: centerY };
    if (botPair[1]) targets[botPair[1].id] = { x: centerX + offset, y: centerY };
  }

  return targets;
}

/** Convert screen pixels to world units at an object's camera-space depth. */
export function pxToWorld(pxX, pxY, objectZ, camera, viewport) {
  const distance = camera.position.z - objectZ;
  const tanHalfFov = Math.tan((camera.fov * Math.PI) / 360);
  const halfHeight = distance * tanHalfFov;
  const aspect = viewport.width / viewport.height;
  const ndcX = (pxX - viewport.width / 2) / (viewport.width / 2);
  const ndcY = (viewport.height / 2 - pxY) / (viewport.height / 2);
  return [ndcX * halfHeight * aspect, ndcY * halfHeight];
}

/** Frame-rate independent exponential interpolation factor. */
export function dampingFactor(deltaSeconds, responsiveness) {
  return 1 - Math.exp(-Math.max(0, deltaSeconds) * Math.max(0, responsiveness));
}
