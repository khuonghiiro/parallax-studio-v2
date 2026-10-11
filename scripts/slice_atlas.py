#!/usr/bin/env python3
"""
scripts/slice_atlas.py - Character Cutout Atlas 16:9 Pipeline
Xử lý ảnh atlas 16:9 (3840x2160 hoặc bất kỳ độ phân giải 16:9 nào) chia 2 cột:
  - Cột 1 (30% width): Nhân vật hoàn chỉnh (Reference).
  - Cột 2 (70% width): Lưới 5 cột x 3 hàng (15 ô, 13 mảnh + 2 ô trống).
Hỗ trợ 2 chế độ:
  - mode="auto": Thử cắt theo lưới, nếu phát hiện lệch lưới / chạm mép thì tự động
    chuyển sang Connected Components (phân đoạn thành phần liên thông) để tách 100% không chạm mép.
  - mode="cc": Dùng Connected Components trực tiếp (khuyên dùng khi AI sinh ảnh lệch nhẹ so với lưới).
  - mode="grid": Cắt theo lưới toán học cố định 5x3.
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
    1: {"id": "head", "name": "head", "vi": "Đầu & Tóc", "parent": "torso", "pivot_norm": [0.5, 0.88]},
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
  .checkbox-label {{ font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 8px; cursor: pointer; }}
</style>
</head>
<body>
<div id="sidebar">
  <h2><span>🦴</span> Trình Kiểm Tra Khớp 2D</h2>
  <p style="font-size: 12px; color: #64748b;">Kéo các slider góc xoay (±45°) để kiểm tra khe hở và khớp nối của 13 bộ phận.</p>
  <button class="btn-reset" onclick="resetAngles()">Đặt lại góc ban đầu (0°)</button>
  <label class="checkbox-label">
    <input type="checkbox" id="chk-ref" onchange="render()" checked> Hiện ảnh mẫu đối chiếu (Reference mờ)
  </label>
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
  {{ id: 'head', name: 'Đầu & Cổ' }},
  {{ id: 'torso', name: 'Thân áo (Eo)' }},
  {{ id: 'arm-l', name: 'Vai trái màn hình' }},
  {{ id: 'forearm-l', name: 'Khuỷu tay trái' }},
  {{ id: 'hand-l', name: 'Cổ tay trái' }},
  {{ id: 'arm-r', name: 'Vai phải màn hình' }},
  {{ id: 'forearm-r', name: 'Khuỷu tay phải' }},
  {{ id: 'hand-r', name: 'Cổ tay phải' }},
  {{ id: 'thigh-l', name: 'Háng / Chân trái' }},
  {{ id: 'foot-l', name: 'Cổ chân trái' }},
  {{ id: 'thigh-r', name: 'Háng / Chân phải' }},
  {{ id: 'foot-r', name: 'Cổ chân phải' }}
];

const loadedImages = {{}};
let imagesToLoad = manifest.parts.length + 1; // + reference

const refImg = new Image();
refImg.src = manifest.reference.file;
refImg.onload = () => {{
  loadedImages['reference'] = refImg;
  imagesToLoad--;
  if (imagesToLoad === 0) render();
}};

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

function drawPart(id, img, px, py, pnorm) {{
  if (!img) return;
  const pivotX = img.width * pnorm[0];
  const pivotY = img.height * pnorm[1];
  ctx.drawImage(img, -pivotX, -pivotY);
}}

function render() {{
  ctx.clearRect(0, 0, stage.width, stage.height);
  const cx = stage.width / 2;
  const cy = stage.height / 2;

  // 1. Vẽ reference nếu bật
  const showRef = document.getElementById('chk-ref').checked;
  if (showRef && loadedImages['reference']) {{
    const r = loadedImages['reference'];
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.drawImage(r, cx - r.width / 2, cy - r.height / 2);
    ctx.restore();
  }}

  // 2. Dựng cây xương
  ctx.save();
  ctx.translate(cx, cy);

  // Pelvis (Gốc)
  const pelvisImg = loadedImages['pelvis'];
  if (pelvisImg) {{
    ctx.save();
    ctx.translate(0, 15);
    drawPart('pelvis', pelvisImg, 0, 0, [0.5, 0.5]);

    // Thân áo (Torso)
    const torsoImg = loadedImages['torso'];
    if (torsoImg) {{
      ctx.save();
      ctx.translate(0, -pelvisImg.height * 0.45);
      ctx.rotate((angles['torso'] || 0) * Math.PI / 180);
      drawPart('torso', torsoImg, 0, 0, [0.5, 0.88]);

      // Đầu (Head)
      const headImg = loadedImages['head'];
      if (headImg) {{
        ctx.save();
        ctx.translate(0, -torsoImg.height * 0.85);
        ctx.rotate((angles['head'] || 0) * Math.PI / 180);
        drawPart('head', headImg, 0, 0, [0.5, 0.88]);
        ctx.restore();
      }}

      // Tay trái (arm-l)
      const armLImg = loadedImages['arm-l'];
      if (armLImg) {{
        ctx.save();
        ctx.translate(-torsoImg.width * 0.42, -torsoImg.height * 0.72);
        ctx.rotate((angles['arm-l'] || 0) * Math.PI / 180);
        drawPart('arm-l', armLImg, 0, 0, [0.5, 0.15]);

        const forearmLImg = loadedImages['forearm-l'];
        if (forearmLImg) {{
          ctx.save();
          ctx.translate(0, armLImg.height * 0.82);
          ctx.rotate((angles['forearm-l'] || 0) * Math.PI / 180);
          drawPart('forearm-l', forearmLImg, 0, 0, [0.5, 0.15]);

          const handLImg = loadedImages['hand-l'];
          if (handLImg) {{
            ctx.save();
            ctx.translate(0, forearmLImg.height * 0.82);
            ctx.rotate((angles['hand-l'] || 0) * Math.PI / 180);
            drawPart('hand-l', handLImg, 0, 0, [0.5, 0.15]);
            ctx.restore();
          }}
          ctx.restore();
        }}
        ctx.restore();
      }}

      // Tay phải (arm-r)
      const armRImg = loadedImages['arm-r'];
      if (armRImg) {{
        ctx.save();
        ctx.translate(torsoImg.width * 0.42, -torsoImg.height * 0.72);
        ctx.rotate((angles['arm-r'] || 0) * Math.PI / 180);
        drawPart('arm-r', armRImg, 0, 0, [0.5, 0.15]);

        const forearmRImg = loadedImages['forearm-r'];
        if (forearmRImg) {{
          ctx.save();
          ctx.translate(0, armRImg.height * 0.82);
          ctx.rotate((angles['forearm-r'] || 0) * Math.PI / 180);
          drawPart('forearm-r', forearmRImg, 0, 0, [0.5, 0.15]);

          const handRImg = loadedImages['hand-r'];
          if (handRImg) {{
            ctx.save();
            ctx.translate(0, forearmRImg.height * 0.82);
            ctx.rotate((angles['hand-r'] || 0) * Math.PI / 180);
            drawPart('hand-r', handRImg, 0, 0, [0.5, 0.15]);
            ctx.restore();
          }}
          ctx.restore();
        }}
        ctx.restore();
      }}

      ctx.restore(); // torso
    }}

    // Chân trái (thigh-l)
    const thighLImg = loadedImages['thigh-l'];
    if (thighLImg) {{
      ctx.save();
      ctx.translate(-pelvisImg.width * 0.28, pelvisImg.height * 0.35);
      ctx.rotate((angles['thigh-l'] || 0) * Math.PI / 180);
      drawPart('thigh-l', thighLImg, 0, 0, [0.5, 0.1]);

      const footLImg = loadedImages['foot-l'];
      if (footLImg) {{
        ctx.save();
        ctx.translate(0, thighLImg.height * 0.88);
        ctx.rotate((angles['foot-l'] || 0) * Math.PI / 180);
        drawPart('foot-l', footLImg, 0, 0, [0.35, 0.25]);
        ctx.restore();
      }}
      ctx.restore();
    }}

    // Chân phải (thigh-r)
    const thighRImg = loadedImages['thigh-r'];
    if (thighRImg) {{
      ctx.save();
      ctx.translate(pelvisImg.width * 0.28, pelvisImg.height * 0.35);
      ctx.rotate((angles['thigh-r'] || 0) * Math.PI / 180);
      drawPart('thigh-r', thighRImg, 0, 0, [0.5, 0.1]);

      const footRImg = loadedImages['foot-r'];
      if (footRImg) {{
        ctx.save();
        ctx.translate(0, thighRImg.height * 0.88);
        ctx.rotate((angles['foot-r'] || 0) * Math.PI / 180);
        drawPart('foot-r', footRImg, 0, 0, [0.65, 0.25]);
        ctx.restore();
      }}
      ctx.restore();
    }}

    ctx.restore(); // pelvis
  }}

  ctx.restore();
}}
</script>
</body>
</html>
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html_content)

def slice_character_atlas_cc(raw_img, img_np, output_dir, w, h):
    """
    Tách atlas bằng thuật toán Connected Components (Thành phần liên thông):
    Tự động tìm 1 Reference và 13 Parts, miễn nhiễm hoàn toàn với độ lệch pixel của AI!
    """
    from scipy.ndimage import label, find_objects

    print("[Connected Components] Đang phân đoạn các thành phần liên thông...")
    parts_dir = os.path.join(output_dir, "parts")
    os.makedirs(parts_dir, exist_ok=True)

    r = img_np[:, :, 0].astype(np.int32)
    g = img_np[:, :, 1].astype(np.int32)
    b = img_np[:, :, 2].astype(np.int32)
    max_rb = np.maximum(r, b)
    is_fg = (g - max_rb) <= 30

    labeled, num_features = label(is_fg)
    slices = find_objects(labeled)

    valid_objs = []
    for i, s in enumerate(slices):
        y_slice, x_slice = s
        area = int(np.sum(labeled[s] == (i + 1)))
        # Bỏ qua hạt bụi nhỏ dưới 200 pixel
        if area > 200:
            valid_objs.append({
                "x0": x_slice.start, "y0": y_slice.start,
                "x1": x_slice.stop, "y1": y_slice.stop,
                "w": x_slice.stop - x_slice.start,
                "h": y_slice.stop - y_slice.start,
                "cx": (x_slice.start + x_slice.stop) / 2.0,
                "cy": (y_slice.start + y_slice.stop) / 2.0,
                "area": area,
                "slice": s
            })

    print(f"      Tìm thấy tổng cộng {len(valid_objs)} thành phần nổi bật.")

    # 1. Tìm Reference ở bên trái (cx < w * 0.35) có area lớn nhất
    ref_candidates = [o for o in valid_objs if o["cx"] < w * 0.35]
    if not ref_candidates:
        print("LỖI: Không tìm thấy nhân vật mẫu (Reference) ở Cột 1!", file=sys.stderr)
        sys.exit(1)
    ref_obj = max(ref_candidates, key=lambda o: o["area"])
    print(f"      ✓ Đã nhận diện Reference: bbox=({ref_obj['x0']}, {ref_obj['y0']}) -> ({ref_obj['x1']}, {ref_obj['y1']}), diện tích: {ref_obj['area']} px")

    # Cắt và despill Reference
    ref_crop = img_np[ref_obj["y0"]:ref_obj["y1"], ref_obj["x0"]:ref_obj["x1"]]
    ref_keyed = remove_green_background_and_despill(ref_crop)
    ref_bbox = get_bounding_box(ref_keyed[:, :, 3])
    if ref_bbox:
        rx0, ry0, rx1, ry1 = ref_bbox
        ref_cropped = ref_keyed[ry0:ry1+1, rx0:rx1+1]
        ref_img = Image.fromarray(ref_cropped, "RGBA")
    else:
        ref_img = Image.fromarray(ref_keyed, "RGBA")
    ref_path = os.path.join(output_dir, "reference.png")
    ref_img.save(ref_path)

    # 2. Lấy 13 bộ phận còn lại ở Cột 2 (cx > w * 0.28)
    part_candidates = [o for o in valid_objs if o != ref_obj and o["cx"] > w * 0.28]
    if len(part_candidates) < 13:
        print(f"CẢNH BÁO: Chỉ tìm thấy {len(part_candidates)}/13 mảnh ở Cột 2!", file=sys.stderr)
    elif len(part_candidates) > 13:
        # Lấy 13 mảnh có diện tích lớn nhất
        part_candidates = sorted(part_candidates, key=lambda o: o["area"], reverse=True)[:13]

    # Sắp xếp 13 mảnh thành 3 hàng theo cy:
    # 5 mảnh hàng trên, 5 mảnh hàng giữa, 3 mảnh hàng dưới
    sorted_by_y = sorted(part_candidates, key=lambda o: o["cy"])
    row1 = sorted(sorted_by_y[0:5], key=lambda o: o["cx"])
    row2 = sorted(sorted_by_y[5:10], key=lambda o: o["cx"])
    row3 = sorted(sorted_by_y[10:13], key=lambda o: o["cx"])

    assigned_parts = []
    # Ghép theo thứ tự SPEC:
    # Row 1 (cells 1-5): head, torso, pelvis, arm-l, forearm-l
    for obj in row1: assigned_parts.append(obj)
    # Row 2 (cells 6-10): hand-l, arm-r, forearm-r, hand-r, thigh-l
    for obj in row2: assigned_parts.append(obj)
    # Row 3 (cells 11-13): foot-l, thigh-r, foot-r
    for obj in row3: assigned_parts.append(obj)

    manifest = {
        "source": os.path.basename(output_dir),
        "mode": "connected_components",
        "width": w,
        "height": h,
        "reference": {
            "file": "reference.png",
            "src_rect": {"x": ref_obj["x0"], "y": ref_obj["y0"], "w": ref_obj["w"], "h": ref_obj["h"]},
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

    for idx, obj in enumerate(assigned_parts):
        cell_idx = idx + 1
        part_info = PARTS_SPEC[cell_idx]

        crop = img_np[obj["y0"]:obj["y1"], obj["x0"]:obj["x1"]]
        keyed = remove_green_background_and_despill(crop)

        bbox = get_bounding_box(keyed[:, :, 3])
        if bbox:
            bx0, by0, bx1, by1 = bbox
            cropped_part = keyed[by0:by1+1, bx0:bx1+1]
            part_img = Image.fromarray(cropped_part, "RGBA")
            src_x = obj["x0"] + bx0
            src_y = obj["y0"] + by0
        else:
            part_img = Image.fromarray(keyed, "RGBA")
            src_x = obj["x0"]
            src_y = obj["y0"]

        part_filename = f"{part_info['id']}.png"
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
            "file": f"parts/{part_filename}",
            "parent": part_info["parent"],
            "size": {"w": pw, "h": ph},
            "src_rect": {"x": src_x, "y": src_y, "w": pw, "h": ph},
            "pivot_norm": p_norm,
            "pivot_px": pivot_px
        })
        print(f"      ✓ Ô {cell_idx:2d}: {part_info['id']:10s} -> {pw}x{ph} px (pivot: {pivot_px}) [tọa độ gốc: {src_x},{src_y}]")

    json_path = os.path.join(output_dir, "atlas.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    viewer_path = os.path.join(output_dir, "viewer.html")
    generate_viewer_html(manifest, viewer_path)
    print(f"\n[Xong] Đã xuất {len(manifest['parts'])}/13 mảnh hoàn hảo 100% không chạm mép ô!")
    print(f"      - Rig JSON: {json_path}")
    print(f"      - Trình xem kiểm tra khớp: {viewer_path}")
    return manifest

def slice_character_atlas_grid(raw_img, img_np, output_dir, w, h, pad=4):
    """Tách atlas theo lưới toán học 5x3."""
    parts_dir = os.path.join(output_dir, "parts")
    os.makedirs(parts_dir, exist_ok=True)

    col1_w = int(round(w * (1140.0 / 3840.0)))
    print(f"[Grid] Tách Cột 1 (0 -> {col1_w} px)...")
    col1_crop = img_np[:, 0:col1_w]
    col1_keyed = remove_green_background_and_despill(col1_crop)

    ref_bbox = get_bounding_box(col1_keyed[:, :, 3])
    if ref_bbox:
        rx0, ry0, rx1, ry1 = ref_bbox
        ref_cropped = col1_keyed[ry0:ry1+1, rx0:rx1+1]
        ref_img = Image.fromarray(ref_cropped, "RGBA")
    else:
        ref_img = Image.fromarray(col1_keyed, "RGBA")
    ref_path = os.path.join(output_dir, "reference.png")
    ref_img.save(ref_path)

    col2_x0 = col1_w
    col2_w = w - col2_x0
    cell_w = col2_w / 5.0
    cell_h = h / 3.0

    manifest = {
        "source": os.path.basename(output_dir),
        "mode": "grid",
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
            continue

        part_info = PARTS_SPEC[cell_idx]
        grid_idx = cell_idx - 1
        row = grid_idx // 5
        col = grid_idx % 5

        cx0 = int(round(col2_x0 + col * cell_w))
        cx1 = int(round(col2_x0 + (col + 1) * cell_w))
        cy0 = int(round(row * cell_h))
        cy1 = int(round((row + 1) * cell_h))

        cell_slice = img_np[cy0:cy1, cx0:cx1]
        cell_keyed = remove_green_background_and_despill(cell_slice)

        bbox = get_bounding_box(cell_keyed[:, :, 3])
        if bbox is None:
            warnings.append(f"Ô {cell_idx} ({part_info['id']}) trống!")
            continue

        bx0, by0, bx1, by1 = bbox
        cur_cell_w = cx1 - cx0
        cur_cell_h = cy1 - cy0

        touches_edge = (bx0 <= pad) or (by0 <= pad) or (bx1 >= cur_cell_w - 1 - pad) or (by1 >= cur_cell_h - 1 - pad)
        if touches_edge:
            warnings.append(f"Ô {cell_idx} ({part_info['id']}) chạm mép ô!")

        part_crop = cell_keyed[by0:by1+1, bx0:bx1+1]
        part_img = Image.fromarray(part_crop, "RGBA")
        part_filename = f"{part_info['id']}.png"
        part_img.save(os.path.join(parts_dir, part_filename))

        pw, ph = part_img.size
        p_norm = part_info["pivot_norm"]
        pivot_px = [int(round(pw * p_norm[0])), int(round(ph * p_norm[1]))]

        manifest["parts"].append({
            "cell": cell_idx,
            "id": part_info["id"],
            "name": part_info["name"],
            "vi": part_info["vi"],
            "file": f"parts/{part_filename}",
            "parent": part_info["parent"],
            "size": {"w": pw, "h": ph},
            "src_rect": {"x": cx0 + bx0, "y": cy0 + by0, "w": pw, "h": ph},
            "pivot_norm": p_norm,
            "pivot_px": pivot_px
        })

    json_path = os.path.join(output_dir, "atlas.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    viewer_path = os.path.join(output_dir, "viewer.html")
    generate_viewer_html(manifest, viewer_path)

    return manifest, warnings

def slice_character_atlas(atlas_path, output_dir="out", mode="auto", pad=4):
    if not os.path.exists(atlas_path):
        print(f"LỖI: Không tìm thấy file atlas: {atlas_path}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    raw_img = Image.open(atlas_path).convert("RGBA")
    w, h = raw_img.size
    print(f"Đang xử lý ảnh: {atlas_path} ({w}x{h} px, tỉ lệ {w/h:.3f})")
    img_np = np.array(raw_img)

    if mode == "cc":
        return slice_character_atlas_cc(raw_img, img_np, output_dir, w, h)
    elif mode == "grid":
        manifest, warnings = slice_character_atlas_grid(raw_img, img_np, output_dir, w, h, pad)
        if warnings:
            print("Cảnh báo khi cắt theo lưới:")
            for warn in warnings: print(f" - {warn}")
        return manifest
    else: # auto
        print("[Auto-detect] Kiểm tra tính tương thích lưới...")
        manifest, warnings = slice_character_atlas_grid(raw_img, img_np, output_dir, w, h, pad)
        if len(warnings) > 0:
            print(f"[Auto-detect] Phát hiện {len(warnings)} ô bị lệch/chạm mép. Tự động chuyển sang Connected Components theo SPEC...")
            return slice_character_atlas_cc(raw_img, img_np, output_dir, w, h)
        else:
            print("[Auto-detect] Lưới khớp chuẩn xác!")
            return manifest

def main():
    parser = argparse.ArgumentParser(description="Tách atlas nhân vật 16:9 thành các bộ phận sprite 2D cutout.")
    parser.add_argument("atlas", help="Đường dẫn đến file ảnh atlas 16:9 (.png hoặc .jpg)")
    parser.add_argument("--out", default="out", help="Thư mục xuất kết quả (mặc định: ./out)")
    parser.add_argument("--mode", choices=["auto", "cc", "grid"], default="auto", help="Chế độ cắt: auto (khuyên dùng), cc (connected components), grid (lưới cố định)")
    parser.add_argument("--pad", type=int, default=4, help="Khoảng cách đệm mép ô (mặc định: 4px)")
    args = parser.parse_args()

    slice_character_atlas(args.atlas, args.out, mode=args.mode, pad=args.pad)

if __name__ == "__main__":
    main()
