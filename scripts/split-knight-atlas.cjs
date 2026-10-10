/** Extract the authored sprite atlas; no repainting or background removal.
 * node scripts/split-knight-atlas.cjs <sharp-module-path>
 */
const fs = require('node:fs')
const path = require('node:path')
const sharp = require(process.argv[2] || 'sharp')
const root = path.resolve(__dirname, '../assets/character_hero/v2')
const parts = [
  ['head', 0, 0, 400, 453, 154],
  ['torso', 418, 65, 350, 388, 126],
  ['pelvis', 770, 210, 400, 243, 64],
  ['arm_l', 40, 460, 240, 345, 94],
  ['forearm_l', 370, 460, 195, 345, 86],
  ['arm_r', 700, 460, 235, 345, 94],
  ['forearm_r', 1010, 460, 215, 345, 86],
  ['thigh_l', 55, 810, 220, 380, 90],
  ['shin_l', 350, 810, 215, 380, 110],
  ['thigh_r', 695, 810, 240, 380, 90],
  ['shin_r', 995, 810, 230, 380, 110]
]

async function main() {
  fs.mkdirSync(root, { recursive: true })
  const dimensions = {}
  for (const [name, left, top, width, height, logicalHeight] of parts) {
    const crop = await sharp(path.resolve(__dirname, '../docs/design/knight-atlas.png'))
      .extract({ left, top, width, height }).toBuffer()
    const trimmed = await sharp(crop).trim({ threshold: 10 }).toBuffer()
    const result = await sharp(trimmed).resize({ height: logicalHeight * 2 })
      .png().toFile(path.join(root, `${name}.png`))
    dimensions[name] = { width: result.width, height: result.height }
  }
  fs.writeFileSync(path.join(root, 'dimensions.json'), JSON.stringify(dimensions, null, 2) + '\n')
  console.log(dimensions)
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
