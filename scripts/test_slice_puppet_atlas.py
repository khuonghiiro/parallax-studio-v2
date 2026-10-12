"""Resolution and clipping regressions for the puppet atlas extractor."""
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from slice_puppet_atlas import SLOTS, extract, key_green


class PuppetAtlasTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        (Path.cwd() / 'artifacts').mkdir(exist_ok=True)

    def test_non_divisible_sizes_and_cross_cell_silhouettes(self):
        for size in (251, 503):
            with self.subTest(size=size), tempfile.TemporaryDirectory(dir=Path.cwd() / 'artifacts') as folder:
                path = Path(folder)
                image = Image.new('RGB', (size, size), (0, 255, 0))
                draw = ImageDraw.Draw(image)
                for index in range(15):
                    row, col = divmod(index, 5)
                    cx, cy = (col + .5) * size / 5, (row + .5) * size / 5
                    bottom = (row + 1.05) * size / 5 if index == 0 else cy + size / 25
                    draw.rectangle((cx-size/25, cy-size/25, cx+size/25, bottom), fill=(35, 50, 90))
                image.save(path / 'atlas.png')
                with contextlib.redirect_stdout(io.StringIO()):
                    extract(path / 'atlas.png', path / 'parts')
                manifest = json.loads((path / 'parts/manifest.json').read_text())
                self.assertEqual([p['id'] for p in manifest['parts']], SLOTS)
                self.assertTrue(any('head: recovered' in w for w in manifest['warnings']))
                head = Image.open(path / 'parts/head.png')
                self.assertGreater(head.height, size / 10)
                self.assertEqual(head.getpixel((0, 0))[3], 0)

    def test_preserves_source_alpha_and_rejects_wrong_background(self):
        source = Image.new('RGBA', (20, 20), (50, 90, 150, 127))
        np.testing.assert_array_equal(key_green(source), np.asarray(source))
        with self.assertRaises(ValueError):
            key_green(Image.new('RGB', (20, 20), 'white'))

    def test_rejects_ambiguous_parts_in_same_cell(self):
        with tempfile.TemporaryDirectory(dir=Path.cwd() / 'artifacts') as folder:
            path = Path(folder)
            image = Image.new('RGB', (200, 200), (0, 255, 0))
            draw = ImageDraw.Draw(image)
            draw.rectangle((5, 5, 12, 12), fill='black')
            draw.rectangle((20, 20, 28, 28), fill='black')
            image.save(path / 'atlas.png')
            with self.assertRaisesRegex(ValueError, 'Multiple silhouettes'):
                extract(path / 'atlas.png', path / 'parts')


if __name__ == '__main__':
    unittest.main()
