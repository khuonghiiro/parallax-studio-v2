#!/usr/bin/env python3
"""
Generate high quality transparent PNG cutout character parts for 2D/2.5D skeletal animation.
Theme: Platinum-haired Anime Schoolgirl (Nữ Sinh Anime Tóc Bạch Kim, Đồng Phục Học Sinh).
All parts have rounded joint caps so rotations leave no gaps, with clean alpha boundaries.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'character_anime')
os.makedirs(OUT_DIR, exist_ok=True)

def draw_pill(draw, box, fill, outline=None, width=1):
    x0, y0, x1, y1 = box
    r = min(x1 - x0, y1 - y0) // 2
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill, outline=outline, width=width)

# -----------------------------------------------------------------------------
# 1. Hair Back (Tóc sau lưng dài bồng bềnh bạch kim) - 200 x 260
# -----------------------------------------------------------------------------
def make_hair_back():
    W, H = 200, 260
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Cascading platinum twin tails / long hair flowing down
    # Left flow
    left_poly = [
        (60, 20), (30, 80), (20, 160), (35, 230), (55, 245),
        (50, 190), (60, 130), (80, 50)
    ]
    draw.polygon(left_poly, fill=(241, 245, 249, 255), outline=(203, 213, 225, 255))
    draw.line([(35, 100), (38, 220)], fill=(226, 232, 240, 255), width=2)

    # Right flow
    right_poly = [
        (140, 20), (170, 80), (180, 160), (165, 230), (145, 245),
        (150, 190), (140, 130), (120, 50)
    ]
    draw.polygon(right_poly, fill=(241, 245, 249, 255), outline=(203, 213, 225, 255))
    draw.line([(165, 100), (162, 220)], fill=(226, 232, 240, 255), width=2)

    # Central back hair curtain
    center_poly = [
        (65, 30), (135, 30), (145, 120), (130, 210), (100, 235),
        (70, 210), (55, 120)
    ]
    draw.polygon(center_poly, fill=(226, 232, 240, 255), outline=(203, 213, 225, 255))
    draw.line([(85, 50), (80, 190)], fill=(248, 250, 252, 255), width=2)
    draw.line([(115, 50), (120, 190)], fill=(248, 250, 252, 255), width=2)

    im.save(os.path.join(OUT_DIR, 'hair_back.png'))
    print("[OK] Created hair_back.png")

# -----------------------------------------------------------------------------
# 2. Head (Đầu, Mặt Anime & Tóc Mái Bạch Kim) - 180 x 180
# -----------------------------------------------------------------------------
def make_head():
    W, H = 180, 180
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Neck joint connector
    draw.ellipse([72, 140, 108, 172], fill=(255, 235, 230, 255), outline=(245, 205, 195, 255), width=1)

    # Head / Face shape (chin tapering down gently)
    face_poly = [
        (48, 60), (132, 60), (136, 105), (116, 142), (90, 154), (64, 142), (44, 105)
    ]
    draw.polygon(face_poly, fill=(255, 241, 238, 255), outline=(245, 210, 200, 255), width=2)

    # Soft rosy cheek blushes
    draw.ellipse([50, 112, 70, 124], fill=(254, 205, 211, 180))
    draw.ellipse([110, 112, 130, 124], fill=(254, 205, 211, 180))

    # Large Anime Eyes (Left & Right)
    # Eyeballs
    draw.ellipse([54, 88, 78, 116], fill=(255, 255, 255, 255), outline=(30, 41, 59, 255), width=2)
    draw.ellipse([102, 88, 126, 116], fill=(255, 255, 255, 255), outline=(30, 41, 59, 255), width=2)

    # Cyan/Aqua gem iris
    draw.ellipse([58, 92, 76, 114], fill=(6, 182, 212, 255))
    draw.ellipse([104, 92, 122, 114], fill=(6, 182, 212, 255))

    # Deep pupil
    draw.ellipse([62, 97, 72, 110], fill=(15, 23, 42, 255))
    draw.ellipse([108, 97, 118, 110], fill=(15, 23, 42, 255))

    # Eye highlights (lấp lánh)
    draw.ellipse([60, 93, 67, 100], fill=(255, 255, 255, 255))
    draw.ellipse([106, 93, 113, 100], fill=(255, 255, 255, 255))
    draw.ellipse([68, 105, 72, 109], fill=(255, 255, 255, 255))
    draw.ellipse([114, 105, 118, 109], fill=(255, 255, 255, 255))

    # Eyelashes & Eyelids
    draw.arc([52, 82, 80, 96], start=190, end=350, fill=(30, 41, 59, 255), width=3)
    draw.arc([100, 82, 128, 96], start=190, end=350, fill=(30, 41, 59, 255), width=3)

    # Delicate smile & small nose dot
    draw.ellipse([89, 115, 91, 117], fill=(225, 175, 165, 255))
    draw.arc([82, 126, 98, 138], start=20, end=160, fill=(225, 120, 130, 255), width=2)

    # Hair - Platinum Bangs & Forehead Strands
    # Top hair volume
    draw.ellipse([34, 20, 146, 75], fill=(248, 250, 252, 255), outline=(203, 213, 225, 255), width=2)

    # Front bangs strands
    bangs = [
        [(36, 45), (46, 88), (56, 52)],
        [(54, 48), (70, 92), (80, 52)],
        [(78, 48), (90, 86), (98, 50)],
        [(96, 50), (110, 92), (124, 48)],
        [(122, 52), (134, 88), (144, 45)]
    ]
    for b in bangs:
        draw.polygon(b, fill=(248, 250, 252, 255), outline=(226, 232, 240, 255))

    # Side long locks framing the face
    draw.polygon([(36, 55), (28, 115), (40, 155), (48, 110)], fill=(241, 245, 249, 255), outline=(203, 213, 225, 255))
    draw.polygon([(144, 55), (152, 115), (140, 155), (132, 110)], fill=(241, 245, 249, 255), outline=(203, 213, 225, 255))

    # Cute red ribbon hair clip on right side
    draw.polygon([(135, 38), (152, 28), (148, 48)], fill=(239, 68, 68, 255), outline=(185, 28, 28, 255))
    draw.polygon([(135, 38), (152, 48), (148, 28)], fill=(239, 68, 68, 255), outline=(185, 28, 28, 255))
    draw.ellipse([132, 34, 140, 42], fill=(251, 191, 36, 255))

    im.save(os.path.join(OUT_DIR, 'head.png'))
    print("[OK] Created head.png")

# -----------------------------------------------------------------------------
# 3. Torso (Áo Đồng Phục Thủy Thủ Nữ Sinh Sailor) - 140 x 120
# -----------------------------------------------------------------------------
def make_torso():
    W, H = 140, 120
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Main white blouse body
    blouse_poly = [(35, 18), (105, 18), (112, 60), (96, 110), (44, 110), (28, 60)]
    draw.polygon(blouse_poly, fill=(255, 255, 255, 255), outline=(226, 232, 240, 255), width=2)

    # Navy blue sailor collar flap
    collar_poly = [(42, 18), (98, 18), (114, 56), (70, 78), (26, 56)]
    draw.polygon(collar_poly, fill=(30, 41, 59, 255), outline=(15, 23, 42, 255), width=2)

    # Double white trim stripes on sailor collar
    draw.line([(32, 54), (70, 74), (108, 54)], fill=(248, 250, 252, 255), width=2)
    draw.line([(35, 48), (70, 68), (105, 48)], fill=(248, 250, 252, 255), width=1)

    # Center white chest triangle insert
    draw.polygon([(56, 18), (84, 18), (70, 52)], fill=(255, 255, 255, 255))

    # Bright Crimson Red School Ribbon Tie
    # Left bow wing
    draw.polygon([(70, 52), (46, 44), (44, 62)], fill=(239, 68, 68, 255), outline=(185, 28, 28, 255), width=1)
    # Right bow wing
    draw.polygon([(70, 52), (94, 44), (96, 62)], fill=(239, 68, 68, 255), outline=(185, 28, 28, 255), width=1)
    # Center golden knot
    draw.ellipse([65, 47, 75, 57], fill=(245, 158, 11, 255), outline=(217, 119, 6, 255), width=1)
    # Hanging ribbon tails
    draw.polygon([(67, 56), (56, 86), (68, 80)], fill=(220, 38, 38, 255))
    draw.polygon([(73, 56), (84, 86), (72, 80)], fill=(220, 38, 38, 255))

    # Shoulder round socket rings
    draw.ellipse([20, 20, 42, 42], fill=(255, 255, 255, 255), outline=(203, 213, 225, 255), width=2)
    draw.ellipse([98, 20, 120, 42], fill=(255, 255, 255, 255), outline=(203, 213, 225, 255), width=2)

    im.save(os.path.join(OUT_DIR, 'torso.png'))
    print("[OK] Created torso.png")

# -----------------------------------------------------------------------------
# 4. Pelvis (Váy Xếp Ly Đồng Phục Nữ Sinh Pleated Skirt) - 130 x 85
# -----------------------------------------------------------------------------
def make_pelvis():
    W, H = 130, 85
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Upper waistband
    draw.rounded_rectangle([25, 12, 105, 28], radius=3, fill=(30, 41, 59, 255), outline=(15, 23, 42, 255), width=2)
    # White belt accent line
    draw.line([(28, 20), (102, 20)], fill=(248, 250, 252, 255), width=1)

    # Pleated navy skirt flared out
    skirt_poly = [(28, 26), (102, 26), (116, 74), (14, 74)]
    draw.polygon(skirt_poly, fill=(30, 41, 59, 255), outline=(15, 23, 42, 255), width=2)

    # Vertical skirt pleat crease lines and shading
    pleats_x = [30, 44, 58, 72, 86, 100]
    for px in pleats_x:
        draw.line([(px, 26), (px + int((px - 65) * 0.2), 74)], fill=(15, 23, 42, 255), width=2)
        draw.line([(px + 3, 27), (px + 3 + int((px - 65) * 0.2), 73)], fill=(51, 65, 85, 255), width=1)

    # Hip socket round joints
    draw.ellipse([26, 45, 48, 67], fill=(255, 241, 238, 255), outline=(245, 210, 200, 255), width=2)
    draw.ellipse([82, 45, 104, 67], fill=(255, 241, 238, 255), outline=(245, 210, 200, 255), width=2)

    im.save(os.path.join(OUT_DIR, 'pelvis.png'))
    print("[OK] Created pelvis.png")

# -----------------------------------------------------------------------------
# 5. Upper Arm (Bắp Tay Áo Phồng Đồng Phục) - 55 x 85
# -----------------------------------------------------------------------------
def make_arm(side='l'):
    W, H = 55, 85
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Shoulder puffy sleeve
    draw.ellipse([8, 8, 47, 46], fill=(255, 255, 255, 255), outline=(203, 213, 225, 255), width=2)
    # Navy sleeve trim band
    draw.arc([11, 28, 44, 46], start=0, end=180, fill=(30, 41, 59, 255), width=3)

    # Slender skin upper arm emerging
    draw.rounded_rectangle([16, 38, 39, 76], radius=10, fill=(255, 241, 238, 255), outline=(245, 210, 200, 255), width=2)

    filename = f'arm_{side}.png'
    im.save(os.path.join(OUT_DIR, filename))
    print(f"[OK] Created {filename}")

# -----------------------------------------------------------------------------
# 6. Forearm & Delicate Hand (Cẳng Tay & Bàn Tay Nữ Sinh) - 55 x 85
# -----------------------------------------------------------------------------
def make_forearm(side='l'):
    W, H = 55, 85
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Elbow round joint cap
    draw.ellipse([16, 6, 38, 28], fill=(255, 241, 238, 255), outline=(245, 210, 200, 255), width=2)

    # Slender forearm
    draw.polygon([(17, 20), (37, 20), (35, 58), (19, 58)], fill=(255, 241, 238, 255), outline=(245, 210, 200, 255), width=2)

    # Delicate anime hand
    draw.ellipse([15, 54, 39, 78], fill=(255, 241, 238, 255), outline=(245, 210, 200, 255), width=2)

    # If right hand, draw cute brown school bag strap / handle
    if side == 'r':
        draw.arc([12, 60, 42, 80], start=30, end=150, fill=(120, 53, 15, 255), width=3)
        draw.rounded_rectangle([18, 70, 48, 84], radius=3, fill=(146, 64, 14, 255), outline=(120, 53, 15, 255))

    filename = f'forearm_{side}.png'
    im.save(os.path.join(OUT_DIR, filename))
    print(f"[OK] Created {filename}")

# -----------------------------------------------------------------------------
# 7. Thigh (Đùi & Tuyệt Đối Lĩnh Vực Zettai Ryouiki) - 60 x 95
# -----------------------------------------------------------------------------
def make_thigh(side='l'):
    W, H = 60, 95
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Hip top pivot cap
    draw.ellipse([14, 5, 46, 36], fill=(255, 241, 238, 255), outline=(245, 210, 200, 255), width=2)

    # Fair skin upper thigh
    draw.rounded_rectangle([14, 18, 46, 60], radius=12, fill=(255, 241, 238, 255), outline=(245, 210, 200, 255), width=2)

    # Top band of black thigh-high sock
    draw.rounded_rectangle([12, 54, 48, 88], radius=10, fill=(24, 24, 27, 255), outline=(9, 9, 11, 255), width=2)
    # Sock elastic rib
    draw.line([(14, 56), (46, 56)], fill=(63, 63, 70, 255), width=2)

    # Knee round joint cap
    draw.ellipse([16, 70, 44, 92], fill=(39, 39, 42, 255), outline=(9, 9, 11, 255), width=2)

    filename = f'thigh_{side}.png'
    im.save(os.path.join(OUT_DIR, filename))
    print(f"[OK] Created {filename}")

# -----------------------------------------------------------------------------
# 8. Shin & School Loafer (Cẳng Chân Tất Đen & Giày Học Sinh) - 65 x 95
# -----------------------------------------------------------------------------
def make_shin(side='l'):
    W, H = 65, 95
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Knee round joint cap
    draw.ellipse([18, 5, 46, 32], fill=(39, 39, 42, 255), outline=(9, 9, 11, 255), width=2)

    # Shin in sleek black sock
    draw.polygon([(18, 20), (46, 20), (44, 66), (20, 66)], fill=(24, 24, 27, 255), outline=(9, 9, 11, 255), width=2)
    # Sheen highlight along sock
    draw.line([(28, 24), (28, 62)], fill=(63, 63, 70, 255), width=2)

    # Brown Japanese School Loafer
    toe_offset = -5 if side == 'l' else 5
    loafer_box = [15, 62, 51 + abs(toe_offset), 88]
    draw.rounded_rectangle(loafer_box, radius=6, fill=(120, 53, 15, 255), outline=(69, 26, 3, 255), width=2)
    # Black sole
    draw.rounded_rectangle([15, 82, 51 + abs(toe_offset), 91], radius=2, fill=(15, 23, 42, 255))
    # Golden shoe buckle / strap
    draw.rectangle([26, 66, 40, 72], fill=(245, 158, 11, 255), outline=(180, 83, 9, 255))

    filename = f'shin_{side}.png'
    im.save(os.path.join(OUT_DIR, filename))
    print(f"[OK] Created {filename}")

def main():
    print(f"Generating Anime Schoolgirl character assets to: {OUT_DIR}")
    make_hair_back()
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
    print("Done! All 12 anime character parts generated successfully.")

if __name__ == '__main__':
    main()
