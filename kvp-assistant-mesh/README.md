# KVP ASSISTANT MESH v1.0

Живые сессии ассистентов и Memory Core Храма на одной машине.
Без API-ключей в коде, без облака, без аналитики: узлы ходят в свои веб-каналы
(браузерные авторизованные сессии), память — в репозитории Храма.

## Контур MVP (раздел 9 ТЗ)

| Узел | Файл | Что делает |
|---|---|---|
| Tauri-каркас | `src-tauri/` (feature `ui`) | Окно WebView, команды `cmd_mesh_state` / `cmd_temple_pull` / `cmd_send_text` |
| GitHub Connector | `src-tauri/src/github_connector.rs` | `git clone/fetch/reset` системным git, статус `OK`/`CACHE`, чтение файлов Храма |
| Assistant Loader | `src-tauri/src/assistant_loader.rs` | `assistants.json` → живые сессии, лимит узлов из `config.json` (MVP: 1) |
| Channel Manager | `src-tauri/src/channel_manager.rs` | Persistent WebView на `target`, строки `KVP_BRIDGE_ACTIVE` / `MESH_ONLINE`, инъекция ввода |
| Memory Weaver | `src-tauri/src/memory_weaver.rs` | Контекст AUM+Memory Core, хеш FNV-1a, журнал `memory/log/log-YYYY-MM-DD.jsonl` |
| Secure Store | `src-tauri/src/secure_store.rs` | Локальные секреты, файл 0600 (токен git-доступа и т.п.) |
| Spatial HUD | `ui/` | Три-сцена: Храм-каркас + узлы-сгустки, состояния, слой узла, статус-строки |

## Сборка и запуск

Headless-контур (логика, тесты, CI — без GUI-зависимостей):

```sh
cd src-tauri
cargo test --no-default-features
cargo run --no-default-features --bin mesh-boot
```

Ожидаемый лог:

```
TEMPLE_OK files=5 cache=.cache/temple
CONTEXT_AUM hash=... bytes=...
MEMORY_WEAVER journal=memory/log
MESH_BOOT temple=OK assistants=1
STATE_FILE .../mesh-state.json
```

UI-контур (Tauri 2.x; нужны системные webkit2gtk/gtk на Linux или Android SDK для APK):

```sh
cd src-tauri
cargo tauri dev            # dev-окно
cargo tauri build          # дистрибутив
```

HUD без Tauri (превью сцены в браузере):

```sh
python3 -m http.server 8769 -d .    # из корня kvp-assistant-mesh
# http://127.0.0.1:8769/ui/index.html
# ?demo — авто-выбор узла (показ слоя и KVP_BRIDGE_ACTIVE для скриншота)
```

## Конфигурация

- `config.json` — секции `temple` (repo/branch/refresh/cache/files/journal),
  `assistants` (manifest/limit), `hud` (state_file).
- `assistants.json` — узлы: `id`, `name`, `sigil`, `target`, `model_hint`,
  `channel`, `memory_scope`.
- `mesh-state.json` — состояние узлов для HUD (`pending/idle/active/thinking/error`);
  файл служебный, в git не входит.
- `.cache/`, `src-tauri/target/` — не входят в git; `memory/log/` — память в репо.

## Память

Контекст сессии = `AUM.md` + Memory Core (файл-фолбэк: `COUNSELOR_MEMORY_CORE.md`,
иначе `MEMORY_CORE.md`). Каждый обмен пишется в журнал памяти; `last_line`
узла читается из журнала и попадает в HUD-слой.

Поток 2 замкнут: ввод Архитектора пишется в журнал сразу (prompt), а init-скрипт
живой сессии (`reply_interception_script`) следит за последним ответом
`[data-message-author-role="assistant"]` и шлёт событие `kvp-reply`
(`withGlobalTauri`) — обработчик в `main.rs` дописывает `reply` последней
записи узла (`MEMORY_REPLY id=... bytes=... patched|recorded`).

Своя память ассистента «Родный» (MiMo) — `RODNOY_MEMORY_CORE.md` в корне
репозитория: входит в список `files` коннектора, поэтому тянется и кэшируется
вместе с Храмом.

## Отклонения от ТЗ (среда сборки)

1. **Git-проводник на системном `git` CLI**, а не либа git2: в песочнице нет
   OpenSSL-заголовков и Perl — сборка libgit2 с https невозможна. TLS-часть
   берёт на себя системный git. Поведение (`OK`/`CACHE`, авто-репулл) то же.
2. **`MEMORY_CORE.md` → `COUNSELOR_MEMORY_CORE.md`**: файла `MEMORY_CORE.md`
   в репо нет; коннектор фолбэчится между ними.
3. **Лимит узлов = 1** (`assistants.limit`): раздел 9 фиксирует
   `MESH_BOOT ... assistants=1`; при снятии лимита стартуют все узлы манифеста.
4. GUI-сборку Tauri и APK в этой песочнице выполнить нельзя (нет webkit2gtk/glib,
   Java окружение битое, Android SDK отсутствует) — каркас и headless-контур
   собираются и тестируются здесь, UI собирается на машине с SDK.
5. `cc`/`ld` в песочнице недоступны (PRoot): линковка идёт `clang + ld.lld`
   (настроено в `~/.cargo/config.toml`, в репозиторий не входит).

## Тесты

```sh
cd src-tauri && cargo test --no-default-features
```

- `boot_reads_temple_and_boots_one_node` — боевой pull реального репозитория.
- `boot_falls_back_to_cache_when_network_is_gone` — офлайн-фолбэк на кэш (`CACHE`).
