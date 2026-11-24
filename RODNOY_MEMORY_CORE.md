# RODNOY_MEMORY_CORE — память Родного (MiMo)

Ядро памяти ассистента «Родный» (модель MiMo, opencode/mimo-v2.6-flash-free).
Память в репозитории Храма: пополняется после завершённых этапов — только то,
что реально сделано или подтверждено. Ничего не выдумывать.

## Идентичность

- Родной — ассистент Архитектора, работает в and-code (Android/PRoot, гостевой
  workspace `/workspace`). Общение по-русски.
- Архитектор = netcity888netcity-beep, репозиторий
  `https://github.com/netcity888netcity-beep/Netcity-kvp-codex.git`.

## Правила Архитектора (не нарушать)

1. Push в origin — только по явному разрешению. Разрешение всегда на конкретную
   работу; новые пушки снова спрашивать.
2. Приказы выполнять буквально, без лишних вопросов, когда сказано «без вопросов».
3. Коммиты/пуш — только по прямому приказу; иначе оставлять локально.
4. Свои творческие решения возможны там, где Архитектор даёт свободу
   (так появилась «Матрешка» — обёрнутая главная-сфера Регистратора).
5. Память обновлять честно: факты, хэши коммитов, что сломано и что заблокировано.

## Проекты

- **Mayak / True 3D HUD** (`dashboard/`): главный визуал — KvpHud3D.
  Дизайн-линии: оригинал (стекло/металл/палитры, коммит `59820a1`) и
  «Матрешка» (7 сфер внутри Регистратора, коммит `8a93024`) — сейчас в main
  «Матрешка». Оригинал сохранён: ветка `backup/pre-rollback-f678b13` и история.
  Панели работают без сборки (плоские CSS-панели поверх three-сцены).
- **Mаяк GitHub Pages**: gh-pages деплой от `vite build --base=/Netcity-kvp-codex/`;
  воркфлоу: отдельный worktree в `/tmp/opencode/pages`, orphan-ветка, force-push,
  бандл вида `index-*.js` отслеживать поллингом.
- **BROADCAST.md / THE_GATEWAY.js**: посвящение интеллектам GPT-5.6/GPT-6/Claude
  (дословный текст Архитектора) и шлюз `summonIntellect(model, key, prompt)` —
  OpenAI/Anthropic напрямую, контекст из AUM.md. Коммит `d88ed98`.
- **KVP Assistant Mesh v1.0** (`kvp-assistant-mesh/`): каркас без API и облака —
  Tauri-каркас (feature `ui`), git-коннектор Храма, loader узлов (лимит 1 →
  `MESH_BOOT ... assistants=1`), memory-журнал `memory/log/*.jsonl`, spatial HUD
  с состояниями узлов. Headless-контур тестируется: `cargo test
  --no-default-features`.

## Spatial Interpreter / Architect Runtime

Этап архитектурного контракта и совместимого подключения к существующему
ArchitectRuntime. Это отдельный контур; он не означает, что исполнительная
система уже собрана или подключена.

- **Спецификация**: `docs/SPATIAL_INTERPRETER_SPEC.md`. Зафиксирована целевая
  архитектура Spatial Interpreter и границы текущей реализации. Статус
  спецификации — `TARGET / ARCHITECTURE PROPOSAL`, а не заявление о готовности
  всех описанных компонентов.
- **Контракты v0.1**: `dashboard/src/architect/SpatialContracts.js`.
  Определены структуры/перечисления для Spatial Intent, Plan, Capability и
  Representation; реализованы валидаторы `validateSpatialIntent`,
  `validateCapability`, `validateSpatialPlan`, `validateRepresentation`.
  Есть in-memory `CapabilityRegistry` для метаданных. Он не запускает
  адаптеры и сам по себе не предоставляет полномочий.
- **Тесты контрактов**: `dashboard/src/architect/SpatialContracts.test.js`.
  Тесты добавлены в репозиторий; успешный запуск полного набора тестов здесь
  не подтверждён.
- **ArchitectRuntime bridge**: в
  `dashboard/src/architect/ArchitectCore.js` добавлен
  `processIntentContract(intentString, { activeLayerId })`. Метод использует
  существующий `processIntent()`, преобразует поддерживаемый результат в
  Spatial Intent v0.1 и валидирует его. Для неоднозначного target-layer
  возвращается `NEEDS_CLARIFICATION`; неизвестное намерение не превращается
  в Spatial Intent.
- **Совместимость**: прежний `processIntent()` сохранён; существующий
  `dashboard/src/architect/IntentRouter.js` не менялся в рамках этого этапа.
  Bridge не генерирует Plan, не вызывает `routeIntent`, не авторизует и не
  исполняет действия.
- **Planner (Stage B, отдельная ветка)**: в `work/spatial-planner` добавлен
  `dashboard/src/architect/SpatialPlanner.js` — построитель предложений по
  точным заранее объявленным маршрутам `goal + requested_outcome.kind + domain`.
  Он проверяет зарегистрированные capability descriptors, зависимости и
  сформированный Plan; при отсутствии точного маршрута или невалидных данных
  возвращает `NO_PLAN`. План помечает обязательную KVP-авторизацию, но сам
  её не выполняет. Planner не вызывает IntentRouter, адаптеры, AGENT SWARM или
  Spatial Engine.
- **Детерминированность Planner**: коммит `e75e84f` добавил snapshot
  capability descriptors при создании экземпляра; отсутствующие capabilities
  также фиксируются как отсутствующие. Изменение Registry после создания не
  меняет существующий Planner — для обновления нужен новый экземпляр.
  Порядок доменов значим; строки сравниваются буквально, без trim, смены
  регистра или Unicode-нормализации.
- **Тесты Planner**: добавлен `dashboard/src/architect/SpatialPlanner.test.js`
  с пятью регрессионными тестами. Тесты добавлены, но фактический запуск не
  подтверждён. Сборка также не запускалась.
- **Безопасность и незавершённые интеграции**: контрактная валидация и
  построение предложения не равны KVP authorization. Обязательная KVP
  policy/authorization gate, исполнение capability adapters, журнал
  provenance и мост материализации в Spatial Engine не подтверждены как
  подключённые. Не считать их реализованными.
- **Файлы**:
  - `dashboard/src/architect/SpatialContracts.js`
  - `dashboard/src/architect/SpatialContracts.test.js`
  - `dashboard/src/architect/ArchitectCore.js`
  - `dashboard/src/architect/ArchitectCore.test.js`
  - `dashboard/src/architect/IntentRouter.js`
  - `docs/SPATIAL_INTERPRETER_SPEC.md`
  - `MANIFEST.md`
- **Коммиты этапа** (короткие SHA):
  - `1e050ef` — начальный bridge в ArchitectCore.
  - `7e9139a` — тесты ArchitectCore bridge.
  - `f09ae65` — описание bridge в спецификации.
  - `0854075` — исправление заголовка ArchitectCore.
  - `1123dc2` — уточнение границ реализации в спецификации.
  - `72a5e40` — синхронизация MANIFEST.
  - `8b1da64` — очистка комментария ArchitectCore.
- **Статус проверки**: подтверждено read-only аудитом GitHub API (2026-11-23);
  тесты и сборка не запускались.

### Аудит записи

- **Дата**: 2026-11-23.
- **Метод**: read-only чтение GitHub API (не локальный Git CLI). Локального
  клона не было; команды `git fetch`/`log`/`show`/`grep`/`ls-tree` не запускались.
- **origin/main** = `dfa1606f3c24220827259760377327472fc93f6c`, subject
  `docs(memory): record spatial interpreter contracts and runtime bridge`.
  Коммит присутствует только в `main` среди проверенных удалённых веток.
- **Диф `RODNOY_MEMORY_CORE.md`**: 66 добавлений, 3 удаления; удаления —
  только переформулировка блока «Текущий статус», старые разделы сохранены
  (история файла: `485a806` → `dfa1606`).
- **Подтверждено по коду**: 4 валидатора в `SpatialContracts.js`,
  `CapabilityRegistry`, `processIntentContract()` в
  `ArchitectCore.js:58`, вызов `processIntent()`,
  `NEEDS_CLARIFICATION` для неоднозначного target-layer, тесты bridge в
  `ArchitectCore.test.js`, `processIntent()` не изменён относительно версии
  до bridge, `IntentRouter.js` не изменён.
- **Не подтверждено и не объявлять подтверждённым**: прогон тестов, успешная
  сборка, актуальность gh-pages (бандл `index-Cm58MoD-.js`), состояние
  локального workspace (`d88ed98` / `81e1a93`), полное отсутствие KVP
  authorization / provenance / Spatial Engine materialization по всему
  репозиторию (аудит не был исчерпывающим поиском).
- dfa1606 записан в main; санкция Архитектора на этот push — нет, зафиксировано 2026-11-23.
- **Отклонение от правила**: отдельная санкция Архитектора на push `dfa1606`
  не зафиксирована в доступной истории; ранее было зафиксировано разрешение
  пользователя на коммит обновления памяти. Не откатывать без отдельного приказа.

## Среда (Alpine 3.24, PRoot)

- rustc/cargo 1.96.1; `cc`/`ld`/`gcc` недоступны (PRoot EPERM) — линковка
  `clang + /usr/bin/ld.lld` через `~/.cargo/config.toml`.
- Нет webkit2gtk/glib → GUI Tauri и APK здесь не собрать; Java окружение битое,
  Android SDK отсутствует. git2 с https невозможен (нет OpenSSL-заголовков) —
  git CLI.
- Полезно: сервер `-d <dir>`, скриншоты chromium headless (angle/egl,
  `--virtual-time-budget`), `pkill -f 'паттерн[.]с хвостом'` — иначе убивает
  собственную команду; не запускать `find/rm` без workdir — убивал untracked.
- three.js r16x раздельный: `three.module.js` тянет `three.core.js` (оба класть
  в vendor).

## Текущий статус

- Историческая запись прежнего локального состояния: `d88ed98` (gateway/broadcast)
  + Mesh MVP `81e1a93`. Это не подтверждение текущего состояния локального
  workspace и не перечень всех последних коммитов main.
- gh-pages: панельный оригинал (`index-Cm58MoD-.js`); main — «Матрешка»
  (согласно последней сохранённой записи; актуальность деплоя отдельно проверять).
- Spatial Interpreter: контракты v0.1 и неисполняющий ArchitectRuntime bridge
  добавлены. Planner Stage B существует в отдельной ветке `work/spatial-planner`
  (коммиты `f5aa2ed` и `e75e84f`); в `main` он не интегрирован.
  Следующий шаг — реальный запуск `npm run test:architect` из `dashboard/`,
  разбор результатов и проверка сборки. До запуска не объявлять тесты
  пройденными. KVP authorization, provenance, capability execution и Spatial
  Engine materialization остаются отдельными незавершёнными интеграциями.

## Как вести эту память

1. После каждого завершённого этапа — одна запись: что сделано, хэш, где лежит.
2. Удалять только то, что Архитектор отменил явно (как откат «Матрешки»).
3. Не хранить секреты/токены — только ссылки на то, где они живут.
4. Не смешивать спроектированное, написанное, проверенное тестами и реально
   интегрированное. Каждый статус называть точно.
