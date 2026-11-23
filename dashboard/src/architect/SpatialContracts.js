/**
 * NetCity Spatial Interpreter — Stage A contracts.
 *
 * Versioned, framework-neutral runtime contracts for Intent, Plan,
 * Capability and Representation. Validation only: this module does not
 * authorize or execute operations. KVP policy enforcement remains a
 * separate mandatory gate before privileged dispatch.
 */

export const CONTRACT_VERSION = '0.1';

export const OPERATIONS = Object.freeze([
  'READ', 'TRANSFORM', 'CREATE', 'MUTATE', 'EXTERNAL',
]);
export const RISK_LEVELS = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const LAYERS = Object.freeze([
  'core', 'bio', 'tech', 'energy', 'info', 'civic', 'ident',
]);
export const TASK_STATUSES = Object.freeze([
  'PROPOSED', 'NEEDS_CLARIFICATION', 'READY', 'AUTHORIZED',
  'EXECUTING', 'RESULT_READY', 'PARTIALLY_COMPLETED',
  'COMPLETED', 'DENIED', 'FAILED', 'CANCELLED', 'OUTCOME_UNKNOWN',
]);
export const REPRESENTATION_VISIBILITY = Object.freeze([
  'DORMANT', 'AMBIENT', 'FOCUSED', 'ACTIVE',
]);

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const fail = (message) => ({ valid: false, errors: [message] });
const pass = () => ({ valid: true, errors: [] });

function requireString(value, path, errors) {
  if (!nonEmpty(value)) errors.push(path + ' must be a non-empty string');
}
function requireEnum(value, values, path, errors) {
  if (!values.includes(value)) errors.push(path + ' must be one of: ' + values.join(', '));
}
function requireRecord(value, path, errors) {
  if (!isRecord(value)) errors.push(path + ' must be an object');
}

/** Validate a captured, versioned user intent. */
export function validateSpatialIntent(input) {
  const errors = [];
  requireRecord(input, 'intent', errors);
  if (!isRecord(input)) return fail(errors[0]);
  if (input.schema_version !== 'netcity.spatial-intent.v0.1') errors.push('schema_version is unsupported');
  requireString(input.request_id, 'request_id', errors);
  requireRecord(input.intent, 'intent.intent', errors);
  if (isRecord(input.intent)) {
    requireString(input.intent.raw, 'intent.raw', errors);
    requireString(input.intent.goal, 'intent.goal', errors);
    if (!Array.isArray(input.intent.domain) || input.intent.domain.length === 0 ||
        input.intent.domain.some((item) => !nonEmpty(item))) {
      errors.push('intent.domain must be a non-empty array of strings');
    }
  }
  requireRecord(input.requested_outcome, 'requested_outcome', errors);
  if (isRecord(input.requested_outcome)) requireString(input.requested_outcome.kind, 'requested_outcome.kind', errors);
  if (input.context != null) requireRecord(input.context, 'context', errors);
  return errors.length ? { valid: false, errors } : pass();
}

/** Validate a registry entry describing one callable capability. */
export function validateCapability(input) {
  const errors = [];
  requireRecord(input, 'capability', errors);
  if (!isRecord(input)) return fail(errors[0]);
  if (input.schema_version !== 'netcity.capability.v0.1') errors.push('schema_version is unsupported');
  requireString(input.id, 'id', errors);
  requireString(input.version, 'version', errors);
  requireString(input.description, 'description', errors);
  requireEnum(input.operation, OPERATIONS, 'operation', errors);
  requireEnum(input.risk, RISK_LEVELS, 'risk', errors);
  requireString(input.adapter, 'adapter', errors);
  requireRecord(input.input_schema, 'input_schema', errors);
  requireRecord(input.output_schema, 'output_schema', errors);
  if (!Array.isArray(input.permissions) || input.permissions.some((p) => !nonEmpty(p))) {
    errors.push('permissions must be an array of strings');
  }
  if (input.timeout_ms != null && (!Number.isInteger(input.timeout_ms) || input.timeout_ms <= 0)) {
    errors.push('timeout_ms must be a positive integer');
  }
  if (input.cancel_supported != null && typeof input.cancel_supported !== 'boolean') {
    errors.push('cancel_supported must be a boolean');
  }
  return errors.length ? { valid: false, errors } : pass();
}

/** Validate a proposed execution plan; this does not grant authorization. */
export function validateSpatialPlan(input, { capabilities = [] } = {}) {
  const errors = [];
  requireRecord(input, 'plan', errors);
  if (!isRecord(input)) return fail(errors[0]);
  if (input.schema_version !== 'netcity.plan.v0.1') errors.push('schema_version is unsupported');
  requireString(input.plan_id, 'plan_id', errors);
  requireEnum(input.status, TASK_STATUSES, 'status', errors);
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    errors.push('steps must be a non-empty array');
  } else {
    const ids = new Set();
    const validCapabilities = capabilities.filter((c) => validateCapability(c).valid);
    const capabilitiesById = new Map(validCapabilities.map((c) => [c.id, c]));
    for (const [index, step] of input.steps.entries()) {
      const path = 'steps[' + index + ']';
      if (!isRecord(step)) { errors.push(path + ' must be an object'); continue; }
      requireString(step.step_id, path + '.step_id', errors);
      requireString(step.capability, path + '.capability', errors);
      requireEnum(step.operation, OPERATIONS, path + '.operation', errors);
      if (nonEmpty(step.step_id)) {
        if (ids.has(step.step_id)) errors.push(path + '.step_id must be unique');
        ids.add(step.step_id);
      }
      if (capabilities.length && nonEmpty(step.capability)) {
        const registered = capabilitiesById.get(step.capability);
        if (!registered) errors.push(path + '.capability is not present in the validated registry');
        else if (step.operation !== registered.operation) {
          errors.push(path + '.operation does not match capability operation ' + registered.operation);
        }
      }
      if (step.depends_on != null && (!Array.isArray(step.depends_on) ||
          step.depends_on.some((id) => !nonEmpty(id)))) {
        errors.push(path + '.depends_on must be an array of step ids');
      }
    }
    const graph = new Map();
    for (const [index, step] of input.steps.entries()) {
      if (!isRecord(step) || !Array.isArray(step.depends_on)) continue;
      const stepId = step.step_id;
      for (const dependency of step.depends_on) {
        if (!ids.has(dependency)) errors.push('steps[' + index + '] references unknown dependency: ' + dependency);
        if (dependency === stepId) errors.push('steps[' + index + '] cannot depend on itself');
      }
      if (nonEmpty(stepId)) graph.set(stepId, step.depends_on.filter((id) => ids.has(id)));
    }
    // Three-colour DFS detects dependency cycles.
    const states = new Map();
    const visit = (id) => {
      const state = states.get(id) ?? 0;
      if (state === 1) return true;
      if (state === 2) return false;
      states.set(id, 1);
      let cycle = false;
      for (const dependency of graph.get(id) ?? []) if (visit(dependency)) cycle = true;
      states.set(id, 2);
      return cycle;
    };
    for (const id of graph.keys()) {
      if (visit(id)) { errors.push('plan dependencies contain a cycle'); break; }
    }
  }
  if (input.human_confirmation != null) {
    requireRecord(input.human_confirmation, 'human_confirmation', errors);
    if (isRecord(input.human_confirmation) && typeof input.human_confirmation.required !== 'boolean') {
      errors.push('human_confirmation.required must be a boolean');
    }
  }
  return errors.length ? { valid: false, errors } : pass();
}

/** Validate a declarative spatial representation before scene materialization. */
export function validateRepresentation(input) {
  const errors = [];
  requireRecord(input, 'representation', errors);
  if (!isRecord(input)) return fail(errors[0]);
  if (input.schema_version !== 'netcity.representation.v0.1') errors.push('schema_version is unsupported');
  requireString(input.representation_id, 'representation_id', errors);
  requireString(input.semantic_type, 'semantic_type', errors);
  requireString(input.layer, 'layer', errors);
  if (!LAYERS.includes(input.layer)) errors.push('layer is not a recognized NetCity layer');
  requireRecord(input.spatial, 'spatial', errors);
  requireRecord(input.form, 'form', errors);
  requireRecord(input.behavior, 'behavior', errors);
  if (isRecord(input.spatial)) {
    requireRecord(input.spatial.anchor, 'spatial.anchor', errors);
    if (input.spatial.position != null) {
      requireRecord(input.spatial.position, 'spatial.position', errors);
      if (isRecord(input.spatial.position)) {
        for (const axis of ['x', 'y', 'z']) {
          if (!Number.isFinite(input.spatial.position[axis])) errors.push('spatial.position.' + axis + ' must be finite');
        }
      }
    }
  }
  if (isRecord(input.form)) requireString(input.form.geometry, 'form.geometry', errors);
  if (isRecord(input.behavior)) {
    requireEnum(input.behavior.visibility, REPRESENTATION_VISIBILITY, 'behavior.visibility', errors);
    requireString(input.behavior.lifecycle, 'behavior.lifecycle', errors);
    if (input.behavior.focus_reveal != null && typeof input.behavior.focus_reveal !== 'boolean') {
      errors.push('behavior.focus_reveal must be a boolean');
    }
  }
  if (input.source_refs != null && (!Array.isArray(input.source_refs) ||
      input.source_refs.some((ref) => !nonEmpty(ref)))) {
    errors.push('source_refs must be an array of strings');
  }
  return errors.length ? { valid: false, errors } : pass();
}

/**
 * Small in-memory registry for validated capability descriptors.
 * Registration is metadata only; it never invokes an adapter.
 */
export class CapabilityRegistry {
  #entries = new Map();

  register(capability) {
    const result = validateCapability(capability);
    if (!result.valid) return result;
    if (this.#entries.has(capability.id)) {
      return fail('capability already registered: ' + capability.id);
    }
    this.#entries.set(capability.id, Object.freeze(structuredClone(capability)));
    return pass();
  }

  get(id) {
    return this.#entries.get(id) ?? null;
  }

  list() {
    return [...this.#entries.values()];
  }
}
