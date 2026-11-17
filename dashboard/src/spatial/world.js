/**
 * NetCity Spatial Engine — spatial world.
 *
 * Persistent world model for the unified nervous system: every layer owns a
 * permanent environment (theme, visit state, spatial objects). The world is
 * framework-neutral; presentation surfaces derive a scene graph from it.
 */
import { createSpatialScene, addSpatialNode } from './scene.js';

export const WORLD_STORAGE_KEY = 'netcity.spatial-world.v1';

export const LAYER_THEMES = Object.freeze({
  core: Object.freeze({ accent: '#7df6d1', secondary: '#aab7ff' }),
  tech: Object.freeze({ accent: '#8fb4ff', secondary: '#7df6d1' }),
  civic: Object.freeze({ accent: '#7ee0ff', secondary: '#aab7ff' }),
  energy: Object.freeze({ accent: '#ffb45e', secondary: '#ffe6b0' }),
  bio: Object.freeze({ accent: '#7dffa8', secondary: '#d0ffe0' }),
  info: Object.freeze({ accent: '#c9a8ff', secondary: '#aab7ff' }),
  ident: Object.freeze({ accent: '#ff9fd0', secondary: '#ffd0e8' }),
});

const FALLBACK_THEME = Object.freeze({ accent: '#7df6d1', secondary: '#aab7ff' });
const OBJECT_FORMS = Object.freeze(['beacon', 'plinth', 'monolith']);
const LAYER_ROOT_OPACITY = Object.freeze({ active: 1, inactive: 0.55 });

function assertLayerId(layerId) {
  if (typeof layerId !== 'string' || layerId.trim() === '') {
    throw new TypeError('layerId must be a non-empty string');
  }
}
function finiteVector(value, label) {
  const result = {};
  for (const axis of ['x', 'y', 'z']) {
    const candidate = value?.[axis] ?? 0;
    if (!Number.isFinite(candidate)) throw new TypeError(label + '.' + axis + ' must be finite');
    result[axis] = candidate;
  }
  return result;
}
function normalizeObject(input) {
  if (typeof input?.id !== 'string' || input.id.trim() === '') {
    throw new TypeError('object.id must be a non-empty string');
  }
  if (!OBJECT_FORMS.includes(input.form)) {
    throw new RangeError('object.form must be one of: ' + OBJECT_FORMS.join(', '));
  }
  const scale = input.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('object.scale must be a positive finite number');
  return {
    id: input.id,
    form: input.form,
    position: finiteVector(input.position, 'object.position'),
    scale,
  };
}

/* Deterministic seed constellation for every layer (side alternates by index). */
function defaultObjects(layerId, index) {
  const side = index % 2 === 0 ? -1 : 1;
  return [
    { id: layerId + '-beacon', form: 'beacon', position: { x: side * 1.7, y: 0.62, z: -0.25 }, scale: 1 },
    { id: layerId + '-plinth', form: 'plinth', position: { x: side * 1.5, y: -0.78, z: -0.15 }, scale: 1 },
  ];
}

export function createSpatialWorld({ id = 'netcity-world', layers = [] } = {}) {
  if (typeof id !== 'string' || id.trim() === '') throw new TypeError('world.id must be a non-empty string');
  const entries = {};
  layers.forEach((layer, index) => {
    assertLayerId(layer?.id);
    if (Object.hasOwn(entries, layer.id)) throw new Error('duplicate layer id: ' + layer.id);
    entries[layer.id] = {
      id: layer.id,
      visited: 0,
      theme: LAYER_THEMES[layer.id] ?? FALLBACK_THEME,
      objects: defaultObjects(layer.id, index).map(normalizeObject),
    };
  });
  return {
    id,
    revision: 0,
    activeLayerId: layers[0]?.id ?? null,
    layers: entries,
  };
}

/** Enter a layer: activation is recorded, all other layer state is preserved. */
export function enterLayer(world, layerId) {
  assertLayerId(layerId);
  const target = world.layers[layerId];
  if (!target) throw new Error('layer not found: ' + layerId);
  return {
    ...world,
    revision: world.revision + 1,
    activeLayerId: layerId,
    layers: {
      ...world.layers,
      [layerId]: { ...target, visited: target.visited + 1 },
    },
  };
}

/** Attach a spatial object to a layer environment. */
export function placeObject(world, layerId, input) {
  assertLayerId(layerId);
  const env = world.layers[layerId];
  if (!env) throw new Error('layer not found: ' + layerId);
  const object = normalizeObject(input);
  if (env.objects.some((item) => item.id === object.id)) {
    throw new Error('object already exists: ' + object.id);
  }
  for (const [otherId, otherEnv] of Object.entries(world.layers)) {
    if (otherEnv.objects.some((item) => item.id === object.id)) {
      throw new Error('object already exists in layer ' + otherId + ': ' + object.id);
    }
  }
  return {
    ...world,
    revision: world.revision + 1,
    layers: {
      ...world.layers,
      [layerId]: { ...env, objects: [...env.objects, object] },
    },
  };
}

/** Move an object inside its layer environment. Missing objects are a no-op. */
export function moveObject(world, layerId, objectId, position) {
  assertLayerId(layerId);
  const env = world.layers[layerId];
  if (!env) throw new Error('layer not found: ' + layerId);
  const index = env.objects.findIndex((item) => item.id === objectId);
  if (index === -1) return world;
  const next = finiteVector({ ...env.objects[index].position, ...position }, 'position');
  const objects = env.objects.slice();
  objects[index] = { ...objects[index], position: next };
  return {
    ...world,
    revision: world.revision + 1,
    layers: { ...world.layers, [layerId]: { ...env, objects } },
  };
}

/** Remove an object from its layer environment. Missing objects are a no-op. */
export function removeObject(world, layerId, objectId) {
  assertLayerId(layerId);
  const env = world.layers[layerId];
  if (!env) throw new Error('layer not found: ' + layerId);
  if (!env.objects.some((item) => item.id === objectId)) return world;
  return {
    ...world,
    revision: world.revision + 1,
    layers: {
      ...world.layers,
      [layerId]: { ...env, objects: env.objects.filter((item) => item.id !== objectId) },
    },
  };
}

export function worldTheme(world, layerId) {
  return world.layers[layerId]?.theme ?? world.layers[world.activeLayerId]?.theme ?? FALLBACK_THEME;
}

/**
 * Derive a scene graph from the world: one root group per layer (permanent,
 * dimmed but never removed when inactive) and one node per spatial object.
 */
export function worldToScene(world) {
  let scene = createSpatialScene({ id: world.id + '-scene' });
  for (const layerId of Object.keys(world.layers)) {
    const env = world.layers[layerId];
    const active = layerId === world.activeLayerId;
    scene = addSpatialNode(scene, {
      id: 'layer:' + layerId,
      type: 'group',
      name: layerId,
      layer: active ? 10 : 5,
      opacity: active ? LAYER_ROOT_OPACITY.active : LAYER_ROOT_OPACITY.inactive,
      metadata: { kind: 'layer', layerId, active, accent: env.theme.accent },
    });
    for (const object of env.objects) {
      scene = addSpatialNode(scene, {
        id: 'object:' + layerId + ':' + object.id,
        parentId: 'layer:' + layerId,
        type: 'spatial-object',
        layer: active ? 11 : 6,
        transform: {
          position: object.position,
          scale: { x: object.scale, y: object.scale, z: object.scale },
        },
        metadata: {
          kind: 'object',
          layerId,
          form: object.form,
          accent: env.theme.accent,
          active,
        },
      });
    }
  }
  return scene;
}

export function serializeWorld(world) {
  const layers = {};
  for (const [layerId, env] of Object.entries(world.layers)) {
    layers[layerId] = { visited: env.visited, objects: env.objects };
  }
  return JSON.stringify({ v: 1, activeLayerId: world.activeLayerId, layers });
}

/**
 * Restore a world over fresh defaults. Stored data only overrides known
 * layers, so schema evolution never corrupts the environment.
 */
export function restoreWorld(source, layers = []) {
  const fresh = createSpatialWorld({ layers });
  if (source == null) return fresh;
  let parsed = source;
  if (typeof source === 'string') {
    try {
      parsed = JSON.parse(source);
    } catch (e) {
      return fresh;
    }
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.layers || typeof parsed.layers !== 'object') {
    return fresh;
  }
  const entries = { ...fresh.layers };
  for (const [layerId, saved] of Object.entries(parsed.layers)) {
    const env = entries[layerId];
    if (!env || !saved || typeof saved !== 'object') continue;
    const objects = Array.isArray(saved.objects)
      ? saved.objects.map((item) => {
          try {
            return normalizeObject(item);
          } catch (e) {
            return null;
          }
        }).filter(Boolean)
      : env.objects;
    entries[layerId] = {
      ...env,
      visited: Number.isFinite(saved.visited) && saved.visited >= 0 ? Math.floor(saved.visited) : env.visited,
      objects: objects.length ? objects : env.objects,
    };
  }
  const activeLayerId =
    typeof parsed.activeLayerId === 'string' && entries[parsed.activeLayerId]
      ? parsed.activeLayerId
      : fresh.activeLayerId;
  return { ...fresh, revision: (Number.isFinite(parsed.revision) ? parsed.revision : 0) + 1, activeLayerId, layers: entries };
}
