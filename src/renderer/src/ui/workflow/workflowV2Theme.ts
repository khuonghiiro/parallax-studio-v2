import type { WorkflowNode, WorkflowPortKind } from '@shared/types'
import {
  WORKFLOW_V2_LOGIC_CATEGORIES,
  type WorkflowV2SpawnCategory
} from '../../project/workflowV2LogicPresets'

export type { WorkflowV2SpawnCategory }

export interface WorkflowV2NodeTheme {
  badge: string
  icon: string
  accent: string
  portIn: WorkflowPortKind
  portOut: WorkflowPortKind
  levelClass: string
}

/** Danh mục Node Logic gắn vào Layer — cùng nguồn với kho logic của Timeline (`workflowV2LogicPresets`) */
export const WORKFLOW_V2_SPAWN_CATALOG = WORKFLOW_V2_LOGIC_CATEGORIES

const LOGIC_THEMES: Record<string, WorkflowV2NodeTheme> = {
  material: { badge: 'VẬT LIỆU', icon: '🏷️', accent: '#f97316', portIn: 'layers_tree', portOut: 'vfx_stage', levelClass: 'level-logic' },
  collision: { badge: 'VA CHẠM', icon: '💥', accent: '#f43f5e', portIn: 'layers_tree', portOut: 'vfx_stage', levelClass: 'level-logic' },
  light: { badge: 'ÁNH SÁNG', icon: '💡', accent: '#f59e0b', portIn: 'layers_tree', portOut: 'vfx_stage', levelClass: 'level-logic' },
  cave: { badge: 'HANG ĐỘNG', icon: '🕳️', accent: '#14b8a6', portIn: 'layers_tree', portOut: 'vfx_stage', levelClass: 'level-logic' },
  fx: { badge: 'HIỆU ỨNG', icon: '✨', accent: '#a855f7', portIn: 'layers_tree', portOut: 'vfx_stage', levelClass: 'level-logic' },
  audio: { badge: 'ÂM THANH', icon: '🔊', accent: '#ec4899', portIn: 'layers_tree', portOut: 'audio_mix', levelClass: 'level-logic' },
  camera: { badge: 'CAMERA 3D', icon: '🎥', accent: '#22d3ee', portIn: 'scene_ctx', portOut: 'camera_cut', levelClass: 'level-logic' },
  action: { badge: 'HÀNH ĐỘNG', icon: '🏃', accent: '#10b981', portIn: 'layers_tree', portOut: 'motion_stream', levelClass: 'level-logic' }
}

const GROUP_THEMES: Record<string, WorkflowV2NodeTheme> = {
  group_3d: { badge: 'GROUP 3D', icon: '🧊', accent: '#06b6d4', portIn: 'scene_ctx', portOut: 'layers_tree', levelClass: 'level-group' },
  group_25d: { badge: 'GROUP 2.5D', icon: '🗂️', accent: '#3b82f6', portIn: 'scene_ctx', portOut: 'layers_tree', levelClass: 'level-group' },
  group_env: { badge: 'MÔI TRƯỜNG', icon: '🌍', accent: '#10b981', portIn: 'scene_ctx', portOut: 'layers_tree', levelClass: 'level-group' }
}

/** Loại logic hiển thị của Node (suy ra từ type khi Node cũ chưa có `logicCategory`) */
export function resolveV2LogicCategory(node: WorkflowNode): string {
  if (node.params?.logicCategory) return node.params.logicCategory
  if (node.type === 'camera_director') return 'camera'
  if (node.type === 'audio_lipsync') return 'audio'
  if (node.type === 'physics_fx') return 'fx'
  return 'action'
}

export type WorkflowV2NodeLevel = 'root' | 'group' | 'layer' | 'logic'

export function resolveV2NodeLevel(node: WorkflowNode): WorkflowV2NodeLevel {
  if (node.type === 'scene_shot') return 'root'
  if (node.params?.groupKind) return 'group'
  if (node.type === 'layer_assembly') return 'layer'
  return 'logic'
}

export function resolveV2NodeTheme(node: WorkflowNode): WorkflowV2NodeTheme {
  const level = resolveV2NodeLevel(node)
  if (level === 'root') {
    return { badge: 'CẢNH', icon: '🎬', accent: '#38bdf8', portIn: 'scene_ctx', portOut: 'scene_ctx', levelClass: 'level-root' }
  }
  if (level === 'group') return GROUP_THEMES[node.params!.groupKind!] ?? GROUP_THEMES.group_25d
  if (level === 'layer') {
    const kind = node.params?.assemblyKind
    return {
      badge: kind === 'model3d' ? 'LAYER 3D' : kind === 'composite' ? 'CỤM 2.5D' : 'LAYER 2.5D',
      icon: kind === 'model3d' ? '🧊' : kind === 'composite' ? '🧩' : '🖼️',
      accent: '#60a5fa',
      portIn: 'layers_tree',
      portOut: 'layers_tree',
      levelClass: 'level-layer'
    }
  }
  return LOGIC_THEMES[resolveV2LogicCategory(node)] ?? LOGIC_THEMES.action
}

/** Tiêu đề hiển thị gọn (bỏ tiền tố loại như "Hành động: ", "Cảnh: "...) */
export function cleanV2NodeTitle(title: string): string {
  return title.replace(/^(Hành động|Vật liệu|Va chạm|Ánh sáng|Hang động|Hiệu ứng|Âm thanh|Cảnh|Camera):\s*/i, '')
}
