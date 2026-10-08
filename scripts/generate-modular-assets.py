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

def add_noise(im, factor=12):
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
# 1. Front Gable Wall (980 x 966) - Clean Tudor wall WITHOUT baked door/window
# -----------------------------------------------------------------------------
def make_front_wall():
    W, H = 980, 966
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Dimensions: Side wall height 393, eave overhang at y = 483, apex at top
    # Gable roof geometry: Apex at (490, 20), left eave at (30, 483), right eave at (950, 483)
    # Ground at bottom Y = 966
    apex = (W // 2, 24)
    left_eave = (20, 475)
    right_eave = (W - 20, 475)
    left_bottom = (40, H)
    right_bottom = (W - 40, H)

    wall_poly = [apex, right_eave, right_bottom, left_bottom, left_eave]

    # Stucco / plaster fill (creamy warm tone)
    draw.polygon(wall_poly, fill=(244, 238, 224, 255))

    # Stone plinth base (ground to Y = 900)
    for y in range(880, H):
        t = (y - 880) / (H - 880)
        c = int(140 - t * 30)
        draw.rectangle([(40, y), (W - 40, y + 1)], fill=(c, c - 8, c - 15, 255))
    
    # Stone courses texture in plinth
    for sy in range(885, H, 24):
        draw.line([(40, sy), (W - 40, sy)], fill=(90, 85, 80, 255), width=2)
        offset = 35 if (sy // 24) % 2 else 0
        for sx in range(40 + offset, W - 40, 70):
            draw.line([(sx, sy), (sx, min(H, sy + 24))], fill=(90, 85, 80, 255), width=2)

    # Dark oak timber beams (half-timbered Tudor structure)
    timber_color = (65, 42, 28, 255)
    timber_highlight = (92, 60, 40, 255)
    timber_shadow = (42, 26, 16, 255)

    def draw_beam(poly):
        draw.polygon(poly, fill=timber_color)
        # Highlight top/left
        draw.line([poly[0], poly[1]], fill=timber_highlight, width=2)
        # Shadow bottom/right
        draw.line([poly[2], poly[3]], fill=timber_shadow, width=2)

    # Perimeter gable bargeboards
    draw.polygon([apex, (apex[0] + 28, apex[1]), (right_eave[0] + 16, right_eave[1] + 24), right_eave], fill=timber_color)
    draw.polygon([apex, (apex[0] - 28, apex[1]), (left_eave[0] - 16, left_eave[1] + 24), left_eave], fill=timber_color)

    # Horizontal jetty beam at floor division (Y = 475)
    draw.rectangle([(20, 465), (W - 20, 492)], fill=timber_color)
    draw.line([(20, 465), (W - 20, 465)], fill=timber_highlight, width=3)
    draw.line([(20, 492), (W - 20, 492)], fill=timber_shadow, width=3)

    # Horizontal sill beam above stone base (Y = 880)
    draw.rectangle([(40, 870), (W - 40, 892)], fill=timber_color)

    # Vertical main posts (corner posts & central studs)
    posts_x = [60, 230, 400, 580, 750, W - 60]
    for px in posts_x:
        # Ground floor posts
        draw.rectangle([(px - 14, 492), (px + 14, 870)], fill=timber_color)
        draw.line([(px - 14, 492), (px - 14, 870)], fill=timber_highlight, width=2)
        draw.line([(px + 14, 492), (px + 14, 870)], fill=timber_shadow, width=2)

    # Upper floor / attic beams (diagonal Tudor diamond bracing)
    upper_posts = [180, 340, 500, 660, 820]
    for upx in upper_posts:
        # calculate roof line y at upx
        dist_from_center = abs(upx - W // 2)
        roof_y = apex[1] + (dist_from_center / (W // 2)) * (left_eave[1] - apex[1])
        if roof_y < 465:
            draw.rectangle([(upx - 12, int(roof_y + 10)), (upx + 12, 465)], fill=timber_color)

    # Decorative curved Tudor braces in the attic
    draw.line([(220, 465), (340, 280)], fill=timber_color, width=16)
    draw.line([(760, 465), (640, 280)], fill=timber_color, width=16)
    draw.line([(340, 280), (W // 2, 120)], fill=timber_color, width=16)
    draw.line([(640, 280), (W // 2, 120)], fill=timber_color, width=16)

    # Subtle plaster stippling
    add_noise(im, 10)
    im.save(os.path.join(OUT_DIR, 'wall_front_tudor.png'), 'PNG')
    print('Generated wall_front_tudor.png')

# -----------------------------------------------------------------------------
# 2. Side Wall (840 x 393) - Clean half-timbered wall
# -----------------------------------------------------------------------------
def make_side_wall():
    W, H = 840, 393
    im = Image.new('RGBA', (W, H), (244, 238, 224, 255))
    draw = ImageDraw.Draw(im)

    # Stone plinth base (bottom 70px)
    for y in range(H - 70, H):
        t = (y - (H - 70)) / 70
        c = int(140 - t * 30)
        draw.rectangle([(0, y), (W, y + 1)], fill=(c, c - 8, c - 15, 255))
    for sy in range(H - 65, H, 22):
        draw.line([(0, sy), (W, sy)], fill=(90, 85, 80, 255), width=2)
        offset = 30 if (sy // 22) % 2 else 0
        for sx in range(offset, W, 65):
            draw.line([(sx, sy), (sx, min(H, sy + 22))], fill=(90, 85, 80, 255), width=2)

    timber_color = (65, 42, 28, 255)
    timber_hl = (92, 60, 40, 255)
    timber_sh = (42, 26, 16, 255)

    # Perimeter frame
    draw.rectangle([(0, 0), (W, 24)], fill=timber_color)  # top wall-plate
    draw.rectangle([(0, H - 74), (W, H - 52)], fill=timber_color)  # base sill
    draw.rectangle([(0, 0), (22, H)], fill=timber_color)  # left corner post
    draw.rectangle([(W - 22, 0), (W, H)], fill=timber_color)  # right corner post

    # Vertical intermediate posts
    for x in range(160, W - 100, 170):
        draw.rectangle([(x - 12, 24), (x + 12, H - 74)], fill=timber_color)
        draw.line([(x - 12, 24), (x - 12, H - 74)], fill=timber_hl, width=2)
        draw.line([(x + 12, 24), (x + 12, H - 74)], fill=timber_sh, width=2)

    # Diagonal bracing struts
    for i, x in enumerate(range(22, W - 180, 170)):
        if i % 2 == 0:
            draw.line([(x + 12, H - 74), (x + 158, 24)], fill=timber_color, width=14)
        else:
            draw.line([(x + 12, 24), (x + 158, H - 74)], fill=timber_color, width=14)

    add_noise(im, 10)
    im.save(os.path.join(OUT_DIR, 'wall_side_tudor.png'), 'PNG')
    print('Generated wall_side_tudor.png')

# -----------------------------------------------------------------------------
# 3. Terracotta Roof Slope (840 x 608)
# -----------------------------------------------------------------------------
def make_roof():
    W, H = 840, 608
    im = Image.new('RGBA', (W, H), (180, 75, 48, 255))
    draw = ImageDraw.Draw(im)

    # Clay tile courses (overlapping rows)
    row_h = 32
    col_w = 44
    for r, y in enumerate(range(0, H, row_h)):
        # alternate row tile color
        shift = (col_w // 2) if (r % 2) else 0
        for x in range(-col_w + shift, W + col_w, col_w):
            base_r = random.randint(170, 205)
            base_g = random.randint(65, 85)
            base_b = random.randint(40, 55)
            # rounded tile bottom
            draw.rectangle([(x, y), (x + col_w - 4, y + row_h + 8)], fill=(base_r, base_g, base_b, 255))
            # tile shadow at bottom edge
            draw.line([(x, y + row_h + 8), (x + col_w - 4, y + row_h + 8)], fill=(110, 40, 25, 255), width=3)
            # highlight left edge
            draw.line([(x, y), (x, y + row_h + 8)], fill=(min(255, base_r + 30), base_g + 15, base_b + 10, 255), width=2)
            # shadow right edge
            draw.line([(x + col_w - 4, y), (x + col_w - 4, y + row_h + 8)], fill=(max(0, base_r - 40), max(0, base_g - 20), max(0, base_b - 15), 255), width=2)

    # Weathered moss accents along bottom eave
    for y in range(H - 45, H):
        for x in range(0, W, random.randint(4, 12)):
            if random.random() < 0.4:
                draw.ellipse([(x, y), (x + random.randint(6, 16), y + random.randint(3, 8))], fill=(80, 115, 55, 200))

    add_noise(im, 8)
    im.save(os.path.join(OUT_DIR, 'roof_terracotta.png'), 'PNG')
    print('Generated roof_terracotta.png')

# -----------------------------------------------------------------------------
# 4. Modular Window 3D Texture (320 x 400) - Transparent Background
# -----------------------------------------------------------------------------
def make_window():
    W, H = 320, 400
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Stone sill at bottom
    draw.polygon([(20, 360), (W - 20, 360), (W - 10, 390), (10, 390)], fill=(160, 155, 145, 255))
    draw.line([(10, 390), (W - 10, 390)], fill=(110, 105, 100, 255), width=3)
    draw.line([(20, 360), (W - 20, 360)], fill=(200, 195, 185, 255), width=2)

    # Carved oak frame
    frame_box = [50, 40, W - 50, 360]
    draw.rectangle(frame_box, fill=(55, 35, 22, 255))
    draw.rectangle([50, 40, W - 50, 360], outline=(85, 55, 35, 255), width=4)

    # Window panes background (soft reflective sky glass)
    glass_box = [70, 60, W - 70, 340]
    for y in range(glass_box[1], glass_box[3]):
        t = (y - glass_box[1]) / (glass_box[3] - glass_box[1])
        r = int(140 + t * 40)
        g = int(175 + t * 45)
        b = int(210 + t * 35)
        draw.line([(glass_box[0], y), (glass_box[2], y)], fill=(r, g, b, 240))

    # Diamond leaded glass grid (Mullions & cames)
    grid_color = (35, 35, 40, 255)
    for d in range(-200, 400, 36):
        # / diagonal
        draw.line([(glass_box[0], glass_box[1] + d), (glass_box[2], glass_box[1] + d + (glass_box[2] - glass_box[0]))], fill=grid_color, width=2)
        # \ diagonal
        draw.line([(glass_box[0], glass_box[3] - d), (glass_box[2], glass_box[3] - d - (glass_box[2] - glass_box[0]))], fill=grid_color, width=2)

    # Window division mullion cross
    draw.rectangle([(W // 2 - 5, glass_box[1]), (W // 2 + 5, glass_box[3])], fill=(55, 35, 22, 255))
    draw.rectangle([(glass_box[0], (glass_box[1] + glass_box[3]) // 2 - 5), (glass_box[2], (glass_box[1] + glass_box[3]) // 2 + 5)], fill=(55, 35, 22, 255))

    # Louvered shutters on Left and Right sides
    for shutter_x, is_left in [(14, True), (W - 50, False)]:
        sw, sh = 36, 310
        sy = 45
        draw.rectangle([(shutter_x, sy), (shutter_x + sw, sy + sh)], fill=(75, 48, 30, 255))
        draw.rectangle([(shutter_x, sy), (shutter_x + sw, sy + sh)], outline=(40, 25, 15, 255), width=2)
        # Louver slats
        for ly in range(sy + 8, sy + sh - 8, 12):
            draw.line([(shutter_x + 4, ly), (shutter_x + sw - 4, ly + 4)], fill=(100, 65, 40, 255), width=2)
            draw.line([(shutter_x + 4, ly + 2), (shutter_x + sw - 4, ly + 6)], fill=(35, 20, 12, 255), width=1)
        # Wrought iron hinge
        draw.rectangle([(shutter_x + 2, sy + 30), (shutter_x + 14, sy + 36)], fill=(25, 25, 28, 255))
        draw.rectangle([(shutter_x + 2, sy + sh - 40), (shutter_x + 14, sy + sh - 34)], fill=(25, 25, 28, 255))

    add_noise(im, 8)
    im.save(os.path.join(OUT_DIR, 'decor_window.png'), 'PNG')
    print('Generated decor_window.png')

# -----------------------------------------------------------------------------
# 5. Modular Arched Door 3D Texture (280 x 480) - Transparent Background
# -----------------------------------------------------------------------------
def make_door():
    W, H = 280, 480
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Carved stone archway (voussoirs)
    arch_color = (150, 142, 130, 255)
    arch_shadow = (95, 90, 82, 255)
    arch_hl = (190, 184, 172, 255)

    # Outer arch outline
    draw.polygon([(10, H), (10, 180), (W // 2, 20), (W - 10, 180), (W - 10, H)], fill=arch_color)
    # Beveled stone blocks
    for y in range(180, H, 38):
        draw.line([(10, y), (36, y)], fill=arch_shadow, width=2)
        draw.line([(W - 36, y), (W - 10, y)], fill=arch_shadow, width=2)

    # Door cavity
    door_box = [36, 130, W - 36, H - 10]
    draw.rectangle(door_box, fill=(50, 32, 18, 255))

    # Door arch top
    draw.ellipse([36, 50, W - 36, 210], fill=(50, 32, 18, 255))

    # Heavy oak vertical planks
    plank_w = (W - 72) // 4
    for i in range(4):
        px = 36 + i * plank_w
        # wood grain gradient
        for x in range(px, px + plank_w):
            g = int(68 - abs(x - (px + plank_w // 2)) * 1.5)
            draw.line([(x, 130), (x, H - 10)], fill=(g, int(g * 0.65), int(g * 0.4), 255))
        # plank division line
        draw.line([(px, 130), (px, H - 10)], fill=(25, 16, 10, 255), width=2)

    # Wrought iron decorative strap hinges
    hinge_color = (25, 25, 28, 255)
    for hy in [160, 300, 420]:
        # Spearhead strap hinge
        draw.polygon([(36, hy - 6), (W - 70, hy - 4), (W - 55, hy), (W - 70, hy + 4), (36, hy + 6)], fill=hinge_color)
        # Iron rivets
        for rx in [55, 95, 145]:
            draw.ellipse([(rx - 3, hy - 3), (rx + 3, hy + 3)], fill=(60, 60, 65, 255))

    # Ring door knocker & keyhole
    draw.ellipse([(W // 2 - 12, 260), (W // 2 + 12, 284)], outline=hinge_color, width=4)
    draw.ellipse([(W // 2 - 4, 256), (W // 2 + 4, 264)], fill=hinge_color)

    # Stone step at threshold
    draw.rectangle([(20, H - 16), (W - 20, H)], fill=(170, 165, 155, 255))
    draw.line([(20, H - 16), (W - 20, H - 16)], fill=(210, 205, 195, 255), width=2)

    add_noise(im, 8)
    im.save(os.path.join(OUT_DIR, 'decor_door.png'), 'PNG')
    print('Generated decor_door.png')

# -----------------------------------------------------------------------------
# 6. Modular Brick Chimney Texture (200 x 360) - Transparent Background
# -----------------------------------------------------------------------------
def make_chimney():
    W, H = 200, 360
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Corbelled stone crown cap (top 50px)
    draw.rectangle([(25, 45), (W - 25, 75)], fill=(175, 170, 160, 255))
    draw.polygon([(35, 75), (W - 35, 75), (W - 20, 45), (20, 45)], fill=(190, 185, 175, 255))
    # Terracotta chimney pot on top
    draw.polygon([(W // 2 - 22, 45), (W // 2 + 22, 45), (W // 2 + 18, 8), (W // 2 - 18, 8)], fill=(195, 82, 45, 255))
    draw.ellipse([(W // 2 - 18, 4), (W // 2 + 18, 12)], fill=(155, 60, 32, 255))
    draw.ellipse([(W // 2 - 12, 6), (W // 2 + 12, 10)], fill=(30, 20, 18, 255))

    # Red brickwork body
    brick_box = [30, 75, W - 30, H]
    draw.rectangle(brick_box, fill=(160, 65, 45, 255))

    # Brick mortar joints
    brick_h = 16
    brick_w = 34
    for r, by in enumerate(range(75, H, brick_h)):
        draw.line([(30, by), (W - 30, by)], fill=(215, 210, 200, 255), width=2)
        offset = (brick_w // 2) if (r % 2) else 0
        for bx in range(30 + offset, W - 30, brick_w):
            draw.line([(bx, by), (bx, min(H, by + brick_h))], fill=(215, 210, 200, 255), width=2)
            # subtle individual brick shade
            b_val = random.randint(-18, 18)
            draw.rectangle([(bx + 2, by + 2), (min(W - 32, bx + brick_w - 2), min(H - 2, by + brick_h - 2))],
                           fill=(max(0, min(255, 165 + b_val)), max(0, min(255, 68 + b_val // 2)), max(0, min(255, 48 + b_val // 3)), 255))

    add_noise(im, 8)
    im.save(os.path.join(OUT_DIR, 'decor_chimney.png'), 'PNG')
    print('Generated decor_chimney.png')

# -----------------------------------------------------------------------------
# 7. Modular Flower Planter Box (300 x 140) - Transparent Background
# -----------------------------------------------------------------------------
def make_flower_box():
    W, H = 300, 140
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Wooden planter trough (bottom 55px)
    trough_poly = [(25, 75), (W - 25, 75), (W - 35, 130), (35, 130)]
    draw.polygon(trough_poly, fill=(80, 52, 34, 255))
    draw.polygon(trough_poly, outline=(48, 30, 18, 255), width=3)
    # Trough slats
    draw.line([(30, 102), (W - 30, 102)], fill=(55, 34, 20, 255), width=2)
    # Brass/iron mounting brackets
    draw.rectangle([(50, 75), (60, 132)], fill=(35, 35, 38, 255))
    draw.rectangle([(W - 60, 75), (W - 50, 132)], fill=(35, 35, 38, 255))

    # Dense lush foliage spilling over trough
    for _ in range(160):
        fx = random.randint(15, W - 15)
        fy = random.randint(20, 85)
        rad = random.randint(6, 14)
        c_green = (random.randint(40, 75), random.randint(120, 175), random.randint(45, 80), 240)
        draw.ellipse([(fx - rad, fy - rad), (fx + rad, fy + rad)], fill=c_green)

    # Trailing ivy tendrils below trough
    for vx in range(40, W - 40, 18):
        vlen = random.randint(12, 36)
        draw.arc([(vx - 8, 125), (vx + 8, 125 + vlen)], start=0, end=180, fill=(50, 130, 50, 230), width=3)

    # Colorful blossoms (Red geraniums, pink petunias, yellow daisies, white alyssum)
    flower_palette = [
        (230, 45, 55, 255),    # vivid red
        (245, 95, 145, 255),   # bright pink
        (255, 215, 60, 255),   # sunny yellow
        (255, 255, 255, 255),  # clean white
        (175, 110, 220, 255)   # soft purple
    ]
    for _ in range(65):
        bx = random.randint(25, W - 25)
        by = random.randint(25, 80)
        col = random.choice(flower_palette)
        pet_rad = random.randint(4, 7)
        for ang in range(0, 360, 72):
            rad_a = math.radians(ang)
            px = int(bx + math.cos(rad_a) * (pet_rad * 0.8))
            py = int(by + math.sin(rad_a) * (pet_rad * 0.8))
            draw.ellipse([(px - pet_rad // 2, py - pet_rad // 2), (px + pet_rad // 2, py + pet_rad // 2)], fill=col)
        # flower center
        draw.ellipse([(bx - 2, by - 2), (bx + 2, by + 2)], fill=(255, 230, 90, 255))

    im.save(os.path.join(OUT_DIR, 'decor_flower_box.png'), 'PNG')
    print('Generated decor_flower_box.png')

# -----------------------------------------------------------------------------
# 8. Volumetric Nature Bush / Shrub (400 x 320) - Transparent Background
# -----------------------------------------------------------------------------
def make_bush():
    W, H = 400, 320
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Deep shadow under-layer
    for _ in range(80):
        bx = random.randint(60, W - 60)
        by = random.randint(100, H - 30)
        rad = random.randint(28, 55)
        draw.ellipse([(bx - rad, by - rad), (bx + rad, by + rad)], fill=(25, 60, 30, 240))

    # Midtone dense foliage clumps
    for _ in range(160):
        bx = random.randint(40, W - 40)
        by = random.randint(60, H - 40)
        rad = random.randint(20, 44)
        c_green = (random.randint(45, 80), random.randint(110, 160), random.randint(40, 75), 245)
        draw.ellipse([(bx - rad, by - rad), (bx + rad, by + rad)], fill=c_green)

    # Highlight canopy clumps (top & facing viewer)
    for _ in range(110):
        bx = random.randint(50, W - 50)
        by = random.randint(40, H - 90)
        rad = random.randint(14, 30)
        c_hl = (random.randint(90, 140), random.randint(170, 215), random.randint(55, 95), 250)
        draw.ellipse([(bx - rad, by - rad), (bx + rad, by + rad)], fill=c_hl)

    # Tiny white and pastel blossom specks
    for _ in range(45):
        fx = random.randint(50, W - 50)
        fy = random.randint(50, H - 60)
        draw.ellipse([(fx - 3, fy - 3), (fx + 3, fy + 3)], fill=(255, 250, 220, 240))

    im.save(os.path.join(OUT_DIR, 'nature_bush.png'), 'PNG')
    print('Generated nature_bush.png')

if __name__ == '__main__':
    make_front_wall()
    make_side_wall()
    make_roof()
    make_window()
    make_door()
    make_chimney()
    make_flower_box()
    make_bush()
    print('All 8 modular 3D textures generated successfully!')
