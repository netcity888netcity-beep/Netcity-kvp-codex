# NetCity roadmap v1 — AR-HUD / dashboard

Статус направлений NetCity KVP (пространственный интерфейс оператора).
Критерий **Completed**: код в `main` + зелёные тесты + скриншот-верификация.

## Direction 01 — Spatial Visual Architecture

**Status: ✅ Completed** — коммит `8d636cb` (18 Nov 2026)

- Постоянные слои мира (`spatial/world.js`): слои существуют всегда, приглушены, но не удаляются.
- Память среды: сериализация мира в localStorage, переживает перезагрузки.
- Система пространственных объектов: beacon / plinth / monolith + якорные группы.
- Динамические темы активного слоя (фон, свет, акценты, рамки, навигация).
- Deep-links слоёв (`#energy`, `#bio`, …).

Evidence: `npm run test:spatial` — **22/22**, сборка зелёная, скриншоты портрет/ландшафт.

## Direction 02 — Architect Runtime (Digital Self)

**Status: ✅ Completed** — коммит `47618c2` (18 Nov 2026)

- `ArchitectCore.js`: класс `ArchitectRuntime.processIntent(str)` — mock-интерпретатор
  намерений (`focus`, `spawn_object`, ru/en ключевые слова, история, bounded).
- `IntentRouter.js`: роутинг действий в Spatial Engine (фокус слоя, спавн объектов
  через `world.js`).
- Command Palette над нижней навигацией: ввод → Enter → визуальное переключение слоя.
- Тост-отклик Мозга, console-логи, boot-команды `#cmd=<намерение>`.

Evidence: `npm run test:architect` — 12 тестов ядра роутинга, сборка зелёная, скриншоты.

## Direction 03 — Intelligent Layer Architecture

**Status: ✅ Completed** — коммит `ac08475` (18 Nov 2026)

- `LayerAgent.js`: специализированный агент каждого из 7 слоёв + `getStatus()`
  с характерной телеметрией (energy: *Stable, 1.2 GW*; tech: *8 nodes online*;
  bio: *Vitals Optimal*; core/civic/info/ident — свои mock-данные).
- Намерение `status` / `статус` (`layer_status`) → определение слоя из строки →
  агент слоя → результат тостом и в лог.
- AGENT LOG-панель под шапкой HUD: пишется автоматически при каждом фокусе слоя
  и при status-командах; дублируется в console.

Evidence: `npm run test:architect` — **26/26**, итог **48/48** (spatial 22 + architect 26),
сборка зелёная, скриншоты тоста и лог-панели.

## MVP — ✅ Ready for pitch

Программный фундамент Направлений 01–03 закрыт: живая пространственная среда с
памятью, мозг-интерпретатор намерений и интеллект каждого слоя. Маяк (GitHub Pages)
обновлён финальной версией.

## Backlog (следующие шаги, не закрыты)

- Направление 04+: координация роя агентов (модуль `agent/` есть, связь не построена).
- Живая связь интеллектуальных слоёв через KVP (сейчас mock-телеметрия).
- Доказательства аппаратных функций — только при наличии устройств.
