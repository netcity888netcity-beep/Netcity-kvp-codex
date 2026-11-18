/**
 * NetCity Architect Runtime — Digital Self intent core.
 *
 * Framework-neutral mock interpretation layer: raw intent text in,
 * structured action object out. No React, no Three.js, no side effects —
 * routing lives in IntentRouter.js.
 */

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
const DEFAULT_HISTORY_LIMIT = 50;

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

    const layerId = matchLayer(lower);
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
