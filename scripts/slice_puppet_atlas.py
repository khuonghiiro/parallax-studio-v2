"""Extract the 1:1, 5x5 puppet atlas using its actual dimensions.

Usage: python scripts/slice_puppet_atlas.py atlas.png --out artifacts/puppet-test/parts
Requires Pillow and numpy. Does not alter the source or infer anatomy.
"""
import argparse
from collections import deque
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SLOTS = ['head', 'torso', 'pelvis', 'arm-l', 'forearm-l', 'hand-l',
         'arm-r', 'forearm-r', 'hand-r', 'thigh-l', 'shin-l', 'foot-l',
         'thigh-r', 'shin-r', 'foot-r']


def key_green(image):
    rgba = np.asarray(image.convert('RGBA')).copy()
    if rgba[:, :, 3].min() < 255:
        return rgba  # Preserve genuine source transparency.
    rgb = rgba[:, :, :3].astype(float)
    background = np.median(rgb[-max(1, image.height // 5):].reshape(-1, 3), axis=0)
    if background[1] - max(background[0], background[2]) < 80:
        raise ValueError('Expected a flat green background or genuine transparency')
    rb = np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    excess = np.maximum(0, rgb[:, :, 1] - rb)
    alpha = np.clip(1 - excess / np.maximum(1, background[1] - rb), 0, 1)
    alpha[alpha < 0.04] = 0
    corrected = (rgb - (1 - alpha[:, :, None]) * background) / np.maximum(alpha[:, :, None], .001)
    rgba[:, :, :3] = np.clip(corrected, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.round(alpha * 255).astype(np.uint8)
    rgba[alpha == 0, :3] = 0
    return rgba


def components(rgba):
    """Recover complete silhouettes even when the model crosses a grid boundary."""
    mask = rgba[:, :, 3] > 15
    height, width = mask.shape
    found = []
    for y, x in zip(*np.nonzero(mask)):
        if not mask[y, x]:
            continue
        queue = deque([(int(x), int(y))])
        mask[y, x] = False
        pixels = []
        while queue:
            px, py = queue.popleft()
            pixels.append((px, py))
            for nx, ny in ((px-1, py), (px+1, py), (px, py-1), (px, py+1)):
                if 0 <= nx < width and 0 <= ny < height and mask[ny, nx]:
                    mask[ny, nx] = False
                    queue.append((nx, ny))
        if len(pixels) < width * height / 25000:
            continue
        points = np.array(pixels)
        cx, cy = points.mean(axis=0)
        cell = int(cy * 5 / height) * 5 + int(cx * 5 / width)
        lo, hi = points.min(axis=0), points.max(axis=0) + 1
        found.append((cell, [int(lo[0]), int(lo[1]), int(hi[0]), int(hi[1])]))
    return found


def extract(source, output):
    image = Image.open(source).convert('RGBA')
    width, height = image.size
    if abs(width / height - 1) > .02:
        raise ValueError('This preset requires a 1:1 atlas with 5 columns and 5 rows')
    rgba = key_green(image)
    detected = components(rgba)
    by_cell = {}
    for cell, box in detected:
        if cell in by_cell:
            raise ValueError(f'Multiple silhouettes in cell {cell + 1}; inspect source before assigning')
        by_cell[cell] = box
    output.mkdir(parents=True, exist_ok=True)
    manifest = {'template_id': 'tmpl-character-puppet-15', 'size': [width, height],
                'aspect_ratio': '1:1', 'grid': [5, 5], 'parts': [], 'warnings': []}
    preview = Image.new('RGB', (1000, 660), '#d6d6d6')
    draw = ImageDraw.Draw(preview)
    for index, slot in enumerate(SLOTS):
        row, col = divmod(index, 5)
        bounds = [round(col * width / 5), round(row * height / 5),
                  round((col + 1) * width / 5), round((row + 1) * height / 5)]
        left, top, right, bottom = bounds
        box = by_cell.get(index)
        if box is None:
            raise ValueError(f'Empty required cell {index + 1}: {slot}')
        if box[0] < left or box[1] < top or box[2] > right or box[3] > bottom:
            manifest['warnings'].append(f'{slot}: recovered complete silhouette across cell boundary')
        cropped = Image.fromarray(rgba[box[1]:box[3], box[0]:box[2]])
        padded = Image.new('RGBA', (cropped.width + 8, cropped.height + 8))
        padded.paste(cropped, (4, 4))
        padded.save(output / f'{slot}.png')
        manifest['parts'].append({'id': slot, 'cell': index + 1, 'file': f'{slot}.png',
                                  'cell_bounds': bounds, 'source_bbox': box,
                                  'size': list(padded.size)})
        thumbnail = padded.copy()
        thumbnail.thumbnail((180, 190))
        x, y = col * 200, row * 220
        draw.rectangle((x, y, x + 199, y + 219), fill='#eeeeee' if (row + col) % 2 else '#343b46')
        preview.paste(thumbnail, (x + (200 - thumbnail.width) // 2, y + 10), thumbnail)
        draw.text((x + 8, y + 203), f'{index + 1}: {slot}', fill='#e06040')
    for index in range(15, 25):
        row, col = divmod(index, 5)
        cell = rgba[round(row * height / 5):round((row + 1) * height / 5),
                    round(col * width / 5):round((col + 1) * width / 5), 3]
        if np.count_nonzero(cell > 32) > cell.size * .001:
            manifest['warnings'].append(f'Unexpected foreground in empty cell {index + 1}')
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    preview.save(output / 'contact-sheet.png')
    print(json.dumps({'size': image.size, 'parts': len(SLOTS), 'warnings': manifest['warnings']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('atlas', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    extract(args.atlas, args.out)
