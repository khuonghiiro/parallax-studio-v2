import os
from PIL import Image

def align_faces():
    house_dir = r"d:\_DuAn\App_Desktop\parallax-studio-v2\assets\house"
    
    # 1. Front Wall
    f_img = Image.open(os.path.join(house_dir, "house_front.png"))
    # Corner posts are at x=48 and x=908 (width = 860).
    # Height: from bottom cobblestone (y ~ 940) up to y ~ 50
    # Let's crop x from 48 to 908 (860px)
    # y from 40 to 940 (900px)
    front_cropped = f_img.crop((48, 40, 908, 940))
    front_cropped.save(os.path.join(house_dir, "house_front.png"))
    print(f"Front aligned: {front_cropped.size}")
    
    # 2. Left Wall
    l_img = Image.open(os.path.join(house_dir, "house_left.png"))
    left_cropped = l_img.crop((48, 40, 908, 940))
    left_cropped.save(os.path.join(house_dir, "house_left.png"))
    print(f"Left aligned: {left_cropped.size}")
    
    # 3. Right Wall
    r_img = Image.open(os.path.join(house_dir, "house_right.png"))
    right_cropped = r_img.crop((48, 40, 908, 940))
    right_cropped.save(os.path.join(house_dir, "house_right.png"))
    print(f"Right aligned: {right_cropped.size}")
    
    # 4. Roof
    roof_img = Image.open(os.path.join(house_dir, "house_roof.png"))
    # Resize / crop roof to 880 x 880 (giving subtle 10px natural roof overhang on all sides)
    w, h = roof_img.size
    cx, cy = w // 2, h // 2
    # crop center 880 x 880
    roof_cropped = roof_img.crop((cx - 440, cy - 440, cx + 440, cy + 440))
    roof_cropped.save(os.path.join(house_dir, "house_roof.png"))
    print(f"Roof aligned: {roof_cropped.size}")

if __name__ == "__main__":
    align_faces()
