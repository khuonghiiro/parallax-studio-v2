#!/usr/bin/env python3
"""
Generate a high-quality botanical leaf PNG with transparent background
conforming to the image-mesh 'mesh-leaf' specifications.
- Aspect ratio: 1:2 (1024 x 2048)
- Central midrib vein vertical at x = 50%
- Tip at top center, petiole at bottom center
- 4% transparent margin padding around edges
- Real alpha transparency, no perspective, no shadow
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter

W, H = 1024, 2048
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'assembly_3d', 'modular')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_PATH = os.path.join(OUT_DIR, 'nature_leaf.png')

random.seed(1337)

def generate_leaf():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cx = W / 2.0
    
    # Vertical bounds:
    # y_top = 80 (approx 4% from top)
    # y_bottom = 1968 (approx 4% from bottom)
    # petiole is from y = 1860 to 1968
    # leaf blade is from y = 80 to 1860
    y_tip = 80.0
    y_base = 1860.0
    y_petiole_end = 1968.0
    
    blade_length = y_base - y_tip
    
    # Step 1: Draw the base leaf blade mask and color map
    # We define the half-width of the leaf blade as a function of normalized t (0 at tip, 1 at base)
    def half_width(t):
        if t < 0.0 or t > 1.0:
            return 0.0
        # Beautiful ovate leaf profile: peak width around t = 0.55 - 0.65
        # starts at 0 at tip (t=0), reaches max ~380px at t=0.6, tapers nicely to base (t=1)
        base_w = math.sin(t * math.pi)**0.75 * (390.0 * (1.0 - 0.25 * (t - 0.55)**2))
        # Add subtle natural waviness / serration
        serration = 4.0 * math.sin(t * 60.0) * math.cos(t * 25.0)
        return max(0.0, base_w + serration)

    # High-resolution supersampling for smooth organic drawing
    SS = 2
    sw, sh = W * SS, H * SS
    mask_im = Image.new('L', (sw, sh), 0)
    mask_draw = ImageDraw.Draw(mask_im)
    
    # Construct leaf polygon
    left_points = []
    right_points = []
    steps = 400
    for i in range(steps + 1):
        t = i / float(steps)
        y = (y_tip + t * blade_length) * SS
        hw = half_width(t) * SS
        left_points.append(((cx * SS) - hw, y))
        right_points.append(((cx * SS) + hw, y))
        
    # Petiole points
    petiole_hw = 12.0 * SS
    petiole_steps = 40
    for i in range(petiole_steps + 1):
        t = i / float(petiole_steps)
        y = (y_base + t * (y_petiole_end - y_base)) * SS
        hw = (petiole_hw + (1.0 - t) * 6.0 * SS)
        left_points.append(((cx * SS) - hw, y))
        right_points.append(((cx * SS) + hw, y))
        
    leaf_poly = left_points + list(reversed(right_points))
    mask_draw.polygon(leaf_poly, fill=255)
    
    # Downsample mask with box filtering for anti-aliasing
    alpha_mask = mask_im.resize((W, H), Image.Resampling.LANCZOS)
    
    # Step 2: Render rich botanical leaf colors
    color_im = Image.new('RGB', (W, H), (0, 0, 0))
    color_draw = ImageDraw.Draw(color_im)
    
    # Base background gradient of leaf: darker forest green near margins, vibrant fresh green towards center
    for y in range(H):
        t = (y - y_tip) / max(1.0, blade_length)
        t = max(0.0, min(1.0, t))
        # Base colors from top to bottom
        r_mid = int(48 + 32 * math.sin(t * math.pi))
        g_mid = int(140 + 45 * math.sin(t * math.pi))
        b_mid = int(38 + 20 * math.sin(t * math.pi))
        
        color_draw.line([(0, y), (W, y)], fill=(r_mid, g_mid, b_mid))
        
    # Add lateral gradient (darker towards leaf edges, luminous near center)
    pix = color_im.load()
    alpha_pix = alpha_mask.load()
    
    for y in range(H):
        t = (y - y_tip) / max(1.0, blade_length)
        hw = half_width(t)
        if hw <= 1.0:
            continue
        for x in range(W):
            if alpha_pix[x, y] == 0:
                continue
            dx = abs(x - cx)
            dist_norm = min(1.0, dx / hw)
            r, g, b = pix[x, y]
            # Edge darkening factor
            edge_dark = 1.0 - 0.28 * (dist_norm ** 1.5)
            # Center luminance boost for ridge profile
            center_boost = 1.0 + 0.22 * math.exp(- (dx / 35.0) ** 2)
            factor = edge_dark * center_boost
            
            # Subtle cellular noise
            noise = (random.random() - 0.5) * 6.0
            
            nr = max(0, min(255, int(r * factor + noise)))
            ng = max(0, min(255, int(g * factor + noise * 1.5)))
            nb = max(0, min(255, int(b * factor + noise)))
            pix[x, y] = (nr, ng, nb)
            
    # Step 3: Draw detailed veins on an overlay image
    vein_im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    vein_draw = ImageDraw.Draw(vein_im)
    
    # A. Lateral veins: pairs branching from midrib at 45 to 60 degrees curving outward
    num_vein_pairs = 16
    for i in range(num_vein_pairs):
        vt = 0.12 + 0.80 * (i / float(num_vein_pairs))
        vy = y_tip + vt * blade_length
        hw = half_width(vt)
        if hw < 40:
            continue
            
        angle = 48.0 + 12.0 * math.sin(vt * math.pi)
        rad = math.radians(angle)
        
        # Left vein
        pts_left = []
        pts_right = []
        v_steps = 30
        for s in range(v_steps + 1):
            st = s / float(v_steps)
            dist = st * (hw * 0.94)
            # Curve upwards as it approaches edge
            dy = - (st ** 1.35) * (dist * math.tan(rad * 0.65))
            pts_left.append((cx - dist, vy + dy))
            pts_right.append((cx + dist, vy + dy))
            
        vein_color = (175, 225, 95, 140)
        vein_draw.line(pts_left, fill=vein_color, width=3)
        vein_draw.line(pts_right, fill=vein_color, width=3)
        
        # Sub-branches
        for s in [0.35, 0.65]:
            dist = s * (hw * 0.94)
            dy = - (s ** 1.35) * (dist * math.tan(rad * 0.65))
            bx, by = cx - dist, vy + dy
            b_target = (bx - 25, by - 18)
            vein_draw.line([(bx, by), b_target], fill=(160, 210, 85, 90), width=2)
            
            bx_r, by_r = cx + dist, vy + dy
            b_target_r = (bx_r + 25, by_r - 18)
            vein_draw.line([(bx_r, by_r), b_target_r], fill=(160, 210, 85, 90), width=2)
            
    # B. Central midrib vein (running vertically from bottom petiole to tip)
    midrib_pts = []
    m_steps = 100
    for i in range(m_steps + 1):
        t = i / float(m_steps)
        y = y_tip + t * (y_petiole_end - y_tip)
        # Taper midrib width from 16px at base to 3px at tip
        w_vein = int(3 + (1.0 - (1.0 - t)**2) * 14)
        col = (195, 235, 110, 230) if t < 0.9 else (160, 195, 95, 240)
        vein_draw.ellipse([cx - w_vein/2.0, y - 2, cx + w_vein/2.0, y + 2], fill=col)

    # Soften veins slightly
    vein_blurred = vein_im.filter(ImageFilter.GaussianBlur(radius=0.8))
    
    # Composite colors and veins
    color_im.paste(vein_blurred, (0, 0), vein_blurred)
    
    # Final RGBA image
    final_im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    final_im.paste(color_im, (0, 0), alpha_mask)
    
    final_im.save(OUT_PATH, 'PNG')
    print(f"Generated leaf asset at: {OUT_PATH} ({W}x{H})")

if __name__ == '__main__':
    generate_leaf()
