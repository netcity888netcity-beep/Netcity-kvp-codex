import test from 'node:test';
import assert from 'node:assert/strict';
import { createLight, createLightingEnvironment, createRayTracingProfile } from './lighting.js';

test('creates physical-unit light sources and lighting environment', () => {
  const sun = createLight({ id: 'sun', type: 'directional', direction: { x: 0, y: -1, z: 0 }, intensity: 100000 });
  const lamp = createLight({ id: 'lamp', type: 'point', position: { x: 1, y: 2, z: 3 }, intensity: 800, range: 12 });
  const env = createLightingEnvironment({ lights: [sun, lamp] });
  assert.equal(env.units, 'physical');
  assert.equal(env.lights.length, 2);
  assert.equal(lamp.range, 12);
});

test('rejects duplicate lights and invalid physical values', () => {
  const light = createLight({ id: 'lamp', type: 'point', intensity: 50 });
  assert.throws(() => createLightingEnvironment({ lights: [light, light] }), /unique/);
  assert.throws(() => createLight({ id: 'bad', type: 'point', intensity: 0 }), /greater than zero/);
});

test('ray tracing profile validates quality and cost controls', () => {
  const profile = createRayTracingProfile({ mode: 'path-traced', maxBounces: 8, samplesPerPixel: 64 });
  assert.equal(profile.globalIllumination, true);
  assert.equal(profile.maxBounces, 8);
  assert.throws(() => createRayTracingProfile({ maxBounces: 0 }), /maxBounces/);
});
