import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldScene, addWorldObject, serializeWorldScene, validateWorldScene } from './world.js';
import { createGeometry } from './geometry.js';
import { createLight } from './lighting.js';

test('assembles a world with geometry, materials, lighting and stable references', () => {
  const world = createWorldScene({
    geometries: [createGeometry({ id: 'ground', type: 'plane', parameters: { width: 100, height: 100 } })],
    materials: [{ id: 'earth-01', presetId: 'soil.earth' }],
    lighting: { lights: [createLight({ id: 'sun', type: 'directional', intensity: 100000 })] },
  });
  const next = addWorldObject(world, { id: 'terrain-node', geometryId: 'ground', materialId: 'earth-01' });
  assert.equal(next.revision, 1);
  assert.equal(validateWorldScene(next).valid, true);
  const serialized = JSON.parse(serializeWorldScene(next));
  assert.equal(serialized.schema, 'netcity.world-scene');
  assert.equal(serialized.scene.nodes[0].metadata.geometryId, 'ground');
});

test('rejects unresolved geometry and material references', () => {
  assert.throws(() => createWorldScene({
    nodes: [{ id: 'orphan', metadata: { geometryId: 'missing' } }],
  }), /geometry not found/);
  const world = createWorldScene();
  assert.throws(() => addWorldObject(world, { id: 'orphan', geometryId: 'missing' }), /geometry not found/);
});
