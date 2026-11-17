/**
 * NetCity Spatial Engine — renderer-neutral physically based lighting model.
 * Units: positions/distances in metres, angles in radians, luminous intensity
 * in candela, illuminance in lux, and color temperature in kelvin.
 */
const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite');
  return value;
};
const positive = (value, label) => {
  finite(value, label);
  if (value <= 0) throw new RangeError(label + ' must be greater than zero');
  return value;
};
const vector = (value, label) => {
  if (!value || !['x', 'y', 'z'].every((axis) => Number.isFinite(value[axis]))) {
    throw new TypeError(label + ' must contain finite x, y, z coordinates');
  }
  return Object.freeze({ x: value.x, y: value.y, z: value.z });
};
const color = (value, label) => {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new TypeError(label + ' must be a six-digit hex color');
  return value.toLowerCase();
};

export function createLight({ id, type, position = { x: 0, y: 0, z: 0 }, direction, color: tint = '#ffffff', intensity, range, temperatureK, castShadow = true } = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('light id is required');
  if (!['directional', 'point', 'spot', 'area', 'ambient'].includes(type)) throw new Error('unsupported light type: ' + type);
  const light = { id, type, color: color(tint, 'light color'), intensity: positive(intensity ?? 1, 'light intensity'), castShadow: Boolean(castShadow) };
  if (type !== 'directional' && type !== 'ambient') light.position = vector(position, 'light position');
  if (type === 'directional' || type === 'spot') light.direction = vector(direction ?? { x: 0, y: -1, z: 0 }, 'light direction');
  if (type === 'point' || type === 'spot') light.range = positive(range ?? 10, 'light range');
  if (type === 'spot') {
    light.innerConeRadians = finite(0.35, 'inner cone');
    light.outerConeRadians = finite(0.7, 'outer cone');
  }
  if (temperatureK != null) {
    positive(temperatureK, 'temperatureK');
    light.temperatureK = temperatureK;
  }
  return Object.freeze(light);
}

export function createLightingEnvironment({
  id = 'netcity-lighting',
  lights = [],
  environment = { type: 'procedural-sky', turbidity: 2, groundAlbedo: '#808080' },
  exposure = 1,
  units = 'physical',
} = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('lighting environment id is required');
  if (!Array.isArray(lights)) throw new TypeError('lights must be an array');
  if (new Set(lights.map((light) => light.id)).size !== lights.length) throw new Error('light ids must be unique');
  positive(exposure, 'exposure');
  if (units !== 'physical') throw new Error('only physical lighting units are supported');
  return Object.freeze({
    id, revision: 0, units,
    lights: Object.freeze(lights.slice()),
    environment: Object.freeze({ ...environment }),
    exposure,
  });
}

export function createRayTracingProfile({
  enabled = true,
  mode = 'progressive',
  maxBounces = 6,
  samplesPerPixel = 1,
  denoiser = 'temporal',
  reflections = true,
  refractions = true,
  globalIllumination = true,
  ambientOcclusion = true,
} = {}) {
  if (!['realtime', 'progressive', 'path-traced'].includes(mode)) throw new Error('unsupported ray tracing mode: ' + mode);
  if (!Number.isInteger(maxBounces) || maxBounces < 1 || maxBounces > 64) throw new RangeError('maxBounces must be an integer from 1 to 64');
  if (!Number.isInteger(samplesPerPixel) || samplesPerPixel < 1 || samplesPerPixel > 65536) throw new RangeError('samplesPerPixel must be an integer from 1 to 65536');
  if (!['none', 'spatial', 'temporal'].includes(denoiser)) throw new Error('unsupported denoiser: ' + denoiser);
  return Object.freeze({
    enabled: Boolean(enabled), mode, maxBounces, samplesPerPixel, denoiser,
    reflections: Boolean(reflections), refractions: Boolean(refractions),
    globalIllumination: Boolean(globalIllumination), ambientOcclusion: Boolean(ambientOcclusion),
  });
}
