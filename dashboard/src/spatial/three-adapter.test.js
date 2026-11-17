import test from 'node:test';
import assert from 'node:assert/strict';
import { buildThreeScene, THREE } from './three-adapter.js';
import { createWorldScene, addWorldObject } from './world.js';
import { createGeometry } from './geometry.js';
import { createLight } from './lighting.js';

test('builds a real Three.js scene from canonical geometry and material references', () => {
  const world = createWorldScene({
    geometries: [createGeometry({ id: 'cube', type: 'box', parameters: { width: 2, height: 3, depth: 4 } })],
    materials: [{ id: 'steel-instance', presetId: 'metal.steel' }],
    lighting: { lights: [createLight({ id: 'sun', type: 'directional', intensity: 2 })] },
  });
  const populated = addWorldObject(world, {
    id: 'steel-cube', geometryId: 'cube', materialId: 'steel-instance',
    transform: { position: { x: 3, y: 2, z: 1 } },
  });
  const adapter = buildThreeScene(populated);
  const mesh = adapter.objects.get('steel-cube');
  assert.ok(mesh.isMesh);
  assert.ok(mesh.geometry instanceof THREE.BoxGeometry);
  assert.ok(mesh.material instanceof THREE.MeshPhysicalMaterial);
  assert.equal(mesh.position.x, 3);
  assert.equal(mesh.castShadow, true);
  assert.equal(adapter.resources.lights.length, 1);
  adapter.dispose();
});

test('reports unsupported external mesh assets instead of silently drawing placeholders', () => {
  const world = createWorldScene({
    geometries: [createGeometry({ id: 'external', type: 'mesh', assetRef: 'asset://city/block-01' })],
  });
  const populated = addWorldObject(world, { id: 'building', geometryId: 'external' });
  assert.throws(() => buildThreeScene(populated), /asset resolver/);
});
