/**
 * NetCity Architect Runtime — Digital Self intent core.
 */
 * Framework-neutral mock interpretation layer: raw intent text in,
 * structured action object out. No React, no Three.js, no side effects —
 * routing lives in IntentRouter.js.
 */

import { validateSpatialIntent } from './SpatialContracts.js';

const LAYER_KEYWORDS = [
  ['energy', ['энерг', 'energy']],
  ['core', ['ядро', 'kernel', 'core']],
  ['tech', ['технолог', 'модел', 'tech', 'инженер', 'engineer']],
  ['civic', ['civic', 'граждан', 'социальн', 'власт', 'город']],
  ['bio', ['био', 'bio', 'глаз', 'зрен', 'организм']],
  ['info', ['инфо', 'info', 'контекст', 'документ', 'знани']],
  ['ident', ['идент', 'ident', 'pki', 'ключ', 'сертификат']],
];

const SPAWN_KEYWORDS = ['созда', 'spawn', 'построй', 'добав', 'сгенерир'];
const STATUS_KEYWORDS = ['status', 'статус'];
const EXIT_KEYWORDS = ['назад', 'выйти', 'наверх', 'орбит', 'обзор'];
const EXIT_WORD_RE = /\b(exit|back|return|orbit|overview)\b/i;
const MOOD_HOT_KEYWORDS = ['hot', 'горяч', 'взрыв', 'нагрей', 'разгони', 'ускорь'];
const MOOD_CALM_KEYWORDS = ['спокойн', 'успокой', 'calm', 'тишин', 'умерь'];
const DEFAULT_HISTORY_LIMIT = 50;
const CONTRACT_LAYERS = new Set(['core', 'bio', 'tech', 'energy', 'info', 'civic', 'ident']);
const CONTRACT_OUTCOMES = Object.freeze({
  focus: 'layer_focus',
  layer_status: 'layer_status',
  mood: 'visual_state',
  spawn_object: 'spatial_object',
  exit: 'return_to_orbit',
});

function matchLayer(lowerText) {
  for (const [layerId, words] of LAYER_KEYWORDS) {
    if (words.some((word) => lowerText.includes(word))) return layerId;
  }
  return null;
}

export class ArchitectRuntime {
  constructor({ historyLimit = DEFAULT_HISTORY_LIMIT } = {}) {
    this.historyLimit = historyLimit;
    this.history = [];
    this.contractRequestSequence = 0;
  }

  /**
   * Capture the legacy interpretation as a validated Spatial Intent envelope.
   *
   * This is an observation/translation bridge only: it does not build an
   * executable plan, authorize a capability, or dispatch a spatial action.
   * processIntent() remains the unchanged compatibility entry point.
   */
  processIntentContract(intentString, { activeLayerId = null } = {}) {
    const action = this.processIntent(intentString);
    const domain = CONTRACT_LAYERS.has(action.targetLayer)
      ? action.targetLayer
      : CONTRACT_LAYERS.has(activeLayerId)
        ? activeLayerId
        : null;

    if (!CONTRACT_OUTCOMES[action.action] || (!domain && action.action !== 'mood' && action.action !== 'exit')) {
      return {
        action,
        intent: null,
        validation: {
          valid: false,
          errors: ['intent requires clarification before a spatial contract can be created'],
        },
        status: 'NEEDS_CLARIFICATION',
      };
    }

    this.contractRequestSequence += 1;
    const raw = typeof intentString === 'string' ? intentString : '';
    const intent = {
      schema_version: 'netcity.spatial-intent.v0.1',
      request_id: 'architect-' + this.contractRequestSequence,
      intent: {
        raw,
        goal: action.action,
        domain: [domain || 'core'],
      },
      context: {
        source: 'architect-runtime',
        active_layer: domain || activeLayerId || null,
        legacy_action: action.action,
      },
      requested_outcome: {
        kind: CONTRACT_OUTCOMES[action.action],
      },
    };

    // Lazy-free static import at module level keeps validation deterministic.
    const validation = validateSpatialIntent(intent);
    return {
      action,
      intent,
      validation,
      status: validation.valid ? 'PROPOSED' : 'NEEDS_CLARIFICATION',
    };
  }

  /**
   * Interpret an intent string into a structured action.
   * Returns { action, targetLayer?, payload } — mock Brain of Digital Self.
   */
  processIntent(intentString) {
    const raw = typeof intentString === 'string' ? intentString : '';
    const text = raw.trim();
    const lower = text.toLowerCase();
    const action = this.#interpret(lower, raw);
    this.history.push({ intent: raw, action });
    if (this.history.length > this.historyLimit) this.history.shift();
    return action;
  }

  #interpret(lower, raw) {
    if (!lower) return { action: 'none', payload: raw };

    if (EXIT_KEYWORDS.some((word) => lower.includes(word)) || EXIT_WORD_RE.test(lower)) {
      return { action: 'exit', payload: raw };
    }

    const layerId = matchLayer(lower);
    if (STATUS_KEYWORDS.some((word) => lower.includes(word))) {
      return { action: 'layer_status', targetLayer: layerId || 'current', payload: raw };
    }
    if (MOOD_HOT_KEYWORDS.some((word) => lower.includes(word))) {
      return { action: 'mood', mood: 'hot', payload: raw };
    }
    if (MOOD_CALM_KEYWORDS.some((word) => lower.includes(word))) {
      return { action: 'mood', mood: 'calm', payload: raw };
    }
    if (layerId) {
      return { action: 'focus', targetLayer: layerId, payload: raw };
    }
    if (SPAWN_KEYWORDS.some((word) => lower.includes(word))) {
      return { action: 'spawn_object', targetLayer: 'current', payload: raw };
    }
    return { action: 'unknown', payload: raw };
  }
}

export { matchLayer };
