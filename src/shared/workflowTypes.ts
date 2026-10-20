/**
 * Schema định nghĩa Quy trình Tạo Video Chuyên Nghiệp dạng Node-Port (Workflow Graph)
 * cho Parallax Studio V2.
 *
 * Thiết kế hướng Tác nhân Logic (AI Logical Agents) & Kết nối Cổng (Port-based Pipeline):
 * - Mỗi Node đại diện cho một khâu chuyên môn (Phân cảnh, Lắp ráp 2.5D/3D, Chuyển động,
 *   Vật lý & FX, Đạo diễn Camera, Âm thanh & Lip-Sync, Chỉnh màu & Xuất bản).
 * - Khi nối cổng (Port) từ khối chức năng này sang khối chức năng khác, hệ thống và AI Agent
 *   (thông qua MCP) hiểu rõ luồng xử lý, ngữ cảnh đầu vào/đầu ra và tự động thực thi
 *   đúng kịch bản mà không cần phơi bày hàng trăm tham số rời rạc.
 */

export type WorkflowPortKind =
  | 'scene_ctx'
  | 'actors_rig'
  | 'motion_stream'
  | 'vfx_stage'
  | 'camera_cut'
  | 'audio_mix'

export type WorkflowNodeType =
  | 'scene_shot'
  | 'layer_assembly'
  | 'motion_choreography'
  | 'physics_fx'
  | 'camera_director'
  | 'audio_lipsync'
  | 'look_output'

export type WorkflowAgentRole =
  | 'SceneLayoutAgent'
  | 'AssemblyRigAgent'
  | 'MotionChoreographyAgent'
  | 'PhysicsLightFxAgent'
  | 'CameraDirectorAgent'
  | 'AudioLipSyncAgent'
  | 'ColorGradingRenderAgent'

export type WorkflowTargetKind =
  | 'composite_25d'
  | 'model_3d'
  | 'image_25d'
  | 'particles'
  | 'ground_3d'
  | 'shot'
  | 'audio_track'
  | 'camera_3d'
  | 'look_post'

export interface WorkflowBoundTarget {
  /** ID của Layer, Composite instanceId, Model3D instanceId, Shot hoặc AudioTrack */
  id: string
  /** Tên hiển thị thực tế trong Project (ví dụ: 'Cây Sồi 2.5D', 'Hiệp Sĩ', 'Bầu trời đêm') */
  name: string
  /** Phân loại thực thể trong không gian 2.5D/3D */
  kind: WorkflowTargetKind
  /** Nhãn vai trò (ví dụ: 'Cụm 2.5D (4 lớp)', 'Layer Z:3200', 'Mô hình 3D') */
  roleLabel: string
  /** Tọa độ chiều sâu Z (nếu là Layer/Composite) */
  zDepth?: number
  /** Số lượng lớp con (nếu là Cụm 2.5D Composite hoặc Mô hình 3D) */
  subLayerCount?: number
  /** Danh sách bộ phận con phát hiện được trong cụm */
  partNames?: string[]
  /** True nếu do người dùng chủ động tích chọn thủ công */
  isExplicit?: boolean
}

export interface WorkflowSubPartItem {
  id: string
  label: string
  shortLabel: string
  icon: string
  category:
    | 'bone_25d'
    | 'mesh_physics'
    | 'space_z'
    | 'light_fx'
    | 'camera_rig'
    | 'voice_mouth'
    | 'color_out'
  description: string
  active: boolean
}

export type WorkflowCustomActionKind =
  | 'wind'
  | 'drift'
  | 'float'
  | 'sway'
  | 'pulse'
  | 'spin'
  | 'walk_into_depth'
  | 'jump_arc'
  | 'cross_screen'
  | 'emerge_from_depth'
  | 'virtual_light_candle'
  | 'virtual_light_flashlight'
  | 'rim_glow'
  | 'mesh_elastic'

export interface WorkflowCustomActionRule {
  id: string
  label: string
  targetId: string
  targetName: string
  actionKind: WorkflowCustomActionKind
  speed?: number
  amount?: number
  enabled: boolean
}

export interface WorkflowNodeParams {
  /** Cường độ tổng thể của khâu xử lý (0.1 .. 2.5, mặc định 1.0) */
  intensity?: number
  /** Thời lượng ưu tiên (giây) cho chuyển động hoặc lộ trình camera */
  duration?: number
  /** Tự động giãn tầng độ sâu Z chuẩn Parallax (bầu trời -> tiền cảnh) */
  autoArrangeZ?: boolean
  /** Tự động tạo mặt đất 3D nếu phân cảnh chưa có */
  ensureGround?: boolean
  /** Tự động thêm lớp hạt khí quyển (đom đóm / bụi sáng / sương) */
  spawnParticles?: boolean
  /** Bật tự động nhép môi (Lip-Sync) cho nhân vật có track thoại */
  autoLipSync?: boolean
  /** Bật làm mờ chiều sâu trường ảnh (DOF) cho Camera */
  enableDof?: boolean
  /** Chế độ gắn Layer/Thực thể 2.5D: 'auto' (tự nhận diện thông minh) hoặc 'custom' (chỉ định đích danh) */
  targetMode?: 'auto' | 'custom'
  /** Danh sách ID của Layer hoặc Composite instanceId được gắn trực tiếp vào Node */
  targetLayerIds?: string[]
  /** Danh sách mã Bộ phận 2.5D / Khớp xương / Kênh tác động đang bật trên Node */
  targetParts?: string[]
  /** Danh sách quy tắc Chuyển động / Tính năng bổ sung do người dùng thêm trực tiếp vào Khối */
  customRules?: WorkflowCustomActionRule[]
  /** ID phân cảnh cụ thể mà Node này áp dụng (hoặc truyền xuống luồng nếu là Node Phân cảnh) */
  shotId?: string
  /** Mã định danh Node Logic cụ thể từ Kho Node Logic */
  logicId?: string
}

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  title: string
  enabled: boolean
  position: { x: number; y: number }
  /** Mã preset hành vi của node (ví dụ: 'deep_parallax_stage', 'organic_wind_breathe', 'cinematic_fly_push'...) */
  preset: string
  /** Tác nhân AI chịu trách nhiệm thực thi logic của node này qua MCP */
  aiAgentRole: WorkflowAgentRole
  /** Chỉ dẫn ngữ nghĩa ngắn gọn cho AI & người dùng về ý đồ xử lý của node */
  aiDirective: string
  /** Tham số tinh chỉnh gọn nhẹ (không bắt buộc) */
  params?: WorkflowNodeParams
}

export interface WorkflowEdge {
  id: string
  fromNode: string
  fromPort: WorkflowPortKind
  toNode: string
  toPort: WorkflowPortKind
}

export interface WorkflowGraph {
  version: 1
  id: string
  name: string
  presetId?: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  targetShotId?: string
  lastAppliedAt?: string
}

export interface WorkflowAiAgentStep {
  step: number
  nodeId: string
  nodeType: WorkflowNodeType
  title: string
  aiAgentRole: WorkflowAgentRole
  preset: string
  presetLabel: string
  summary: string
  aiDirective: string
  inputsFrom: { nodeId: string; nodeTitle: string; port: WorkflowPortKind }[]
  outputsTo: { nodeId: string; nodeTitle: string; port: WorkflowPortKind }[]
  /** Danh sách thực thể Layer / Cụm 2.5D / Mô hình 3D thực tế được Node này tác động */
  boundTargets: WorkflowBoundTarget[]
  /** Danh sách các Bộ phận 2.5D / Khớp xương / Kênh cụ thể được Node này điều khiển */
  activeParts: { id: string; label: string; shortLabel: string; category: string }[]
  recommendedMcpTools: string[]
  mcpActionHint: Record<string, unknown>
}

export interface WorkflowAiBlueprint {
  workflowId: string
  workflowName: string
  presetId?: string
  description: string
  totalNodes: number
  connectedNodesCount: number
  isPipelineComplete: boolean
  pipelineSummary: string
  executionOrder: string[]
  agents: WorkflowAiAgentStep[]
}

export interface WorkflowExecutionStageResult {
  nodeId: string
  nodeType: WorkflowNodeType
  title: string
  aiAgentRole: WorkflowAgentRole
  preset: string
  appliedSummary: string
  affectedCount: number
}

export interface WorkflowExecutionReport {
  ok: boolean
  workflowId: string
  workflowName: string
  executedStages: WorkflowExecutionStageResult[]
  skippedDisconnectedNodes: string[]
  blueprint: WorkflowAiBlueprint
}
