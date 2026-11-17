/**
 * NetCity Spatial Engine — material asset pipeline and renderer contract.
 * This module validates material instances without depending on a renderer.
 */
import { getMaterialPreset } from './materials.js';

const MAP_KEYS = Object.freeze(['albedo', 'normal', 'roughness', 'metalness', 'displacement', 'ao', 'opacity', 'transmission']);
const clamp01 = (value, label) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(label + ' must be between 0 and 1');
  return value;
};
const finitePositive = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(label + ' must be positive and finite');
  return value;
};

export function createMaterialInstance({
  id,
  presetId,
  name,
  properties = {},
  assets = {},
  metadata = {},
} = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('material instance id is required');
  const preset = getMaterialPreset(presetId);
  if (!preset) throw new Error('unknown material preset: ' + presetId);
  const merged = { ...preset.properties, ...properties };
  clamp01(merged.metalness, 'metalness');
  clamp01(merged.roughness, 'roughness');
  clamp01(merged.opacity, 'opacity');
  clamp01(merged.transmission, 'transmission');
  clamp01(merged.clearcoat, 'clearcoat');
  finitePositive(merged.ior, 'ior');
  if (typeof merged.baseColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(merged.baseColor)) {
    throw new TypeError('baseColor must be a six-digit hex color');
  }
  if (merged.thicknessM < 0 || !Number.isFinite(merged.thicknessM)) {
    throw new RangeError('thicknessM must be finite and non-negative');
  }
  for (const key of Object.keys(assets)) {
    if (!MAP_KEYS.includes(key)) throw new Error('unsupported material map: ' + key);
    if (typeof assets[key] !== 'string' || !assets[key].trim()) {
      throw new TypeError('asset reference for ' + key + ' must be a non-empty string');
    }
  }
  return Object.freeze({
    id,
    presetId,
    name: name ?? preset.name,
    model: preset.model,
    properties: Object.freeze(merged),
    physical: preset.physical,
    assets: Object.freeze({ ...assets }),
    metadata: Object.freeze({ ...metadata }),
    catalogueVersion: '1.0.0',
  });
}

/**
 * Renderer adapters consume this stable descriptor and map asset references
 * to renderer-specific texture handles in their own resource manager.
 */
export function toRendererMaterialDescriptor(instance, { renderer, capabilities = [] } = {}) {
  if (!instance?.id || !instance?.properties) throw new TypeError('a material instance is required');
  if (typeof renderer !== 'string' || !renderer.trim()) throw new TypeError('renderer name is required');
  return Object.freeze({
    renderer,
    model: instance.model,
    materialId: instance.id,
    properties: instance.properties,
    textureBindings: Object.freeze(Object.entries(instance.assets).map(([slot, assetRef]) =>
      Object.freeze({ slot, assetRef, supported: capabilities.includes(slot) })
    )),
    requiresTransmission: instance.properties.transmission > 0,
    requiresAnisotropy: instance.properties.anisotropy > 0,
  });
}

export function validateMaterialInstance(instance) {
  const errors = [];
  if (!instance || typeof instance !== 'object') return { valid: false, errors: ['instance must be an object'] };
  try {
    createMaterialInstance({
      id: instance.id,
      presetId: instance.presetId,
      name: instance.name,
      properties: instance.properties,
      assets: instance.assets,
      metadata: instance.metadata,
    });
  } catch (error) {
    errors.push(error.message);
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
