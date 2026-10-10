# CLAUDE.md — Parallax Studio V2

> Bắt buộc: file này chỉ là cầu nối. **Nguồn quy chuẩn duy nhất là [AGENTS.md](./AGENTS.md)** — đọc và tuân thủ 100% trước khi sửa code.

@AGENTS.md

## Thứ tự nạp bắt buộc (mọi AI: Claude Code, Cursor, Copilot, Windsurf, Cline, Codex, Gemini…)
1. `AGENTS.md` — quy chuẩn trung tâm (modularization, 2 theme, MCP parity, commit tiếng Việt có dấu).
2. `.agents/rules/*.md` — quy tắc chi tiết: `development-rules.md`, `primary-workflow.md`, `orchestration-protocol.md`, `documentation-management.md`, `review-audit-self-decision.md`, `skill-domain-routing.md`, `skill-workflow-routing.md`, `process-management.md`.
3. `.agents/skills/<skill>/SKILL.md` — mở skill phù hợp trước khi làm (ví dụ: `ak-threejs`, `ak-react-best-practices`, `ak-fix`, `ak-test`, `ak-git`, `ak-code-review`). Đường dẫn `./.claude/...` trong các rule được hiểu là `./.agents/...`.

## Cưỡng chế tự động (không thể bỏ qua)
- Git hooks `.githooks/` (bật tự động khi `pnpm install` qua script `prepare`, hoặc `node scripts/agent-guard.mjs install`):
  - `commit-msg`: Conventional Commits + **tiếng Việt CÓ DẤU** + cấm nhắc tên AI/watermark.
  - `pre-commit`: file code ≤ 1000 dòng, chặn `.env`/private key/API token.
- Trước khi commit: `npm run typecheck` và `npx vitest run` phải sạch.
- Sửa logic nghiệp vụ ⇒ cập nhật MCP parity (renderer command + test, `mcp-server/catalog/tools-*.mjs` song ngữ, `guide.json`, `pnpm mcp:schemas`, README).
- UI controls: cấm dùng `<select>` native (treo/lỗi Electron modal); bắt buộc dùng `<Menu>`, `<Select>` (portal z-index 50000); toolbar chứa menu giữ `overflow: visible; z-index: 5000`.
