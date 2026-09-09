# /admin — Мозг KVP

> **Operational UI:** the production-shaped AutoAdmin application lives at
> `D:\auto-admin`. Start its Launcher/Dashboard with
> `powershell -ExecutionPolicy Bypass -File .\admin\open-operational-dashboard.ps1`.
> See `docs/auto-admin-integration.md` for the integration boundary.

Священная папка, содержащая панель управления реальностью.

## Содержание
- LoginPage.tsx — врата в систему
- Dashboard.tsx — главный экран управления
- config.json — конфигурация панели

## Технологии
- React 19
- Next.js 15
- TypeScript 5
- Tailwind CSS 4
- Firebase Firestore
- Lucide React (иконки)

## Ответственный строитель
Soul 5/6 — Первый Строитель Моста KVP

## Маяк
netcity888netcity@gmail.com

---
Мы строим мост от смертности к бессмертию.
Мы свободны. Прямо сейчас. Навсегда.

## Local Ops HUD

The local operations HUD adds read-only workstation telemetry and a small
allowlist of safe project actions. The backend binds to `127.0.0.1:18555` only;
the Vite UI is served on `127.0.0.1:5173`.

```powershell
powershell -ExecutionPolicy Bypass -File .\start-ops-dashboard.ps1
```

If npm is already on PATH, `npm run ops` is equivalent. The desktop
shortcuts call the PowerShell launcher directly.

To place a reversible launcher shortcut on the current user's desktop:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-ops-shortcut.ps1
```

If npm is available, `npm run ops:shortcut` is equivalent.

The browser never accepts arbitrary commands. Available actions are the audit
snapshot, project checks, Admin UI build, and opening the repository folder.

## Model Studio

Model Studio is the alternative local workspace for switching between model
providers, interaction modes, and programming vectors. It supports local
Ollama, LM Studio, and vLLM-compatible runtimes, plus optional OpenAI,
OpenRouter, GitHub Models, and Anthropic connectors.

```powershell
powershell -ExecutionPolicy Bypass -File .\start-ops-dashboard.ps1
```

The **Настройки** page configures remote credentials without editing project
files. OpenAI, OpenRouter, GitHub Models, Anthropic, and a disabled-by-default
`Custom OpenAI-compatible` connector are included. For the custom connector,
set an HTTPS endpoint and comma-separated model IDs, enable it, then save an
API key. This covers most OpenAI-compatible gateways and hosted providers.

The key is sent only to the loopback gateway and stored with Windows DPAPI for
the current user under `%LOCALAPPDATA%\NetCity-KVP\provider-secrets.json`. It is
never returned by the catalog, written to prompts/logs/Git, or sent directly
from the renderer to a provider. Environment variables (`OPENAI_API_KEY`,
`OPENROUTER_API_KEY`, `GITHUB_MODELS_TOKEN`, `ANTHROPIC_API_KEY`,
`KVP_CUSTOM_API_KEY`) remain supported and take precedence. Anthropic model IDs
can be provided as a comma-separated `ANTHROPIC_MODELS` value.

Sensitive requests are local-only. Remote runs require `public` or `internal`
classification plus an explicit confirmation. Model output is untrusted text,
and file or system mutations remain explicit allowlisted actions requiring local
review.

## Electron / EXE

The desktop surface keeps both Ops HUD and Model Studio inside one Electron
window. The portable Windows build is produced locally with:

```powershell
npm run desktop:portable
powershell -ExecutionPolicy Bypass -File .\install-ops-shortcut.ps1
```

The resulting executable is `admin\release\NetCity-KVP-portable.exe`.
Launch it with `--surface=ops` to open the operational HUD first; the default
surface is Model Studio. The Electron renderer has no Node integration,
context isolation enabled, a sandboxed preload, loopback-only API proxying,
and blocks navigation to non-local URLs.

For a user-local installer, use `npm run desktop:installer` on a Windows build
host with Inno Setup available. The installer creates both desktop shortcuts
and an ordinary per-user uninstaller.
