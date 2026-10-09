#!/usr/bin/env python3
"""
Generate clean transparent PNG cutout character parts for 2D/2.5D skeletal animation.
Theme: Chibi Knight Adventurer (Hiệp Sĩ Tí Hon).
All parts have rounded joint caps so rotations leave no gaps.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'character_hero')
os.makedirs(OUT_DIR, exist_ok=True)

def draw_pill(draw, box, fill, outline=None, width=1):
    """Draw a capsule / pill shape with rounded ends."""
    x0, y0, x1, y1 = box
    r = min(x1 - x0, y1 - y0) // 2
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill, outline=outline, width=width)

# -----------------------------------------------------------------------------
# 1. Head (Đầu & Mũ giáp) - 160 x 160
# -----------------------------------------------------------------------------
def make_head():
    W, H = 160, 160
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Red helmet crest feather (lông vũ đỏ trên mũ)
    crest = [(80, 10), (105, 30), (80, 50), (70, 30)]
    draw.polygon(crest, fill=(231, 76, 60, 255), outline=(192, 57, 43, 255))
    draw.line([(80, 10), (75, 45)], fill=(241, 196, 15, 255), width=2)

    # Helmet dome (mũ giáp sắt)
    draw.ellipse([30, 30, 130, 130], fill=(52, 73, 94, 255), outline=(44, 62, 80, 255), width=3)
    # Highlight on top dome
    draw.arc([40, 38, 120, 85], start=200, end=340, fill=(93, 109, 126, 255), width=3)

    # Golden brow band (dải vàng trán)
    draw.rounded_rectangle([32, 75, 128, 92], radius=4, fill=(241, 196, 15, 255), outline=(214, 137, 16, 255), width=2)

    # Face visor aperture (khe ngắm mũ giáp)
    draw.rounded_rectangle([42, 92, 118, 125], radius=6, fill=(26, 36, 47, 255), outline=(44, 62, 80, 255), width=2)

    # Glowing eyes (đôi mắt sáng dũng cảm)
    draw.ellipse([54, 102, 68, 114], fill=(46, 204, 113, 255))
    draw.ellipse([92, 102, 106, 114], fill=(46, 204, 113, 255))
    draw.ellipse([58, 105, 64, 111], fill=(255, 255, 255, 255))
    draw.ellipse([96, 105, 102, 111], fill=(255, 255, 255, 255))

    # Helmet chin guard (phần che cằm)
    draw.polygon([(65, 130), (80, 142), (95, 130)], fill=(44, 62, 80, 255), outline=(241, 196, 15, 255))

    im.save(os.path.join(OUT_DIR, 'head.png'))
    print("[OK] Created head.png")

# -----------------------------------------------------------------------------
# 2. Torso (Thân / Giáp ngực) - 140 x 120
# -----------------------------------------------------------------------------
def make_torso():
    W, H = 140, 120
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Chestplate cuirass (thân áo giáp)
    poly = [(35, 15), (105, 15), (115, 65), (95, 110), (45, 110), (25, 65)]
    draw.polygon(poly, fill=(52, 73, 94, 255), outline=(44, 62, 80, 255), width=3)

    # Golden chest emblem / cross
    draw.rounded_rectangle([64, 25, 76, 85], radius=3, fill=(241, 196, 15, 255))
    draw.rounded_rectangle([48, 42, 92, 54], radius=3, fill=(241, 196, 15, 255))
    draw.ellipse([63, 41, 77, 55], fill=(231, 76, 60, 255))

    # Shoulder pauldron socket rings (khớp cầu vai 2 bên)
    draw.ellipse([18, 18, 42, 42], fill=(44, 62, 80, 255), outline=(241, 196, 15, 255), width=2)
    draw.ellipse([98, 18, 122, 42], fill=(44, 62, 80, 255), outline=(241, 196, 15, 255), width=2)

    im.save(os.path.join(OUT_DIR, 'torso.png'))
    print("[OK] Created torso.png")

# -----------------------------------------------------------------------------
# 3. Pelvis / Belt (Hông & Thắt lưng giáp) - 120 x 80
# -----------------------------------------------------------------------------
def make_pelvis():
    W, H = 120, 80
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Leather faulds under-layer
    draw.polygon([(25, 15), (95, 15), (105, 50), (80, 68), (40, 68), (15, 50)],
                 fill=(44, 62, 80, 255), outline=(30, 40, 50, 255), width=2)

    # Golden belt strip (thắt lưng vàng)
    draw.rounded_rectangle([20, 15, 100, 32], radius=4, fill=(214, 137, 16, 255), outline=(180, 110, 10, 255), width=2)
    # Big gold buckle
    draw.rounded_rectangle([50, 11, 70, 36], radius=4, fill=(241, 196, 15, 255), outline=(255, 235, 150, 255), width=2)
    draw.ellipse([57, 20, 63, 27], fill=(231, 76, 60, 255))

    # Hip socket round joints
    draw.ellipse([22, 40, 44, 62], fill=(52, 73, 94, 255), outline=(241, 196, 15, 255), width=2)
    draw.ellipse([76, 40, 98, 62], fill=(52, 73, 94, 255), outline=(241, 196, 15, 255), width=2)

    im.save(os.path.join(OUT_DIR, 'pelvis.png'))
    print("[OK] Created pelvis.png")

# -----------------------------------------------------------------------------
# 4. Upper Arm (Bắp tay) - 60 x 90
# -----------------------------------------------------------------------------
def make_arm(side='l'):
    W, H = 60, 90
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Pauldron / shoulder curved plate at top
    draw.ellipse([8, 6, 52, 50], fill=(52, 73, 94, 255), outline=(241, 196, 15, 255), width=2)
    # Upper arm cylinder
    draw.rounded_rectangle([15, 30, 45, 80], radius=12, fill=(44, 62, 80, 255), outline=(35, 45, 60, 255), width=2)
    # Highlight
    draw.line([(22, 35), (22, 72)], fill=(93, 109, 126, 255), width=2)

    filename = f'arm_{side}.png'
    im.save(os.path.join(OUT_DIR, filename))
    print(f"[OK] Created {filename}")

# -----------------------------------------------------------------------------
# 5. Forearm & Hand / Gauntlet (Cẳng tay & Găng tay) - 60 x 90
# -----------------------------------------------------------------------------
def make_forearm(side='l'):
    W, H = 60, 90
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Elbow round joint cap
    draw.ellipse([16, 6, 44, 34], fill=(52, 73, 94, 255), outline=(44, 62, 80, 255), width=2)

    # Arm bracer (giáp cẳng tay)
    draw.polygon([(15, 22), (45, 22), (48, 62), (12, 62)], fill=(52, 73, 94, 255), outline=(44, 62, 80, 255), width=2)
    draw.line([(14, 42), (46, 42)], fill=(241, 196, 15, 255), width=2)

    # Fist / Gauntlet (nắm tay / găng sắt)
    draw.ellipse([14, 56, 46, 84], fill=(44, 62, 80, 255), outline=(241, 196, 15, 255), width=2)

    # If right hand, draw sword hilt / grip
    if side == 'r':
        # Gold crossguard & pommel
        draw.rectangle([10, 68, 50, 74], fill=(241, 196, 15, 255))
        # Blue blade tip emerging
        draw.polygon([(26, 74), (34, 74), (30, 88)], fill=(189, 195, 199, 255), outline=(127, 140, 141, 255))

    filename = f'forearm_{side}.png'
    im.save(os.path.join(OUT_DIR, filename))
    print(f"[OK] Created {filename}")

# -----------------------------------------------------------------------------
# 6. Thigh (Đùi) - 65 x 100
# -----------------------------------------------------------------------------
def make_thigh(side='l'):
    W, H = 65, 100
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Hip top pivot cap
    draw.ellipse([15, 5, 50, 40], fill=(52, 73, 94, 255), outline=(44, 62, 80, 255), width=2)
    # Thigh armor plate
    draw.rounded_rectangle([14, 20, 51, 85], radius=14, fill=(44, 62, 80, 255), outline=(35, 45, 60, 255), width=2)
    # Golden stripe down thigh
    draw.line([(32, 22), (32, 80)], fill=(241, 196, 15, 255), width=2)
    # Knee socket cap
    draw.ellipse([18, 72, 47, 95], fill=(52, 73, 94, 255), outline=(44, 62, 80, 255), width=2)

    filename = f'thigh_{side}.png'
    im.save(os.path.join(OUT_DIR, filename))
    print(f"[OK] Created {filename}")

# -----------------------------------------------------------------------------
# 7. Shin & Armored Boot (Cẳng chân & Ủng sắt) - 70 x 100
# -----------------------------------------------------------------------------
def make_shin(side='l'):
    W, H = 70, 100
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Knee round poleyn cap (khớp gối)
    draw.ellipse([20, 6, 50, 36], fill=(52, 73, 94, 255), outline=(241, 196, 15, 255), width=2)

    # Greave plate (giáp cẳng chân)
    draw.polygon([(18, 24), (52, 24), (50, 68), (20, 68)], fill=(44, 62, 80, 255), outline=(35, 45, 60, 255), width=2)

    # Armored boot foot pointing outward slightly
    toe_offset = -6 if side == 'l' else 6
    boot_poly = [
        (16, 65), (54, 65),
        (56 + toe_offset, 88), (14 + toe_offset, 88)
    ]
    draw.rounded_rectangle([14, 65, 56 + abs(toe_offset), 92], radius=6,
                           fill=(52, 73, 94, 255), outline=(241, 196, 15, 255), width=2)

    filename = f'shin_{side}.png'
    im.save(os.path.join(OUT_DIR, filename))
    print(f"[OK] Created {filename}")

def main():
    print(f"Generating Chibi Knight character assets to: {OUT_DIR}")
    make_head()
    make_torso()
    make_pelvis()
    make_arm('l')
    make_forearm('l')
    make_arm('r')
    make_forearm('r')
    make_thigh('l')
    make_shin('l')
    make_thigh('r')
    make_shin('r')
    print("Done! All 11 character parts generated successfully.")

if __name__ == '__main__':
    main()
