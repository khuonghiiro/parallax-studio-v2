# Bắt buộc tuân thủ quy chuẩn dự án

Trước mọi thay đổi, đọc và tuân thủ 100%:

1. `AGENTS.md` (nguồn quy chuẩn trung tâm) và `GEMINI.md`.
2. Toàn bộ `.agents/rules/*.md` (đường dẫn `./.claude/...` trong rule = `./.agents/...`).
3. Skill phù hợp trong `.agents/skills/<skill>/SKILL.md` trước khi làm (three.js, react, fix, test, git, code-review…).

Tóm tắt không được vi phạm:
- File ≤ 1000 dòng (tách module từ 500–600 dòng), hàm ≤ 80 dòng; tách `engine/` (Three.js) – `ui/` (React) – `styles/` (CSS) – `mcp-server/`.
- CSS chỉ dùng design token trong `variables.css`; kiểm tra cả Dark và Light theme.
- MCP parity: mọi logic mới phải có renderer command + test, tool song ngữ trong `mcp-server/catalog/tools-*.mjs`, cập nhật `guide.json`, chạy `pnpm mcp:schemas`, cập nhật README.
- Kiểm tra `npm run typecheck` + `npx vitest run` trước khi commit.
- Cấm dùng `<select>` native và OS popups (gây treo/lỗi Electron); bắt buộc dùng component 60fps trong `ui/controls/` (`<Menu>`, `<Select>` portal z-index 50000); toolbar chứa menu phải giữ `overflow: visible; z-index: 5000`.
- Biểu tượng icon trong cùng một dải tab (ngang/dọc) bắt buộc duy nhất và đúng ngữ nghĩa; cấm dùng lại icon trùng lặp; phân biệt rõ nam (`IconUserMale`) và nữ (`IconUserFemale`), khối hộp (`IconCube`) và tổng thể 3D (`IconGrid3D`), phòng (`IconArmchair`) và nhà (`IconHome`), đạo cụ (`IconPropLamp`). Thiếu icon phải tạo mới trong `ui/icons.tsx`.
- Commit Conventional Commits bằng **tiếng Việt CÓ DẤU**, không nhắc tên AI; commit + push ngay sau mỗi fix/tính năng. Git hooks `.githooks/` sẽ chặn commit sai chuẩn.
