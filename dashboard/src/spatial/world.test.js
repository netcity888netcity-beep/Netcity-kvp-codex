import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYER_THEMES, createSpatialWorld, enterLayer, moveObject, placeObject,
  removeObject, restoreWorld, serializeWorld, worldTheme, worldToScene,
} from './world.js';
import { composeSpatialScene } from './compositor.js';
import { serializeSpatialScene } from './scene.js';

const layers = [{ id: 'core' }, { id: 'tech' }, { id: 'energy' }];
const seed = () => createSpatialWorld({ layers });

test('world seeds every layer with a permanent environment and constellation', () => {
  const world = seed();
  assert.equal(world.activeLayerId, 'core');
  assert.equal(Object.keys(world.layers).length, 3);
  for (const env of Object.values(world.layers)) {
    assert.equal(env.objects.length, 2);
    assert.equal(env.visited, 0);
    assert.deepEqual(env.theme, LAYER_THEMES[env.id]);
  }
  assert.throws(() => createSpatialWorld({ layers: [{ id: 'a' }, { id: 'a' }] }), /duplicate layer/);
});

test('entering a layer activates it without losing sibling state', () => {
  const world = placeObject(seed(), 'energy', { id: 'core-relay', form: 'beacon', position: { x: 1, y: 2, z: 0 } });
  const next = enterLayer(world, 'energy');
  assert.equal(next.activeLayerId, 'energy');
  assert.equal(next.layers.energy.visited, 1);
  assert.equal(next.layers.core.visited, 0);
  assert.equal(next.layers.energy.objects.length, 3);
  assert.equal(world.activeLayerId, 'core');
  assert.equal(world.revision + 1, next.revision);
  assert.throws(() => enterLayer(world, 'missing'), /layer not found/);
});

test('objects can be placed, moved, and removed across persistent layer visits', () => {
  let world = seed();
  world = placeObject(world, 'tech', { id: 'rig', form: 'monolith', position: { x: 0, y: 1 }, scale: 2 });
  world = enterLayer(world, 'tech');
  world = moveObject(world, 'tech', 'rig', { z: -3 });
  const rig = world.layers.tech.objects.find((item) => item.id === 'rig');
  assert.deepEqual(rig.position, { x: 0, y: 1, z: -3 });
  assert.equal(rig.scale, 2);
  assert.equal(world.layers.energy.objects.length, 2);
  assert.throws(() => placeObject(world, 'tech', { id: 'rig', form: 'beacon' }), /already exists/);
  assert.throws(() => placeObject(world, 'tech', { id: 'x', form: 'portal' }), /object.form/);
  assert.equal(moveObject(world, 'tech', 'ghost', { x: 1 }), world);
  world = removeObject(world, 'tech', 'rig');
  assert.equal(world.layers.tech.objects.length, 2);
  assert.equal(removeObject(world, 'tech', 'ghost').revision, world.revision);
});

test('world derives a valid scene graph with layer roots and object metadata', () => {
  const world = enterLayer(seed(), 'energy');
  const scene = worldToScene(world);
  const draw = composeSpatialScene(scene, {
    focusedId: 'layer:energy',
    viewport: { width: 1440, height: 900, pixelRatio: 1 },
  });
  const roots = draw.filter((item) => item.metadata.kind === 'layer');
  const objects = draw.filter((item) => item.metadata.kind === 'object');
  assert.equal(roots.length, 3);
  assert.equal(objects.length, 6);
  assert.equal(roots.find((item) => item.id === 'layer:energy').focused, true);
  assert.equal(roots.find((item) => item.id === 'layer:energy').opacity, 1);
  assert.equal(roots.find((item) => item.id === 'layer:core').opacity, 0.55);
  const beacon = objects.find((item) => item.metadata.layerId === 'core');
  assert.equal(beacon.metadata.form, 'beacon');
  assert.equal(beacon.metadata.accent, LAYER_THEMES.core.accent);
  assert.equal(beacon.opacity, 0.55);
  JSON.parse(serializeSpatialScene(scene));
});

test('world serialization round-trips through storage', () => {
  let world = seed();
  world = enterLayer(world, 'tech');
  world = placeObject(world, 'tech', { id: 'lab', form: 'plinth', position: { x: 4, y: 0, z: 1 }, scale: 1.5 });
  const restored = restoreWorld(serializeWorld(world), layers);
  assert.equal(restored.activeLayerId, 'tech');
  assert.equal(restored.layers.tech.visited, 1);
  assert.equal(restored.layers.tech.objects.length, 3);
  const lab = restored.layers.tech.objects.find((item) => item.id === 'lab');
  assert.deepEqual(lab.position, { x: 4, y: 0, z: 1 });
  assert.equal(lab.scale, 1.5);
});

test('restore falls back to fresh defaults on corrupt or foreign data', () => {
  const corrupt = restoreWorld('{not-json', layers);
  assert.equal(corrupt.activeLayerId, 'core');
  assert.equal(corrupt.layers.core.objects.length, 2);
  const foreign = restoreWorld(
    JSON.stringify({ v: 1, activeLayerId: 'ghost', layers: { ghost: { visited: 9, objects: [] } } }),
    layers,
  );
  assert.equal(foreign.activeLayerId, 'core');
  assert.deepEqual(foreign.layers.ghost, undefined);
  const brokenObjects = restoreWorld(
    JSON.stringify({ v: 1, activeLayerId: 'tech', layers: { tech: { visited: 2, objects: [{ id: '', form: 'x' }] } } }),
    layers,
  );
  assert.equal(brokenObjects.layers.tech.visited, 2);
  assert.equal(brokenObjects.layers.tech.objects.length, 2);
  assert.equal(restoreWorld(null, layers).revision, 0);
});

test('unknown layers use the fallback theme', () => {
  const world = createSpatialWorld({ layers: [{ id: 'mystery' }] });
  const theme = worldTheme(world, 'mystery');
  assert.equal(theme.accent, LAYER_THEMES.core.accent);
  assert.equal(worldTheme(world, 'gone').accent, LAYER_THEMES.core.accent);
});
