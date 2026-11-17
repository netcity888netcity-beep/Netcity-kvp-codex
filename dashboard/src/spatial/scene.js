/**
 * NetCity Spatial Engine — scene graph.
 * Framework-neutral scene data and immutable graph operations.
 */
const DEFAULT_TRANSFORM = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  rotation: Object.freeze({ x: 0, y: 0, z: 0 }),
  scale: Object.freeze({ x: 1, y: 1, z: 1 }),
});

function assertId(id, label = 'id') {
  if (typeof id !== 'string' || id.trim() === '') throw new TypeError(label + ' must be a non-empty string');
}
function finiteVector(value, fallback, label) {
  const result = {};
  for (const axis of ['x', 'y', 'z']) {
    const candidate = value?.[axis] ?? fallback[axis];
    if (!Number.isFinite(candidate)) throw new TypeError(label + '.' + axis + ' must be finite');
    result[axis] = candidate;
  }
  return result;
}
function normalizeTransform(transform = {}) {
  return {
    position: finiteVector(transform.position, DEFAULT_TRANSFORM.position, 'position'),
    rotation: finiteVector(transform.rotation, DEFAULT_TRANSFORM.rotation, 'rotation'),
    scale: finiteVector(transform.scale, DEFAULT_TRANSFORM.scale, 'scale'),
  };
}
function normalizeNode(input) {
  assertId(input?.id, 'node.id');
  const opacity = input.opacity ?? 1;
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new RangeError('node.opacity must be between 0 and 1');
  if (input.parentId != null) assertId(input.parentId, 'node.parentId');
  return {
    id: input.id,
    type: input.type ?? 'group',
    name: input.name ?? input.id,
    parentId: input.parentId ?? null,
    layer: Number.isFinite(input.layer) ? input.layer : 0,
    visible: input.visible !== false,
    enabled: input.enabled !== false,
    opacity,
    transform: normalizeTransform(input.transform),
    bounds: input.bounds ? { ...input.bounds } : null,
    metadata: input.metadata ? structuredClone(input.metadata) : {},
  };
}
export function createSpatialScene({ id = 'netcity-scene', nodes = [] } = {}) {
  assertId(id, 'scene.id');
  const scene = { id, revision: 0, nodes: {} };
  for (const input of nodes) {
    const node = normalizeNode(input);
    if (Object.hasOwn(scene.nodes, node.id)) throw new Error('duplicate node id: ' + node.id);
    scene.nodes[node.id] = node;
  }
  validateGraph(scene);
  return scene;
}
function validateGraph(scene) {
  for (const node of Object.values(scene.nodes)) {
    if (node.parentId && !scene.nodes[node.parentId]) throw new Error('parent node not found: ' + node.parentId);
    const visited = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId) {
      if (visited.has(parentId)) throw new Error('parent cycle detected at: ' + parentId);
      visited.add(parentId);
      parentId = scene.nodes[parentId]?.parentId ?? null;
    }
  }
}
function nextScene(scene, nodes) {
  return { ...scene, revision: scene.revision + 1, nodes };
}
export function addSpatialNode(scene, input) {
  const node = normalizeNode(input);
  if (Object.hasOwn(scene.nodes, node.id)) throw new Error('node already exists: ' + node.id);
  if (node.parentId && !scene.nodes[node.parentId]) throw new Error('parent node not found: ' + node.parentId);
  return nextScene(scene, { ...scene.nodes, [node.id]: node });
}
export function updateSpatialNode(scene, id, patch) {
  assertId(id);
  const current = scene.nodes[id];
  if (!current) throw new Error('node not found: ' + id);
  const merged = normalizeNode({
    ...current,
    ...patch,
    id,
    transform: {
      ...current.transform,
      ...(patch.transform ?? {}),
      position: { ...current.transform.position, ...(patch.transform?.position ?? {}) },
      rotation: { ...current.transform.rotation, ...(patch.transform?.rotation ?? {}) },
      scale: { ...current.transform.scale, ...(patch.transform?.scale ?? {}) },
    },
  });
  const nodes = { ...scene.nodes, [id]: merged };
  validateGraph({ ...scene, nodes });
  return nextScene(scene, nodes);
}
export function removeSpatialNode(scene, id, { recursive = true } = {}) {
  assertId(id);
  if (!scene.nodes[id]) return scene;
  const removeIds = new Set([id]);
  if (recursive) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of Object.values(scene.nodes)) {
        if (node.parentId && removeIds.has(node.parentId) && !removeIds.has(node.id)) {
          removeIds.add(node.id);
          changed = true;
        }
      }
    }
  }
  const nodes = {};
  for (const [nodeId, node] of Object.entries(scene.nodes)) {
    if (removeIds.has(nodeId)) continue;
    nodes[nodeId] = !recursive && node.parentId === id ? { ...node, parentId: null } : node;
  }
  return nextScene(scene, nodes);
}
function eulerToQuaternion(rotation) {
  const c1 = Math.cos(rotation.x / 2), c2 = Math.cos(rotation.y / 2), c3 = Math.cos(rotation.z / 2);
  const s1 = Math.sin(rotation.x / 2), s2 = Math.sin(rotation.y / 2), s3 = Math.sin(rotation.z / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}
function multiplyQuaternions(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}
function rotateVector(q, vector) {
  const ix = q.w * vector.x + q.y * vector.z - q.z * vector.y;
  const iy = q.w * vector.y + q.z * vector.x - q.x * vector.z;
  const iz = q.w * vector.z + q.x * vector.y - q.y * vector.x;
  const iw = -q.x * vector.x - q.y * vector.y - q.z * vector.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}
function quaternionToEuler(q) {
  const sinPitch = 2 * (q.w * q.y - q.z * q.x);
  return {
    x: Math.atan2(2 * (q.w * q.x + q.y * q.z), 1 - 2 * (q.x * q.x + q.y * q.y)),
    y: Math.asin(Math.max(-1, Math.min(1, sinPitch))),
    z: Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z)),
  };
}
export function getWorldTransform(scene, id) {
  assertId(id);
  const node = scene.nodes[id];
  if (!node) throw new Error('node not found: ' + id);
  const chain = [];
  let cursor = node;
  while (cursor) {
    chain.push(cursor);
    cursor = cursor.parentId ? scene.nodes[cursor.parentId] : null;
  }
  return chain.reverse().reduce((acc, item) => {
    const localPosition = {
      x: item.transform.position.x * acc.scale.x,
      y: item.transform.position.y * acc.scale.y,
      z: item.transform.position.z * acc.scale.z,
    };
    const rotatedPosition = rotateVector(acc.quaternion, localPosition);
    const quaternion = multiplyQuaternions(acc.quaternion, eulerToQuaternion(item.transform.rotation));
    return {
      position: {
        x: acc.position.x + rotatedPosition.x,
        y: acc.position.y + rotatedPosition.y,
        z: acc.position.z + rotatedPosition.z,
      },
      quaternion,
      rotation: quaternionToEuler(quaternion),
      scale: {
        x: acc.scale.x * item.transform.scale.x,
        y: acc.scale.y * item.transform.scale.y,
        z: acc.scale.z * item.transform.scale.z,
      },
    };
  }, {
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  });
}
export function serializeSpatialScene(scene) {
  return JSON.stringify({ id: scene.id, revision: scene.revision, nodes: Object.values(scene.nodes) });
}
