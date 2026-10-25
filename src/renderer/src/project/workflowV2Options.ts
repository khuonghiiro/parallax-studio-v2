import type { Layer, LayerMotionType, VirtualLightKind } from '@shared/types'

/**
 * Danh mục tuỳ chọn & tiện ích đọc Layer dùng chung cho Workflow V2 (không phụ thuộc module khác
 * để tránh vòng import giữa engine / đồng bộ / suy diễn logic).
 */
export type WorkflowV2LogicCategory =
  | 'action'
  | 'anim_fx'
  | 'material'
  | 'collision'
  | 'light'
  | 'cave'
  | 'fx'
  | 'audio'
  | 'camera'

export interface WorkflowV2AnimFxOption {
  id:
    | 'popIn'
    | 'shake'
    | 'pulse'
    | 'fadeIn'
    | 'fadeOut'
    | 'blink'
    | 'breathe'
    | 'neonBreathe'
    | 'neonBlink'
    | 'neonFlicker'
    | 'neonSolid'
  label: string
  shortLabel: string
  badge: string
  fxCategory: 'transform' | 'opacity' | 'glow'
  defaultDuration: number
  defaultIntensity: number
  defaultCount?: number
  defaultColor?: string
}

export const WORKFLOW_V2_ANIM_FX_OPTIONS: WorkflowV2AnimFxOption[] = [
  { id: 'popIn', label: 'Nảy xuất hiện (Pop In)', shortLabel: '🔍 Nảy Pop In', badge: '🔍', fxCategory: 'transform', defaultDuration: 0.5, defaultIntensity: 1.2, defaultCount: 2 },
  { id: 'shake', label: 'Rung chấn (Shake)', shortLabel: '📳 Rung chấn', badge: '📳', fxCategory: 'transform', defaultDuration: 0.45, defaultIntensity: 18, defaultCount: 5 },
  { id: 'pulse', label: 'Nhịp đập (Pulse Scale)', shortLabel: '💥 Nhịp đập', badge: '💥', fxCategory: 'transform', defaultDuration: 0.4, defaultIntensity: 1.25, defaultCount: 2 },
  { id: 'fadeIn', label: 'Hiện dần (Fade In)', shortLabel: '🌕 Hiện dần', badge: '🌕', fxCategory: 'opacity', defaultDuration: 1.0, defaultIntensity: 1.0 },
  { id: 'fadeOut', label: 'Mờ dần (Fade Out)', shortLabel: '🌓 Mờ dần', badge: '🌓', fxCategory: 'opacity', defaultDuration: 1.0, defaultIntensity: 1.0 },
  { id: 'blink', label: 'Nhấp nháy (Blink)', shortLabel: '⚡ Nhấp nháy', badge: '⚡', fxCategory: 'opacity', defaultDuration: 1.0, defaultIntensity: 1.0, defaultCount: 4 },
  { id: 'breathe', label: 'Thở mờ ảo (Breathe)', shortLabel: '💓 Thở mờ ảo', badge: '💓', fxCategory: 'opacity', defaultDuration: 1.2, defaultIntensity: 0.8 },
  { id: 'neonBreathe', label: 'Viền Neon Thở (Breathe)', shortLabel: '✨ Neon Thở', badge: '✨', fxCategory: 'glow', defaultDuration: 1.5, defaultIntensity: 1.5, defaultColor: '#3dd6f5' },
  { id: 'neonBlink', label: 'Viền Neon Nhấp nháy (Blink)', shortLabel: '🚨 Neon Chớp', badge: '🚨', fxCategory: 'glow', defaultDuration: 1.0, defaultIntensity: 1.6, defaultCount: 4, defaultColor: '#f59e0b' },
  { id: 'neonFlicker', label: 'Viền Neon Chập chờn (Flicker)', shortLabel: '💡 Neon Chập chờn', badge: '💡', fxCategory: 'glow', defaultDuration: 1.2, defaultIntensity: 1.8, defaultColor: '#ec4899' },
  { id: 'neonSolid', label: 'Viền Neon Tĩnh (Solid Glow)', shortLabel: '🔮 Neon Tĩnh', badge: '🔮', fxCategory: 'glow', defaultDuration: 1.0, defaultIntensity: 1.3, defaultColor: '#3dd6f5' }
]

export interface WorkflowV2ActionOption {
  id: string
  label: string
  motionType: LayerMotionType
  defaultSpeed: number
  defaultAmount: number
}

export const WORKFLOW_V2_ACTION_OPTIONS: WorkflowV2ActionOption[] = [
  { id: 'float', label: 'Bay lơ lửng', motionType: 'float', defaultSpeed: 1.0, defaultAmount: 0.65 },
  { id: 'sway', label: 'Đung đưa gió', motionType: 'sway', defaultSpeed: 1.1, defaultAmount: 0.6 },
  { id: 'wind', label: 'Gió thổi lá', motionType: 'wind', defaultSpeed: 1.2, defaultAmount: 0.7 },
  { id: 'drift', label: 'Trượt ngang', motionType: 'drift', defaultSpeed: 1.0, defaultAmount: 0.75 },
  { id: 'pulse', label: 'Nhịp thở / Pulse', motionType: 'pulse', defaultSpeed: 1.1, defaultAmount: 0.55 },
  { id: 'wiggle', label: 'Rung tự nhiên', motionType: 'wiggle', defaultSpeed: 1.5, defaultAmount: 0.5 },
  { id: 'spin', label: 'Xoay vòng', motionType: 'spin', defaultSpeed: 0.8, defaultAmount: 0.6 }
]

export interface WorkflowV2LightOption {
  id: 'rim' | 'point' | 'spot' | 'candle' | 'glow' | 'cave_crystal'
  label: string
  virtualKind: VirtualLightKind
  defaultColor: string
  defaultIntensity: number
}

export const WORKFLOW_V2_LIGHT_OPTIONS: WorkflowV2LightOption[] = [
  { id: 'rim', label: 'Đèn viền (Rim)', virtualKind: 'bulb', defaultColor: '#38bdf8', defaultIntensity: 1.3 },
  { id: 'point', label: 'Đèn điểm (Bulb)', virtualKind: 'bulb', defaultColor: '#fbbf24', defaultIntensity: 1.4 },
  { id: 'candle', label: 'Ngọn nến (Gió)', virtualKind: 'candle', defaultColor: '#f97316', defaultIntensity: 1.35 },
  { id: 'spot', label: 'Đèn pin (Chùm nón)', virtualKind: 'flashlight', defaultColor: '#fef08a', defaultIntensity: 1.6 },
  { id: 'cave_crystal', label: 'Tinh thể Hang động', virtualKind: 'cave_crystal', defaultColor: '#22d3ee', defaultIntensity: 1.5 },
  { id: 'glow', label: 'Hào quang (Glow)', virtualKind: 'magic_orb', defaultColor: '#34d399', defaultIntensity: 1.2 }
]

export interface WorkflowV2CaveOption {
  id: 'arch' | 'ellipse' | 'circle'
  label: string
  defaultDarkness: number
  defaultMinScale: number
}

export const WORKFLOW_V2_CAVE_OPTIONS: WorkflowV2CaveOption[] = [
  { id: 'arch', label: 'Vòm hang đá tự nhiên', defaultDarkness: 0.82, defaultMinScale: 0.38 },
  { id: 'ellipse', label: 'Cửa hầm Elip sâu', defaultDarkness: 0.86, defaultMinScale: 0.34 },
  { id: 'circle', label: 'Cổng xoáy chiều sâu', defaultDarkness: 0.78, defaultMinScale: 0.42 }
]

export interface WorkflowV2FxOption {
  id: 'wind_physics' | 'bloom' | 'blur' | 'chromatic' | 'vignette' | 'particles'
  label: string
  defaultIntensity: number
}

export const WORKFLOW_V2_FX_OPTIONS: WorkflowV2FxOption[] = [
  { id: 'wind_physics', label: 'Vật lý Đàn hồi Mesh', defaultIntensity: 1.0 },
  { id: 'bloom', label: 'Phát sáng (Bloom)', defaultIntensity: 0.85 },
  { id: 'blur', label: 'Làm mờ chiều sâu', defaultIntensity: 0.6 },
  { id: 'chromatic', label: 'Tán sắc (RGB)', defaultIntensity: 0.5 },
  { id: 'vignette', label: 'Tối góc điện ảnh', defaultIntensity: 0.7 },
  { id: 'particles', label: 'Hạt đom đóm / Sương', defaultIntensity: 1.1 }
]

export interface WorkflowV2CameraOption {
  id: string
  label: string
}

export const WORKFLOW_V2_CAMERA_OPTIONS: WorkflowV2CameraOption[] = [
  { id: 'dollyIn', label: 'Đẩy cận (Dolly In)' },
  { id: 'fly', label: 'Bay xuyên cảnh 3D' },
  { id: 'orbitRight', label: 'Xoay quỹ đạo' },
  { id: 'truckRight', label: 'Lia máy ngang' }
]

export function getLayerZ(layer: Layer): number {
  const pos = layer.transform?.position?.value
  return Array.isArray(pos) && Number.isFinite(pos[2]) ? Math.round(pos[2]) : 0
}

export function getLayerX(layer: Layer): number {
  const pos = layer.transform?.position?.value
  return Array.isArray(pos) && Number.isFinite(pos[0]) ? Math.round(pos[0]) : 0
}

export function getLayerY(layer: Layer): number {
  const pos = layer.transform?.position?.value
  return Array.isArray(pos) && Number.isFinite(pos[1]) ? Math.round(pos[1]) : 0
}

export function getLayerDisplayName(layer: Layer): string {
  return layer.name || layer.composite?.compositeName || layer.model3d?.modelName || 'Layer'
}

export function getClusterDisplayName(layer: Layer): string {
  return layer.composite?.compositeName || layer.model3d?.modelName || layer.name || 'Cụm lắp ráp'
}

/** Phân loại một Layer vào đúng Group Layer ('group_3d' | 'group_25d' | 'group_env') */
export function classifyLayerGroupKind(layer: Layer): 'group_3d' | 'group_25d' | 'group_env' {
  if (layer.model3d || layer.composite) return 'group_3d'
  const z = getLayerZ(layer)
  if (layer.type === 'particles' || layer.type === 'solid' || z >= 2500) return 'group_env'
  return 'group_25d'
}

export interface LayerClusterInstanceInfo {
  instanceId: string
  kind: 'composite' | 'model3d'
  name: string
  rootLayer: Layer
  memberLayers: Layer[]
  memberIds: string[]
  lockedGroup: boolean
}

/** Thu thập danh sách các Cụm 2.5D (`composite.instanceId`) và Mô hình 3D (`model3d.instanceId`) từ tập Layer */
export function collectClusterInstances(layers: Layer[]): LayerClusterInstanceInfo[] {
  const map = new Map<string, LayerClusterInstanceInfo>()
  for (const l of layers) {
    const instId = l.composite?.instanceId || l.model3d?.instanceId
    if (!instId) continue
    const existing = map.get(instId)
    if (existing) {
      existing.memberLayers.push(l)
      existing.memberIds.push(l.id)
      if (l.composite?.isRoot) existing.rootLayer = l
    } else {
      const kind: 'composite' | 'model3d' = l.model3d ? 'model3d' : 'composite'
      const name = getClusterDisplayName(l)
      const lockedGroup = l.composite ? l.composite.lockedGroup !== false : l.model3d ? l.model3d.lockedGroup !== false : true
      map.set(instId, {
        instanceId: instId,
        kind,
        name,
        rootLayer: l,
        memberLayers: [l],
        memberIds: [l.id],
        lockedGroup
      })
    }
  }
  return Array.from(map.values())
}

/**
 * Danh sách các phần tử Layer đưa lên sơ đồ Workflow V2:
 * - Bung toàn bộ các Layer con của Cụm 2.5D (`composite`) và Mô hình 3D (`model3d`) để có thể chỉnh riêng từng layer con;
 * - Các layer con thuộc cùng cụm sẽ được nối hội tụ vào `Node Khoá Cụm` (`v2-cluster-<instanceId>`).
 */
export function collectRepresentativeLayers(layers: Layer[]): {
  layer: Layer
  memberIds: string[]
  isCluster: boolean
  instanceId?: string
}[] {
  return layers.map((l) => {
    const instId = l.composite?.instanceId || l.model3d?.instanceId
    return {
      layer: l,
      memberIds: [l.id],
      isCluster: Boolean(instId),
      instanceId: instId
    }
  })
}
