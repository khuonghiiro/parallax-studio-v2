# Kiến Trúc Layer Gizmo & Xưởng Lắp Ráp 3D (`models3d/`)

Tài liệu đặc tả kiến trúc kỹ thuật, thuật toán hình học và đồng bộ MCP cho hệ thống Gizmo 3D trên khung nhìn chính và Xưởng Lắp Ráp Mô Hình 3D. Xem quy chuẩn tổng quan tại [AGENTS.md](../../AGENTS.md).

---

## 1. Layer Gizmo Implementation (Camera / 3D)

- **Geometry / Projection Helpers:** [`src/renderer/src/engine/layerGizmo.ts`](../../src/renderer/src/engine/layerGizmo.ts)
- **UI Component:** [`src/renderer/src/ui/viewer/LayerGizmo.tsx`](../../src/renderer/src/ui/viewer/LayerGizmo.tsx)
- **Gestures & Drag Logic:** [`src/renderer/src/ui/viewer/gizmoDrag.ts`](../../src/renderer/src/ui/viewer/gizmoDrag.ts)
- **Nguyên tắc tính toán:**
  - Sử dụng ma trận thế giới đã tính toán (`evaluated world matrices`) cho giới hạn khung bao (bounds) và phép chiếu điểm neo (`anchor projection`).
  - Ghi nhận vị trí (`position`) trong hệ tọa độ của cảnh/cha (`shot/parent coordinates`) và tỉ lệ (`scale`) trước bước bù trừ chiều sâu (`depth compensation`).
  - Mỗi thao tác kéo (gesture) chỉ ghi 1 mục lịch sử Undo duy nhất, giữ nguyên hành vi keyframe tại thời điểm hiện tại, hủy an toàn khi bấm `Escape`, và loại trừ các lớp phủ gizmo khỏi luồng xuất video MP4.
- **MCP Parity & Kiểm thử:**
  - Sử dụng các tham số `position`, `rotation`, `scale` của công cụ `update_layer`.
  - Kiểm thử hồi quy: [`src/renderer/src/mcp/commands/layerCommands.test.ts`](../../src/renderer/src/mcp/commands/layerCommands.test.ts).

---

## 2. 3D Assembly Gizmo Implementation (Xưởng Lắp Ráp 3D)

- **UI Component:** [`src/renderer/src/ui/assets/models3d/AssemblyGizmo.tsx`](../../src/renderer/src/ui/assets/models3d/AssemblyGizmo.tsx)
- **Gestures & Drag Logic:** [`src/renderer/src/ui/assets/models3d/assemblyGizmoDrag.ts`](../../src/renderer/src/ui/assets/models3d/assemblyGizmoDrag.ts)
- **Chuẩn tương tác After Effects:**
  - Trục tọa độ 3D XYZ (`Move`), Vòng xoay góc 3D XYZ (`Rotate`) và 8 điểm mút vuông trên Bounding Box (`Scale/Stretch`).
  - Tự động cập nhật thời gian thực theo góc xoay camera / `OrbitControls`.
  - Giữ phím `Shift` để khóa tỉ lệ hoặc xoay theo bước góc 15°; phím `Escape` hủy thao tác đang kéo.
  - Kiểm thử đơn vị: [`src/renderer/src/ui/assets/models3d/assemblyGizmoDrag.test.ts`](../../src/renderer/src/ui/assets/models3d/assemblyGizmoDrag.test.ts).

---

## 3. Xưởng Lắp Ráp 3D – Kiến Trúc Chi Tiết (`models3d/`)

- **Mẫu mesh ảnh (`Image Mesh Templates`):**
  - Mã nguồn: `imageMeshTemplates.ts` (6 mẫu: lá, hoa, chậu, nhà cao tầng, lan can, cỏ), `imageMeshTypes.ts` (slot ảnh, prompt, biến thể), `imageMeshRecipe.ts` (hướng dẫn và gắn ảnh theo slot), `ImageMeshTemplateDetail.tsx` (chọn PNG/biến thể).
  - MCP: `get_assembly_template`, `apply_assembly_template` nhận `variant_id` + `images`; `update_assembly_face` nhận `mesh`/`grid`/`bend`/`depth`.
  - Lịch sử: Xưởng dùng lịch sử bản nháp `useAssemblyHistory`, khi chèn model vào cảnh mới ghi vào lịch sử project.
  - Kiểm thử & Tài liệu: `imageMeshRecipe.test.ts`, `mcp/commands/assemblyImageMesh.test.ts`, [docs/image-mesh-templates.md](../image-mesh-templates.md).

- **Mesh ảnh & Bám pixel (`Silhouette & Contour Mesh`):**
  - Chuỗi xử lý: `silhouette.ts` (marching squares trên padded alpha mask, khử răng cưa với Douglas-Peucker) → `contourMesh.ts` (cắt cell trực tiếp theo polygon silhouette, CCW watertight, không dư cell margin) → `alphaMeshBuilder.ts` (indexed, hàn đỉnh).
  - Editor 2D dùng chung nguồn qua `mesh2dCells.ts`.
  - Kiểm thử: `contourMesh.test.ts`, `alphaMeshBuilder.test.ts`, `silhouette.test.ts`.

- **Vật liệu & Khử bóng loá:**
  - Sử dụng `MeshLambertMaterial` (thuần Lambertian diffuse reflection, triệt tiêu hoàn toàn hiện tượng bóng chói/loá nhựa trên mặt phẳng ngửa lên).
  - Texture được "alpha bleed" và tải lên dưới dạng `DataTexture` straight-alpha (`textureResolver.ts`).

- **Ánh sáng & Nắng đổ bóng:**
  - `assemblyLighting.ts` & `assemblySceneLighting.ts`: điều khiển hướng nắng mặt trời, đổ bóng râm dịu với Three.js `PCFShadowMap` và mặt phẳng bắt bóng `ShadowMaterial`, tự động cân chỉnh tông màu ấm/lạnh theo độ cao mặt trời / thời gian trong ngày.

- **Ghép hít 2 mặt (`Two-point join`):**
  - `assemblyJoin.ts`: chọn điểm `start`/`end` hoặc góc biên cạnh, tự động co giãn cạnh ngắn theo cạnh dài nhất (`longest`) để khít cạnh, triệt tiêu hoàn toàn khe hở.

- **Cắt giao nhau (`Intersection Clipping`):**
  - `assemblyClip.ts` & `assemblyMeshCache.ts`: tự động phát hiện 2 mặt đâm xuyên nhau (như tường nhô qua mái dốc) và gắn Three.js local clipping planes (`material.clippingPlanes`) để ẩn pixel thừa.

- **Khuôn mẫu mô-đun (`Modular Templates`):**
  - Kiểu & helper hình học: `assemblyTemplateKit.ts` (bắt buộc nhãn `en` cho AI, `anchor` cho bộ phận).
  - Danh mục tổng: `assemblyTemplateData.ts`; khung nhà chỉ tường + mái: `assemblyTemplatesShells.ts` (`shell-*`); bộ phận trang trí rời: `assemblyTemplatesDecor.ts` (`decor`: cửa sổ, cửa, ống khói, cột, ban công, bồn hoa, chậu cây…; quy ước `WALL_ANCHOR`: mặt lưng `z = 0`, nhô về `z < 0`).
  - `assemblyTemplates.ts`: `replace` giữ ảnh/id/mesh, `append` đặt cạnh mô hình. Thao tác mặt thuần: `assemblyFaceOps.ts`, hình học: `assemblyGeometry.ts`.
  - Kiểm thử: `assemblyTools.test.ts`, `assemblyTemplatesModular.test.ts`.

- **Ghép mô hình đã lưu (`Model Compose`):**
  - `assemblyCompose.ts` (`appendModel` cạnh/tại điểm, `appendModelOnFace` gắn lên mặt theo UV bằng ma trận mặt chủ; tự khớp tỉ lệ, sinh id mới, ánh xạ `clipBy`), UI `ModelComposePanel.tsx` trong `FaceInspector`, CSS `assemblyCompose.css`.
  - Kiểm thử: `assemblyCompose.test.ts`.

- **Lịch sử, Phím tắt & Preview Sạch:**
  - `useAssemblyHistory.ts`: gộp 450 ms, 1 bước/gesture, `{discrete}` cho thao tác cấu trúc.
  - `useAssemblyShortcuts.ts`: lắng nghe ở capture-phase, chặn phím tắt của ứng dụng chính khi modal đang mở.
  - Scene 3D đọc token CSS qua `assemblyTheme.ts`; khi lưu mô hình tự động chụp ảnh preview 3D sạch (tạm ẩn helpers, trục XYZ, sàn bóng, viền mesh để thu được thumbnail PNG trong suốt vào `thumbnailDataUrl`).

- **MCP Parity cho Xưởng 3D:**
  - Đồng bộ 100% qua `assemblyBridge.ts` kết nối phiên modal trực tiếp với MCP commands ([`src/renderer/src/mcp/commands/assemblyCommands.ts`](../../src/renderer/src/mcp/commands/assemblyCommands.ts)): `list_models3d`, `get_model3d`, `get_assembly_state`, `list_assembly_templates`, `append_assembly_model`, `save_assembly_model`, `insert_assembly_model`, `add_assembly_face`, `update_assembly_face`, `delete_assembly_face`, `join_assembly_faces`, `auto_assembly_clip`, `set_assembly_lighting`, `get_assembly_screenshot`, `set_assembly_camera`, `apply_assembly_template`, `open_assembly_workshop`, `close_assembly_workshop`, `set_assembly_face_image`.
  - Hỗ trợ cả 2 chế độ: Realtime (mở UI cho người dùng xem trực tiếp) và Headless (tạo ngầm tài nguyên trong nền).
  - Kiểm thử: `mcp/commands/assemblyCommands.test.ts`.
