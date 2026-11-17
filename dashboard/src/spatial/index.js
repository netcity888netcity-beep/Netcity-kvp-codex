export {
  createSpatialScene,
  addSpatialNode,
  updateSpatialNode,
  removeSpatialNode,
  getWorldTransform,
  serializeSpatialScene,
} from './scene.js';
export { composeSpatialScene } from './compositor.js';
export { createSpatialInteractionState, reduceSpatialInteraction } from './interaction.js';
export {
  MATERIAL_CATALOG_VERSION,
  MATERIAL_CATALOG,
  MATERIAL_FAMILIES,
  getMaterialPreset,
  listMaterialPresets,
  bindMaterialAssets,
} from './materials.js';
