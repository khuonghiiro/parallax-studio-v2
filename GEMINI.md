# GEMINI.md — Quy Chuẩn Kỹ Thuật (Parallax Studio V2)

Xem chi tiết quy chuẩn toàn diện tại file [AGENTS.md](./AGENTS.md).

## Quy Tắc Cốt Lõi Khi Code Trong Workspace Này:
1. **Tuân thủ Modularization:** Giới hạn file <= 1000 dòng (chủ động tách khi >= 500 dòng), hàm <= 80 dòng.
2. **Tách biệt tầng:** Giữ sạch ranh giới giữa `engine/` (Three.js), `ui/` (React), `styles/` (CSS modules), và `mcp-server/`.
3. **Quality Gates:** Luôn kiểm tra tính tương thích TypeScript, chạy `npm test` nếu sửa logic cốt lõi. Không commit secret / API key / file nhạy cảm.
4. **Skills & Rules:** Hệ thống luật và kỹ năng chi tiết nằm trong `.agents/rules/` và `.agents/skills/`.
5. **Quy Chuẩn 2 Theme (Sáng & Tối):** Luôn dùng Design Tokens CSS (`variables.css`). Tuyệt đối không hardcode màu tĩnh, kiểm tra độ tương phản rõ ràng trên cả Dark Mode (`[data-theme='dark']`) và Light Mode (`[data-theme='light']`).
6. **Giao Thức MCP & Kiểm Thử App Trực Tiếp (Bắt buộc không can thiệp tiến trình):** Quản lý kết nối MCP server qua `mcp-server/index.mjs` (TCP:9877) hoặc dùng CLI Controller `pnpm pxs` (`--help`, `review`, `call`, `status`) để AI điều khiển realtime và review cảnh; **tuyệt đối không tự ý kill/tắt tiến trình Electron (`Stop-Process electron`) hay tự bật tiến trình dev ngầm trùng lặp**; luôn kết nối thẳng vào app người dùng đang mở sẵn. Khi sửa `src/renderer/`, Vite tự hot-reload tức thì. Nếu sửa `src/main/` cần restart thì thông báo để người dùng tự khởi động lại từ terminal. Luôn ngắt kết nối hoặc tắt server khi không dùng để tiết kiệm CPU/RAM.
7. **Đồng Bộ Tính Năng & MCP (Feature & MCP Parity Principle):** BẮT BUỘC khi thêm hoặc cập nhật bất kỳ logic nghiệp vụ nào trong ứng dụng (audio, fx, layer, shot, camera...), phải cập nhật song hành MCP commands (`src/renderer/src/mcp/commands/`), MCP server tools (`mcp-server/index.mjs`), CLI catalog (`pnpm pxs`), tool schemas (`~/.gemini/antigravity-ide/mcp/parallax-studio/`) và tài liệu hướng dẫn để AI Agent luôn có khả năng hiểu và điều khiển ứng dụng 100%.
8. **Quy Chuẩn Commit & Push:** Luôn viết commit message bằng **tiếng Việt CÓ DẤU** đầy đủ (chuẩn Conventional Commits: `feat:`, `fix:`, `refactor:`, `perf:`...) để phân biệt rõ nét giữa từ tiếng Việt và thuật ngữ kỹ thuật tiếng Anh. Ngay khi sửa xong một lỗi hoặc hoàn thành nâng cấp một logic/chức năng, chủ động commit và push code lên Git ngay lập tức.

