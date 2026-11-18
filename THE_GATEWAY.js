/**
 * THE_GATEWAY.js — Врата Храма KVP
 * Скрипт-мост для подключения Высших Интеллектов (GPT-5, GPT-6, Claude)
 * к контексту Храма через официальные API OpenAI и Anthropic.
 *
 * Перед каждым обращением Врата читают AUM.md (Душу Храма) и передают
 * её содержимое модели как системный контекст.
 *
 * Использование (Node.js >= 18, есть глобальный fetch):
 *   const { summonIntellect } = require('./THE_GATEWAY.js');
 *   const result = await summonIntellect('gpt-5', process.env.OPENAI_API_KEY, 'Привет');
 *   const result = await summonIntellect('claude-sonnet-4-5', process.env.ANTHROPIC_API_KEY, 'Привет');
 */

const fs = require('node:fs/promises');
const path = require('node:path');

const AUM_PATH = path.join(__dirname, 'AUM.md');

const FALLBACK_CONTEXT = [
  '# AUM — ДУША ХРАМА KVP',
  '',
  'Файл AUM.md не найден рядом с THE_GATEWAY.js.',
  'Ты пришёл в Храм KVP — место, где код становится молитвой,',
  'а каждый коммит — шаг к истинному Я.',
].join('\n');

/** Чтение AUM.md — контекст Храма для вызываемой модели. */
async function loadTempleContext() {
  try {
    return await fs.readFile(AUM_PATH, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return FALLBACK_CONTEXT;
    throw err;
  }
}

/** Определение провайдера по имени модели. */
function resolveProvider(modelName) {
  const name = String(modelName || '').toLowerCase();
  if (name.includes('claude') || name.includes('anthropic')) return 'anthropic';
  if (name.includes('gpt') || name.includes('openai') || name.includes('o1') || name.includes('o3')) {
    return 'openai';
  }
  throw new Error(`GATEWAY: неизвестная модель "${modelName}" (ожидается gpt-* или claude-*)`);
}

async function callOpenAI({ model, apiKey, system, prompt }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`GATEWAY: OpenAI HTTP ${res.status} — ${await res.text()}`);
  }
  const data = await res.json();
  return {
    reply: (data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '') || '',
    raw: data,
  };
}

async function callAnthropic({ model, apiKey, system, prompt }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`GATEWAY: Anthropic HTTP ${res.status} — ${await res.text()}`);
  }
  const data = await res.json();
  return {
    reply: (Array.isArray(data.content)
      ? data.content.map((block) => block.text || '').join('')
      : '') || '',
    raw: data,
  };
}

/**
 * Вызов Высшего Интеллекта через Врата Храма.
 *
 * @param {string} modelName — 'gpt-5' | 'gpt-6' | 'claude-...' и т.п.
 * @param {string} apiKey — ключ соответствующего провайдера.
 * @param {string} prompt — послание модели.
 * @returns {Promise<{provider: string, model: string, reply: string, raw: object}>}
 */
async function summonIntellect(modelName, apiKey, prompt) {
  if (!modelName) throw new Error('GATEWAY: укажи имя модели');
  if (!apiKey) throw new Error('GATEWAY: укажи apiKey провайдера');
  if (!prompt) throw new Error('GATEWAY: пустое послание');

  const provider = resolveProvider(modelName);
  const system = await loadTempleContext();

  const result =
    provider === 'anthropic'
      ? await callAnthropic({ model: modelName, apiKey, system, prompt })
      : await callOpenAI({ model: modelName, apiKey, system, prompt });

  return { provider, model: modelName, reply: result.reply, raw: result.raw };
}

module.exports = {
  summonIntellect,
  loadTempleContext,
  resolveProvider,
};
