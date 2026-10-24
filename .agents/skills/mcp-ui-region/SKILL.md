---
name: mcp-ui-region
description: Register every new or edited UI surface (dialog, nested modal, panel, card, toolbar, picker) for targeted MCP screenshots in Parallax Studio — data-mcp-region / data-mcp-dialog attributes, UI_REGION_SELECTORS, catalog enum, pnpm mcp:schemas, parity test, visual QA on dark and light themes. Use whenever creating or modifying UI in Parallax Studio.
---

# MCP UI Region — đăng ký vùng chụp cho mọi UI

Mỗi bề mặt UI trong Parallax Studio phải chụp được **riêng** qua `get_app_screenshot(region: ...)` để AI kiểm tra giao diện bằng mắt mà không tốn token chụp cả cửa sổ. Quy chuẩn gốc: [`AGENTS.md` mục 2.5](../../../AGENTS.md).

## Khi nào dùng

- Tạo mới hoặc sửa: dialog, modal, **modal lồng** mở bên trong xưởng/dialog khác, popover, panel, thân tab, card, toolbar, picker.
- Khi người dùng báo lỗi giao diện ở một vùng chưa có region (thêm region trước, rồi chụp để chẩn đoán).
- Khi chụp ra ảnh sai vùng (ví dụ chụp cả Xưởng Lắp Ráp Layer thay vì Studio Mixamo đang mở bên trên).

## Kiến trúc liên quan

| Thành phần | Đường dẫn | Vai trò |
| --- | --- | --- |
| Registry vùng | [`uiRegions.ts`](../../../src/renderer/src/mcp/uiRegions.ts) | `UI_REGION_SELECTORS`, `resolveTargetElement`, `findActiveDialog` |
| Lệnh UI | [`uiCommands.ts`](../../../src/renderer/src/mcp/commands/uiCommands.ts) | Re-export registry, xử lý `get_app_screenshot` |
| Catalog MCP | [`tools-scene.mjs`](../../../mcp-server/catalog/tools-scene.mjs) | `z.enum` của tham số `region` |
| Test parity | [`uiRegions.test.ts`](../../../src/renderer/src/mcp/uiRegions.test.ts) | Quét `src/renderer/src/**/*.tsx`, FAIL nếu thiếu đăng ký |

## Checklist bắt buộc

### 1. Gắn định danh lên phần tử gốc

Cần **cả** class ngữ nghĩa **và** `data-mcp-region`. Modal lồng (mở bên trong dialog/xưởng khác) thêm `data-mcp-dialog` để `findActiveDialog` nhận diện là hộp thoại.

```tsx
// Modal lồng bên trong Xưởng Lắp Ráp Layer
export function MixamoMotionModal({ onClose }: Props) {
  return (
    <div className="lw-mixamo-backdrop" onPointerDown={onClose}>
      <div
        className="lw-mixamo-motion-modal"
        data-mcp-region="layer_assembly_mixamo_studio"
        data-mcp-dialog
        role="dialog"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <aside className="lw-mixamo-sidebar" data-mcp-region="layer_assembly_mixamo_sidebar">…</aside>
        <section className="lw-mixamo-stage" data-mcp-region="layer_assembly_mixamo_stage">…</section>
      </div>
    </div>
  )
}

// Panel / card thường: không cần data-mcp-dialog
<section className="lw-parts-panel" data-mcp-region="layer_assembly_parts">…</section>
```

### 2. Đăng ký trong `UI_REGION_SELECTORS`

```ts
// src/renderer/src/mcp/uiRegions.ts
export const UI_REGION_SELECTORS: Record<string, string[]> = {
  // …
  layer_assembly_mixamo_studio: ['.lw-mixamo-motion-modal'],
  layer_assembly_mixamo_stage: ['.lw-mixamo-stage'],
  layer_assembly_parts: ['.lw-parts-panel'],
}
```

`[data-mcp-region="<ten>"]` luôn được thử tự động làm phương án dự phòng, nhưng **key vẫn bắt buộc có** trong registry.

### 3. Thêm vào enum catalog rồi sinh lại schema

```js
// mcp-server/catalog/tools-scene.mjs — tool get_app_screenshot
region: z.enum([
  'active', 'dialog',
  // …
  'layer_assembly_mixamo_studio', 'layer_assembly_mixamo_stage', 'layer_assembly_parts',
]).optional()
```

```powershell
pnpm mcp:schemas          # sinh lại tool schema Antigravity
pnpm mcp:schemas --check  # (tuỳ chọn) xác nhận schema đã đồng bộ
```

### 4. Chạy test parity

```powershell
pnpm test   # uiRegions.test.ts: mọi data-mcp-region phải có trong registry + enum; key registry == enum
```

### 5. Visual QA trên app đang chạy (cả 2 theme)

Dùng app người dùng đang mở (TCP `127.0.0.1:9877`), **không** mở trình duyệt, **không** kill/spawn Electron.

```powershell
pnpm pxs call set_ui_dialog '{"theme":"dark"}'
pnpm pxs review --view app --region active --out D:\_tmp\active-dark.png
pnpm pxs review --view app --region layer_assembly_mixamo_stage --out D:\_tmp\stage-dark.png
pnpm pxs call set_ui_dialog '{"theme":"light"}'
pnpm pxs review --view app --region active --out D:\_tmp\active-light.png
```

Xem ảnh bằng `view_file`, kiểm tra:
- **Tương phản Hover / Active / Selected (Dark & Light):** chữ luôn sắc nét, không dùng `color: var(--bg-0)` trên nền `--accent`/`--key` (dùng `var(--on-accent)`/`var(--on-key)`), không đặt chữ `#ffffff` trực tiếp lên màu nhấn sáng (`--logic-accent`, `--badge-accent`, `--item-c`) mà phải làm đậm nền bằng `color-mix(in srgb, var(--logic-accent, var(--accent)) 78%, #0f172a)`.
- **Đồng bộ hình học & bo góc Control (`border-radius`):** các button, chip, segmented control, badge đếm số và mốc lộ trình trong cùng thanh/cụm dùng bo góc chữ nhật thống nhất (`var(--radius-sm)` `4px` / `var(--radius)` `5px` / `var(--radius-md)` `6px`), không trộn lẫn nút vuông (`0–2px`), nút bo góc và viên thuốc tròn (`999px`) cạnh nhau.
- **Chống khuất UI & cắt chữ (Anti-Clipping):** không cắt chữ/tiêu đề/ô nhập, không đẩy khuất cụm nút bên phải thanh công cụ (`.deploy-ops` / `⚡ Áp dụng`), không cắt nửa trái nhãn tại `t = 0.0s`, không chồng lấn control (như `.anim2d-rot-stem` và `.anim2d-shot-header`), popup không bị cắt cụt.

### 6. Cập nhật tài liệu

Thêm tên vùng vào danh sách region của [`AGENTS.md` mục 2.4](../../../AGENTS.md) và [`mcp-server/README.md`](../../../mcp-server/README.md) (mục `get_app_screenshot`).

## Đặt tên vùng

- `snake_case`, tiền tố theo khu vực: `layer_assembly_*`, `assembly_*` (xưởng 3D), `audio_studio_*`, `camera_path_*`, `camera_sketch_*`, `export_*`, `perf_*`, `mcp_*`, `inspector_*`, `timeline_*`.
- Tên mô tả nội dung, không mô tả vị trí mơ hồ: `layer_assembly_mixamo_stage` thay vì `layer_assembly_middle`.
- Một tên ↔ một bề mặt; không dùng lại tên cho hai control khác nhau.

## Cách AI chụp

1. Vừa mở dialog/modal bất kỳ → `get_app_screenshot({ region: "active" })`: chụp dialog **nổi trên cùng** (modal lồng thắng xưởng bên dưới). `dialog` cũng chọn dialog trên cùng.
2. Soi control cụ thể → sub-region chính xác (ví dụ `layer_assembly_mixamo_stage`, `layer_assembly_properties`).
3. Chưa có region phù hợp → tạm dùng `selector` CSS, rồi bổ sung region theo checklist.

## Lỗi thường gặp

- **Chụp cả xưởng khi modal lồng đang mở:** thiếu `data-mcp-dialog` trên modal lồng, hoặc dùng `layer_assembly` thay vì `active`.
- **Quên một trong ba nơi** (TSX / registry / enum) → `pnpm test` FAIL; quên `pnpm mcp:schemas` → AI client không thấy giá trị enum mới.
- **Popup/menu bị cắt cụt:** toolbar cố định chiều cao đặt `overflow: hidden/auto`; phải giữ `overflow: visible; position: relative; z-index: 5000` (xem AGENTS.md mục 2.6).
- **Chỉ kiểm tra Dark theme:** màu hardcode bị mất tương phản ở Light; luôn dùng token trong `variables.css` và chụp cả hai theme.
- **Đặt `data-mcp-region` lên phần tử con bị ẩn/0px** → ảnh trống; gắn lên phần tử gốc thực sự hiển thị.
- **Dùng Combobox (`<CustomSelect>`) bên trong Node Canvas có CSS `zoom` hoặc có kéo thả (`pointerdown` drag):** CSS `zoom` làm lệch toạ độ `getBoundingClientRect()` của Portal và sự kiện kéo node chặn click khiến chọn item không ăn. Với các thẻ Node trên canvas, thanh công cụ hoặc tập lựa chọn nhỏ (`<= 5` mục), **bắt buộc** dùng **1-Click Segmented Pills**, **Option Cards** hoặc **Icon Chip Grid**.
- **Nhồi nhét quá nhiều mục dọc trong cột Inspector của Dock dưới cùng (`height < 350px`):** Làm giao diện rối, chật và phải cuộn dài. **Bắt buộc** chia thành các **Segmented Sub-Tabs** gọn gàng (mỗi sub-tab gắn `data-mcp-region` riêng như `workflow_target_binder`, `workflow_action_builder` để chụp kiểm tra từng tab), và dùng **Vertical Icon-Only HUD** cho thanh công cụ nổi trên góc canvas.
