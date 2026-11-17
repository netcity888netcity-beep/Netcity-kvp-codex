/**
 * NetCity Spatial Engine — renderer-neutral material catalogue.
 *
 * Presets are authored physical/PBR starting points, not measured samples.
 * Texture maps and measured material data are attached by assetId/datasetId;
 * the catalogue itself never invents texture URLs or claims scan provenance.
 */
const freezeRecord = (record) => Object.freeze(record);
const make = (id, family, name, properties, physical = {}) => freezeRecord({
  id, family, name,
  model: 'metallic-roughness',
  properties: freezeRecord({
    baseColor: '#808080',
    metalness: 0,
    roughness: 0.8,
    opacity: 1,
    ior: 1.5,
    transmission: 0,
    thicknessM: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.2,
    anisotropy: 0,
    ...properties,
  }),
  physical: freezeRecord({
    densityKgM3: null,
    thermalConductivityWMK: null,
    state: 'solid',
    ...physical,
  }),
  maps: freezeRecord({
    albedo: null, normal: null, roughness: null, metalness: null,
    displacement: null, ao: null, opacity: null, transmission: null,
  }),
  provenance: 'procedural-preset',
});

const entries = [
  // Stone, minerals and masonry
  make('stone.granite', 'stone', 'Granite', { baseColor: '#77766f', roughness: 0.78 }, { densityKgM3: 2700, thermalConductivityWMK: 2.8 }),
  make('stone.marble', 'stone', 'Marble', { baseColor: '#d8d4ca', roughness: 0.32 }, { densityKgM3: 2700, thermalConductivityWMK: 2.5 }),
  make('stone.limestone', 'stone', 'Limestone', { baseColor: '#b7a98c', roughness: 0.88 }, { densityKgM3: 2500, thermalConductivityWMK: 1.3 }),
  make('stone.sandstone', 'stone', 'Sandstone', { baseColor: '#b78a5d', roughness: 0.94 }, { densityKgM3: 2300, thermalConductivityWMK: 1.7 }),
  make('stone.slate', 'stone', 'Slate', { baseColor: '#454b50', roughness: 0.68 }, { densityKgM3: 2800, thermalConductivityWMK: 2.0 }),
  make('stone.basalt', 'stone', 'Basalt', { baseColor: '#343638', roughness: 0.82 }, { densityKgM3: 2950, thermalConductivityWMK: 1.8 }),
  make('stone.concrete', 'masonry', 'Concrete', { baseColor: '#888782', roughness: 0.9 }, { densityKgM3: 2400, thermalConductivityWMK: 1.7 }),
  make('stone.brick', 'masonry', 'Fired brick', { baseColor: '#9a4935', roughness: 0.9 }, { densityKgM3: 1900, thermalConductivityWMK: 0.7 }),
  make('soil.earth', 'soil', 'Packed earth', { baseColor: '#70543b', roughness: 1 }, { densityKgM3: 1600, thermalConductivityWMK: 1.0 }),
  make('soil.sand', 'soil', 'Dry sand', { baseColor: '#c4a46a', roughness: 1 }, { densityKgM3: 1600, thermalConductivityWMK: 0.3 }),
  make('soil.gravel', 'soil', 'Gravel', { baseColor: '#77736a', roughness: 1 }, { densityKgM3: 1800, thermalConductivityWMK: 0.7 }),
  // Metals
  make('metal.steel', 'metal', 'Carbon steel', { baseColor: '#777e83', metalness: 1, roughness: 0.28 }, { densityKgM3: 7850, thermalConductivityWMK: 50 }),
  make('metal.stainless-steel', 'metal', 'Stainless steel', { baseColor: '#b7bec2', metalness: 1, roughness: 0.22 }, { densityKgM3: 8000, thermalConductivityWMK: 16 }),
  make('metal.aluminium', 'metal', 'Aluminium', { baseColor: '#c5c9ca', metalness: 1, roughness: 0.24 }, { densityKgM3: 2700, thermalConductivityWMK: 205 }),
  make('metal.copper', 'metal', 'Copper', { baseColor: '#b66a43', metalness: 1, roughness: 0.25 }, { densityKgM3: 8960, thermalConductivityWMK: 400 }),
  make('metal.brass', 'metal', 'Brass', { baseColor: '#b59a52', metalness: 1, roughness: 0.3 }, { densityKgM3: 8500, thermalConductivityWMK: 110 }),
  make('metal.gold', 'metal', 'Gold', { baseColor: '#d6b65c', metalness: 1, roughness: 0.18 }, { densityKgM3: 19300, thermalConductivityWMK: 318 }),
  make('metal.titanium', 'metal', 'Titanium', { baseColor: '#858b8d', metalness: 1, roughness: 0.3 }, { densityKgM3: 4500, thermalConductivityWMK: 22 }),
  // Woods and plant-derived materials
  make('wood.oak', 'wood', 'Oak', { baseColor: '#956b43', roughness: 0.72 }, { densityKgM3: 700, thermalConductivityWMK: 0.17 }),
  make('wood.walnut', 'wood', 'Walnut', { baseColor: '#563b2c', roughness: 0.62 }, { densityKgM3: 650, thermalConductivityWMK: 0.16 }),
  make('wood.pine', 'wood', 'Pine', { baseColor: '#c39a5c', roughness: 0.78 }, { densityKgM3: 500, thermalConductivityWMK: 0.12 }),
  make('wood.plywood', 'wood', 'Plywood', { baseColor: '#b28a5a', roughness: 0.74 }, { densityKgM3: 600, thermalConductivityWMK: 0.13 }),
  make('plant.bark', 'organic', 'Tree bark', { baseColor: '#59412e', roughness: 1 }, { densityKgM3: 500 }),
  // Glass and transparent media
  make('glass.clear', 'glass', 'Clear glass', { baseColor: '#edf5f4', roughness: 0.04, metalness: 0, ior: 1.52, transmission: 1, thicknessM: 0.006 }, { densityKgM3: 2500, thermalConductivityWMK: 1 }),
  make('glass.frosted', 'glass', 'Frosted glass', { baseColor: '#dce5e4', roughness: 0.34, ior: 1.52, transmission: 0.82, thicknessM: 0.008 }, { densityKgM3: 2500 }),
  make('glass.tinted', 'glass', 'Tinted glass', { baseColor: '#617d78', roughness: 0.08, ior: 1.52, transmission: 0.72, thicknessM: 0.008 }, { densityKgM3: 2500 }),
  make('glass.crystal', 'glass', 'Optical crystal', { baseColor: '#f5f7ff', roughness: 0.015, ior: 1.7, transmission: 1, thicknessM: 0.02 }, { densityKgM3: 3000 }),
  // Ceramics and minerals
  make('ceramic.porcelain', 'ceramic', 'Porcelain', { baseColor: '#e5e1d8', roughness: 0.18 }, { densityKgM3: 2400, thermalConductivityWMK: 1.5 }),
  make('ceramic.terracotta', 'ceramic', 'Terracotta', { baseColor: '#a65336', roughness: 0.86 }, { densityKgM3: 1900, thermalConductivityWMK: 0.8 }),
  make('ceramic.glazed', 'ceramic', 'Glazed ceramic', { baseColor: '#d6d1c5', roughness: 0.12 }, { densityKgM3: 2300 }),
  // Polymers, rubber and composites
  make('polymer.abs', 'polymer', 'ABS plastic', { baseColor: '#30343a', roughness: 0.38 }, { densityKgM3: 1050 }),
  make('polymer.polycarbonate', 'polymer', 'Polycarbonate', { baseColor: '#d9e5e4', roughness: 0.16, ior: 1.58, transmission: 0.88, thicknessM: 0.003 }, { densityKgM3: 1200 }),
  make('polymer.pvc', 'polymer', 'PVC', { baseColor: '#b7b9b5', roughness: 0.48 }, { densityKgM3: 1400 }),
  make('rubber.natural', 'rubber', 'Natural rubber', { baseColor: '#252525', roughness: 0.86 }, { densityKgM3: 920 }),
  make('composite.carbon-fiber', 'composite', 'Carbon-fibre composite', { baseColor: '#171a1d', metalness: 0.28, roughness: 0.3, anisotropy: 0.55 }, { densityKgM3: 1600 }),
  make('composite.fiberglass', 'composite', 'Fibreglass', { baseColor: '#777e78', roughness: 0.42 }, { densityKgM3: 1850 }),
  // Textiles and leather
  make('textile.cotton', 'textile', 'Cotton fabric', { baseColor: '#b8b2a5', roughness: 1 }, { densityKgM3: 500 }),
  make('textile.denim', 'textile', 'Denim', { baseColor: '#344b69', roughness: 0.96 }, { densityKgM3: 650 }),
  make('textile.wool', 'textile', 'Wool', { baseColor: '#8a8173', roughness: 1 }, { densityKgM3: 1300 }),
  make('leather.natural', 'leather', 'Natural leather', { baseColor: '#65452f', roughness: 0.58 }, { densityKgM3: 860 }),
  // Liquids and organic matter (surface presets; volume simulation is separate)
  make('liquid.water', 'liquid', 'Water', { baseColor: '#d9edf2', roughness: 0.025, ior: 1.333, transmission: 1, thicknessM: 0.1 }, { densityKgM3: 998, thermalConductivityWMK: 0.6, state: 'liquid' }),
  make('liquid.ice', 'liquid', 'Clear ice', { baseColor: '#d5e8ed', roughness: 0.08, ior: 1.31, transmission: 0.94, thicknessM: 0.1 }, { densityKgM3: 917, thermalConductivityWMK: 2.2, state: 'solid' }),
  make('liquid.oil', 'liquid', 'Oil', { baseColor: '#8a7135', roughness: 0.12, ior: 1.47, transmission: 0.45 }, { densityKgM3: 900, state: 'liquid' }),
  make('organic.leaf', 'organic', 'Leaf', { baseColor: '#397342', roughness: 0.78, transmission: 0.08 }, { densityKgM3: 700 }),
  make('organic.skin', 'organic', 'Skin surface', { baseColor: '#bd8d75', roughness: 0.52, transmission: 0.04 }, { densityKgM3: 1100 }),
];

export const MATERIAL_CATALOG_VERSION = '1.0.0';
export const MATERIAL_CATALOG = Object.freeze(Object.fromEntries(entries.map((entry) => [entry.id, entry])));
export const MATERIAL_FAMILIES = Object.freeze([...new Set(entries.map((entry) => entry.family))]);

export function getMaterialPreset(id) {
  return MATERIAL_CATALOG[id] ?? null;
}

export function listMaterialPresets({ family, query } = {}) {
  const normalizedQuery = query?.trim().toLowerCase();
  return entries.filter((entry) =>
    (!family || entry.family === family) &&
    (!normalizedQuery || (entry.name + ' ' + entry.id + ' ' + entry.family).toLowerCase().includes(normalizedQuery))
  );
}

/** Attach scanned/ authored PBR maps without mutating the shared preset. */
export function bindMaterialAssets(id, assets = {}) {
  const preset = getMaterialPreset(id);
  if (!preset) throw new Error('unknown material preset: ' + id);
  const allowed = Object.keys(preset.maps);
  for (const key of Object.keys(assets)) {
    if (!allowed.includes(key)) throw new Error('unsupported material map: ' + key);
    if (assets[key] != null && typeof assets[key] !== 'string') throw new TypeError('material asset references must be strings or null');
  }
  return freezeRecord({ ...preset, maps: freezeRecord({ ...preset.maps, ...assets }), provenance: 'asset-bound' });
}
