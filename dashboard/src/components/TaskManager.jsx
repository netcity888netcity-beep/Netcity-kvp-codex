import React, { useState } from 'react';

/** Дерево целей одного слоя (получает своё дерево через проп tree). */
export default function TaskManager({ tree: initialTree }) {
  const [tree, setTree] = useState(initialTree);
  const [newTask, setNewTask] = useState('');

  const addTask = (subId) => {
    if (!newTask.trim()) return;
    setTree((prev) => ({
      ...prev,
      subcategories: prev.subcategories.map((sub) =>
        sub.id === subId ? { ...sub, tasks: [...sub.tasks, newTask] } : sub
      )
    }));
    setNewTask('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[12px] font-bold tracking-[0.14em] text-slate-200">{tree.name}</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-cyan-400" style={{ width: `${tree.progress}%` }} />
          </div>
          <span className="font-mono text-[10px] text-cyan-300">{tree.progress}%</span>
        </div>
      </div>

      {tree.subcategories.map((sub) => (
        <div key={sub.id} className="ml-1 mt-1 space-y-2 border-l-2 border-cyan-500/50 pl-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{sub.name}</p>
          <ul className="space-y-1">
            {sub.tasks.map((task, idx) => (
              <li
                key={idx}
                className="glass-card flex items-center gap-2 rounded p-2 font-mono text-[11px] text-slate-300"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                {task}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              placeholder="Новая задача..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              className="glass-input flex-1 rounded px-2 py-1 font-mono text-[11px] text-slate-200"
            />
            <button
              type="button"
              onClick={() => addTask(sub.id)}
              className="glass-btn rounded border border-cyan-500/50 bg-cyan-500/20 px-3 py-1 font-mono text-[11px] font-bold text-cyan-300 transition-colors hover:bg-cyan-500/40"
            >
              + ADD
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
