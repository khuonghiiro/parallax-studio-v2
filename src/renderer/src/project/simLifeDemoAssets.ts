import type { AssetMeta, ImageLayer, Project } from '@shared/types'
import {
  applyNormalizedCharacterStaging,
  type CharacterBodyClass,
  type ShotFramingKind
} from '../animation/characterScaleNormalizer'
import { assetStore } from './assets'
import { createImageLayer } from './factory'
import { loadAssetBytesFromDiskOrBuiltIn } from './json/assetLoader'

export interface SimLifeAssetSpec {
  id: string
  relPath: string
  name: string
  fallbackWidth: number
  fallbackHeight: number
  mime: 'image/png' | 'image/jpeg'
}

/**
 * Bộ tài nguyên mỹ thuật 2.5D dành cho 2 mẫu thử "Hệ Thống Mô Phỏng Cuộc Đời Người Khác"
 * (kết hợp tranh cắt lớp alpha-matte chuyên biệt `builtin/sim_life/` và đạo cụ hệ thống/mây sương sẵn có).
 */
export const SIM_LIFE_ASSET_SPECS: SimLifeAssetSpec[] = [
  {
    id: 'asset-sim-vortex-bg',
    relPath: 'builtin/sim_life/vortex_transmigration_bg.jpg',
    name: 'Nền Vòng Xoáy Xuyên Không Linh Khí',
    fallbackWidth: 1920,
    fallbackHeight: 1080,
    mime: 'image/jpeg'
  },
  {
    id: 'asset-sim-sect-gate-bg',
    relPath: 'builtin/donghua_s4/bg_s1_cloud_sword_terrace.jpg',
    name: 'Nền Sơn Môn Thanh Huyền Tông Biển Mây',
    fallbackWidth: 1920,
    fallbackHeight: 1080,
    mime: 'image/jpeg'
  },
  {
    id: 'asset-sim-bamboo-bg',
    relPath: 'builtin/donghua_s4/bg_s2_moonlit_bamboo_corridor.jpg',
    name: 'Nền Hành Lang Trúc Lâm Ngoại Môn',
    fallbackWidth: 1920,
    fallbackHeight: 1080,
    mime: 'image/jpeg'
  },
  {
    id: 'asset-sim-tieu-bach-mortal',
    relPath: 'builtin/sim_life/tieu_bach_mortal.png',
    name: 'Tiểu Bạch — Phàm Nhân Cầu Tiên',
    fallbackWidth: 384,
    fallbackHeight: 1024,
    mime: 'image/png'
  },
  {
    id: 'asset-sim-tieu-bach-pout',
    relPath: 'builtin/sim_life/tieu_bach_pout_arms.png',
    name: 'Tiểu Bạch — Khoanh Tay Cạn Lời (Shadiao)',
    fallbackWidth: 304,
    fallbackHeight: 1024,
    mime: 'image/png'
  },
  {
    id: 'asset-sim-tieu-bach-meditate',
    relPath: 'builtin/sim_life/tieu_bach_meditate_gold.png',
    name: 'Tiểu Bạch — Tụ Khí Đột Phá Kim Quang',
    fallbackWidth: 892,
    fallbackHeight: 922,
    mime: 'image/png'
  },
  {
    id: 'asset-sim-gatekeeper',
    relPath: 'builtin/sim_life/gatekeeper_purple_point.png',
    name: 'Đệ Tử Gác Cổng Thanh Huyền Môn',
    fallbackWidth: 551,
    fallbackHeight: 1024,
    mime: 'image/png'
  },
  {
    id: 'asset-sim-robot',
    relPath: 'builtin/story_s5/system_robot_mascot.png',
    name: 'Robot Hệ Thống Mô Phỏng',
    fallbackWidth: 640,
    fallbackHeight: 600,
    mime: 'image/png'
  },
  {
    id: 'asset-sim-cloud-fg',
    relPath: 'builtin/story_s5/cloud_bank_wide_fg.png',
    name: 'Dải Mây Tiên Tiền Cảnh',
    fallbackWidth: 1280,
    fallbackHeight: 420,
    mime: 'image/png'
  },
  {
    id: 'asset-sim-cloud-puff',
    relPath: 'builtin/story_s5/cloud_puff_magic.png',
    name: 'Khói Linh Khí Huyền Ảo',
    fallbackWidth: 800,
    fallbackHeight: 600,
    mime: 'image/png'
  }
]

/**
 * Nạp toàn bộ tài nguyên `SIM_LIFE_ASSET_SPECS` vào `assetStore` (hỗ trợ cả Electron Renderer và Vitest Node).
 */
export async function loadSimLifeAssetMap(project: Project): Promise<Map<string, AssetMeta>> {
  const map = new Map<string, AssetMeta>()
  await assetStore.runBatch(async () => {
    for (const spec of SIM_LIFE_ASSET_SPECS) {
      const existing = assetStore.get(spec.id)
      if (existing) {
        project.assets.push({ ...existing.meta })
        map.set(spec.id, existing.meta)
        continue
      }
      const loaded = await loadAssetBytesFromDiskOrBuiltIn(spec.relPath)
      if (loaded) {
        const rt = await assetStore.add(spec.name, loaded.mime, loaded.data, 'image', {
          id: spec.id,
          name: spec.name,
          kind: 'image',
          mime: loaded.mime,
          assetPath: spec.relPath,
          path: `assets/${spec.relPath}`,
          width: spec.fallbackWidth,
          height: spec.fallbackHeight
        })
        project.assets.push({ ...rt.meta })
        map.set(spec.id, rt.meta)
      } else {
        const fallbackMeta: AssetMeta = {
          id: spec.id,
          name: spec.name,
          kind: 'image',
          mime: spec.mime,
          assetPath: spec.relPath,
          path: `assets/${spec.relPath}`,
          width: spec.fallbackWidth,
          height: spec.fallbackHeight
        }
        project.assets.push(fallbackMeta)
        map.set(spec.id, fallbackMeta)
      }
    }
  })
  return map
}

export interface PlaceSimCharacterOpts {
  id: string
  shotId: string
  assetId: string
  name: string
  x: number
  y: number
  z: number
  inPoint: number
  outPoint: number
  bodyClass: CharacterBodyClass
  framing?: ShotFramingKind
  anchorBustBottom?: boolean
  customMultiplier?: number
}

/**
 * Đặt một Layer nhân vật 2.5D với kích thước chuẩn hoá `applyNormalizedCharacterStaging`
 * để tỷ lệ đầu-thân đồng nhất xuyên suốt mọi phân cảnh.
 */
export function placeSimCharacterLayer(
  project: Project,
  assets: Map<string, AssetMeta>,
  opts: PlaceSimCharacterOpts
): ImageLayer {
  const meta = assets.get(opts.assetId)
  if (!meta) throw new Error(`Missing SimLife asset: ${opts.assetId}`)
  const layer = createImageLayer(meta, project.comp, opts.z, opts.shotId)
  layer.id = opts.id
  layer.name = opts.name
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  layer.autoScale = false
  layer.transform.position.value = [opts.x, opts.y, opts.z]
  applyNormalizedCharacterStaging(layer, project.comp, {
    bodyClass: opts.bodyClass,
    framing: opts.framing ?? 'MS',
    anchorBustBottom: opts.anchorBustBottom ?? false,
    customMultiplier: opts.customMultiplier ?? 1
  })
  project.layers.push(layer)
  return layer
}

/** Đặt lớp nền thế giới (Z=1350, autoScale=true phủ kín khung 16:9 kèm lề an toàn). */
export function placeSimWorldBackdrop(
  project: Project,
  assets: Map<string, AssetMeta>,
  opts: {
    id: string
    shotId: string
    assetId: string
    name: string
    inPoint: number
    outPoint: number
    z?: number
    scale?: number
  }
): ImageLayer {
  const meta = assets.get(opts.assetId)
  if (!meta) throw new Error(`Missing SimLife backdrop asset: ${opts.assetId}`)
  const z = opts.z ?? 1350
  const layer = createImageLayer(meta, project.comp, z, opts.shotId)
  layer.id = opts.id
  layer.name = opts.name
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  layer.autoScale = true
  const baseCover = Math.max(
    (project.comp.width * 1.18) / Math.max(1, meta.width ?? 1920),
    (project.comp.height * 1.18) / Math.max(1, meta.height ?? 1080)
  )
  const sc = Number(((opts.scale ?? 1) * baseCover).toFixed(3))
  layer.transform.position.value = [0, 0, z]
  layer.transform.scale.value = [sc, sc, 1]
  project.layers.push(layer)
  return layer
}

/** Đặt đạo cụ tiền cảnh / mây sương tạo chiều sâu 3 lớp Z. */
export function placeSimForegroundProp(
  project: Project,
  assets: Map<string, AssetMeta>,
  opts: {
    id: string
    shotId: string
    assetId: string
    name: string
    x: number
    y: number
    z: number
    scale: number
    inPoint: number
    outPoint: number
    opacity?: number
  }
): ImageLayer {
  const meta = assets.get(opts.assetId)
  if (!meta) throw new Error(`Missing SimLife prop asset: ${opts.assetId}`)
  const layer = createImageLayer(meta, project.comp, opts.z, opts.shotId)
  layer.id = opts.id
  layer.name = opts.name
  layer.inPoint = opts.inPoint
  layer.outPoint = opts.outPoint
  layer.autoScale = false
  layer.transform.position.value = [opts.x, opts.y, opts.z]
  layer.transform.scale.value = [opts.scale, opts.scale, 1]
  layer.transform.opacity.value = opts.opacity ?? 0.85
  project.layers.push(layer)
  return layer
}
