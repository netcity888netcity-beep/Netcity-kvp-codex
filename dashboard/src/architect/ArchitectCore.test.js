import test from 'node:test';
import assert from 'node:assert/strict';
import { ArchitectRuntime } from './ArchitectCore.js';
import { routeIntent, spawnSpatialObject } from './IntentRouter.js';
import { createSpatialWorld, enterLayer } from '../spatial/world.js';

/* Тестовый мир: минимальные слои AR (только id, как требует world.js) */
const TEST_LAYER_IDS = ['core', 'tech', 'civic', 'energy', 'bio', 'info', 'ident'];
const makeWorld = () =>
  createSpatialWorld({ id: 'test-world', layers: TEST_LAYER_IDS.map((id) => ({ id })) });

test('processIntent: "Переключись на энергию" gives focus action', () => {
  const rt = new ArchitectRuntime();
  const action = rt.processIntent('Переключись на энергию');
  assert.equal(action.action, 'focus');
  assert.equal(action.targetLayer, 'energy');
  assert.equal(action.payload, 'Переключись на энергию');
});

test('processIntent: english "energy" keyword matches energy layer', () => {
  const rt = new ArchitectRuntime();
  const action = rt.processIntent('show me the energy core');
  assert.deepEqual(action, {
    action: 'focus',
    targetLayer: 'energy',
    payload: 'show me the energy core',
  });
});

test('processIntent: русский корень "созда" даёт spawn_object на текущий слой', () => {
  const rt = new ArchitectRuntime();
  const action = rt.processIntent('создай новую станцию');
  assert.equal(action.action, 'spawn_object');
  assert.equal(action.targetLayer, 'current');
  assert.equal(action.payload, 'создай новую станцию');
});

test('processIntent: english "spawn" keyword даёт spawn_object', () => {
  const rt = new ArchitectRuntime();
  const action = rt.processIntent('spawn a monolith');
  assert.equal(action.action, 'spawn_object');
  assert.equal(action.targetLayer, 'current');
});

test('processIntent: незнакомый текст → unknown, пустой → none', () => {
  const rt = new ArchitectRuntime();
  assert.equal(rt.processIntent('просто поговори со мной').action, 'unknown');
  assert.equal(rt.processIntent('   ').action, 'none');
  assert.equal(rt.processIntent(undefined).action, 'none');
});

test('processIntent: история намерений хранится (bounded)', () => {
  const rt = new ArchitectRuntime({ historyLimit: 3 });
  rt.processIntent('a');
  rt.processIntent('b');
  rt.processIntent('c');
  rt.processIntent('d');
  assert.equal(rt.history.length, 3);
  assert.equal(rt.history.at(-1).intent, 'd');
});

test('routeIntent: focus намерение фокусирует слой через engine', () => {
  const world = makeWorld();
  const calls = [];
  const result = routeIntent(
    { action: 'focus', targetLayer: 'energy', payload: 'энергия' },
    { world, focusLayer: (id) => calls.push(id), currentLayerId: world.activeLayerId },
  );
  assert.deepEqual(result, { routed: 'layer', layerId: 'energy' });
  assert.deepEqual(calls, ['energy']);
});

test('routeIntent: focus в неизвестный слой → routed none (без вызова)', () => {
  const world = makeWorld();
  const calls = [];
  const result = routeIntent(
    { action: 'focus', targetLayer: 'void', payload: '' },
    { world, focusLayer: (id) => calls.push(id) },
  );
  assert.equal(result.routed, 'none');
  assert.equal(calls.length, 0);
});

test('routeIntent: spawn_object создаёт объект через world.js в текущем слое', () => {
  const base = makeWorld();
  const world = enterLayer(base, 'civic');
  const before = world.layers.civic.objects.length;
  let next = null;
  const result = routeIntent(
    { action: 'spawn_object', targetLayer: 'current', payload: 'создай шпиль' },
    { world, setWorld: (w) => { next = w; }, currentLayerId: 'civic' },
  );
  assert.equal(result.routed, 'object');
  assert.equal(result.layerId, 'civic');
  assert.ok(result.objectId);
  assert.ok(next);
  assert.equal(next.layers.civic.objects.length, before + 1);
  const created = next.layers.civic.objects.at(-1);
  assert.equal(created.id, result.objectId);
  assert.equal(next.revision, world.revision + 1);
});

test('routeIntent: spawn в неизвестном слое не мутирует мир', () => {
  const world = makeWorld();
  const result = routeIntent(
    { action: 'spawn_object', targetLayer: 'void', payload: 'x' },
    { world, setWorld: () => assert.fail('setWorld must not be called') },
  );
  assert.equal(result.routed, 'none');
});

test('spawnSpatialObject: id уникален между повторными вызовами', () => {
  const world = makeWorld();
  const a = spawnSpatialObject(world, 'bio', 'one');
  const b = spawnSpatialObject(a.world, 'bio', 'two');
  assert.notEqual(a.objectId, b.objectId);
  assert.equal(b.world.layers.bio.objects.filter((o) => o.id === b.objectId).length, 1);
});

test('конвейер: processIntent → routeIntent фокусирует энергию', () => {
  const rt = new ArchitectRuntime();
  let focused = null;
  const world = makeWorld();
  const action = rt.processIntent('Переключись на энергию');
  const result = routeIntent(action, { world, focusLayer: (id) => { focused = id; } });
  assert.equal(result.routed, 'layer');
  assert.equal(focused, 'energy');
});
