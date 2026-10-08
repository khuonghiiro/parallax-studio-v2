#!/usr/bin/env python3
"""
Generate 3 botanical flower assets with transparent alpha for 'mesh-flower' template:
1. nature_flower_petal.png - Ratio 2:3 (1024 x 1536): single curved petal, narrow base at bottom center.
2. nature_flower_center.png - Ratio 1:1 (1024 x 1024): circular golden pistil/stamen center.
3. nature_flower_stem.png - Ratio 1:10 (128 x 1280): straight vertical botanical green stem.
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter

random.seed(42)

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'assembly_3d', 'modular')
os.makedirs(OUT_DIR, exist_ok=True)

# ----------------------------------------------------------------------
# 1. PETAL (2:3 aspect ratio, 1024 x 1536)
# ----------------------------------------------------------------------
def generate_petal():
    W, H = 1024, 1536
    SS = 2
    sw, sh = W * SS, H * SS
    im = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    cx = sw / 2.0
    y_tip = sh * 0.05
    y_base = sh * 0.98

    def petal_width(t):
        # t from 0 (tip) to 1 (base)
        if t < 0.0 or t > 1.0:
            return 0.0
        # broad obovate petal: maximum width near t = 0.35 - 0.45
        width = math.sin(t * math.pi)**0.65 * (sw * 0.38) * (1.0 - 0.4 * (t - 0.35)**2)
        # soft tip indentation (daisy / cosmos style)
        if t < 0.12:
            notch = math.sin((t / 0.12) * math.pi) * 0.85
            width *= max(0.2, notch)
        return max(0.0, width)

    # Base petal mask
    mask = Image.new('L', (sw, sh), 0)
    mask_draw = ImageDraw.Draw(mask)

    pts_left = []
    pts_right = []
    steps = 400
    for i in range(steps + 1):
        t = i / steps
        y = y_tip + t * (y_base - y_tip)
        pw = petal_width(t)
        pts_left.append((cx - pw, y))
        pts_right.append((cx + pw, y))

    poly = pts_left + pts_right[::-1]
    mask_draw.polygon(poly, fill=255)

    # Shading: vibrant warm coral / golden pink daisy petal with delicate translucent veins
    petal_rgb = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    petal_draw = ImageDraw.Draw(petal_rgb)

    for y in range(int(y_tip), int(y_base) + 1):
        t = (y - y_tip) / (y_base - y_tip)
        # Color gradient: warm ivory / yellow base -> vivid rose coral pink -> soft blush white tip
        if t > 0.8:
            r = int(245 + 10 * (t - 0.8) / 0.2)
            g = int(200 + 40 * (t - 0.8) / 0.2)
            b = int(70 + 30 * (t - 0.8) / 0.2)
        else:
            r = int(255 - 15 * t)
            g = int(120 + 80 * t)
            b = int(140 + 60 * t)

        pw = petal_width(t)
        if pw > 0.5:
            # Horizontal curvature lighting: brighter in middle, slightly darker at edges
            for x_offset in range(int(pw)):
                norm_x = x_offset / pw
                shade = 1.0 - 0.18 * (norm_x ** 1.8)
                col = (int(r * shade), int(g * shade), int(b * shade), 255)
                petal_draw.point((int(cx - x_offset), y), fill=col)
                petal_draw.point((int(cx + x_offset), y), fill=col)

    # Longitudinal delicate translucent veins
    vein_im = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    vein_draw = ImageDraw.Draw(vein_im)
    num_veins = 16
    for v in range(-num_veins, num_veins + 1):
        if v == 0:
            continue
        v_ratio = v / num_veins
        v_pts = []
        for i in range(0, steps + 1, 4):
            t = i / steps
            y = y_tip + t * (y_base - y_tip)
            pw = petal_width(t)
            vx = cx + v_ratio * pw * (0.85 + 0.15 * math.sin(t * 3.0))
            v_pts.append((vx, y))
        v_color = (255, 90, 110, 50) if abs(v) % 2 == 0 else (255, 230, 200, 40)
        vein_draw.line(v_pts, fill=v_color, width=3)

    vein_im = vein_im.filter(ImageFilter.GaussianBlur(1.2))
    petal_rgb = Image.alpha_composite(petal_rgb, vein_im)

    # Composite mask to alpha
    r, g, b, _ = petal_rgb.split()
    final_petal = Image.merge('RGBA', (r, g, b, mask))
    final_petal = final_petal.resize((W, H), Image.Resampling.LANCZOS)
    out_path = os.path.join(OUT_DIR, 'nature_flower_petal.png')
    final_petal.save(out_path, optimize=True)
    print(f"[OK] Saved petal: {out_path} ({W}x{H})")

# ----------------------------------------------------------------------
# 2. FLOWER CENTER (1:1 aspect ratio, 1024 x 1024)
# ----------------------------------------------------------------------
def generate_center():
    W, H = 1024, 1024
    SS = 2
    sw, sh = W * SS, H * SS
    im = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    cx, cy = sw / 2.0, sh / 2.0
    radius = sw * 0.46  # fills 92% of canvas

    # Draw circular gradient disc
    for r in range(int(radius), 0, -2):
        norm = r / radius
        # Center dome lighting: golden honey yellow center (r=255, g=205, b=20) -> warm amber brown rim (r=180, g=90, b=10)
        cr = int(255 - 75 * (norm ** 1.4))
        cg = int(210 - 120 * (norm ** 1.3))
        cb = int(30 + 10 * (1.0 - norm))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(cr, cg, cb, 255))

    # Dense stamen / pollen granulation (Fibonacci spiral distribution)
    golden_ratio = (1 + 5**0.5) / 2
    num_florets = 2800
    for i in range(num_florets):
        t = i / num_florets
        dist = radius * math.sqrt(t) * 0.98
        angle = 2 * math.pi * golden_ratio * i
        fx = cx + dist * math.cos(angle)
        fy = cy + dist * math.sin(angle)

        dot_r = max(1.8, 4.5 * (0.3 + 0.7 * t))
        # Pollen texture color
        if t < 0.2:
            pcol = (255, 235, 90, 240)
        elif t < 0.75:
            pcol = (250, 195, 25, 250)
        else:
            pcol = (210, 120, 15, 255)

        draw.ellipse([fx - dot_r, fy - dot_r, fx + dot_r, fy + dot_r], fill=pcol)
        # Specular glint on each stamen head
        draw.point((int(fx - dot_r * 0.3), int(fy - dot_r * 0.3)), fill=(255, 255, 200, 200))

    # Soft alpha antialiased boundary mask
    mask = Image.new('L', (sw, sh), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2.0))

    r, g, b, a = im.split()
    final_alpha = Image.composite(a, Image.new('L', (sw, sh), 0), mask)
    final_center = Image.merge('RGBA', (r, g, b, final_alpha))
    final_center = final_center.resize((W, H), Image.Resampling.LANCZOS)
    out_path = os.path.join(OUT_DIR, 'nature_flower_center.png')
    final_center.save(out_path, optimize=True)
    print(f"[OK] Saved center: {out_path} ({W}x{H})")

# ----------------------------------------------------------------------
# 3. STEM (1:10 aspect ratio, 128 x 1280)
# ----------------------------------------------------------------------
def generate_stem():
    W, H = 128, 1280
    SS = 2
    sw, sh = W * SS, H * SS
    im = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    cx = sw / 2.0
    stem_half_w = sw * 0.32

    # Draw vertical cylinder with smooth cylindrical lighting
    for y in range(sh):
        norm_y = y / sh
        # Slight organic thickness variation
        cur_w = stem_half_w * (1.0 + 0.05 * math.sin(norm_y * 12.0))
        for x_offset in range(int(cur_w)):
            norm_x = x_offset / cur_w
            # Cylindrical Lambertian diffuse highlight
            shade = 0.75 + 0.25 * math.cos(norm_x * (math.pi / 2.0))
            # Botanical stem green (dark olive to fresh sprout green)
            r = int((50 + 20 * norm_y) * shade)
            g = int((145 + 30 * norm_y) * shade)
            b = int((35 + 15 * norm_y) * shade)
            draw.point((int(cx - x_offset), y), fill=(r, g, b, 255))
            draw.point((int(cx + x_offset), y), fill=(r, g, b, 255))

    # Add gentle node line around 40% height
    node_y = int(sh * 0.45)
    for ny in range(node_y - 8, node_y + 8):
        factor = 1.0 - abs(ny - node_y) / 8.0
        draw.line([(cx - stem_half_w * 1.08, ny), (cx + stem_half_w * 1.08, ny)],
                  fill=(70, 175, 45, int(180 * factor)), width=1)

    final_stem = im.resize((W, H), Image.Resampling.LANCZOS)
    out_path = os.path.join(OUT_DIR, 'nature_flower_stem.png')
    final_stem.save(out_path, optimize=True)
    print(f"[OK] Saved stem: {out_path} ({W}x{H})")

if __name__ == '__main__':
    generate_petal()
    generate_center()
    generate_stem()
    print("All flower assets successfully generated!")
