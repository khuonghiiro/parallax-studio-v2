# Quy Trình Tách Atlas Nhân Vật 13 Lớp & Nạp Vào Xưởng Lắp Ráp Layer (Parallax Studio)

Tài liệu này quy chuẩn luồng tạo ảnh bằng AI, tự động bóc tách sprite bộ phận và nạp trực tiếp vào **Xưởng Lắp Ráp Layer (Layer Assembly Workshop)** có gắn sẵn hệ thống xương và chuyển động mẫu trong **Parallax Studio**.

---

## 1. Mục Tiêu & Kiến Trúc Tích Hợp

Khác với các công cụ kiểm tra đồ họa rời rạc bên ngoài, trong Parallax Studio:
- **Ảnh Atlas 16:9** do AI sinh ra gồm 2 cột:
  - **Cột 1 (30% bên trái):** Nhân vật hoàn chỉnh (Reference) để làm mốc tỷ lệ và đối chiếu visual QA.
  - **Cột 2 (70% bên phải):** Lưới 5 cột × 3 hàng (15 ô) chứa đúng **13 bộ phận rời** trên phông xanh lá `#00FF00` (2 ô cuối để trống).
- **Kết quả đích đến:** Tự động tách 13 mảnh PNG trong suốt, khử sạch ám xanh (despill), và **nạp trực tiếp vào Xưởng Lắp Ráp Layer** của Parallax Studio:
  - Ánh xạ chính xác vào template **"Nhân vật 13 lớp — Bàn tay & Bàn chân riêng"** (`tmpl-character-articulated-13`).
  - Tự động gắn sẵn **13 xương humanoid** (`bones` phân cấp: `pelvis` làm gốc → `torso` → `head` & 2 tay; `pelvis` → 2 chân).
  - Tự động kế thừa các **hoạt cảnh chuyển động mẫu** (`clips`: `clip-idle` Đứng thở, `clip-wave` Vẫy bàn tay).
  - Cho phép người dùng và AI xem nhân vật cử động 60fps ngay trên giao diện xưởng (2D & 3D), tinh chỉnh vị trí/pivot và chèn vào phân cảnh video 2.5D.

---

## 2. Prompt Tạo Ảnh Chuẩn 16:9 (Dán vào Model Tạo Ảnh AI)

Sao chép prompt bên dưới và dán vào model tạo ảnh (Flux, Midjourney v6, DALL-E 3, Recraft...):

```text
Create ONE 16:9 character model sheet, 3840x2160 PNG, opaque flat green #00FF00 background.
Hand-drawn 2D cartoon animation style (like a character design sheet for an animated film):
clean bold outlines, flat cel-shaded colors, no gradients, no cast shadows, no text, no labels, no grid lines.

LAYOUT: split into 2 columns.
- COLUMN 1 (left, ~30% width, x 0–1140): the COMPLETE assembled character, standing, FRONT orthographic view,
  straight relaxed limbs, centered vertically with padding. This is the reference for how the parts fit together.
- COLUMN 2 (right, ~70% width, x 1140–3840): a strict 5 columns x 3 rows grid (15 cells, each 540x720 px),
  numbered 1–15 left-to-right, top-to-bottom. One isolated part per cell.

CHARACTER: adult, blue shirt, dark trousers, dark shoes, belt, short hair.

COLUMN 2 CELL ASSIGNMENTS:
1 head with hair | 2 shirt torso | 3 pelvis and belt | 4 screen-left upper arm | 5 screen-left forearm (no hand)
6 screen-left hand | 7 screen-right upper arm | 8 screen-right forearm (no hand) | 9 screen-right hand | 10 screen-left whole leg (no foot)
11 screen-left shoe and foot | 12 screen-right whole leg (no foot) | 13 screen-right shoe and foot | 14 EMPTY | 15 EMPTY
Empty cells contain only the green background.

RULES:
- Parts in column 2 must be IDENTICAL in design, color and scale to the character in column 1 (same pixel scale, same orthographic front view).
- Do NOT resize parts to fill cells. Keep each part fully inside its cell with padding. Parts must not touch cell edges or each other.
- Left/right follow screen positions, not anatomical.
- Add rounded hidden joint overlaps of 10–15% at shoulder, elbow, wrist, hip, knee, ankle, neck, waist.
- Combined parts stay in ONE cutout. Do not duplicate hands or feet. Keep head and hair together.
- No green in the character itself (avoid green-tinted outlines or highlights).
```

---

## 3. Nguyên Lý Pivot & Tọa Độ Theo Tỷ Lệ Ảnh

> [!IMPORTANT]
> **Không thể cố định Pivot và Tọa độ bằng số pixel tuyệt đối:**
> - Mỗi model AI tạo ảnh có thể xuất ra kích thước khác nhau (1024×576, 1920×1080, 3840×2160...).
> - Dáng người, độ dài chi tiết (tay áo cộc, cẳng tay, ống quần, giày) của mỗi nhân vật do AI vẽ sẽ có tỷ lệ giải phẫu khác nhau đôi chút.

Vì vậy, hệ thống áp dụng cơ chế **Chuẩn hóa theo Tỷ lệ (Normalized Proportions)**:
1. **Pivot tương đối:** Thiết lập theo hệ số chuẩn hóa `pivot_norm: [x_ratio, y_ratio]` (ví dụ: khớp cổ nằm ở `[0.5, 0.88]` của đầu; khớp vai nằm ở `[0.5, 0.15]` của bắp tay; khớp cổ chân nằm ở `[0.5, 0.25]` của giày).
2. **Khung lắp ráp chuẩn:** Template `tmpl-character-articulated-13` trong Xưởng Layer đã có sẵn khoảng cách transform tương đối giữa các khớp xương người:
   - Đầu (`head`): Z: -15px, Y: -115px (nối vào xương thân).
   - Thân (`torso`): Z: -5px, Y: -39px (nối vào xương hông).
   - Hông (`pelvis`): Z: -10px, Y: +30px (gốc tọa độ root).
   - Tay trái (`arm-l`, `forearm-l`, `hand-l`): Z: -12px đến -16px, X âm.
   - Tay phải (`arm-r`, `forearm-r`, `hand-r`): Z: -12px đến -16px, X dương.
   - Hai chân (`thigh-l`, `thigh-r`) & Giày (`foot-l`, `foot-r`): Z: +5px và -2px, Y dương hướng xuống đất.
3. **Tinh chỉnh trực tiếp 60fps trên Xưởng Layer:**
   - Sau khi nạp, nếu model AI vẽ tay/chân dài ngắn khác template, người dùng hoặc AI có thể:
     - Dùng chuột kéo di chuyển từng layer trên khung 2D hoặc 3D.
     - Điều chỉnh nhanh trên thanh tra thuộc tính (Inspector): `Tọa độ 2D (X, Y)`, `Khoảng cách Z`, `Tỉ lệ (Scale)`, `Góc xoay 3D`.
     - Sử dụng ảnh **Reference (Cột 1)** đặt làm nền đối chiếu để căn chỉnh khít 100%.

---

## 4. Tự Động Hóa Qua Script `slice_atlas.py`

Ứng dụng cung cấp sẵn công cụ [`scripts/slice_atlas.py`](../../scripts/slice_atlas.py) tự động thực hiện toàn bộ pipeline:

```bash
# 1. Tách ảnh và tự động nạp thẳng vào Xưởng Lắp Ráp Layer trong app:
python scripts/slice_atlas.py path/to/atlas.png --apply

# 2. Hoặc chỉ tách ảnh ra thư mục (mặc định out/):
python scripts/slice_atlas.py path/to/atlas.png --out out/
```

### Các tính năng tự động:
- **Khử ám xanh (Despill) triệt để:** Ép kênh Green ở các viền bán trong suốt xuống `max(Red, Blue)`, triệt tiêu hoàn toàn viền xanh ám quanh rìa da, tóc và áo.
- **Tự khắc phục độ lệch lưới (Connected Components):** Nếu model AI vẽ lệch nhẹ khỏi ranh giới ô lưới, script tự động kích hoạt thuật toán phân đoạn thành phần liên thông, bóc tách chính xác 100% 13 mảnh nguyên vẹn mà **không bao giờ bị chạm mép ô**.
- **Tự tạo cấu trúc LayerComposite:** Xuất file `character.composite.json` gồm 13 layers, gắn đúng xương và 2 chuyển động mẫu (`clip-idle`, `clip-wave`).
- **Nạp trực tiếp qua TCP (cờ `--apply`):** Kết nối thẳng vào app Parallax Studio đang chạy (`127.0.0.1:9877`), tự xác thực qua `mcp.json` và mở ngay nhân vật lên màn hình Xưởng Lắp Ráp Layer trước mắt người dùng.

---

## 5. Quy Chuẩn Ánh Xạ Màn Hình & Khớp Ẩn (Bắt Buộc)

### 5.1. Quy ước Trái/Phải theo Màn Hình (Screen Positions)
- **Screen-left (Trái màn hình):** Bên tay/chân ở phía bên trái người nhìn (ứng với tọa độ X âm trên canvas, ID `arm-l`, `forearm-l`, `hand-l`, `thigh-l`, `foot-l`).
- **Screen-right (Phải màn hình):** Bên tay/chân ở phía bên phải người nhìn (ứng với tọa độ X dương trên canvas, ID `arm-r`, `forearm-r`, `hand-r`, `thigh-r`, `foot-r`).
- Tuyệt đối không dùng khái niệm giải phẫu cơ thể trong prompt để tránh model AI đảo ngược vị trí hai tay và hai chân.

### 5.2. Khớp ẩn bo tròn (Joint Overlaps 10–15%)
- Khi vẽ cẳng tay, bàn tay, bắp tay, đùi và bàn chân, tại các điểm nối khớp (vai, khuỷu, cổ tay, háng, cổ chân) bắt buộc phải có phần đệm bo tròn dư ra 10–15%.
- Phần dư này sẽ chui vào bên dưới layer cha (hoặc nằm đè lên), bảo đảm khi nhân vật cử động xoay góc ±45° (vẫy tay, bước đi, co gối) không bao giờ bị lộ khe hở đứt rời cơ thể.
