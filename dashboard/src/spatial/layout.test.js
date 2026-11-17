import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dampingFactor,
  isPortraitSize,
  portraitDomFit,
  portraitTargets,
  pxToWorld,
} from './layout.js';

const layers = Array.from({ length: 7 }, (_, index) => ({
  id: `layer-${index}`,
}));

test('orientation switches at the configured aspect threshold', () => {
  assert.equal(isPortraitSize(390, 844), true);
  assert.equal(isPortraitSize(1280, 800), false);
  assert.equal(isPortraitSize(1000, 1000), true);
});

test('portrait layout returns one finite target per layer and centers focus', () => {
  const targets = portraitTargets('layer-3', 390, 844, { current: {} }, layers);
  assert.equal(Object.keys(targets).length, layers.length);
  assert.equal(targets['layer-3'].x, 195);
  for (const target of Object.values(targets)) {
    assert.ok(Number.isFinite(target.x));
    assert.ok(Number.isFinite(target.y));
  }
});

test('portrait fit remains bounded and handles absent measurements', () => {
  const fit = portraitDomFit(844, { current: {} }, 'layer-3', layers);
  assert.ok(fit > 0 && fit <= 1);
});

test('pixel-to-world projection maps viewport center to world origin', () => {
  assert.deepEqual(
    pxToWorld(200, 100, 0, { position: { z: 7 }, fov: 42 }, { width: 400, height: 200 }),
    [0, 0],
  );
});

test('damping factor is stable, bounded, and zero for zero elapsed time', () => {
  assert.equal(dampingFactor(0, 5), 0);
  assert.ok(dampingFactor(1 / 60, 5) > 0);
  assert.ok(dampingFactor(1 / 60, 5) < 1);
  assert.equal(dampingFactor(10, 5), 1);
});
