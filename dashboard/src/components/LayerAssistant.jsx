import React, { useEffect, useRef, useState } from 'react';

/**
 * Ассистент слоя: свой для каждой среды (технические слои дают свой ответ).
 * Симуляция локального ассистента (observe_only).
 */
const GREET = {
  core: 'Ассистент ЯДРА: ядро KVP на связи, шина событий чистая.',
  tech: 'Технический ассистент: архитектура, билды, маршрут модели, доверие.',
  info: 'Информационный ассистент: найду видео или статью — и открою окно.',
  energy: 'Энергетический ассистент: питание, тепло, резерв устройства.',
  bio: 'Био-ассистент: фазы сна, пульс, HRV под наблюдением.',
  ident: 'Ассистент идентификации: ключи, подпись, био-привязка.',
  civic: 'Контекстный ассистент: домены, scope, PREVIEW → EVIDENCE.'
};

const REPLIES = {
  core: [
    'Запрос прошёл в KERNEL. Локальный вердикт: allowed (policy local_only).',
    'Стабильность ядра 98.4%, температура 41°C — отклонений нет.',
    'Синхронизация шины 92% — буфер событий не переполнен.'
  ],
  tech: [
    'Маршрут: INPUT → KERNEL → MODEL GATEWAY → LOCAL MODEL. Remote egress отклонён.',
    'Билд 45%, живых узлов 12/16, латентность 18ms.',
    'SYS-AGENT думает над задачей «Настроить AR HUD» — статус THINKING.'
  ],
  info: [
    'Запрос принят BROWSER-AGENT-ом. Открываю окно контента справа от фокуса.',
    'RETRIEVER нашёл 6 источников, кэш 64% — уточните тему.',
    'Готово: добавил материал в ленту слоя, жмите OPEN ↗.'
  ],
  energy: [
    'Батарея 76%, потребление 4.2W, режим SUSTAIN включён.',
    'Солнечный вход 18% — заряд идёт, цикл №312.',
    'Термопакет 41°C · OK, троттлинга нет.'
  ],
  bio: [
    'Фазы сна отслеживаются, прогресс нормализации режима 70%.',
    'Пульс 62 bpm, HRV 54 ms — в спокойной зоне.',
    'SLEEP-AGENT пометил окно отхода ко сну: 23:40.'
  ],
  ident: [
    'Подпись ED25519 верна, био-привязка закреплена.',
    'REMOTE ACCESS: DENIED — транспорт только локальный.',
    'Цифровой двойник BOUND / LOCAL ONLY.'
  ],
  civic: [
    'Открываю PREVIEW: scope, blast radius, риски, политики — подтвердите для EVIDENCE.',
    'PAYMENTS заблокирован: политика high_risk_block (ручной канал оператора).',
    'Все коннекторы MOCK · OBSERVE_ONLY — записей нет.'
  ]
};

export default function LayerAssistant({ layer }) {
  const [msgs, setMsgs] = useState(() => [{ who: 'ai', text: GREET[layer.id] || 'Ассистент слоя на связи.' }]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState(0);
  const scroller = useRef(null);

  useEffect(() => {
    setMsgs([{ who: 'ai', text: GREET[layer.id] || 'Ассистент слоя на связи.' }]);
    setStep(0);
    setInput('');
  }, [layer.id]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const send = (e) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    const bank = REPLIES[layer.id] || ['Принято. Локальный ассистент обрабатывает запрос.'];
    const reply = bank[step % bank.length];
    setMsgs((m) => [...m, { who: 'you', text: q }, { who: 'ai', text: reply }]);
    setStep((s) => s + 1);
    setInput('');
  };

  return (
    <form onSubmit={send} className="glass-strip mt-4 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 pb-2">
        <span className="font-mono text-[9px] tracking-[0.18em] text-cyan-300">
          LAYER ASSISTANT · {layer.short}
        </span>
        <span className="font-mono text-[9px] text-slate-500">local · observe_only</span>
      </div>

      <div ref={scroller} className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[92%] rounded px-2.5 py-1.5 font-mono text-[11px] leading-relaxed ${
              m.who === 'you'
                ? 'ml-auto bg-cyan-500/15 text-cyan-100'
                : 'bg-black/50 text-slate-300'
            }`}
          >
            {m.who === 'ai' ? <span className="mr-1.5 text-cyan-400">▸</span> : null}
            {m.text}
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Спросить ассистента слоя «${layer.short}»...`}
          className="min-w-0 flex-1 rounded border border-white/15 bg-black/60 px-3 py-1.5 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="submit"
          className="glass-btn shrink-0 rounded px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-cyan-200"
        >
          ▸
        </button>
      </div>
    </form>
  );
}
