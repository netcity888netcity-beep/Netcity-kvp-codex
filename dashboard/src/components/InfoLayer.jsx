import React, { useState } from 'react';

const SEED = [
  { id: 1, title: 'NetCity AR HUD — devlog', q: 'NetCity AR HUD devlog' },
  { id: 2, title: 'Мультиагентные системы: среды и роли', q: 'multi agent systems environments' },
  { id: 3, title: 'AR-интерфейсы будущего', q: 'AR interface future HUD' }
];

/** Информационная среда: агент открывает окно контента (видео/браузер) по запросу. */
export default function InfoLayer() {
  const [feed, setFeed] = useState(SEED);
  const [query, setQuery] = useState('');

  const ask = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setFeed((prev) => [{ id: Date.now(), title: query.trim(), q: query.trim() }, ...prev]);
    setQuery('');
  };

  return (
    <div className="space-y-3">
      <form onSubmit={ask} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Запрос агенту INFO: видео, статья, тема..."
          className="glass-input min-w-0 flex-1 rounded px-3 py-1.5 font-mono text-[11px] text-slate-200 placeholder:text-slate-600"
        />
        <button
          type="submit"
          className="glass-btn shrink-0 rounded border border-cyan-500/50 bg-cyan-500/15 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-cyan-300 hover:bg-cyan-500/30"
        >
          ЗАПРОС АГЕНТУ
        </button>
      </form>

      <div className="glass-card overflow-hidden rounded">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 font-mono text-[9px] tracking-[0.14em] text-slate-500">
          <span>AGENT VIEW · WINDOW</span>
          <a
            href="https://www.youtube.com"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300 hover:underline"
          >
            youtube.com ↗
          </a>
        </div>
        <ul className="max-h-44 divide-y divide-white/5 overflow-y-auto">
          {feed.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate font-mono text-[11px] text-slate-300">{item.title}</span>
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(item.q)}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] text-cyan-300 hover:bg-cyan-500/25"
              >
                OPEN ↗
              </a>
            </li>
          ))}
        </ul>
      </div>

      <p className="font-mono text-[9px] tracking-[0.12em] text-slate-500">
        BROWSER-AGENT ИЩЕТ И ОТКРЫВАЕТ САМ — ВАМ ТОЛЬКО СМОТРЕТЬ
      </p>
    </div>
  );
}
