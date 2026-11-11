# CLAUDE.md — Parallax Studio V2

> Bắt buộc: file này chỉ là cầu nối. **Nguồn quy chuẩn duy nhất là [AGENTS.md](./AGENTS.md)** — đọc và tuân thủ 100% trước khi sửa code.

@AGENTS.md

## Thứ tự nạp bắt buộc (mọi AI: Claude Code, Cursor, Copilot, Windsurf, Cline, Codex, Gemini…)
1. `AGENTS.md` — quy chuẩn trung tâm (modularization, 2 theme, MCP parity, commit tiếng Việt có dấu).
2. `.agents/rules/*.md` — quy tắc chi tiết: `development-rules.md`, `primary-workflow.md`, `orchestration-protocol.md`, `documentation-management.md`, `review-audit-self-decision.md`, `skill-domain-routing.md`, `skill-workflow-routing.md`, `process-management.md`.
3. `.agents/skills/<skill>/SKILL.md` — mở skill phù hợp trước khi làm (ví dụ: `ak-threejs`, `ak-react-best-practices`, `ak-fix`, `ak-test`, `ak-git`, `ak-code-review`). Đường dẫn `./.claude/...` trong các rule được hiểu là `./.agents/...`.

## Cưỡng chế tự động (không thể bỏ qua)
- Git hooks `.githooks/` (bật tự động khi `pnpm install` qua script `prepare`, hoặc `node scripts/agent-guard.mjs install`):
  - `commit-msg`: Chuẩn commit tiếng Việt `[loại] (phạm vi): mô tả` **CÓ DẤU** (ví dụ `[sửa lỗi] (layer): ...`) + cấm nhắc tên AI/watermark.
  - `pre-commit`: kiểm tra cú pháp `esbuild`/JSX của mọi file code staged, file code ≤ 1000 dòng, chặn `.env`/private key/API token.
  - `pre-push`: chạy `node scripts/agent-guard.mjs pre-push` (quét cú pháp `esbuild` toàn bộ dự án + `typecheck`) để chặn đẩy code lỗi lên Git.
- **Git theo session và từng logic:** Mỗi session dùng một nhánh; mỗi logic trong một prompt phải hoàn tất, kiểm tra và commit riêng ngay trước khi làm logic kế tiếp; chỉ push một lần khi hoàn tất toàn bộ prompt. Xác minh ID/lịch sử chat trước khi đổi nhánh: prompt mới, đổi ngày hoặc nén ngữ cảnh không tạo session mới. Chat mới: merge nhánh session cũ vào `master` bằng `--no-ff`, kiểm tra và push `master`, rồi tạo nhánh mới; ngoại lệ người dùng yêu cầu “xử lý tiếp/làm tiếp/continue” thì giữ đúng nhánh cũ. Không đoán nhánh khi thiếu bằng chứng, không tự merge cuối prompt; bảo toàn thay đổi ngoài phạm vi. Tuân thủ quality gates và định dạng commit tiếng Việt tại `AGENTS.md` mục 2.2 và `.agents/skills/ak-git/references/branch-management.md`.
- Sửa logic nghiệp vụ ⇒ cập nhật MCP parity (renderer command + test, `mcp-server/catalog/tools-*.mjs` song ngữ kèm `example`, `guide.json`, `pnpm mcp:schemas`, README) và bắt buộc hỗ trợ đồng thời cả lệnh **PowerShell** (`'{"k":"v"}'`, `'@{k=v}'`, `./pxs.ps1`) lẫn **CMD** (`"{\"k\":\"v\"}"`, `pxs.cmd`) và `--key value` qua `mcp-server/cliParams.mjs` (kiểm thử bởi `mcp-server/catalog/catalog.test.mjs`) để mọi AI tự chọn shell tối ưu nhất.
- UI controls: cấm dùng `<select>` native (treo/lỗi Electron modal); bắt buộc dùng `<Menu>`, `<Select>` (portal z-index 50000); toolbar chứa menu giữ `overflow: visible; z-index: 5000`.
- Đăng ký vùng chụp MCP cho mọi UI mới/sửa (dialog, modal lồng, panel, card, toolbar, picker): phần tử gốc có class ngữ nghĩa + `data-mcp-region="<ten_vung>"` (modal lồng thêm `data-mcp-dialog`); thêm vào `UI_REGION_SELECTORS` (`src/renderer/src/mcp/uiRegions.ts`) và enum `region` của `get_app_screenshot` (`mcp-server/catalog/tools-scene.mjs`); chạy `pnpm mcp:schemas` + `pnpm test` (test parity `uiRegions.test.ts` FAIL nếu thiếu); visual QA bằng `get_app_screenshot(region: "active")` rồi sub-region trên cả Dark & Light. Chi tiết: `.agents/skills/mcp-ui-region/SKILL.md`.
- AI UI Inspector (Win + Shift kéo khung): khi người dùng dán báo cáo `AI UI INSPECTOR`, mở thẳng `file:dòng` trong bảng **Mở ngay** (JSX `data-ai-src` chính xác, component, CSS) thay vì grep dò luồng; khi tạo/sửa UI: dialog/popup gắn `role` + `data-ai-surface="dialog|popup"` + `data-ai-surface-label`, nút icon có `title` + `aria-label`, phần tử bấm không phải button có `role="button"`/`data-ai-id`, không tự viết `data-ai-src` (Babel plugin dev tự gắn). Chi tiết: `.agents/skills/ai-ui-inspector/SKILL.md`.

- AI UI Code Handoff: Win + Ctrl xuất gói UI gọn (rule CSS + đoạn JSX/JS + dòng + quy tắc ngắn); import chỉ đoạn thuộc gói, giữ nguyên code ngoài đoạn, đối chiếu SHA-256, kiểm tra cú pháp và sao lưu. Chi tiết tại AGENTS.md mục AI UI Code Handoff; sửa nguồn không dùng Undo của editor.
