import math
from PIL import Image, ImageDraw, ImageFilter

def create_branch_stem_texture(out_path, width=320, height=480):
    """
    Tạo texture cành cây / thân nhánh gỗ tự nhiên (Wooden branching stem).
    Gốc cây gỗ ở dưới, phân thành 4-5 nhánh cành xòe cong tự nhiên nâng đỡ tán lá.
    """
    im = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    # Base trunk at bottom center
    cx = width / 2.0
    base_y = height - 10
    
    # Draw organic branching structure
    # Colors: dark bark brown with wood grain highlights
    bark_dark = (58, 38, 24, 255)
    bark_mid = (82, 54, 34, 255)
    bark_light = (110, 75, 48, 255)

    def draw_branch(x0, y0, length, angle_deg, start_thick, end_thick, depth=0):
        rad = math.radians(angle_deg)
        x1 = x0 + length * math.sin(rad)
        y1 = y0 - length * math.cos(rad)
        
        # Steps for smooth taper
        steps = int(max(10, length / 4))
        for i in range(steps):
            t = i / float(steps)
            # slight organic wavy curve
            wobble = math.sin(t * math.pi * 2.0 + depth) * (2.5 / (depth + 1))
            bx = x0 + (x1 - x0) * t + wobble
            by = y0 + (y1 - y0) * t
            thick = start_thick + (end_thick - start_thick) * t
            
            # Draw trunk slice with bark gradient
            r = thick / 2.0
            draw.ellipse([bx - r, by - r, bx + r, by + r], fill=bark_mid)
            draw.ellipse([bx - r*0.7, by - r*0.7, bx + r*0.5, by + r*0.5], fill=bark_light)

        if depth < 3:
            # Fork into sub-branches
            num_forks = 2 if depth > 0 else 3
            spread = 28 if depth == 0 else 35
            for f in range(num_forks):
                sub_angle = angle_deg + (f - (num_forks - 1) / 2.0) * spread + (math.sin(depth * 3) * 5)
                sub_len = length * (0.65 if depth == 0 else 0.72)
                sub_start_thick = end_thick * 0.85
                sub_end_thick = max(2.5, sub_start_thick * 0.45)
                draw_branch(x1, y1, sub_len, sub_angle, sub_start_thick, sub_end_thick, depth + 1)

    # Draw main central trunk
    draw_branch(cx, base_y, 160, 0, 32, 18, depth=0)
    # Secondary support base roots
    draw_branch(cx - 8, base_y, 80, -22, 18, 10, depth=1)
    draw_branch(cx + 8, base_y, 80, 22, 18, 10, depth=1)

    # Slight blur to soften pixel edges
    im = im.filter(ImageFilter.SMOOTH_MORE)
    im.save(out_path, 'PNG')
    print(f'[OK] Created branch stem: {out_path} ({width}x{height})')

def create_organic_leaf_cluster(src_path, out_path, angle_offset=0, size=512):
    """
    Trích xuất chùm cành lá và hoa hữu cơ (Organic leaf & blossom cluster card)
    từ ảnh chụp bụi hoa chất lượng cao, tạo viền tự nhiên để cắm phân nhánh.
    """
    src = Image.open(src_path).convert('RGBA').resize((size, size), Image.Resampling.LANCZOS)
    
    # Rotate slightly if requested for natural organic variety
    if angle_offset != 0:
        src = src.rotate(angle_offset, Image.Resampling.BICUBIC, expand=False)

    # Create organic cluster mask: oval/fan shape with leaf scalloping
    mask = Image.new('L', (size, size), 0)
    cx, cy = size / 2.0, size / 2.0
    rx, ry = size * 0.42, size * 0.38
    
    pixels = mask.load()
    for y in range(size):
        for x in range(size):
            dx = (x - cx) / rx
            dy = (y - cy) / ry
            dist = math.sqrt(dx * dx + dy * dy)
            
            # Organic leaf edge noise
            angle = math.atan2(dy, dx)
            noise = (math.sin(angle * 12.0) * 0.06 +
                     math.cos(angle * 22.0) * 0.04 +
                     math.sin(angle * 5.0 + y * 0.05) * 0.05)
            
            effective_dist = dist + noise
            if effective_dist < 0.88:
                pixels[x, y] = 255
            elif effective_dist < 1.02:
                # Soft alpha edge
                alpha_factor = (1.02 - effective_dist) / 0.14
                pixels[x, y] = int(255 * max(0, min(1, alpha_factor)))

    # Multiply with source alpha
    result = src.copy()
    r, g, b, a = result.split()
    final_alpha = Image.new('L', (size, size))
    src_a = a.load()
    mask_p = mask.load()
    final_p = final_alpha.load()
    
    for y in range(size):
        for x in range(size):
            final_p[x, y] = int((src_a[x, y] * mask_p[x, y]) / 255)
            
    result.putalpha(final_alpha)
    result.save(out_path, 'PNG')
    print(f'[OK] Created leaf cluster: {out_path} ({size}x{size})')

if __name__ == '__main__':
    # 1. Wooden branching stems
    create_branch_stem_texture('assets/assembly_3d/modular/nature_branch_stem.png', 360, 480)
    
    # 2. Organic leaf & blossom clusters
    create_organic_leaf_cluster('assets/assembly_3d/modular/nature_bush.png', 'assets/assembly_3d/modular/nature_leaf_cluster_1.png', angle_offset=0)
    create_organic_leaf_cluster('assets/assembly_3d/modular/nature_bush.png', 'assets/assembly_3d/modular/nature_leaf_cluster_2.png', angle_offset=28)
    create_organic_leaf_cluster('assets/assembly_3d/modular/nature_bush_top.png', 'assets/assembly_3d/modular/nature_leaf_canopy.png', angle_offset=-15)
