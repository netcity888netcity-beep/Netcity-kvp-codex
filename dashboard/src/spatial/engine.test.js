import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addSpatialNode, createSpatialScene, getWorldTransform, removeSpatialNode,
  serializeSpatialScene, updateSpatialNode,
} from './scene.js';
import { composeSpatialScene } from './compositor.js';
import { createSpatialInteractionState, reduceSpatialInteraction } from './interaction.js';

const seed = () => createSpatialScene({ nodes: [
  { id: 'root', type: 'group', opacity: 0.8, transform: { position: { x: 10, y: 0, z: 0 }, scale: { x: 2, y: 2, z: 1 } } },
  { id: 'panel', parentId: 'root', type: 'panel', layer: 2, opacity: 0.5, transform: { position: { x: 3, y: 4, z: 1 } } },
  { id: 'hidden', visible: false },
] });

test('scene graph adds nodes immutably and increments revision', () => {
  const scene = seed();
  const next = addSpatialNode(scene, { id: 'child', parentId: 'root' });
  assert.equal(scene.nodes.child, undefined);
  assert.ok(next.nodes.child);
  assert.equal(next.revision, scene.revision + 1);
});
test('scene graph rejects missing parents, duplicate ids, and cycles', () => {
  assert.throws(() => createSpatialScene({ nodes: [{ id: 'a', parentId: 'missing' }] }), /parent node not found/);
  const scene = seed();
  assert.throws(() => addSpatialNode(scene, { id: 'panel' }), /already exists/);
  assert.throws(() => updateSpatialNode(scene, 'root', { parentId: 'panel' }), /cycle/);
});
test('world transform composes parent position and scale', () => {
  const world = getWorldTransform(seed(), 'panel');
  assert.deepEqual(world.position, { x: 16, y: 8, z: 1 });
  assert.deepEqual(world.scale, { x: 2, y: 2, z: 1 });
});
test('world transform rotates child offsets through the parent quaternion', () => {
  const scene = createSpatialScene({ nodes: [
    { id: 'rotated-root', transform: { rotation: { z: Math.PI / 2 } } },
    { id: 'offset-child', parentId: 'rotated-root', transform: { position: { x: 2, y: 0, z: 0 } } },
  ] });
  const world = getWorldTransform(scene, 'offset-child');
  assert.ok(Math.abs(world.position.x) < 1e-10);
  assert.ok(Math.abs(world.position.y - 2) < 1e-10);
  assert.ok(Math.abs(world.quaternion.z - Math.SQRT1_2) < 1e-10);
});
test('node removal supports recursive deletion and child promotion', () => {
  const scene = addSpatialNode(seed(), { id: 'nested', parentId: 'panel' });
  const recursive = removeSpatialNode(scene, 'root');
  assert.deepEqual(Object.keys(recursive.nodes), ['hidden']);
  const promoted = removeSpatialNode(scene, 'root', { recursive: false });
  assert.equal(promoted.nodes.panel.parentId, null);
  assert.ok(promoted.nodes.nested);
});
test('node updates merge partial transforms without mutating the source scene', () => {
  const scene = seed();
  const next = updateSpatialNode(scene, 'panel', { transform: { position: { x: 9 } } });
  assert.equal(next.nodes.panel.transform.position.x, 9);
  assert.equal(next.nodes.panel.transform.position.y, 4);
  assert.equal(scene.nodes.panel.transform.position.x, 3);
});
test('scene serialization is JSON-safe and preserves revision', () => {
  const scene = seed();
  const parsed = JSON.parse(serializeSpatialScene(scene));
  assert.equal(parsed.id, scene.id);
  assert.equal(parsed.revision, scene.revision);
  assert.equal(parsed.nodes.length, 3);
});
test('compositor filters hidden ancestry, sorts layers and accumulates opacity', () => {
  const scene = addSpatialNode(seed(), { id: 'child-panel', parentId: 'panel', layer: 1 });
  const drawList = composeSpatialScene(scene, { focusedId: 'panel', viewport: { width: 1200, height: 800, pixelRatio: 2 } });
  assert.deepEqual(drawList.map((item) => item.id), ['root', 'child-panel', 'panel']);
  assert.equal(drawList.find((item) => item.id === 'panel').opacity, 0.4);
  assert.equal(drawList.find((item) => item.id === 'panel').focused, true);
  assert.throws(() => composeSpatialScene(scene, { viewport: { width: 0, height: 10 } }), /positive finite/);
});
test('interaction state tracks focus, gaze and pointer drag deltas', () => {
  let state = createSpatialInteractionState();
  state = reduceSpatialInteraction(state, { type: 'focus', nodeId: 'panel' });
  state = reduceSpatialInteraction(state, { type: 'gaze', nodeId: 'panel' });
  state = reduceSpatialInteraction(state, { type: 'pointer-down', pointerId: 7, nodeId: 'panel', x: 10, y: 20 });
  state = reduceSpatialInteraction(state, { type: 'pointer-move', pointerId: 7, x: 18, y: 15 });
  assert.deepEqual(state.drag.delta, { x: 8, y: -5 });
  state = reduceSpatialInteraction(state, { type: 'pointer-up', pointerId: 7 });
  assert.equal(state.drag, null);
  assert.equal(state.activePointerId, null);
  assert.equal(state.focusedId, 'panel');
});
test('interaction ignores events from a non-active pointer', () => {
  const state = createSpatialInteractionState();
  const next = reduceSpatialInteraction(state, { type: 'pointer-move', pointerId: 2, x: 1, y: 1 });
  assert.equal(next, state);
});
