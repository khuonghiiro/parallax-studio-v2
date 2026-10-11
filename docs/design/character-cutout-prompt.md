# SPEC: Character Cutout Atlas Pipeline (cho Antigravity)

## Mục tiêu
Từ MỘT ảnh atlas 16:9 do model tạo ảnh sinh ra, tự động tách thành các sprite bộ phận trong suốt + file `atlas.json` chứa pivot/parent để dựng rig 2D cutout.

## Phần 1 — Prompt tạo ảnh (dán vào model tạo ảnh)

```
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

## Phần 2 — Việc cho agent
1. Cài `pillow numpy`.
2. Dùng `slice_atlas.py` (đã có trong `scripts/slice_atlas.py`) để xử lý `atlas.png`:
   `python scripts/slice_atlas.py atlas.png --out out/`
3. Kết quả mong đợi:
   - `out/reference.png` — nhân vật hoàn chỉnh (cột 1), đã key nền.
   - `out/parts/<name>.png` — 13 mảnh trong suốt, crop sát bbox.
   - `out/atlas.json` — mỗi mảnh có `size`, `src_rect`, `parent`, `pivot_norm`, `pivot_px`.
4. Viết viewer nhỏ (HTML + canvas hoặc Three.js) đọc `atlas.json`, dựng cây xương theo `parent`, hiển thị nhân vật và cho kéo slider xoay từng khớp để kiểm tra khe hở.
5. (Tùy chọn) Căn vị trí lắp ráp ban đầu bằng template matching từng mảnh vào `reference.png`, ghi thêm `assembled_pos` vào JSON.

## Acceptance criteria
- 13/13 mảnh được tách, không có cảnh báo "chạm mép ô".
- Không còn viền xanh quanh mảnh (đã despill).
- Xoay khuỷu/gối/vai ±45° không lộ khe hở.
- Hierarchy: pelvis (root) → torso → head, arm → forearm → hand; pelvis → thigh → foot.

## Lưu ý
- Nếu model lệch lưới, tăng `PAD`, hoặc đổi sang tách bằng connected components rồi gán mảnh theo thứ tự vị trí.
- Nếu đổi độ phân giải, script tự scale theo tỉ lệ; chỉ cần giữ đúng tỉ lệ cột 30/70 và lưới 5x3.
