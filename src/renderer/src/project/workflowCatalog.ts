import type {
  WorkflowAgentRole,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams,
  WorkflowNodeType,
  WorkflowPortKind
} from '@shared/types'

export interface WorkflowPortSpec {
  id: WorkflowPortKind
  label: string
  shortLabel: string
  color: string
  description: string
}

export interface WorkflowNodePresetSpec {
  id: string
  label: string
  summary: string
  defaultDirective: string
  defaultParams: WorkflowNodeParams
  recommendedMcpTools: string[]
  mcpHint: Record<string, unknown>
}

export interface WorkflowNodeTypeSpec {
  type: WorkflowNodeType
  stepOrder: number
  title: string
  shortTitle: string
  aiAgentRole: WorkflowAgentRole
  color: string
  description: string
  inputs: WorkflowPortKind[]
  outputs: WorkflowPortKind[]
  presets: WorkflowNodePresetSpec[]
}

export interface WorkflowTemplateSpec {
  id: string
  name: string
  badge: string
  category: string
  description: string
  buildGraph: () => WorkflowGraph
}

export const WORKFLOW_PORT_SPECS: Record<WorkflowPortKind, WorkflowPortSpec> = {
  scene_ctx: {
    id: 'scene_ctx',
    label: 'Ngữ cảnh Phân cảnh (Scene & Z-Depth)',
    shortLabel: 'Cảnh 3D',
    color: '#38bdf8',
    description: 'Truyền thông tin phân cảnh, kích thước khung hình và các tầng độ sâu Z sang các khâu tiếp theo.'
  },
  actors_rig: {
    id: 'actors_rig',
    label: 'Thực thể & Khung xương (Actors & Rig)',
    shortLabel: 'Thực thể',
    color: '#a855f7',
    description: 'Truyền danh sách nhân vật 2.5D, đạo cụ composite và mô hình 3D sang khâu chuyển động và âm thanh.'
  },
  motion_stream: {
    id: 'motion_stream',
    label: 'Luồng Chuyển động (Motion Stream)',
    shortLabel: 'Chuyển động',
    color: '#f59e0b',
    description: 'Truyền quỹ đạo di chuyển, động tác xương và gió tự nhiên sang khâu Vật lý/FX và Camera.'
  },
  vfx_stage: {
    id: 'vfx_stage',
    label: 'Vật lý & Ánh sáng FX (Physics & Light)',
    shortLabel: 'Vật lý/FX',
    color: '#ec4899',
    description: 'Truyền hiệu ứng vật lý đàn hồi, ánh sáng ảo theo gió và hạt môi trường tới khâu hoàn thiện.'
  },
  camera_cut: {
    id: 'camera_cut',
    label: 'Đường bay Camera 3D (Camera Trajectory)',
    shortLabel: 'Camera 3D',
    color: '#22c55e',
    description: 'Truyền lộ trình bay camera, góc nhìn FOV và hiệu ứng xóa phông DOF tới khâu xuất bản.'
  },
  audio_mix: {
    id: 'audio_mix',
    label: 'Bản phối Âm thanh & Lip-Sync (Audio Mix)',
    shortLabel: 'Âm thanh',
    color: '#06b6d4',
    description: 'Truyền nhạc nền, hiệu ứng âm thanh và đồng bộ khẩu hình miệng tới khâu xuất bản.'
  }
}

export const WORKFLOW_NODE_SPECS: Record<WorkflowNodeType, WorkflowNodeTypeSpec> = {
  scene_shot: {
    type: 'scene_shot',
    stepOrder: 1,
    title: '1. Phân cảnh & Độ sâu',
    shortTitle: 'Phân cảnh',
    aiAgentRole: 'SceneLayoutAgent',
    color: '#38bdf8',
    description: 'Thiết lập bố cục Shot, giãn tầng chiều sâu Z (bầu trời, núi, trung cảnh, tiền cảnh) và mặt đất 3D.',
    inputs: [],
    outputs: ['scene_ctx'],
    presets: [
      {
        id: 'deep_parallax_stage',
        label: 'Chiều sâu Parallax Điện ảnh (Z 3200 → -120)',
        summary: 'Trải rộng 5 tầng độ sâu Z chuẩn AE · Tạo hiệu ứng thị sai rõ nét',
        defaultDirective: 'Bố trí các layer theo tầng độ sâu Z rõ rệt: bầu trời (3200), xa cảnh (1800), trung cảnh (600), tiêu điểm (0) và tiền cảnh (-120).',
        defaultParams: { intensity: 1.2, autoArrangeZ: true, ensureGround: false, duration: 10 },
        recommendedMcpTools: ['get_project_info', 'add_shot', 'add_image_layer', 'update_layer'],
        mcpHint: { z_tiers: [3200, 1800, 800, 260, 0, -120], auto_scale: true }
      },
      {
        id: 'grounded_3d_stage',
        label: 'Sân khấu Mặt đất 3D & Nội thất',
        summary: 'Tự tạo sàn 3D phối cảnh · Khóa chân đạo cụ & nhân vật trên mặt đất',
        defaultDirective: 'Đảm bảo mỗi phân cảnh có mặt đất 3D (orientation ground) và sắp xếp các lớp đứng vững trên mặt phẳng sàn.',
        defaultParams: { intensity: 1.0, autoArrangeZ: true, ensureGround: true, duration: 10 },
        recommendedMcpTools: ['add_shot', 'add_ground_layer', 'add_image_layer', 'update_layer'],
        mcpHint: { ensure_ground_layer: true, ground_rotation: [-90, 0, 0] }
      },
      {
        id: 'intimate_portrait_stage',
        label: 'Cận cảnh Nhân vật & Tiêu cự Hẹp',
        summary: 'Thu hẹp khoảng cách Z (1400 → -60) · Tập trung vào chủ thể trung tâm',
        defaultDirective: 'Giữ khoảng cách chiều sâu Z vừa phải để làm nổi bật biểu cảm và cử chỉ của nhân vật chính ở Z = 0.',
        defaultParams: { intensity: 0.75, autoArrangeZ: true, ensureGround: false, duration: 8 },
        recommendedMcpTools: ['add_shot', 'update_layer'],
        mcpHint: { z_tiers: [1400, 750, 320, 0, -60], focus_plane_z: 0 }
      }
    ]
  },

  layer_assembly: {
    type: 'layer_assembly',
    stepOrder: 2,
    title: '2. Lắp ráp 2.5D & 3D',
    shortTitle: 'Lắp ráp',
    aiAgentRole: 'AssemblyRigAgent',
    color: '#a855f7',
    description: 'Quản lý cụm nhân vật 2.5D, cây cối đa lớp, mô hình 3D kiến trúc và neo gốc xoay (Anchor/Billboard).',
    inputs: ['scene_ctx'],
    outputs: ['actors_rig'],
    presets: [
      {
        id: 'character_and_foliage_rig',
        label: 'Nhân vật 2.5D + Cây cối Đa lớp',
        summary: 'Gắn neo đáy [0, -0.5] · Tự hướng thẳng đứng theo Camera (Billboard Y)',
        defaultDirective: 'Chuẩn hóa các cụm composite nhân vật và cây cối: đặt điểm neo ở chân [0, -0.5, 0], bật autoOrient camera-y để luôn đứng thẳng khi camera xoay.',
        defaultParams: { intensity: 1.0 },
        recommendedMcpTools: ['list_layer_composites', 'insert_layer_composite', 'open_layer_assembly', 'layer_assembly_rig'],
        mcpHint: { anchor: [0, -0.5, 0], auto_orient: 'camera-y', locked_group: true }
      },
      {
        id: 'arch3d_and_props',
        label: 'Mô hình Kiến trúc 3D & Đạo cụ',
        summary: 'Đồng bộ khối nhà 3D · Giữ nguyên hình học không gian 3 chiều',
        defaultDirective: 'Sử dụng mô hình từ Xưởng 3D (nhà cửa, căn phòng, đạo cụ) kết hợp các lớp trang trí 2.5D xung quanh.',
        defaultParams: { intensity: 1.0 },
        recommendedMcpTools: ['list_models3d', 'insert_assembly_model', 'apply_assembly_template'],
        mcpHint: { preserve_3d_orientation: true, locked_group: true }
      },
      {
        id: 'expr_variant_actors',
        label: 'Nhân vật Đa Biến thể (Đổi biểu cảm/Bộ phận)',
        summary: 'Kích hoạt nhóm bộ phận (Parts) & biến thể khuôn mặt/tay chân',
        defaultDirective: 'Tổ chức nhân vật theo nhóm bộ phận (đầu, thân, tay, chân) và khe biến thể biểu cảm để sẵn sàng diễn hoạt.',
        defaultParams: { intensity: 1.0 },
        recommendedMcpTools: ['layer_assembly_parts', 'insert_layer_composite', 'update_layer'],
        mcpHint: { enable_part_variants: true, anchor: [0, -0.5, 0] }
      }
    ]
  },

  motion_choreography: {
    type: 'motion_choreography',
    stepOrder: 3,
    title: '3. Chuyển động & Hoạt họa',
    shortTitle: 'Chuyển động',
    aiAgentRole: 'MotionChoreographyAgent',
    color: '#f59e0b',
    description: 'Điều phối động tác nhân vật, xương Mixamo/IK, gió thổi cây cối (Wind/Sway) và mây trôi (Drift).',
    inputs: ['actors_rig'],
    outputs: ['motion_stream'],
    presets: [
      {
        id: 'organic_wind_breathe',
        label: 'Gió Rừng Tự Nhiên + Nhịp Thở Sống Động',
        summary: 'Mây trôi Drift · Cây đung đưa Wind · Nhân vật phập phồng Float/Pulse',
        defaultDirective: 'Áp dụng chuyển động gió tự nhiên (wind/sway) cho cây cỏ, trôi ngang (drift) cho mây/sương, và nhịp thở nhẹ (float/pulse) cho nhân vật.',
        defaultParams: { intensity: 1.0, duration: 10 },
        recommendedMcpTools: ['set_layer_motion', 'apply_motion_preset', 'layer_assembly_plant_spine'],
        mcpHint: { sky_motion: 'drift', foliage_motion: 'wind', character_motion: 'float' }
      },
      {
        id: 'character_walk_depth',
        label: 'Di chuyển Chiều sâu & Chuỗi Động tác',
        summary: 'Nhân vật bước đi trong không gian 2.5D · Phối hợp động tác tay chân',
        defaultDirective: 'Tạo chuỗi chuyển động không gian (walk_into_depth hoặc cross_screen) cho nhân vật chính kết hợp nhịp bước tự nhiên.',
        defaultParams: { intensity: 1.15, duration: 6 },
        recommendedMcpTools: ['apply_motion_preset', 'choreograph_motion_sequence', 'layer_assembly_motion_sketch'],
        mcpHint: { motion_preset: 'walk_into_depth', wind_background: true }
      },
      {
        id: 'dynamic_action_arc',
        label: 'Hành động Kịch tính & Bật nhảy Parabol',
        summary: 'Quỹ đạo nhảy/lao tới tốc độ cao · Tóc/Áo choàng bay trễ nhịp',
        defaultDirective: 'Áp dụng quỹ đạo hành động (jump_arc / emerge_from_depth) cho nhân vật và bật chuyển động thứ cấp (secondary motion) cho tóc/vạt áo.',
        defaultParams: { intensity: 1.4, duration: 5 },
        recommendedMcpTools: ['choreograph_motion_sequence', 'layer_assembly_secondary_motion', 'apply_motion_preset'],
        mcpHint: { motion_preset: 'jump_arc', secondary_physics: 'cloth' }
      }
    ]
  },

  physics_fx: {
    type: 'physics_fx',
    stepOrder: 4,
    title: '4. Vật lý, Ánh sáng & FX',
    shortTitle: 'Vật lý & FX',
    aiAgentRole: 'PhysicsLightFxAgent',
    color: '#ec4899',
    description: 'Kích hoạt vật lý chất liệu Mesh 2.5D, lối vào hang động (Depth Portal), Ánh sáng ảo theo gió và Hạt.',
    inputs: ['motion_stream'],
    outputs: ['vfx_stage'],
    presets: [
      {
        id: 'candle_wind_particles',
        label: 'Ánh sáng Ảo Theo Gió + Hạt Đom Đóm',
        summary: 'Nguồn sáng ấm lung linh theo gió · Thêm lớp hạt phát sáng lơ lửng',
        defaultDirective: 'Gắn nguồn sáng ảo (Virtual Light: lửa trại/ánh nến nhạy gió gentle) cho đạo cụ/nhân vật và sinh lớp hạt đom đóm lung linh.',
        defaultParams: { intensity: 1.1, spawnParticles: true },
        recommendedMcpTools: ['update_layer', 'add_particles', 'apply_layer_fx', 'set_layer_glow'],
        mcpHint: { virtual_light: 'candle', wind_preset: 'gentle', add_particles: true }
      },
      {
        id: 'combat_elastic_glow',
        label: 'Va chạm Vật lý Đàn hồi + Viền Glow Neon',
        summary: 'Kích hoạt chất liệu vật lý Mesh (Cây/Thạch/Giáp) · Phát sáng viền chủ thể',
        defaultDirective: 'Bật cấu hình vật lý đàn hồi (LayerPhysicsConfig) cho các lớp tương tác và thêm viền sáng Glow nổi bật cho chủ thể chính.',
        defaultParams: { intensity: 1.35, spawnParticles: false },
        recommendedMcpTools: ['update_layer', 'set_layer_glow', 'apply_layer_fx'],
        mcpHint: { physics_enabled: true, glow_enabled: true, glow_animated: 'breathe' }
      },
      {
        id: 'cave_portal_flashlight',
        label: 'Cửa Hang Độ Sâu (Depth Portal) + Đèn Pin',
        summary: 'Thu nhỏ & phủ bóng tối khi đi vào cửa hang · Chùm sáng hình nón',
        defaultDirective: 'Cấu hình vùng cửa hang (depthPortal) trên layer nền và gắn đèn pin chiếu góc (flashlight) hoặc tinh thể phát sáng cho nhân vật.',
        defaultParams: { intensity: 1.25, spawnParticles: true },
        recommendedMcpTools: ['update_layer', 'add_particles'],
        mcpHint: { depth_portal: true, virtual_light: 'flashlight', cone_angle: 55 }
      }
    ]
  },

  camera_director: {
    type: 'camera_director',
    stepOrder: 5,
    title: '5. Đạo diễn Camera 3D',
    shortTitle: 'Camera 3D',
    aiAgentRole: 'CameraDirectorAgent',
    color: '#22c55e',
    description: 'Tạo lộ trình đường bay Camera 3D qua các Shot, hiệu ứng đẩy cận (Dolly Push-in), xóa phông DOF và rung máy.',
    inputs: ['scene_ctx', 'motion_stream'],
    outputs: ['camera_cut'],
    presets: [
      {
        id: 'cinematic_fly_push',
        label: 'Bay Xuyên Cảnh (Fly-through) + Push-in Mượt',
        summary: 'Dừng đẩy nhẹ ở mỗi Shot rồi bay mượt sang Shot kế · Bật DOF xóa phông',
        defaultDirective: 'Xây dựng lộ trình camera tự động bay mượt (fly/arc) qua tất cả các phân cảnh với độ đẩy push-in 0.15 và bật xóa phông DOF nhẹ.',
        defaultParams: { intensity: 1.0, duration: 10, enableDof: true },
        recommendedMcpTools: ['build_camera_path', 'set_camera', 'camera_fly_to_shot'],
        mcpHint: { transition: 'fly', push_in: 0.15, dof_enabled: true }
      },
      {
        id: 'dolly_push_focus',
        label: 'Đẩy Cận Điện Ảnh (Slow Dolly In)',
        summary: 'Tiến dần vào chủ thể trung tâm · Làm nổi bật chiều sâu Parallax',
        defaultDirective: 'Áp dụng chuyển động Dolly-In tiến chậm vào tâm cảnh từ đầu đến cuối thời lượng, tạo cảm giác chiều sâu không gian mạnh mẽ.',
        defaultParams: { intensity: 1.1, duration: 8, enableDof: true },
        recommendedMcpTools: ['apply_camera_preset', 'set_camera'],
        mcpHint: { preset: 'dollyIn', dof_enabled: true, shake_amount: 1.5 }
      },
      {
        id: 'orbit_showcase_3d',
        label: 'Quỹ đạo Xoay Vòng (3D Orbit Showcase)',
        summary: 'Lượn vòng cung quanh cảnh · Khoe trọn khối 3D và lớp chiều sâu',
        defaultDirective: 'Cho camera lượn vòng cung (orbitRight) kết hợp rung cầm tay cực nhẹ để phô diễn cấu trúc 3D và các tầng layer.',
        defaultParams: { intensity: 1.2, duration: 8, enableDof: false },
        recommendedMcpTools: ['apply_camera_preset', 'set_camera'],
        mcpHint: { preset: 'orbitRight', shake_amount: 2.0 }
      },
      {
        id: 'dramatic_handheld_action',
        label: 'Camera Hành động Rung Nhẹ + Dolly Zoom',
        summary: 'Hiệu ứng Vertigo / Căng thẳng · Rung máy Handheld chân thực',
        defaultDirective: 'Sử dụng chuyển động camera kịch tính với độ rung cầm tay (shakeAmount 6-10) để tăng nhịp độ hành động.',
        defaultParams: { intensity: 1.4, duration: 6, enableDof: true },
        recommendedMcpTools: ['apply_camera_preset', 'set_camera'],
        mcpHint: { preset: 'dollyZoom', shake_amount: 7, shake_speed: 1.2 }
      }
    ]
  },

  audio_lipsync: {
    type: 'audio_lipsync',
    stepOrder: 6,
    title: '6. Âm thanh & Lip-Sync',
    shortTitle: 'Âm thanh',
    aiAgentRole: 'AudioLipSyncAgent',
    color: '#06b6d4',
    description: 'Phối nhạc nền (BGM), tiếng động môi trường (Ambience), gắn thoại nhân vật và tự động nhép môi (Lip-Sync).',
    inputs: ['actors_rig'],
    outputs: ['audio_mix'],
    presets: [
      {
        id: 'voice_lipsync_bgm',
        label: 'Thoại Nhân vật + Tự động Nhép môi Lip-Sync',
        summary: 'Gắn track thoại vào nhân vật · Bật đồng bộ khẩu hình miệng & Fade mượt',
        defaultDirective: 'Tự động liên kết track giọng nói với cụm nhân vật trong cảnh, bật lipSyncEnabled và cân bằng âm lượng nhạc nền.',
        defaultParams: { intensity: 1.0, autoLipSync: true },
        recommendedMcpTools: ['get_audio_targets', 'attach_audio_to_target', 'bake_character_lipsync', 'update_audio_track'],
        mcpHint: { lip_sync: true, voice_tone: 'vocal', bgm_fade: 1.0 }
      },
      {
        id: 'cinematic_bgm_ambience',
        label: 'Nhạc nền Điện ảnh & Không gian Âm thanh Ấm',
        summary: 'EQ Tone ấm (Warm) · Tự động Fade-in đầu cảnh & Fade-out cuối cảnh',
        defaultDirective: 'Thiết lập fade-in / fade-out mượt mà cho toàn bộ các dải âm thanh và áp bộ lọc âm sắc ấm áp (warm tone).',
        defaultParams: { intensity: 1.0, autoLipSync: false },
        recommendedMcpTools: ['get_audio_info', 'add_audio_track', 'update_audio_track'],
        mcpHint: { tone: 'warm', fade_in: 0.8, fade_out: 1.2 }
      }
    ]
  },

  look_output: {
    type: 'look_output',
    stepOrder: 7,
    title: '7. Màu sắc & Xuất bản',
    shortTitle: 'Màu & Xuất',
    aiAgentRole: 'ColorGradingRenderAgent',
    color: '#eab308',
    description: 'Tổng hợp toàn bộ luồng dữ liệu, áp dụng Sương mù chiều sâu (3D Fog), Vignette, Film Grain và kết xuất.',
    inputs: ['vfx_stage', 'camera_cut', 'audio_mix'],
    outputs: [],
    presets: [
      {
        id: 'cinematic_atmospheric_fog',
        label: 'Sương mù Chiều sâu Điện ảnh + Vignette',
        summary: 'Bật Fog 3D theo độ sâu Z · Tương phản 1.08 · Viền tối Vignette 0.28',
        defaultDirective: 'Bật sương mù chiều sâu 3D (fogEnabled), tăng nhẹ độ tương phản (1.08), bão hòa (1.06) và bo viền tối vignette (0.28).',
        defaultParams: { intensity: 1.0 },
        recommendedMcpTools: ['set_look', 'get_viewport_screenshot', 'export_video'],
        mcpHint: { fog_enabled: true, vignette: 0.28, contrast: 1.08, saturation: 1.06 }
      },
      {
        id: 'mystic_night_glow',
        label: 'Đêm Huyền Ảo & Sương Tím Thẫm',
        summary: 'Sương đêm #161936 · Độ phơi sáng dịu · Tăng chiều sâu ánh sáng',
        defaultDirective: 'Chỉnh màu cảnh đêm huyền bí với sương mù xanh tím thẫm (#161936), giảm nhẹ exposure (-0.1) để tôn vinh nguồn sáng ảo và hạt phát sáng.',
        defaultParams: { intensity: 1.15 },
        recommendedMcpTools: ['set_look', 'get_viewport_screenshot'],
        mcpHint: { fog_enabled: true, fog_color: '#161936', exposure: -0.1, contrast: 1.12, vignette: 0.38 }
      },
      {
        id: 'vibrant_anime_clean',
        label: 'Anime Tươi Sáng & Rực Rỡ (Sạch Sương)',
        summary: 'Tắt sương mù · Tăng độ rực màu Saturation 1.16 · Hình ảnh trong trẻo',
        defaultDirective: 'Giữ khung hình trong trẻo sắc nét, tăng độ tươi màu (saturation 1.16, exposure +0.08) theo phong cách hoạt hình Anime hiện đại.',
        defaultParams: { intensity: 1.0 },
        recommendedMcpTools: ['set_look', 'get_viewport_screenshot'],
        mcpHint: { fog_enabled: false, saturation: 1.16, contrast: 1.05, exposure: 0.08, vignette: 0.1 }
      }
    ]
  }
}

export const CANONICAL_NODE_ORDER: WorkflowNodeType[] = [
  'scene_shot',
  'layer_assembly',
  'motion_choreography',
  'physics_fx',
  'camera_director',
  'audio_lipsync',
  'look_output'
]

/** Vị trí tọa độ mặc định gọn đẹp trên mặt phẳng Workflow Canvas */
export const DEFAULT_NODE_POSITIONS: Record<WorkflowNodeType, { x: number; y: number }> = {
  scene_shot: { x: 14, y: 76 },
  layer_assembly: { x: 232, y: 12 },
  motion_choreography: { x: 450, y: 12 },
  physics_fx: { x: 668, y: 12 },
  camera_director: { x: 450, y: 144 },
  audio_lipsync: { x: 668, y: 144 },
  look_output: { x: 886, y: 66 }
}

/** Danh sách kết nối cổng (Port Edges) chuẩn mực giữa 7 khâu sản xuất video */
export function buildStandardEdges(nodes: WorkflowNode[]): WorkflowEdge[] {
  const byType = new Map(nodes.filter((n) => n.enabled).map((n) => [n.type, n]))
  const pairs: { from: WorkflowNodeType; port: WorkflowPortKind; to: WorkflowNodeType }[] = [
    { from: 'scene_shot', port: 'scene_ctx', to: 'layer_assembly' },
    { from: 'scene_shot', port: 'scene_ctx', to: 'camera_director' },
    { from: 'layer_assembly', port: 'actors_rig', to: 'motion_choreography' },
    { from: 'layer_assembly', port: 'actors_rig', to: 'audio_lipsync' },
    { from: 'motion_choreography', port: 'motion_stream', to: 'physics_fx' },
    { from: 'motion_choreography', port: 'motion_stream', to: 'camera_director' },
    { from: 'physics_fx', port: 'vfx_stage', to: 'look_output' },
    { from: 'camera_director', port: 'camera_cut', to: 'look_output' },
    { from: 'audio_lipsync', port: 'audio_mix', to: 'look_output' }
  ]

  const edges: WorkflowEdge[] = []
  for (const p of pairs) {
    const src = byType.get(p.from)
    const dst = byType.get(p.to)
    if (src && dst) {
      edges.push({
        id: `edge-${src.id}-${p.port}-${dst.id}`,
        fromNode: src.id,
        fromPort: p.port,
        toNode: dst.id,
        toPort: p.port
      })
    }
  }
  return edges
}

function makeNode(
  type: WorkflowNodeType,
  presetId?: string,
  enabled = true,
  customDirective?: string,
  customParams?: Partial<WorkflowNodeParams>
): WorkflowNode {
  const spec = WORKFLOW_NODE_SPECS[type]
  const preset = spec.presets.find((p) => p.id === presetId) ?? spec.presets[0]
  return {
    id: `wf-${type}`,
    type,
    title: spec.title,
    enabled,
    position: { ...DEFAULT_NODE_POSITIONS[type] },
    preset: preset.id,
    aiAgentRole: spec.aiAgentRole,
    aiDirective: customDirective ?? preset.defaultDirective,
    params: { ...preset.defaultParams, ...(customParams ?? {}) }
  }
}

export const WORKFLOW_TEMPLATES: WorkflowTemplateSpec[] = [
  {
    id: 'cinematic_parallax_intro',
    name: 'Mở đầu Điện ảnh Parallax 2.5D',
    badge: '🎬',
    category: 'cinematic',
    description:
      'Quy trình chuẩn dựng cảnh Parallax 2.5D: Trải tầng độ sâu Z -> Lắp ráp thực thể -> Gió tự nhiên & nhịp thở -> Ánh sáng & Hạt -> Camera bay xuyên cảnh -> Âm thanh -> Sương mù điện ảnh.',
    buildGraph: () => {
      const nodes: WorkflowNode[] = [
        makeNode('scene_shot', 'deep_parallax_stage', true),
        makeNode('layer_assembly', 'character_and_foliage_rig', true),
        makeNode('motion_choreography', 'organic_wind_breathe', true),
        makeNode('physics_fx', 'candle_wind_particles', true),
        makeNode('camera_director', 'cinematic_fly_push', true),
        makeNode('audio_lipsync', 'cinematic_bgm_ambience', true),
        makeNode('look_output', 'cinematic_atmospheric_fog', true)
      ]
      return {
        version: 1,
        id: 'wf-cinematic-parallax',
        name: 'Mở đầu Điện ảnh Parallax 2.5D',
        presetId: 'cinematic_parallax_intro',
        description:
          'Quy trình dựng video Parallax 2.5D toàn diện: tự động phân tầng độ sâu, kích hoạt gió tự nhiên, thêm hạt đom đóm, tạo đường bay camera mượt và phủ sương mù chiều sâu.',
        nodes,
        edges: buildStandardEdges(nodes)
      }
    }
  },
  {
    id: 'character_action_physics',
    name: 'Hành động Nhân vật & Vật lý Va chạm',
    badge: '⚔️',
    category: 'action',
    description:
      'Tối ưu cho phân cảnh hành động / võ thuật: Sân khấu mặt đất -> Nhân vật gắn xương -> Bật nhảy Parabol & chuyển động thứ cấp -> Vật lý đàn hồi & Glow -> Camera rung nhẹ kịch tính.',
    buildGraph: () => {
      const nodes: WorkflowNode[] = [
        makeNode('scene_shot', 'grounded_3d_stage', true),
        makeNode('layer_assembly', 'character_and_foliage_rig', true),
        makeNode('motion_choreography', 'dynamic_action_arc', true),
        makeNode('physics_fx', 'combat_elastic_glow', true),
        makeNode('camera_director', 'dramatic_handheld_action', true),
        makeNode('audio_lipsync', 'cinematic_bgm_ambience', true),
        makeNode('look_output', 'vibrant_anime_clean', true)
      ]
      return {
        version: 1,
        id: 'wf-character-action',
        name: 'Hành động Nhân vật & Vật lý Va chạm',
        presetId: 'character_action_physics',
        description:
          'Quy trình chuyên biệt cho cảnh hành động nhân vật: kích hoạt vật lý đàn hồi Mesh, chuyển động parabol, viền sáng Glow và camera rung cầm tay.',
        nodes,
        edges: buildStandardEdges(nodes)
      }
    }
  },
  {
    id: 'cave_virtual_light_explore',
    name: 'Thám hiểm Hang động & Ánh sáng Ảo',
    badge: '🕯️',
    category: 'atmosphere',
    description:
      'Dành cho cảnh đi vào hang tối hoặc rừng đêm: Cửa hang Depth Portal tự thu nhỏ & phủ bóng đêm -> Nhân vật cầm nến/đèn pin nhạy theo gió -> Hạt bụi sáng -> Màu đêm huyền ảo.',
    buildGraph: () => {
      const nodes: WorkflowNode[] = [
        makeNode('scene_shot', 'deep_parallax_stage', true),
        makeNode('layer_assembly', 'character_and_foliage_rig', true),
        makeNode('motion_choreography', 'character_walk_depth', true),
        makeNode('physics_fx', 'cave_portal_flashlight', true),
        makeNode('camera_director', 'dolly_push_focus', true),
        makeNode('audio_lipsync', 'cinematic_bgm_ambience', true),
        makeNode('look_output', 'mystic_night_glow', true)
      ]
      return {
        version: 1,
        id: 'wf-cave-explore',
        name: 'Thám hiểm Hang động & Ánh sáng Ảo',
        presetId: 'cave_virtual_light_explore',
        description:
          'Kết hợp Vùng độ sâu cửa hang (Depth Portal) với Nguồn sáng ảo 2.5D (đèn pin/ánh nến theo gió) và bước đi chiều sâu Z.',
        nodes,
        edges: buildStandardEdges(nodes)
      }
    }
  },
  {
    id: 'story_dialogue_lipsync',
    name: 'Kể chuyện Hội thoại & Nhép môi Tự động',
    badge: '🎙️',
    category: 'story',
    description:
      'Tập trung vào nhân vật kể chuyện và đối thoại: Cận cảnh nhân vật -> Đa biến thể biểu cảm -> Nhịp thở tự nhiên -> Gắn thoại & Tự động Lip-Sync khẩu hình miệng -> Đẩy cận Dolly-In.',
    buildGraph: () => {
      const nodes: WorkflowNode[] = [
        makeNode('scene_shot', 'intimate_portrait_stage', true),
        makeNode('layer_assembly', 'expr_variant_actors', true),
        makeNode('motion_choreography', 'organic_wind_breathe', true),
        makeNode('physics_fx', 'candle_wind_particles', false),
        makeNode('camera_director', 'dolly_push_focus', true),
        makeNode('audio_lipsync', 'voice_lipsync_bgm', true),
        makeNode('look_output', 'vibrant_anime_clean', true)
      ]
      return {
        version: 1,
        id: 'wf-story-dialogue',
        name: 'Kể chuyện Hội thoại & Nhép môi Tự động',
        presetId: 'story_dialogue_lipsync',
        description:
          'Tối ưu cho cảnh đối thoại nhân vật: tự động gắn track giọng nói, bật nhép môi Lip-Sync và giữ góc máy cận cảnh giàu cảm xúc.',
        nodes,
        edges: buildStandardEdges(nodes)
      }
    }
  },
  {
    id: 'arch3d_flythrough',
    name: 'Bay xuyên Kiến trúc 3D & Đạo cụ 2.5D',
    badge: '🏛️',
    category: 'architecture',
    description:
      'Phô diễn công trình 3D kết hợp cây cối 2.5D: Sân khấu mặt đất 3D -> Mô hình kiến trúc 3D -> Cây cối đung đưa -> Camera lượn vòng Orbit 3D -> Sương mù chiều sâu.',
    buildGraph: () => {
      const nodes: WorkflowNode[] = [
        makeNode('scene_shot', 'grounded_3d_stage', true),
        makeNode('layer_assembly', 'arch3d_and_props', true),
        makeNode('motion_choreography', 'organic_wind_breathe', true),
        makeNode('physics_fx', 'candle_wind_particles', true),
        makeNode('camera_director', 'orbit_showcase_3d', true),
        makeNode('audio_lipsync', 'cinematic_bgm_ambience', true),
        makeNode('look_output', 'cinematic_atmospheric_fog', true)
      ]
      return {
        version: 1,
        id: 'wf-arch3d-flythrough',
        name: 'Bay xuyên Kiến trúc 3D & Đạo cụ 2.5D',
        presetId: 'arch3d_flythrough',
        description:
          'Quy trình trình diễn kiến trúc 3D và không gian nội/ngoại thất với quỹ đạo Camera Orbit 3D mượt mà.',
        nodes,
        edges: buildStandardEdges(nodes)
      }
    }
  }
]
