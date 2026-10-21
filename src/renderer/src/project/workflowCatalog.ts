import type {
  WorkflowAgentRole,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams,
  WorkflowNodeType,
  WorkflowPortKind
} from '@shared/types'
import { DEFAULT_PRESET_SUBPARTS } from './workflowTargets'

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
    shortLabel: '🎬 Cảnh 3D',
    color: '#38bdf8',
    description: 'Truyền thông tin phân cảnh, kích thước khung hình và các tầng độ sâu Z sang các khâu tiếp theo.'
  },
  actors_rig: {
    id: 'actors_rig',
    label: 'Thực thể & Khung xương (Actors & Rig)',
    shortLabel: '🧩 Layer 2.5D',
    color: '#a855f7',
    description: 'Truyền danh sách nhân vật 2.5D, đạo cụ composite và mô hình 3D sang khâu chuyển động và âm thanh.'
  },
  motion_stream: {
    id: 'motion_stream',
    label: 'Luồng Chuyển động (Motion Stream)',
    shortLabel: '🍃 Chuyển động',
    color: '#f59e0b',
    description: 'Truyền quỹ đạo di chuyển, động tác xương và gió tự nhiên sang khâu Vật lý/FX và Camera.'
  },
  vfx_stage: {
    id: 'vfx_stage',
    label: 'Vật lý & Ánh sáng FX (Physics & Light)',
    shortLabel: '💡 Vật lý/FX',
    color: '#ec4899',
    description: 'Truyền hiệu ứng vật lý đàn hồi, ánh sáng ảo theo gió và hạt môi trường tới khâu hoàn thiện.'
  },
  camera_cut: {
    id: 'camera_cut',
    label: 'Đường bay Camera 3D (Camera Trajectory)',
    shortLabel: '🛣️ Lộ trình Cam',
    color: '#22c55e',
    description: 'Truyền lộ trình bay camera, góc nhìn FOV và hiệu ứng xóa phông DOF tới khâu xuất bản.'
  },
  audio_mix: {
    id: 'audio_mix',
    label: 'Bản phối Âm thanh & Lip-Sync (Audio Mix)',
    shortLabel: '🎙️ Thoại/Audio',
    color: '#06b6d4',
    description: 'Truyền nhạc nền, hiệu ứng âm thanh và đồng bộ khẩu hình miệng tới khâu xuất bản.'
  },
  layers_tree: {
    id: 'layers_tree',
    label: 'Cây Phân Tầng Layer 2.5D (Layers Tree)',
    shortLabel: '🌲 Tầng Layer',
    color: '#8b5cf6',
    description: 'Liên kết phân cấp chiều sâu từ Phân cảnh gốc xuống các Layer con theo thứ tự Z-index.'
  },
  transform_link: {
    id: 'transform_link',
    label: 'Liên kết Tọa độ Transform (X/Y/Z & Xoay)',
    shortLabel: '🎯 Tọa độ 2.5D',
    color: '#06b6d4',
    description: 'Điều khiển trực tiếp trục X, Y, Z và góc xoay hướng của Layer theo thời gian thực.'
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
    outputs: ['scene_ctx', 'layers_tree'],
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
    inputs: ['layers_tree', 'scene_ctx', 'motion_stream', 'vfx_stage', 'audio_mix', 'camera_cut'],
    outputs: ['transform_link', 'actors_rig'],
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

  layer_transform: {
    type: 'layer_transform',
    stepOrder: 2,
    title: 'Tọa độ & Xoay 2.5D',
    shortTitle: 'Tọa độ Z',
    aiAgentRole: 'LayerTransformAgent',
    color: '#06b6d4',
    description: 'Bộ điều khiển tọa độ không gian 2.5D: Trục X, Trục Y, Chiều sâu Z và Góc xoay hướng.',
    inputs: ['transform_link'],
    outputs: [],
    presets: [
      {
        id: 'layer_transform_controller',
        label: 'Bộ điều khiển Tọa độ 2.5D',
        summary: 'Trục X, Y, Z & Góc xoay · Đồng bộ trực tiếp 60fps',
        defaultDirective: 'Điều chỉnh tọa độ X, Y, Z và góc xoay của Layer theo thời gian thực.',
        defaultParams: { intensity: 1.0 },
        recommendedMcpTools: ['update_layer'],
        mcpHint: {}
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
    inputs: ['actors_rig', 'scene_ctx'],
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
    inputs: ['motion_stream', 'actors_rig', 'scene_ctx', 'vfx_stage'],
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
    inputs: ['scene_ctx', 'motion_stream', 'camera_cut'],
    outputs: ['camera_cut'],
    presets: [
      {
        id: 'pan_and_dolly',
        label: 'Lia Máy & Đẩy Cận (Pan then Dolly-In)',
        summary: 'Lia camera tới vị trí mục tiêu rồi zoom to dần · Mượt mà & Tập trung',
        defaultDirective: 'Lia ống kính từ toàn cảnh tới vị trí/layer mục tiêu trong nửa đầu thời lượng, sau đó đẩy zoom to dần vào chủ thể.',
        defaultParams: { intensity: 1.15, duration: 6, camChoreography: 'pan_and_dolly', camPanDurationRatio: 0.45, enableDof: false },
        recommendedMcpTools: ['apply_camera_preset', 'set_camera'],
        mcpHint: { preset: 'pan_and_dolly', pan_ratio: 0.45, push_in: 0.3 }
      },
      {
        id: 'cinematic_fly_push',
        label: 'Bay Xuyên Cảnh (Fly-through) + Push-in Mượt',
        summary: 'Dừng đẩy nhẹ ở mỗi Shot rồi bay mượt sang Shot kế · Bật DOF xóa phông',
        defaultDirective: 'Xây dựng lộ trình camera tự động bay mượt (fly/arc) qua tất cả các phân cảnh với độ đẩy push-in 0.15 và bật xóa phông DOF nhẹ.',
        defaultParams: { intensity: 1.0, duration: 10, enableDof: false },
        recommendedMcpTools: ['build_camera_path', 'set_camera', 'camera_fly_to_shot'],
        mcpHint: { transition: 'fly', push_in: 0.15, dof_enabled: false }
      },
      {
        id: 'dolly_push_focus',
        label: 'Đẩy Cận Điện Ảnh (Slow Dolly In)',
        summary: 'Tiến dần vào chủ thể trung tâm · Làm nổi bật chiều sâu Parallax',
        defaultDirective: 'Áp dụng chuyển động Dolly-In tiến chậm vào tâm cảnh từ đầu đến cuối thời lượng, tạo cảm giác chiều sâu không gian mạnh mẽ.',
        defaultParams: { intensity: 1.1, duration: 8, enableDof: false },
        recommendedMcpTools: ['apply_camera_preset', 'set_camera'],
        mcpHint: { preset: 'dollyIn', dof_enabled: false, shake_amount: 1.5 }
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
        defaultParams: { intensity: 1.4, duration: 6, enableDof: false },
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
    inputs: ['actors_rig', 'scene_ctx'],
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
    inputs: ['camera_cut', 'vfx_stage', 'audio_mix', 'scene_ctx', 'motion_stream'],
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
  'layer_transform',
  'motion_choreography',
  'physics_fx',
  'camera_director',
  'audio_lipsync',
  'look_output'
]

/** Vị trí tọa độ mặc định gọn đẹp trên mặt phẳng Workflow Canvas (Hiển thị chuẩn 100% 1:1 sắc nét) */
export const DEFAULT_NODE_POSITIONS: Record<WorkflowNodeType, { x: number; y: number }> = {
  scene_shot: { x: 80, y: 220 },
  layer_assembly: { x: 500, y: 60 },
  layer_transform: { x: 500, y: 380 },
  motion_choreography: { x: 920, y: 60 },
  audio_lipsync: { x: 920, y: 380 },
  physics_fx: { x: 1340, y: 60 },
  camera_director: { x: 1340, y: 380 },
  look_output: { x: 1760, y: 220 }
}

export const PRESET_SHORT_LABELS: Record<string, string> = {
  deep_parallax_stage: 'Sâu Z 3200',
  grounded_3d_stage: 'Mặt đất 3D',
  intimate_portrait_stage: 'Cận cảnh',
  character_and_foliage_rig: 'Nhân vật+Cây',
  arch3d_and_props: 'Kiến trúc 3D',
  expr_variant_actors: 'Đa bộ phận',
  layer_transform_controller: 'Tọa độ 2.5D',
  organic_wind_breathe: 'Gió + Thở',
  character_walk_depth: 'Bước đi Z',
  dynamic_action_arc: 'Nhảy Arc',
  candle_wind_particles: 'Đèn + Hạt',
  combat_elastic_glow: 'Mesh + Glow',
  cave_portal_flashlight: 'Cửa hang',
  pan_and_dolly: 'Lia & Zoom In',
  cinematic_fly_push: 'Bay qua cảnh',
  dolly_push_focus: 'Dolly In',
  orbit_showcase_3d: 'Orbit 3D',
  dramatic_handheld_action: 'Rung Action',
  voice_lipsync_bgm: 'Lip-Sync',
  cinematic_bgm_ambience: 'Nhạc BGM',
  cinematic_atmospheric_fog: 'Sương 3D',
  mystic_night_glow: 'Đêm huyền ảo',
  vibrant_anime_clean: 'Anime sáng'
}

/** Phát hiện bố cục cũ bị dày đặc / chồng lấn để tự động nâng cấp sang bố cục thoáng chuẩn mới */
export function isLegacyCrampedWorkflowLayout(nodes: WorkflowNode[]): boolean {
  if (!nodes || nodes.length < 2) return false
  const byType = new Map<WorkflowNodeType, WorkflowNode>(nodes.map((n) => [n.type, n]))
  const assembly = byType.get('layer_assembly')
  const motion = byType.get('motion_choreography')
  const audio = byType.get('audio_lipsync')
  const physics = byType.get('physics_fx')
  const camera = byType.get('camera_director')

  const scene = byType.get('scene_shot')
  return Boolean(
    scene?.position.x === 18 &&
      assembly?.position.x === 290 &&
      motion?.position.x === 562 &&
      physics?.position.x === 834 &&
      audio?.position.y === 162 &&
      camera?.position.y === 162
  )



}

export function upgradeCrampedNodePositions(nodes: WorkflowNode[]): WorkflowNode[] {
  if (!isLegacyCrampedWorkflowLayout(nodes)) return nodes
  return nodes.map((n) => ({
    ...n,
    position: { ...(DEFAULT_NODE_POSITIONS[n.type] ?? n.position) }
  }))
}

/** Danh sách kết nối cổng (Port Edges) chuẩn mực giữa 7 khâu sản xuất video */
export function buildStandardEdges(nodes: WorkflowNode[]): WorkflowEdge[] {
  const enabledNodes = nodes.filter((n) => n.enabled)
  if (enabledNodes.length <= 1) return []

  const byType = new Map<WorkflowNodeType, WorkflowNode[]>()
  for (const n of enabledNodes) {
    const list = byType.get(n.type) ?? []
    list.push(n)
    byType.set(n.type, list)
  }

  const edges: WorkflowEdge[] = []
  const edgeKeySet = new Set<string>()

  const addEdge = (
    fromNode: WorkflowNode,
    fromPort: WorkflowPortKind,
    toNode: WorkflowNode,
    toPort: WorkflowPortKind
  ) => {
    if (fromNode.id === toNode.id) return
    const key = `${fromNode.id}:${fromPort}->${toNode.id}:${toPort}`
    if (edgeKeySet.has(key)) return
    edgeKeySet.add(key)
    edges.push({
      id: `edge-${fromNode.id}-${fromPort}-${toNode.id}-${toPort}`,
      fromNode: fromNode.id,
      fromPort,
      toNode: toNode.id,
      toPort
    })
  }

  const scenes = byType.get('scene_shot') ?? []
  const assemblies = byType.get('layer_assembly') ?? []
  const motions = byType.get('motion_choreography') ?? []
  const fxList = byType.get('physics_fx') ?? []
  const cameras = byType.get('camera_director') ?? []
  const audios = byType.get('audio_lipsync') ?? []
  const looks = byType.get('look_output') ?? []

  // 1. Phân cảnh & Z -> Lắp ráp Thực thể (hoặc trực tiếp Motion nếu không có Assembly)
  for (const sc of scenes) {
    if (assemblies.length > 0) {
      for (const as of assemblies) addEdge(sc, 'scene_ctx', as, 'scene_ctx')
    } else if (motions.length > 0) {
      addEdge(sc, 'scene_ctx', motions[0], 'scene_ctx')
    }
    // Phân cảnh -> Camera 3D (truyền thông số chiều sâu Z và danh sách Shot)
    for (const cam of cameras) {
      addEdge(sc, 'scene_ctx', cam, 'scene_ctx')
    }
  }

  // 2. Lắp ráp Thực thể -> Chuyển động & Âm thanh
  for (const as of assemblies) {
    if (motions.length > 0) {
      addEdge(as, 'actors_rig', motions[0], 'actors_rig')
    }
    for (const au of audios) {
      addEdge(as, 'actors_rig', au, 'actors_rig')
    }
  }

  // 3. Chuyển động 2.5D: Nối tiếp các Motion node trong chuỗi (Chaining), hoặc sang FX / Camera
  if (motions.length > 0) {
    for (let i = 0; i < motions.length - 1; i++) {
      addEdge(motions[i], 'motion_stream', motions[i + 1], 'motion_stream')
    }
    const lastMotion = motions[motions.length - 1]
    if (fxList.length > 0) {
      addEdge(lastMotion, 'motion_stream', fxList[0], 'motion_stream')
    }
    for (const cam of cameras) {
      addEdge(lastMotion, 'motion_stream', cam, 'motion_stream')
    }
    if (fxList.length === 0 && looks.length > 0) {
      for (const lk of looks) addEdge(lastMotion, 'motion_stream', lk, 'motion_stream')
    }
  } else if (assemblies.length > 0 && fxList.length > 0) {
    for (const as of assemblies) addEdge(as, 'actors_rig', fxList[0], 'actors_rig')
  }

  // 4. Vật lý & FX: Nối tiếp các FX node trong chuỗi (Chaining), cuối cùng đổ về Look
  if (fxList.length > 0) {
    for (let i = 0; i < fxList.length - 1; i++) {
      addEdge(fxList[i], 'vfx_stage', fxList[i + 1], 'vfx_stage')
    }
    const lastFx = fxList[fxList.length - 1]
    for (const lk of looks) {
      addEdge(lastFx, 'vfx_stage', lk, 'vfx_stage')
    }
  }

  // 5. Đạo diễn Camera -> Màu & Xuất bản Master
  for (const cam of cameras) {
    for (const lk of looks) {
      addEdge(cam, 'camera_cut', lk, 'camera_cut')
    }
  }

  // 6. Âm thanh & Lip-Sync -> Màu & Xuất bản Master
  for (const au of audios) {
    for (const lk of looks) {
      addEdge(au, 'audio_mix', lk, 'audio_mix')
    }
  }

  return edges
}

export function makeNode(
  type: WorkflowNodeType,
  presetId?: string,
  enabled = true,
  customDirective?: string,
  customParams?: Partial<WorkflowNodeParams>
): WorkflowNode {
  const spec = WORKFLOW_NODE_SPECS[type]
  const preset = spec.presets.find((p) => p.id === presetId) ?? spec.presets[0]
  const defaultParts = DEFAULT_PRESET_SUBPARTS[preset.id] ?? []
  return {
    id: `wf-${type}`,
    type,
    title: spec.title,
    enabled,
    position: { ...DEFAULT_NODE_POSITIONS[type] },
    preset: preset.id,
    aiAgentRole: spec.aiAgentRole,
    aiDirective: customDirective ?? preset.defaultDirective,
    params: {
      targetMode: 'auto',
      targetParts: [...defaultParts],
      ...preset.defaultParams,
      ...(customParams ?? {})
    }
  }
}

/**
 * Tạo quy trình chuẩn 7 khâu logic hoàn chỉnh (Canonical Flow).
 * Không sử dụng các mẫu cứng nhắc; người dùng có thể tự do xóa, thêm node logic và nối dây theo ý muốn.
 */
export function createCanonicalWorkflow(targetShotId?: string): WorkflowGraph {
  const nodes: WorkflowNode[] = [
    makeNode('scene_shot', 'deep_parallax_stage', true),
    makeNode('layer_assembly', 'character_and_foliage_rig', true),
    makeNode('motion_choreography', 'organic_wind_breathe', true),
    makeNode('physics_fx', 'candle_wind_particles', true),
    makeNode('camera_director', 'cinematic_fly_push', true),
    makeNode('audio_lipsync', 'voice_lipsync_bgm', true),
    makeNode('look_output', 'cinematic_atmospheric_fog', true)
  ]
  return {
    version: 1,
    id: 'wf-canonical-pipeline',
    name: 'Quy trình Xử lý Parallax 2.5D',
    description:
      'Quy trình chuẩn 7 khâu xử lý hoàn chỉnh: Phân cảnh & Z ➔ Lắp ráp ➔ Chuyển động ➔ Vật lý/FX ➔ Camera 3D ➔ Âm thanh ➔ Màu & Xuất bản.',
    nodes,
    edges: buildStandardEdges(nodes),
    targetShotId
  }
}

export function createDefaultWorkflow(): WorkflowGraph {
  return createCanonicalWorkflow()
}

export function getWorkflowFromTemplate(_presetId?: string): WorkflowGraph {
  return createCanonicalWorkflow()
}

/** Đã xóa bỏ các mẫu quy trình có sẵn cứng nhắc theo yêu cầu; trả về mảng rỗng để tương thích backward */
export const WORKFLOW_TEMPLATES: WorkflowTemplateSpec[] = []
