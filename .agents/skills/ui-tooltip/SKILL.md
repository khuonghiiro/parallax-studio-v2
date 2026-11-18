---
name: ui-tooltip
description: Decide when to use Parallax Studio's rich portal <StudioTooltip> (like the Built-in Asset Bar icon tooltips) vs native HTML title tooltips, prevent double-tooltip overlap, pick optimal 4-way placement, and preserve AI UI Inspector aria-labels across Dark/Light themes and touch devices.
---

# UI Tooltip Skill (`<StudioTooltip>` vs Native `title`)

Sử dụng skill này bất cứ khi nào tạo mới hoặc chỉnh sửa nút bấm, thanh công cụ icon (Icon Toolbar / Vertical Rail / Floating Stage HUD), hoặc nâng cấp trải nghiệm chỉ dẫn công cụ trong **Parallax Studio V2**.

Tham chiếu quy chuẩn đầy đủ tại [`.agents/rules/tooltip-standard.md`](../../rules/tooltip-standard.md).

---

## 1. Khi Nào Dùng `<StudioTooltip>` vs Khi Nào Dùng `title` Mặc Định?

### A. BẮT BUỘC dùng `<StudioTooltip>` (`src/renderer/src/ui/controls/StudioTooltip.tsx`)
Áp dụng cho mọi công cụ cần phản hồi tức thì (~70ms) và phân cấp thị giác rõ ràng như nút **"Tất cả tài nguyên"**:
1. **Mọi nút chỉ có biểu tượng SVG (`icon-only`):** Thanh Rail dọc trái/phải (`BuiltInAssetBar`, `NodeStage2DSideRails`, `LayerWorkshopRightRail`), cụm HUD nổi trên sân khấu (`WorkflowMotionStageTools`, `wf-canvas-hud`), các nút điều khiển phát/zoom/mở rộng chỉ có icon trên thanh công cụ.
2. **Nút nằm trong vùng `overflow: hidden` / `overflow: auto` hoặc sát mép màn hình:** `<StudioTooltip>` render qua `createPortal(..., document.body)` (`position: fixed; z-index: 55000`), tự động lật hướng và kẹp biên trong khung nhìn.
3. **Công cụ cần hiển thị kèm Nhãn trạng thái / Phím tắt (`badge`) hoặc Thông số phụ (`meta`):**
   - Ví dụ: `title="Vòng xoay Gimbal 3D"`, `badge="Đang bật"`, `badgeTone="green"`, `description="Xoay nghiêng BBox đích theo 3 trục X / Y / Z"`.

### B. Dùng Tooltip Mặc Định (`title="..."` native HTML)
Chỉ dùng `title="..."` thuần cho:
1. **Nút / Chip / Mục menu ĐÃ CÓ CHỮ hiển thị trực tiếp** (VD: `+ BBox Đích`, `Lật ngang (Flip X)`, danh sách track trên Timeline, lưới hàng trăm thẻ tài nguyên).
2. **Văn bản dài bị cắt dấu ba chấm (`text-overflow: ellipsis`)** cần xem lại chuỗi gốc khi dừng chuột lâu.

---

## 2. Mẫu Code Chuẩn & Quy Tắc Chống Lỗi (BẮT BUỘC)

```tsx
import { StudioTooltip } from '../controls/StudioTooltip'

<StudioTooltip
  title="Vẽ quỹ đạo tự do"
  badge="Tự do"
  badgeTone="cyan"
  description="Kéo chuột vẽ đường đi bất kỳ và chỉnh cỡ / góc xoay ở BBox đích"
  placement="top"
>
  <button
    type="button"
    aria-label="Vẽ quỹ đạo tự do"
    aria-pressed={isActive}
    onClick={handleFreeDraw}
  >
    <WorkflowMotionIcon name="free_draw" />
  </button>
</StudioTooltip>
```

### 3 Quy tắc kiểm tra trước khi hoàn tất:
1. **Xoá `title` native trên phần tử con bên trong `<StudioTooltip>`:** Tuyệt đối không để cả `<StudioTooltip>` lẫn `title="..."` cùng tồn tại làm hiện đè 2 hộp tooltip chồng nhau.
2. **Luôn giữ `aria-label` tiếng Việt trên `<button>`:** Để `AI UI Inspector (Win + Alt)` và accessibility đọc chính xác tên nút.
3. **Chọn đúng `placement`:**
   - Rail trái → `"right"` | Rail phải → `"left"` | HUD đáy sân khấu → `"top"` | Thanh công cụ đỉnh → `"bottom"`.
