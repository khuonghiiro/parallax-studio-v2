# GEMINI.md — Quy Chuẩn Kỹ Thuật (Parallax Studio V2)

Xem chi tiết quy chuẩn toàn diện tại file [AGENTS.md](./AGENTS.md).

## Quy Tắc Cốt Lõi Khi Code Trong Workspace Này:
1. **Tuân thủ Modularization:** Giới hạn file <= 1000 dòng (chủ động tách khi >= 500 dòng), hàm <= 80 dòng.
2. **Tách biệt tầng:** Giữ sạch ranh giới giữa `engine/` (Three.js), `ui/` (React), `styles/` (CSS modules), và `mcp-server/`.
3. **Quality Gates:** Luôn kiểm tra tính tương thích TypeScript, chạy `npm test` nếu sửa logic cốt lõi. Không commit secret / API key / file nhạy cảm.
4. **Skills & Rules:** Hệ thống luật và kỹ năng chi tiết nằm trong `.agents/rules/` và `.agents/skills/`.
