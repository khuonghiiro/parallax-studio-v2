import * as THREE from 'three'
import type { ImageLayer } from '@shared/types'
import type { ImageMeshDefinition } from '@shared/imageMeshDefinition'
import type { LayerRig } from '@shared/layerRig'
import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'

export interface SkinMeshBuildOptions {
  segX?: number
  segY?: number
  rig?: LayerRig
  primaryBoneId?: string
  extraBoneIds?: string[]
  plantSpines?: PlantSpine[]
  isCloth?: boolean
  clothAmplitude?: number
}

/**
 * Tạo lưới `ImageMeshDefinition` chuẩn (`PlaneGeometry` phẳng) gắn xương mềm và/hoặc trục uốn `PlantSpine`
 * để `SceneRenderer` biến dạng đỉnh mượt mà theo thời gian thực ở 60fps.
 */
export function buildLayerSkinMesh(layer: ImageLayer, opts: SkinMeshBuildOptions): ImageMeshDefinition {
  const width = Math.max(16, layer.props.width || 400)
  const height = Math.max(16, layer.props.height || 400)
  const segX = opts.segX ?? 18
  const segY = opts.segY ?? 20
  const geometry = new THREE.PlaneGeometry(width, height, segX, segY)
  const posAttr = geometry.getAttribute('position')
  const uvAttr = geometry.getAttribute('uv')
  const indexAttr = geometry.getIndex()
  const rig: LayerRig = opts.rig ?? { bones: [], duration: 2, loop: true, tracks: {} }
  const hasBones = Boolean(opts.rig && opts.rig.bones.length > 0 && opts.primaryBoneId)

  const def: ImageMeshDefinition = {
    version: 1,
    id: `${layer.id}-skin`,
    name: layer.name,
    surface: { width, height, subdivisions: [segX, segY], restUVBounds: [0, 0, 1, 1] },
    anchorUV: [0.5, 0.5],
    modifiers: [],
    materials: {},
    skin: {
      rig,
      binding: {
        ...(hasBones ? { boneId: opts.primaryBoneId } : {}),
        ...(opts.extraBoneIds?.length ? { extraBoneIds: opts.extraBoneIds } : {}),
        ...(opts.isCloth ? { isCloth: true, clothAmplitude: opts.clothAmplitude ?? 65 } : {}),
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        scaleX: 1,
        scaleY: 1
      },
      ...(opts.plantSpines?.length ? { plantSpines: opts.plantSpines } : {}),
      positions: Array.from(posAttr.array),
      uvs: Array.from(uvAttr.array),
      indices: indexAttr ? Array.from(indexAttr.array) : []
    }
  }
  geometry.dispose()
  return def
}

function makeSpine(
  id: string,
  name: string,
  layerId: string,
  points: PlantSpinePoint[],
  cfg: Partial<Omit<PlantSpine, 'id' | 'name' | 'layerIds' | 'points'>> = {}
): PlantSpine {
  return {
    id,
    name,
    layerIds: [layerId],
    points,
    amplitude: cfg.amplitude ?? 12,
    speed: cfg.speed ?? 0.9,
    stiffness: cfg.stiffness ?? 0.25,
    flexibility: cfg.flexibility ?? 0.65,
    turbulence: cfg.turbulence ?? 0.28,
    lean: cfg.lean ?? 0,
    phaseOffset: cfg.phaseOffset ?? 0,
    reach: cfg.reach ?? 0,
    verticalBob: cfg.verticalBob ?? 0,
    waveLag: cfg.waveLag ?? 0.65,
    enabled: true
  }
}

/** Gắn 4 dải sóng lụa lên áo choàng đỏ (`hero-cloak-back.png` 786x866), ghim cổ áo, tà dưới tung bay. */
export function applyCloakSilkSpines(layer: ImageLayer, intensityScale = 1): void {
  const amp = (v: number): number => Number((v * intensityScale).toFixed(2))
  const plantSpines: PlantSpine[] = [
    makeSpine('dg-cloak-ribbon-top', 'Dây lụa trên', layer.id, [
      { x: 115, y: -275 }, { x: -35, y: -225 }, { x: -195, y: -228 }, { x: -350, y: -215 }
    ], { amplitude: amp(18), speed: 0.68, stiffness: 0.14, flexibility: 0.8, turbulence: 0.32, lean: -3.5, reach: 110, waveLag: 0.85, verticalBob: 0 }),
    makeSpine('dg-cloak-ribbon-low', 'Dây lụa dưới', layer.id, [
      { x: 170, y: -245 }, { x: 25, y: -135 }, { x: -175, y: -90 }, { x: -325, y: 18 }
    ], { amplitude: amp(20), speed: 0.72, stiffness: 0.14, flexibility: 0.82, turbulence: 0.35, lean: -3.5, phaseOffset: 0.24, reach: 115, waveLag: 0.85, verticalBob: 0 }),
    makeSpine('dg-cloak-hem-left', 'Tà choàng trái', layer.id, [
      { x: 145, y: -215 }, { x: -10, y: -15 }, { x: -175, y: 120 }, { x: -325, y: 270 }
    ], { amplitude: amp(14), speed: 0.60, stiffness: 0.22, flexibility: 0.68, turbulence: 0.26, lean: -3.5, phaseOffset: 0.12, reach: 175, waveLag: 0.82, verticalBob: 0 }),
    makeSpine('dg-cloak-hem-center', 'Tà choàng đuôi', layer.id, [
      { x: 210, y: -195 }, { x: 175, y: 40 }, { x: 145, y: 235 }, { x: 215, y: 412 }
    ], { amplitude: amp(12.5), speed: 0.56, stiffness: 0.28, flexibility: 0.62, turbulence: 0.24, lean: -3.5, phaseOffset: 0.42, reach: 205, waveLag: 0.80, verticalBob: 0 })
  ]
  layer.mesh = buildLayerSkinMesh(layer, { segX: 16, segY: 20, plantSpines })
}

/** Gắn uốn lụa cục bộ (`reach: 125`) cho tua kiếm đỏ ở góc dưới-phải, lưỡi thép giữ thẳng 100%. */
export function applySwordTasselSpine(layer: ImageLayer): void {
  const plantSpines = [
    makeSpine('dg-sword-tassel', 'Tua lụa chuôi kiếm', layer.id, [
      { x: 385, y: 215 }, { x: 335, y: 288 }, { x: 265, y: 325 }, { x: 185, y: 335 }
    ], { amplitude: 20, speed: 0.72, stiffness: 0.12, flexibility: 0.8, turbulence: 0.32, lean: -3.0, reach: 125, waveLag: 0.85, verticalBob: 0 })
  ]
  layer.mesh = buildLayerSkinMesh(layer, { segX: 16, segY: 16, plantSpines })
}

/** Gắn 3 nhánh uốn gió cho Cành Đào Tiền Cảnh (`s1-peach-branch-fg.png` 1140x733). */
export function applyPeachBranchSpines(layer: ImageLayer): void {
  const plantSpines = [
    makeSpine('dg-peach-main', 'Nhánh đào chính vươn phải', layer.id, [
      { x: -455, y: 255 }, { x: -245, y: 20 }, { x: 75, y: 15 }, { x: 325, y: -145 }, { x: 535, y: -325 }
    ], { amplitude: 7.5, speed: 0.42, stiffness: 0.38, flexibility: 0.52, turbulence: 0.25, lean: 2.2, reach: 250, waveLag: 0.52, verticalBob: 0 }),
    makeSpine('dg-peach-left', 'Nhánh đào hoa trái', layer.id, [
      { x: -465, y: 165 }, { x: -425, y: -15 }, { x: -370, y: -235 }
    ], { amplitude: 9.5, speed: 0.48, stiffness: 0.28, flexibility: 0.58, turbulence: 0.28, lean: 2.2, phaseOffset: 0.3, reach: 170, waveLag: 0.58, verticalBob: 0 }),
    makeSpine('dg-peach-lower', 'Nhánh đào rủ dưới', layer.id, [
      { x: -265, y: 125 }, { x: -165, y: 235 }, { x: -68, y: 312 }
    ], { amplitude: 10.5, speed: 0.52, stiffness: 0.24, flexibility: 0.65, turbulence: 0.3, lean: 2.2, phaseOffset: 0.65, reach: 155, waveLag: 0.62, verticalBob: 0 })
  ]
  layer.mesh = buildLayerSkinMesh(layer, { segX: 20, segY: 16, plantSpines })
}

/**
 * Gắn 2 nhánh uốn tán thông (`reach: 130`) ở nửa PHẢI của `s1-cliff-pavilion.png` (`872x728`).
 * Toàn bộ đình cổ (`x < 0`) và vách đá vững chắc đứng yên 100%.
 */
export function applyCliffPineSpines(layer: ImageLayer): void {
  const plantSpines = [
    makeSpine('dg-cliff-pine-top', 'Tán tùng đỉnh vách núi', layer.id, [
      { x: 145, y: -125 }, { x: 215, y: -215 }, { x: 315, y: -260 }, { x: 395, y: -255 }
    ], { amplitude: 5.8, speed: 0.40, stiffness: 0.32, flexibility: 0.5, turbulence: 0.22, reach: 130, waveLag: 0.45, verticalBob: 0 }),
    makeSpine('dg-cliff-pine-low', 'Tán tùng vươn phải', layer.id, [
      { x: 180, y: -15 }, { x: 295, y: 20 }, { x: 412, y: 18 }
    ], { amplitude: 6.2, speed: 0.46, stiffness: 0.32, flexibility: 0.55, turbulence: 0.24, phaseOffset: 0.35, reach: 125, waveLag: 0.48, verticalBob: 0 })
  ]
  layer.mesh = buildLayerSkinMesh(layer, { segX: 18, segY: 16, plantSpines })
}

/**
 * Gắn 3 trục uốn gió đêm cho Khóm Trúc Tiền Cảnh (`s2-bamboo-rock-fg.png` 1172x768).
 * Mọi điểm gốc bắt đầu ở vùng y <= -45 (trên đỉnh đá Thái Hồ) nên tảng đá bên dưới đứng yên 0 px.
 */
export function applyBambooWindSpines(layer: ImageLayer): void {
  const plantSpines = [
    makeSpine('dg-bamboo-left', 'Rặng trúc cao trái', layer.id, [
      { x: -325, y: -48 }, { x: -355, y: -195 }, { x: -390, y: -368 }
    ], { amplitude: 11.5, speed: 0.56, stiffness: 0.22, flexibility: 0.65, turbulence: 0.34, lean: 2.2, reach: 175, waveLag: 0.62, verticalBob: 0 }),
    makeSpine('dg-bamboo-mid', 'Khóm trúc giữa', layer.id, [
      { x: -145, y: -58 }, { x: -102, y: -205 }, { x: -58, y: -368 }
    ], { amplitude: 12.5, speed: 0.62, stiffness: 0.2, flexibility: 0.7, turbulence: 0.36, lean: 2.5, phaseOffset: 0.22, reach: 175, waveLag: 0.68, verticalBob: 0 }),
    makeSpine('dg-bamboo-right', 'Nhánh trúc vươn phải', layer.id, [
      { x: 18, y: -78 }, { x: 255, y: -205 }, { x: 525, y: -305 }
    ], { amplitude: 13.8, speed: 0.68, stiffness: 0.18, flexibility: 0.75, turbulence: 0.38, lean: 1.8, phaseOffset: 0.45, reach: 180, waveLag: 0.72, verticalBob: 0 })
  ]
  layer.mesh = buildLayerSkinMesh(layer, { segX: 22, segY: 20, plantSpines })
}

/** Gợn sóng phản chiếu ánh trăng & đèn hoa sen (`fx-water-shimmer.png` 760x180). */
export function applyWaterShimmerSpines(layer: ImageLayer): void {
  const w = layer.props.width || 760
  const plantSpines = [
    makeSpine('dg-water-wave-l', 'Sóng nước trái', layer.id, [
      { x: -w * 0.05, y: 0 }, { x: -w * 0.25, y: 4 }, { x: -w * 0.46, y: -2 }
    ], { amplitude: 7.5, speed: 0.68, stiffness: 0.15, flexibility: 0.55, turbulence: 0.22, verticalBob: 0.03, waveLag: 0.68 }),
    makeSpine('dg-water-wave-r', 'Sóng nước phải', layer.id, [
      { x: w * 0.05, y: 0 }, { x: w * 0.26, y: -3 }, { x: w * 0.46, y: 3 }
    ], { amplitude: 7.5, speed: 0.72, stiffness: 0.15, flexibility: 0.55, turbulence: 0.22, phaseOffset: 0.35, verticalBob: 0.03, waveLag: 0.68 })
  ]
  layer.mesh = buildLayerSkinMesh(layer, { segX: 18, segY: 8, plantSpines })
}
