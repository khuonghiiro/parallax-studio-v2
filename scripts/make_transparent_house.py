import os
from PIL import Image, ImageDraw, ImageFilter

def extract_subject(img_path, out_path, thresh=35):
    img = Image.open(img_path).convert("RGBA")
    w, h = img.size
    
    # Create a grayscale mask initialized to 255 (opaque)
    # We will flood fill from the borders with 0 (transparent) wherever color is close to white
    mask = Image.new("L", (w, h), 255)
    draw = ImageDraw.Draw(mask)
    
    # We flood-fill on an RGB copy of the original image
    rgb = img.convert("RGB")
    
    # Seed points from all 4 corners and borders
    seeds = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (0, h // 2), (w - 1, h // 2), (w // 2, h - 1)
    ]
    
    # We can use ImageDraw.floodfill on rgb image with target value (0, 0, 0),
    # but floodfill directly on mask by comparing pixel values in rgb:
    # Actually ImageDraw.floodfill exists in PIL!
    # Let's inspect: ImageDraw.floodfill(image, xy, value, thresh=...)
    # If we floodfill on an RGBA copy with transparent color (0,0,0,0):
    rgba_work = img.copy()
    for sx, sy in seeds:
        # Check if the seed is near white
        p = rgb.getpixel((sx, sy))
        if p[0] > 230 and p[1] > 230 and p[2] > 230:
            ImageDraw.floodfill(rgba_work, (sx, sy), (0, 0, 0, 0), thresh=thresh)
            
    # Also scan border pixels to make sure no trapped white pockets on outer boundary
    for x in range(w):
        for y in [0, h - 1]:
            p = rgba_work.getpixel((x, y))
            if p[3] > 0 and p[0] > 235 and p[1] > 235 and p[2] > 235:
                ImageDraw.floodfill(rgba_work, (x, y), (0, 0, 0, 0), thresh=thresh)
                
    for y in range(h):
        for x in [0, w - 1]:
            p = rgba_work.getpixel((x, y))
            if p[3] > 0 and p[0] > 235 and p[1] > 235 and p[2] > 235:
                ImageDraw.floodfill(rgba_work, (x, y), (0, 0, 0, 0), thresh=thresh)
                
    # Extract alpha channel, soften edges slightly
    alpha = rgba_work.split()[3]
    alpha_smooth = alpha.filter(ImageFilter.GaussianBlur(radius=0.6))
    rgba_work.putalpha(alpha_smooth)
    
    bbox = rgba_work.getbbox()
    if bbox:
        pad = 4
        crop_box = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad))
        cropped = rgba_work.crop(crop_box)
    else:
        cropped = rgba_work
        
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cropped.save(out_path, format="PNG")
    print(f"Successfully created: {out_path} ({cropped.size[0]}x{cropped.size[1]})")

if __name__ == "__main__":
    brain = r"C:\Users\khuongpv\.gemini\antigravity-ide\brain\e2d02efd-1afd-4771-a76d-9953c3c5e3b4"
    out_dir = r"d:\_DuAn\App_Desktop\parallax-studio-v2\assets\house"
    
    items = [
        ("house_front_view_1791340516527.jpg", os.path.join(out_dir, "house_front.png"), 40),
        ("house_left_view_1791340581313.jpg", os.path.join(out_dir, "house_left.png"), 40),
        ("house_right_view_1791340689001.jpg", os.path.join(out_dir, "house_right.png"), 40),
        ("house_roof_view_1791340715168.jpg", os.path.join(out_dir, "house_roof.png"), 40)
    ]
    
    for src_name, dst, thresh in items:
        src = os.path.join(brain, src_name)
        extract_subject(src, dst, thresh)
