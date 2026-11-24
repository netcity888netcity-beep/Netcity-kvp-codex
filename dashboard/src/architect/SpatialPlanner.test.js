import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicSpatialPlanner } from './SpatialPlanner.js';

const capability = {
  schema_version: 'netcity.capability.v0.1',
  id: 'energy.telemetry.read',
  version: '1.0.0',
  description: 'Read authorized energy telemetry',
  operation: 'READ',
  risk: 'LOW',
  adapter: 'local-telemetry',
  input_schema: { type: 'object' },
  output_schema: { type: 'object' },
  permissions: ['energy.telemetry.read'],
};

const intent = {
  schema_version: 'netcity.spatial-intent.v0.1',
  request_id: 'req-determinism-001',
  intent: {
    raw: 'Покажи энергопотребление',
    goal: 'inspect_energy',
    domain: ['energy', 'info'],
  },
  requested_outcome: { kind: 'spatial_representation' },
};

const route = {
  goal: 'inspect_energy',
  outcome: 'spatial_representation',
  domain: ['energy', 'info'],
  steps: [
    { step_id: 'read', capability: capability.id, operation: 'READ' },
  ],
};

function mutableRegistry(initial) {
  let current = initial;
  return {
    get(id) {
      return id === capability.id ? current : null;
    },
    set(value) {
      current = value;
    },
  };
}

test('planner snapshots capability descriptors at construction', () => {
  const registry = mutableRegistry(capability);
  const planner = new DeterministicSpatialPlanner({
    capabilityRegistry: registry,
    routes: [route],
  });

  registry.set(null);
  const result = planner.plan(intent);

  assert.equal(result.status, 'PLAN_PROPOSED');
  assert.equal(result.plan.steps[0].capability, capability.id);
});

test('planner snapshots a missing capability as missing', () => {
  const registry = mutableRegistry(null);
  const planner = new DeterministicSpatialPlanner({
    capabilityRegistry: registry,
    routes: [route],
  });

  registry.set(capability);
  assert.equal(planner.plan(intent).reason, 'CAPABILITY_NOT_REGISTERED');
});

test('planner reads each referenced capability only once', () => {
  let calls = 0;
  const registry = {
    get(id) {
      calls += 1;
      return id === capability.id ? capability : null;
    },
  };
  const planner = new DeterministicSpatialPlanner({
    capabilityRegistry: registry,
    routes: [route],
  });

  assert.equal(calls, 1);
  planner.plan(intent);
  planner.plan(intent);
  assert.equal(calls, 1);
});

test('domain order is significant and is not silently sorted', () => {
  const planner = new DeterministicSpatialPlanner({
    capabilityRegistry: mutableRegistry(capability),
    routes: [route],
  });
  const reordered = {
    ...intent,
    intent: { ...intent.intent, domain: ['info', 'energy'] },
  };

  assert.equal(planner.plan(intent).status, 'PLAN_PROPOSED');
  assert.equal(planner.plan(reordered).reason, 'NO_EXACT_ROUTE');
});

test('goal, outcome and domain strings are compared literally', () => {
  const planner = new DeterministicSpatialPlanner({
    capabilityRegistry: mutableRegistry(capability),
    routes: [route],
  });
  const changedCase = {
    ...intent,
    intent: { ...intent.intent, goal: 'Inspect_energy' },
  };
  const changedWhitespace = {
    ...intent,
    intent: { ...intent.intent, goal: ' inspect_energy ' },
  };

  assert.equal(planner.plan(changedCase).reason, 'NO_EXACT_ROUTE');
  assert.equal(planner.plan(changedWhitespace).reason, 'NO_EXACT_ROUTE');
});
