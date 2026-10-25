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
  | 'layers_tree'
  | 'transform_link'
export type WorkflowNodeType =
  | 'scene_shot'
  | 'layer_assembly'
  | 'motion_choreography'
  | 'physics_fx'
  | 'camera_director'
  | 'audio_lipsync'
  | 'look_output'
  | 'layer_transform'
export type WorkflowAgentRole =
  | 'SceneLayoutAgent'
  | 'AssemblyRigAgent'
  | 'MotionChoreographyAgent'
  | 'PhysicsLightFxAgent'
  | 'CameraDirectorAgent'
  | 'AudioLipSyncAgent'
  | 'ColorGradingRenderAgent'
  | 'LayerTransformAgent'
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
  | 'mesh_elastic' | 'depth_portal' | 'billboard_y'
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
  /** Once wired to layer data, losing the wire must not silently broaden to the whole scene. */
  requireLayerConnection?: boolean
  /** Danh sách mã Bộ phận 2.5D / Khớp xương / Kênh tác động đang bật trên Node */
  targetParts?: string[]
  /** Danh sách quy tắc Chuyển động / Tính năng bổ sung do người dùng thêm trực tiếp vào Khối */
  customRules?: WorkflowCustomActionRule[]
  /** ID phân cảnh cụ thể mà Node này áp dụng (hoặc truyền xuống luồng nếu là Node Phân cảnh) */
  shotId?: string
  /** Mã định danh Node Logic cụ thể từ Kho Node Logic */
  logicId?: string
  /** Mẫu chuyển động camera tùy chọn ('dollyIn' | 'orbitRight' | 'truckRight' | 'fly') */
  camPreset?: string
  /** Độ rung máy quay cầm tay (0 .. 20) */
  camShakeAmount?: number
  /** Tốc độ rung máy quay (0.2 .. 3.0 Hz) */
  camShakeSpeed?: number
  /** Khoảng cách tiêu cự xóa phông DOF (world units) */
  camFocusDistance?: number
  /** Độ mở khẩu / độ nhòe bokeh DOF (0.005 .. 0.1) */
  camAperture?: number
  /** ID layer chủ thể được camera khóa mục tiêu theo dõi */
  camTargetLayerId?: string
  /** Kịch bản đạo diễn camera (ví dụ: 'pan_and_dolly' = Lia máy tới mục tiêu rồi Zoom đẩy cận) */
  camChoreography?: 'pan_and_dolly' | 'orbit_zoom' | 'standard'
  /** Tỷ lệ thời lượng dành cho bước lia máy (0.2 .. 0.8, mặc định 0.45) */
  camPanDurationRatio?: number
  /** Tọa độ tức thời trục X của layer controller */
  transformX?: number
  /** Tọa độ tức thời trục Y của layer controller */
  transformY?: number
  /** Chiều sâu Z của layer controller */
  transformZ?: number
  /** Góc xoay hướng (độ) của layer controller */
  transformRotation?: number
  /** Đánh dấu Node Root điều phối cụm Lắp Ráp 3D hoặc Layer 2.5D Composite */
  isAssemblyRoot?: boolean
  /** Organizational root of an expanded composite; does not change layer parenting. */
  configurationMode?: 'explicit'
  assemblyRootNodeId?: string
  /** Parent node in the expanded layer tree. */
  hierarchyParentNodeId?: string
  /** Phân loại cụm lắp ráp: 'composite' (Layer 2.5D) hoặc 'model3d' (Mô hình 3D Modular) */
  assemblyKind?: 'composite' | 'model3d'
  /** Tổng số lượng layer/mặt con thuộc cụm lắp ráp */
  childLayerCount?: number
  /** [Workflow V2] Mốc thời gian bắt đầu (giây) của Node trên đường kẻ thời gian */
  timeStart?: number
  /** [Workflow V2] Mốc thời gian kết thúc (giây) của Node trên đường kẻ thời gian */
  timeEnd?: number
  /** [Workflow V2] Phân loại Node Group Layer ('group_3d' | 'group_25d' | 'group_env') */
  groupKind?: 'group_3d' | 'group_25d' | 'group_env'
  /** [Workflow V2] Trạng thái thu gọn nhánh con của Group hoặc Layer */
  collapsedGroup?: boolean
  /** [Workflow V2] Phân loại Node Logic gắn vào Layer ('action' | 'material' | 'collision' | 'light' | 'cave' | 'fx' | 'audio' | 'camera') */
  logicCategory?:
    | 'action'
    | 'material'
    | 'collision'
    | 'light'
    | 'cave'
    | 'fx'
    | 'audio'
    | 'camera'
  /** [Workflow V2] Danh sách các ID Node Layer đang cùng liên kết/tái sử dụng Node Logic này */
  sharedLayerNodeIds?: string[]
  /** [Workflow V2] Mã kiểu hành động của Node Hành động */
  actionPreset?: string
  /** [Workflow V2] Nhãn chất liệu vật lý của Node Vật liệu ('jelly_slime' | 'wood_tree' | 'foliage_bush' | 'stone_wall' | 'metal_armor' | 'cloth_rope' | 'flesh_body' | 'ground_terrain') */
  materialTag?:
    | 'jelly_slime'
    | 'wood_tree'
    | 'foliage_bush'
    | 'stone_wall'
    | 'metal_armor'
    | 'cloth_rope'
    | 'flesh_body'
    | 'ground_terrain'
  /** [Workflow V2] Độ cứng đàn hồi của chất liệu (0.2 .. 2.5) */
  materialStiffness?: number
  /** [Workflow V2] Hệ số nảy / biên độ biến dạng chất liệu (0.1 .. 2.5) */
  materialBounciness?: number
  /** [Workflow V2] Hệ số trọng lực rơi của chất liệu (0 .. 1.5) */
  materialGravity?: number
  /** [Workflow V2] Dạng tương tác vật lý của Node Va chạm ('elastic_bounce' | 'heavy_punch' | 'jelly_crush' | 'wall_vault' | 'projectile_stick') */
  collisionMode?:
    | 'elastic_bounce'
    | 'heavy_punch'
    | 'jelly_crush'
    | 'wall_vault'
    | 'projectile_stick'
  /** [Workflow V2] Lực xung va chạm (0.2 .. 2.5) */
  collisionForce?: number
  /** [Workflow V2] Cường độ biến dạng lưới Mesh khi va chạm (0.2 .. 2.5) */
  deformIntensity?: number
  /** [Workflow V2] ID Layer đóng vai trò chủ thể lao vào / gây va chạm (A) */
  strikerLayerId?: string
  /** [Workflow V2] ID Layer đóng vai trò mục tiêu nhận va chạm / biến dạng (B) */
  targetColliderLayerId?: string
  /** [Workflow V2] Chế độ chiếu sáng của Node Ánh sáng */
  lightMode?: 'rim' | 'point' | 'spot' | 'candle' | 'glow' | 'cave_crystal'
  /** [Workflow V2] Mã màu HEX của Node Ánh sáng */
  lightColor?: string
  /** [Workflow V2] Hình dáng vòm cửa hang của Node Hang động */
  caveArchShape?: 'arch' | 'ellipse' | 'circle'
  /** [Workflow V2] Độ tối lòng hang (0..1) của Node Hang động */
  caveDarkness?: number
  /** [Workflow V2] Tỉ lệ thu nhỏ phối cảnh khi đi vào hang (0.15..0.9) */
  caveMinScale?: number
  /** [Workflow V2] Loại hiệu ứng của Node Hiệu ứng */
  fxKind?: 'wind_physics' | 'bloom' | 'blur' | 'chromatic' | 'vignette' | 'particles'
  /** [Workflow V2] Node đã được người dùng kéo đặt tay — giữ nguyên vị trí khi tự xếp lại cây (nút "Sắp xếp" sẽ bỏ ghim) */
  pinned?: boolean
  /** [Workflow V2] Đánh dấu Node con lộ trình quay / cảnh con thuộc Node Camera của một Cảnh */
  isCameraWaypoint?: boolean
  /** [Workflow V2] Chỉ số toàn cục (0-based) của mốc lộ trình quay trên đường đi Camera */
  waypointIndex?: number
  /** [Workflow V2] Chỉ số cục bộ (0-based) của mốc lộ trình quay bên trong Cảnh hiện tại */
  waypointLocalIndex?: number
  /** [Workflow V2] Nhãn hiển thị thứ tự mốc quay (ví dụ: '1', '2', '2.1', '3') */
  waypointLabel?: string
  /** [Workflow V2] True nếu đây là cảnh phụ / mốc nhánh bổ sung (ví dụ: #2.1, #2.2) */
  isSubWaypoint?: boolean
  /** [Workflow V2] True nếu đây là mốc mở đầu của Cảnh */
  isFirstOfShot?: boolean
  /** [Workflow V2] Chế độ động tác quay phim của mốc (ví dụ: 'pan', 'push-in', 'pull-out', 'hold'...) */
  camActionMode?: string
  /** [Workflow V2] Nhãn mô tả động tác quay (ví dụ: 'Mở đầu 100%', 'Đẩy cận 172%') */
  camTagLabel?: string
  /** [Workflow V2] Độ phóng đại khung ngắm tại mốc (%) */
  camZoomPct?: number
  /** [Workflow V2] Tọa độ tâm X trên mặt phẳng Stage 2D */
  camStageX?: number
  /** [Workflow V2] Tọa độ tâm Y trên mặt phẳng Stage 2D */
  camStageY?: number
  /** [Workflow V2] Tỉ lệ khung ngắm Camera (1.0 = 100%, < 1 = đẩy cận, > 1 = kéo rộng) */
  camScale?: number
  /** [Workflow V2] Góc xoay ngang 3D Yaw (độ) */
  camYaw?: number
  /** [Workflow V2] Góc ngẩng/cúi 3D Pitch (độ) */
  camPitch?: number
  /** [Workflow V2] Góc nghiêng máy Roll / Dutch angle (độ) */
  camRoll?: number
  /** [Workflow V2] Đường cong gia tốc nội suy giữa các mốc ('easeInOut' | 'linear' | 'hold'...) */
  camEase?: string
  /** [Workflow V2] Thời lượng riêng của bước quay xuất phát từ mốc này (giây) */
  camStepDuration?: number
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
