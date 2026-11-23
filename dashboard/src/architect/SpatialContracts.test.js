import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CapabilityRegistry,
  validateCapability,
  validateRepresentation,
  validateSpatialIntent,
  validateSpatialPlan,
} from './SpatialContracts.js';

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
  timeout_ms: 3000,
  cancel_supported: true,
};

const createCapability = {
  ...capability,
  id: 'spatial.representation.create',
  description: 'Create a spatial representation',
  operation: 'CREATE',
  adapter: 'spatial-materializer',
  permissions: ['spatial.representation.create'],
};

const intent = {
  schema_version: 'netcity.spatial-intent.v0.1',
  request_id: 'req-001',
  intent: { raw: 'Покажи энергопотребление', goal: 'inspect_energy', domain: ['energy'] },
  context: { active_layer: 'energy' },
  requested_outcome: { kind: 'spatial_representation' },
};

const plan = {
  schema_version: 'netcity.plan.v0.1',
  plan_id: 'plan-001',
  status: 'PROPOSED',
  steps: [
    { step_id: 'read', capability: 'energy.telemetry.read', operation: 'READ' },
    { step_id: 'render', capability: 'spatial.representation.create', operation: 'CREATE', depends_on: ['read'] },
  ],
  human_confirmation: { required: false, reason: 'Read-only local visualization' },
};

const representation = {
  schema_version: 'netcity.representation.v0.1',
  representation_id: 'repr-001',
  semantic_type: 'energy.telemetry.field',
  source_refs: ['telemetry-001'],
  layer: 'energy',
  spatial: { anchor: { type: 'environment-relative', ref: 'room-01' }, position: { x: 0, y: 1, z: -2 } },
  form: { geometry: 'volumetric-field', visual_density: 'minimal' },
  behavior: { visibility: 'AMBIENT', focus_reveal: true, lifecycle: 'task-bound' },
};

test('validates a versioned captured intent', () => {
  assert.deepEqual(validateSpatialIntent(intent), { valid: true, errors: [] });
  assert.equal(validateSpatialIntent({ ...intent, request_id: '' }).valid, false);
});

test('validates capability descriptors and rejects unsafe metadata shapes', () => {
  assert.equal(validateCapability(capability).valid, true);
  assert.equal(validateCapability({ ...capability, risk: 'MAGIC' }).valid, false);
  assert.equal(validateCapability({ ...capability, timeout_ms: -1 }).valid, false);
});

test('registry accepts validated capabilities and rejects duplicates', () => {
  const registry = new CapabilityRegistry();
  assert.equal(registry.register(capability).valid, true);
  assert.equal(registry.register(capability).valid, false);
  assert.equal(registry.get(capability.id).id, capability.id);
  assert.equal(registry.list().length, 1);
});

test('validates plan structure, dependencies and registered capabilities', () => {
  assert.equal(validateSpatialPlan(plan).valid, true);
  assert.equal(validateSpatialPlan(plan, { capabilities: [capability] }).valid, false);
  assert.equal(validateSpatialPlan(plan, { capabilities: [capability, createCapability] }).valid, true);
  const broken = { ...plan, steps: [{ ...plan.steps[0], depends_on: ['missing'] }] };
  assert.equal(validateSpatialPlan(broken).valid, false);
  const mismatch = { ...plan, steps: [{ ...plan.steps[0], operation: 'CREATE' }] };
  assert.equal(validateSpatialPlan(mismatch, { capabilities: [capability] }).valid, false);
  const cyclic = { ...plan, steps: [
    { step_id: 'a', capability: 'energy.telemetry.read', operation: 'READ', depends_on: ['b'] },
    { step_id: 'b', capability: 'energy.telemetry.read', operation: 'READ', depends_on: ['a'] },
  ] };
  const cycleResult = validateSpatialPlan(cyclic, { capabilities: [capability] });
  assert.equal(cycleResult.valid, false);
  assert.ok(cycleResult.errors.some((error) => error.includes('cycle')));
});

test('validates representation semantics and finite spatial coordinates', () => {
  assert.equal(validateRepresentation(representation).valid, true);
  assert.equal(validateRepresentation({
    ...representation,
    spatial: { ...representation.spatial, position: { x: 0, y: Infinity, z: 1 } },
  }).valid, false);
  assert.equal(validateRepresentation({ ...representation, layer: 'unknown' }).valid, false);
});

test('contract validators reject arrays and null as top-level objects', () => {
  assert.equal(validateSpatialIntent([]).valid, false);
  assert.equal(validateSpatialPlan(null).valid, false);
  assert.equal(validateRepresentation(null).valid, false);
});
