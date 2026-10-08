import math
from PIL import Image, ImageDraw, ImageFilter

def make_triangular_bush_texture(src_path, out_path, size=512, flower_variant=False):
    src = Image.open(src_path).convert('RGBA')
    # Resize / crop src to size x size
    src = src.resize((size, size), Image.Resampling.LANCZOS)
    
    # Create mask for spherical triangle (gore)
    mask = Image.new('L', (size, size), 0)
    
    cx = size / 2.0
    # Base is at bottom (y near size-1), apex is near top (y = 20)
    y_apex = 24.0
    y_base = size - 12.0
    h_total = y_base - y_apex
    
    half_base = (size - 32.0) / 2.0
    
    pixels = mask.load()
    
    for y in range(size):
        if y < y_apex or y > y_base:
            continue
        # t goes from 0 (apex) to 1 (base)
        t = (y - y_apex) / h_total
        
        # Spherical gore curve: at apex (t=0) width=0, at base (t=1) width=half_base
        # Using a slight spherical bulge curve: sin(t * pi / 2) gives a plump convex dome silhouette
        w_curve = math.sin(t * (math.pi / 2.0)) * half_base
        
        # Add organic leaf perturbation along the edges
        # Combined frequencies for leafy serration
        freq1 = math.sin(y * 0.18) * 5.0
        freq2 = math.cos(y * 0.35) * 3.5
        freq3 = math.sin(y * 0.08) * 4.0
        leaf_noise = freq1 + freq2 + freq3
        
        # Near apex (t < 0.15) round it off smoothly
        if t < 0.15:
            apex_round = math.sqrt(max(0, 1.0 - ((0.15 - t) / 0.15) ** 2))
            w = (w_curve * apex_round) + leaf_noise * (t / 0.15)
        else:
            w = w_curve + leaf_noise
            
        w = max(0.0, w)
        
        x_min = int(max(0, cx - w))
        x_max = int(min(size - 1, cx + w))
        
        for x in range(x_min, x_max + 1):
            # Calculate distance to edge for soft alpha antialiasing
            dist_to_edge = min(x - (cx - w), (cx + w) - x)
            if dist_to_edge >= 2.0:
                pixels[x, y] = 255
            elif dist_to_edge > 0:
                pixels[x, y] = int(255 * (dist_to_edge / 2.0))

    # Apply mask
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
    print(f'[OK] Created triangular bush patch: {out_path} ({size}x{size})')

if __name__ == '__main__':
    src1 = 'assets/assembly_3d/modular/nature_bush.png'
    src2 = 'assets/assembly_3d/modular/nature_bush_top.png'
    
    # Variant 1: Front profile
    make_triangular_bush_texture(src1, 'assets/assembly_3d/modular/nature_bush_tri_1.png', 512)
    
    # Variant 2: Flipped front profile
    im1 = Image.open(src1).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    im1.save('assets/assembly_3d/modular/nature_bush_flip.png')
    make_triangular_bush_texture('assets/assembly_3d/modular/nature_bush_flip.png', 'assets/assembly_3d/modular/nature_bush_tri_2.png', 512)
    
    # Variant 3: Top-down canopy flowers
    make_triangular_bush_texture(src2, 'assets/assembly_3d/modular/nature_bush_tri_3.png', 512)
