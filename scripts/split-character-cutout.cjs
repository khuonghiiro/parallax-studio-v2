/** Mechanical extraction only: preserves generated pixels and alpha.
 * node scripts/split-character-cutout.cjs <atlas.png> <output-dir> [sharp-module]
 * Equal 5x5 grid; anatomical left/right follow character-cutout-prompt.md.
 */
const fs = require('node:fs')
const path = require('node:path')
const sharp = require(process.argv[4] || 'sharp')
const cells = {
  1: 'head', 2: 'neck', 3: 'hair-back', 4: 'hair-front',
  6: 'torso', 7: 'pelvis', 8: 'arm-left', 9: 'arm-right',
  11: 'forearm-left', 12: 'forearm-right', 13: 'hand-left', 14: 'hand-right',
  16: 'thigh-left', 17: 'thigh-right', 18: 'shin-left', 19: 'shin-right',
  21: 'foot-left', 22: 'foot-right'
}

async function main() {
  const input = process.argv[2], output = process.argv[3]
  if (!input || !output) throw new Error('Atlas and output directory required')
  const meta = await sharp(input).metadata()
  if (!meta.hasAlpha) throw new Error('Use an atlas with real alpha; this script does not remove backgrounds')
  fs.mkdirSync(output, { recursive: true })
  const manifest = { atlas: path.basename(input), width: meta.width, height: meta.height, parts: [] }
  for (const [cell, name] of Object.entries(cells)) {
    const index = Number(cell) - 1, col = index % 5, row = Math.floor(index / 5)
    const left = Math.round(col * meta.width / 5), top = Math.round(row * meta.height / 5)
    const width = Math.round((col + 1) * meta.width / 5) - left
    const height = Math.round((row + 1) * meta.height / 5) - top
    const { data, info } = await sharp(input).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let x0 = width, y0 = height, x1 = -1, y1 = -1
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * info.channels + 3] > 0) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y)
        x1 = Math.max(x1, x); y1 = Math.max(y1, y)
      }
    }
    if (x1 < 0) throw new Error(`Empty required cell ${cell}: ${name}`)
    const crop = { left: left + x0, top: top + y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
    await sharp(input).extract(crop).png().toFile(path.join(output, `${name}.png`))
    manifest.parts.push({ cell: Number(cell), name, ...crop })
  }
  fs.writeFileSync(path.join(output, 'atlas-parts.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify(manifest, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
