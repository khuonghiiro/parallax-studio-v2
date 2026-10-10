# Development Rules

Use this file when editing code, tests, scripts, or configuration.

## Baseline

- Follow project docs in `docs/` and existing local patterns.
- Apply KISS and DRY. Deliver the full requested scope — do not trim, defer, or
  simplify away features the user explicitly asked for. Add nothing beyond the
  request. When the user passes `--yagni`, additionally apply YAGNI (You Aren't
  Gonna Need It): challenge and cut any scope not needed for the stated outcome.
- Implement real behavior. Do not add fake data, mocks, or temporary shortcuts just to satisfy a check.
- Keep changes scoped to the request and the affected contracts.
- Use descriptive kebab-case file names for new files when the repo has no stronger convention.
- Split code only when it reduces real complexity or matches existing module boundaries.

## Quality Gates

- Run the narrowest useful test first, then broaden when shared behavior or public contracts changed.
- Do not hide failing tests, lint, type, build, or syntax errors.
- Preserve public contracts unless the change intentionally updates them and the user accepted that scope.
- **Feature & MCP Parity:** Whenever any business logic or application feature is added/updated (e.g. audio, fx, layers, shots), update MCP commands (`src/renderer/src/mcp/commands/`), MCP server tools (`mcp-server/index.mjs`), CLI catalog (`mcp-server/cli.mjs`), and tool schemas (`.gemini/antigravity-ide/mcp/parallax-studio/`) so AI agents maintain full operational parity.
- **Live App Testing & Non-Interference:** Never kill the user's running Electron process (e.g. `Stop-Process electron`, `kill`) or spawn duplicate background dev servers. When the user is running the app, connect directly to port 9877 via MCP (`pnpm pxs status` or `pnpm pxs review --view app`). Vite automatically hot-reloads renderer edits (`src/renderer/*`). If main process changes (`src/main/*`) require a restart, prompt the user to restart from their terminal.
- **Custom UI Controls & Combobox Standard:** Never use native `<select>` or OS popups in app views and modal dialogs (causes freezing, pointer capture issues, and styling breakage in Electron). Always use 60fps custom controls from `src/renderer/src/ui/controls/` (`<Menu>` for action/toolbar menus, `<Select>` from `CustomSelect.tsx` with portal `z-index: 50000` for property panels). Fixed-height toolbars containing dropdowns must maintain `overflow: visible; z-index: 5000;` to prevent popup clipping.
- Keep commits focused and use conventional commit format without AI references.
- Never commit secrets, dotenv files, tokens, private keys, database credentials, or personal data.

## Tooling

- Use `gh` for GitHub operations when needed.
- Use current docs only when the API/tooling may have changed.
- Use relevant skills by reading their descriptions first, then opening only the needed `SKILL.md`.
- Use `/ak:preview` only when a visual explanation will materially help the user understand the change.
