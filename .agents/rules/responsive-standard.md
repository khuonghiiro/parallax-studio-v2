# Quy Chuẩn Responsive Đa Thiết Bị (Responsive Multi-Device Standard)

Tài liệu này là quy chuẩn bắt buộc áp dụng khi xây dựng mới hoặc chỉnh sửa bất kỳ thành phần giao diện (UI) nào trong Parallax Studio V2, đảm bảo trải nghiệm đồng nhất và hoàn hảo trên mọi kích thước màn hình từ Điện thoại di động (Phone/Remote), Máy tính bảng (iPad/Tablet), Laptop tới Màn hình máy tính để bàn (Desktop/Ultra-wide).

---

## 1. Hệ Thống 4 Breakpoints Chuẩn (The 4 Core Device Breakpoints)

Ứng dụng Parallax Studio chuẩn hóa theo 4 ngưỡng kích thước được định nghĩa tại `src/renderer/src/ui/primitives/useResponsiveViewport.ts` và `src/renderer/src/styles/responsiveWorkspace.css`:

| Thiết bị | Breakpoint Range | CSS Media Query | Quy cách hiển thị chính |
| :--- | :--- | :--- | :--- |
| **Phone** (Điện thoại / Remote) | `<= 768px` (hoặc cao `<= 520px` khi xoay ngang) | `@media (max-width: 768px)` | Giao diện 1 cột (`1fr`), drawer trượt toàn màn hình, nút bấm cảm ứng lớn, thanh thao tác đáy (Action Strip). |
| **Tablet** (Máy tính bảng / iPad) | `769px – 1120px` | `@media (max-width: 1120px)` | Lưới 2 cột (`minmax(320px, 1fr)`), thanh công cụ thu gọn bớt nhãn chữ, ưu tiên icon + tooltip. |
| **Laptop** (Máy tính xách tay) | `1121px – 1366px` | `@media (max-width: 1366px)` | Lưới 2–3 cột, viewer và timeline cân đối, thanh bên tự động co giãn theo tỷ lệ hợp lý. |
| **Desktop** (Màn hình rộng / 2K / 4K) | `> 1366px` | `@media (min-width: 1367px)` | Lưới 3–4 cột, có giới hạn vùng chứa (`max-width: 1400px–1600px` căn giữa) để chống kéo giãn quá mức. |

---

## 2. Nguyên Tắc Cốt Lõi Khi Thiết Kế & Chỉnh Sửa UI

### 2.1. Triệt Tiêu Hiện Tượng "Sa Mạc Trống Trải" (Anti-Empty Desert Principle)
- **CẤM:** Tuyệt đối không để một danh sách các dòng đơn lẻ trải dài 100% trên màn hình desktop/laptop rộng (1440px – 1920px) khiến nhãn bên trái và cụm nút bấm bên phải bị kéo xa nhau hàng nghìn pixel (khoảng trống vô nghĩa ở giữa làm mỏi mắt và khó thao tác).
- **BẮT BUỘC:** 
  - Các danh sách dạng thẻ (Cards/Workflow/Assets) trên màn hình rộng phải sử dụng lưới Card đa cột tự động co giãn:
    ```css
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 10px;
    ```
  - Trên màn hình nhỏ (`<= 768px`), lưới tự động chuyển về 1 cột (`1fr`).
  - Mỗi Card phải chứa trọn vẹn thông tin và các nút thao tác liên quan trực tiếp của đối tượng đó trong phạm vi hẹp (`340px – 480px`), giúp người dùng quan sát và thao tác tức thì mà không cần đảo mắt khắp màn hình.

### 2.2. Vùng Bấm Cảm Ứng & Công Thái Học (Touch Targets & Ergonomics)
- Trên các chế độ cảm ứng hoặc màn hình di động (`@media (pointer: coarse)` hoặc `breakpoint === 'phone' | 'tablet'`):
  - Kích thước vùng bấm tối thiểu: **`36px × 36px`** (khuyến nghị `40px – 44px` cho các nút chính).
  - Khoảng cách an toàn giữa 2 nút bấm cạnh nhau: tối thiểu **`6px – 8px`** để chống bấm nhầm ngón tay.
  - Các vùng cuộn danh sách cảm ứng phải bật cờ `-webkit-overflow-scrolling: touch;`.

### 2.3. Co Giãn Thanh Công Cụ & Tiêu Đề (Toolbar & Header Resiliency)
- Trên mọi thanh công cụ ngang (Timeline Toolbar, Workflow Toolbar, Viewer Tools...):
  - Cụm bên trái: `flex-shrink: 0`.
  - Cụm trung tâm / bộ chọn: `flex: 1 1 auto; min-width: 0; overflow: hidden;`.
  - Cụm nút hành động bên phải (CTA/Export/Settings): `flex-shrink: 0; margin-left: auto;`.
  - Khi màn hình hẹp, tự động ẩn nhãn chữ phụ và chỉ giữ icon vector (`.btn-txt { display: none }`), hoặc chuyển dải nút dàn ngang thành **Menu dropdown** (như đã chuẩn hóa cho bộ chọn cảnh `Đi tới`).

### 2.4. Tránh Cắt Chữ & Vỡ Khung (Anti-Clipping & Text Ellipsis)
- Mọi văn bản tên đối tượng, nhãn cảnh, đường dẫn phải có:
  ```css
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  ```
- Luôn đặt thuộc tính `title="..."` trên phần tử cha để người dùng vẫn đọc được toàn bộ nội dung khi rê chuột vào văn bản bị rút gọn.

---

## 3. Quy Trình Kiểm Tra Responsive Bắt Buộc (Quality Gate)

Mỗi khi tạo mới hoặc sửa đổi bất kỳ giao diện nào trong ứng dụng:
1. **Kiểm tra trên 2 Theme:** Bắt buộc xem xét trên cả Dark Mode (`[data-theme='dark']`) và Light Mode (`[data-theme='light']`).
2. **Kiểm tra trên 2 Kích Thước Màn Hình:**
   - Màn hình rộng Desktop (mặc định app `1920×1080` hoặc `1440×900`).
   - Màn hình hẹp Mobile/Tablet (`<= 1120px` hoặc `<= 768px`).
3. **Kiểm tra qua MCP Screenshot:**
   - Dùng lệnh `pnpm pxs review --view app --region <ten_vung> --out <path>` để AI tự kiểm tra thị giác: đảm bảo không có khoảng trống rỗng vô lý, các nút bấm nằm gần đối tượng, và giao diện co giãn hài hòa.
