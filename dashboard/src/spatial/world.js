/**
 * NetCity Spatial Engine — canonical world-scene assembly.
 * The world model stores references and semantic state; renderers and physics
 * adapters interpret it without owning or mutating canonical state.
 */
import { createSpatialScene, addSpatialNode, serializeSpatialScene } from './scene.js';
import { createGeometryLibrary } from './geometry.js';
import { createMaterialInstance } from './material-pipeline.js';
import { createLightingEnvironment } from './lighting.js';

export function createWorldScene({
  id = 'netcity-world',
  nodes = [],
  geometries = [],
  materials = [],
  lighting = {},
  metadata = {},
} = {}) {
  const scene = createSpatialScene({ id, nodes });
  const geometryLibrary = createGeometryLibrary(geometries);
  const materialLibrary = Object.freeze(Object.fromEntries(materials.map((material) => {
    const instance = createMaterialInstance(material);
    return [instance.id, instance];
  })));
  for (const node of Object.values(scene.nodes)) {
    const geometryId = node.metadata?.geometryId;
    const materialId = node.metadata?.materialId;
    if (geometryId && !geometryLibrary[geometryId]) throw new Error('geometry not found for node ' + node.id + ': ' + geometryId);
    if (materialId && !materialLibrary[materialId]) throw new Error('material not found for node ' + node.id + ': ' + materialId);
  }
  const lightEnvironment = lighting.lights
    ? createLightingEnvironment(lighting)
    : createLightingEnvironment();
  return Object.freeze({
    id, revision: 0, scene, geometries: geometryLibrary,
    materials: materialLibrary, lighting: lightEnvironment,
    metadata: Object.freeze({ ...metadata }),
  });
}

export function addWorldObject(world, {
  id, name, type = 'mesh', geometryId, materialId, parentId = null,
  transform, layer = 0, metadata = {},
} = {}) {
  if (!world.geometries[geometryId]) throw new Error('geometry not found: ' + geometryId);
  if (materialId && !world.materials[materialId]) throw new Error('material not found: ' + materialId);
  const scene = addSpatialNode(world.scene, {
    id, name, type, parentId, transform, layer,
    metadata: { ...metadata, geometryId, materialId: materialId ?? null },
  });
  return Object.freeze({ ...world, revision: world.revision + 1, scene });
}

export function serializeWorldScene(world) {
  return JSON.stringify({
    schema: 'netcity.world-scene',
    schemaVersion: 1,
    id: world.id,
    revision: world.revision,
    scene: JSON.parse(serializeSpatialScene(world.scene)),
    geometries: Object.values(world.geometries),
    materials: Object.values(world.materials),
    lighting: world.lighting,
    metadata: world.metadata,
  });
}

export function validateWorldScene(world) {
  const errors = [];
  if (!world || typeof world !== 'object') return { valid: false, errors: ['world must be an object'] };
  for (const node of Object.values(world.scene?.nodes ?? {})) {
    const geometryId = node.metadata?.geometryId;
    const materialId = node.metadata?.materialId;
    if (geometryId && !world.geometries?.[geometryId]) errors.push('missing geometry: ' + geometryId);
    if (materialId && !world.materials?.[materialId]) errors.push('missing material: ' + materialId);
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
