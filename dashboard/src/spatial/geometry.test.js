import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeometry, createGeometryLibrary, getGeometryBounds } from './geometry.js';

test('creates metre-based primitive geometry and computes bounds', () => {
  const box = createGeometry({ id: 'ground-block', type: 'box', parameters: { width: 4, height: 1, depth: 6 } });
  assert.deepEqual(getGeometryBounds(box), { width: 4, height: 1, depth: 6 });
  assert.equal(box.units, 'metres');
});

test('validates primitive dimensions and mesh asset references', () => {
  assert.throws(() => createGeometry({ id: 'bad', type: 'sphere', parameters: { radius: 0 } }), /radius/);
  assert.throws(() => createGeometry({ id: 'mesh', type: 'mesh' }), /assetRef/);
  assert.throws(() => createGeometryLibrary([
    createGeometry({ id: 'same', type: 'box' }),
    createGeometry({ id: 'same', type: 'sphere' }),
  ]), /duplicate/);
});

test('supports terrain planes with explicit subdivision', () => {
  const terrain = createGeometry({ id: 'terrain', type: 'plane', parameters: { width: 100, height: 100, segmentsX: 128, segmentsY: 128 } });
  assert.equal(terrain.parameters.segmentsX, 128);
  assert.equal(getGeometryBounds(terrain).depth, 100);
});
