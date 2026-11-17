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
export { createMaterialInstance, toRendererMaterialDescriptor, validateMaterialInstance } from './material-pipeline.js';
export { createLight, createLightingEnvironment, createRayTracingProfile } from './lighting.js';
export { createGeometry, createGeometryLibrary, getGeometryBounds } from './geometry.js';
export { createWorldScene, addWorldObject, serializeWorldScene, validateWorldScene } from './world.js';
export { buildThreeScene, configureThreeRenderer, THREE } from './three-adapter.js';

export {
  createLayerSystem,
  registerLayerPanel,
  updateLayerPanel,
  setLayerPanelVisibility,
  moveLayerPanel,
  focusLayerPanel,
  removeLayerPanel,
  composeLayerSystem,
  serializeLayerSystem,
  validateLayerSystem,
  DEFAULT_INTERFACE_LAYERS,
  DEFAULT_DOMAIN_LAYERS,
  DEFAULT_SPATIAL_SURFACES,
} from './layer-system.js';
