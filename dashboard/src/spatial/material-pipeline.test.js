import test from 'node:test';
import assert from 'node:assert/strict';
import { createMaterialInstance, toRendererMaterialDescriptor, validateMaterialInstance } from './material-pipeline.js';

test('creates a material instance from a preset with validated overrides and asset refs', () => {
  const instance = createMaterialInstance({
    id: 'wall-steel-01', presetId: 'metal.steel',
    properties: { roughness: 0.4 },
    assets: { normal: 'asset://surfaces/steel/normal' },
  });
  assert.equal(instance.properties.roughness, 0.4);
  assert.equal(instance.assets.normal, 'asset://surfaces/steel/normal');
  assert.equal(validateMaterialInstance(instance).valid, true);
});

test('rejects invalid material parameters and unknown asset slots', () => {
  assert.throws(() => createMaterialInstance({ id: 'bad', presetId: 'metal.steel', properties: { roughness: 2 } }), /roughness/);
  assert.throws(() => createMaterialInstance({ id: 'bad', presetId: 'metal.steel', assets: { uv: 'asset://x' } }), /unsupported material map/);
  assert.throws(() => createMaterialInstance({ id: 'bad', presetId: 'missing' }), /unknown material preset/);
});

test('renderer descriptor preserves backend independence and reports capability gaps', () => {
  const instance = createMaterialInstance({ id: 'glass-01', presetId: 'glass.clear', assets: { normal: 'asset://glass/normal' } });
  const descriptor = toRendererMaterialDescriptor(instance, { renderer: 'three-webgpu', capabilities: ['normal'] });
  assert.equal(descriptor.renderer, 'three-webgpu');
  assert.equal(descriptor.textureBindings[0].supported, true);
  assert.equal(descriptor.requiresTransmission, true);
});
