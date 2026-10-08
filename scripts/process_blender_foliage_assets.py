import os
from collections import deque
from PIL import Image, ImageFilter

def cutout_white_bg_bfs(src_path, out_path, min_bright=205, max_sat=35):
    im = Image.open(src_path).convert('RGB')
    width, height = im.size
    pixels = im.load()
    
    # 2D array for visited / background
    is_bg = [[False] * height for _ in range(width)]
    queue = deque()
    
    def is_white_like(x, y):
        r, g, b = pixels[x, y]
        avg = (r + g + b) / 3.0
        sat = max(r, g, b) - min(r, g, b)
        return avg >= min_bright and sat <= max_sat
    
    # Seed borders
    for x in range(width):
        for y in [0, height - 1]:
            if is_white_like(x, y):
                is_bg[x][y] = True
                queue.append((x, y))
    for y in range(height):
        for x in [0, width - 1]:
            if not is_bg[x][y] and is_white_like(x, y):
                is_bg[x][y] = True
                queue.append((x, y))
                
    # BFS
    while queue:
        cx, cy = queue.popleft()
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height and not is_bg[nx][ny]:
                if is_white_like(nx, ny):
                    is_bg[nx][ny] = True
                    queue.append((nx, ny))
                    
    # Generate Alpha
    alpha = Image.new('L', (width, height), 255)
    a_data = alpha.load()
    for y in range(height):
        for x in range(width):
            if is_bg[x][y]:
                a_data[x, y] = 0
            else:
                # Anti-alias transition if very close to pure white
                r, g, b = pixels[x, y]
                min_v = min(r, g, b)
                if min_v > 240 and (max(r, g, b) - min_v) < 18:
                    a_data[x, y] = max(0, int(255 * (1.0 - (min_v - 240) / 15.0)))
                else:
                    a_data[x, y] = 255
                    
    # Slight smooth for sub-pixel anti-aliasing
    alpha = alpha.filter(ImageFilter.SMOOTH)
    rgba = im.convert('RGBA')
    rgba.putalpha(alpha)
    
    # Crop to non-transparent bounding box with 6px margin
    bbox = rgba.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        x0 = max(0, x0 - 6)
        y0 = max(0, y0 - 6)
        x1 = min(width, x1 + 6)
        y1 = min(height, y1 + 6)
        rgba = rgba.crop((x0, y0, x1, y1))
        
    rgba.save(out_path, 'PNG')
    print(f'[OK] Clean BFS Cutout: {out_path} ({rgba.size[0]}x{rgba.size[1]}) bbox={rgba.getbbox()}')

if __name__ == '__main__':
    brain_dir = r'C:\Users\khuongpv\.gemini\antigravity-ide\brain\f47dd78b-d07f-4323-b531-0139197382d2'
    branch_src = os.path.join(brain_dir, 'nature_branch_stem_raw_1791443905178.jpg')
    leaf_src = os.path.join(brain_dir, 'nature_leaf_cluster_raw_1791443970524.jpg')
    
    # 1. Branch stem
    cutout_white_bg_bfs(branch_src, 'assets/assembly_3d/modular/nature_branch_stem.png', min_bright=195, max_sat=35)
    
    # 2. Leaf branch cluster
    cutout_white_bg_bfs(leaf_src, 'assets/assembly_3d/modular/nature_leaf_cluster.png', min_bright=200, max_sat=30)
    
    # 3. Flipped leaf branch cluster
    leaf_im = Image.open('assets/assembly_3d/modular/nature_leaf_cluster.png')
    leaf_flip = leaf_im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    leaf_flip.save('assets/assembly_3d/modular/nature_leaf_cluster_flip.png')
    print('[OK] Saved flipped leaf cluster: assets/assembly_3d/modular/nature_leaf_cluster_flip.png')
