import type {
  WorkflowCustomActionRule,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType
} from '@shared/types'
import {
  CANONICAL_NODE_ORDER,
  DEFAULT_NODE_POSITIONS,
  WORKFLOW_NODE_SPECS,
  WORKFLOW_PORT_SPECS,
  buildStandardEdges
} from './workflowCatalog'
import { getDefaultPartsForNode } from './workflowTargets'
import type { WorkflowPortKind } from '@shared/types'

export type WorkflowLogicNodeCategory = WorkflowLogicNodeCatalogItem['category']

export interface WorkflowLogicNodeCatalogItem {
  id: string
  category: 'scene' | 'motion' | 'light_fx' | 'camera' | 'look_audio'
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
  id: WorkflowLogicNodeCatalogItem['category']
  label: string
  icon: string
}[] = [
  { id: 'motion', label: '🍃 Chuyển động', icon: '🍃' },
  { id: 'light_fx', label: '🕯️ Ánh sáng & Vật lý', icon: '🕯️' },
  { id: 'camera', label: '🎥 Camera 3D', icon: '🎥' },
  { id: 'look_audio', label: '🌅 Màu & Âm thanh', icon: '🌅' },
  { id: 'scene', label: '🎬 Không gian Z', icon: '🎬' }
]

/**
 * Thư viện Node Logic chuyên biệt (Mỗi Node đại diện cho 1 Logic xử lý độc lập).
 * Người dùng chọn Node từ Kho Node Logic để thả lên Canvas; khi nối dây (Port) vào luồng,
 * đúng logic của Node đó sẽ thực thi theo luồng của Phân cảnh đang chọn.
 */
export const WORKFLOW_LOGIC_NODE_CATALOG: WorkflowLogicNodeCatalogItem[] = [
  // 1. Nhóm Chuyển động 2.5D
  {
    id: 'logic-motion-wind',
    category: 'motion',
    categoryLabel: 'Chuyển động 2.5D',
    nodeType: 'motion_choreography',
    icon: '🍃',
    title: 'Logic Gió Lay Cây & Tán Lá',
    shortLabel: 'Gió Lay Cây',
    preset: 'organic_wind_breathe',
    targetParts: ['canopy_wind'],
    description: 'Tạo chuyển động gió thổi đung đưa tự nhiên cho cây cối, bụi hoa, tán lá trong phân cảnh.',
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
    id: 'logic-motion-drift',
    category: 'motion',
    categoryLabel: 'Chuyển động 2.5D',
    nodeType: 'motion_choreography',
    icon: '☁️',
    title: 'Logic Mây & Sương Trôi Ngang',
    shortLabel: 'Mây Trôi Drift',
    preset: 'organic_wind_breathe',
    targetParts: ['sky_cloud_drift'],
    description: 'Di chuyển trôi ngang mượt mà liên tục cho bầu trời, mây và lớp sương mù.',
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
    title: 'Logic Nhịp Thở & Lơ Lửng',
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
  {
    id: 'logic-motion-sway',
    category: 'motion',
    categoryLabel: 'Chuyển động 2.5D',
    nodeType: 'motion_choreography',
    icon: '🌬️',
    title: 'Logic Đung Đưa Con Lắc (Sway)',
    shortLabel: 'Đung Đưa Sway',
    preset: 'organic_wind_breathe',
    targetParts: ['hair_cloth_sway'],
    description: 'Đung đưa mềm mại quanh điểm neo cho tóc, tà áo, dây leo hoặc đèn lồng.',
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
    id: 'logic-motion-walk-z',
    category: 'motion',
    categoryLabel: 'Chuyển động 2.5D',
    nodeType: 'motion_choreography',
    icon: '🚶',
    title: 'Logic Bước Đi Chiều Sâu Z',
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
    title: 'Logic Bật Nhảy Hành Động',
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

  // 2. Nhóm Ánh sáng & Vật lý 2.5D
  {
    id: 'logic-fx-candle',
    category: 'light_fx',
    categoryLabel: 'Ánh sáng & Vật lý',
    nodeType: 'physics_fx',
    icon: '🕯️',
    title: 'Logic Đèn Nến / Đom Đóm Ấm',
    shortLabel: 'Ánh Sáng Ấm',
    preset: 'candle_wind_particles',
    targetParts: ['virtual_light_core'],
    spawnParticles: false,
    description: 'Gắn nguồn sáng ấm 2.5D tỏa tròn nhạy theo gió chiếu sáng chủ thể trung tâm cảnh.',
    buildRules: () => [
      {
        id: `rule-candle-${Date.now().toString(36)}`,
        label: 'Đèn nến / Đom đóm 2.5D',
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
    categoryLabel: 'Ánh sáng & Vật lý',
    nodeType: 'physics_fx',
    icon: '🔦',
    title: 'Logic Đèn Pin Chiếu Tia Nón',
    shortLabel: 'Đèn Pin Tia',
    preset: 'cave_portal_flashlight',
    targetParts: ['virtual_light_core'],
    spawnParticles: false,
    description: 'Chiếu chùm tia sáng hình nón định hướng làm nổi bật chủ thể trong cảnh.',
    buildRules: () => [
      {
        id: `rule-flashlight-${Date.now().toString(36)}`,
        label: 'Chùm đèn pin 2.5D',
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
    categoryLabel: 'Ánh sáng & Vật lý',
    nodeType: 'physics_fx',
    icon: '✨',
    title: 'Logic Phát Sáng Viền Alpha',
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
    id: 'logic-fx-elastic',
    category: 'light_fx',
    categoryLabel: 'Ánh sáng & Vật lý',
    nodeType: 'physics_fx',
    icon: '🧬',
    title: 'Logic Lưới 2.5D Đàn Hồi',
    shortLabel: 'Lưới Đàn Hồi',
    preset: 'combat_elastic_glow',
    targetParts: ['soft_mesh_jiggle'],
    spawnParticles: false,
    description: 'Bật biến dạng lò xo đàn hồi 2.5D cho cây cối, đạo cụ và nhân vật trong cảnh.',
    buildRules: () => [
      {
        id: `rule-elastic-${Date.now().toString(36)}`,
        label: 'Lưới 2.5D đàn hồi',
        targetId: 'all',
        targetName: 'Cây cối & Nhân vật trong cảnh',
        actionKind: 'mesh_elastic',
        speed: 1.2,
        amount: 1.15,
        enabled: true
      }
    ]
  },
  {
    id: 'logic-fx-particles',
    category: 'light_fx',
    categoryLabel: 'Ánh sáng & Vật lý',
    nodeType: 'physics_fx',
    icon: '🪄',
    title: 'Logic Hạt Đom Đóm Bay 3D',
    shortLabel: 'Hạt Đom Đóm',
    preset: 'candle_wind_particles',
    targetParts: ['firefly_particles'],
    spawnParticles: true,
    description: 'Sinh lớp hạt đom đóm & bụi sáng lơ lửng trong không gian 3D của phân cảnh.'
  },

  // 3. Nhóm Camera 3D
  {
    id: 'logic-cam-fly',
    category: 'camera',
    categoryLabel: 'Đạo diễn Camera',
    nodeType: 'camera_director',
    icon: '🎥',
    title: 'Logic Lia Máy Qua Cảnh',
    shortLabel: 'Lia Máy Fly',
    preset: 'cinematic_fly_push',
    targetParts: ['spline_eye_path', 'lookat_target', 'fov_dolly_zoom'],
    enableDof: false,
    description: 'Tạo đường bay Camera mượt mà giữ ảnh sắc nét 100% (không làm mờ DOF).'
  },
  {
    id: 'logic-cam-dolly',
    category: 'camera',
    categoryLabel: 'Đạo diễn Camera',
    nodeType: 'camera_director',
    icon: '🔍',
    title: 'Logic Đẩy Cận Chủ Thể (Dolly)',
    shortLabel: 'Đẩy Cận Dolly',
    preset: 'dolly_push_focus',
    targetParts: ['fov_dolly_zoom', 'lookat_target'],
    enableDof: false,
    description: 'Đẩy máy từ toàn cảnh 100% tiến vào cận cảnh chủ thể để lộ rõ thị sai 2.5D.'
  },
  {
    id: 'logic-cam-orbit',
    category: 'camera',
    categoryLabel: 'Đạo diễn Camera',
    nodeType: 'camera_director',
    icon: '🔄',
    title: 'Logic Xoay Vòng Cung 3D (Orbit)',
    shortLabel: 'Xoay Orbit 3D',
    preset: 'orbit_showcase_3d',
    targetParts: ['spline_eye_path', 'lookat_target'],
    enableDof: false,
    description: 'Bay xoay vòng cung 3D quanh tâm cảnh để phô diễn chiều sâu giữa các lớp.'
  },
  {
    id: 'logic-cam-dof',
    category: 'camera',
    categoryLabel: 'Đạo diễn Camera',
    nodeType: 'camera_director',
    icon: '🎯',
    title: 'Logic Xóa Phông Tiêu Cự (DOF)',
    shortLabel: 'Xóa Phông DOF',
    preset: 'dolly_push_focus',
    targetParts: ['fov_dolly_zoom', 'lookat_target', 'dof_aperture'],
    enableDof: true,
    description: 'Bật làm mờ hậu cảnh xa mặt phẳng lấy nét (tắt Node này để ảnh Camera nét căng như Cam 2D).'
  },

  // 4. Nhóm Màu sắc & Âm thanh
  {
    id: 'logic-look-sharp',
    category: 'look_audio',
    categoryLabel: 'Màu sắc & Âm thanh',
    nodeType: 'look_output',
    icon: '💎',
    title: 'Logic Ảnh Trong Trẻo Sắc Nét',
    shortLabel: 'Ảnh Nét Căng',
    preset: 'vibrant_anime_clean',
    targetParts: ['color_grade_lut', 'mp4_master_out'],
    description: 'Giữ ảnh hiển thị sắc nét, trong trẻo đồng nhất 100% giữa Camera và Cam 2D (tắt sương mù).'
  },
  {
    id: 'logic-look-warm',
    category: 'look_audio',
    categoryLabel: 'Màu sắc & Âm thanh',
    nodeType: 'look_output',
    icon: '🌅',
    title: 'Logic Màu Điện Ảnh Hoàng Hôn',
    shortLabel: 'Màu Hoàng Hôn',
    preset: 'cinematic_atmospheric_fog',
    targetParts: ['color_grade_lut', 'lens_vignette_grain', 'mp4_master_out'],
    description: 'Cân chỉnh tông màu ấm điện ảnh và bo viền nhẹ Vignette.'
  },
  {
    id: 'logic-look-fog',
    category: 'look_audio',
    categoryLabel: 'Màu sắc & Âm thanh',
    nodeType: 'look_output',
    icon: '🌙',
    title: 'Logic Sương Mù Chiều Sâu Z',
    shortLabel: 'Sương Mù 3D',
    preset: 'mystic_night_glow',
    targetParts: ['z_depth_fog', 'color_grade_lut', 'mp4_master_out'],
    description: 'Phủ lớp sương mù chiều sâu Z cho các lớp núi và bầu trời ở xa.'
  },
  {
    id: 'logic-audio-lipsync',
    category: 'look_audio',
    categoryLabel: 'Màu sắc & Âm thanh',
    nodeType: 'audio_lipsync',
    icon: '🗣️',
    title: 'Logic Nhép Môi Nhân Vật 2.5D',
    shortLabel: 'Nhép Môi 2.5D',
    preset: 'voice_lipsync_bgm',
    targetParts: ['mouth_viseme_25d', 'vocal_eq_chain'],
    description: 'Tự động đóng/mở layer Miệng nhân vật theo biên độ sóng âm giọng thoại.'
  },

  // 5. Nhóm Không gian Z
  {
    id: 'logic-scene-parallax',
    category: 'scene',
    categoryLabel: 'Không gian Z',
    nodeType: 'scene_shot',
    icon: '📐',
    title: 'Logic Tách Tầng Chiều Sâu Z',
    shortLabel: 'Tách Tầng Z',
    preset: 'deep_parallax_stage',
    targetParts: ['sky_horizon', 'mid_scenery', 'focal_plane', 'fg_frame'],
    ensureGround: false,
    description: 'Tự động giãn khoảng cách Z (3200 → -120) cho các lớp của phân cảnh đang chọn.'
  },
  {
    id: 'logic-scene-ground3d',
    category: 'scene',
    categoryLabel: 'Không gian Z',
    nodeType: 'scene_shot',
    icon: '⛰️',
    title: 'Logic Sàn Mặt Đất 3D',
    shortLabel: 'Mặt Đất 3D',
    preset: 'grounded_3d_stage',
    targetParts: ['sky_horizon', 'mid_scenery', 'focal_plane', 'ground_plane'],
    ensureGround: true,
    description: 'Thêm mặt phẳng sàn 3D nằm ngang đỡ dưới chân nhân vật & đạo cụ.'
  }
]

/**
 * Thả một Node Logic mới lên mặt phẳng Workflow Canvas và tự động nối dây (Port)
 * vào luồng xử lý của Phân cảnh đang chọn.
 */
export function spawnLogicNodeIntoWorkflow(
  workflow: WorkflowGraph,
  logicId: string,
  targetShotId?: string
): { workflow: WorkflowGraph; spawnedNode: WorkflowNode } {
  const item = WORKFLOW_LOGIC_NODE_CATALOG.find((x) => x.id === logicId)
  if (!item) {
    throw new Error(`Không tìm thấy Node Logic "${logicId}" trong Kho Node Logic.`)
  }

  const spec = WORKFLOW_NODE_SPECS[item.nodeType]
  const basePos = DEFAULT_NODE_POSITIONS[item.nodeType] ?? { x: 600, y: 120 }
  const sameTypeNodes = workflow.nodes.filter((n) => n.type === item.nodeType)

  const newPos = {
    x: basePos.x + (sameTypeNodes.length % 2 === 1 ? 26 : 0),
    y: basePos.y + sameTypeNodes.length * 168
  }

  const uniqueSuffix = Math.random().toString(36).slice(2, 6)
  const newNodeId = `wf-${item.id}-${uniqueSuffix}`
  const scopedShot = targetShotId ?? workflow.targetShotId ?? 'all'

  const newNode: WorkflowNode = {
    id: newNodeId,
    type: item.nodeType,
    title: `${item.icon} ${item.title}`,
    enabled: true,
    position: newPos,
    preset: item.preset,
    aiAgentRole: spec.aiAgentRole,
    aiDirective: item.description,
    params: {
      intensity: 1.0,
      targetMode: 'auto',
      shotId: scopedShot,
      logicId: item.id,
      targetParts: [...item.targetParts],
      enableDof: item.enableDof ?? false,
      ensureGround: item.ensureGround ?? false,
      spawnParticles: item.spawnParticles ?? false,
      customRules: item.buildRules ? item.buildRules() : []
    }
  }

  const nextEdges: WorkflowEdge[] = [...workflow.edges]
  const addEdgeIfMissing = (fromNode: string, fromPort: any, toNode: string, toPort: any) => {
    if (fromNode === toNode) return
    const exists = nextEdges.some(
      (e) =>
        e.fromNode === fromNode &&
        e.fromPort === fromPort &&
        e.toNode === toNode &&
        e.toPort === toPort
    )
    if (!exists) {
      nextEdges.push({
        id: `edge-${fromNode}-${fromPort}-${toNode}-${toPort}`,
        fromNode,
        fromPort,
        toNode,
        toPort
      })
    }
  }

  const sceneNode = workflow.nodes.find((n) => n.type === 'scene_shot' && n.enabled) ?? workflow.nodes[0]
  const assemblyNode = workflow.nodes.find((n) => n.type === 'layer_assembly' && n.enabled)
  const motionNode = workflow.nodes.find((n) => n.type === 'motion_choreography' && n.enabled)
  const lookNode = workflow.nodes.find((n) => n.type === 'look_output' && n.enabled)

  if (item.nodeType === 'motion_choreography') {
    if (assemblyNode) {
      addEdgeIfMissing(assemblyNode.id, 'actors_rig', newNode.id, 'actors_rig')
    } else if (sceneNode) {
      addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'actors_rig')
    }
    const fxNode = workflow.nodes.find((n) => n.type === 'physics_fx' && n.enabled)
    if (fxNode) {
      addEdgeIfMissing(newNode.id, 'motion_stream', fxNode.id, 'motion_stream')
    } else if (lookNode) {
      addEdgeIfMissing(newNode.id, 'motion_stream', lookNode.id, 'vfx_stage')
    }
  } else if (item.nodeType === 'physics_fx') {
    if (motionNode) {
      addEdgeIfMissing(motionNode.id, 'motion_stream', newNode.id, 'motion_stream')
    } else if (sceneNode) {
      addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'motion_stream')
    }
    if (lookNode) {
      addEdgeIfMissing(newNode.id, 'vfx_stage', lookNode.id, 'vfx_stage')
    }
  } else if (item.nodeType === 'camera_director') {
    if (sceneNode) {
      addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'scene_ctx')
    }
    if (motionNode) {
      addEdgeIfMissing(motionNode.id, 'motion_stream', newNode.id, 'motion_stream')
    }
    if (lookNode) {
      addEdgeIfMissing(newNode.id, 'camera_cut', lookNode.id, 'camera_cut')
    }
  } else if (item.nodeType === 'audio_lipsync') {
    if (assemblyNode) {
      addEdgeIfMissing(assemblyNode.id, 'actors_rig', newNode.id, 'actors_rig')
    } else if (sceneNode) {
      addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'actors_rig')
    }
    if (lookNode) {
      addEdgeIfMissing(newNode.id, 'audio_mix', lookNode.id, 'audio_mix')
    }
  } else if (item.nodeType === 'look_output') {
    const fxNode = workflow.nodes.find((n) => n.type === 'physics_fx' && n.enabled)
    const camNode = workflow.nodes.find((n) => n.type === 'camera_director' && n.enabled)
    if (fxNode) addEdgeIfMissing(fxNode.id, 'vfx_stage', newNode.id, 'vfx_stage')
    if (camNode) addEdgeIfMissing(camNode.id, 'camera_cut', newNode.id, 'camera_cut')
    else if (sceneNode) addEdgeIfMissing(sceneNode.id, 'scene_ctx', newNode.id, 'vfx_stage')
  } else if (item.nodeType === 'scene_shot') {
    if (assemblyNode) addEdgeIfMissing(newNode.id, 'scene_ctx', assemblyNode.id, 'scene_ctx')
    const camNode = workflow.nodes.find((n) => n.type === 'camera_director' && n.enabled)
    if (camNode) addEdgeIfMissing(newNode.id, 'scene_ctx', camNode.id, 'scene_ctx')
  }

  return {
    workflow: {
      ...workflow,
      nodes: [...workflow.nodes, newNode],
      edges: nextEdges
    },
    spawnedNode: newNode
  }
}

/**
 * Xác định phạm vi Phân cảnh (Shot ID) thực tế của một Node dựa trên:
 * 1) params.shotId gắn riêng trên Node đó
 * 2) params.shotId truyền xuống từ Node Nguồn Phân cảnh (#1 scene_shot) nối dây tới Node này
 * 3) workflow.targetShotId chung của quy trình
 */
export function resolveNodeShotScope(
  node: WorkflowNode,
  workflow: WorkflowGraph
): string | null {
  if (node.params?.shotId && node.params.shotId !== 'all') {
    return node.params.shotId
  }
  const sceneRootIds = new Set(
    workflow.nodes.filter((n) => n.type === 'scene_shot' && n.enabled).map((n) => n.id)
  )
  for (const e of workflow.edges) {
    if (e.toNode === node.id && sceneRootIds.has(e.fromNode)) {
      const src = workflow.nodes.find((n) => n.id === e.fromNode)
      if (src?.params?.shotId && src.params.shotId !== 'all') {
        return src.params.shotId
      }
    }
  }
  const primaryScene = workflow.nodes.find((n) => n.type === 'scene_shot' && n.enabled)
  if (primaryScene?.params?.shotId && primaryScene.params.shotId !== 'all') {
    return primaryScene.params.shotId
  }
  if (workflow.targetShotId && workflow.targetShotId !== 'all') {
    return workflow.targetShotId
  }
  return null
}

/**
 * Kiểm tra và chuẩn hóa dữ liệu JSON Workflow từ người dùng hoặc AI MCP.
 */
export function validateAndNormalizeWorkflowJson(raw: unknown): WorkflowGraph {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Dữ liệu Workflow JSON phải là một Object hợp lệ.')
  }
  const obj = parsed as Partial<WorkflowGraph>
  if (!Array.isArray(obj.nodes) || obj.nodes.length === 0) {
    throw new Error('Workflow JSON phải chứa mảng "nodes" không rỗng.')
  }

  const validTypes = new Set<string>(CANONICAL_NODE_ORDER)
  const validPorts = new Set<string>(Object.keys(WORKFLOW_PORT_SPECS))

  const nodes: WorkflowNode[] = obj.nodes.map((n, i) => {
    const type = (validTypes.has(n.type) ? n.type : CANONICAL_NODE_ORDER[i % CANONICAL_NODE_ORDER.length]) as WorkflowNodeType
    const spec = WORKFLOW_NODE_SPECS[type]
    const presetObj = spec.presets.find((p) => p.id === n.preset) ?? spec.presets[0]
    const defaultParts = getDefaultPartsForNode({ type, preset: presetObj.id })
    return {
      id: typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `wf-${type}`,
      type,
      title: typeof n.title === 'string' && n.title.trim() ? n.title.trim() : spec.title,
      enabled: typeof n.enabled === 'boolean' ? n.enabled : true,
      position:
        n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number'
          ? { x: Math.round(n.position.x), y: Math.round(n.position.y) }
          : { ...DEFAULT_NODE_POSITIONS[type] },
      preset: presetObj.id,
      aiAgentRole: spec.aiAgentRole,
      aiDirective:
        typeof n.aiDirective === 'string' && n.aiDirective.trim()
          ? n.aiDirective.trim()
          : presetObj.defaultDirective,
      params: {
        targetMode: 'auto',
        targetParts: defaultParts,
        ...presetObj.defaultParams,
        ...(n.params ?? {})
      }
    }
  })

  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges: WorkflowEdge[] = Array.isArray(obj.edges)
    ? obj.edges
        .filter(
          (e) =>
            e &&
            nodeIds.has(e.fromNode) &&
            nodeIds.has(e.toNode) &&
            validPorts.has(e.fromPort) &&
            validPorts.has(e.toPort)
        )
        .map((e, idx) => ({
          id: e.id || `edge-${e.fromNode}-${e.fromPort}-${e.toNode}-${idx}`,
          fromNode: e.fromNode,
          fromPort: e.fromPort as WorkflowPortKind,
          toNode: e.toNode,
          toPort: e.toPort as WorkflowPortKind
        }))
    : buildStandardEdges(nodes)

  return {
    version: 1,
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : 'wf-custom',
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'Quy trình Tạo Video Tùy chỉnh',
    presetId: obj.presetId,
    description:
      typeof obj.description === 'string' && obj.description.trim()
        ? obj.description.trim()
        : 'Quy trình Node-Port cấu hình kịch bản dựng cảnh và chuyển động 2.5D.',
    nodes,
    edges,
    lastAppliedAt: obj.lastAppliedAt
  }
}

