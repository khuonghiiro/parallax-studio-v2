import type {
  Layer,
  Project,
  WorkflowCustomActionKind,
  WorkflowCustomActionRule,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType
} from '@shared/types'
import { generatePresetSpatialTracks, type MotionPresetId } from '../animation/motionPresets'
import { applyMotionTracksToGroup, findMotionTargetGroup } from '../animation/motionEngine'
import { classifyLayerRole, getDefaultPartsForNode } from './workflowTargets'

export interface CustomActionCatalogItem {
  kind: WorkflowCustomActionKind
  label: string
  shortLabel: string
  icon: string
  nodeTypes: WorkflowNodeType[]
  defaultSpeed: number
  defaultAmount: number
  description: string
}

export const WORKFLOW_CUSTOM_ACTION_CATALOG: CustomActionCatalogItem[] = [
  {
    kind: 'wind',
    label: 'Gió thổi đung đưa (Wind 2.5D)',
    shortLabel: 'Gió Wind',
    icon: '🍃',
    nodeTypes: ['motion_choreography'],
    defaultSpeed: 0.9,
    defaultAmount: 1.0,
    description: 'Tạo chuyển động gió thổi nghiêng ngả tự nhiên cho cây cối, bụi cỏ, tán lá.'
  },
  {
    kind: 'drift',
    label: 'Trôi ngang liên tục (Cloud/Fog Drift)',
    shortLabel: 'Trôi Drift',
    icon: '☁️',
    nodeTypes: ['motion_choreography'],
    defaultSpeed: 18,
    defaultAmount: 0.9,
    description: 'Di chuyển trôi ngang mượt mà cho mây, sương mù hoặc lớp nền xa.'
  },
  {
    kind: 'float',
    label: 'Nhịp thở phập phồng (Float/Breathe)',
    shortLabel: 'Nhịp thở',
    icon: '🫁',
    nodeTypes: ['motion_choreography'],
    defaultSpeed: 0.75,
    defaultAmount: 0.85,
    description: 'Chuyển động nhấp nhô nhịp thở sống động cho nhân vật hoặc vật thể bay.'
  },
  {
    kind: 'sway',
    label: 'Lắc lư mềm mại (Pendulum Sway)',
    shortLabel: 'Lắc lư',
    icon: '🌬️',
    nodeTypes: ['motion_choreography'],
    defaultSpeed: 0.8,
    defaultAmount: 0.9,
    description: 'Đung đưa qua lại quanh điểm neo (phù hợp tóc, tà áo, đèn lồng, cành hoa).'
  },
  {
    kind: 'pulse',
    label: 'Đập nhịp co giãn (Scale Pulse)',
    shortLabel: 'Đập nhịp',
    icon: '💓',
    nodeTypes: ['motion_choreography'],
    defaultSpeed: 1.1,
    defaultAmount: 0.8,
    description: 'Co giãn nhẹ theo nhịp để tạo điểm nhấn sinh động cho chủ thể hoặc hiệu ứng.'
  },
  {
    kind: 'spin',
    label: 'Xoay tròn liên tục (Spin Z)',
    shortLabel: 'Xoay Spin',
    icon: '🔄',
    nodeTypes: ['motion_choreography'],
    defaultSpeed: 25,
    defaultAmount: 1.0,
    description: 'Xoay đều quanh tâm (phù hợp bánh xe, vòng phép thuật, mặt trời, cối xay).'
  },
  {
    kind: 'walk_into_depth',
    label: 'Bước đi tiến vào chiều sâu Z (Walk Depth)',
    shortLabel: 'Bước đi Z',
    icon: '🚶',
    nodeTypes: ['motion_choreography'],
    defaultSpeed: 1.0,
    defaultAmount: 1.0,
    description: 'Tạo chuỗi Keyframe di chuyển nhân vật tiến sâu vào không gian 2.5D.'
  },
  {
    kind: 'jump_arc',
    label: 'Bật nhảy quỹ đạo Parabol (Jump Arc)',
    shortLabel: 'Nhảy Arc',
    icon: '⚡',
    nodeTypes: ['motion_choreography'],
    defaultSpeed: 1.2,
    defaultAmount: 1.1,
    description: 'Tạo quỹ đạo bật nhảy hành động kịch tính cho nhân vật hoặc sinh vật.'
  },
  {
    kind: 'cross_screen',
    label: 'Di chuyển ngang khung hình (Cross Screen)',
    shortLabel: 'Đi ngang',
    icon: '🏃',
    nodeTypes: ['motion_choreography'],
    defaultSpeed: 1.0,
    defaultAmount: 1.0,
    description: 'Di chuyển thực thể băng ngang qua phân cảnh kết hợp nhịp bước tự nhiên.'
  },
  {
    kind: 'emerge_from_depth',
    label: 'Lao từ xa tới cận cảnh (Emerge Depth)',
    shortLabel: 'Lao tới Z',
    icon: '🦅',
    nodeTypes: ['motion_choreography'],
    defaultSpeed: 1.1,
    defaultAmount: 1.0,
    description: 'Di chuyển từ tầng Z sâu tiến ra tiền cảnh tạo hiệu ứng thị sai mạnh.'
  },
  {
    kind: 'virtual_light_candle',
    label: 'Đèn nến / Lửa trại nhạy gió (Virtual Candle)',
    shortLabel: 'Đèn nến',
    icon: '🕯️',
    nodeTypes: ['physics_fx', 'motion_choreography'],
    defaultSpeed: 1.4,
    defaultAmount: 1.2,
    description: 'Gắn nguồn sáng ấm lung linh nhạy theo gió chiếu lên các lớp xung quanh.'
  },
  {
    kind: 'virtual_light_flashlight',
    label: 'Đèn pin chiếu góc hình nón (Flashlight)',
    shortLabel: 'Đèn pin',
    icon: '🔦',
    nodeTypes: ['physics_fx', 'motion_choreography'],
    defaultSpeed: 0.6,
    defaultAmount: 1.4,
    description: 'Gắn chùm sáng định hướng hình nón làm nổi bật chiều sâu trong cảnh tối.'
  },
  {
    kind: 'rim_glow',
    label: 'Phát sáng viền Alpha (Silhouette Glow)',
    shortLabel: 'Viền Glow',
    icon: '✨',
    nodeTypes: ['physics_fx', 'motion_choreography'],
    defaultSpeed: 1.6,
    defaultAmount: 1.2,
    description: 'Tạo viền sáng neon ôm sát đường bao trong suốt Alpha của layer.'
  },
  {
    kind: 'mesh_elastic',
    label: 'Lưới Mesh 2.5D đàn hồi va chạm (Elastic Mesh)',
    shortLabel: 'Đàn hồi',
    icon: '🧬',
    nodeTypes: ['physics_fx', 'motion_choreography'],
    defaultSpeed: 1.2,
    defaultAmount: 1.15,
    description: 'Bật biến dạng lò xo đàn hồi trên lưới ảnh 2.5D khi di chuyển hoặc va chạm.'
  }
]

export function getCustomActionSpec(
  kind: WorkflowCustomActionKind
): CustomActionCatalogItem | undefined {
  return WORKFLOW_CUSTOM_ACTION_CATALOG.find((item) => item.kind === kind)
}

/**
 * Thực thi các quy tắc Chuyển động / Tính năng tùy chỉnh (customRules) do người dùng thêm vào Node.
 */
export function applyCustomNodeRulesToProject(
  project: Project,
  node: WorkflowNode,
  matchesNodeBinding: (layer: Layer) => boolean
): number {
  const rules = (node.params?.customRules ?? []).filter(
    (r) => r.enabled && !r.id.startsWith('inspector-')
  )
  if (rules.length === 0) return 0

  let affected = 0
  for (const rule of rules) {
    const speed = Math.max(0.1, rule.speed ?? 1.0)
    const amount = Math.max(0.1, rule.amount ?? 1.0)

    const targetLayers = project.layers.filter((l) => {
      if (l.locked || l.type === 'solid') return false
      if (rule.targetId === 'all') return matchesNodeBinding(l)
      return (
        l.id === rule.targetId ||
        l.composite?.instanceId === rule.targetId ||
        l.model3d?.instanceId === rule.targetId
      )
    })

    if (targetLayers.length === 0) continue

    if (
      rule.actionKind === 'wind' ||
      rule.actionKind === 'drift' ||
      rule.actionKind === 'float' ||
      rule.actionKind === 'sway' ||
      rule.actionKind === 'pulse' ||
      rule.actionKind === 'spin'
    ) {
      for (const l of targetLayers) {
        if (rule.actionKind === 'drift') {
          l.motion = {
            enabled: true,
            type: 'drift',
            speed: Math.round(speed > 3 ? speed : 18 * speed),
            direction: 'right',
            loopMode: 'ping-pong',
            amount: Number(Math.min(1, 0.85 * amount).toFixed(2))
          }
        } else if (rule.actionKind === 'wind') {
          l.motion = {
            enabled: true,
            type: 'wind',
            speed: Number((0.85 * speed).toFixed(2)),
            amplitude: [Math.round(10 * amount), Math.round(4 * amount), 3],
            amount: Number(Math.min(1, 0.9 * amount).toFixed(2))
          }
        } else if (rule.actionKind === 'sway') {
          l.motion = {
            enabled: true,
            type: 'sway',
            speed: Number((0.8 * speed).toFixed(2)),
            amplitude: [Math.round(8 * amount), Math.round(3 * amount), 4],
            amount: Number(Math.min(1, 0.85 * amount).toFixed(2))
          }
        } else if (rule.actionKind === 'pulse') {
          l.motion = {
            enabled: true,
            type: 'pulse',
            speed: Number((1.1 * speed).toFixed(2)),
            amplitude: [Math.round(6 * amount), Math.round(6 * amount), 0],
            amount: Number(Math.min(1, 0.8 * amount).toFixed(2))
          }
        } else if (rule.actionKind === 'spin') {
          l.motion = {
            enabled: true,
            type: 'spin',
            speed: Math.round(speed > 3 ? speed : 25 * speed),
            amount: Number(Math.min(1, amount).toFixed(2))
          }
        } else {
          l.motion = {
            enabled: true,
            type: 'float',
            speed: Number((0.75 * speed).toFixed(2)),
            amplitude: [3, Math.round(7 * amount), 0],
            amount: Number(Math.min(1, 0.8 * amount).toFixed(2))
          }
        }
        affected++
      }
    } else if (
      rule.actionKind === 'walk_into_depth' ||
      rule.actionKind === 'jump_arc' ||
      rule.actionKind === 'cross_screen' ||
      rule.actionKind === 'emerge_from_depth'
    ) {
      const first = targetLayers[0]
      const groupId = first.composite?.instanceId || first.model3d?.instanceId || first.id
      const group = findMotionTargetGroup(project, groupId)
      if (group && group.layers.length > 0) {
        const tracks = generatePresetSpatialTracks(
          rule.actionKind as MotionPresetId,
          {
            position: group.centerPosition,
            rotation: group.layers[0].transform.rotation.value,
            scale: [1, 1, 1],
            opacity: group.layers[0].transform.opacity.value
          },
          {
            time: 0,
            duration: Math.max(2, Math.min(project.comp.duration, (node.params?.duration ?? 6) / speed))
          }
        )
        applyMotionTracksToGroup(group, tracks)
        affected += group.layers.length
      }
    } else if (
      rule.actionKind === 'virtual_light_candle' ||
      rule.actionKind === 'virtual_light_flashlight'
    ) {
      const focal =
        targetLayers.find((l) => !isForegroundFrameBorderLayer(l)) ?? targetLayers[0]
      if (focal) {
        focal.virtualLight =
          rule.actionKind === 'virtual_light_flashlight'
            ? {
                enabled: true,
                kind: 'flashlight',
                color: '#fef08a',
                intensity: Number((1.5 * amount).toFixed(2)),
                radius: 520,
                beamAngleDeg: 0,
                coneAngleDeg: 54,
                flickerSpeed: Number((0.6 * speed).toFixed(2)),
                zReach: 340
              }
            : {
                enabled: true,
                kind: 'candle',
                color: '#ffbe6b',
                intensity: Number((1.35 * amount).toFixed(2)),
                radius: 440,
                windPreset: 'gentle',
                windStrength: 0.45,
                windSensitivity: 1.0,
                flickerSpeed: Number((1.4 * speed).toFixed(2)),
                zReach: 300
              }
        affected++
      }
    } else if (rule.actionKind === 'rim_glow') {
      for (const l of targetLayers.slice(0, 3)) {
        l.glow = {
          enabled: true,
          side: 'outer',
          color: '#38bdf8',
          thickness: 8,
          intensity: Number((1.3 * amount).toFixed(2)),
          animated: 'breathe',
          speed: Number((1.6 * speed).toFixed(2))
        }
        affected++
      }
    } else if (rule.actionKind === 'mesh_elastic') {
      for (const l of targetLayers) {
        l.physics = {
          enabled: true,
          material: 'foliage_bush',
          role: 'prop_target',
          stiffness: Number((1.2 * speed).toFixed(2)),
          damping: 0.25,
          bounciness: Number((1.15 * amount).toFixed(2))
        }
        affected++
      }
    }
  }

  return affected
}

/**
 * Khi một Khối chức năng bị NGẮT DÂY PORT hoặc TẮT (OFF), tự động vô hiệu hóa
 * các hiệu ứng tương ứng của khối đó trên Project để cảnh 3D phản ánh đúng luồng dây thực tế.
 */
export function deactivateDisconnectedWorkflowStages(
  project: Project,
  activeTypes: Set<WorkflowNodeType>,
  targetShotFilter?: string | null,
  disconnectedNodes?: WorkflowNode[]
): void {
  const inScope = (l: Layer): boolean =>
    !l.locked && (!targetShotFilter || l.shotId === targetShotFilter)

  // Tắt các customRules của những Node bị ngắt dây / tắt
  if (disconnectedNodes && disconnectedNodes.length > 0) {
    for (const dn of disconnectedNodes) {
      for (const r of dn.params?.customRules ?? []) {
        applyRuleMutationToProjectLayer(project, r, false, targetShotFilter)
      }
    }
  }

  // 1. Nếu khối Chuyển động (#3) bị ngắt dây hoặc tắt -> Dừng các chuyển động layer trong phạm vi cảnh
  if (!activeTypes.has('motion_choreography')) {
    for (const l of project.layers) {
      if (!inScope(l)) continue
      if (l.motion && l.motion.enabled) {
        l.motion.enabled = false
      }
      if (l.transform.position.keyframes.length > 0) {
        l.transform.position.keyframes = []
      }
      if (l.transform.rotation.keyframes.length > 0) {
        l.transform.rotation.keyframes = []
      }
    }
  }

  // 2. Nếu khối Vật lý & FX (#4) bị ngắt dây hoặc tắt -> Tắt Vật lý, Đèn ảo, Glow và ẩn Hạt FX trong phạm vi cảnh
  if (!activeTypes.has('physics_fx')) {
    for (const l of project.layers) {
      if (!inScope(l)) continue
      if (l.physics?.enabled) {
        l.physics.enabled = false
        if (l.physics.depthPortal) l.physics.depthPortal.enabled = false
      }
      if (l.virtualLight?.enabled) {
        l.virtualLight.enabled = false
      }
      if (l.glow?.enabled) {
        l.glow.enabled = false
      }
      if (l.type === 'particles') {
        l.visible = false
      }
    }
  } else {
    for (const l of project.layers) {
      if (inScope(l) && l.type === 'particles') {
        l.visible = true
      }
    }
  }

  // 3. Nếu khối Camera 3D (#5) bị ngắt dây hoặc tắt -> Dừng đường bay Camera, tắt DOF & Rung
  if (!activeTypes.has('camera_director')) {
    if (!targetShotFilter) {
      project.camera.position.keyframes = []
      project.camera.target.keyframes = []
      project.camera.fov.keyframes = []
    }
    project.camera.dofEnabled = false
    project.camera.shakeAmount = 0
  }

  // 4. Nếu khối Âm thanh (#6) bị ngắt dây hoặc tắt -> Tắt Lip-Sync và tạm ngắt tiếng track
  if (!activeTypes.has('audio_lipsync')) {
    for (const tr of project.audioTracks ?? []) {
      if (targetShotFilter && tr.targetShotId && tr.targetShotId !== targetShotFilter) continue
      tr.lipSyncEnabled = false
      tr.muted = true
    }
  } else {
    for (const tr of project.audioTracks ?? []) {
      if (targetShotFilter && tr.targetShotId && tr.targetShotId !== targetShotFilter) continue
      if (tr.muted) tr.muted = false
    }
  }

  // 5. Nếu khối Màu & Xuất (#7) bị ngắt dây hoặc tắt -> Tắt sương mù 3D và bộ lọc hậu kỳ
  if (!activeTypes.has('look_output')) {
    project.look = {
      ...project.look,
      fogEnabled: false,
      vignette: 0,
      grain: 0,
      exposure: 0,
      contrast: 1,
      saturation: 1
    }
  }
}

export function formatRuleBadge(rule: WorkflowCustomActionRule): string {
  const spec = getCustomActionSpec(rule.actionKind)
  const spd = rule.speed ?? spec?.defaultSpeed ?? 1
  return `${spec?.icon ?? '⚡'} ${rule.targetName}: ${spec?.shortLabel ?? rule.actionKind} (${spd}x)`
}

/**
 * Kiểm tra xem Layer có phải là khung viền tiền cảnh rỗng giữa (dây leo, vòm đá, khung viền)
 * để tránh gắn nhầm tâm đèn ảo 2.5D vào lỗ rỗng giữa khung hình.
 */
export function isForegroundFrameBorderLayer(layer: Layer): boolean {
  const n = (layer.name || '').toLowerCase()
  const z = layer.transform.position.value[2] ?? 0
  if (z <= -80) return true
  if (
    n.includes('dây leo') ||
    n.includes('tiền cảnh') ||
    n.includes('khung') ||
    n.includes('vòm') ||
    n.includes('frame') ||
    n.includes('border') ||
    n.includes('vine')
  ) {
    return true
  }
  return false
}

/**
 * Chọn Layer chủ thể trung tâm tốt nhất trong một Phân cảnh để nhận Đèn ảo 2.5D hoặc Viền Glow.
 * Ưu tiên: Cụm Composite 2.5D -> Nhân vật -> Chủ thể/Trung cảnh (không phải viền tiền cảnh rỗng giữa hay bầu trời).
 */
export function pickShotFocalLayer(
  project: Project,
  shotId: string | null,
  matchesLayer: (l: Layer) => boolean
): Layer | undefined {
  const inShot = (l: Layer): boolean =>
    !l.locked &&
    (shotId ? l.shotId === shotId : true) &&
    matchesLayer(l)

  const compRoot = project.layers.find((l) => l.composite?.isRoot && inShot(l))
  if (compRoot) return compRoot

  const charLayer = project.layers.find(
    (l) => l.type === 'image' && classifyLayerRole(l) === 'character' && inShot(l)
  )
  if (charLayer) return charLayer

  const midSubject = project.layers.find((l) => {
    if (l.type !== 'image' || !inShot(l)) return false
    if (isForegroundFrameBorderLayer(l)) return false
    const role = classifyLayerRole(l)
    if (role === 'sky' || role === 'ground') return false
    const z = l.transform.position.value[2] ?? 0
    return z > -80 && z <= 1200
  })
  if (midSubject) return midSubject

  return project.layers.find(
    (l) => l.type === 'image' && !isForegroundFrameBorderLayer(l) && inShot(l)
  )
}

/** Disabled sources keep their explicit targets; never redirect effects to another layer. */
export function rebalanceChildLayerRigEdges(workflow: WorkflowGraph): WorkflowGraph {
  return workflow
}

/**
 * Đồng bộ ngược (Bi-directional Sync) từ các chỉnh sửa trên Cột Thuộc Tính Phải
 * (Tab Layer | Camera | Lộ trình | Dự án) vào Đồ thị Workflow để hiển thị và giữ nguyên logic.
 */
export function syncWorkflowFromProject(
  project: Project,
  baseWorkflow: WorkflowGraph
): WorkflowGraph {
  const shotFilter =
    baseWorkflow.targetShotId && baseWorkflow.targetShotId !== 'all'
      ? baseWorkflow.targetShotId
      : null
  const nodes = baseWorkflow.nodes.map((node): WorkflowNode => {
    if (node.params?.logicId || node.params?.configurationMode === 'explicit') return node
    const baseParts = new Set(
      node.params?.targetParts && node.params.targetParts.length > 0
        ? node.params.targetParts
        : getDefaultPartsForNode(node)
    )
    const manualRules = (node.params?.customRules ?? []).filter(
      (r) => !r.id.startsWith('inspector-')
    )

    if (node.type === 'motion_choreography') {
      const syncedRules: WorkflowCustomActionRule[] = []
      for (const l of project.layers) {
        if (l.locked || l.type === 'solid') continue
        if (shotFilter && l.shotId && l.shotId !== shotFilter) continue
        const m = l.motion
        if (m && m.enabled && m.type && m.type !== 'none') {
          const kind = m.type as WorkflowCustomActionKind
          const spec = getCustomActionSpec(kind)
          if (!spec) continue
          const alreadyManual = manualRules.some(
            (r) =>
              (r.targetId === l.id || r.targetId === 'all') && r.actionKind === kind
          )
          if (!alreadyManual) {
            syncedRules.push({
              id: `inspector-motion-${l.id}`,
              label: `${spec.shortLabel} (${l.name})`,
              targetId: l.id,
              targetName: l.name,
              actionKind: kind,
              speed: Number((m.speed ?? spec.defaultSpeed).toFixed(2)),
              amount: Number((m.amount ?? spec.defaultAmount).toFixed(2)),
              enabled: true
            })
          }
          if (kind === 'wind') baseParts.add('canopy_wind')
          if (kind === 'drift') baseParts.add('sky_cloud_drift')
          if (kind === 'float' || kind === 'pulse') baseParts.add('torso_breathe')
          if (kind === 'sway') baseParts.add('hair_cloth_sway')
        }
      }
      return {
        ...node,
        params: {
          ...(node.params ?? {}),
          targetParts: Array.from(baseParts),
          customRules: [...manualRules, ...syncedRules]
        }
      }
    }

    if (node.type === 'physics_fx') {
      const syncedRules: WorkflowCustomActionRule[] = []
      const hasParticles = project.layers.some((l) => l.type === 'particles' && l.visible)
      if (hasParticles) baseParts.add('firefly_particles')
      else baseParts.delete('firefly_particles')

      for (const l of project.layers) {
        if (l.locked) continue
        if (shotFilter && l.shotId && l.shotId !== shotFilter) continue
        if (l.virtualLight?.enabled) {
          baseParts.add('virtual_light_core')
          const kind: WorkflowCustomActionKind =
            l.virtualLight.kind === 'flashlight' || l.virtualLight.kind === 'bulb'
              ? 'virtual_light_flashlight'
              : 'virtual_light_candle'
          const spec = getCustomActionSpec(kind)
          const alreadyManual = manualRules.some(
            (r) =>
              (r.targetId === l.id || r.targetId === 'all') &&
              (r.actionKind === 'virtual_light_candle' ||
                r.actionKind === 'virtual_light_flashlight')
          )
          if (!alreadyManual && spec) {
            syncedRules.push({
              id: `inspector-vlight-${l.id}`,
              label: `${spec.shortLabel} (${l.name})`,
              targetId: l.id,
              targetName: l.name,
              actionKind: kind,
              speed: Number((l.virtualLight.flickerSpeed ?? spec.defaultSpeed).toFixed(2)),
              amount: Number((l.virtualLight.intensity ?? spec.defaultAmount).toFixed(2)),
              enabled: true
            })
          }
        }
        if (l.glow?.enabled) {
          baseParts.add('rim_glow_silhouette')
          const alreadyManual = manualRules.some(
            (r) => (r.targetId === l.id || r.targetId === 'all') && r.actionKind === 'rim_glow'
          )
          if (!alreadyManual) {
            syncedRules.push({
              id: `inspector-glow-${l.id}`,
              label: `Viền Glow (${l.name})`,
              targetId: l.id,
              targetName: l.name,
              actionKind: 'rim_glow',
              speed: Number((l.glow.speed ?? 1.6).toFixed(2)),
              amount: Number((l.glow.intensity ?? 1.2).toFixed(2)),
              enabled: true
            })
          }
        }
        if (l.physics?.enabled) {
          baseParts.add('soft_mesh_jiggle')
          if (l.physics.depthPortal?.enabled) {
            baseParts.add('cave_depth_portal')
          }
        }
      }

      return {
        ...node,
        params: {
          ...(node.params ?? {}),
          spawnParticles: hasParticles,
          targetParts: Array.from(baseParts),
          customRules: [...manualRules, ...syncedRules]
        }
      }
    }

    if (node.type === 'camera_director') {
      const dofOn = Boolean(project.camera.dofEnabled)
      const shakeOn = (project.camera.shakeAmount ?? 0) > 0.2
      if (dofOn) baseParts.add('dof_aperture')
      else baseParts.delete('dof_aperture')
      if (shakeOn) baseParts.add('handheld_rig')
      else baseParts.delete('handheld_rig')
      if (project.camera.position.keyframes.length > 1) {
        baseParts.add('spline_eye_path')
      }
      return {
        ...node,
        params: {
          ...(node.params ?? {}),
          enableDof: dofOn,
          targetParts: Array.from(baseParts)
        }
      }
    }

    if (node.type === 'audio_lipsync') {
      const hasLipSync = (project.audioTracks ?? []).some((t) => t.lipSyncEnabled)
      if (hasLipSync) baseParts.add('mouth_viseme_25d')
      return {
        ...node,
        params: {
          ...(node.params ?? {}),
          autoLipSync: hasLipSync || Boolean(node.params?.autoLipSync),
          targetParts: Array.from(baseParts)
        }
      }
    }

    if (node.type === 'look_output') {
      if (project.look.fogEnabled) baseParts.add('z_depth_fog')
      else baseParts.delete('z_depth_fog')
      if ((project.look.vignette ?? 0) > 0.02 || (project.look.grain ?? 0) > 0.01) {
        baseParts.add('lens_vignette_grain')
      } else {
        baseParts.delete('lens_vignette_grain')
      }
      return {
        ...node,
        params: {
          ...(node.params ?? {}),
          targetParts: Array.from(baseParts)
        }
      }
    }

    return node
  })

  return rebalanceChildLayerRigEdges({
    ...baseWorkflow,
    nodes
  })
}

/**
 * Khi người dùng tắt hoặc xóa một quy tắc chuyển động/FX trong bảng Workflow (tab ➕ Thêm FX),
 * đồng bộ tắt hiệu ứng tương ứng trực tiếp trên Layer trong Project (Inspector).
 */
export function applyRuleMutationToProjectLayer(
  project: Project,
  rule: WorkflowCustomActionRule,
  enabled: boolean,
  shotFilter?: string | null
): void {
  const targets = project.layers.filter(
    (l) =>
      (!shotFilter || !l.shotId || l.shotId === shotFilter) &&
      (rule.targetId === 'all' ||
      l.id === rule.targetId ||
      l.composite?.instanceId === rule.targetId ||
      l.model3d?.instanceId === rule.targetId)
  )
  for (const l of targets) {
    if (
      rule.actionKind === 'wind' ||
      rule.actionKind === 'drift' ||
      rule.actionKind === 'float' ||
      rule.actionKind === 'sway' ||
      rule.actionKind === 'pulse' ||
      rule.actionKind === 'spin'
    ) {
      if (l.motion) l.motion.enabled = enabled
    } else if (
      rule.actionKind === 'virtual_light_candle' ||
      rule.actionKind === 'virtual_light_flashlight'
    ) {
      if (l.virtualLight) l.virtualLight.enabled = enabled
    } else if (rule.actionKind === 'rim_glow') {
      if (l.glow) l.glow.enabled = enabled
    } else if (rule.actionKind === 'mesh_elastic') {
      if (l.physics) l.physics.enabled = enabled
    }
  }
}
