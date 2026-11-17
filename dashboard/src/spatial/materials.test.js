import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIAL_CATALOG, MATERIAL_CATALOG_VERSION, MATERIAL_FAMILIES,
  getMaterialPreset, listMaterialPresets, bindMaterialAssets,
} from './materials.js';

test('catalogue exposes stable IDs across broad material families', () => {
  assert.equal(MATERIAL_CATALOG_VERSION, '1.0.0');
  assert.ok(Object.keys(MATERIAL_CATALOG).length >= 40);
  for (const family of ['stone', 'metal', 'wood', 'glass', 'ceramic', 'polymer', 'textile', 'liquid', 'organic']) {
    assert.ok(MATERIAL_FAMILIES.includes(family), 'missing family: ' + family);
  }
});

test('PBR presets carry validated baseline values and renderer-neutral map slots', () => {
  for (const preset of Object.values(MATERIAL_CATALOG)) {
    assert.ok(preset.id && preset.family && preset.name);
    assert.ok(preset.properties.roughness >= 0 && preset.properties.roughness <= 1);
    assert.ok(preset.properties.metalness >= 0 && preset.properties.metalness <= 1);
    assert.ok(preset.properties.opacity >= 0 && preset.properties.opacity <= 1);
    assert.ok(preset.properties.ior > 0);
    assert.ok(Object.hasOwn(preset.maps, 'normal'));
    assert.equal(preset.provenance, 'procedural-preset');
  }
});

test('lookup and family filtering return known presets only', () => {
  assert.equal(getMaterialPreset('metal.steel').physical.densityKgM3, 7850);
  assert.equal(getMaterialPreset('missing.material'), null);
  assert.ok(listMaterialPresets({ family: 'glass' }).some((item) => item.id === 'glass.clear'));
  assert.equal(listMaterialPresets({ query: 'carbon-fibre' })[0].id, 'composite.carbon-fiber');
});

test('asset binding is immutable and rejects unknown presets, maps and non-string refs', () => {
  const preset = getMaterialPreset('metal.steel');
  const bound = bindMaterialAssets('metal.steel', { normal: 'asset://steel/normal' });
  assert.equal(bound.maps.normal, 'asset://steel/normal');
  assert.equal(preset.maps.normal, null);
  assert.equal(bound.provenance, 'asset-bound');
  assert.throws(() => bindMaterialAssets('unknown'), /unknown material preset/);
  assert.throws(() => bindMaterialAssets('metal.steel', { roughnessMap: 'asset://x' }), /unsupported material map/);
  assert.throws(() => bindMaterialAssets('metal.steel', { normal: 42 }), /must be strings/);
});
