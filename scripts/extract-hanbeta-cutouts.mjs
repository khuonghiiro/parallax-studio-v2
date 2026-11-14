/**
 * Tách nền Alpha-Matte cho bộ tranh Motion-Comic "Hàn Bối Tháp: Quái Đàm Ký Túc Xá 2.5D",
 * xuất PNG RGBA trong suốt (đã khử viền spill 4 bước) vào `assets/scenes-hanbeta-v2/` và ghi `cutout-manifest.json`.
 */
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { decodeImageToRgba, encodeRgbaToPngFile } from './lib/pngCodec.mjs'

const ARTIFACT_DIR = 'C:/Users/Admin/.gemini/antigravity/brain/f35b2092-9302-4e5e-a555-cb71a26a8c21'
const OUT_DIR = resolve('assets/scenes-hanbeta-v2')

const BG_JOBS = [
  {
    id: 'asset-hb-s1-bg',
    src: 'hb_bg_s1_red_corridor_1794654436620.jpg',
    out: 'bg-s1-red-corridor.png',
    name: 'Cảnh 1 — Hành Lang Ký Túc Xá Đèn Đỏ'
  },
  {
    id: 'asset-hb-s2-bg',
    src: 'hb_bg_s2_frosted_door_hall_1794654454929.jpg',
    out: 'bg-s2-frosted-door-hall.png',
    name: 'Cảnh 2 — Cửa Phòng 404 Kính Mờ & Tờ Quy Tắc'
  },
  {
    id: 'asset-hb-s3-bg',
    src: 'hb_bg_s3_crimson_rooftop_1794654487033.jpg',
    out: 'bg-s3-crimson-rooftop.png',
    name: 'Cảnh 3 — Sân Thượng Trăng Máu Phá Cục'
  }
]

const CUTOUT_JOBS = [
  {
    id: 'asset-hb-coat-back',
    src: 'hb_coat_back_1794654605426.jpg',
    out: 'hb-coat-back.png',
    name: 'Nhân vật — Vạt Áo Khoác Bay Gió',
    opts: { innerTolerance: 0.25, outerTolerance: 0.56, despillStrength: 0.96, cropPadPx: 12 }
  },
  {
    id: 'asset-hb-torso-legs',
    src: 'hb_torso_legs_1794654540452.jpg',
    out: 'hb-torso-legs.png',
    name: 'Nhân vật — Thân & Chân Trụ',
    opts: { innerTolerance: 0.25, outerTolerance: 0.56, despillStrength: 0.96, cropPadPx: 12 }
  },
  {
    id: 'asset-hb-arm-left',
    src: 'hb_arm_left_1794654562182.jpg',
    out: 'hb-arm-left.png',
    name: 'Nhân vật — Tay Trái',
    opts: { innerTolerance: 0.25, outerTolerance: 0.56, despillStrength: 0.96, cropPadPx: 10 }
  },
  {
    id: 'asset-hb-arm-right-note',
    src: 'hb_arm_right_note_1794654582974.jpg',
    out: 'hb-arm-right-note.png',
    name: 'Nhân vật — Tay Phải Cầm Tờ Quy Tắc',
    opts: { innerTolerance: 0.24, outerTolerance: 0.54, despillStrength: 0.92, cropPadPx: 10 }
  },
  {
    id: 'asset-hb-head-calm',
    src: 'hb_head_calm_1794654445990.jpg',
    out: 'hb-head-calm.png',
    name: 'Biểu cảm — Điềm Tĩnh Phân Tích',
    opts: { innerTolerance: 0.24, outerTolerance: 0.54, despillStrength: 0.92, cropPadPx: 10 }
  },
  {
    id: 'asset-hb-head-smirk',
    src: 'hb_head_smirk_1794654464102.jpg',
    out: 'hb-head-smirk.png',
    name: 'Biểu cảm — Cười Nửa Miệng Thấu Thị',
    opts: { innerTolerance: 0.24, outerTolerance: 0.54, despillStrength: 0.92, cropPadPx: 10 }
  },
  {
    id: 'asset-hb-head-shock',
    src: 'hb_head_shock_1794654481025.jpg',
    out: 'hb-head-shock.png',
    name: 'Biểu cảm — Kinh Ngạc Quái Đàm',
    opts: { innerTolerance: 0.24, outerTolerance: 0.54, despillStrength: 0.92, cropPadPx: 10 }
  },
  {
    id: 'asset-hb-prop-lamp',
    src: 'hb_prop_hanging_lamp_1794654446831.jpg',
    out: 'prop-hanging-lamp.png',
    name: 'Đèn Trần Hành Lang Đung Đưa',
    opts: { innerTolerance: 0.25, outerTolerance: 0.56, despillStrength: 0.98, cropPadPx: 10 }
  },
  {
    id: 'asset-hb-prop-shadow',
    src: 'hb_prop_shadow_entity_v2_1794654480391.jpg',
    out: 'prop-shadow-entity.png',
    name: 'Bóng Đen Thực Thể Sau Cửa',
    opts: { innerTolerance: 0.27, outerTolerance: 0.60, despillStrength: 1.0, cropPadPx: 14 }
  },
  {
    id: 'asset-hb-prop-caution',
    src: 'hb_prop_caution_fg_1794654499430.jpg',
    out: 'prop-caution-fg.png',
    name: 'Dây Cảnh Báo & Bùa Niêm Tiền Cảnh',
    opts: { innerTolerance: 0.25, outerTolerance: 0.56, despillStrength: 0.96, cropPadPx: 10 }
  }
]

async function loadPipelineModule() {
  const require = createRequire(import.meta.url)
  const esbuild = require('esbuild')
  const tmpMjs = join(tmpdir(), `pxs-hb-matte-${Date.now()}.mjs`)
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
      const raw = Math.max(0, Math.min(1, (peak - 16) / 185))
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

function generateEerieMistPlate(width = 960, height = 300) {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const ny = (y / (height - 1)) * 2 - 1
    for (let x = 0; x < width; x++) {
      const nx = (x / (width - 1)) * 2 - 1
      const idx = (y * width + x) * 4
      const crimsonTint = Math.max(0, 0.5 - ny * 0.45)
      rgba[idx] = Math.round(165 + crimsonTint * 58)
      rgba[idx + 1] = Math.round(182 - crimsonTint * 36)
      rgba[idx + 2] = Math.round(212 - crimsonTint * 24)
      const radial = Math.max(0, 1 - (nx * nx * 1.1 + ny * ny * 1.3))
      if (radial <= 0.005) continue
      const puff = fbm2D(x / 115 + 2.7, y / 65 + 5.1, 4)
      const wisps = fbm2D(x / 46 + 9.2, y / 24 + 3.3, 3)
      const density = Math.pow(radial, 1.35) * Math.max(0, Math.min(1, (puff * 0.72 + wisps * 0.38 - 0.18) * 1.85))
      const aByte = Math.round(Math.min(186, density * 228))
      if (aByte >= 2) rgba[idx + 3] = aByte
    }
  }
  return { rgba, width, height }
}

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
  const { mod, cleanup } = await loadPipelineModule()
  const manifest = []
  try {
    for (const bg of BG_JOBS) {
      const decoded = decodeImageToRgba(join(ARTIFACT_DIR, bg.src))
      encodeRgbaToPngFile(join(OUT_DIR, bg.out), decoded.rgba, decoded.width, decoded.height)
      console.log(`✓ ${bg.out}: ${decoded.width}x${decoded.height} (background png)`)
      manifest.push({ id: bg.id, file: bg.out, name: bg.name, kind: 'bg', width: decoded.width, height: decoded.height })
    }

    for (const job of CUTOUT_JOBS) {
      const decoded = decodeImageToRgba(join(ARTIFACT_DIR, job.src))
      const extracted = mod.extractForegroundPlate(decoded.rgba, decoded.width, decoded.height, job.opts)
      decontaminateTransparentBleed(extracted.rgba, extracted.width, extracted.height, 4)
      encodeRgbaToPngFile(join(OUT_DIR, job.out), extracted.rgba, extracted.width, extracted.height)
      console.log(`✓ ${job.out}: ${decoded.width}x${decoded.height} -> ${extracted.width}x${extracted.height} (key=${extracted.keyColor.kind}, cov=${extracted.coverageRatio})`)
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

    const sealSrc = decodeImageToRgba(join(ARTIFACT_DIR, 'hb_fx_rule_break_seal_1794654520843.jpg'))
    const sealOut = extractBlackLumaPlate(sealSrc.rgba, sealSrc.width, sealSrc.height, 14)
    encodeRgbaToPngFile(join(OUT_DIR, 'fx-rule-break-seal.png'), sealOut.rgba, sealOut.width, sealOut.height)
    console.log(`✓ fx-rule-break-seal.png: ${sealSrc.width}x${sealSrc.height} -> ${sealOut.width}x${sealOut.height} (black-luma)`)
    manifest.push({ id: 'asset-hb-fx-seal', file: 'fx-rule-break-seal.png', name: 'Ấn Triện Phá Giải Quy Tắc', kind: 'cutout', width: sealOut.width, height: sealOut.height })

    const mistOut = generateEerieMistPlate(960, 300)
    encodeRgbaToPngFile(join(OUT_DIR, 'fx-eerie-mist.png'), mistOut.rgba, mistOut.width, mistOut.height)
    console.log(`✓ fx-eerie-mist.png: ${mistOut.width}x${mistOut.height} (procedural mist)`)
    manifest.push({ id: 'asset-hb-fx-mist', file: 'fx-eerie-mist.png', name: 'Sương Lạnh Quái Đàm', kind: 'cutout', width: mistOut.width, height: mistOut.height })
  } finally {
    cleanup()
  }

  writeFileSync(join(OUT_DIR, 'cutout-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`✓ Đã ghi cutout-manifest.json (${manifest.length} mục) tại assets/scenes-hanbeta-v2/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
