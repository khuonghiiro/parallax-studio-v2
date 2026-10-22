import type {
  Layer,
  Project,
  WorkflowBoundTarget,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowSubPartItem
} from '@shared/types'
import { isMouthLayer } from './lipSync'

export type LayerSemanticRole = 'sky' | 'foliage' | 'character' | 'ground' | 'prop'

export function classifyLayerRole(layer: Layer): LayerSemanticRole {
  const n = (layer.name || '').toLowerCase()
  if (layer.transform.rotation.value[0] <= -65) return 'ground'
  if (
    n.includes('sky') ||
    n.includes('trời') ||
    n.includes('cloud') ||
    n.includes('mây') ||
    n.includes('fog') ||
    n.includes('sương') ||
    layer.transform.position.value[2] >= 2200
  ) {
    return 'sky'
  }
  if (
    n.includes('tree') ||
    n.includes('cây') ||
    n.includes('bush') ||
    n.includes('bụi') ||
    n.includes('leaf') ||
    n.includes('lá') ||
    n.includes('flower') ||
    n.includes('hoa') ||
    n.includes('grass') ||
    n.includes('cỏ') ||
    n.includes('tán') ||
    n.includes('cành')
  ) {
    if (!n.includes('hero') && !n.includes('nhân vật') && !n.includes('character')) {
      return 'foliage'
    }
  }
  if (
    layer.composite ||
    n.includes('hero') ||
    n.includes('nhân vật') ||
    n.includes('character') ||
    n.includes('knight') ||
    n.includes('girl') ||
    n.includes('boy') ||
    n.includes('hiệp sĩ') ||
    n.includes('nữ') ||
    n.includes('nam')
  ) {
    return 'character'
  }
  return 'prop'
}

/**
 * Danh mục Bộ phận 2.5D / Khớp xương / Kênh tác động chuyên sâu cho từng loại Node
 * (Thiết kế theo chuẩn Control Rig / Geometry Nodes / Spine 2.5D)
 */
export const WORKFLOW_SUBPART_CATALOG: Record<
  WorkflowNodeType,
  Omit<WorkflowSubPartItem, 'active'>[]
> = {
  scene_shot: [
    {
      id: 'sky_horizon',
      label: 'Tầng Trời & Mây Xa (Z: 3200)',
      shortLabel: 'Trời Z:3200',
      icon: '☁️',
      category: 'space_z',
      description: 'Đẩy lớp nền bầu trời và mây xa về mặt phẳng Z sâu nhất để tạo nền thị sai.'
    },
    {
      id: 'mid_scenery',
      label: 'Trung cảnh & Rừng cây (Z: 600..1800)',
      shortLabel: 'Trung Z:800',
      icon: '🏞️',
      category: 'space_z',
      description: 'Giãn khoảng cách các lớp núi đồi, nhà cửa và cây cối ở tầng trung gian.'
    },
    {
      id: 'focal_plane',
      label: 'Mặt phẳng Chủ thể 2.5D (Z: 0)',
      shortLabel: 'Chủ thể Z:0',
      icon: '🎯',
      category: 'space_z',
      description: 'Cố định nhân vật chính và cụm 2.5D trung tâm tại mặt phẳng tiêu điểm Z = 0.'
    },
    {
      id: 'fg_frame',
      label: 'Tiền cảnh Cận Ống kính (Z: -120)',
      shortLabel: 'Tiền Z:-120',
      icon: '🌿',
      category: 'space_z',
      description: 'Đặt bụi cỏ, cành cây tiền cảnh sát trước ống kính để tạo chiều sâu Parallax mạnh.'
    },
    {
      id: 'ground_plane',
      label: 'Mặt đất 3D Phối cảnh (Ground -90°)',
      shortLabel: 'Mặt đất 3D',
      icon: '🟫',
      category: 'space_z',
      description: 'Tạo hoặc đồng bộ mặt phẳng sàn 3D nằm ngang đỡ dưới chân nhân vật & đạo cụ.'
    }
  ],

  layer_assembly: [
    {
      id: 'root_anchor',
      label: 'Gốc Neo Đáy [0, -0.5] & Billboard Y',
      shortLabel: 'Neo đáy',
      icon: '⚓',
      category: 'bone_25d',
      description: 'Đặt tâm xoay ở sát mặt đất [0, -0.5] và bật tự hướng thẳng đứng theo Camera.'
    },
    {
      id: 'head_expr',
      label: 'Đầu, Mắt & Khe Biểu cảm (Head/Face)',
      shortLabel: 'Đầu & Mắt',
      icon: '🎭',
      category: 'bone_25d',
      description: 'Liên kết bộ phận Đầu, Mắt và các biến thể biểu cảm khuôn mặt của nhân vật 2.5D.'
    },
    {
      id: 'hair_cape_25d',
      label: 'Tóc, Mũ & Tà áo 2.5D (Hair/Cape)',
      shortLabel: 'Tóc & Áo',
      icon: '🧣',
      category: 'bone_25d',
      description: 'Tách lớp Tóc, Áo choàng và phụ kiện mềm để nhận chuyển động vẩy trễ nhịp.'
    },
    {
      id: 'torso_core',
      label: 'Thân chính & Lồng ngực (Torso Core)',
      shortLabel: 'Thân & Ngực',
      icon: '🧍',
      category: 'bone_25d',
      description: 'Khớp xương cột sống trung tâm giữ liên kết cho Đầu và Tứ chi.'
    },
    {
      id: 'limbs_ik',
      label: 'Tay Trái/Phải & Chân IK (Arms/Legs)',
      shortLabel: 'Tay/Chân IK',
      icon: '🦾',
      category: 'bone_25d',
      description: 'Các lớp Cánh tay, Bàn tay, Đùi và Bàn chân phục vụ diễn hoạt bước đi/hành động.'
    },
    {
      id: 'foliage_trunk',
      label: 'Gốc Thân cây & Tán lá Đa lớp 2.5D',
      shortLabel: 'Thân & Lá',
      icon: '🌳',
      category: 'bone_25d',
      description: 'Cấu trúc xương thân cây (Plant Spine) và các cụm vòm lá xếp lớp 2.5D.'
    },
    {
      id: 'arch_faces_3d',
      label: 'Khối Mặt Tường & Mái Kiến trúc 3D',
      shortLabel: 'Khối Mặt 3D',
      icon: '🏛️',
      category: 'bone_25d',
      description: 'Giữ nguyên góc xoay 3 chiều của các mặt tường, mái nhà và đạo cụ hộp 3D.'
    }
  ],

  motion_choreography: [
    {
      id: 'torso_breathe',
      label: 'Ngực & Thân Nhịp thở (Float/Pulse)',
      shortLabel: 'Thân Thở',
      icon: '🫁',
      category: 'bone_25d',
      description: 'Chuyển động phập phồng nhịp thở tự nhiên cho thân và lồng ngực nhân vật.'
    },
    {
      id: 'legs_stride',
      label: 'Chân Bước đi & Quỹ đạo Chiều sâu Z',
      shortLabel: 'Chân Bước Z',
      icon: '🦵',
      category: 'bone_25d',
      description: 'Di chuyển cụm nhân vật tiến sâu vào cảnh hoặc bật nhảy theo quỹ đạo Parabol.'
    },
    {
      id: 'arms_gesture',
      label: 'Tay Vung & Cử chỉ Động tác (Arms)',
      shortLabel: 'Tay Cử chỉ',
      icon: '💪',
      category: 'bone_25d',
      description: 'Phối hợp nhịp vung tay và vũ khí theo chu kỳ bước chân hoặc đòn đánh.'
    },
    {
      id: 'hair_cloth_sway',
      label: 'Tóc & Vạt áo Bay trễ nhịp (Sway)',
      shortLabel: 'Tóc/Áo Bay',
      icon: '🌬️',
      category: 'bone_25d',
      description: 'Chuyển động thứ cấp (Secondary Motion) uốn lượn cho mái tóc và tà áo.'
    },
    {
      id: 'canopy_wind',
      label: 'Tán lá & Cành Đung đưa Gió (Wind)',
      shortLabel: 'Tán lá Gió',
      icon: '🍃',
      category: 'bone_25d',
      description: 'Gió thổi nghiêng ngả tự nhiên lên các lớp tán lá, cành cây và bụi cỏ.'
    },
    {
      id: 'sky_cloud_drift',
      label: 'Mây & Sương Trôi Ngang (Drift)',
      shortLabel: 'Mây Trôi',
      icon: '☁️',
      category: 'space_z',
      description: 'Chuyển động trôi ngang chậm rãi liên tục cho bầu trời mây và lớp sương.'
    }
  ],

  physics_fx: [
    {
      id: 'soft_mesh_jiggle',
      label: 'Lưới Mesh 2.5D Đàn hồi (Tóc/Áo/Lá/Thạch)',
      shortLabel: 'Mesh 2.5D',
      icon: '🧬',
      category: 'mesh_physics',
      description: 'Biến dạng đàn hồi lò xo (Spring/Jiggle) trên lưới ảnh 2.5D khi di chuyển hoặc va chạm.'
    },
    {
      id: 'virtual_light_core',
      label: 'Tâm Nguồn sáng Ảo 2.5D (Nến/Đèn pin)',
      shortLabel: 'Ánh sáng Ảo',
      icon: '🕯️',
      category: 'light_fx',
      description: 'Ánh nến chập chờn nhạy theo gió hoặc chùm đèn pin hình nón chiếu sáng các layer lân cận.'
    },
    {
      id: 'rim_glow_silhouette',
      label: 'Viền Alpha Silhouette Glow (Hắt sáng)',
      shortLabel: 'Viền Glow',
      icon: '✨',
      category: 'light_fx',
      description: 'Phát sáng viền ôm sát đường bao Alpha của nhân vật hoặc vật thể trung tâm.'
    },
    {
      id: 'cave_depth_portal',
      label: 'Cửa Hang Độ Sâu UV (Depth Portal)',
      shortLabel: 'Cửa Hang UV',
      icon: '🕳️',
      category: 'mesh_physics',
      description: 'Tự động thu nhỏ tỷ lệ và phủ bóng tối khi nhân vật đi sâu vào vùng UV cửa hang.'
    },
    {
      id: 'collider_zone',
      label: 'Vùng Va chạm Sub-Mesh (Tay/Chân/Thân)',
      shortLabel: 'Va chạm Z',
      icon: '💥',
      category: 'mesh_physics',
      description: 'Xét tương tác va chạm theo độ sâu Z giữa nắm đấm/mũi chân và vật thể mục tiêu.'
    },
    {
      id: 'firefly_particles',
      label: 'Lớp Hạt Đom đóm & Bụi sáng 3D',
      shortLabel: 'Hạt Đom đóm',
      icon: '🪄',
      category: 'light_fx',
      description: 'Sinh lớp hạt phát sáng lơ lửng trong không gian 3D của phân cảnh.'
    }
  ],

  camera_director: [
    {
      id: 'spline_eye_path',
      label: 'Quỹ đạo Thân Máy 3D (Eye Spline Path)',
      shortLabel: 'Đường bay 3D',
      icon: '🎥',
      category: 'camera_rig',
      description: 'Nội suy đường cong Catmull-Rom mượt mà cho vị trí máy quay qua các Shot.'
    },
    {
      id: 'lookat_target',
      label: 'Tâm Nhìn Khóa Chủ thể 2.5D (LookAt)',
      shortLabel: 'Khóa Tâm',
      icon: '🎯',
      category: 'camera_rig',
      description: 'Giữ hướng nhìn của Camera luôn bám theo nhân vật hoặc tâm phân cảnh.'
    },
    {
      id: 'dof_aperture',
      label: 'Thấu kính Xóa phông DOF theo Layer',
      shortLabel: 'Xóa phông',
      icon: '🔍',
      category: 'camera_rig',
      description: 'Lấy nét sắc tại mặt phẳng chủ thể và làm mờ tự nhiên tiền cảnh/hậu cảnh.'
    },
    {
      id: 'fov_dolly_zoom',
      label: 'Tiêu cự FOV & Đẩy Cận Dolly Push-in',
      shortLabel: 'Dolly & FOV',
      icon: '📐',
      category: 'camera_rig',
      description: 'Đẩy máy tiến gần chủ thể để phô diễn hiệu ứng trượt thị sai Parallax 2.5D.'
    },
    {
      id: 'handheld_rig',
      label: 'Giàn Rung Máy Tự nhiên (Handheld Shake)',
      shortLabel: 'Rung Máy',
      icon: '📳',
      category: 'camera_rig',
      description: 'Dao động tần số thấp mô phỏng máy quay cầm tay sống động.'
    }
  ],

  audio_lipsync: [
    {
      id: 'mouth_viseme_25d',
      label: 'Layer Khẩu hình Miệng 2.5D (Lip-Sync)',
      shortLabel: 'Miệng Thoại',
      icon: '👄',
      category: 'voice_mouth',
      description: 'Tự động đóng/mở layer Miệng của nhân vật 2.5D theo biên độ sóng âm giọng thoại.'
    },
    {
      id: 'jaw_head_nod',
      label: 'Nhịp Cằm & Đầu theo Giọng nói',
      shortLabel: 'Nhịp Cằm',
      icon: '🗣️',
      category: 'voice_mouth',
      description: 'Tạo độ nhún nhẹ tự nhiên cho phần đầu/cằm khi nhân vật phát âm.'
    },
    {
      id: 'vocal_eq_chain',
      label: 'Kênh Thoại Nhân vật (Vocal EQ Focus)',
      shortLabel: 'EQ Giọng',
      icon: '🎙️',
      category: 'voice_mouth',
      description: 'Tối ưu dải tần giọng nói rõ nét và gắn trực tiếp vào thực thể nhân vật.'
    },
    {
      id: 'bgm_envelope',
      label: 'Nhạc nền & Ambience (Warm EQ + Fade)',
      shortLabel: 'Nhạc nền',
      icon: '🎵',
      category: 'voice_mouth',
      description: 'Áp bộ lọc âm sắc ấm (Warm) và tự động Fade-in / Fade-out đầu cuối cảnh.'
    }
  ],

  look_output: [
    {
      id: 'z_depth_fog',
      label: 'Sương mù Chiều sâu 3D (Z-Depth Fog)',
      shortLabel: 'Sương 3D',
      icon: '🌫️',
      category: 'color_out',
      description: 'Phủ lớp sương mù khí quyển dày dần theo khoảng cách trục Z.'
    },
    {
      id: 'color_grade_lut',
      label: 'Chỉnh màu Contrast / Saturation / Exposure',
      shortLabel: 'Chỉnh màu',
      icon: '🎨',
      category: 'color_out',
      description: 'Cân chỉnh độ tương phản, độ rực màu và phơi sáng toàn khung hình.'
    },
    {
      id: 'lens_vignette_grain',
      label: 'Viền tối Quang học Vignette & Film Grain',
      shortLabel: 'Vignette',
      icon: '🎞️',
      category: 'color_out',
      description: 'Bo tối nhẹ bốn góc khung hình để tập trung thị giác vào tâm cảnh.'
    },
    {
      id: 'mp4_master_out',
      label: 'Luồng Xuất bản Video MP4 60fps',
      shortLabel: 'Xuất MP4',
      icon: '🎬',
      category: 'color_out',
      description: 'Tổng hợp toàn bộ pipeline 2.5D/3D + Audio sẵn sàng render ra MP4.'
    }
  ],

  layer_transform: [
    {
      id: 'transform_pos_xyz',
      label: 'Tọa độ Không gian 3D (X, Y, Z)',
      shortLabel: 'Tọa độ XYZ',
      icon: '📍',
      category: 'mesh_physics',
      description: 'Điều khiển vị trí 3 trục X, Y và Z của layer trong không gian 2.5D.'
    },
    {
      id: 'transform_rotation',
      label: 'Góc xoay Hướng (Roll / Yaw / Pitch)',
      shortLabel: 'Góc xoay',
      icon: '🔄',
      category: 'mesh_physics',
      description: 'Điều khiển góc xoay hướng của layer theo không gian 2.5D.'
    }
  ]
}

export const DEFAULT_PRESET_SUBPARTS: Record<string, string[]> = {
  // 1. scene_shot
  deep_parallax_stage: ['sky_horizon', 'mid_scenery', 'focal_plane', 'fg_frame'],
  grounded_3d_stage: ['sky_horizon', 'mid_scenery', 'focal_plane', 'ground_plane'],
  intimate_portrait_stage: ['mid_scenery', 'focal_plane', 'fg_frame'],

  // 2. layer_assembly
  character_and_foliage_rig: ['root_anchor', 'head_expr', 'hair_cape_25d', 'torso_core', 'foliage_trunk'],
  arch3d_and_props: ['arch_faces_3d', 'root_anchor', 'foliage_trunk'],
  expr_variant_actors: ['root_anchor', 'head_expr', 'hair_cape_25d', 'torso_core', 'limbs_ik'],

  // 3. motion_choreography
  organic_wind_breathe: ['torso_breathe', 'hair_cloth_sway', 'canopy_wind', 'sky_cloud_drift'],
  character_walk_depth: ['legs_stride', 'arms_gesture', 'torso_breathe', 'canopy_wind'],
  dynamic_action_arc: ['legs_stride', 'arms_gesture', 'hair_cloth_sway', 'torso_breathe'],

  // 4. physics_fx
  candle_wind_particles: ['virtual_light_core', 'soft_mesh_jiggle', 'firefly_particles'],
  combat_elastic_glow: ['soft_mesh_jiggle', 'collider_zone', 'rim_glow_silhouette'],
  cave_portal_flashlight: ['cave_depth_portal', 'virtual_light_core', 'firefly_particles'],

  // 5. camera_director (Tắt dof_aperture mặc định để ảnh Camera 3D sắc nét 100% đồng nhất với Cam 2D)
  cinematic_fly_push: ['spline_eye_path', 'lookat_target', 'fov_dolly_zoom'],
  dolly_push_focus: ['fov_dolly_zoom', 'lookat_target'],
  orbit_showcase_3d: ['spline_eye_path', 'lookat_target', 'handheld_rig'],
  dramatic_handheld_action: ['fov_dolly_zoom', 'handheld_rig'],

  // 6. audio_lipsync
  voice_lipsync_bgm: ['mouth_viseme_25d', 'jaw_head_nod', 'vocal_eq_chain', 'bgm_envelope'],
  cinematic_bgm_ambience: ['bgm_envelope', 'vocal_eq_chain'],

  // 7. look_output
  cinematic_atmospheric_fog: ['z_depth_fog', 'color_grade_lut', 'lens_vignette_grain', 'mp4_master_out'],
  mystic_night_glow: ['z_depth_fog', 'color_grade_lut', 'lens_vignette_grain', 'mp4_master_out'],
  vibrant_anime_clean: ['color_grade_lut', 'lens_vignette_grain', 'mp4_master_out'],

  // 8. layer_transform
  layer_transform_controller: ['transform_pos_xyz', 'transform_rotation']
}

export function getDefaultPartsForNode(node: Pick<WorkflowNode, 'type' | 'preset'>): string[] {
  const fromPreset = DEFAULT_PRESET_SUBPARTS[node.preset]
  if (fromPreset && fromPreset.length > 0) return [...fromPreset]
  return WORKFLOW_SUBPART_CATALOG[node.type]?.map((p) => p.id) ?? []
}

export function getNodeSubParts(node: WorkflowNode): WorkflowSubPartItem[] {
  const catalog = WORKFLOW_SUBPART_CATALOG[node.type] ?? []
  const activeIds = new Set(
    node.params?.targetParts !== undefined
      ? node.params.targetParts
      : getDefaultPartsForNode(node)
  )
  return catalog.map((item) => ({
    ...item,
    active: activeIds.has(item.id)
  }))
}

/**
 * Quét toàn bộ Project hiện tại và trích xuất danh sách các Thực thể (Cụm 2.5D Composite,
 * Mô hình 3D, Layer ảnh 2.5D đơn lẻ, Mặt đất 3D, Hạt FX) có thể gắn vào các Node Workflow.
 */
export function listProjectBindableTargets(project?: Project, shotFilter?: string | null): WorkflowBoundTarget[] {
  if (!project) return []
  const activeShotFilter = shotFilter && shotFilter !== 'all' ? shotFilter : null
  const results: WorkflowBoundTarget[] = []
  const compositeGroups = new Map<string, Layer[]>()
  const model3dGroups = new Map<string, Layer[]>()
  const standaloneLayers: Layer[] = []

  for (const l of project.layers) {
    if (activeShotFilter && l.shotId && l.shotId !== activeShotFilter) continue
    if (l.composite?.instanceId) {
      const list = compositeGroups.get(l.composite.instanceId) ?? []
      list.push(l)
      compositeGroups.set(l.composite.instanceId, list)
    } else if (l.model3d?.instanceId) {
      const list = model3dGroups.get(l.model3d.instanceId) ?? []
      list.push(l)
      model3dGroups.set(l.model3d.instanceId, list)
    } else {
      standaloneLayers.push(l)
    }
  }

  for (const [instanceId, members] of compositeGroups.entries()) {
    const root = members.find((m) => m.composite?.isRoot) ?? members[0]
    const compName = root.composite?.compositeName || root.name || 'Cụm 2.5D'
    const zDepth = Math.round(
      root.composite?.centerPosition?.[2] ?? root.transform.position.value[2] ?? 0
    )
    const partNames = members
      .map((m) => {
        if (m.composite?.partGroupId) return m.composite.partGroupId.replace(/^part-/, '')
        if (m.composite?.slot) return m.composite.slot
        return m.name.replace(compName, '').replace(/^[\s\-–_:]+/, '').trim() || m.name
      })
      .filter(Boolean)
      .slice(0, 6)

    results.push({
      id: instanceId,
      name: compName,
      kind: 'composite_25d',
      roleLabel: `Cụm 2.5D (${members.length} lớp · Z:${zDepth})`,
      zDepth,
      subLayerCount: members.length,
      partNames
    })
  }

  for (const [instanceId, members] of model3dGroups.entries()) {
    const first = members[0]
    const modelName = first.model3d?.modelName || first.name || 'Mô hình 3D'
    const zDepth = Math.round(
      first.model3d?.centerPosition?.[2] ?? first.transform.position.value[2] ?? 0
    )
    const partNames = members.map((m) => m.model3d?.faceId || m.name).slice(0, 5)
    results.push({
      id: instanceId,
      name: modelName,
      kind: 'model_3d',
      roleLabel: `Khối 3D (${members.length} mặt · Z:${zDepth})`,
      zDepth,
      subLayerCount: members.length,
      partNames
    })
  }

  for (const l of standaloneLayers) {
    const zDepth = Math.round(l.transform.position.value[2] ?? 0)
    const role = classifyLayerRole(l)
    if (l.type === 'particles') {
      results.push({
        id: l.id,
        name: l.name,
        kind: 'particles',
        roleLabel: `Hạt 3D (Z:${zDepth})`,
        zDepth,
        partNames: ['Hạt phát sáng']
      })
    } else if (role === 'ground') {
      results.push({
        id: l.id,
        name: l.name,
        kind: 'ground_3d',
        roleLabel: `Mặt đất 3D (Y:${Math.round(l.transform.position.value[1])})`,
        zDepth,
        partNames: ['Sàn phối cảnh -90°']
      })
    } else {
      const roleVi =
        role === 'sky'
          ? 'Trời/Mây'
          : role === 'foliage'
            ? 'Cây cối 2.5D'
            : role === 'character'
              ? 'Nhân vật 2.5D'
              : 'Lớp Cảnh 2.5D'
      const detectedParts: string[] = [roleVi]
      if (l.mesh) detectedParts.push('Lưới Mesh 2.5D')
      if (l.virtualLight?.enabled) detectedParts.push(`Đèn ảo (${l.virtualLight.kind})`)
      if (l.physics?.enabled) detectedParts.push(`Vật lý (${l.physics.material})`)
      if (isMouthLayer(l)) detectedParts.push('Khẩu hình Miệng')

      results.push({
        id: l.id,
        name: l.name,
        kind: 'image_25d',
        roleLabel: `${roleVi} · Z:${zDepth}`,
        zDepth,
        partNames: detectedParts
      })
    }
  }

  return results
}

export interface ResolvedNodeBinding {
  mode: 'auto' | 'custom'
  boundTargets: WorkflowBoundTarget[]
  allBindableTargets: WorkflowBoundTarget[]
  subParts: WorkflowSubPartItem[]
  activeParts: WorkflowSubPartItem[]
  matchesLayer: (layer: Layer) => boolean
}

/**
 * Giải quyết danh sách Thực thể Layer / 2.5D Composite và Bộ phận tác động cho một Node cụ thể.
 */
export function resolveNodeTargetBinding(
  node: WorkflowNode,
  project?: Project
): ResolvedNodeBinding {
  const subParts = getNodeSubParts(node)
  const activeParts = subParts.filter((p) => p.active)
  const rawShotScope = node.params?.shotId || project?.workflow?.targetShotId
  const shotFilter = rawShotScope && rawShotScope !== 'all' ? rawShotScope : null
  const allBindable = listProjectBindableTargets(project, shotFilter)

  const customIds = node.params?.targetLayerIds ?? []
  const isCustom = node.params?.targetMode === 'custom'
  const customSet = new Set(customIds)

  const matchesLayer = (layer: Layer): boolean => {
    if (shotFilter && layer.shotId && layer.shotId !== shotFilter) return false
    if (!isCustom) return true
    if (customSet.has(layer.id)) return true
    if (layer.composite?.instanceId && customSet.has(layer.composite.instanceId)) return true
    if (layer.model3d?.instanceId && customSet.has(layer.model3d.instanceId)) return true
    return false
  }

  if (!project) {
    return {
      mode: isCustom ? 'custom' : 'auto',
      boundTargets: getFallbackTargetsWhenNoProject(node),
      allBindableTargets: [],
      subParts,
      activeParts,
      matchesLayer
    }
  }

  if (isCustom) {
    const explicit = allBindable
      .filter((t) => customSet.has(t.id))
      .map((t) => ({ ...t, isExplicit: true }))
    return {
      mode: 'custom',
      boundTargets: explicit,
      allBindableTargets: allBindable,
      subParts,
      activeParts,
      matchesLayer
    }
  }

  // Chế độ Tự động (Auto): chọn các thực thể phù hợp với bản chất chuyên môn của Node
  let autoTargets: WorkflowBoundTarget[] = []

  if (node.type === 'scene_shot') {
    const scopedShots = shotFilter ? project.shots.filter((s) => s.id === shotFilter) : project.shots
    const shotTargets: WorkflowBoundTarget[] = scopedShots.map((s) => ({
      id: s.id,
      name: s.name,
      kind: 'shot',
      roleLabel: 'Phân cảnh 3D'
    }))
    autoTargets = [...shotTargets, ...allBindable.filter((t) => t.kind !== 'particles')]
  } else if (node.type === 'layer_assembly') {
    const compositesAndModels = allBindable.filter(
      (t) => t.kind === 'composite_25d' || t.kind === 'model_3d'
    )
    const charOrFoliage = allBindable.filter(
      (t) =>
        t.kind === 'image_25d' &&
        (t.roleLabel.includes('Nhân vật') || t.roleLabel.includes('Cây cối'))
    )
    autoTargets =
      compositesAndModels.length + charOrFoliage.length > 0
        ? [...compositesAndModels, ...charOrFoliage]
        : allBindable.filter((t) => t.kind === 'image_25d')
  } else if (node.type === 'motion_choreography') {
    const composites = allBindable.filter((t) => t.kind === 'composite_25d')
    const images = allBindable.filter((t) => t.kind === 'image_25d')
    autoTargets = [...composites, ...images]
  } else if (node.type === 'physics_fx') {
    const particlesAndComposites = allBindable.filter(
      (t) => t.kind === 'particles' || t.kind === 'composite_25d'
    )
    const images = allBindable.filter((t) => t.kind === 'image_25d')
    const primary = [...particlesAndComposites, ...images]
    autoTargets = primary.length > 0 ? primary : allBindable
  } else if (node.type === 'camera_director') {
    const focalEntity =
      allBindable.find((t) => t.kind === 'composite_25d') ??
      allBindable.find((t) => t.roleLabel.includes('Nhân vật')) ??
      allBindable.find((t) => t.zDepth === 0) ??
      allBindable[0]
    autoTargets = [
      {
        id: 'main-camera-3d',
        name: `Camera 3D (${project.shots.length || 1} Shot)`,
        kind: 'camera_3d',
        roleLabel: project.camera.dofEnabled ? 'Perspective + DOF' : 'Perspective 3D'
      },
      ...(focalEntity ? [{ ...focalEntity, roleLabel: `Tiêu điểm lấy nét · ${focalEntity.roleLabel}` }] : [])
    ]
  } else if (node.type === 'audio_lipsync') {
    const tracks = project.audioTracks ?? []
    const charEntity =
      allBindable.find((t) => t.kind === 'composite_25d') ??
      allBindable.find((t) => t.roleLabel.includes('Nhân vật'))
    const trackTargets: WorkflowBoundTarget[] = tracks.map((tr) => ({
      id: tr.id,
      name: tr.name || 'Track Âm thanh',
      kind: 'audio_track',
      roleLabel: tr.lipSyncEnabled ? 'Thoại + Lip-Sync' : 'Âm thanh / BGM'
    }))
    autoTargets = [
      ...(charEntity ? [charEntity] : []),
      ...trackTargets
    ]
    if (autoTargets.length === 0) {
      autoTargets = [
        {
          id: 'audio-bus-ready',
          name: 'Kênh Thoại & BGM (Sẵn sàng)',
          kind: 'audio_track',
          roleLabel: 'Tự gắn khi thêm Audio'
        }
      ]
    }
  } else if (node.type === 'look_output') {
    autoTargets = [
      {
        id: 'master-comp-look',
        name: `${project.comp.name} (${project.comp.width}×${project.comp.height})`,
        kind: 'look_post',
        roleLabel: `${project.comp.fps}fps · ${project.layers.length} Layer`
      }
    ]
  }

  return {
    mode: 'auto',
    boundTargets: autoTargets.length > 0 ? autoTargets : getFallbackTargetsWhenNoProject(node),
    allBindableTargets: allBindable,
    subParts,
    activeParts,
    matchesLayer
  }
}

function getFallbackTargetsWhenNoProject(node: WorkflowNode): WorkflowBoundTarget[] {
  if (node.type === 'scene_shot') {
    return [
      { id: 'auto-shots', name: 'Mọi Shot & Layer Cảnh', kind: 'shot', roleLabel: 'Phân tầng Z tự động' }
    ]
  }
  if (node.type === 'layer_assembly') {
    return [
      { id: 'auto-rig', name: 'Cụm Nhân vật & Cây 2.5D', kind: 'composite_25d', roleLabel: 'Tự nhận diện Composite' }
    ]
  }
  if (node.type === 'motion_choreography') {
    return [
      { id: 'auto-motion', name: 'Nhân vật, Cây & Mây', kind: 'composite_25d', roleLabel: 'Hoạt họa 2.5D' }
    ]
  }
  if (node.type === 'physics_fx') {
    return [
      { id: 'auto-fx', name: 'Chủ thể 2.5D & Hạt FX', kind: 'particles', roleLabel: 'Mesh + Ánh sáng Ảo' }
    ]
  }
  if (node.type === 'camera_director') {
    return [
      { id: 'auto-cam', name: 'Camera 3D & Chủ thể Z:0', kind: 'camera_3d', roleLabel: 'Spline 3D + DOF' }
    ]
  }
  if (node.type === 'audio_lipsync') {
    return [
      { id: 'auto-audio', name: 'Nhân vật & Track Thoại', kind: 'audio_track', roleLabel: 'Lip-Sync + BGM' }
    ]
  }
  return [
    { id: 'auto-out', name: 'Khung hình Master MP4', kind: 'look_post', roleLabel: '3D Fog + Color Grade' }
  ]
}
