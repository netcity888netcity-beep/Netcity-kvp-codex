import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
} from './layer-system.js';

test('creates the five functional layers, seven domains, and three surfaces', () => {
  const system = createLayerSystem();
  assert.equal(Object.keys(system.interfaceLayers).length, 5);
  assert.equal(Object.keys(system.domainLayers).length, 7);
  assert.deepEqual(Object.keys(system.surfaces), ['focal', 'mid', 'far']);
  assert.equal(system.schema, 'netcity.layer-system');
});

test('registers a panel across functional, domain, and spatial dimensions', () => {
  const system = registerLayerPanel(createLayerSystem(), {
    id: 'intent-composer',
    interfaceLayerId: 'assistant',
    domainLayerId: 'tech',
    surfaceId: 'focal',
  });
  const [panel] = composeLayerSystem(system);
  assert.equal(panel.id, 'intent-composer');
  assert.equal(panel.surface.depth, 0.9);
  assert.equal(panel.visible, true);
});

test('rejects invalid cross-layer assignments', () => {
  assert.throws(() => registerLayerPanel(createLayerSystem(), {
    id: 'invalid',
    interfaceLayerId: 'assistant',
    domainLayerId: 'energy',
  }), /not assigned/);
});

test('updates panel properties immutably and increments revision', () => {
  const initial = registerLayerPanel(createLayerSystem(), {
    id: 'telemetry',
    interfaceLayerId: 'perception',
    domainLayerId: 'energy',
  });
  const updated = updateLayerPanel(initial, 'telemetry', {
    opacity: 0.4,
    transform: { position: { x: 2 } },
  });
  assert.equal(initial.panels.telemetry.opacity, 1);
  assert.equal(updated.panels.telemetry.opacity, 0.4);
  assert.equal(updated.panels.telemetry.transform.position.x, 2);
  assert.equal(updated.revision, initial.revision + 1);
});

test('visibility can be toggled without deleting panel state', () => {
  const initial = registerLayerPanel(createLayerSystem(), {
    id: 'identity',
    interfaceLayerId: 'orientation',
    domainLayerId: 'ident',
  });
  const hidden = setLayerPanelVisibility(initial, 'identity', false);
  assert.equal(hidden.panels.identity.visible, false);
  assert.equal(composeLayerSystem(hidden)[0].visible, false);
  assert.ok(hidden.panels.identity);
});

test('moving a panel changes its surface but preserves other transform axes', () => {
  const initial = registerLayerPanel(createLayerSystem(), {
    id: 'assistant',
    interfaceLayerId: 'assistant',
    domainLayerId: 'tech',
    transform: { position: { x: 1, y: 2, z: 3 } },
  });
  const moved = moveLayerPanel(initial, 'assistant', 'far', {
    position: { x: 5 },
  });
  assert.equal(moved.panels.assistant.surfaceId, 'far');
  assert.deepEqual(moved.panels.assistant.transform.position, { x: 5, y: 2, z: 3 });
});

test('focus is exclusive and can be cleared', () => {
  let system = createLayerSystem({ panels: [
    { id: 'a', interfaceLayerId: 'assistant', domainLayerId: 'tech' },
    { id: 'b', interfaceLayerId: 'orientation', domainLayerId: 'ident' },
  ] });
  system = focusLayerPanel(system, 'a');
  assert.equal(composeLayerSystem(system).filter((panel) => panel.focused).length, 1);
  system = focusLayerPanel(system, 'b');
  assert.equal(system.focusedPanelId, 'b');
  system = focusLayerPanel(system);
  assert.equal(system.focusedPanelId, null);
});

test('removing a focused panel clears focus', () => {
  let system = createLayerSystem({ panels: [
    { id: 'a', interfaceLayerId: 'assistant', domainLayerId: 'tech' },
  ] });
  system = focusLayerPanel(system, 'a');
  system = removeLayerPanel(system, 'a');
  assert.equal(system.focusedPanelId, null);
  assert.deepEqual(system.panels, {});
});

test('validates serializable, versioned state', () => {
  const system = registerLayerPanel(createLayerSystem(), {
    id: 'evidence-trace',
    interfaceLayerId: 'evidence',
    domainLayerId: 'core',
  });
  assert.equal(validateLayerSystem(system).valid, true);
  assert.equal(JSON.parse(serializeLayerSystem(system)).schemaVersion, 1);
});

test('rejects invalid opacity and unknown surface', () => {
  assert.throws(() => registerLayerPanel(createLayerSystem(), {
    id: 'bad-opacity',
    interfaceLayerId: 'assistant',
    domainLayerId: 'tech',
    opacity: 1.2,
  }), /opacity/);
  assert.throws(() => registerLayerPanel(createLayerSystem(), {
    id: 'bad-surface',
    interfaceLayerId: 'assistant',
    domainLayerId: 'tech',
    surfaceId: 'void',
  }), /surface not found/);
});
