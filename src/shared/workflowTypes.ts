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
  | 'time_range'
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
  localTimeRange?: { start: number; end: number }
  timeStart?: number
  /** [Workflow V2] Mốc thời gian kết thúc (giây) của Node trên đường kẻ thời gian */
  timeEnd?: number
  /** [Workflow V2] Phân loại Node Group Layer ('group_3d' | 'group_25d' | 'group_env') */
  groupKind?: 'group_3d' | 'group_25d' | 'group_env'
  /** [Workflow V2] Trạng thái thu gọn nhánh con của Group hoặc Layer */
  collapsedGroup?: boolean
  /** [Workflow V2] Phân loại Node Logic gắn vào Layer ('action' | 'anim_fx' | 'material' | 'collision' | 'light' | 'cave' | 'fx' | 'audio' | 'camera' | 'cluster_lock' | 'part_swap') */
  logicCategory?:
    | 'time'
    | 'action'
    | 'anim_fx'
    | 'material'
    | 'collision'
    | 'light'
    | 'cave'
    | 'fx'
    | 'audio'
    | 'camera'
    | 'cluster_lock'
    | 'part_swap'
    | 'rig_bone'
  /** [Workflow V2] Đánh dấu Node Bộ phận chính (Hub quản lý danh sách các Node con Bộ phận của cụm 2.5D/3D) */
  isPartHub?: boolean
  /** [Workflow V2] Đánh dấu Node con Bộ phận (điều khiển riêng 1 bộ phận: Khuôn mặt, Tay trái, Tay phải, Chân, Thân...) */
  isPartChild?: boolean
  /** [Workflow V2] Biểu tượng đại diện cho Bộ phận con (ví dụ: '😊', '💪', '🦵', '👕', '💇') */
  partIcon?: string
  /** [Workflow V2] Danh sách ID các nhóm bộ phận con đang được ẩn trên sơ đồ của Node Bộ phận chính */
  hiddenPartGroupIds?: string[]
  /** [Workflow V2] Chế độ thao tác trên Node con Bộ phận ('variant' = Biểu cảm/Thay ảnh, 'pose' = Xoay/Dịch chuyển bộ phận theo giây, 'layers' = Ẩn/Hiện mảnh con) */
  partActionMode?: 'variant' | 'pose' | 'layers'
  /** [Workflow V2] Góc xoay cử động của riêng Bộ phận con trong khoảng [timeStart, timeEnd] (-90 .. +90 độ) */
  partRotDeg?: number
  /** [Workflow V2] Độ dịch chuyển ngang X của Bộ phận con trong khoảng [timeStart, timeEnd] (px) */
  partOffsetX?: number
  /** [Workflow V2] Độ dịch chuyển dọc Y của Bộ phận con trong khoảng [timeStart, timeEnd] (px) */
  partOffsetY?: number
  /** [Workflow V2] Tỉ lệ thu phóng của Bộ phận con trong khoảng [timeStart, timeEnd] (%) */
  partScalePct?: number
  /** [Workflow V2] Kiểu nhịp cử động của Bộ phận con ('smooth' = Vào-Giữ-Trả về, 'hold' = Giữ nguyên tư thế, 'oscillate' = Vẫy/Lắc liên tục) */
  partPoseWave?: 'smooth' | 'hold' | 'oscillate'
  /** [Workflow V2] Chế độ chính của Node Animation ('rig_clip' = Hành động Xương Nhân vật, 'keyframe_fx' = Nhịp Biến đổi Keyframe FX) */
  animMode?: 'rig_clip' | 'keyframe_fx'
  /** [Workflow V2] Chế độ chính của Node Motion ('bbox' = Đặt BBox đích #1->#2 thu phóng & chiều sâu, 'path' = Vẽ quỹ đạo di chuyển A->B, 'cycle' = Dao động chu kỳ tại chỗ) */
  motionMode?: 'bbox' | 'path' | 'cycle'
  /** [Workflow V2] Dạng đường đi giữa BBox #1 và BBox #2 ('shortest' = Tự động tìm khoảng cách ngắn nhất, 'custom_curve' = Đặt vị trí đích #2 rồi vẽ đường đi) */
  bboxPathType?: 'shortest' | 'custom_curve'
  /** [Workflow V2] Tọa độ X đích của BBox #2 trong không gian cảnh */
  bboxTargetX?: number
  /** [Workflow V2] Tọa độ Y đích của BBox #2 trong không gian cảnh */
  bboxTargetY?: number
  /** [Workflow V2] Tỉ lệ kích thước % của BBox #2 so với BBox #1 (ví dụ: 160 = to dần lên 160%, 55 = nhỏ dần về 55%) */
  bboxTargetScalePct?: number
  /** [Workflow V2] Chế độ chiều sâu khi di chuyển BBox ('flat_2d' = Không đi theo chiều sâu / giữ nguyên Z, 'depth_z' = Đi theo chiều sâu Z / vượt trước hoặc bị cây che) */
  depthMode?: 'flat_2d' | 'depth_z'
  /** [Workflow V2] Tọa độ chiều sâu Z tại điểm xuất phát BBox #1 */
  bboxStartZ?: number
  /** [Workflow V2] Tọa độ chiều sâu Z tại điểm đích BBox #2 */
  bboxTargetZ?: number
  /** [Workflow V2] ID Layer vật cản tham chiếu chiều sâu (ví dụ: cái cây, tảng đá) để vượt lên trước (z > z_cây) hoặc đi sau bị che (z < z_cây) */
  depthRefLayerId?: string
  /** [Workflow V2] Quan hệ chiều sâu so với Layer vật cản ('in_front' = z lớn hơn xuất hiện qua cây, 'behind' = z nhỏ hơn bị cây che) */
  depthRelation?: 'in_front' | 'behind'
  /** [Workflow V2] Bật kiểm tra & tạo tác động va chạm khi di chuyển tới chạm vào Layer khác trên đường đi */
  collisionOnPathEnabled?: boolean
  /** [Workflow V2] ID Layer mục tiêu bị va chạm khi di chuyển theo BBox #1 -> #2 */
  collisionTargetLayerId?: string
  /** [Workflow V2] Phản ứng va chạm khi di chuyển chạm vào Layer mục tiêu ('bounce' | 'shake' | 'push' | 'stop' | 'jelly') */
  collisionResponse?: 'bounce' | 'shake' | 'push' | 'stop' | 'jelly'
  /** [Workflow V2] ID nhóm bộ phận lấy từ Tab `Bộ phận` trong Xưởng lắp ráp 2.5D (hoặc ID mặt 3D) */
  partGroupId?: string
  /** [Workflow V2] Tên tiêu đề chính xác của Bộ phận đặt trong Tab `Bộ phận` của Xưởng lắp ráp 2.5D */
  partGroupTitle?: string
  targetSlotId?: string
  /** [Workflow V2] Chế độ khung xương của Node Gắn xương ('humanoid_15' | 'chain_3' | 'mixamo_12' | 'custom') */
  rigBonePreset?: 'humanoid_15' | 'chain_3' | 'mixamo_12' | 'custom'
  /** [Workflow V2] Chế độ ràng buộc mềm đàn hồi (Soft Skinning) cho các mảnh gắn xương */
  rigSoftBinding?: boolean
  /** [Workflow V2] Quỹ đạo chuyển động 2D vẽ trực tiếp trong khung chỉnh sửa của Node Motion */
  customMotionPath?: [number, number][]
  /** [Workflow V2] Lặp lại quỹ đạo chuyển động vẽ tay trong khoảng thời gian của Node Motion */
  customMotionLoop?: boolean
  /** [Workflow V2] Chu kỳ thời gian mỗi vòng lặp chuyển động (giây) khi bật customMotionLoop */
  customMotionCycleSec?: number
  /** [Workflow V2] Giữ nguyên biến thể sau khi kết thúc khoảng thời gian đổi bộ phận */
  /** Evaluate timed part edits additively over Motion, without baking competing transform keys. */
  partTimeline?: boolean
  partVisible?: boolean
  partSwapHoldAfterEnd?: boolean
  /** [Workflow V2] ID động tác đặt tên động của Cụm 2.5D đang chọn trên Node Animation */
  customActionId?: string
  /** [Workflow V2] Tên động tác đặt tên động của Cụm 2.5D đang chọn trên Node Animation */
  customActionName?: string
  /** [Workflow V2] Tốc độ nhịp (Hz) của động tác đặt tên động trên Node Animation */
  customActionSpeedHz?: number
  /** [Workflow V2] ID Layer thành viên đang chọn để chỉnh vị trí tương đối trong Node Khoá Cụm 2.5D */
  activeMemberLayerId?: string
  /** [Workflow V2] ID thực thể Cụm 2.5D (composite.instanceId) hoặc Mô hình 3D (model3d.instanceId) */
  instanceId?: string
  /** [Workflow V2] ID mẫu Cụm 2.5D gốc (composite.compositeId) */
  compositeId?: string
  /** [Workflow V2] ID mẫu Mô hình 3D gốc (model3d.modelId) */
  modelId?: string
  /** [Workflow V2] Trạng thái khoá cả cụm 2.5D / 3D (true = khoá đồng bộ cả cụm, false = mở khoá chỉnh lẻ từng layer con) */
  lockedGroup?: boolean
  /** [Workflow V2] ID của Layer đóng vai trò Gốc neo (isRoot) định vị cho cả cụm */
  rootLayerId?: string
  /** [Workflow V2] Thu gọn các layer con phụ của cụm trên sơ đồ (mặc định false = bung đầy đủ các layer con nối vào Node Khoá) */
  collapsedSubLayers?: boolean
  /** [Workflow V2] Khi gắn Node Logic vào 1 layer con của cụm đang khoá: true = chỉ tác động riêng mảnh con đó, false/undefined = tác động cả cụm đang khoá */
  singleSubLayerOnly?: boolean
  /** [Workflow V2] Mã hành động xương (Rig Animation Clip) áp cho Cụm Nhân vật 2.5D ('idle' | 'walk' | 'wave' | 'bow' | 'run' | 'jump' | 'action' | 'sway' | 'fall' | 'land' | 'none') */
  rigActionPreset?: string
  /** [Workflow V2] Bật lệch pha tự nhiên giữa các mảnh bộ phận trong cụm 2.5D khi chạy Motion */
  staggerPhase?: boolean
  /** [Workflow V2] Tỉ lệ phóng đại tổng thể của cả cụm 2.5D hoặc khối 3D (%) */
  clusterScalePct?: number
  /** [Workflow V2] Chế độ của Node Thay Bộ Phận / Layer Cụm ('expression' | 'accessory' | 'part_variant' | 'toggle_part' | 'replace_asset' | 'replace_layer' | 'replace_template' | 'replace_composite') */
  swapMode?: 'expression' | 'accessory' | 'part_variant' | 'toggle_part' | 'replace_asset' | 'replace_layer' | 'replace_template' | 'replace_composite'
  /** [Workflow V2] Khe bộ phận cần thay đổi (ví dụ: 'face', 'glasses', 'hair', 'torso'...) */
  swapSlot?: string
  /** [Workflow V2] Mã biến thể / biểu cảm được chọn (ví dụ: 'face-normal', 'face-happy'...) */
  swapVariant?: string
  /** [Workflow V2] ID của layer bộ phận con mục tiêu được bật/tắt hoặc thay ảnh */
  swapTargetLayerId?: string
  /** [Workflow V2] ID của asset ảnh mới dùng để thay cho layer bộ phận con */
  swapAssetId?: string
  /** [Workflow V2] ID mẫu template 2.5D dùng khi thay nguyên cụm */
  swapTemplateId?: string
  /** [Workflow V2] Danh sách các ID Node Layer đang cùng liên kết/tái sử dụng Node Logic này */
  sharedLayerNodeIds?: string[]
  /** [Workflow V2] Mã kiểu hành động của Node Hành động */
  actionPreset?: string
  /** [Workflow V2] Mã mẫu Hiệu ứng Hoạt ảnh ('popIn' | 'shake' | 'pulse' | 'fadeIn' | 'fadeOut' | 'blink' | 'breathe' | 'neonBreathe' | 'neonBlink' | 'neonFlicker' | 'neonSolid') */
  animFxPreset?: string
  /** [Workflow V2] Số nhịp / số lần lặp của Hiệu ứng Hoạt ảnh (ví dụ: 5 lần rung, 2 lần nảy, 4 lần chớp) */
  animFxCount?: number
  /** [Workflow V2] Màu sắc của Hiệu ứng Hoạt ảnh (ví dụ: màu viền Neon) */
  animFxColor?: string
  /** [Workflow V2] Vị trí viền của Hiệu ứng Hoạt ảnh Neon ('outer' | 'inner' | 'both') */
  animFxSide?: 'outer' | 'inner' | 'both'
  /** [Workflow V2] Độ dày viền Neon (px) */
  animFxThickness?: number
  /** [Workflow V2] Tốc độ chu kỳ (Hz) của Hiệu ứng Hoạt ảnh */
  animFxSpeed?: number
  /** [Workflow V2] Độ sáng tối thiểu ở đáy chu kỳ (0..0.8) */
  animFxMinIntensity?: number
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
  /** [Workflow V2] Khi true, đường dây này đang bị vô hiệu hoá tạm thời (disabled) — không truyền luồng xử lý tới Node đích */
  disabled?: boolean
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
