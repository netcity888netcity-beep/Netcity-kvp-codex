import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_LAYER_IDS,
  LayerAgent,
  agentStatusLine,
} from './LayerAgent.js';
import { routeIntent } from './IntentRouter.js';
import { createSpatialWorld } from '../spatial/world.js';

const TEST_LAYER_IDS = ['core', 'tech', 'civic', 'energy', 'bio', 'info', 'ident'];
const makeWorld = () =>
  createSpatialWorld({ id: 'test-world', layers: TEST_LAYER_IDS.map((id) => ({ id })) });

test('LayerAgent: energy выдаёт "Status: Stable, Output: 1.2 GW"', () => {
  const status = new LayerAgent('energy').getStatus();
  assert.deepEqual(status, {
    layerId: 'energy',
    status: 'Status: Stable, Output: 1.2 GW',
    known: true,
  });
});

test('LayerAgent: tech выдаёт "Fleet: 8 nodes online"', () => {
  assert.equal(new LayerAgent('tech').getStatus().status, 'Fleet: 8 nodes online');
});

test('LayerAgent: bio выдаёт "Vitals: Optimal"', () => {
  assert.equal(new LayerAgent('bio').getStatus().status, 'Vitals: Optimal');
});

test('LayerAgent: все 7 слоёв AR имеют известный статус', () => {
  const ids = ['core', 'tech', 'civic', 'energy', 'bio', 'info', 'ident'];
  for (const id of ids) {
    const result = new LayerAgent(id).getStatus();
    assert.equal(result.known, true, 'layer ' + id + ' must have a status');
    assert.ok(result.status.length > 0);
  }
  assert.deepEqual([...AGENT_LAYER_IDS].sort(), [...ids].sort());
});

test('LayerAgent: неизвестный слой → known:false, без исключения', () => {
  const result = new LayerAgent('void').getStatus();
  assert.equal(result.known, false);
  assert.equal(result.status, 'Status: Unknown layer');
});

test('LayerAgent: пустой layerId → TypeError', () => {
  assert.throws(() => new LayerAgent(''), TypeError);
  assert.throws(() => new LayerAgent(), TypeError);
});

test('agentStatusLine: формат "[ENERGY] Status: Stable, Output: 1.2 GW"', () => {
  assert.equal(
    agentStatusLine('energy'),
    '[ENERGY] Status: Stable, Output: 1.2 GW',
  );
});

test('routeIntent: layer_status вызывает onStatus с телеметрией слоя', () => {
  const world = makeWorld();
  const seen = [];
  const result = routeIntent(
    { action: 'layer_status', targetLayer: 'energy', payload: 'status energy' },
    { world, onStatus: (payload) => seen.push(payload) },
  );
  assert.deepEqual(result, {
    routed: 'status',
    layerId: 'energy',
    status: 'Status: Stable, Output: 1.2 GW',
  });
  assert.deepEqual(seen, [
    { layerId: 'energy', status: 'Status: Stable, Output: 1.2 GW' },
  ]);
});

test('routeIntent: layer_status без слоя читает текущий слой мира', () => {
  const world = makeWorld();
  const result = routeIntent(
    { action: 'layer_status', targetLayer: 'current', payload: 'status' },
    { world, currentLayerId: 'bio' },
  );
  assert.equal(result.layerId, 'bio');
  assert.equal(result.status, 'Vitals: Optimal');
});

test('routeIntent: layer_status в неизвестный слой → routed none', () => {
  const world = makeWorld();
  const result = routeIntent(
    { action: 'layer_status', targetLayer: 'void', payload: 'status' },
    {
      world,
      onStatus: () => assert.fail('onStatus must not be called'),
    },
  );
  assert.equal(result.routed, 'none');
});
