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

## Правила реализации

1. Сначала строим семантический layout и keyboard path, затем material effects.
2. У каждого signal есть `label`, `state`, `age` и `source`.
3. Remote/local distinction видна до отправки запроса.
4. Любой destructive/high-risk action требует preview и explicit confirmation.
5. `prefers-reduced-motion` отключает orbit, scan и pulse, не скрывая состояние.
6. Новые токены добавляются в [`tokens.json`](tokens.json), а не локальными
   цветами в компоненте.

## Ближайшие визуальные итерации

- добавить context spine в общий `Dashboard` header;
- перевести Ops HUD на единые `LINKED / OBSERVING / DEGRADED` state chips;
- добавить в Model Studio route-preview перед remote run;
- собрать evidence timeline для ответа ассистента;
- проверить контраст и keyboard navigation на desktop и узких экранах.
