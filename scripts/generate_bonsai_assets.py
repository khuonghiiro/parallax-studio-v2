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

    # Đất trồng cây hữu cơ tơi xốp
    draw.ellipse([80, 50, 432, 115], fill=(55, 38, 25, 255))
    # Lớp rêu nhung xanh tươi tắn phủ trên đất đón lấy gốc cây
    draw.ellipse([100, 55, 412, 105], fill=(45, 110, 45, 255))
    for rx in range(110, 400, 16):
        draw.ellipse([rx, 60, rx + 24, 85], fill=(68, 148, 55, 245))
        draw.ellipse([rx + 8, 70, rx + 26, 92], fill=(95, 180, 65, 235))

    # Miệng chậu Bonsai Tử Sa dáng dẹt bề thế (Vành gốm đất nung viền nẹp đồng vàng kim)
    pot_rim_gold = (220, 175, 80, 255)
    pot_terracotta = (175, 80, 45, 255)
    pot_dark_bark = (115, 48, 25, 255)

    # Nẹp đồng bóng sáng trên vành miệng chậu
    draw.rounded_rectangle([45, 82, 467, 118], radius=8, fill=pot_rim_gold, outline=(140, 100, 35, 255), width=2)
    # Lớp gốm tử sa chính của miệng chậu
    draw.rounded_rectangle([52, 88, 460, 114], radius=6, fill=pot_terracotta, outline=(130, 55, 30, 255), width=2)
    # Ánh sáng bóng trên miệng gốm
    draw.line([70, 92, 442, 92], fill=(235, 130, 90, 230), width=2)

    # Thân chậu chữ nhật vát cạnh cổ điển
    body_poly = [
        (62, 114),
        (450, 114),
        (424, 192),
        (88, 192)
    ]
    draw.polygon(body_poly, fill=(150, 65, 35, 255), outline=pot_dark_bark)
    # Đổ bóng gradient tối ở 2 góc hông thân chậu
    draw.polygon([(62, 114), (105, 114), (120, 192), (88, 192)], fill=(120, 50, 25, 240))
    draw.polygon([(407, 114), (450, 114), (424, 192), (392, 192)], fill=(120, 50, 25, 240))

    # Dải hoa văn nẹp đồng & đường chỉ nổi mạ vàng chạy ngang thân chậu
    draw.line([78, 148, 434, 148], fill=pot_rim_gold, width=4)
    draw.line([82, 150, 430, 150], fill=(255, 220, 130, 240), width=2)

    # Đáy chậu gốm
    draw.rounded_rectangle([84, 188, 428, 204], radius=4, fill=(110, 45, 22, 255), outline=(75, 30, 15, 255), width=2)

    # 4 Chân quỳ uy nghi nâng đỡ chậu
    # Chân quỳ trái
    draw.polygon([(100, 200), (145, 200), (140, 232), (92, 232), (90, 218)], fill=pot_dark_bark)
    draw.rounded_rectangle([92, 222, 142, 236], radius=3, fill=pot_rim_gold)
    # Chân quỳ phải
    draw.polygon([(367, 200), (412, 200), (422, 218), (420, 232), (372, 232)], fill=pot_dark_bark)
    draw.rounded_rectangle([370, 222, 420, 236], radius=3, fill=pot_rim_gold)

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
