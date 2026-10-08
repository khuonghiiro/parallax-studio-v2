from PIL import Image

def slice_decor():
    # 1. Window parts
    im_win = Image.open('assets/assembly_3d/modular/decor_window.png')
    # Frame + glass
    glass = im_win.crop((56, 30, 344, 466))
    glass.save('assets/assembly_3d/modular/decor_window_glass.png')
    print('[OK] Saved decor_window_glass.png', glass.size)

    # Shutter
    shutter = im_win.crop((16, 40, 56, 450))
    shutter.save('assets/assembly_3d/modular/decor_window_shutter.png')
    print('[OK] Saved decor_window_shutter.png', shutter.size)

    # Sill
    sill = im_win.crop((12, 468, 388, 512))
    sill.save('assets/assembly_3d/modular/decor_window_sill.png')
    print('[OK] Saved decor_window_sill.png', sill.size)

    # 2. Chimney parts
    im_chim = Image.open('assets/assembly_3d/modular/decor_chimney.png')
    # Brick column
    brick = im_chim.crop((30, 105, 190, 520))
    brick.save('assets/assembly_3d/modular/decor_chimney_brick.png')
    print('[OK] Saved decor_chimney_brick.png', brick.size)

    # Stone collar
    collar = im_chim.crop((19, 60, 201, 105))
    collar.save('assets/assembly_3d/modular/decor_chimney_cap.png')
    print('[OK] Saved decor_chimney_cap.png', collar.size)

    # Flue pot
    pot = im_chim.crop((84, 5, 136, 60))
    pot.save('assets/assembly_3d/modular/decor_chimney_pot.png')
    print('[OK] Saved decor_chimney_pot.png', pot.size)

if __name__ == '__main__':
    slice_decor()
