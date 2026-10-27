import type { Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import {
  extractCompositeDynamicParts,
  type DynamicCompositePartEntry
} from './workflowV2CompositeParts'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_ANIM_FX_OPTIONS,
  WORKFLOW_V2_CAVE_OPTIONS,
  WORKFLOW_V2_FX_OPTIONS,
  WORKFLOW_V2_LIGHT_OPTIONS
} from './workflowV2Options'
import { WORKFLOW_V2_COLLISION_OPTIONS, WORKFLOW_V2_MATERIAL_OPTIONS } from './workflowV2PhysicsAndValidation'

export type WorkflowV2SpawnCategory =
  | 'part_swap'
  | 'rig_bone'
  | 'anim_fx'
  | 'action'
  | 'material'
  | 'collision'
  | 'light'
  | 'cave'
  | 'fx'
  | 'audio'

export interface WorkflowV2LogicCategoryItem {
  id: WorkflowV2SpawnCategory
  icon: string
  label: string
  hint: string
  accent: string
}

/** Nhóm logic gắn vào Layer / Cụm — dùng chung cho Timeline (kho logic) và Workflow (cột trái, menu thả dây, MCP) */
export const WORKFLOW_V2_LOGIC_CATEGORIES: WorkflowV2LogicCategoryItem[] = [
  { id: 'part_swap', icon: '🧩', label: 'Bộ phận', hint: 'Đánh tráo bộ phận có 2+ biến thể theo giây', accent: '#06b6d4' },
  { id: 'rig_bone', icon: '🦴', label: 'Gắn xương', hint: 'Khung xương nhân vật & chuỗi xương uốn dẻo cho Layer', accent: '#f59e0b' },
  { id: 'anim_fx', icon: '🎞️', label: 'Animation', hint: 'Clip xương 2.5D & Keyframe FX', accent: '#6366f1' },
  { id: 'action', icon: '🏃', label: 'Motion', hint: 'Vẽ quỹ đạo & đồ thị chuyển động mới', accent: '#10b981' },
  { id: 'material', icon: '🏷️', label: 'Vật liệu', hint: 'Cao su, gỗ, đá, lá, kim loại', accent: '#f97316' },
  { id: 'collision', icon: '💥', label: 'Va chạm', hint: 'Nối 2 Layer / Cụm va đập vật lý', accent: '#f43f5e' },
  { id: 'light', icon: '💡', label: 'Ánh sáng', hint: 'Đèn viền, nến, glow, nguồn sáng', accent: '#eab308' },
  { id: 'cave', icon: '🕳️', label: 'Hang động', hint: 'Vòm cổng độ sâu 2.5D', accent: '#14b8a6' },
  { id: 'fx', icon: '✨', label: 'Hiệu ứng', hint: 'Gió đàn hồi lưới, bloom, RGB', accent: '#a855f7' },
  { id: 'audio', icon: '🔊', label: 'Âm thanh', hint: 'Thoại, nhép môi & SFX', accent: '#ec4899' }
]

/**
 * Lọc danh sách các Node Logic con phù hợp với ngữ cảnh của Node Cha đang kết nối
 * (Cụm 2.5D, Khối/Layer 3D, hay Layer 2.5D đơn lẻ) và trả về kèm danh sách Bộ phận động từ Tab `Bộ phận`.
 */
export function getCompatibleLogicCatalogForNode(
  parentNode: WorkflowNode | null | undefined,
  project?: Project
): {
  categories: WorkflowV2LogicCategoryItem[]
  dynamicParts: DynamicCompositePartEntry[]
  parentKind: 'composite_25d' | 'model_3d' | 'single_25d'
} {
  if (!parentNode) {
    return { categories: WORKFLOW_V2_LOGIC_CATEGORIES, dynamicParts: [], parentKind: 'single_25d' }
  }
  const firstLayer = project?.layers.find((l) => (parentNode.params?.targetLayerIds ?? []).includes(l.id))
  const is3D = parentNode.params?.assemblyKind === 'model3d' || Boolean(firstLayer?.model3d)
  const isClusterNode =
    parentNode.params?.logicCategory === 'cluster_lock' ||
    Boolean(parentNode.params?.groupKind) ||
    (parentNode.params?.targetLayerIds?.length ?? 0) > 1
  const isComposite =
    !is3D &&
    isClusterNode &&
    (parentNode.params?.assemblyKind === 'composite' ||
      Boolean(parentNode.params?.instanceId) ||
      Boolean(firstLayer?.composite))

  const dynamicParts = project
    ? extractCompositeDynamicParts(project, parentNode.params?.instanceId, firstLayer).filter(
        (p) => p.layerIds.length >= 2 || p.variants.length >= 2
      )
    : []

  if (is3D) {
    const categories: WorkflowV2LogicCategoryItem[] = []
    if (isClusterNode && dynamicParts.length > 0) {
      categories.push({
        id: 'part_swap',
        icon: '🧊',
        label: 'Bộ phận 3D',
        hint: 'Tách mặt / bộ phận khối 3D',
        accent: '#06b6d4'
      })
    }
    categories.push(
      { id: 'action', icon: '🔄', label: 'Motion 3D', hint: 'Xoay 3D & vẽ quỹ đạo chuyển động', accent: '#10b981' },
      { id: 'anim_fx', icon: '🎞️', label: 'Animation 3D', hint: 'Nảy, rung chấn & keyframe khối 3D', accent: '#6366f1' },
      { id: 'material', icon: '🏷️', label: 'Vật liệu 3D', hint: 'Đá cứng, kim loại, gỗ, đàn hồi', accent: '#f97316' },
      { id: 'collision', icon: '💥', label: 'Va chạm 3D', hint: 'Tương tác va đập vật lý 3D', accent: '#f43f5e' },
      { id: 'light', icon: '💡', label: 'Ánh sáng 3D', hint: 'Chiếu sáng khối 3D, Rim & Point', accent: '#eab308' },
      { id: 'fx', icon: '✨', label: 'Hiệu ứng 3D', hint: 'Bloom, Chromatic & hạt môi trường', accent: '#a855f7' },
      { id: 'audio', icon: '🔊', label: 'Âm thanh 3D', hint: 'Âm thanh gắn theo khối 3D', accent: '#ec4899' }
    )
    return { categories, dynamicParts, parentKind: 'model_3d' }
  }

  if (isComposite) {
    const categories: WorkflowV2LogicCategoryItem[] = []
    if (dynamicParts.length > 0 || !project) {
      categories.push({
        id: 'part_swap',
        icon: '🧩',
        label: 'Bộ phận',
        hint: 'Chỉnh bộ phận lắp ráp từ Xưởng 2.5D',
        accent: '#06b6d4'
      })
    }
    categories.push(
    

      { id: 'anim_fx', icon: '🎞️', label: 'Animation', hint: 'Động tác nhép miệng, nháy mắt & Clip xương', accent: '#6366f1' },
      { id: 'action', icon: '🏃', label: 'Motion', hint: 'Vẽ quỹ đạo & đồ thị chuyển động mới', accent: '#10b981' },
      { id: 'material', icon: '🏷️', label: 'Vật liệu', hint: 'Đàn hồi chất liệu cho cụm 2.5D', accent: '#f97316' },
      { id: 'collision', icon: '💥', label: 'Va chạm', hint: 'Nối 2 Cụm / Layer va đập vật lý', accent: '#f43f5e' },
      { id: 'light', icon: '💡', label: 'Ánh sáng', hint: 'Đèn viền, glow, nguồn sáng cụm', accent: '#eab308' },
      { id: 'fx', icon: '✨', label: 'Hiệu ứng', hint: 'Gió đàn hồi lưới, bloom, RGB', accent: '#a855f7' },
      { id: 'audio', icon: '🔊', label: 'Âm thanh', hint: 'Thoại & nhép môi nhân vật', accent: '#ec4899' }
    )
    return { categories, dynamicParts, parentKind: 'composite_25d' }
  }

  // Layer 2.5D đơn lẻ (hoặc Layer mảnh con tách riêng): hiển thị các nhóm logic chuẩn của Layer
  const singleCategories: WorkflowV2LogicCategoryItem[] = [
    { id: 'action', icon: '🏃', label: 'Motion', hint: 'Vẽ quỹ đạo & chuyển động Layer', accent: '#10b981' },
    { id: 'anim_fx', icon: '🎞️', label: 'Animation', hint: 'Keyframe nhịp đập, thở, lắc, xuất hiện', accent: '#6366f1' },
    { id: 'rig_bone', icon: '🦴', label: 'Gắn xương', hint: 'Chuỗi xương uốn dẻo cho Layer', accent: '#f59e0b' },
    { id: 'material', icon: '🏷️', label: 'Vật liệu', hint: 'Cao su, gỗ, đá, lá, kim loại', accent: '#f97316' },
    { id: 'collision', icon: '💥', label: 'Va chạm', hint: 'Nối 2 Layer va đập vật lý', accent: '#f43f5e' },
    { id: 'light', icon: '💡', label: 'Ánh sáng', hint: 'Đèn viền, nến, glow, nguồn sáng', accent: '#eab308' },
    { id: 'cave', icon: '🕳️', label: 'Hang động', hint: 'Vòm cổng độ sâu 2.5D', accent: '#14b8a6' },
    { id: 'fx', icon: '✨', label: 'Hiệu ứng', hint: 'Gió đàn hồi lưới, bloom, RGB', accent: '#a855f7' },
    { id: 'audio', icon: '🔊', label: 'Âm thanh', hint: 'Thoại, nhép môi & SFX', accent: '#ec4899' }
  ]
  return { categories: singleCategories, dynamicParts: [], parentKind: 'single_25d' }
}

export interface WorkflowV2LogicPreset {
  /** Dạng `v2:<nhóm>:<tuỳ chọn>`, ví dụ `v2:light:candle` */
  id: string
  category: WorkflowV2SpawnCategory
  label: string
  title: string
  params: Partial<WorkflowNodeParams>
}

const prefix: Record<WorkflowV2SpawnCategory, string> = {
  part_swap: 'Bộ phận',
  rig_bone: 'Gắn xương',
  anim_fx: 'Animation',
  action: 'Motion',
  material: 'Vật liệu',
  collision: 'Va chạm',
  light: 'Ánh sáng',
  cave: 'Hang động',
  fx: 'Hiệu ứng',
  audio: 'Âm thanh'
}

function preset(category: WorkflowV2SpawnCategory, optionId: string, label: string, params: Partial<WorkflowNodeParams>): WorkflowV2LogicPreset {
  return { id: `v2:${category}:${optionId}`, category, label, title: `${prefix[category]}: ${label}`, params }
}

/** Toàn bộ mẫu logic (mỗi tuỳ chọn của từng nhóm) */
export const WORKFLOW_V2_LOGIC_PRESETS: WorkflowV2LogicPreset[] = [
  preset('action', 'bbox_target', '🎯 Đặt BBox Đích (#1 → #2) & Chiều sâu Z', {
    actionPreset: 'bbox_target',
    motionMode: 'bbox',
    bboxPathType: 'shortest',
    bboxTargetScalePct: 140,
    depthMode: 'flat_2d',
    intensity: 1
  }),
  ...WORKFLOW_V2_ACTION_OPTIONS.map((o) => preset('action', o.id, o.label, { actionPreset: o.id, intensity: o.defaultAmount })),
  preset('action', 'custom_draw', '🎨 Vẽ quỹ đạo & Đồ thị Motion mới', { actionPreset: 'float', intensity: 1 }),
  preset('action', 'rig_idle', '🌬️ Xương 2.5D: Đứng thở (Idle)', { actionPreset: 'pulse', rigActionPreset: 'idle', intensity: 1 }),
  preset('action', 'rig_walk', '🚶 Xương 2.5D: Bước đi (Walk)', { actionPreset: 'sway', rigActionPreset: 'walk', intensity: 1 }),
  preset('action', 'rig_wave', '👋 Xương 2.5D: Vẫy tay chào (Wave)', { actionPreset: 'sway', rigActionPreset: 'wave', intensity: 1 }),
  preset('action', 'rig_bow', '🙇 Xương 2.5D: Cúi chào (Bow)', { actionPreset: 'sway', rigActionPreset: 'bow', intensity: 1 }),
  preset('action', 'rig_action', '⚔️ Xương 2.5D: Vung đòn (Action)', { actionPreset: 'sway', rigActionPreset: 'action', intensity: 1 }),
  preset('rig_bone', 'humanoid_15', '🦴 Khung xương Nhân vật 2.5D (15 khớp)', { rigBonePreset: 'humanoid_15', rigSoftBinding: true, intensity: 1 }),
  preset('rig_bone', 'mixamo_12', '🕺 Auto-Rig 12 điểm mốc Mixamo 2.5D', { rigBonePreset: 'mixamo_12', rigSoftBinding: true, intensity: 1 }),
  preset('rig_bone', 'chain_3', '🌿 Chuỗi xương uốn 3 khớp (Cây / Đạo cụ)', { rigBonePreset: 'chain_3', rigSoftBinding: true, intensity: 1 }),
  ...WORKFLOW_V2_ANIM_FX_OPTIONS.map((o) =>
    preset('anim_fx', o.id, o.label, {
      animFxPreset: o.id,
      intensity: o.defaultIntensity,
      animFxCount: o.defaultCount,
      animFxColor: o.defaultColor
    })
  ),
  preset('anim_fx', 'rig_idle', '🌬️ Clip Animation: Đứng thở (Idle)', { rigActionPreset: 'idle', animFxPreset: 'breathe', intensity: 1 }),
  preset('anim_fx', 'rig_walk', '🚶 Clip Animation: Bước đi (Walk)', { rigActionPreset: 'walk', animFxPreset: 'pulse', intensity: 1 }),
  preset('anim_fx', 'rig_wave', '👋 Clip Animation: Vẫy tay (Wave)', { rigActionPreset: 'wave', animFxPreset: 'pulse', intensity: 1 }),
  preset('part_swap', 'part_group', '🧩 Bộ phận lắp ráp 2.5D', { swapMode: 'part_variant', intensity: 1 }),
  preset('part_swap', 'expression', '😊 Đổi biểu cảm / Biến thể mảnh', { swapMode: 'expression', intensity: 1 }),
  preset('part_swap', 'toggle_part', '👁 Bật / Ẩn bộ phận cụm', { swapMode: 'toggle_part', intensity: 1 }),
  preset('part_swap', 'replace_asset', '🖼 Thay ảnh mảnh / Bộ phận', { swapMode: 'replace_asset', intensity: 1 }),
  preset('part_swap', 'replace_template', '🔄 Thay nguyên cụm 2.5D', { swapMode: 'replace_template', intensity: 1 }),
  ...WORKFLOW_V2_MATERIAL_OPTIONS.map((o) =>
    preset('material', o.id, o.label, {
      materialTag: o.id,
      materialStiffness: o.defaultStiffness,
      materialBounciness: o.defaultBounciness,
      materialGravity: o.defaultGravity,
      intensity: o.defaultBounciness
    })
  ),
  ...WORKFLOW_V2_COLLISION_OPTIONS.map((o) =>
    preset('collision', o.id, o.label, { collisionMode: o.id, collisionForce: o.defaultForce, deformIntensity: o.defaultDeform, intensity: o.defaultForce })
  ),
  ...WORKFLOW_V2_LIGHT_OPTIONS.map((o) =>
    preset('light', o.id, o.label, { lightMode: o.id, lightColor: o.defaultColor, intensity: o.defaultIntensity })
  ),
  ...WORKFLOW_V2_CAVE_OPTIONS.map((o) =>
    preset('cave', o.id, o.label, { caveArchShape: o.id, caveDarkness: o.defaultDarkness, caveMinScale: o.defaultMinScale, intensity: o.defaultDarkness })
  ),
  ...WORKFLOW_V2_FX_OPTIONS.map((o) => preset('fx', o.id, o.label, { fxKind: o.id, intensity: o.defaultIntensity })),
  preset('audio', 'voice', 'Thoại & nhép môi', { intensity: 1, autoLipSync: true })
]

export function findLogicPreset(id: string): WorkflowV2LogicPreset | undefined {
  return WORKFLOW_V2_LOGIC_PRESETS.find((p) => p.id === id)
}

export function defaultLogicPreset(category: WorkflowV2SpawnCategory): WorkflowV2LogicPreset {
  if (category === 'anim_fx') {
    return (
      WORKFLOW_V2_LOGIC_PRESETS.find((p) => p.id === 'v2:anim_fx:pulse') ??
      WORKFLOW_V2_LOGIC_PRESETS.find((p) => p.category === category)!
    )
  }
  return WORKFLOW_V2_LOGIC_PRESETS.find((p) => p.category === category)!
}

/** Ánh xạ mã logic của kho cũ (Workflow V1 / MCP) sang mẫu logic V2 tương đương */
const LEGACY_TO_V2: Record<string, string> = {
  'logic-physics-wind': 'v2:fx:wind_physics',
  'logic-physics-elastic': 'v2:material:jelly_slime',
  'logic-physics-sway': 'v2:action:sway',
  'logic-physics-bounce': 'v2:collision:elastic_bounce',
  'logic-fx-candle': 'v2:light:candle',
  'logic-fx-flashlight': 'v2:light:spot',
  'logic-fx-rimglow': 'v2:light:rim',
  'logic-fx-cave-portal': 'v2:cave:arch',
  'logic-fx-particles': 'v2:fx:particles',
  'logic-motion-walk-z': 'v2:action:drift',
  'logic-motion-jump': 'v2:action:pulse',
  'logic-motion-drift': 'v2:action:drift',
  'logic-motion-breathe': 'v2:action:pulse',
  'logic-motion-cross': 'v2:action:drift',
  'logic-motion-emerge': 'v2:action:float',
  'logic-motion-pulse': 'v2:action:pulse',
  'logic-motion-spin': 'v2:action:spin',
  'logic-audio-lipsync': 'v2:audio:voice',
  'logic-audio-sfx': 'v2:audio:voice'
}

/** Mẫu V2 cho một mã logic bất kỳ (mã V2 trực tiếp, hoặc mã kho cũ đã ánh xạ) */
export function resolveLogicPreset(logicId: string): WorkflowV2LogicPreset | undefined {
  return findLogicPreset(logicId) ?? (LEGACY_TO_V2[logicId] ? findLogicPreset(LEGACY_TO_V2[logicId]) : undefined)
}

/** Áp dụng mẫu lên Node Logic (giữ nguyên dây nối, đích và khoảng thời gian) */
export function applyLogicPresetToNode(node: WorkflowNode, p: WorkflowV2LogicPreset): WorkflowNode {
  return { ...node, title: p.title, params: { ...node.params, ...p.params } }
}
