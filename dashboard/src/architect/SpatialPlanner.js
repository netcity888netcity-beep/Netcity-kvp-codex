/**
 * NetCity Deterministic Spatial Planner.
 *
 * Builds proposals only from explicitly configured exact routes.
 * It validates metadata and emits KVP authorization requirements, but does
 * not call KVP, policy gates, routers, adapters, agents, or Spatial Engine.
 */

import {
  OPERATIONS,
  validateCapability,
  validateSpatialIntent,
  validateSpatialPlan,
} from './SpatialContracts.js';

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) =>
  typeof value === 'string' && value.trim().length > 0;

function freezeSnapshot(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('snapshot values must contain only plain objects and arrays');
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      throw new TypeError('snapshot values must not contain symbol keys');
    }
    freezeSnapshot(value[key], seen);
  }
  return Object.freeze(value);
}

function exactRouteKey(goal, outcome, domain) {
  // Domain is an ordered sequence: order is intentionally significant.
  return JSON.stringify([goal, outcome, domain]);
}

function validateRoute(route) {
  if (!isRecord(route)) return ['route must be an object'];
  const errors = [];
  if (!nonEmpty(route.goal)) errors.push('route.goal must be a non-empty string');
  if (!nonEmpty(route.outcome)) errors.push('route.outcome must be a non-empty string');
  if (!Array.isArray(route.domain) || route.domain.length === 0 ||
      route.domain.some((item) => !nonEmpty(item))) {
    errors.push('route.domain must be a non-empty array of non-empty strings');
  }
  if (!Array.isArray(route.steps) || route.steps.length === 0) {
    errors.push('route.steps must be a non-empty array');
  } else {
    const ids = new Set();
    for (const [index, step] of route.steps.entries()) {
      if (!isRecord(step)) {
        errors.push(`route.steps[${index}] must be an object`);
        continue;
      }
      if (!nonEmpty(step.step_id)) errors.push(`route.steps[${index}].step_id must be a non-empty string`);
      if (!nonEmpty(step.capability)) errors.push(`route.steps[${index}].capability must be a non-empty string`);
      if (!OPERATIONS.includes(step.operation)) errors.push(`route.steps[${index}].operation is unsupported`);
      if (nonEmpty(step.step_id)) {
        if (ids.has(step.step_id)) errors.push(`route.steps[${index}].step_id must be unique`);
        ids.add(step.step_id);
      }
      if (step.depends_on != null && (!Array.isArray(step.depends_on) ||
          step.depends_on.some((id) => !nonEmpty(id)))) {
        errors.push(`route.steps[${index}].depends_on must be an array of step ids`);
      }
    }
    if (errors.length === 0) {
      const probe = {
        schema_version: 'netcity.plan.v0.1',
        plan_id: 'route-validation',
        status: 'PROPOSED',
        steps: route.steps,
      };
      const validation = validateSpatialPlan(probe);
      if (!validation.valid) errors.push(...validation.errors.map((error) => 'route ' + error));
    }
  }
  if (route.human_confirmation != null &&
      (!isRecord(route.human_confirmation) || typeof route.human_confirmation.required !== 'boolean')) {
    errors.push('route.human_confirmation must be an object with a boolean required field');
  }
  return errors;
}

function noPlan(reason, errors = []) {
  return { status: 'NO_PLAN', reason, errors };
}

/**
 * @param {object} options
 * @param {{get(id: string): object|null}} options.capabilityRegistry
 * @param {Array<object>} options.routes Exact route declarations. No implicit routes are added.
 *
 * Capability descriptors are captured once during construction. To observe a
 * registry update, construct a new Planner instance.
 */
export class DeterministicSpatialPlanner {
  #capabilitySnapshots = new Map();
  #routes = new Map();

  constructor({ capabilityRegistry, routes = [] } = {}) {
    if (!capabilityRegistry || typeof capabilityRegistry.get !== 'function') {
      throw new TypeError('capabilityRegistry with get(id) is required');
    }
    if (!Array.isArray(routes)) throw new TypeError('routes must be an array');

    const capabilityIds = new Set();
    for (const sourceRoute of routes) {
      const routeErrors = validateRoute(sourceRoute);
      if (routeErrors.length) {
        throw new TypeError('invalid deterministic route: ' + routeErrors.join('; '));
      }
      const route = freezeSnapshot(structuredClone(sourceRoute));
      const key = exactRouteKey(route.goal, route.outcome, route.domain);
      if (this.#routes.has(key)) {
        throw new TypeError('duplicate exact route: ' + key);
      }
      this.#routes.set(key, route);
      for (const step of route.steps) capabilityIds.add(step.capability);
    }

    // Capture each referenced registry entry exactly once. Missing entries are
    // snapshotted as missing too, so later registration cannot change this instance.
    for (const id of capabilityIds) {
      const source = capabilityRegistry.get(id);
      const snapshot = source == null
        ? null
        : freezeSnapshot(structuredClone(source));
      this.#capabilitySnapshots.set(id, snapshot);
    }
  }

  plan(intent) {
    const intentValidation = validateSpatialIntent(intent);
    if (!intentValidation.valid) {
      return noPlan('INVALID_INTENT', intentValidation.errors);
    }

    const goal = intent.intent.goal;
    const outcome = intent.requested_outcome.kind;
    const domain = intent.intent.domain;
    const route = this.#routes.get(exactRouteKey(goal, outcome, domain));
    if (!route) return noPlan('NO_EXACT_ROUTE');

    const capabilities = [];
    for (const step of route.steps) {
      const capability = this.#capabilitySnapshots.get(step.capability);
      if (!capability) return noPlan('CAPABILITY_NOT_REGISTERED', [step.capability]);
      const capabilityValidation = validateCapability(capability);
      if (!capabilityValidation.valid) {
        return noPlan('CAPABILITY_INVALID', capabilityValidation.errors);
      }
      if (capability.operation !== step.operation) {
        return noPlan('CAPABILITY_OPERATION_MISMATCH', [
          step.capability + ': expected ' + capability.operation + ', route declares ' + step.operation,
        ]);
      }
      capabilities.push(capability);
    }

    const plan = {
      schema_version: 'netcity.plan.v0.1',
      plan_id: 'plan:' + intent.request_id,
      status: 'PROPOSED',
      steps: route.steps.map((step) => ({
        ...structuredClone(step),
        authorization: {
          required: true,
          authority: 'KVP',
        },
      })),
    };
    if (route.human_confirmation != null) {
      plan.human_confirmation = structuredClone(route.human_confirmation);
    }

    const planValidation = validateSpatialPlan(plan, { capabilities });
    if (!planValidation.valid) {
      return noPlan('GENERATED_PLAN_INVALID', planValidation.errors);
    }

    return {
      status: 'PLAN_PROPOSED',
      authorization_required: true,
      plan,
    };
  }
}
