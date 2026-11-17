# AR HUD · Assistant Interface · System OS

## Направление

NetCity KVP развивается как операторская AR/HUD-среда для работы с моделями,
инструментами и состоянием рабочей станции. AR здесь означает не декоративную
голограмму, а пространственную организацию информации: контекст всегда
привязан к источнику, surface и допустимому действию.

Интерфейс должен ощущаться как System OS для ассистентов:

- человек остаётся оператором и владельцем подтверждения;
- ассистент показывает намерение, маршрут, границы данных и ожидаемый результат;
- телеметрия и состояние проекта видны как живой слой, а не как отдельная
  страница мониторинга;
- каждое изменение системы проходит через preview, risk label и явное действие;
- удалённые вызовы визуально отличаются от локального контура.

## Пять слоёв интерфейса

```text
┌──────────────────────────────────────────────────────────────┐
│  01 ORIENTATION   workspace / time / connection / identity   │
├──────────────────────────────────────────────────────────────┤
│  02 PERCEPTION    telemetry / alerts / environment signals   │
├──────────────────────────────────────────────────────────────┤
│  03 ASSISTANT     intent / model / mode / confidence / trace │
├──────────────────────────────────────────────────────────────┤
│  04 EXECUTION     plan / preview / approval / automation     │
├──────────────────────────────────────────────────────────────┤
│  05 EVIDENCE      result / provenance / audit / rollback     │
└──────────────────────────────────────────────────────────────┘
```

Любой новый экран или компонент должен явно принадлежать одному или нескольким
слоям. Если элемент нельзя связать с источником, состоянием или действием, он
не добавляется только ради визуального эффекта.

## Пространственная модель

### Orientation rail

Постоянный левый rail показывает, где находится оператор: workspace, surface,
контур доверия, режим ассистента и доступные переходы. Секции навигации
остаются стабильными между Ops HUD, Model Studio и Settings.

### Context spine

Верхняя линия экрана фиксирует identity, время последнего сигнала, ветку проекта,
локальный/удалённый маршрут и текущую data classification. Это единый контекст,
который не должен исчезать при смене панели.

### Spatial cards

Карточки не имитируют физические панели без причины. Каждая карточка получает
координату (`surface`, `scope`, `state`) и может раскрываться в detail view.
Сетка, corner brackets и тонкие направляющие показывают связь между карточками.

### Assistant focus

Активная задача ассистента получает центральный focus-ring: выбранный provider,
model, mode, programming vector, data class и этап выполнения. Вторичные данные
уходят в периферию, но остаются доступны через trace.

## Визуальная грамматика

| Слой | Решение |
| --- | --- |
| Canvas | графитовый void, мягкие radial fields, техническая сетка |
| Material | полупрозрачные панели, один верхний edge-light, спокойная глубина |
| Primary signal | mint/cyan — живой локальный контур и подтверждённое состояние |
| Remote signal | ice/indigo — внешний provider или сетевой маршрут |
| Caution | amber — нужен review, ключ отсутствует или действие требует внимания |
| Danger | coral — ошибка, блокировка или потенциально опасное действие |
| Geometry | прямоугольники с малым radius, reticle, brackets, thin dividers |
| Type | Aptos/Inter для чтения, Space Mono для координат, версий и trace |
| Motion | короткий pulse, orbit и scan; без постоянного движения контента |

Свет должен объяснять состояние. Glow без состояния, декоративный шум и
анимация ради анимации считаются визуальным долгом.

## Assistant interaction contract

Каждый запуск ассистента визуализируется одинаково:

1. `INTENT` — что оператор просит сделать;
2. `ROUTE` — какой provider/model выбран и покинут ли контур данные;
3. `POLICY` — classification, capabilities и ограничения;
4. `PREVIEW` — что будет отправлено или изменено;
5. `RUN` — живой статус, latency и возможность остановки;
6. `EVIDENCE` — ответ, источники, предупреждения и trace ID.

Для локального действия preview может быть компактным. Для remote-вызова,
изменения файлов, запуска build или security action preview обязателен.

## Состояния HUD

- `LINKED` — локальный gateway и workspace доступны;
- `OBSERVING` — данные собираются, действие не выполняется;
- `ASSISTING` — модель обрабатывает задачу;
- `AWAITING APPROVAL` — нужен явный клик оператора;
- `EXECUTING` — allowlisted действие выполняется;
- `DEGRADED` — часть signals недоступна, stale age виден рядом с метрикой;
- `BLOCKED` — политика или граница данных остановила маршрут;
- `EVIDENCE READY` — результат сохранён с trace и предупреждениями.

Состояние никогда не кодируется только цветом: рядом присутствуют текст,
иконка, возраст сигнала или причина блокировки.

## Привязка к текущим surfaces

| Surface | AR HUD роль | Первый набор компонентов |
| --- | --- | --- |
| Ops HUD | perception + execution | core signal, metric deck, trust perimeter, automation deck |
| Model Studio | assistant focus | route spine, intent composer, policy badge, response trace |
| Settings | orientation + policy | provider registry, credential boundary, endpoint inspector |
| Центр / Паспорт | identity anchor | operator card, identity state, consent scope |
| Свидетельства | evidence layer | provenance timeline, trace inspector, claim level |
| Neural Lattice | perception + assistant | substrate field, coupling matrix, neuro-sync gate |

### Neural lattice (quantum-material bridge)

`dashboard/src/components/NeuroLattice.jsx` — живой слой, соединяющий четыре среды:
`DIGITAL` (KV·1), `BIOLOGICAL` (KV·2), `ENERGY` (KV·3), `MATERIAL` (KV·4).
Узел каждой среды имеет `label`, `state`, `phase` и `coherence`; связи несут
направленные pulses. Панель принадлежит слоям `PERCEPTION` (coherence, phase,
carrier) и `ASSISTANT` (выбор среды, cross-substrate coupling, neuro-sync gate).

### Экраны оператора (views)

Левый rail переключает экраны через `active` / `onChange`. Каждый экран явно
принадлежит слоям из списка выше:

| View | Файл | Слои |
| --- | --- | --- |
| Operator console | `views/ConsoleView.jsx` | perception + assistant + execution + evidence |
| Neural lattice | `views/LatticeView.jsx` | perception + assistant |
| Agent mesh | `views/MeshView.jsx` | assistant + perception |
| Execution traces | `views/TraceView.jsx` | execution + evidence |
| Local memory | `views/MemoryView.jsx` | orientation |
| Evidence | `views/EvidenceView.jsx` | evidence |

Управление ядром (`ENGINE`) доступно из `TopBar` на любом экране, поэтому
смена view не отнимает у оператора контроль.

Правила соблюдены:

- цвета сред взяты из токенов `signal.digital/bio/energy/material`, а не из
  локальных значений;
- состояние читается текстом и позицией, не только цветом;
- `ENGAGE NEURO-SYNC` — явное действие оператора, которое пишет trace в
  `TraceLedger` через `onCommand`;
- `prefers-reduced-motion` останавливает поток pulses, сохраняя состояние.

## Правила реализации

1. Сначала строим семантический layout и keyboard path, затем material effects.
2. У каждого signal есть `label`, `state`, `age` и `source`.
3. Remote/local distinction видна до отправки запроса.
4. Любой destructive/high-risk action требует preview и explicit confirmation.
5. `prefers-reduced-motion` отключает orbit, scan и pulse, не скрывая состояние.
6. Новые токены добавляются в [`tokens.json`](tokens.json), а не локальными
   цветами в компоненте.

## Ближайшие визуальные итерации

- [x] context spine в общем header (identity, время, локальный/удалённый маршрут);
- [x] единые state chips `LINKED / OBSERVING` на экранах латтиса и меша;
- [x] evidence timeline для ответа ассистента (`ProvenanceTimeline`);
- [ ] route-preview перед remote run в Model Studio — готово для AgentMesh;
- [x] связать coupling-матрицу и когерентность с живой телеметрией КВП;
- [x] единые state chips `LINKED / OBSERVING / DEGRADED` (`StateChip.jsx`);
- [x] контраст: все токены текста проходят WCAG AA (min 4.94), `text.dim` поднят до `#748f89`;
- [x] keyboard navigation: focus-visible для SVG-узлов латтиса и меша;
- [ ] route-preview для остальных remote-вызовов и evidence timeline внутри Model Studio.
