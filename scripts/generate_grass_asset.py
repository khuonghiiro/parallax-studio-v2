#!/usr/bin/env python3
"""
Generate a high-quality botanical grass tuft PNG with transparent background
conforming to the image-mesh 'mesh-grass' template specifications:
- Canvas ratio 1:1 (1024 x 1024)
- Front elevation, roots at bottom edge, blades pointing upward
- ~4% transparent padding at sides and top
- Real alpha between blades, no soil or background
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter

W, H = 1024, 1024
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'assembly_3d', 'modular')
os.makedirs(OUT_DIR, exist_ok=True)
OUT_PATH = os.path.join(OUT_DIR, 'nature_grass.png')

random.seed(42)

def generate_grass():
    # High-resolution supersampling for crisp thin blade rendering
    SS = 2
    sw, sh = W * SS, H * SS
    
    # We will draw blades on an RGBA canvas
    im_ss = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im_ss)
    
    cx = sw / 2.0
    # Bottom root attachment
    root_y = sh - 20.0
    
    # We create ~90 distinct grass blades arranged in depth layers (back to front)
    # Each blade has:
    # - root_x near cx (spread -120 to +120px in SS)
    # - length (reaching up to y ~ 80px in SS)
    # - arch factor (angle curving left or right)
    # - base width and tip taper
    # - color palette (darker back blades, brighter foreground blades)
    
    blades = []
    num_blades = 110
    
    for i in range(num_blades):
        # Normalized index
        layer = i / float(num_blades)
        # Position at root: clump spread
        rx = cx + random.uniform(-140.0 * SS, 140.0 * SS)
        # Blade height: center taller (up to 850px in SS), sides shorter
        dist_from_c = abs(rx - cx) / (140.0 * SS)
        max_h = (820.0 - dist_from_c * 260.0) * SS
        blade_len = max_h * random.uniform(0.65, 1.0)
        
        # Arch direction: naturally spreads away from center, with some crossing
        natural_dir = (rx - cx) / (140.0 * SS)
        arch = natural_dir * random.uniform(0.3, 0.85) + random.uniform(-0.25, 0.25)
        
        # Blade curvature parameters
        # Quadratic/cubic curve control
        base_w = random.uniform(5.5, 9.0) * SS
        
        # Color: back blades darker/cooler, front blades brighter/warmer
        depth_tint = layer
        hue_var = random.uniform(-0.1, 0.1)
        
        blades.append({
            'rx': rx,
            'len': blade_len,
            'arch': arch,
            'base_w': base_w,
            'depth': depth_tint,
            'layer': layer
        })
        
    # Sort blades back-to-front by layer
    blades.sort(key=lambda b: b['layer'])
    
    for b in blades:
        rx = b['rx']
        length = b['len']
        arch = b['arch']
        base_w = b['base_w']
        layer = b['layer']
        
        # Generate points along blade
        steps = 45
        left_pts = []
        right_pts = []
        
        # Main spine trajectory
        for s in range(steps + 1):
            t = s / float(steps)
            # Y goes from root_y upwards
            y = root_y - t * length
            # X curves outwards with parabolic arch
            # t^1.7 creates gentle straight base curving more at top
            dx = arch * (t ** 1.65) * (sw * 0.38)
            # subtle sway waviness
            sway = math.sin(t * 3.5) * 6.0 * SS * (arch)
            curr_x = rx + dx + sway
            
            # Width tapers from base_w to 1px at tip
            # starts wide at base, stays medium, tapers sharp at last 25%
            w_factor = (1.0 - t ** 0.85)
            hw = max(0.8 * SS, (base_w * 0.5) * w_factor)
            
            left_pts.append((curr_x - hw, y))
            right_pts.append((curr_x + hw, y))
            
        poly = left_pts + list(reversed(right_pts))
        
        # Colors along blade: base is darker olive green, mid is vibrant leaf green, tip is light lime/sunlit
        r_base = int(24 + layer * 20)
        g_base = int(95 + layer * 40)
        b_base = int(20 + layer * 15)
        
        r_tip = int(120 + layer * 45)
        g_tip = int(195 + layer * 45)
        b_tip = int(45 + layer * 25)
        
        # Draw blade with vertical gradient slices or polygon
        # For smooth gradient, draw small segments
        for seg in range(steps):
            t_mid = (seg + 0.5) / float(steps)
            cr = int(r_base + t_mid * (r_tip - r_base))
            cg = int(g_base + t_mid * (g_tip - g_base))
            cb = int(b_base + t_mid * (b_tip - b_base))
            
            # Sub-polygon for this segment
            p_seg = [
                left_pts[seg], left_pts[seg + 1],
                right_pts[seg + 1], right_pts[seg]
            ]
            draw.polygon(p_seg, fill=(cr, cg, cb, 255))
            
        # Add subtle central vein highlight along spine
        spine_pts = []
        for s in range(steps):
            p1 = left_pts[s]
            p2 = right_pts[s]
            spine_pts.append(((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0))
            
        draw.line(spine_pts, fill=(int(r_tip * 0.95), int(g_tip * 1.05), int(b_tip * 0.9), 110), width=int(1.2 * SS))

    # Downsample from SS to final W x H with high-quality anti-aliasing
    final_im = im_ss.resize((W, H), Image.Resampling.LANCZOS)
    
    # Clean bottom edge: ensure roots fill the base clump cleanly
    final_im.save(OUT_PATH, 'PNG')
    print(f"Generated botanical grass tuft asset at: {OUT_PATH} ({W}x{H})")

if __name__ == '__main__':
    generate_grass()
