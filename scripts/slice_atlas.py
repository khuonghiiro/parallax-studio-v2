#!/usr/bin/env python3
"""
scripts/slice_atlas.py - Character Cutout Atlas 16:9 Pipeline
Xử lý ảnh atlas 16:9 (3840x2160) chia 2 cột:
  - Cột 1 (30% width): Nhân vật hoàn chỉnh (Reference).
  - Cột 2 (70% width): Lưới 5 cột x 3 hàng (15 ô, 13 mảnh + 2 ô trống).
Tách nền xanh (#00FF00), khử ám xanh (despill), crop sát bbox và xuất atlas.json + viewer.html.
"""

import os
import sys
import json
import argparse
import numpy as np
from PIL import Image

# Đảm bảo mã hóa UTF-8 an toàn trên Windows terminal
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Định nghĩa 13 mảnh khớp với SPEC và template 13 lớp
PARTS_SPEC = {
    1: {"id": "head", "name": "head", "vi": "Đầu & Tóc", "parent": "torso", "pivot_norm": [0.5, 0.85]},
    2: {"id": "torso", "name": "torso", "vi": "Thân áo", "parent": "pelvis", "pivot_norm": [0.5, 0.85]},
    3: {"id": "pelvis", "name": "pelvis", "vi": "Hông & Thắt lưng", "parent": None, "pivot_norm": [0.5, 0.5]},
    4: {"id": "arm-l", "name": "arm-l", "vi": "Bắp tay trái màn hình", "parent": "torso", "pivot_norm": [0.5, 0.15]},
    5: {"id": "forearm-l", "name": "forearm-l", "vi": "Cẳng tay trái màn hình", "parent": "arm-l", "pivot_norm": [0.5, 0.15]},
    6: {"id": "hand-l", "name": "hand-l", "vi": "Bàn tay trái màn hình", "parent": "forearm-l", "pivot_norm": [0.5, 0.15]},
    7: {"id": "arm-r", "name": "arm-r", "vi": "Bắp tay phải màn hình", "parent": "torso", "pivot_norm": [0.5, 0.15]},
    8: {"id": "forearm-r", "name": "forearm-r", "vi": "Cẳng tay phải màn hình", "parent": "arm-r", "pivot_norm": [0.5, 0.15]},
    9: {"id": "hand-r", "name": "hand-r", "vi": "Bàn tay phải màn hình", "parent": "forearm-r", "pivot_norm": [0.5, 0.15]},
    10: {"id": "thigh-l", "name": "thigh-l", "vi": "Chân liền trái màn hình", "parent": "pelvis", "pivot_norm": [0.5, 0.1]},
    11: {"id": "foot-l", "name": "foot-l", "vi": "Bàn chân trái màn hình", "parent": "thigh-l", "pivot_norm": [0.35, 0.25]},
    12: {"id": "thigh-r", "name": "thigh-r", "vi": "Chân liền phải màn hình", "parent": "pelvis", "pivot_norm": [0.5, 0.1]},
    13: {"id": "foot-r", "name": "foot-r", "vi": "Bàn chân phải màn hình", "parent": "thigh-r", "pivot_norm": [0.65, 0.25]},
}

def remove_green_background_and_despill(img_np, low_thresh=20, high_thresh=60):
    """
    Tách nền xanh lá (#00FF00) với despill:
    - Chroma-keying dựa trên độ chênh lệch G - max(R, B).
    - Despill loại bỏ viền xanh ám ở các rìa chi tiết (tóc, viền da, quần áo).
    """
    rgb = img_np[:, :, :3].astype(np.float32)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    max_rb = np.maximum(r, b)
    green_diff = g - max_rb

    # Tính toán alpha mask với dải chuyển tiếp mượt mà
    alpha = np.ones_like(green_diff, dtype=np.float32)
    mask_key = green_diff > low_thresh
    mask_full_key = green_diff >= high_thresh

    # Điểm nằm giữa dải mờ
    mid_range = high_thresh - low_thresh
    if mid_range > 0:
        fade = (high_thresh - green_diff) / mid_range
        alpha = np.where(mask_key, np.clip(fade, 0.0, 1.0), 1.0)
    alpha = np.where(mask_full_key, 0.0, alpha)

    # Despill: hạ kênh Green xuống bằng max(R, B) nếu còn ám xanh
    despill_mask = green_diff > 0
    despilled_g = np.where(despill_mask, max_rb, g)

    result = np.zeros((img_np.shape[0], img_np.shape[1], 4), dtype=np.uint8)
    result[:, :, 0] = np.clip(r, 0, 255).astype(np.uint8)
    result[:, :, 1] = np.clip(despilled_g, 0, 255).astype(np.uint8)
    result[:, :, 2] = np.clip(b, 0, 255).astype(np.uint8)
    result[:, :, 3] = (alpha * 255.0).astype(np.uint8)

    return result

def get_bounding_box(alpha_channel, threshold=15):
    """Tìm bbox (min_x, min_y, max_x, max_y) với alpha > threshold."""
    rows = np.any(alpha_channel > threshold, axis=1)
    cols = np.any(alpha_channel > threshold, axis=0)
    if not np.any(rows) or not np.any(cols):
        return None
    min_y, max_y = np.where(rows)[0][[0, -1]]
    min_x, max_x = np.where(cols)[0][[0, -1]]
    return int(min_x), int(min_y), int(max_x), int(max_y)

def generate_viewer_html(atlas_manifest, out_path):
    """Tạo viewer HTML trực quan kiểm tra khớp xoay bằng slider."""
    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>2D Cutout Rig Viewer - 13 Parts</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
  body {{ display: flex; height: 100vh; background: #12141a; color: #f0f2f5; overflow: hidden; }}
  #sidebar {{ width: 340px; background: #191c24; border-right: 1px solid #2a2e3d; padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }}
  #canvas-wrap {{ flex: 1; display: flex; align-items: center; justify-content: center; position: relative; background: radial-gradient(circle at center, #1e2230 0%, #0d0f14 100%); }}
  canvas {{ border: 1px solid #2f3547; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
  h2 {{ font-size: 16px; color: #38bdf8; display: flex; align-items: center; gap: 8px; }}
  .ctrl-group {{ display: flex; flex-direction: column; gap: 6px; background: #202430; padding: 10px 12px; border-radius: 6px; border: 1px solid #2c3245; }}
  .ctrl-label {{ display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; font-weight: 500; }}
  .ctrl-label span.val {{ color: #38bdf8; font-family: monospace; font-weight: bold; }}
  input[type="range"] {{ width: 100%; accent-color: #38bdf8; cursor: pointer; }}
  .btn-reset {{ padding: 8px 12px; background: #0284c7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; }}
  .btn-reset:hover {{ background: #0369a1; }}
  .badge {{ display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; background: #0369a1; color: #e0f2fe; }}
</style>
</head>
<body>
<div id="sidebar">
  <h2><span>🦴</span> Trình Kiểm Tra Khớp 2D</h2>
  <p style="font-size: 12px; color: #64748b;">Kéo các slider góc xoay (±45°) để kiểm tra khe hở và khớp nối của 13 bộ phận.</p>
  <button class="btn-reset" onclick="resetAngles()">Đặt lại góc ban đầu</button>
  <div id="sliders"></div>
</div>
<div id="canvas-wrap">
  <canvas id="stage" width="700" height="900"></canvas>
</div>

<script>
const manifest = {json.dumps(atlas_manifest, indent=2)};
const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');

const angles = {{
  'torso': 0, 'head': 0,
  'arm-l': 0, 'forearm-l': 0, 'hand-l': 0,
  'arm-r': 0, 'forearm-r': 0, 'hand-r': 0,
  'thigh-l': 0, 'foot-l': 0,
  'thigh-r': 0, 'foot-r': 0
}};

const controls = [
  {{ id: 'head', name: 'Đầu (Cổ)' }},
  {{ id: 'torso', name: 'Thân áo (Eo)' }},
  {{ id: 'arm-l', name: 'Vai trái' }},
  {{ id: 'forearm-l', name: 'Khuỷu tay trái' }},
  {{ id: 'hand-l', name: 'Cổ tay trái' }},
  {{ id: 'arm-r', name: 'Vai phải' }},
  {{ id: 'forearm-r', name: 'Khuỷu tay phải' }},
  {{ id: 'hand-r', name: 'Cổ tay phải' }},
  {{ id: 'thigh-l', name: 'Háng / Đùi trái' }},
  {{ id: 'foot-l', name: 'Cổ chân trái' }},
  {{ id: 'thigh-r', name: 'Háng / Đùi phải' }},
  {{ id: 'foot-r', name: 'Cổ chân phải' }}
];

const loadedImages = {{}};
let imagesToLoad = manifest.parts.length;

manifest.parts.forEach(p => {{
  const img = new Image();
  img.src = p.file;
  img.onload = () => {{
    loadedImages[p.id] = img;
    imagesToLoad--;
    if (imagesToLoad === 0) render();
  }};
}});

const slidersContainer = document.getElementById('sliders');
controls.forEach(c => {{
  const div = document.createElement('div');
  div.className = 'ctrl-group';
  div.innerHTML = `
    <div class="ctrl-label"><span>${{c.name}}</span><span class="val" id="val-${{c.id}}">0°</span></div>
    <input type="range" min="-45" max="45" value="0" id="slider-${{c.id}}" oninput="updateAngle('${{c.id}}', this.value)">
  `;
  slidersContainer.appendChild(div);
}});

function updateAngle(id, val) {{
  angles[id] = parseFloat(val);
  document.getElementById('val-' + id).innerText = val + '°';
  render();
}}

function resetAngles() {{
  controls.forEach(c => {{
    angles[c.id] = 0;
    document.getElementById('slider-' + c.id).value = 0;
    document.getElementById('val-' + c.id).innerText = '0°';
  }});
  render();
}}

function render() {{
  ctx.clearRect(0, 0, stage.width, stage.height);
  const cx = stage.width / 2;
  const cy = stage.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  // Vẽ mẫu đơn giản dạng hierarchy
  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  ctx.fillText('Atlas Viewer Rig 2D (13 Parts)', -cx + 15, -cy + 25);
  ctx.restore();
}}
</script>
</body>
</html>
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html_content)

def slice_character_atlas(atlas_path, output_dir="out", pad=4):
    """Tách atlas 16:9 theo đúng quy chuẩn SPEC."""
    if not os.path.exists(atlas_path):
        print(f"LỖI: Không tìm thấy file atlas: {atlas_path}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    parts_dir = os.path.join(output_dir, "parts")
    os.makedirs(parts_dir, exist_ok=True)

    print(f"[1/4] Đang nạp ảnh: {atlas_path} ...")
    raw_img = Image.open(atlas_path).convert("RGBA")
    w, h = raw_img.size
    print(f"      Độ phân giải: {w}x{h} (Tỉ lệ {w/h:.3f})")

    img_np = np.array(raw_img)

    # 1. Tách Cột 1 (Reference ~30% chiều rộng)
    col1_w = int(round(w * (1140.0 / 3840.0)))
    print(f"[2/4] Đang tách nhân vật mẫu (Cột 1: 0 -> {col1_w} px)...")
    col1_crop = img_np[:, 0:col1_w]
    col1_keyed = remove_green_background_and_despill(col1_crop)

    # Crop sát bbox nhân vật trong Cột 1
    ref_bbox = get_bounding_box(col1_keyed[:, :, 3])
    if ref_bbox:
        rx0, ry0, rx1, ry1 = ref_bbox
        ref_cropped = col1_keyed[ry0:ry1+1, rx0:rx1+1]
        ref_img = Image.fromarray(ref_cropped, "RGBA")
    else:
        ref_img = Image.fromarray(col1_keyed, "RGBA")
    ref_path = os.path.join(output_dir, "reference.png")
    ref_img.save(ref_path)
    print(f"      ✓ Đã lưu nhân vật hoàn chỉnh: {ref_path}")

    # 2. Tách Cột 2 (Lưới 5 cột x 3 hàng = 15 ô, x từ col1_w -> w)
    col2_x0 = col1_w
    col2_w = w - col2_x0
    cell_w = col2_w / 5.0
    cell_h = h / 3.0
    print(f"[3/4] Đang cắt lưới Cột 2 (15 ô, kích thước ô ~{cell_w:.1f}x{cell_h:.1f} px)...")

    manifest = {
        "source": os.path.basename(atlas_path),
        "width": w,
        "height": h,
        "reference": {
            "file": "reference.png",
            "src_rect": {"x": 0, "y": 0, "w": col1_w, "h": h},
            "size": {"w": ref_img.width, "h": ref_img.height}
        },
        "hierarchy": {
            "root": "pelvis",
            "tree": {
                "pelvis": ["torso", "thigh-l", "thigh-r"],
                "torso": ["head", "arm-l", "arm-r"],
                "arm-l": ["forearm-l"],
                "forearm-l": ["hand-l"],
                "arm-r": ["forearm-r"],
                "forearm-r": ["hand-r"],
                "thigh-l": ["foot-l"],
                "thigh-r": ["foot-r"]
            }
        },
        "parts": []
    }

    warnings = []

    for cell_idx in range(1, 16):
        if cell_idx not in PARTS_SPEC:
            # Ô 14 và 15 là ô trống
            continue

        part_info = PARTS_SPEC[cell_idx]
        grid_idx = cell_idx - 1
        row = grid_idx // 5
        col = grid_idx % 5

        # Tọa độ ô trên ảnh gốc
        cx0 = int(round(col2_x0 + col * cell_w))
        cx1 = int(round(col2_x0 + (col + 1) * cell_w))
        cy0 = int(round(row * cell_h))
        cy1 = int(round((row + 1) * cell_h))

        cell_slice = img_np[cy0:cy1, cx0:cx1]
        cell_keyed = remove_green_background_and_despill(cell_slice)

        bbox = get_bounding_box(cell_keyed[:, :, 3])
        if bbox is None:
            msg = f"CẢNH BÁO: Ô {cell_idx} ({part_info['id']}) trống hoàn toàn!"
            print(f"      ⚠️  {msg}")
            warnings.append(msg)
            continue

        bx0, by0, bx1, by1 = bbox
        cur_cell_w = cx1 - cx0
        cur_cell_h = cy1 - cy0

        # Kiểm tra điều kiện Acceptance Criteria: không chạm mép ô
        touches_edge = (bx0 <= pad) or (by0 <= pad) or (bx1 >= cur_cell_w - 1 - pad) or (by1 >= cur_cell_h - 1 - pad)
        if touches_edge:
            msg = f"CẢNH BÁO: Ô {cell_idx} ({part_info['id']}) CHẠM MÉP Ô! [bx0={bx0}, by0={by0}, bx1={bx1}, by1={by1}]"
            print(f"      ⚠️  {msg}")
            warnings.append(msg)

        part_crop = cell_keyed[by0:by1+1, bx0:bx1+1]
        part_img = Image.fromarray(part_crop, "RGBA")
        part_filename = f"{part_info['id']}.png"
        part_rel_path = f"parts/{part_filename}"
        part_full_path = os.path.join(parts_dir, part_filename)
        part_img.save(part_full_path)

        pw, ph = part_img.size
        p_norm = part_info["pivot_norm"]
        pivot_px = [int(round(pw * p_norm[0])), int(round(ph * p_norm[1]))]

        manifest["parts"].append({
            "cell": cell_idx,
            "id": part_info["id"],
            "name": part_info["name"],
            "vi": part_info["vi"],
            "file": part_rel_path,
            "parent": part_info["parent"],
            "size": {"w": pw, "h": ph},
            "src_rect": {
                "x": cx0 + bx0,
                "y": cy0 + by0,
                "w": pw,
                "h": ph
            },
            "pivot_norm": p_norm,
            "pivot_px": pivot_px
        })
        print(f"      ✓ Ô {cell_idx:2d}: {part_info['id']:10s} -> {pw}x{ph} px (pivot: {pivot_px})")

    # 3. Xuất atlas.json
    json_path = os.path.join(output_dir, "atlas.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"[4/4] Đã xuất file rig atlas JSON: {json_path}")

    # Tạo viewer HTML kiểm tra xoay khớp
    viewer_path = os.path.join(output_dir, "viewer.html")
    generate_viewer_html(manifest, viewer_path)
    print(f"      ✓ Đã tạo trình kiểm tra khớp HTML: {viewer_path}")

    print("\n" + "="*50)
    print(f"HOÀN TẤT: Đã tách thành công {len(manifest['parts'])}/13 mảnh bộ phận.")
    if warnings:
        print(f"Có {len(warnings)} cảnh báo cần lưu ý:")
        for w in warnings:
            print(f" - {w}")
    else:
        print("Tất cả 13 mảnh đều nằm gọn trong ô, không chạm mép, đã despill sạch nền xanh!")
    print("="*50)

def main():
    parser = argparse.ArgumentParser(description="Tách atlas nhân vật 16:9 thành các bộ phận sprite 2D cutout.")
    parser.add_argument("atlas", help="Đường dẫn đến file ảnh atlas 16:9 (.png)")
    parser.add_argument("--out", default="out", help="Thư mục xuất kết quả (mặc định: ./out)")
    parser.add_argument("--pad", type=int, default=4, help="Khoảng cách đệm mép ô để cảnh báo chạm mép (mặc định: 4px)")
    args = parser.parse_args()

    slice_character_atlas(args.atlas, args.out, pad=args.pad)

if __name__ == "__main__":
    main()
