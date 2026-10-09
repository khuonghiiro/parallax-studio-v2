import os
import math
from PIL import Image, ImageDraw, ImageFilter

out_dir = r"d:\_DuAn\App_Desktop\parallax-studio-v2\assets\assembly_3d\modular"
os.makedirs(out_dir, exist_ok=True)

# 1. Chậu Bonsai (bonsai_pot.png) - 512x256
def make_bonsai_pot():
    w, h = 512, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Thân chậu gốm dẹt chữ nhật bo góc, chân quỳ
    # Đất trồng cây
    draw.ellipse([100, 70, 412, 120], fill=(45, 30, 20, 255))
    # Rêu xanh trên đất
    draw.ellipse([120, 75, 392, 115], fill=(35, 75, 35, 230))
    for rx in range(130, 380, 20):
        draw.ellipse([rx, 80, rx + 25, 95], fill=(50, 100, 40, 240))

    # Miệng chậu (vành gốm men xanh ngọc / đất nung viền vàng)
    rim_color = (42, 65, 80, 255)
    draw.rounded_rectangle([70, 95, 442, 125], radius=6, fill=rim_color, outline=(25, 40, 50, 255), width=3)
    # Highlight miệng chậu
    draw.line([85, 99, 427, 99], fill=(70, 105, 125, 220), width=2)

    # Thân chậu thu nhỏ dần xuống đáy
    body_poly = [
        (85, 125),
        (427, 125),
        (405, 195),
        (107, 195)
    ]
    draw.polygon(body_poly, fill=(35, 55, 68, 255), outline=(22, 35, 45, 255))
    # Dải màu trang trí cổ điển
    draw.line([100, 155, 412, 155], fill=(185, 145, 75, 230), width=3)

    # Đáy chậu
    draw.rounded_rectangle([105, 190, 407, 205], radius=3, fill=(28, 45, 55, 255))

    # 4 chân quỳ cách điệu
    # Chân trái
    draw.rounded_rectangle([115, 200, 155, 225], radius=4, fill=(22, 35, 45, 255))
    # Chân phải
    draw.rounded_rectangle([357, 200, 397, 225], radius=4, fill=(22, 35, 45, 255))

    img.save(os.path.join(out_dir, "bonsai_pot.png"))
    print("Created bonsai_pot.png")

# 2. Thân cây cổ thụ Bonsai uốn lượn (bonsai_trunk.png) - 512x512
def make_bonsai_trunk():
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Vẽ gốc cây tỏa rễ bám vào đất
    # Tọa độ gốc: x=240, y=450
    # Thân cây uốn khúc: Gốc -> lượn sang phải -> uốn gấp sang trái -> phân nhánh
    bark_dark = (55, 38, 25, 255)
    bark_mid = (85, 60, 40, 255)
    bark_light = (115, 85, 58, 255)

    # Rễ bám
    draw.polygon([(200, 470), (240, 430), (280, 470), (250, 480)], fill=bark_dark)
    draw.polygon([(170, 480), (210, 440), (230, 480)], fill=bark_mid)
    draw.polygon([(250, 440), (310, 480), (280, 485)], fill=bark_dark)

    # Thân chính (nhiều lớp nét cọ tạo vân sần sùi)
    points_main = [
        (235, 450), (220, 390), (260, 320), (290, 260),
        (250, 200), (210, 160), (195, 120), (180, 80)
    ]
    # Vẽ thân to ở dưới, thon dần lên trên
    for i in range(len(points_main) - 1):
        p1, p2 = points_main[i], points_main[i+1]
        width1 = int(48 * (1.0 - i * 0.1))
        draw.line([p1, p2], fill=bark_dark, width=width1)

    for i in range(len(points_main) - 1):
        p1, p2 = (points_main[i][0] - 3, points_main[i][1]), (points_main[i+1][0] - 2, points_main[i+1][1])
        width1 = int(36 * (1.0 - i * 0.1))
        draw.line([p1, p2], fill=bark_mid, width=width1)

    # Nhánh phụ vươn sang phải (nhánh đón gió)
    branch_right = [(270, 280), (330, 260), (390, 240), (430, 220)]
    for i in range(len(branch_right) - 1):
        draw.line([branch_right[i], branch_right[i+1]], fill=bark_dark, width=int(22 * (1.0 - i * 0.2)))
        draw.line([branch_right[i], branch_right[i+1]], fill=bark_mid, width=int(14 * (1.0 - i * 0.2)))

    # Nhánh phụ vươn sang trái (nhánh hoành rủ)
    branch_left = [(230, 210), (170, 200), (120, 210), (80, 230)]
    for i in range(len(branch_left) - 1):
        draw.line([branch_left[i], branch_left[i+1]], fill=bark_dark, width=int(20 * (1.0 - i * 0.2)))
        draw.line([branch_left[i], branch_left[i+1]], fill=bark_mid, width=int(12 * (1.0 - i * 0.2)))

    # Nhánh ngọn vươn lên đỉnh
    branch_top = [(195, 120), (230, 90), (260, 70)]
    for i in range(len(branch_top) - 1):
        draw.line([branch_top[i], branch_top[i+1]], fill=bark_dark, width=int(14 * (1.0 - i * 0.2)))

    # Rêu phong bám trên vỏ thân cây
    moss_color = (65, 105, 55, 210)
    for my in range(250, 440, 30):
        draw.ellipse([215, my, 235, my + 15], fill=moss_color)
        draw.ellipse([250, my - 40, 268, my - 25], fill=moss_color)

    img.save(os.path.join(out_dir, "bonsai_trunk.png"))
    print("Created bonsai_trunk.png")

# Helper vẽ đĩa mây tùng (Pine needle cloud cluster)
def draw_pine_cloud(draw, cx, cy, rx, ry, base_color, highlight_color):
    # Vẽ nhiều elip xếp chồng tạo tán mây tùng bồng bềnh
    for dx in range(-rx + 10, rx - 10, 16):
        h = int(math.sqrt(max(0, rx*rx - dx*dx)) * (ry / rx))
        draw.ellipse([cx + dx - 18, cy - h - 10, cx + dx + 18, cy + h + 8], fill=base_color)

    for dx in range(-rx + 20, rx - 20, 24):
        h = int(math.sqrt(max(0, rx*rx - dx*dx)) * (ry / rx) * 0.7)
        draw.ellipse([cx + dx - 12, cy - h - 12, cx + dx + 12, cy + 4], fill=highlight_color)

# 3. Tán lá sau / hậu cảnh (bonsai_foliage_back.png) - 512x512
def make_bonsai_foliage_back():
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Tông màu xanh sẫm / trầm mù sương phía sau (Deep Forest Green)
    dark_pine = (20, 55, 38, 235)
    mid_pine = (32, 75, 52, 235)

    # Cụm tán sau đỉnh ngọn
    draw_pine_cloud(draw, 220, 75, 75, 35, dark_pine, mid_pine)
    # Cụm tán sau nhánh phải
    draw_pine_cloud(draw, 390, 205, 80, 40, dark_pine, mid_pine)
    # Cụm tán sau nhánh trái
    draw_pine_cloud(draw, 140, 190, 70, 35, dark_pine, mid_pine)

    img.save(os.path.join(out_dir, "bonsai_foliage_back.png"))
    print("Created bonsai_foliage_back.png")

# 4. Tán lá giữa / tán chính (bonsai_foliage_mid.png) - 512x512
def make_bonsai_foliage_mid():
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Tông màu xanh ngọc bích tươi tắn (Emerald Jade Pine)
    base_green = (30, 85, 55, 245)
    light_green = (55, 130, 80, 245)

    # Cụm đỉnh chính
    draw_pine_cloud(draw, 180, 95, 95, 45, base_green, light_green)
    # Cụm tán tầng 2 vươn phải
    draw_pine_cloud(draw, 420, 225, 90, 42, base_green, light_green)
    # Cụm tán tầng 2 vươn trái
    draw_pine_cloud(draw, 110, 215, 85, 40, base_green, light_green)

    img.save(os.path.join(out_dir, "bonsai_foliage_mid.png"))
    print("Created bonsai_foliage_mid.png")

# 5. Tán lá trước / tiền cảnh (bonsai_foliage_front.png) - 512x512
def make_bonsai_foliage_front():
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Tông màu xanh mạ non đón nắng (Sunlit Pine Tips)
    front_base = (45, 115, 70, 255)
    front_highlight = (80, 175, 105, 255)

    # Cụm chóp ngọn đón nắng rọi từ trên
    draw_pine_cloud(draw, 195, 110, 65, 30, front_base, front_highlight)
    # Cụm tán rủ tiền cảnh sát người xem bên trái
    draw_pine_cloud(draw, 80, 235, 75, 35, front_base, front_highlight)
    # Cụm tán đầu cành bên phải
    draw_pine_cloud(draw, 445, 240, 65, 32, front_base, front_highlight)

    img.save(os.path.join(out_dir, "bonsai_foliage_front.png"))
    print("Created bonsai_foliage_front.png")

if __name__ == "__main__":
    make_bonsai_pot()
    make_bonsai_trunk()
    make_bonsai_foliage_back()
    make_bonsai_foliage_mid()
    make_bonsai_foliage_front()
    print("All Bonsai assets generated successfully!")
