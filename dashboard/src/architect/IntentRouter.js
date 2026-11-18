/**
 * NetCity Architect Runtime — intent router.
 *
 * Takes an action produced by ArchitectRuntime and dispatches it into the
 * Spatial Engine: focus actions enter layers through spatial/world.js,
 * spawn actions materialize permanent world objects.
 */
import { placeObject } from '../spatial/world.js';

const SPAWN_FORMS = ['monolith', 'beacon', 'plinth'];
let spawnCounter = 0;

/** Build a deterministic spatial object and attach it via world.js. */
export function spawnSpatialObject(world, layerId, payload = '') {
  const env = world.layers[layerId];
  if (!env) return { world, routed: 'none', layerId, objectId: null };

  let objectId;
  do {
    spawnCounter += 1;
    objectId = layerId + '-spawn-' + spawnCounter;
  } while (env.objects.some((item) => item.id === objectId));

  const angle = (world.revision + spawnCounter) * 0.9;
  const object = {
    id: objectId,
    form: SPAWN_FORMS[spawnCounter % SPAWN_FORMS.length],
    position: {
      x: Math.cos(angle) * 1.85,
      y: ((spawnCounter % 3) - 1) * 0.45,
      z: -0.35,
    },
    scale: 1,
  };
  const next = placeObject(world, layerId, object);
  return { world: next, routed: 'object', layerId, objectId };
}

/**
 * Route an action into the spatial engine adapters.
 * engine = { world, setWorld, focusLayer, currentLayerId }
 */
export function routeIntent(action, engine = {}) {
  if (!action || !action.action) return { routed: 'none' };
  const { world, setWorld, focusLayer, currentLayerId } = engine;

  if (action.action === 'focus') {
    const layerId = action.targetLayer;
    if (!world || !world.layers[layerId]) return { routed: 'none', layerId };
    focusLayer?.(layerId);
    return { routed: 'layer', layerId };
  }

  if (action.action === 'spawn_object') {
    const requested = action.targetLayer;
    const layerId =
      requested && requested !== 'current'
        ? requested
        : currentLayerId || world?.activeLayerId;
    if (!world || !world.layers[layerId]) return { routed: 'none', layerId };
    const result = spawnSpatialObject(world, layerId, action.payload);
    if (result.routed === 'object') setWorld?.(result.world);
    return { routed: 'object', layerId, objectId: result.objectId };
  }

  return { routed: 'none' };
}
