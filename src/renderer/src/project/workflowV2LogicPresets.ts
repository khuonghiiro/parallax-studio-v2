import type { WorkflowNode, WorkflowNodeParams } from '@shared/types'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_ANIM_FX_OPTIONS,
  WORKFLOW_V2_CAVE_OPTIONS,
  WORKFLOW_V2_FX_OPTIONS,
  WORKFLOW_V2_LIGHT_OPTIONS
} from './workflowV2Options'
import { WORKFLOW_V2_COLLISION_OPTIONS, WORKFLOW_V2_MATERIAL_OPTIONS } from './workflowV2PhysicsAndValidation'

export type WorkflowV2SpawnCategory =
  | 'action'
  | 'anim_fx'
  | 'part_swap'
  | 'material'
  | 'collision'
  | 'light'
  | 'cave'
  | 'fx'
  | 'audio'

/** Nhóm logic gắn vào Layer — dùng chung cho Timeline (kho logic) và Workflow (cột trái, menu thả dây, MCP) */
export const WORKFLOW_V2_LOGIC_CATEGORIES: {
  id: WorkflowV2SpawnCategory
  icon: string
  label: string
  hint: string
  accent: string
}[] = [
  { id: 'action', icon: '🏃', label: 'Hành động', hint: 'Motion, xương 2.5D, đung đưa', accent: '#10b981' },
  { id: 'anim_fx', icon: '🎞️', label: 'Hoạt ảnh FX', hint: 'Nảy, rung, mờ dần, neon', accent: '#6366f1' },
  { id: 'part_swap', icon: '🧩', label: 'Thay Layer / Cụm', hint: 'Đổi biểu cảm, thay mảnh / cụm 2.5D', accent: '#06b6d4' },
  { id: 'material', icon: '🏷️', label: 'Vật liệu', hint: 'Cao su, gỗ, đá, lá', accent: '#f97316' },
  { id: 'collision', icon: '💥', label: 'Va chạm', hint: 'Nối 2 Layer va đập', accent: '#f43f5e' },
  { id: 'light', icon: '💡', label: 'Ánh sáng', hint: 'Đèn viền, nến, glow', accent: '#f59e0b' },
  { id: 'cave', icon: '🕳️', label: 'Hang động', hint: 'Vòm độ sâu', accent: '#14b8a6' },
  { id: 'fx', icon: '✨', label: 'Hiệu ứng', hint: 'Đàn hồi, bloom, RGB', accent: '#a855f7' },
  { id: 'audio', icon: '🔊', label: 'Âm thanh', hint: 'Thoại, nhép môi', accent: '#ec4899' }
]

export interface WorkflowV2LogicPreset {
  /** Dạng `v2:<nhóm>:<tuỳ chọn>`, ví dụ `v2:light:candle` */
  id: string
  category: WorkflowV2SpawnCategory
  label: string
  title: string
  params: Partial<WorkflowNodeParams>
}

const prefix: Record<WorkflowV2SpawnCategory, string> = {
  action: 'Hành động',
  anim_fx: 'Hoạt ảnh',
  part_swap: 'Thay bộ phận',
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
  ...WORKFLOW_V2_ACTION_OPTIONS.map((o) => preset('action', o.id, o.label, { actionPreset: o.id, intensity: o.defaultAmount })),
  preset('action', 'rig_idle', '🌬️ Xương 2.5D: Đứng thở (Idle)', { actionPreset: 'pulse', rigActionPreset: 'idle', intensity: 1 }),
  preset('action', 'rig_walk', '🚶 Xương 2.5D: Bước đi (Walk)', { actionPreset: 'sway', rigActionPreset: 'walk', intensity: 1 }),
  preset('action', 'rig_wave', '👋 Xương 2.5D: Vẫy tay chào (Wave)', { actionPreset: 'sway', rigActionPreset: 'wave', intensity: 1 }),
  preset('action', 'rig_bow', '🙇 Xương 2.5D: Cúi chào (Bow)', { actionPreset: 'sway', rigActionPreset: 'bow', intensity: 1 }),
  preset('action', 'rig_action', '⚔️ Xương 2.5D: Vung đòn (Action)', { actionPreset: 'sway', rigActionPreset: 'action', intensity: 1 }),
  ...WORKFLOW_V2_ANIM_FX_OPTIONS.map((o) =>
    preset('anim_fx', o.id, o.label, {
      animFxPreset: o.id,
      intensity: o.defaultIntensity,
      animFxCount: o.defaultCount,
      animFxColor: o.defaultColor
    })
  ),
  preset('part_swap', 'expression', '😊 Đổi biểu cảm / Biến thể mảnh', { swapMode: 'expression', intensity: 1 }),
  preset('part_swap', 'toggle_part', '👓 Bật / Tắt phụ kiện cụm', { swapMode: 'toggle_part', intensity: 1 }),
  preset('part_swap', 'replace_asset', '🖼 Thay ảnh mảnh / Layer', { swapMode: 'replace_asset', intensity: 1 }),
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
