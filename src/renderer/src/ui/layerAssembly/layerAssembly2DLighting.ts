import type { AssembledLayerItem } from './types'
import type { AssemblyLighting } from '../assets/models3d/types'
import {
  normalizeLighting,
  resolveLightRig,
  resolveSkyAtmosphere,
  sunDirection
} from '../assets/models3d/assemblyLighting'

export interface Layer2DLightingResult {
  /** Offset bóng đổ trục X (pixel) - ngược hướng nắng */
  shadowDx: number
  /** Offset bóng đổ trục Y (pixel) - hướng xuống theo góc cao mặt trời */
  shadowDy: number
  /** Độ nhòe mờ viền bóng đổ (blur radius pixel) */
  shadowBlur: number
  /** Mã màu và độ mờ của bóng đổ rgba(...) */
  shadowColor: string
  /** Chuỗi CSS drop-shadow(...) hoàn chỉnh */
  dropShadowFilter: string
  /** Chuỗi CSS bộ lọc ánh sáng môi trường (brightness, saturate, sepia, hue-rotate) */
  atmosphereFilter: string
  /** Bộ lọc CSS gộp hoàn chỉnh sẵn sàng gắn trực tiếp vào style.filter */
  combinedFilter: string
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/**
 * Tính toán hiệu ứng hướng sáng, bóng đổ theo chiều sâu Z và màu sắc hấp thụ ánh sáng
 * ngày/đêm cho từng layer ảnh trên khung vẽ 2D.
 */
export function computeLayer2DLighting(
  layer: AssembledLayerItem,
  maxZ: number,
  lightingInput?: Partial<AssemblyLighting> | null
): Layer2DLightingResult {
  const lighting = normalizeLighting(lightingInput)
  const spec = resolveLightRig(lighting)

  // 1. Nếu tắt nguồn sáng mặt trời -> chế độ studio trung tính không bóng gắt
  if (!lighting.sun) {
    const defaultShadow = lighting.shadows
      ? 'drop-shadow(0 3px 8px rgba(0, 0, 0, 0.22))'
      : ''
    return {
      shadowDx: 0,
      shadowDy: 3,
      shadowBlur: 8,
      shadowColor: 'rgba(0, 0, 0, 0.22)',
      dropShadowFilter: defaultShadow,
      atmosphereFilter: '',
      combinedFilter: defaultShadow || 'none'
    }
  }

  // 2. Vector hướng nắng [dirX (phải +), dirY (lên +), dirZ (hướng camera +)]
  const [dirX, , dirZ] = sunDirection(lighting.azimuth, lighting.elevation)

  // Độ dài kéo dài bóng đổ theo góc cao (elevation):
  // Góc càng thấp (bình minh / hoàng hôn) -> bóng càng dài; góc trưa cao -> bóng ngắn
  const elRad = (clamp(lighting.elevation, 6, 85) * Math.PI) / 180
  const tanEl = Math.tan(elRad)
  const shadowStretch = clamp(1 / Math.max(0.18, tanEl), 0.35, 3.2)

  // Khoảng cách cơ bản theo cường độ sáng
  const intensityClamped = clamp(lighting.intensity, 0.3, 1.8)
  const baseDist = 12 * Math.min(1.4, Math.max(0.5, intensityClamped))

  // Bóng đổ rơi về phía NGƯỢC hướng nguồn sáng:
  // Nắng bên phải (dirX > 0) -> bóng ngả sang trái (dx < 0)
  // Nắng bên trái (dirX < 0) -> bóng ngả sang phải (dx > 0)
  const baseDx = -dirX * shadowStretch * baseDist
  const baseDy = Math.max(2, (dirZ >= 0 ? 0.85 : 1.15) * shadowStretch * (baseDist * 0.75))

  // 3. Hệ số độ sâu Z (Z-Depth Factor):
  // Z càng nhỏ (âm) -> layer ở gần camera / ở phía trước -> khoảng cách đến nền/layer sau càng lớn -> bóng đổ càng xa và nhòe
  // Z càng lớn (dương) -> layer ở xa / sát nền -> bóng đổ càng ngắn và khít
  const depthFromBack = Math.max(0, maxZ - (layer.z || 0))
  const zFactor = clamp((depthFromBack + 10) / 32, 0.28, 2.6)

  const shadowDx = Math.round(baseDx * zFactor)
  const shadowDy = Math.round(baseDy * zFactor)
  const blurMultiplier = lighting.preset === 'overcast' ? 1.7 : 1.0
  const shadowBlur = Math.round(Math.max(2, 6 * zFactor * blurMultiplier))

  // 4. Màu sắc và độ đậm của bóng theo tâm trạng thời gian (Mood)
  let shadowColor = ''
  let dropShadowFilter = ''

  if (lighting.shadows) {
    const rawOpacity = spec.shadowOpacity * Math.min(1.3, intensityClamped) * (0.75 + 0.35 * Math.min(1.8, zFactor))
    const alpha = clamp(rawOpacity, 0.08, 0.72)

    switch (lighting.preset) {
      case 'night':
        shadowColor = `rgba(10, 16, 32, ${alpha.toFixed(2)})`
        break
      case 'sunset':
        shadowColor = `rgba(38, 16, 26, ${alpha.toFixed(2)})`
        break
      case 'morning':
        shadowColor = `rgba(18, 22, 35, ${alpha.toFixed(2)})`
        break
      case 'overcast':
        shadowColor = `rgba(30, 36, 46, ${(alpha * 0.7).toFixed(2)})`
        break
      case 'noon':
      case 'auto':
      default:
        shadowColor = `rgba(15, 20, 30, ${alpha.toFixed(2)})`
        break
    }

    dropShadowFilter = `drop-shadow(${shadowDx}px ${shadowDy}px ${shadowBlur}px ${shadowColor})`
  }

  // 5. Màu sắc hấp thụ ánh sáng môi trường trên layer (Atmosphere tint)
  const bFactor = clamp(0.72 + intensityClamped * 0.28, 0.65, 1.25)
  let atmosphereFilter = ''

  switch (lighting.preset) {
    case 'night':
      atmosphereFilter = `brightness(${(0.74 * bFactor).toFixed(2)}) contrast(1.12) saturate(0.85) hue-rotate(8deg)`
      break
    case 'sunset':
      atmosphereFilter = `brightness(${(0.96 * bFactor).toFixed(2)}) saturate(1.25) sepia(0.22) hue-rotate(-10deg)`
      break
    case 'morning':
      atmosphereFilter = `brightness(${(1.04 * bFactor).toFixed(2)}) saturate(1.12) sepia(0.10) hue-rotate(-4deg)`
      break
    case 'overcast':
      atmosphereFilter = `brightness(${(0.94 * bFactor).toFixed(2)}) saturate(0.82) contrast(0.98)`
      break
    case 'noon':
      atmosphereFilter = `brightness(${(1.02 * bFactor).toFixed(2)}) contrast(1.02) saturate(1.02)`
      break
    case 'auto': {
      const warm = 1 - clamp(lighting.elevation / 45, 0, 1)
      const b = (1.0 - 0.05 * warm) * bFactor
      const sat = 1.0 + 0.22 * warm
      const sep = 0.22 * warm
      const hue = -8 * warm
      atmosphereFilter = `brightness(${b.toFixed(2)}) saturate(${sat.toFixed(2)}) sepia(${sep.toFixed(2)}) hue-rotate(${hue.toFixed(1)}deg)`
      break
    }
  }

  const parts = [dropShadowFilter, atmosphereFilter].filter(Boolean)
  const combinedFilter = parts.length > 0 ? parts.join(' ') : 'none'

  return {
    shadowDx,
    shadowDy,
    shadowBlur,
    shadowColor,
    dropShadowFilter,
    atmosphereFilter,
    combinedFilter
  }
}

/**
 * Thông tin bầu không khí canvas 2D đồng bộ với hệ thống ánh sáng 3D
 */
export interface CanvasAtmosphereInfo {
  background: string
  sunColor: string
  label: string
  icon: string
  isDarkScene: boolean
}

export function computeCanvasAtmosphere(
  lightingInput?: Partial<AssemblyLighting> | null,
  isLight = false
): CanvasAtmosphereInfo {
  const lighting = normalizeLighting(lightingInput)
  const sky = resolveSkyAtmosphere(lighting, isLight)
  return {
    background: sky.background,
    sunColor: sky.sunColor,
    label: sky.label,
    icon: sky.icon,
    isDarkScene: sky.isDarkScene
  }
}
