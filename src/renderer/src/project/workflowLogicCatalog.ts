import type {
  WorkflowCustomActionRule,
  WorkflowNodeType
} from '@shared/types'

export type WorkflowLogicNodeCategory =
  | 'scene'
  | 'assembly'
  | 'camera'
  | 'audio'
  | 'physics'
  | 'light_fx'
  | 'motion'
  | 'look'

export interface WorkflowLogicNodeCatalogItem {
  id: string
  category: WorkflowLogicNodeCategory
  categoryLabel: string
  nodeType: WorkflowNodeType
  icon: string
  title: string
  shortLabel: string
  preset: string
  targetParts: string[]
  description: string
  enableDof?: boolean
  ensureGround?: boolean
  spawnParticles?: boolean
  buildRules?: () => WorkflowCustomActionRule[]
}

export const WORKFLOW_LOGIC_NODE_CATEGORIES: {
  id: WorkflowLogicNodeCategory
  label: string
  icon: string
}[] = [
  { id: 'camera', label: '🛣️ Lộ trình Camera', icon: '🛣️' },
  { id: 'audio', label: '🎙️ Âm thanh & Thoại', icon: '🎙️' },
  { id: 'physics', label: '🪂 Vật lý 2.5D', icon: '🪂' },
  { id: 'light_fx', label: '💡 Ánh sáng & Hào quang', icon: '💡' },
  { id: 'motion', label: '🍃 Chuyển động 2.5D', icon: '🍃' },
  { id: 'scene', label: '🎬 Cảnh & Không gian Z', icon: '🎬' },
  { id: 'assembly', label: '🧩 Layer & Thực thể', icon: '🧩' },
  { id: 'look', label: '🌅 Màu sắc & Xuất', icon: '🌅' }
]

/**
 * Thư viện Node Logic chuyên biệt phân loại theo đúng nghiệp vụ 2.5D.
 * Mỗi Node đại diện cho một chức năng xử lý độc lập có thể nối dây vào Cảnh hoặc Layer.
 */
export const WORKFLOW_LOGIC_NODE_CATALOG: WorkflowLogicNodeCatalogItem[] = [
  // ------------------------------------------------------------------ 1. LỘ TRÌNH CAMERA
  {
    id: 'logic-cam-fly',
    category: 'camera',
    categoryLabel: 'Lộ trình Camera',
    nodeType: 'camera_director',
    icon: '🛣️',
    title: 'Lộ trình Bay Lướt Xuyên Cảnh',
    shortLabel: 'Lộ trình Bay',
    preset: 'cinematic_fly_push',
    targetParts: ['spline_eye_path', 'lookat_target', 'fov_dolly_zoom'],
    enableDof: false,
    description: 'Tạo lộ trình camera bay lướt mượt mà qua các góc nhìn, giữ ảnh sắc nét 100% không mờ DOF.'
  },
  {
    id: 'logic-cam-dolly',
    category: 'camera',
    categoryLabel: 'Lộ trình Camera',
    nodeType: 'camera_director',
    icon: '🔍',
    title: 'Lộ trình Đẩy Cận Chủ Thể',
    shortLabel: 'Đẩy Cận Dolly',
    preset: 'dolly_push_focus',
    targetParts: ['fov_dolly_zoom', 'lookat_target'],
    enableDof: false,
    description: 'Lộ trình đẩy máy từ toàn cảnh tiến dần vào cận cảnh layer chủ thể để lộ rõ thị sai 2.5D.'
  },
  {
    id: 'logic-cam-orbit',
    category: 'camera',
    categoryLabel: 'Lộ trình Camera',
    nodeType: 'camera_director',
    icon: '🔄',
    title: 'Lộ trình Xoay Vòng Cung 3D',
    shortLabel: 'Xoay Vòng Cung',
    preset: 'orbit_showcase_3d',
    targetParts: ['spline_eye_path', 'lookat_target'],
    enableDof: false,
    description: 'Lộ trình camera xoay vòng cung 3D quanh tâm cảnh hoặc layer để phô diễn các tầng chiều sâu.'
  },
  {
    id: 'logic-cam-pan',
    category: 'camera',
    categoryLabel: 'Lộ trình Camera',
    nodeType: 'camera_director',
    icon: '🎯',
    title: 'Lộ trình Lia Máy & Bám Layer',
    shortLabel: 'Lia Máy Pan',
    preset: 'cinematic_fly_push',
    targetParts: ['spline_eye_path', 'lookat_target'],
    enableDof: false,
    description: 'Lộ trình lia máy ngang/dọc theo dõi vị trí layer nhân vật hoặc chuyển động trong cảnh.'
  },
  {
    id: 'logic-cam-shake',
    category: 'camera',
    categoryLabel: 'Lộ trình Camera',
    nodeType: 'camera_director',
    icon: '⚡',
    title: 'Lộ trình Rung Handheld Kịch Tính',
    shortLabel: 'Rung Handheld',
    preset: 'dramatic_handheld_action',
    targetParts: ['fov_dolly_zoom', 'handheld_rig'],
    enableDof: false,
    description: 'Thêm rung lắc máy quay cầm tay và phối cảnh Dolly Zoom kịch tính cho các pha hành động.'
  },
  {
    id: 'logic-cam-dof',
    category: 'camera',
    categoryLabel: 'Lộ trình Camera',
    nodeType: 'camera_director',
    icon: '🎯',
    title: 'Lộ trình Xóa Phông Tiêu Cự DOF',
    shortLabel: 'Xóa Phông DOF',
    preset: 'dolly_push_focus',
    targetParts: ['fov_dolly_zoom', 'lookat_target', 'dof_aperture'],
    enableDof: true,
    description: 'Bật làm mờ hậu cảnh theo khẩu độ tiêu cự (tắt node này để nét căng như Cam 2D).'
  },

  // ------------------------------------------------------------------ 2. ÂM THANH & THOẠI
  {
    id: 'logic-audio-bgm',
    category: 'audio',
    categoryLabel: 'Âm thanh & Thoại',
    nodeType: 'audio_lipsync',
    icon: '🎵',
    title: 'Nhạc Nền BGM Điện Ảnh',
    shortLabel: 'Nhạc Nền BGM',
    preset: 'cinematic_bgm_ambience',
    targetParts: ['vocal_eq_chain', 'bgm_envelope'],
    description: 'Cân bằng dải âm ấm Warm EQ và tự động Fade-in đầu cảnh, Fade-out cuối cảnh.'
  },
  {
    id: 'logic-audio-lipsync',
    category: 'audio',
    categoryLabel: 'Âm thanh & Thoại',
    nodeType: 'audio_lipsync',
    icon: '🗣️',
    title: 'Nhép Môi Nhân Vật 2.5D',
    shortLabel: 'Nhép Môi Thoại',
    preset: 'voice_lipsync_bgm',
    targetParts: ['mouth_viseme_25d', 'vocal_eq_chain'],
    description: 'Tự động mở/đóng layer Miệng nhân vật 2.5D ăn khớp với biên độ sóng âm giọng thoại.'
  },
  {
    id: 'logic-audio-sfx',
    category: 'audio',
    categoryLabel: 'Âm thanh & Thoại',
    nodeType: 'audio_lipsync',
    icon: '🔊',
    title: 'Hiệu Ứng Tiếng Động SFX',
    shortLabel: 'Tiếng Động SFX',
    preset: 'cinematic_bgm_ambience',
    targetParts: ['vocal_eq_chain'],
    description: 'Cân chỉnh EQ cho các track SFX, bước chân và foley đã có trong dự án theo layer; không sinh tệp âm thanh mới.'
  },

  // ------------------------------------------------------------------ 3. VẬT LÝ 2.5D
  {
    id: 'logic-physics-wind',
    category: 'physics',
    categoryLabel: 'Vật lý 2.5D',
    nodeType: 'physics_fx',
    icon: '🍃',
    title: 'Vật lý Gió Lay Tán Lá & Cây',
    shortLabel: 'Gió Lay Cây',
    preset: 'candle_wind_particles',
    targetParts: ['canopy_wind'],
    description: 'Mô phỏng lực gió tự nhiên thổi lay cành lá, bụi hoa và cây cối theo thời gian thực.',
    buildRules: () => [
      {
        id: `rule-wind-${Date.now().toString(36)}`,
        label: 'Gió thổi tán lá (Wind 2.5D)',
        targetId: 'all',
        targetName: 'Cây cối & Tán lá trong cảnh',
        actionKind: 'wind',
        speed: 0.9,
        amount: 1.0,
        enabled: true
      }
    ]
  },
  {
    id: 'logic-physics-elastic',
    category: 'physics',
    categoryLabel: 'Vật lý 2.5D',
    nodeType: 'physics_fx',
    icon: '🧬',
    title: 'Lưới 2.5D Đàn Hồi Va Chạm',
    shortLabel: 'Lưới Đàn Hồi',
    preset: 'combat_elastic_glow',
    targetParts: ['soft_mesh_jiggle'],
    spawnParticles: false,
    description: 'Bật biến dạng lò xo đàn hồi jiggle trên lưới ảnh 2.5D khi di chuyển hoặc va chạm.',
    buildRules: () => [
      {
        id: `rule-elastic-${Date.now().toString(36)}`,
        label: 'Lưới 2.5D đàn hồi (Elastic)',
        targetId: 'all',
        targetName: 'Layer được chọn',
        actionKind: 'mesh_elastic',
        speed: 1.2,
        amount: 1.15,
        enabled: true
      }
    ]
  },
  {
    id: 'logic-physics-sway',
    category: 'physics',
    categoryLabel: 'Vật lý 2.5D',
    nodeType: 'physics_fx',
    icon: '🌬️',
    title: 'Đung Đưa Con Lắc Tóc & Vạt Áo',
    shortLabel: 'Đung Đưa Sway',
    preset: 'candle_wind_particles',
    targetParts: ['hair_cloth_sway'],
    description: 'Dao động con lắc mềm mại quanh điểm neo cho tóc nhân vật, tà áo hoặc đèn lồng treo.',
    buildRules: () => [
      {
        id: `rule-sway-${Date.now().toString(36)}`,
        label: 'Đung đưa con lắc (Sway)',
        targetId: 'all',
        targetName: 'Tóc, Tà áo & Dây leo',
        actionKind: 'sway',
        speed: 0.8,
        amount: 0.9,
        enabled: true
      }
    ]
  },
  {
    id: 'logic-physics-bounce',
    category: 'physics',
    categoryLabel: 'Vật lý 2.5D',
    nodeType: 'physics_fx',
    icon: '⚡',
    title: 'Trọng Lực & Rơi Nảy 2.5D',
    shortLabel: 'Trọng Lực Nảy',
    preset: 'combat_elastic_glow',
    targetParts: ['soft_mesh_jiggle'],
    description: 'Giả lập trọng lực rơi tự do và độ nảy lò xo khi tiếp đất cho đối tượng trong cảnh.',
    buildRules: () => [
      {
        id: `rule-bounce-${Date.now().toString(36)}`,
        label: 'Trọng lực & Nảy (Bounce)',
        targetId: 'all',
        targetName: 'Đối tượng trong cảnh',
        actionKind: 'mesh_elastic',
        speed: 1.4,
        amount: 1.2,
        enabled: true
      }
    ]
  },

  // ------------------------------------------------------------------ 4. ÁNH SÁNG & HÀO QUANG
  {
    id: 'logic-fx-candle',
    category: 'light_fx',
    categoryLabel: 'Ánh sáng & Hào quang',
    nodeType: 'physics_fx',
    icon: '🕯️',
    title: 'Đèn Nến / Đom Đóm Ấm 2.5D',
    shortLabel: 'Ánh Nến Ấm',
    preset: 'candle_wind_particles',
    targetParts: ['virtual_light_core'],
    spawnParticles: false,
    description: 'Gắn nguồn sáng ấm 2.5D tỏa tròn lung linh theo gió chiếu sáng chủ thể và layer xung quanh.',
    buildRules: () => [
      {
        id: `rule-candle-${Date.now().toString(36)}`,
        label: 'Đèn nến / Đom đóm ấm (Virtual Candle)',
        targetId: 'all',
        targetName: 'Chủ thể trung tâm trong cảnh',
        actionKind: 'virtual_light_candle',
        speed: 1.4,
        amount: 1.25,
        enabled: true
      }
    ]
  },
  {
    id: 'logic-fx-flashlight',
    category: 'light_fx',
    categoryLabel: 'Ánh sáng & Hào quang',
    nodeType: 'physics_fx',
    icon: '🔦',
    title: 'Đèn Pin Chiếu Tia Nón',
    shortLabel: 'Đèn Pin Tia',
    preset: 'cave_portal_flashlight',
    targetParts: ['virtual_light_core'],
    spawnParticles: false,
    description: 'Chiếu chùm tia sáng hình nón định hướng làm nổi bật các góc tối và chiều sâu.',
    buildRules: () => [
      {
        id: `rule-flashlight-${Date.now().toString(36)}`,
        label: 'Chùm đèn pin (Flashlight)',
        targetId: 'all',
        targetName: 'Chủ thể trung tâm trong cảnh',
        actionKind: 'virtual_light_flashlight',
        speed: 0.6,
        amount: 1.35,
        enabled: true
      }
    ]
  },
  {
    id: 'logic-fx-rimglow',
    category: 'light_fx',
    categoryLabel: 'Ánh sáng & Hào quang',
    nodeType: 'physics_fx',
    icon: '✨',
    title: 'Phát Sáng Viền Alpha Rim Glow',
    shortLabel: 'Viền Neon Glow',
    preset: 'combat_elastic_glow',
    targetParts: ['rim_glow_silhouette'],
    spawnParticles: false,
    description: 'Tạo viền sáng neon ôm sát đường bao Alpha của chủ thể chính trong cảnh.',
    buildRules: () => [
      {
        id: `rule-rimglow-${Date.now().toString(36)}`,
        label: 'Viền sáng Alpha Glow',
        targetId: 'all',
        targetName: 'Chủ thể trong cảnh',
        actionKind: 'rim_glow',
        speed: 1.6,
        amount: 1.3,
        enabled: true
      }
    ]
  },
  {
    id: 'logic-fx-particles',
    category: 'light_fx',
    categoryLabel: 'Ánh sáng & Hào quang',
    nodeType: 'physics_fx',
    icon: '🪄',
    title: 'Lớp Hạt Đom Đóm Bay 3D',
    shortLabel: 'Hạt Đom Đóm',
    preset: 'candle_wind_particles',
    targetParts: ['firefly_particles'],
    spawnParticles: true,
    description: 'Sinh lớp hạt đom đóm & bụi sáng lơ lửng trong không gian 3D của phân cảnh.'
  },

  // ------------------------------------------------------------------ 5. CHUYỂN ĐỘNG 2.5D
  {
    id: 'logic-motion-walk-z',
    category: 'motion',
    categoryLabel: 'Chuyển động 2.5D',
    nodeType: 'motion_choreography',
    icon: '🚶',
    title: 'Bước Đi Chiều Sâu Z',
    shortLabel: 'Bước Đi Z',
    preset: 'character_walk_depth',
    targetParts: ['legs_stride', 'torso_breathe'],
    description: 'Diễn hoạt bước đi tiến sâu vào không gian 2.5D cho nhân vật hoặc sinh vật.',
    buildRules: () => [
      {
        id: `rule-walk-${Date.now().toString(36)}`,
        label: 'Bước đi tiến vào chiều sâu Z',
        targetId: 'all',
        targetName: 'Nhân vật chính trong cảnh',
        actionKind: 'walk_into_depth',
        speed: 1.0,
        amount: 1.0,
        enabled: true
      }
    ]
  },
  {
    id: 'logic-motion-jump',
    category: 'motion',
    categoryLabel: 'Chuyển động 2.5D',
    nodeType: 'motion_choreography',
    icon: '⚡',
    title: 'Bật Nhảy Quỹ Đạo Parabol',
    shortLabel: 'Nhảy Parabol',
    preset: 'dynamic_action_arc',
    targetParts: ['legs_stride', 'arms_gesture'],
    description: 'Tạo quỹ đạo bật nhảy Parabol kịch tính cho nhân vật trong cảnh.',
    buildRules: () => [
      {
        id: `rule-jump-${Date.now().toString(36)}`,
        label: 'Bật nhảy quỹ đạo Parabol',
        targetId: 'all',
        targetName: 'Nhân vật chính trong cảnh',
        actionKind: 'jump_arc',
        speed: 1.15,
        amount: 1.05,
        enabled: true
      }
    ]
  },
  {
    id: 'logic-motion-drift',
    category: 'motion',
    categoryLabel: 'Chuyển động 2.5D',
    nodeType: 'motion_choreography',
    icon: '☁️',
    title: 'Mây & Sương Trôi Ngang Drift',
    shortLabel: 'Mây Trôi Drift',
    preset: 'organic_wind_breathe',
    targetParts: ['sky_cloud_drift'],
    description: 'Di chuyển trôi ngang liên tục cho bầu trời, mây và lớp sương mù xa cảnh.',
    buildRules: () => [
      {
        id: `rule-drift-${Date.now().toString(36)}`,
        label: 'Trôi ngang bầu trời & mây (Drift)',
        targetId: 'all',
        targetName: 'Bầu trời & Mây trong cảnh',
        actionKind: 'drift',
        speed: 18,
        amount: 0.85,
        enabled: true
      }
    ]
  },
  {
    id: 'logic-motion-breathe',
    category: 'motion',
    categoryLabel: 'Chuyển động 2.5D',
    nodeType: 'motion_choreography',
    icon: '🫁',
    title: 'Nhịp Thở & Lơ Lửng Float',
    shortLabel: 'Nhịp Thở 2.5D',
    preset: 'organic_wind_breathe',
    targetParts: ['torso_breathe'],
    description: 'Chuyển động phập phồng nhịp thở hoặc lơ lửng cho nhân vật, đảo đá bay và chủ thể.',
    buildRules: () => [
      {
        id: `rule-float-${Date.now().toString(36)}`,
        label: 'Nhịp thở lơ lửng (Float)',
        targetId: 'all',
        targetName: 'Chủ thể & Đảo bay trong cảnh',
        actionKind: 'float',
        speed: 0.75,
        amount: 0.85,
        enabled: true
      }
    ]
  },

  // ------------------------------------------------------------------ 6. CẢNH & KHÔNG GIAN Z
  {
    id: 'logic-scene-spawn-layers',
    category: 'scene',
    categoryLabel: 'Cảnh & Không gian Z',
    nodeType: 'scene_shot',
    icon: '🎬',
    title: 'Bung Cảnh & Toàn Bộ Layer Con',
    shortLabel: 'Bung Cảnh & Layer',
    preset: 'deep_parallax_stage',
    targetParts: ['sky_horizon', 'mid_scenery', 'focal_plane', 'fg_frame'],
    description: 'Tạo Node Cảnh trung tâm và tự động bung các Node Layer con nối dây sẵn sàng.'
  },
  {
    id: 'logic-scene-parallax',
    category: 'scene',
    categoryLabel: 'Cảnh & Không gian Z',
    nodeType: 'scene_shot',
    icon: '📐',
    title: 'Tách Tầng Chiều Sâu Z Chuẩn',
    shortLabel: 'Tách Tầng Z',
    preset: 'deep_parallax_stage',
    targetParts: ['sky_horizon', 'mid_scenery', 'focal_plane', 'fg_frame'],
    ensureGround: false,
    description: 'Tự động giãn khoảng cách Z (3200 → -120) cho các lớp của phân cảnh đang chọn.'
  },
  {
    id: 'logic-scene-ground3d',
    category: 'scene',
    categoryLabel: 'Cảnh & Không gian Z',
    nodeType: 'scene_shot',
    icon: '⛰️',
    title: 'Sàn Mặt Đất 3D Phối Cảnh',
    shortLabel: 'Mặt Đất 3D',
    preset: 'grounded_3d_stage',
    targetParts: ['sky_horizon', 'mid_scenery', 'focal_plane', 'ground_plane'],
    ensureGround: true,
    description: 'Thêm mặt phẳng sàn 3D nằm ngang đỡ dưới chân nhân vật & đạo cụ.'
  },
  {
    id: 'logic-scene-portrait',
    category: 'scene',
    categoryLabel: 'Cảnh & Không gian Z',
    nodeType: 'scene_shot',
    icon: '👤',
    title: 'Tiêu Cự Cận Chân Dung',
    shortLabel: 'Cận Chân Dung',
    preset: 'intimate_portrait_stage',
    targetParts: ['sky_horizon', 'focal_plane', 'fg_frame'],
    ensureGround: false,
    description: 'Thu hẹp khoảng cách Z (1400 → -60) để tập trung ánh mắt vào nhân vật chính.'
  },

  // ------------------------------------------------------------------ 7. LAYER & THỰC THỂ 2.5D
  {
    id: 'logic-assembly-child',
    category: 'assembly',
    categoryLabel: 'Layer & Thực thể',
    nodeType: 'layer_assembly',
    icon: '🧩',
    title: 'Node Layer Con 2.5D',
    shortLabel: 'Node Layer Con',
    preset: 'character_and_foliage_rig',
    targetParts: ['root_anchor', 'limb_joint_fk'],
    description: 'Khối đại diện cho 1 layer cụ thể trong cảnh, dùng để cấu hình logic riêng cho layer đó.'
  },
  {
    id: 'logic-assembly-billboard',
    category: 'assembly',
    categoryLabel: 'Layer & Thực thể',
    nodeType: 'layer_assembly',
    icon: '🧍',
    title: 'Neo Chân & Billboard Y',
    shortLabel: 'Neo Chân & Y',
    preset: 'character_and_foliage_rig',
    targetParts: ['root_anchor', 'limb_joint_fk'],
    description: 'Đặt điểm neo ở chân [0, -0.5, 0], tự hướng thẳng đứng theo Camera khi xoay góc nhìn.'
  },
  {
    id: 'logic-assembly-parts',
    category: 'assembly',
    categoryLabel: 'Layer & Thực thể',
    nodeType: 'layer_assembly',
    icon: '🎭',
    title: 'Biến Thể Biểu Cảm & Parts',
    shortLabel: 'Biến Thể Bộ Phận',
    preset: 'expr_variant_actors',
    targetParts: ['root_anchor', 'limb_joint_fk'],
    description: 'Quản lý nhóm bộ phận (đầu, thân, tay, chân) và khe biến thể biểu cảm khuôn mặt.'
  },
  {
    id: 'logic-assembly-arch3d',
    category: 'assembly',
    categoryLabel: 'Layer & Thực thể',
    nodeType: 'layer_assembly',
    icon: '🏛️',
    title: 'Kiến Trúc 3D & Đạo Cụ',
    shortLabel: 'Kiến Trúc 3D',
    preset: 'arch3d_and_props',
    targetParts: ['root_anchor'],
    description: 'Bảo toàn hình học không gian 3 chiều và khóa cụm Composite cho mô hình kiến trúc.'
  },

  // ------------------------------------------------------------------ 8. MÀU SẮC & XUẤT
  {
    id: 'logic-look-sharp',
    category: 'look',
    categoryLabel: 'Màu sắc & Xuất',
    nodeType: 'look_output',
    icon: '💎',
    title: 'Ảnh Trong Trẻo Sắc Nét',
    shortLabel: 'Ảnh Nét Căng',
    preset: 'vibrant_anime_clean',
    targetParts: ['color_grade_lut', 'mp4_master_out'],
    description: 'Giữ ảnh hiển thị sắc nét, trong trẻo đồng nhất 100% giữa Camera và Cam 2D.'
  },
  {
    id: 'logic-look-warm',
    category: 'look',
    categoryLabel: 'Màu sắc & Xuất',
    nodeType: 'look_output',
    icon: '🌅',
    title: 'Màu Điện Ảnh Hoàng Hôn',
    shortLabel: 'Màu Hoàng Hôn',
    preset: 'cinematic_atmospheric_fog',
    targetParts: ['color_grade_lut', 'lens_vignette_grain', 'mp4_master_out'],
    description: 'Cân chỉnh tông màu ấm điện ảnh và bo viền nhẹ Vignette.'
  },
  {
    id: 'logic-look-fog',
    category: 'look',
    categoryLabel: 'Màu sắc & Xuất',
    nodeType: 'look_output',
    icon: '🌙',
    title: 'Sương Mù Chiều Sâu Z',
    shortLabel: 'Sương Mù 3D',
    preset: 'mystic_night_glow',
    targetParts: ['z_depth_fog', 'color_grade_lut', 'mp4_master_out'],
    description: 'Phủ lớp sương mù chiều sâu Z cho các lớp núi và bầu trời ở xa.'
  }
]
