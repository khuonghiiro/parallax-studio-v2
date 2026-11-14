/**
 * Tách nền Alpha-Matte cho bộ tranh Quốc Phong / Donghua từ ảnh thô trong artifact directory,
 * xuất PNG RGBA trong suốt đã auto-crop vào `assets/scenes-donghua-v2/` và ghi `cutout-manifest.json`.
 */
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { decodeImageToRgba, encodeRgbaToPngFile, readImageDimensions } from './lib/pngCodec.mjs'

const ARTIFACT_DIR = 'C:/Users/Admin/.gemini/antigravity/brain/f35b2092-9302-4e5e-a555-cb71a26a8c21'
const OUT_DIR = resolve('assets/scenes-donghua-v2')

const BG_PLATES = [
  { id: 'asset-dg-s1-bg', file: 'bg-s1-jade-sea-clouds.png', name: 'Cảnh 1 — Vân Hải Thanh Sơn Bình Minh' },
  { id: 'asset-dg-s2-bg', file: 'bg-s2-moonlit-bamboo-mist.png', name: 'Cảnh 2 — Trúc Lâm Nguyệt Ảnh Sương Bạc' },
  { id: 'asset-dg-s3-bg', file: 'bg-s3-jiangnan-starry-river.png', name: 'Cảnh 3 — Giang Nam Cổ Trấn Tinh Hà' }
]

const CUTOUT_JOBS = [
  {
    id: 'asset-dg-s1-cliff',
    src: 'raw_s1_cliff_pavilion_1794643313707.jpg',
    out: 's1-cliff-pavilion.png',
    name: 'Đình Cổ Vách Núi Tùng Bách',
    opts: { innerTolerance: 0.27, outerTolerance: 0.58, despillStrength: 1.0, cropPadPx: 14 }
  },
  {
    id: 'asset-dg-s1-peach',
    src: 'raw_s1_peach_branch_fg_1794643329671.jpg',
    out: 's1-peach-branch-fg.png',
    name: 'Cành Đào Cổ Thụ Tiền Cảnh',
    opts: { innerTolerance: 0.24, outerTolerance: 0.56, despillStrength: 0.92, cropPadPx: 14 }
  },
  {
    id: 'asset-dg-s1-crane',
    src: 'raw_s1_white_crane_1794643346578.jpg',
    out: 's1-white-crane.png',
    name: 'Tiên Hạc Ngự Vân',
    opts: { innerTolerance: 0.27, outerTolerance: 0.60, despillStrength: 1.0, cropPadPx: 16 }
  },
  {
    id: 'asset-dg-hero-cloak',
    src: 'raw_hero_cloak_back_1794643312498.jpg',
    out: 'hero-cloak-back.png',
    name: 'Kiếm Khách — Áo Choàng Lụa Đỏ',
    opts: { innerTolerance: 0.24, outerTolerance: 0.55, despillStrength: 0.9, cropPadPx: 14 }
  },
  {
    id: 'asset-dg-hero-calm',
    src: 'raw_hero_swordsman_calm_1794643333865.jpg',
    out: 'hero-swordsman-calm.png',
    name: 'Kiếm Khách — Thần Thái Điềm Tĩnh',
    opts: { innerTolerance: 0.24, outerTolerance: 0.55, despillStrength: 0.9, cropPadPx: 14 }
  },
  {
    id: 'asset-dg-hero-fierce',
    src: 'raw_hero_swordsman_fierce_1794643355565.jpg',
    out: 'hero-swordsman-fierce.png',
    name: 'Kiếm Khách — Khai Phong Kiếm Ý',
    opts: { innerTolerance: 0.24, outerTolerance: 0.55, despillStrength: 0.9, cropPadPx: 14 }
  },
  {
    id: 'asset-dg-hero-sword',
    src: 'raw_hero_spirit_sword_1794643396195.jpg',
    out: 'hero-spirit-sword.png',
    name: 'Linh Kiếm Cổ Phong',
    opts: { innerTolerance: 0.24, outerTolerance: 0.54, despillStrength: 0.9, cropPadPx: 14 }
  },
  {
    id: 'asset-dg-s2-bridge',
    src: 'raw_s2_stone_bridge_1794643364828.jpg',
    out: 's2-stone-bridge.png',
    name: 'Cầu Đá Cổ Rừng Trúc',
    opts: { innerTolerance: 0.24, outerTolerance: 0.54, despillStrength: 0.92, cropPadPx: 14 }
  },
  {
    id: 'asset-dg-s2-bamboo',
    src: 'raw_s2_bamboo_rock_fg_1794643386363.jpg',
    out: 's2-bamboo-rock-fg.png',
    name: 'Trúc Xanh & Đá Thái Hồ Tiền Cảnh',
    opts: { innerTolerance: 0.28, outerTolerance: 0.62, despillStrength: 1.0, cropPadPx: 14 }
  },
  {
    id: 'asset-dg-s3-maiden',
    src: 'raw_s3_lotus_boat_maiden_1794643421824.jpg',
    out: 's3-lotus-boat-maiden.png',
    name: 'Thiếu Nữ Thuyền Sen Giang Nam',
    opts: { innerTolerance: 0.36, outerTolerance: 0.67, despillStrength: 1.0, cropPadPx: 16 }
  },
  {
    id: 'asset-dg-s3-lanterns',
    src: 'raw_s3_sky_lanterns_1794643407852.jpg',
    out: 's3-sky-lanterns.png',
    name: 'Đèn Trời Hoa Đăng',
    opts: { innerTolerance: 0.27, outerTolerance: 0.61, despillStrength: 1.0, cropPadPx: 16 }
  }
]

async function loadPipelineModule() {
  const require = createRequire(import.meta.url)
  const esbuild = require('esbuild')
  const tmpMjs = join(tmpdir(), `pxs-matte-${Date.now()}.mjs`)
  await esbuild.build({
    entryPoints: [resolve('src/renderer/src/project/matteCutoutPipeline.ts')],
    outfile: tmpMjs,
    bundle: true,
    format: 'esm',
    platform: 'node'
  })
  return {
    mod: await import(pathToFileURL(tmpMjs).href),
    cleanup: () => {
      if (existsSync(tmpMjs)) unlinkSync(tmpMjs)
    }
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const rawDir = join(OUT_DIR, '_raw')
  if (existsSync(rawDir)) rmSync(rawDir, { recursive: true, force: true })

  const { mod, cleanup } = await loadPipelineModule()
  const manifest = []
  try {
    for (const bg of BG_PLATES) {
      const dims = readImageDimensions(join(OUT_DIR, bg.file))
      manifest.push({ id: bg.id, file: bg.file, name: bg.name, kind: 'bg', width: dims.width, height: dims.height })
    }
    for (const job of CUTOUT_JOBS) {
      const srcPath = join(ARTIFACT_DIR, job.src)
      const outPath = join(OUT_DIR, job.out)
      const decoded = decodeImageToRgba(srcPath)
      const extracted = mod.extractForegroundPlate(decoded.rgba, decoded.width, decoded.height, job.opts)
      encodeRgbaToPngFile(outPath, extracted.rgba, extracted.width, extracted.height)
      console.log(
        `✓ ${job.out}: ${decoded.width}x${decoded.height} -> ${extracted.width}x${extracted.height} (key=${extracted.keyColor.kind}, coverage=${extracted.coverageRatio})`
      )
      manifest.push({
        id: job.id,
        file: job.out,
        name: job.name,
        kind: 'cutout',
        width: extracted.width,
        height: extracted.height,
        keyColor: extracted.keyColor,
        cropBox: extracted.cropBox,
        coverageRatio: extracted.coverageRatio
      })
    }
  } finally {
    cleanup()
  }

  writeFileSync(join(OUT_DIR, 'cutout-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`✓ Đã ghi cutout-manifest.json (${manifest.length} mục) tại assets/scenes-donghua-v2/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
