/**
 * NetCity Layer System — renderer-neutral registry for interface composition.
 *
 * Functional layers describe why information exists; domain layers describe
 * which subsystem owns it; surfaces describe where it is presented. Panels
 * bind these dimensions without coupling the model to React, DOM, or Three.js.
 * Defaults are intentionally editable: this is a foundation, not a frozen UI.
 */
const INTERFACE_LAYER_DEFAULTS = [
  { id: 'orientation', title: 'Orientation', order: 10, visible: true },
  { id: 'perception', title: 'Perception', order: 20, visible: true },
  { id: 'assistant', title: 'Assistant', order: 30, visible: true },
  { id: 'execution', title: 'Execution', order: 40, visible: true },
  { id: 'evidence', title: 'Evidence', order: 50, visible: true },
];

const DOMAIN_LAYER_DEFAULTS = [
  { id: 'core', title: 'Core', interfaceLayerIds: ['orientation', 'execution', 'evidence'] },
  { id: 'tech', title: 'Tech', interfaceLayerIds: ['assistant', 'execution', 'perception'] },
  { id: 'civic', title: 'Civic', interfaceLayerIds: ['orientation', 'execution', 'evidence'] },
  { id: 'energy', title: 'Energy', interfaceLayerIds: ['perception', 'evidence'] },
  { id: 'bio', title: 'Bio', interfaceLayerIds: ['perception', 'assistant'] },
  { id: 'info', title: 'Info', interfaceLayerIds: ['perception', 'assistant', 'evidence'] },
  { id: 'ident', title: 'Identity', interfaceLayerIds: ['orientation', 'evidence'] },
];

const SURFACE_DEFAULTS = [
  { id: 'focal', title: 'Focal', depth: 0.9, scale: 1, order: 30 },
  { id: 'mid', title: 'Mid', depth: -1.2, scale: 0.78, order: 20 },
  { id: 'far', title: 'Far', depth: -3, scale: 0.56, order: 10 },
];

function assertId(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(label + ' must be a non-empty string');
  }
}
function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite');
  return value;
}
function clone(value) {
  return structuredClone(value);
}
function uniqueById(items, label) {
  const result = {};
  for (const item of items) {
    assertId(item?.id, label + '.id');
    if (Object.hasOwn(result, item.id)) throw new Error('duplicate ' + label + ' id: ' + item.id);
    result[item.id] = clone(item);
  }
  return result;
}
function next(system, patch) {
  return { ...system, ...patch, revision: system.revision + 1 };
}
function validate(system) {
  for (const domain of Object.values(system.domainLayers)) {
    for (const layerId of domain.interfaceLayerIds ?? []) {
      if (!system.interfaceLayers[layerId]) {
        throw new Error('interface layer not found: ' + layerId);
      }
    }
  }
  for (const panel of Object.values(system.panels)) {
    if (!system.interfaceLayers[panel.interfaceLayerId]) {
      throw new Error('panel interface layer not found: ' + panel.interfaceLayerId);
    }
    if (!system.domainLayers[panel.domainLayerId]) {
      throw new Error('panel domain layer not found: ' + panel.domainLayerId);
    }
    if (!system.surfaces[panel.surfaceId]) {
      throw new Error('panel surface not found: ' + panel.surfaceId);
    }
    if (!system.domainLayers[panel.domainLayerId].interfaceLayerIds.includes(panel.interfaceLayerId)) {
      throw new Error('domain layer ' + panel.domainLayerId + ' is not assigned to interface layer ' + panel.interfaceLayerId);
    }
  }
  if (system.focusedPanelId && !system.panels[system.focusedPanelId]) {
    throw new Error('focused panel not found: ' + system.focusedPanelId);
  }
  return system;
}
function normalizePanel(input, system) {
  assertId(input?.id, 'panel.id');
  const panel = {
    id: input.id,
    title: input.title ?? input.id,
    interfaceLayerId: input.interfaceLayerId,
    domainLayerId: input.domainLayerId,
    surfaceId: input.surfaceId ?? 'mid',
    order: Number.isFinite(input.order) ? input.order : 0,
    visible: input.visible !== false,
    enabled: input.enabled !== false,
    opacity: input.opacity ?? 1,
    anchor: input.anchor ?? 'world',
    transform: {
      position: {
        x: input.transform?.position?.x ?? 0,
        y: input.transform?.position?.y ?? 0,
        z: input.transform?.position?.z ?? 0,
      },
      rotation: {
        x: input.transform?.rotation?.x ?? 0,
        y: input.transform?.rotation?.y ?? 0,
        z: input.transform?.rotation?.z ?? 0,
      },
      scale: {
        x: input.transform?.scale?.x ?? 1,
        y: input.transform?.scale?.y ?? 1,
        z: input.transform?.scale?.z ?? 1,
      },
    },
    metadata: clone(input.metadata ?? {}),
  };
  for (const axis of ['x', 'y', 'z']) {
    finite(panel.transform.position[axis], 'panel.position.' + axis);
    finite(panel.transform.rotation[axis], 'panel.rotation.' + axis);
    finite(panel.transform.scale[axis], 'panel.scale.' + axis);
  }
  finite(panel.opacity, 'panel.opacity');
  if (panel.opacity < 0 || panel.opacity > 1) throw new RangeError('panel.opacity must be between 0 and 1');
  if (!['world', 'head', 'screen', 'surface'].includes(panel.anchor)) {
    throw new TypeError('panel.anchor must be world, head, screen, or surface');
  }
  if (!system.interfaceLayers[panel.interfaceLayerId]) throw new Error('interface layer not found: ' + panel.interfaceLayerId);
  if (!system.domainLayers[panel.domainLayerId]) throw new Error('domain layer not found: ' + panel.domainLayerId);
  if (!system.surfaces[panel.surfaceId]) throw new Error('surface not found: ' + panel.surfaceId);
  if (!system.domainLayers[panel.domainLayerId].interfaceLayerIds.includes(panel.interfaceLayerId)) {
    throw new Error('domain layer ' + panel.domainLayerId + ' is not assigned to interface layer ' + panel.interfaceLayerId);
  }
  return panel;
}

export function createLayerSystem({
  id = 'netcity-layer-system',
  interfaceLayers = INTERFACE_LAYER_DEFAULTS,
  domainLayers = DOMAIN_LAYER_DEFAULTS,
  surfaces = SURFACE_DEFAULTS,
  panels = [],
} = {}) {
  assertId(id, 'system.id');
  const system = {
    schema: 'netcity.layer-system',
    schemaVersion: 1,
    id,
    revision: 0,
    interfaceLayers: uniqueById(interfaceLayers, 'interface layer'),
    domainLayers: uniqueById(domainLayers, 'domain layer'),
    surfaces: uniqueById(surfaces, 'surface'),
    panels: {},
    focusedPanelId: null,
  };
  for (const input of panels) {
    const panel = normalizePanel(input, system);
    if (Object.hasOwn(system.panels, panel.id)) throw new Error('duplicate panel id: ' + panel.id);
    system.panels[panel.id] = panel;
  }
  return validate(system);
}

export function registerLayerPanel(system, input) {
  const panel = normalizePanel(input, system);
  if (Object.hasOwn(system.panels, panel.id)) throw new Error('panel already exists: ' + panel.id);
  return next(system, { panels: { ...system.panels, [panel.id]: panel } });
}

export function updateLayerPanel(system, id, patch) {
  assertId(id, 'panel.id');
  const current = system.panels[id];
  if (!current) throw new Error('panel not found: ' + id);
  const merged = {
    ...current,
    ...patch,
    id,
    transform: {
      ...current.transform,
      ...(patch.transform ?? {}),
      position: { ...current.transform.position, ...(patch.transform?.position ?? {}) },
      rotation: { ...current.transform.rotation, ...(patch.transform?.rotation ?? {}) },
      scale: { ...current.transform.scale, ...(patch.transform?.scale ?? {}) },
    },
  };
  const panel = normalizePanel(merged, system);
  const updated = next(system, { panels: { ...system.panels, [id]: panel } });
  return validate(updated);
}

export function setLayerPanelVisibility(system, id, visible) {
  if (typeof visible !== 'boolean') throw new TypeError('visible must be a boolean');
  return updateLayerPanel(system, id, { visible });
}

export function moveLayerPanel(system, id, surfaceId, transform) {
  assertId(surfaceId, 'surface.id');
  return updateLayerPanel(system, id, {
    surfaceId,
    ...(transform ? { transform } : {}),
  });
}

export function focusLayerPanel(system, id = null) {
  if (id !== null) {
    assertId(id, 'panel.id');
    if (!system.panels[id]) throw new Error('panel not found: ' + id);
  }
  if (system.focusedPanelId === id) return system;
  return next(system, { focusedPanelId: id });
}

export function removeLayerPanel(system, id) {
  assertId(id, 'panel.id');
  if (!system.panels[id]) return system;
  const panels = { ...system.panels };
  delete panels[id];
  return next(system, {
    panels,
    focusedPanelId: system.focusedPanelId === id ? null : system.focusedPanelId,
  });
}

export function composeLayerSystem(system) {
  validate(system);
  return Object.values(system.panels)
    .map((panel) => ({
      ...clone(panel),
      visible: panel.visible && panel.enabled &&
        system.interfaceLayers[panel.interfaceLayerId].visible !== false &&
        system.domainLayers[panel.domainLayerId].visible !== false,
      focused: panel.id === system.focusedPanelId,
      surface: clone(system.surfaces[panel.surfaceId]),
      interfaceOrder: system.interfaceLayers[panel.interfaceLayerId].order ?? 0,
      domainOrder: system.domainLayers[panel.domainLayerId].order ?? 0,
    }))
    .sort((a, b) =>
      a.surface.order - b.surface.order ||
      a.interfaceOrder - b.interfaceOrder ||
      a.domainOrder - b.domainOrder ||
      a.order - b.order ||
      a.id.localeCompare(b.id),
    );
}

export function serializeLayerSystem(system) {
  validate(system);
  return JSON.stringify(system);
}

export function validateLayerSystem(system) {
  try {
    validate(system);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

export const DEFAULT_INTERFACE_LAYERS = INTERFACE_LAYER_DEFAULTS;
export const DEFAULT_DOMAIN_LAYERS = DOMAIN_LAYER_DEFAULTS;
export const DEFAULT_SPATIAL_SURFACES = SURFACE_DEFAULTS;
