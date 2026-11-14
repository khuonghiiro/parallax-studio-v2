# GEMINI.md — Cầu Nối Quy Chuẩn Kỹ Thuật (Parallax Studio V2)

> **Nguồn quy chuẩn duy nhất (Single Source of Truth):** Mọi quy tắc kỹ thuật, quy trình Git theo session, chuẩn 2 Theme, Responsive 4 Breakpoints, giao thức MCP Dual-Shell và kiến trúc dự án được định nghĩa đầy đủ tại **[AGENTS.md](./AGENTS.md)** (đã được tự động nạp toàn vẹn vào System Rules).

## Chỉ Mục Tra Cứu Nhanh Theo Tác Vụ

1. **Khi sửa code bất kỳ:**
   - Giữ giới hạn file **≤ 1000 dòng** (tách module khi đạt 500–600 dòng), hàm **≤ 80 dòng**.
   - Chạy **`pnpm verify`** + **`pnpm test`** sau mỗi logic. Nếu app đang mở (`127.0.0.1:9877`), kiểm tra `pnpm pxs call ping '{}'` (`rendererReady: true`) và **chụp ảnh toàn màn hình ứng dụng** (`get_app_screenshot` không truyền `region`) xác nhận giao diện lành lặn trước khi commit/push.
   - Commit ngay theo từng logic bằng tiếng Việt có dấu (`[loại] (phạm vi): mô tả...`), chỉ push 1 lần cuối prompt ([branch-management.md](./.agents/skills/ak-git/references/branch-management.md)).

2. **Khi tạo / sửa Giao diện (UI / CSS):**
   - Chỉ dùng CSS Design Tokens trong [`src/renderer/src/styles/variables.css`](./src/renderer/src/styles/variables.css) (cấm dùng class Tailwind, cấm `<select>` native, cấm combobox trên Canvas có zoom/drag).
   - Tuân thủ [responsive-standard.md](./.agents/rules/responsive-standard.md), [mcp-ui-region](./.agents/skills/mcp-ui-region/SKILL.md) và [ai-ui-inspector](./.agents/skills/ai-ui-inspector/SKILL.md).

3. **Khi làm việc với các phân hệ chuyên sâu (đọc tài liệu kiến trúc tương ứng):**
   - **Gizmo 3D & Xưởng Lắp Ráp 3D (`models3d/`):** [docs/architecture/gizmo-and-assembly-3d.md](./docs/architecture/gizmo-and-assembly-3d.md)
   - **Xưởng Lắp Ráp Layer 2.5D, Xương Blender & Atlas:** [docs/architecture/layer-assembly-and-rigging.md](./docs/architecture/layer-assembly-and-rigging.md)
   - **Timeline ⇄ Workflow V2, Nhóm Time Chung & Motion BBox:** [docs/architecture/workflow-v2-and-timeline.md](./docs/architecture/workflow-v2-and-timeline.md)
   - **Manifest Tài Nguyên Động & Kho Tạm Khôi Phục:** [SKILL.md](./.agents/skills/manifest-assets/SKILL.md)
