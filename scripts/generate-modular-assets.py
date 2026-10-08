#!/usr/bin/env python3
"""
Generate modular 2.5D architectural and nature texture assets with transparent backgrounds.
These clean modular textures allow '3D assemble 3D' where walls are bare, and doors,
windows, flower boxes, chimneys, and plants are separate 3D models attached via MCP.
"""
import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter

random.seed(42)
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'assembly_3d', 'modular')
os.makedirs(OUT_DIR, exist_ok=True)

def add_noise(im, factor=10):
    """Subtle texture grain."""
    w, h = im.size
    pixels = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                n = random.randint(-factor, factor)
                pixels[x, y] = (
                    max(0, min(255, r + n)),
                    max(0, min(255, g + n)),
                    max(0, min(255, b + n)),
                    a
                )
    return im

# -----------------------------------------------------------------------------
# 1. Front Gable Wall (1200 x 1320) - 100% Math-matched to 3D Gable House
# -----------------------------------------------------------------------------
def make_front_wall():
    # 3D dimensions: W = 600, H = 660 (vertical 400, gable rise 260).
    # 2x resolution: W = 1200, H = 1320.
    # Ground at Y = 1320. Eave line at Y = 520 (height = 800). Gable rise = 520 (Apex at Y = 0).
    W, H = 1200, 1320
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    apex = (W // 2, 6)
    left_eave = (12, 520)
    right_eave = (W - 12, 520)
    left_bottom = (12, H)
    right_bottom = (W - 12, H)

    wall_poly = [apex, right_eave, right_bottom, left_bottom, left_eave]

    # Stucco / lime plaster fill (creamy warm tone)
    draw.polygon(wall_poly, fill=(245, 240, 228, 255))

    # Stone ashlar plinth base (ground to Y = 1200, height 120px = 60 units in 3D)
    plinth_top = 1200
    for y in range(plinth_top, H):
        t = (y - plinth_top) / (H - plinth_top)
        c = int(145 - t * 30)
        draw.rectangle([(12, y), (W - 12, y + 1)], fill=(c, c - 8, c - 16, 255))

    # Stone ashlar block courses
    course_h = 30
    for r, sy in enumerate(range(plinth_top, H, course_h)):
        draw.line([(12, sy), (W - 12, sy)], fill=(85, 80, 75, 255), width=3)
        shift = 45 if (r % 2) else 0
        for sx in range(12 + shift, W - 12, 90):
            draw.line([(sx, sy), (sx, min(H, sy + course_h))], fill=(85, 80, 75, 255), width=2)

    # Dark oak timber beams (half-timbered Tudor structure)
    timber_color = (62, 40, 26, 255)
    timber_hl = (90, 60, 38, 255)
    timber_sh = (38, 24, 15, 255)

    # Bargeboards along roof slopes
    barge_w = 26
    draw.polygon([apex, (apex[0] + barge_w, apex[1]), (right_eave[0], right_eave[1] + barge_w), right_eave], fill=timber_color)
    draw.polygon([apex, (apex[0] - barge_w, apex[1]), (left_eave[0], left_eave[1] + barge_w), left_eave], fill=timber_color)

    # Main jetty beam at floor division (Y = 520, height 36px)
    draw.rectangle([(12, 502), (W - 12, 538)], fill=timber_color)
    draw.line([(12, 502), (W - 12, 502)], fill=timber_hl, width=3)
    draw.line([(12, 538), (W - 12, 538)], fill=timber_sh, width=3)

    # Base sill beam above stone plinth (Y = 1200)
    draw.rectangle([(12, 1182), (W - 12, 1208)], fill=timber_color)
    draw.line([(12, 1182), (W - 12, 1182)], fill=timber_hl, width=2)
    draw.line([(12, 1208), (W - 12, 1208)], fill=timber_sh, width=2)

    # Ground floor vertical posts (corner posts & studs framing center doorway)
    # Door opening spans X = 430 to 770. Posts are placed outside door.
    posts_x = [30, 220, 390, 810, 980, W - 30]
    for px in posts_x:
        draw.rectangle([(px - 16, 538), (px + 16, 1182)], fill=timber_color)
        draw.line([(px - 16, 538), (px - 16, 1182)], fill=timber_hl, width=2)
        draw.line([(px + 16, 538), (px + 16, 1182)], fill=timber_sh, width=2)

    # Ground floor diagonal braces
    draw.line([(30, 1182), (220, 860)], fill=timber_color, width=20)
    draw.line([(220, 860), (390, 1182)], fill=timber_color, width=20)
    draw.line([(W - 30, 1182), (980, 860)], fill=timber_color, width=20)
    draw.line([(980, 860), (810, 1182)], fill=timber_color, width=20)

    # Upper floor / attic gable framing (frames center attic window)
    # Window spans X = 450 to 750, Y = 620 to 1000
    # King post in peak
    draw.rectangle([(W // 2 - 16, 6), (W // 2 + 16, 260)], fill=timber_color)

    # Diagonal gable diamond braces
    draw.line([(260, 502), (W // 2, 260)], fill=timber_color, width=22)
    draw.line([(W - 260, 502), (W // 2, 260)], fill=timber_color, width=22)
    draw.line([(120, 502), (W // 2 - 160, 360)], fill=timber_color, width=20)
    draw.line([(W - 120, 502), (W // 2 + 160, 360)], fill=timber_color, width=20)

    # Upper vertical studs framing window
    draw.rectangle([(390, 502), (416, 760)], fill=timber_color)
    draw.rectangle([(784, 502), (810, 760)], fill=timber_color)

    add_noise(im, 8)
    im.save(os.path.join(OUT_DIR, 'wall_front_tudor.png'), 'PNG')
    print('Generated wall_front_tudor.png (1200x1320)')

# -----------------------------------------------------------------------------
# 2. Side Wall (1200 x 800) - 100% Math-matched to 3D Side Face (600 x 400)
# -----------------------------------------------------------------------------
def make_side_wall():
    W, H = 1200, 800
    im = Image.new('RGBA', (W, H), (245, 240, 228, 255))
    draw = ImageDraw.Draw(im)

    # Stone plinth base (bottom 120px)
    plinth_top = H - 120
    for y in range(plinth_top, H):
        t = (y - plinth_top) / 120
        c = int(145 - t * 30)
        draw.rectangle([(0, y), (W, y + 1)], fill=(c, c - 8, c - 16, 255))
    for r, sy in enumerate(range(plinth_top, H, 30)):
        draw.line([(0, sy), (W, sy)], fill=(85, 80, 75, 255), width=3)
        shift = 45 if (r % 2) else 0
        for sx in range(shift, W, 90):
            draw.line([(sx, sy), (sx, min(H, sy + 30))], fill=(85, 80, 75, 255), width=2)

    timber_color = (62, 40, 26, 255)
    timber_hl = (90, 60, 38, 255)
    timber_sh = (38, 24, 15, 255)

    # Perimeter wall plate & base sill
    draw.rectangle([(0, 0), (W, 30)], fill=timber_color)
    draw.rectangle([(0, plinth_top - 24), (W, plinth_top + 4)], fill=timber_color)
    draw.rectangle([(0, 0), (30, H)], fill=timber_color)
    draw.rectangle([(W - 30, 0), (W, H)], fill=timber_color)

    # Mid rail at Y = 360
    draw.rectangle([(0, 345), (W, 375)], fill=timber_color)

    # Vertical intermediate posts
    for x in [240, 480, 720, 960]:
        draw.rectangle([(x - 14, 30), (x + 14, plinth_top - 24)], fill=timber_color)
        draw.line([(x - 14, 30), (x - 14, plinth_top - 24)], fill=timber_hl, width=2)
        draw.line([(x + 14, 30), (x + 14, plinth_top - 24)], fill=timber_sh, width=2)

    # Diagonal bracing struts
    for i, x in enumerate([30, 240, 720, 960]):
        if i % 2 == 0:
            draw.line([(x + 14, plinth_top - 24), (x + 226, 375)], fill=timber_color, width=18)
        else:
            draw.line([(x + 14, 345), (x + 226, 30)], fill=timber_color, width=18)

    add_noise(im, 8)
    im.save(os.path.join(OUT_DIR, 'wall_side_tudor.png'), 'PNG')
    print('Generated wall_side_tudor.png (1200x800)')

# -----------------------------------------------------------------------------
# 3. Terracotta Roof Slope (1320 x 794) - Math-matched to Roof (660 x 397)
# -----------------------------------------------------------------------------
def make_roof():
    W, H = 1320, 794
    im = Image.new('RGBA', (W, H), (185, 76, 46, 255))
    draw = ImageDraw.Draw(im)

    row_h = 36
    col_w = 48
    for r, y in enumerate(range(0, H, row_h)):
        shift = (col_w // 2) if (r % 2) else 0
        for x in range(-col_w + shift, W + col_w, col_w):
            base_r = random.randint(172, 208)
            base_g = random.randint(66, 88)
            base_b = random.randint(42, 58)
            draw.rectangle([(x, y), (x + col_w - 4, y + row_h + 10)], fill=(base_r, base_g, base_b, 255))
            draw.line([(x, y + row_h + 10), (x + col_w - 4, y + row_h + 10)], fill=(105, 38, 22, 255), width=3)
            draw.line([(x, y), (x, y + row_h + 10)], fill=(min(255, base_r + 32), base_g + 16, base_b + 12, 255), width=2)
            draw.line([(x + col_w - 4, y), (x + col_w - 4, y + row_h + 10)], fill=(max(0, base_r - 42), max(0, base_g - 22), max(0, base_b - 16), 255), width=2)

    # Weathered moss accents along bottom eave
    for y in range(H - 60, H):
        for x in range(0, W, random.randint(5, 14)):
            if random.random() < 0.45:
                draw.ellipse([(x, y), (x + random.randint(8, 20), y + random.randint(4, 10))], fill=(75, 110, 50, 210))

    add_noise(im, 8)
    im.save(os.path.join(OUT_DIR, 'roof_terracotta.png'), 'PNG')
    print('Generated roof_terracotta.png (1320x794)')

# -----------------------------------------------------------------------------
# 4. Modular Window 3D Texture (400 x 520) - Math-matched (200 x 260)
# -----------------------------------------------------------------------------
def make_window():
    W, H = 400, 520
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Molded stone sill at bottom
    draw.polygon([(25, 465), (W - 25, 465), (W - 12, 510), (12, 510)], fill=(162, 156, 146, 255))
    draw.line([(12, 510), (W - 12, 510)], fill=(108, 102, 96, 255), width=3)
    draw.line([(25, 465), (W - 25, 465)], fill=(205, 198, 188, 255), width=2)

    # Carved oak frame
    draw.rectangle([(55, 30), (W - 55, 465)], fill=(56, 36, 22, 255))
    draw.rectangle([(55, 30), (W - 55, 465)], outline=(88, 58, 36, 255), width=5)

    # Sky reflective glass with clipped leaded came grid
    gw = (W - 78) - 78
    gh = 445 - 50
    glass_im = Image.new('RGBA', (gw, gh), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glass_im)
    for y in range(gh):
        t = y / gh
        r = int(140 + t * 40)
        g = int(178 + t * 42)
        b = int(214 + t * 32)
        g_draw.line([(0, y), (gw, y)], fill=(r, g, b, 245))

    grid_color = (32, 32, 36, 255)
    for d in range(-gh, gw + gh, 38):
        g_draw.line([(d, 0), (d + gh, gh)], fill=grid_color, width=2)
        g_draw.line([(d, gh), (d + gh, 0)], fill=grid_color, width=2)

    # Window cross mullion inside glass
    g_draw.rectangle([(gw // 2 - 6, 0), (gw // 2 + 6, gh)], fill=(56, 36, 22, 255))
    g_draw.rectangle([(0, gh // 2 - 6), (gw, gh // 2 + 6)], fill=(56, 36, 22, 255))
    im.alpha_composite(glass_im, (78, 50))

    # Louvered shutters on Left and Right sides
    for shutter_x in [16, W - 58]:
        sw, sh = 42, 410
        sy = 40
        draw.rectangle([(shutter_x, sy), (shutter_x + sw, sy + sh)], fill=(76, 50, 32, 255))
        draw.rectangle([(shutter_x, sy), (shutter_x + sw, sy + sh)], outline=(40, 26, 16, 255), width=2)
        for ly in range(sy + 10, sy + sh - 10, 14):
            draw.line([(shutter_x + 4, ly), (shutter_x + sw - 4, ly + 4)], fill=(102, 68, 42, 255), width=2)
            draw.line([(shutter_x + 4, ly + 2), (shutter_x + sw - 4, ly + 6)], fill=(34, 20, 12, 255), width=1)
        # Hinges
        draw.rectangle([(shutter_x + 2, sy + 35), (shutter_x + 16, sy + 43)], fill=(24, 24, 28, 255))
        draw.rectangle([(shutter_x + 2, sy + sh - 50), (shutter_x + 16, sy + sh - 42)], fill=(24, 24, 28, 255))

    add_noise(im, 8)
    im.save(os.path.join(OUT_DIR, 'decor_window.png'), 'PNG')
    print('Generated decor_window.png (400x520)')

# -----------------------------------------------------------------------------
# 5. Modular Arched Door 3D Texture (330 x 600) - Math-matched (220 x 400)
# -----------------------------------------------------------------------------
def make_door():
    W, H = 330, 600
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Carved stone portal archway
    arch_color = (152, 144, 132, 255)
    arch_sh = (96, 90, 82, 255)
    arch_hl = (194, 188, 176, 255)

    # Outer stone portal with smooth curved arch
    draw.rectangle([(12, 160), (W - 12, H - 20)], fill=arch_color)
    draw.ellipse([(12, 15), (W - 12, 310)], fill=arch_color)
    for y in range(180, H - 20, 44):
        draw.line([(12, y), (42, y)], fill=arch_sh, width=2)
        draw.line([(W - 42, y), (W - 12, y)], fill=arch_sh, width=2)

    # Door opening cavity with matching arch top
    door_box = [42, 160, W - 42, H - 20]
    draw.rectangle(door_box, fill=(52, 34, 20, 255))
    draw.ellipse([42, 45, W - 42, 275], fill=(52, 34, 20, 255))

    # Heavy vertical oak planks
    plank_w = (W - 84) // 4
    for i in range(4):
        px = 42 + i * plank_w
        for x in range(px, px + plank_w):
            g = int(70 - abs(x - (px + plank_w // 2)) * 1.6)
            draw.line([(x, 160), (x, H - 20)], fill=(g, int(g * 0.64), int(g * 0.4), 255))
        draw.line([(px, 160), (px, H - 20)], fill=(24, 15, 10, 255), width=2)

    # Wrought iron strap hinges
    hinge_color = (24, 24, 28, 255)
    for hy in [200, 360, 510]:
        draw.polygon([(42, hy - 7), (W - 75, hy - 4), (W - 60, hy), (W - 75, hy + 4), (42, hy + 7)], fill=hinge_color)
        for rx in [65, 115, 175]:
            draw.ellipse([(rx - 4, hy - 4), (rx + 4, hy + 4)], fill=(55, 55, 60, 255))

    # Ring door knocker & keyhole
    draw.ellipse([(W // 2 - 14, 320), (W // 2 + 14, 348)], outline=hinge_color, width=4)
    draw.ellipse([(W // 2 - 5, 314), (W // 2 + 5, 324)], fill=hinge_color)

    # Cut-stone step threshold at bottom (resting on ground)
    draw.rectangle([(16, H - 22), (W - 16, H)], fill=(175, 170, 160, 255))
    draw.line([(16, H - 22), (W - 16, H - 22)], fill=(215, 210, 200, 255), width=2)
    draw.line([(16, H), (W - 16, H)], fill=(120, 115, 105, 255), width=2)

    add_noise(im, 8)
    im.save(os.path.join(OUT_DIR, 'decor_door.png'), 'PNG')
    print('Generated decor_door.png (330x600)')

# -----------------------------------------------------------------------------
# 6. Modular Brick Chimney Texture (220 x 520) - Math-matched (110 x 260)
# -----------------------------------------------------------------------------
def make_chimney():
    W, H = 220, 520
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Corbelled stone crown cap
    draw.rectangle([(25, 60), (W - 25, 105)], fill=(176, 170, 160, 255))
    draw.polygon([(35, 105), (W - 35, 105), (W - 18, 60), (18, 60)], fill=(192, 186, 176, 255))

    # Terracotta chimney pot on top
    draw.polygon([(W // 2 - 25, 60), (W // 2 + 25, 60), (W // 2 + 20, 12), (W // 2 - 20, 12)], fill=(198, 84, 46, 255))
    draw.ellipse([(W // 2 - 20, 6), (W // 2 + 20, 18)], fill=(156, 62, 32, 255))
    draw.ellipse([(W // 2 - 14, 8), (W // 2 + 14, 14)], fill=(30, 20, 18, 255))

    # Red brickwork body in English bond
    draw.rectangle([(30, 105), (W - 30, H)], fill=(162, 66, 46, 255))
    brick_h = 18
    brick_w = 38
    for r, by in enumerate(range(105, H, brick_h)):
        draw.line([(30, by), (W - 30, by)], fill=(216, 212, 202, 255), width=2)
        shift = (brick_w // 2) if (r % 2) else 0
        for bx in range(30 + shift, W - 30, brick_w):
            draw.line([(bx, by), (bx, min(H, by + brick_h))], fill=(216, 212, 202, 255), width=2)
            x1, y1 = bx + 2, by + 2
            x2, y2 = min(W - 32, bx + brick_w - 2), min(H - 2, by + brick_h - 2)
            b_val = random.randint(-18, 18)
            if x2 >= x1 and y2 >= y1:
                draw.rectangle([(x1, y1), (x2, y2)],
                               fill=(max(0, min(255, 168 + b_val)), max(0, min(255, 70 + b_val // 2)), max(0, min(255, 48 + b_val // 3)), 255))

    add_noise(im, 8)
    im.save(os.path.join(OUT_DIR, 'decor_chimney.png'), 'PNG')
    print('Generated decor_chimney.png (220x520)')

# -----------------------------------------------------------------------------
# 7. Modular Flower Planter Box (400 x 200) - Snugs under window sill
# -----------------------------------------------------------------------------
def make_flower_box():
    W, H = 400, 200
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Wooden planter trough (middle height)
    trough_poly = [(30, 110), (W - 30, 110), (W - 45, 185), (45, 185)]
    draw.polygon(trough_poly, fill=(82, 54, 35, 255))
    draw.polygon(trough_poly, outline=(50, 32, 20, 255), width=3)
    draw.line([(36, 145), (W - 36, 145)], fill=(58, 36, 22, 255), width=2)

    # Brass/iron mounting brackets
    draw.rectangle([(65, 110), (78, 188)], fill=(36, 36, 40, 255))
    draw.rectangle([(W - 78, 110), (W - 65, 188)], fill=(36, 36, 40, 255))

    # Dense lush foliage spilling over trough
    for _ in range(240):
        fx = random.randint(20, W - 20)
        fy = random.randint(30, 125)
        rad = random.randint(7, 18)
        c_green = (random.randint(42, 78), random.randint(122, 178), random.randint(46, 82), 245)
        draw.ellipse([(fx - rad, fy - rad), (fx + rad, fy + rad)], fill=c_green)

    # Trailing ivy tendrils below trough
    for vx in range(50, W - 50, 16):
        vlen = random.randint(15, 45)
        draw.arc([(vx - 10, 175), (vx + 10, 175 + vlen)], start=0, end=180, fill=(52, 134, 52, 235), width=3)

    # Colorful blossoms (Red geraniums, pink petunias, yellow daisies, white alyssum)
    flower_palette = [
        (232, 46, 56, 255),
        (246, 96, 146, 255),
        (255, 218, 62, 255),
        (255, 255, 255, 255),
        (178, 112, 222, 255)
    ]
    for _ in range(85):
        bx = random.randint(30, W - 30)
        by = random.randint(35, 115)
        col = random.choice(flower_palette)
        pet_rad = random.randint(5, 8)
        for ang in range(0, 360, 72):
            rad_a = math.radians(ang)
            px = int(bx + math.cos(rad_a) * (pet_rad * 0.8))
            py = int(by + math.sin(rad_a) * (pet_rad * 0.8))
            draw.ellipse([(px - pet_rad // 2, py - pet_rad // 2), (px + pet_rad // 2, py + pet_rad // 2)], fill=col)
        draw.ellipse([(bx - 2, by - 2), (bx + 2, by + 2)], fill=(255, 232, 92, 255))

    im.save(os.path.join(OUT_DIR, 'decor_flower_box.png'), 'PNG')
    print('Generated decor_flower_box.png (400x200)')

# -----------------------------------------------------------------------------
# 8. High-Fidelity Realistic Foliage Bush / Shrub (600 x 500)
# -----------------------------------------------------------------------------
def make_bush():
    """
    Renders an organic, natural 2.5D foliage shrub with:
    - Branching woody stems visible through lower foliage
    - Clustered leaf sprigs with pointed tips and veins
    - Multi-tone ambient occlusion (deep interior shadow to golden sunlit canopy)
    - Natural serrated perimeter silhouette (no artificial flat bubble)
    - Delicate wild white/blush jasmine flower blossoms
    """
    W, H = 600, 500
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # 1. Woody branches & inner root stems (Pass 1 - strictly internal)
    root_x, root_y = W // 2, H - 20
    boughs = [
        (-48, 140, 12),
        (-28, 170, 14),
        (-10, 190, 16),
        (10, 190, 16),
        (28, 170, 14),
        (48, 140, 12),
    ]
    twig_color = (48, 30, 18, 255)
    twig_hl = (78, 50, 28, 255)
    for ang_deg, length, thick in boughs:
        rad = math.radians(ang_deg - 90)
        bx = root_x + math.cos(rad) * length
        by = root_y + math.sin(rad) * length
        draw.line([(root_x, root_y), (bx, by)], fill=twig_color, width=thick)
        draw.line([(root_x - 1, root_y), (bx - 1, by)], fill=twig_hl, width=max(1, thick // 4))
        for t_off in [-20, 20]:
            sub_rad = rad + math.radians(t_off)
            sx = bx + math.cos(sub_rad) * (length * 0.35)
            sy = by + math.sin(sub_rad) * (length * 0.35)
            draw.line([(bx, by), (sx, sy)], fill=twig_color, width=max(2, thick // 2))

    # Helper: draw an oriented natural leaf
    def draw_leaf(cx, cy, length, width, angle_deg, color, vein_color=None):
        rad = math.radians(angle_deg)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        tip_x = cx + cos_a * (length * 0.6)
        tip_y = cy + sin_a * (length * 0.6)
        base_x = cx - cos_a * (length * 0.4)
        base_y = cy - sin_a * (length * 0.4)
        left_x = cx - sin_a * (width * 0.5)
        left_y = cy + cos_a * (width * 0.5)
        right_x = cx + sin_a * (width * 0.5)
        right_y = cy - cos_a * (width * 0.5)
        draw.polygon([(base_x, base_y), (left_x, left_y), (tip_x, tip_y), (right_x, right_y)], fill=color)
        if vein_color:
            draw.line([(base_x, base_y), (tip_x, tip_y)], fill=vein_color, width=1)

    # 2. Foliage cluster centers (full, dense, natural mounded shrub)
    clusters = [
        # Base shadow clusters
        (W // 2, 400, 95, 0, 90),
        (200, 390, 90, 0, 135),
        (400, 390, 90, 0, 45),

        # Mid interior tier
        (130, 320, 105, 1, 150),
        (220, 290, 120, 1, 120),
        (300, 290, 125, 1, 90),
        (380, 290, 120, 1, 60),
        (470, 320, 105, 1, 30),

        # Upper tier
        (160, 210, 100, 2, 140),
        (250, 170, 115, 2, 110),
        (350, 170, 115, 2, 70),
        (440, 210, 100, 2, 40),
        (W // 2, 140, 110, 2, 90),
    ]

    # PASS 1: Deep shadow / ambient occlusion under-canopy
    for cx, cy, rad, tier, base_ang in clusters:
        n_leaves = 90 if tier == 0 else 65
        for _ in range(n_leaves):
            dist = random.uniform(0, rad * 0.85)
            ang = random.uniform(0, 360)
            lx = cx + math.cos(math.radians(ang)) * dist
            ly = cy + math.sin(math.radians(ang)) * dist * 0.85
            leaf_ang = math.degrees(math.atan2(ly - cy, lx - cx)) + random.uniform(-20, 20)
            leaf_len = random.randint(18, 30)
            leaf_w = random.randint(9, 15)
            c = (random.randint(18, 30), random.randint(40, 62), random.randint(22, 38), 245)
            draw_leaf(lx, ly, leaf_len, leaf_w, leaf_ang, c, (12, 26, 14, 255))

    # PASS 2: Mid-tone lush garden foliage
    for cx, cy, rad, tier, base_ang in clusters:
        n_leaves = 130
        for _ in range(n_leaves):
            dist = random.uniform(0, rad * 1.05)
            ang = random.uniform(0, 360)
            lx = cx + math.cos(math.radians(ang)) * dist
            ly = cy + math.sin(math.radians(ang)) * dist * 0.85
            leaf_ang = math.degrees(math.atan2(ly - cy, lx - cx)) + random.uniform(-15, 15)
            leaf_len = random.randint(16, 26)
            leaf_w = random.randint(8, 13)
            # Rich emerald & olive foliage
            r = random.randint(38, 64)
            g = random.randint(85, 130)
            b = random.randint(36, 60)
            draw_leaf(lx, ly, leaf_len, leaf_w, leaf_ang, (r, g, b, 250), (r - 18, g - 25, b - 14, 255))

    # PASS 3: Canopy surface & sunlit highlights (Top & sunward side)
    for cx, cy, rad, tier, base_ang in clusters:
        if tier < 1:
            continue
        n_leaves = 70
        for _ in range(n_leaves):
            dist = random.uniform(0.2 * rad, rad * 1.15)
            ang = random.uniform(0, 360)
            lx = cx + math.cos(math.radians(ang)) * dist
            ly = cy + math.sin(math.radians(ang)) * dist * 0.85
            # Bias towards top / sunlit directions
            if ly > cy + rad * 0.4:
                continue
            leaf_ang = math.degrees(math.atan2(ly - cy, lx - cx)) + random.uniform(-12, 12)
            leaf_len = random.randint(14, 22)
            leaf_w = random.randint(7, 11)
            # Warm lime / spring green highlights
            r = random.randint(82, 135)
            g = random.randint(145, 195)
            b = random.randint(48, 80)
            draw_leaf(lx, ly, leaf_len, leaf_w, leaf_ang, (r, g, b, 255), (r + 25, g + 25, b + 15, 255))

    # PASS 4: Perimeter organic leaf tips (guarantees jagged natural silhouette)
    for cx, cy, rad, tier, base_ang in clusters:
        for ang in range(0, 360, 18):
            rad_a = math.radians(ang)
            dist = rad * random.uniform(0.95, 1.22)
            lx = cx + math.cos(rad_a) * dist
            ly = cy + math.sin(rad_a) * dist * 0.85
            if ly > H - 35:
                continue
            leaf_ang = ang + random.uniform(-10, 10)
            leaf_len = random.randint(16, 24)
            leaf_w = random.randint(8, 12)
            # Mix of midtone and highlight on tips
            r = random.randint(65, 115)
            g = random.randint(120, 175)
            b = random.randint(42, 70)
            draw_leaf(lx, ly, leaf_len, leaf_w, leaf_ang, (r, g, b, 255), (r + 20, g + 20, b + 10, 255))

    # PASS 5: Wild Jasmine/Hydrangea Blossom Sprays (delicate, natural)
    blossom_clusters = [
        (180, 240), (280, 190), (380, 210), (450, 270),
        (230, 320), (350, 310), (W // 2, 160)
    ]
    for bc_x, bc_y in blossom_clusters:
        for _ in range(12):
            bx = bc_x + random.randint(-28, 28)
            by = bc_y + random.randint(-22, 22)
            pet_rad = random.randint(3, 5)
            petal_col = (252, 250, 242, 250) if random.random() < 0.75 else (255, 228, 235, 250)
            for ang in range(0, 360, 72):
                rad_a = math.radians(ang)
                px = int(bx + math.cos(rad_a) * (pet_rad * 0.85))
                py = int(by + math.sin(rad_a) * (pet_rad * 0.85))
                draw.ellipse([(px - pet_rad // 2, py - pet_rad // 2), (px + pet_rad // 2, py + pet_rad // 2)], fill=petal_col)
            draw.ellipse([(bx - 1, by - 1), (bx + 1, by + 1)], fill=(255, 215, 60, 255))

    add_noise(im, 6)
    im.save(os.path.join(OUT_DIR, 'nature_bush.png'), 'PNG')
    print('Generated nature_bush.png (600x500) - Realistic Organic Foliage')

if __name__ == '__main__':
    make_front_wall()
    make_side_wall()
    make_roof()
    make_window()
    make_door()
    make_chimney()
    make_flower_box()
    make_bush()
    print('All 8 high-fidelity modular 3D textures generated successfully!')
