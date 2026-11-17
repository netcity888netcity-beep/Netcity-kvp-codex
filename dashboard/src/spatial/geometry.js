/**
 * NetCity Spatial Engine — renderer-neutral geometry descriptors.
 * Dimensions and transforms use metres; tessellation is an adapter concern.
 */
const finitePositive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(label + ' must be positive and finite');
  return value;
};
const integerRange = (value, min, max, label) => {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(label + ' must be an integer from ' + min + ' to ' + max);
  return value;
};
const freeze = (value) => Object.freeze(value);

export function createGeometry({ id, type, parameters = {}, assetRef = null, metadata = {} } = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('geometry id is required');
  if (!['box', 'plane', 'sphere', 'cylinder', 'capsule', 'mesh'].includes(type)) {
    throw new Error('unsupported geometry type: ' + type);
  }
  const p = { ...parameters };
  if (type === 'box') {
    p.width = finitePositive(p.width ?? 1, 'box width');
    p.height = finitePositive(p.height ?? 1, 'box height');
    p.depth = finitePositive(p.depth ?? 1, 'box depth');
  } else if (type === 'plane') {
    p.width = finitePositive(p.width ?? 1, 'plane width');
    p.height = finitePositive(p.height ?? 1, 'plane height');
    p.segmentsX = integerRange(p.segmentsX ?? 1, 1, 4096, 'plane segmentsX');
    p.segmentsY = integerRange(p.segmentsY ?? 1, 1, 4096, 'plane segmentsY');
  } else if (type === 'sphere') {
    p.radius = finitePositive(p.radius ?? 0.5, 'sphere radius');
    p.widthSegments = integerRange(p.widthSegments ?? 32, 3, 4096, 'sphere widthSegments');
    p.heightSegments = integerRange(p.heightSegments ?? 16, 2, 4096, 'sphere heightSegments');
  } else if (type === 'cylinder') {
    p.radiusTop = finitePositive(p.radiusTop ?? 0.5, 'cylinder radiusTop');
    p.radiusBottom = finitePositive(p.radiusBottom ?? 0.5, 'cylinder radiusBottom');
    p.height = finitePositive(p.height ?? 1, 'cylinder height');
    p.radialSegments = integerRange(p.radialSegments ?? 32, 3, 4096, 'cylinder radialSegments');
  } else if (type === 'capsule') {
    p.radius = finitePositive(p.radius ?? 0.5, 'capsule radius');
    p.length = finitePositive(p.length ?? 1, 'capsule length');
    p.capSegments = integerRange(p.capSegments ?? 8, 1, 256, 'capsule capSegments');
  } else {
    if (typeof assetRef !== 'string' || !assetRef.trim()) throw new TypeError('mesh geometry requires an assetRef');
  }
  if (assetRef != null && typeof assetRef !== 'string') throw new TypeError('assetRef must be a string or null');
  return freeze({
    id, type, parameters: freeze(p), assetRef,
    units: 'metres',
    metadata: freeze({ ...metadata }),
  });
}

export function createGeometryLibrary(geometries = []) {
  if (!Array.isArray(geometries)) throw new TypeError('geometries must be an array');
  const entries = {};
  for (const geometry of geometries) {
    if (!geometry?.id) throw new TypeError('each geometry must have an id');
    if (entries[geometry.id]) throw new Error('duplicate geometry id: ' + geometry.id);
    entries[geometry.id] = geometry;
  }
  return freeze(entries);
}

export function getGeometryBounds(geometry) {
  if (!geometry || !geometry.type) throw new TypeError('geometry is required');
  const p = geometry.parameters;
  if (geometry.type === 'box') return freeze({ width: p.width, height: p.height, depth: p.depth });
  if (geometry.type === 'plane') return freeze({ width: p.width, height: 0, depth: p.height });
  if (geometry.type === 'sphere') return freeze({ width: p.radius * 2, height: p.radius * 2, depth: p.radius * 2 });
  if (geometry.type === 'cylinder') return freeze({ width: Math.max(p.radiusTop, p.radiusBottom) * 2, height: p.height, depth: Math.max(p.radiusTop, p.radiusBottom) * 2 });
  if (geometry.type === 'capsule') return freeze({ width: p.radius * 2, height: p.length + p.radius * 2, depth: p.radius * 2 });
  return null;
}
