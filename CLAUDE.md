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
  - `pre-commit`: kiểm tra cú pháp `esbuild`/JSX của mọi file code staged, file code ≤ 1000 dòng, chặn `.env`/private key/API token.
  - `pre-push`: chạy `node scripts/agent-guard.mjs pre-push` (quét cú pháp `esbuild` toàn bộ dự án + `typecheck`) để chặn đẩy code lỗi lên Git.
- Sau mỗi lần sửa code: bắt buộc chạy `pnpm verify` (`esbuild` syntax + `typecheck`) và `npx vitest run` phải sạch. **Trước khi commit và push code:** khi app đang chạy, bắt buộc chụp ảnh toàn màn hình ứng dụng 1 lần nữa (`pnpm pxs review --view app`) để kiểm tra chắc chắn không bị đen màn, không có thông báo lỗi hay crash UI, rồi mới commit (tiếng Việt có dấu) và push; không tự động `git push` khi người dùng chưa yêu cầu.
- Sửa logic nghiệp vụ ⇒ cập nhật MCP parity (renderer command + test, `mcp-server/catalog/tools-*.mjs` song ngữ kèm `example`, `guide.json`, `pnpm mcp:schemas`, README) và bắt buộc hỗ trợ đồng thời cả lệnh **PowerShell** (`'{"k":"v"}'`, `'@{k=v}'`, `./pxs.ps1`) lẫn **CMD** (`"{\"k\":\"v\"}"`, `pxs.cmd`) và `--key value` qua `mcp-server/cliParams.mjs` (kiểm thử bởi `mcp-server/catalog/catalog.test.mjs`) để mọi AI tự chọn shell tối ưu nhất.
- UI controls: cấm dùng `<select>` native (treo/lỗi Electron modal); bắt buộc dùng `<Menu>`, `<Select>` (portal z-index 50000); toolbar chứa menu giữ `overflow: visible; z-index: 5000`.
- Đăng ký vùng chụp MCP cho mọi UI mới/sửa (dialog, modal lồng, panel, card, toolbar, picker): phần tử gốc có class ngữ nghĩa + `data-mcp-region="<ten_vung>"` (modal lồng thêm `data-mcp-dialog`); thêm vào `UI_REGION_SELECTORS` (`src/renderer/src/mcp/uiRegions.ts`) và enum `region` của `get_app_screenshot` (`mcp-server/catalog/tools-scene.mjs`); chạy `pnpm mcp:schemas` + `pnpm test` (test parity `uiRegions.test.ts` FAIL nếu thiếu); visual QA bằng `get_app_screenshot(region: "active")` rồi sub-region trên cả Dark & Light. Chi tiết: `.agents/skills/mcp-ui-region/SKILL.md`.
