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
    id: 'asset-dg-crane-body',
    src: 'raw_crane_body_core_1794650037827.jpg',
    out: 'crane-body-core.png',
    name: 'Tiên Hạc — Thân & Cổ Ngự Vân',
    opts: { innerTolerance: 0.26, outerTolerance: 0.58, despillStrength: 1.0, cropPadPx: 12 }
  },
  {
    id: 'asset-dg-crane-wing-near',
    src: 'raw_crane_wing_near_1794650055476.jpg',
    out: 'crane-wing-near.png',
    name: 'Tiên Hạc — Cánh Gần Tiền Cảnh',
    opts: { innerTolerance: 0.27, outerTolerance: 0.60, despillStrength: 1.0, cropPadPx: 10 }
  },
  {
    id: 'asset-dg-crane-wing-far',
    src: 'raw_crane_wing_far_1794650072997.jpg',
    out: 'crane-wing-far.png',
    name: 'Tiên Hạc — Cánh Xa Hậu Cảnh',
    opts: { innerTolerance: 0.27, outerTolerance: 0.60, despillStrength: 1.0, cropPadPx: 10 }
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
    id: 'asset-dg-s3-boat',
    src: 'raw_s3_gondola_boat_1794650046721.jpg',
    out: 's3-gondola-boat.png',
    name: 'Thuyền Gỗ Ô Bồng Giang Nam',
    opts: { innerTolerance: 0.27, outerTolerance: 0.58, despillStrength: 1.0, cropPadPx: 14 }
  },
  {
    id: 'asset-dg-s3-maiden',
    src: 'raw_s3_maiden_puppet_crisp_1794650086407.jpg',
    out: 's3-maiden-puppet.png',
    name: 'Thiếu Nữ Hán Phục Đèn Hoa Sen',
    opts: { innerTolerance: 0.23, outerTolerance: 0.53, despillStrength: 0.92, cropPadPx: 12 }
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

function extractBlackLumaPlate(rgba, width, height, padPx = 12) {
  const work = new Uint8ClampedArray(rgba.length)
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = rgba[idx], g = rgba[idx + 1], b = rgba[idx + 2]
      const peak = Math.max(r, g, b)
      const raw = Math.max(0, Math.min(1, (peak - 18) / 185))
      const alpha = raw > 0.01 ? Math.pow(raw, 0.85) : 0
      const aByte = Math.round(alpha * 255)
      work[idx + 3] = aByte
      if (aByte >= 6) {
        const inv = 1 / Math.max(0.14, alpha)
        work[idx] = Math.min(255, Math.round(r * inv))
        work[idx + 1] = Math.min(255, Math.round(g * inv))
        work[idx + 2] = Math.min(255, Math.round(b * inv))
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX) return { rgba: work, width, height }
  const x0 = Math.max(0, minX - padPx), y0 = Math.max(0, minY - padPx)
  const x1 = Math.min(width - 1, maxX + padPx), y1 = Math.min(height - 1, maxY + padPx)
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1
  const cropped = new Uint8ClampedArray(cw * ch * 4)
  for (let row = 0; row < ch; row++) {
    const srcOff = ((y0 + row) * width + x0) * 4
    cropped.set(work.subarray(srcOff, srcOff + cw * 4), row * cw * 4)
  }
  return { rgba: cropped, width: cw, height: ch }
}

function hash2D(ix, iy) {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

function fbm2D(x, y, octaves = 4) {
  let val = 0, amp = 0.5, freq = 1
  for (let o = 0; o < octaves; o++) {
    const fx = x * freq, fy = y * freq
    const ix = Math.floor(fx), iy = Math.floor(fy)
    const tx = fx - ix, ty = fy - iy
    const ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty)
    const a = hash2D(ix, iy), b = hash2D(ix + 1, iy)
    const c = hash2D(ix, iy + 1), d = hash2D(ix + 1, iy + 1)
    val += amp * ((a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy)
    amp *= 0.5
    freq *= 2.02
  }
  return val
}

function generateCloudMistPlate(width = 960, height = 320) {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const ny = (y / (height - 1)) * 2 - 1
    for (let x = 0; x < width; x++) {
      const nx = (x / (width - 1)) * 2 - 1
      const idx = (y * width + x) * 4
      const warmCrest = Math.max(0, 1 - (ny + 0.35) * 0.65)
      // Đặt sẵn RGB trắng sương trên cả pixel alpha=0 để lọc song tuyến WebGL không tạo viền tối
      rgba[idx] = Math.round(236 + warmCrest * 18)
      rgba[idx + 1] = Math.round(241 + warmCrest * 9)
      rgba[idx + 2] = Math.round(249 - warmCrest * 16)
      const radial = Math.max(0, 1 - (nx * nx * 1.12 + ny * ny * 1.32))
      if (radial <= 0.005) continue
      const puff = fbm2D(x / 120 + 3.1, y / 70 + 7.4, 4)
      const wisps = fbm2D(x / 50 + 11.7, y / 28 + 1.9, 3)
      const density = Math.pow(radial, 1.35) * Math.max(0, Math.min(1, (puff * 0.72 + wisps * 0.38 - 0.20) * 1.85))
      const aByte = Math.round(Math.min(198, density * 235))
      if (aByte >= 2) rgba[idx + 3] = aByte
    }
  }
  return { rgba, width, height }
}

function generateWaterShimmerPlate(width = 760, height = 180) {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const ny = (y / (height - 1)) * 2 - 1
    for (let x = 0; x < width; x++) {
      const nx = (x / (width - 1)) * 2 - 1
      const idx = (y * width + x) * 4
      const goldMix = Math.max(0, 1 - Math.abs(nx) * 1.25)
      rgba[idx] = Math.round(212 + goldMix * 42)
      rgba[idx + 1] = Math.round(236 - goldMix * 16)
      rgba[idx + 2] = Math.round(234 - goldMix * 98)
      const mask = Math.max(0, 1 - (nx * nx * 1.1 + ny * ny * 1.25))
      if (mask <= 0.005) continue
      const waveA = 0.5 + 0.5 * Math.sin(y * 0.42 + fbm2D(x / 72, y / 18, 3) * 7.2)
      const streak = Math.pow(waveA, 2.5) * fbm2D(x / 90 + 2.3, y / 14 + 5.1, 3)
      const alpha = Math.pow(mask, 1.25) * Math.min(1, streak * 2.85)
      const aByte = Math.round(Math.min(228, alpha * 255))
      if (aByte >= 2) rgba[idx + 3] = aByte
    }
  }
  return { rgba, width, height }
}

/**
 * Phủ màu RGB của biên đặc sang các texel lân cận (`alpha <= 10`) để bộ lọc song tuyến WebGL
 * không nội suy nhầm màu nền `#00FF00` / `#FF00FF` tạo viền sáng giả quanh nét mực.
 */
function decontaminateTransparentBleed(rgba, width, height, passes = 4) {
  let valid = new Uint8Array(width * height)
  for (let p = 0; p < valid.length; p++) {
    if (rgba[p * 4 + 3] >= 24) valid[p] = 1
  }
  for (let pass = 0; pass < passes; pass++) {
    const nextValid = new Uint8Array(valid)
    const snapshot = new Uint8ClampedArray(rgba)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x
        if (valid[p]) continue
        let sr = 0, sg = 0, sb = 0, cnt = 0
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= height) continue
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            if (nx < 0 || nx >= width) continue
            const np = ny * width + nx
            if (!valid[np]) continue
            const ni = np * 4
            sr += snapshot[ni]
            sg += snapshot[ni + 1]
            sb += snapshot[ni + 2]
            cnt++
          }
        }
        if (cnt > 0) {
          const idx = p * 4
          rgba[idx] = Math.round(sr / cnt)
          rgba[idx + 1] = Math.round(sg / cnt)
          rgba[idx + 2] = Math.round(sb / cnt)
          nextValid[p] = 1
        }
      }
    }
    valid = nextValid
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const rawDir = join(OUT_DIR, '_raw')
  if (existsSync(rawDir)) rmSync(rawDir, { recursive: true, force: true })
  for (const obsolete of ['s1-white-crane.png', 's3-lotus-boat-maiden.png']) {
    const p = join(OUT_DIR, obsolete)
    if (existsSync(p)) unlinkSync(p)
  }

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
      decontaminateTransparentBleed(extracted.rgba, extracted.width, extracted.height, 4)
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

    const qiSrc = decodeImageToRgba(join(ARTIFACT_DIR, 'raw_fx_sword_qi_slash_1794650109281.jpg'))
    const qiOut = extractBlackLumaPlate(qiSrc.rgba, qiSrc.width, qiSrc.height, 12)
    encodeRgbaToPngFile(join(OUT_DIR, 'fx-sword-qi-slash.png'), qiOut.rgba, qiOut.width, qiOut.height)
    console.log(`✓ fx-sword-qi-slash.png: ${qiSrc.width}x${qiSrc.height} -> ${qiOut.width}x${qiOut.height} (black-luma)`)
    manifest.push({ id: 'asset-dg-fx-sword-qi', file: 'fx-sword-qi-slash.png', name: 'Kiếm Khí Trảm Thanh Ngọc', kind: 'cutout', width: qiOut.width, height: qiOut.height })

    const mistOut = generateCloudMistPlate(960, 320)
    encodeRgbaToPngFile(join(OUT_DIR, 'fx-cloud-mist.png'), mistOut.rgba, mistOut.width, mistOut.height)
    console.log(`✓ fx-cloud-mist.png: ${mistOut.width}x${mistOut.height} (procedural mist)`)
    manifest.push({ id: 'asset-dg-fx-mist', file: 'fx-cloud-mist.png', name: 'Dải Mây Sương Vân Hải', kind: 'cutout', width: mistOut.width, height: mistOut.height })

    const rippleOut = generateWaterShimmerPlate(760, 180)
    encodeRgbaToPngFile(join(OUT_DIR, 'fx-water-shimmer.png'), rippleOut.rgba, rippleOut.width, rippleOut.height)
    console.log(`✓ fx-water-shimmer.png: ${rippleOut.width}x${rippleOut.height} (procedural water shimmer)`)
    manifest.push({ id: 'asset-dg-fx-shimmer', file: 'fx-water-shimmer.png', name: 'Gợn Sóng Phản Chiếu Ánh Trăng', kind: 'cutout', width: rippleOut.width, height: rippleOut.height })
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
