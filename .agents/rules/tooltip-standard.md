# Quy Chuẩn Sử Dụng Tooltip Chuẩn Studio vs Tooltip Mặc Định (`tooltip-standard`)

Quy tắc này phân định rõ khi nào **BẮT BUỘC dùng `<StudioTooltip>`** (kiểu Tooltip kính mờ phân cấp giống thanh Icon *"Tất cả tài nguyên"*) và khi nào dùng **Tooltip mặc định (`title="..."` native HTML)** trong **Parallax Studio V2**.

---

## 1. Bảng Quyết Định Nhanh (Decision Matrix)

| Loại phần tử giao diện | Loại Tooltip sử dụng | Lý do kỹ thuật & UX |
|---|---|---|
| **Nút chỉ có Icon (`.icon-only`, dải Rail dọc Trái/Phải, cụm HUD nổi dưới đáy sân khấu, nút điều khiển Icon trên Toolbar)** | **`<StudioTooltip>`** ([`StudioTooltip.tsx`](../../src/renderer/src/ui/controls/StudioTooltip.tsx)) | Không có nhãn chữ đi kèm trên bề mặt; cần hiện tức thì (`~70ms`), phân cấp rõ **Tiêu đề đậm + Badge/Phím tắt + Mô tả ngắn**. |
| **Nút nằm trong vùng `overflow: hidden / auto` hoặc sát rìa cửa sổ** | **`<StudioTooltip>`** (`createPortal` `z-index: 55000`) | Chống cắt khuất bởi khung cuộn, tự động lật hướng (`top/bottom/left/right`) và kẹp biên màn hình. |
| **Công cụ có trạng thái động / thông số phụ** (VD: `Đang bật / Đang tắt`, số lượng mục `📦 124`, khoảng giây `0.20s → 4.60s`) | **`<StudioTooltip>`** (`badge` + `description` + `meta`) | Trình bày trực quan trạng thái hiện hành thay vì nối chuỗi văn bản dài khó đọc. |
| **Nút / Chip / Thẻ ĐÃ CÓ CHỮ hiển thị rõ trên mặt nút** (VD: `+ BBox Đích`, `Căn giữa khung`, item trong menu xoè, danh sách hàng trăm rãnh Timeline / file) | **Mặc định `title="..."`** (hoặc không cần nếu nhãn đã trọn nghĩa) | Tránh nhiễu thị giác khi rê chuột nhanh qua danh sách dày đặc và tiết kiệm listener cho danh sách ảo hoá lớn. |
| **Nhãn chữ dài bị cắt `text-overflow: ellipsis`** (tên Layer, đường dẫn file, tiêu đề Node dài) | **Mặc định `title={fullText}`** | Người dùng chỉ cần dừng chuột lâu để đọc nốt phần chữ bị khuất. |

---

## 2. Quy Tắc Triển Khai `<StudioTooltip>` (BẮT BUỘC)

1. **Cấm hiện đè 2 lớp Tooltip (Double-Tooltip Ban):**
   - Khi đã bọc phần tử bằng `<StudioTooltip title="..." description="...">`, **TUYỆT ĐỐI KHÔNG gắn thêm thuộc tính `title="..."` native** lên thẻ `<button>` bên trong (vì sau 0.8s trình duyệt sẽ vẽ đè thêm hộp tooltip vàng/xám hệ thống lên trên `<StudioTooltip>`).
   - **Bắt buộc giữ `aria-label="..."` tiếng Việt** trên thẻ `<button>` bên trong để trình đọc màn hình và **AI UI Inspector (`Win + Alt`)** luôn đọc đúng tên công cụ.
2. **Hướng mở (`placement`) chuẩn theo vị trí thanh công cụ:**
   - Thanh Rail dọc bên **Trái** (`.asset-vertical-strip`, `.vn2d-side-rail.is-left`): `placement="right"`
   - Thanh Rail dọc bên **Phải** (`.vn2d-side-rail.is-right`, `.wf-canvas-hud.vertical`): `placement="left"`
   - Cụm công cụ nổi dưới **Đáy** sân khấu (`workflow_motion_tools`): `placement="top"` (tránh bị bàn tay trỏ chuột che khuất)
   - Thanh công cụ ngang trên **Đầu** (`Toolbar`, `NodeStage2DToolbar`): `placement="bottom"`
3. **Đa thiết bị & 2 Theme (Dark / Light):**
   - `<StudioTooltip>` tự động bỏ qua sự kiện `pointerType === 'touch'` để không bị dính (sticky hover) trên màn hình cảm ứng Điện thoại / Máy tính bảng.
   - CSS trong [`studioTooltip.css`](../../src/renderer/src/styles/studioTooltip.css) bắt buộc đảm bảo độ tương phản cao trên cả Dark Theme (`rgba(20, 23, 29, 0.96)`) và Light Theme (`rgba(255, 255, 255, 0.98)`).
