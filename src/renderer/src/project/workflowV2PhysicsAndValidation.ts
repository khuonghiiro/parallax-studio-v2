import type {
  Layer,
  LayerPhysicsMaterial,
  PhysicsImpactPulse,
  Project,
  Vec3,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode
} from '@shared/types'
import { addKeyframe, evaluate } from '../animation/keyframes'
import {
  MATERIAL_PHYSICS_PRESETS,
  createDefaultLayerPhysics
} from '../engine/layerPhysicsPresets'

export type WorkflowV2MaterialTag = Exclude<LayerPhysicsMaterial, 'none'>

export interface WorkflowV2MaterialOption {
  id: WorkflowV2MaterialTag
  label: string
  shortLabel: string
  deformDesc: string
  defaultStiffness: number
  defaultBounciness: number
  defaultGravity: number
  squashRatio: number
}

export const WORKFLOW_V2_MATERIAL_OPTIONS: WorkflowV2MaterialOption[] = [
  {
    id: 'jelly_slime',
    label: '🍮 Cao su / Thạch đàn hồi',
    shortLabel: '🍮 Cao su / Thạch',
    deformDesc: 'Lún bẹp 42%, phình ngang bảo toàn thể tích & bật nảy tưng tưng',
    defaultStiffness: 0.55,
    defaultBounciness: 1.55,
    defaultGravity: 0,
    squashRatio: 0.42
  },
  {
    id: 'wood_tree',
    label: '🌳 Gỗ / Thân cây đàn hồi',
    shortLabel: '🌳 Gỗ / Cây',
    deformDesc: 'Gốc bám cố định, thân uốn cong theo lực va chạm rồi bật nảy về',
    defaultStiffness: 1.25,
    defaultBounciness: 0.85,
    defaultGravity: 0,
    squashRatio: 0.08
  },
  {
    id: 'foliage_bush',
    label: '🍃 Lá cây / Cỏ mềm',
    shortLabel: '🍃 Lá / Cỏ mềm',
    deformDesc: 'Mềm nhẹ, dạt rạp sâu theo hướng va chạm & rung rinh tần số cao',
    defaultStiffness: 0.75,
    defaultBounciness: 1.1,
    defaultGravity: 0,
    squashRatio: 0.16
  },
  {
    id: 'stone_wall',
    label: '🧱 Đá cứng / Bờ tường',
    shortLabel: '🧱 Đá cứng',
    deformDesc: 'Cứng vững không móp mềm, rung chấn vi mô 25Hz & tạo phản lực nảy',
    defaultStiffness: 2.1,
    defaultBounciness: 0.35,
    defaultGravity: 0,
    squashRatio: 0.025
  },
  {
    id: 'metal_armor',
    label: '🛡️ Kim loại / Giáp sắt',
    shortLabel: '🛡️ Kim loại',
    deformDesc: 'Giật lùi ngắn sắc gọn (recoil) & ngân rung kim khí 21Hz',
    defaultStiffness: 1.8,
    defaultBounciness: 0.6,
    defaultGravity: 0,
    squashRatio: 0.04
  },
  {
    id: 'cloth_rope',
    label: '🚩 Vải mềm / Dây treo',
    shortLabel: '🚩 Vải / Dây',
    deformDesc: 'Uốn lượn sóng mềm mại & rủ theo trọng lực khi có xung lực',
    defaultStiffness: 0.45,
    defaultBounciness: 0.95,
    defaultGravity: 0.3,
    squashRatio: 0.14
  },
  {
    id: 'flesh_body',
    label: '🥊 Chủ thể / Cơ thể sống',
    shortLabel: '🥊 Chủ thể',
    deformDesc: 'Đàn hồi cơ học 15%, đóng vai trò chủ thể lao tới / nhảy vượt',
    defaultStiffness: 1.0,
    defaultBounciness: 0.75,
    defaultGravity: 0,
    squashRatio: 0.15
  },
  {
    id: 'ground_terrain',
    label: '🟢 Mặt đất / Địa hình đỡ',
    shortLabel: '🟢 Mặt đất',
    deformDesc: 'Mặt phẳng đỡ trọng lực rơi tự do & tạo nảy khi vật thể tiếp đất',
    defaultStiffness: 2.2,
    defaultBounciness: 0.25,
    defaultGravity: 0,
    squashRatio: 0.015
  }
]

export type WorkflowV2CollisionMode =
  | 'elastic_bounce'
  | 'heavy_punch'
  | 'jelly_crush'
  | 'wall_vault'
  | 'projectile_stick'

export interface WorkflowV2CollisionOption {
  id: WorkflowV2CollisionMode
  label: string
  shortLabel: string
  description: string
  defaultForce: number
  defaultDeform: number
}

export const WORKFLOW_V2_COLLISION_OPTIONS: WorkflowV2CollisionOption[] = [
  {
    id: 'elastic_bounce',
    label: '💥 Lao vào & Bật nảy đàn hồi',
    shortLabel: '💥 Nảy đàn hồi',
    description: 'Layer A lao tới tông vào Layer B, làm B biến dạng theo chất liệu rồi A bật nảy ngược ra.',
    defaultForce: 1.15,
    defaultDeform: 1.2
  },
  {
    id: 'heavy_punch',
    label: '🥊 Tông mạnh / Chấn động Mesh',
    shortLabel: '🥊 Tông mạnh',
    description: 'Xung lực vận tốc cao đánh vào Layer B làm lưới đỉnh (Mesh) uốn cong/móp và rung chấn.',
    defaultForce: 1.5,
    defaultDeform: 1.45
  },
  {
    id: 'jelly_crush',
    label: '🍮 Đè lún / Dẫm bẹp biến dạng',
    shortLabel: '🍮 Đè lún bẹp',
    description: 'Lực nén dọc từ trên xuống làm mục tiêu lún bẹp dọc - phình ngang rồi bung nảy đàn hồi.',
    defaultForce: 1.3,
    defaultDeform: 1.6
  },
  {
    id: 'wall_vault',
    label: '🏃 Chống tường nhảy vượt Parabol',
    shortLabel: '🏃 Nhảy vượt',
    description: 'Layer A lao tới lấy điểm tựa trên Layer B rồi bật nhảy vọt qua theo quỹ đạo Parabol.',
    defaultForce: 1.25,
    defaultDeform: 1.0
  },
  {
    id: 'projectile_stick',
    label: '🏹 Phóng xuyên Z & Ghim cắm',
    shortLabel: '🏹 Ghim cắm',
    description: 'Layer A bay tới chạm mặt phẳng của Layer B, cắm phập dừng lại và rung đuôi tần số cao.',
    defaultForce: 1.35,
    defaultDeform: 1.25
  }
]

export const LOGIC_CATEGORY_LABELS: Record<string, string> = {
  action: '🏃 Hành động',
  material: '🏷️ Nhãn Vật liệu',
  collision: '💥 Va chạm Vật lý',
  light: '💡 Ánh sáng',
  cave: '🕳️ Hang động',
  fx: '✨ Hiệu ứng',
  audio: '🔊 Âm thanh',
  camera: '🎥 Camera 3D'
}

export function getNodeLogicCategory(node: WorkflowNode): string | undefined {
  if (node.type === 'scene_shot' || node.type === 'layer_assembly') return undefined
  if (node.params?.logicCategory) return node.params.logicCategory
  if (node.type === 'camera_director') return 'camera'
  if (node.type === 'audio_lipsync') return 'audio'
  if (node.type === 'physics_fx') return 'fx'
  return 'action'
}

/**
 * Kiểm tra điều kiện kết nối chặt chẽ giữa 2 Node trong Workflow V2:
 * 1. Cấm tự kết nối chính mình hoặc kết nối lặp trùng dây.
 * 2. Cấm liên kết các Node không liên quan hoặc ngược phân cấp (chỉ cho phép: Root -> Group/Camera, Group -> Layer, Layer -> Logic, Material -> Collision).
 * 3. Cấm gắn 2 Node cùng loại Logic vào cùng 1 Layer (chống trùng logic trên 1 Layer).
 * 4. Cho phép NHIỀU Node Layer cùng kết nối vào 1 Node Logic chung (Tái sử dụng Node — Shared Logic Node, đặc biệt là Node Va chạm Vật lý & Node Nhãn Vật liệu).
 */
export function validateWorkflowV2Connection(
  workflow: WorkflowGraph,
  fromNodeId: string,
  toNodeId: string
): { valid: boolean; reason?: string } {
  if (fromNodeId === toNodeId) {
    return { valid: false, reason: '❌ Không thể tự kết nối một Node với chính nó.' }
  }
  if (workflow.edges.some((e) => e.fromNode === fromNodeId && e.toNode === toNodeId)) {
    return { valid: false, reason: '⚠️ Dây kết nối giữa 2 Node này đã tồn tại.' }
  }

  const src = workflow.nodes.find((n) => n.id === fromNodeId)
  const dst = workflow.nodes.find((n) => n.id === toNodeId)
  if (!src || !dst) {
    return { valid: false, reason: '❌ Không tìm thấy Node nguồn hoặc Node đích.' }
  }

  const srcIsRoot = src.type === 'scene_shot'
  const dstIsRoot = dst.type === 'scene_shot'
  const srcIsGroup = Boolean(src.params?.groupKind)
  const dstIsGroup = Boolean(dst.params?.groupKind)
  const srcIsLayer = src.type === 'layer_assembly' && !srcIsGroup
  const dstIsLayer = dst.type === 'layer_assembly' && !dstIsGroup
  const srcCat = getNodeLogicCategory(src)
  const dstCat = getNodeLogicCategory(dst)

  if (dstIsRoot) {
    return {
      valid: false,
      reason: '❌ Root Cảnh là gốc tổng hợp cao nhất, không nhận kết nối đầu vào từ Node khác.'
    }
  }

  // 1. Nguồn là Root Cảnh -> chỉ nối tới Group Layer hoặc Camera 3D
  if (srcIsRoot) {
    if (dstIsGroup || dstCat === 'camera') {
      return { valid: true }
    }
    return {
      valid: false,
      reason:
        '❌ Root Cảnh chỉ được kết nối tới Group Layer hoặc Đạo diễn Camera 3D (không nối tắt vào Layer hay Node Logic).'
    }
  }

  // 2. Nguồn là Group Layer -> chỉ nối tới Node Layer
  if (srcIsGroup) {
    if (dstIsLayer) {
      return { valid: true }
    }
    return {
      valid: false,
      reason: '❌ Group Layer chỉ được kết nối tới các Node Layer con thuộc nhóm.'
    }
  }

  // 3. Nguồn là Node Layer -> chỉ nối tới các Node Logic của Layer (Hành động, Vật liệu, Va chạm, Ánh sáng, Hang động, Hiệu ứng, Âm thanh)
  if (srcIsLayer) {
    if (dstIsLayer) {
      return {
        valid: false,
        reason:
          '❌ Không nối trực tiếp 2 Node Layer với nhau! Để tạo tương tác va chạm giữa 2 Layer, hãy nối cả 2 Layer vào chung một "💥 Node Va chạm Vật lý".'
      }
    }
    if (dstIsGroup || dstCat === 'camera') {
      return {
        valid: false,
        reason: '❌ Node Layer không được nối ngược vào Group Layer hoặc Camera 3D.'
      }
    }
    if (!dstCat) {
      return { valid: false, reason: '❌ Node đích không phải là Node Logic hợp lệ của Layer.' }
    }

    // Kiểm tra chống trùng Logic: Layer này đã có một Node Logic khác cùng loại (dstCat) chưa?
    const existingLogicNodesOfLayer = workflow.edges
      .filter((e) => e.fromNode === src.id)
      .map((e) => workflow.nodes.find((n) => n.id === e.toNode))
      .filter((n): n is WorkflowNode => Boolean(n))

    const duplicateSameCat = existingLogicNodesOfLayer.find(
      (n) => n.id !== dst.id && getNodeLogicCategory(n) === dstCat
    )
    if (duplicateSameCat) {
      const catLabel = LOGIC_CATEGORY_LABELS[dstCat] ?? dstCat
      return {
        valid: false,
        reason: `⚠️ Layer "${src.title}" đã gắn logic [${catLabel}] ("${duplicateSameCat.title}") rồi — không được gắn trùng 2 Node cùng loại logic trên 1 Layer!`
      }
    }

    return { valid: true }
  }

  // 4. Nguồn là Node Nhãn Vật liệu -> cho phép nối bổ trợ sang Node Va chạm Vật lý để truyền chất liệu biến dạng
  if (srcCat === 'material' && dstCat === 'collision') {
    return { valid: true }
  }

  return {
    valid: false,
    reason: `❌ Không được liên kết "${src.title}" với "${dst.title}" do khác tầng ngữ nghĩa hoặc không liên quan!`
  }
}

/**
 * Tự động tổng hợp danh sách các Layer liên kết vào từng Node Logic (hỗ trợ Tái sử dụng Node cho nhiều Layer
 * và ghép cặp Chủ thể A / Mục tiêu B cho Node Va chạm Vật lý).
 */
export function recomputeSharedLogicTargets(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return nodes.map((node) => {
    const cat = getNodeLogicCategory(node)
    if (!cat || cat === 'camera') return node

    // Tìm tất cả các Node Layer nối trực tiếp (hoặc qua Node Vật liệu) vào Node Logic này
    const incomingLayerNodes: WorkflowNode[] = []
    for (const e of edges) {
      if (e.toNode !== node.id) continue
      const fromN = byId.get(e.fromNode)
      if (!fromN) continue
      if (fromN.type === 'layer_assembly' && !fromN.params?.groupKind) {
        if (!incomingLayerNodes.some((ln) => ln.id === fromN.id)) {
          incomingLayerNodes.push(fromN)
        }
      } else if (getNodeLogicCategory(fromN) === 'material') {
        for (const eMat of edges) {
          if (eMat.toNode !== fromN.id) continue
          const matLayer = byId.get(eMat.fromNode)
          if (
            matLayer &&
            matLayer.type === 'layer_assembly' &&
            !matLayer.params?.groupKind &&
            !incomingLayerNodes.some((ln) => ln.id === matLayer.id)
          ) {
            incomingLayerNodes.push(matLayer)
          }
        }
      }
    }

    if (incomingLayerNodes.length === 0) return node

    const combinedTargetLayerIds = Array.from(
      new Set(incomingLayerNodes.flatMap((ln) => ln.params?.targetLayerIds ?? []))
    )
    const sharedLayerNodeIds = incomingLayerNodes.map((ln) => ln.id)

    const nextParams = {
      ...(node.params ?? {}),
      targetMode: 'custom' as const,
      targetLayerIds: combinedTargetLayerIds,
      sharedLayerNodeIds,
      hierarchyParentNodeId: incomingLayerNodes[0].id
    }

    if (cat === 'collision') {
      const firstLayerId = incomingLayerNodes[0]?.params?.targetLayerIds?.[0]
      const secondLayerId = incomingLayerNodes[1]?.params?.targetLayerIds?.[0]
      if (
        !nextParams.strikerLayerId ||
        !combinedTargetLayerIds.includes(nextParams.strikerLayerId)
      ) {
        nextParams.strikerLayerId = firstLayerId
      }
      if (
        secondLayerId &&
        (!nextParams.targetColliderLayerId ||
          !combinedTargetLayerIds.includes(nextParams.targetColliderLayerId) ||
          nextParams.targetColliderLayerId === nextParams.strikerLayerId)
      ) {
        nextParams.targetColliderLayerId =
          secondLayerId !== nextParams.strikerLayerId ? secondLayerId : firstLayerId
      }
    }

    return {
      ...node,
      params: nextParams
    }
  })
}

/** Tìm chất liệu vật lý đã gắn cho một Layer từ Node Vật liệu trong cây (hoặc từ layer.physics hiện tại) */
export function resolveLayerMaterialInWorkflow(
  workflow: WorkflowGraph | undefined,
  layer: Layer
): WorkflowV2MaterialTag {
  if (workflow) {
    const matNode = workflow.nodes.find(
      (n) =>
        n.enabled &&
        getNodeLogicCategory(n) === 'material' &&
        n.params?.targetLayerIds?.includes(layer.id)
    )
    if (matNode?.params?.materialTag) {
      return matNode.params.materialTag
    }
  }
  if (layer.physics?.material && layer.physics.material !== 'none') {
    return layer.physics.material
  }
  const lower = (layer.name || '').toLowerCase()
  if (lower.includes('cây') || lower.includes('gỗ')) return 'wood_tree'
  if (lower.includes('lá') || lower.includes('dây leo') || lower.includes('hoa')) return 'foliage_bush'
  if (lower.includes('đá') || lower.includes('cổng') || lower.includes('núi')) return 'stone_wall'
  if (lower.includes('thạch') || lower.includes('slime')) return 'jelly_slime'
  return 'flesh_body'
}

/** Đồng bộ Node Nhãn Vật liệu (`logicCategory === 'material'`) xuống các Layer liên kết trong Project */
export function applyMaterialNodeToProject(
  project: Project,
  node: WorkflowNode
): void {
  const targetIds = new Set(node.params?.targetLayerIds ?? [])
  const matTag: WorkflowV2MaterialTag = node.params?.materialTag ?? 'jelly_slime'
  const preset = MATERIAL_PHYSICS_PRESETS[matTag] ?? MATERIAL_PHYSICS_PRESETS.jelly_slime

  for (const l of project.layers) {
    if (!targetIds.has(l.id)) continue
    if (!node.enabled) {
      if (l.physics) l.physics.enabled = false
      continue
    }
    const baseCfg = l.physics ?? createDefaultLayerPhysics(matTag)
    l.physics = {
      ...baseCfg,
      enabled: true,
      material: matTag,
      stiffness: node.params?.materialStiffness ?? preset.stiffness,
      bounciness: node.params?.materialBounciness ?? preset.bounciness,
      gravityScale: node.params?.materialGravity ?? preset.gravityScale,
      mass: preset.mass,
      damping: preset.damping
    }
  }
}

/**
 * Đồng bộ Node Va chạm Vật lý (`logicCategory === 'collision'`) xuống cặp Layer A (Chủ thể) và Layer B (Mục tiêu):
 * - Cấu hình chất liệu vật lý & zTolerance cho cả 2 Layer để tương tác cùng mặt phẳng va chạm.
 * - Tạo xung lực va chạm thực (`PhysicsImpactPulse`) tại thời điểm chạm `tHit` để biến dạng lưới đỉnh (Mesh Deformation)
 *   theo đúng chất liệu của từng Layer (Thạch lún bẹp 42%, Cây uốn gốc, Đá rung chấn 25Hz, Kim loại ngân rung...).
 * - Tạo quỹ đạo Keyframe chuyển động va chạm & biến dạng đàn hồi (Position + Scale Squash & Stretch + Rotation)
 *   trong khoảng `[timeStart -> tHit -> timeEnd]`.
 */
export function applyCollisionNodeToProject(
  project: Project,
  workflow: WorkflowGraph | undefined,
  node: WorkflowNode
): void {
  const pulseId = `wf-col-${node.id}`
  const strikerPulseId = `wf-col-a-${node.id}`
  if (!node.enabled) {
    for (const l of project.layers) {
      if (l.physics?.impacts?.length) {
        l.physics.impacts = l.physics.impacts.filter(
          (imp) => imp.id !== pulseId && imp.id !== strikerPulseId
        )
      }
    }
    return
  }
  const targetIds = node.params?.targetLayerIds ?? []
  if (targetIds.length === 0) return

  const strikerId = node.params?.strikerLayerId ?? targetIds[0]
  const targetId =
    node.params?.targetColliderLayerId ??
    targetIds.find((id) => id !== strikerId) ??
    targetIds[0]

  const strikerLayer = project.layers.find((l) => l.id === strikerId)
  const targetLayer = project.layers.find((l) => l.id === targetId)
  if (!strikerLayer || !targetLayer) return

  const mode: WorkflowV2CollisionMode = node.params?.collisionMode ?? 'elastic_bounce'
  const force = Math.max(0.2, Math.min(2.5, node.params?.collisionForce ?? 1.2))
  const deform = Math.max(0.2, Math.min(2.5, node.params?.deformIntensity ?? 1.25))

  const tStart = Math.max(0, node.params?.timeStart ?? 0)
  const tEnd = Math.max(tStart + 0.4, node.params?.timeEnd ?? project.comp.duration ?? 5)
  const span = tEnd - tStart
  const tHit = Number((tStart + span * 0.45).toFixed(2))
  const tRecover = Number(Math.min(tEnd, tHit + Math.min(1.1, span * 0.45)).toFixed(2))

  // Xác định chất liệu vật lý của Chủ thể A và Mục tiêu B từ Node Vật liệu (nếu có)
  const strikerMat = resolveLayerMaterialInWorkflow(workflow, strikerLayer)
  const targetMat = resolveLayerMaterialInWorkflow(
    workflow,
    targetLayer.id === strikerLayer.id ? strikerLayer : targetLayer
  )
  const effectiveTargetMat: WorkflowV2MaterialTag =
    mode === 'jelly_crush' && targetMat === 'flesh_body' ? 'jelly_slime' : targetMat

  const strikerPreset = MATERIAL_PHYSICS_PRESETS[strikerMat] ?? MATERIAL_PHYSICS_PRESETS.flesh_body
  const targetPreset =
    MATERIAL_PHYSICS_PRESETS[effectiveTargetMat] ?? MATERIAL_PHYSICS_PRESETS.wood_tree

  const posA = evaluate(strikerLayer.transform.position, tStart)
  const posB = evaluate(targetLayer.transform.position, tStart)
  const zDiff = Math.abs(posA[2] - posB[2])
  const sharedZTol = Math.max(80, Math.round(zDiff + 90))

  // 1. Cấu hình Physics & Xung phản lực va chạm cho Chủ thể A
  const baseStrikerCfg = strikerLayer.physics ?? createDefaultLayerPhysics(strikerMat)
  const existingStrikerImpacts = (baseStrikerCfg.impacts ?? []).filter((imp) => imp.id !== strikerPulseId)
  const dirX = posB[0] >= posA[0] ? 1 : -1
  const strikerPulse: PhysicsImpactPulse = {
    id: strikerPulseId,
    time: tHit,
    type: mode === 'wall_vault' ? 'vault' : 'punch',
    velocity: [-dirX * 420 * force, 120 * force, 0],
    contactUV: [0.5, 0.5],
    sourceLayerId: targetLayer.id,
    duration: Number(Math.max(0.7, tEnd - tHit).toFixed(2))
  }
  strikerLayer.physics = {
    ...baseStrikerCfg,
    enabled: true,
    material: strikerMat,
    role:
      mode === 'projectile_stick'
        ? 'projectile'
        : mode === 'wall_vault'
          ? 'vault_jumper'
          : 'striker',
    stickOnHit: mode === 'projectile_stick',
    zTolerance: sharedZTol,
    bounciness: Number((strikerPreset.bounciness * deform).toFixed(2)),
    hitSensitivity: force,
    impacts: [...existingStrikerImpacts, strikerPulse]
  }

  // 2. Cấu hình Physics & Xung biến dạng Mesh cho Mục tiêu B
  const baseTargetCfg = targetLayer.physics ?? createDefaultLayerPhysics(effectiveTargetMat)
  const existingImpacts = (baseTargetCfg.impacts ?? []).filter((imp) => imp.id !== pulseId)
  const impactVelocity: Vec3 =
    mode === 'jelly_crush'
      ? [dirX * 80 * force, -760 * force, 0]
      : mode === 'heavy_punch'
        ? [dirX * 960 * force, 85 * force, 0]
        : mode === 'projectile_stick'
          ? [dirX * 680 * force, -40, 420 * force]
          : [dirX * 640 * force, -60 * force, 0]

  const impactPulse: PhysicsImpactPulse = {
    id: pulseId,
    time: tHit,
    type:
      mode === 'jelly_crush'
        ? 'press'
        : mode === 'wall_vault'
          ? 'vault'
          : mode === 'projectile_stick'
            ? 'arrow'
            : 'punch',
    velocity: impactVelocity,
    contactUV: mode === 'jelly_crush' ? [0.5, 0.85] : [0.5, 0.55],
    sourceLayerId: strikerLayer.id,
    duration: Number(Math.max(0.9, tEnd - tHit).toFixed(2))
  }

  targetLayer.physics = {
    ...baseTargetCfg,
    enabled: true,
    material: effectiveTargetMat,
    role: 'prop_target',
    zTolerance: sharedZTol,
    stiffness: targetPreset.stiffness,
    damping: targetPreset.damping,
    bounciness: Number((targetPreset.bounciness * deform).toFixed(2)),
    hitSensitivity: Number((force * deform).toFixed(2)),
    impacts: [...existingImpacts, impactPulse]
  }

  // 3. Nếu có 2 Layer riêng biệt (A != B), tạo quỹ đạo chuyển động va chạm & biến dạng đàn hồi theo chất liệu
  if (strikerLayer.id !== targetLayer.id) {
    const startScaleA = evaluate(strikerLayer.transform.scale, tStart)
    const startScaleB = evaluate(targetLayer.transform.scale, tStart)
    const contactX = Math.round(posA[0] + (posB[0] - posA[0]) * 0.72)
    const contactY = Math.round(posA[1] + (posB[1] - posA[1]) * 0.65)

    // Quỹ đạo của Chủ thể A (lao tới điểm chạm tHit -> phản ứng theo dạng va chạm tại tRecover)
    addKeyframe(strikerLayer.transform.position, tStart, [...posA] as Vec3, 'easeIn')
    addKeyframe(
      strikerLayer.transform.position,
      tHit,
      [contactX, contactY, posA[2]],
      'easeOut'
    )

    if (mode === 'elastic_bounce') {
      const reboundDist = Math.round(140 * force * (0.6 + targetPreset.bounciness * 0.4))
      addKeyframe(
        strikerLayer.transform.position,
        tRecover,
        [contactX - dirX * reboundDist, posA[1] + 24, posA[2]],
        'easeOut'
      )
    } else if (mode === 'wall_vault') {
      const vaultPeakT = Number(((tHit + tRecover) * 0.5).toFixed(2))
      addKeyframe(
        strikerLayer.transform.position,
        vaultPeakT,
        [posB[0], posB[1] + Math.round(190 * force), posA[2]],
        'easeOut'
      )
      addKeyframe(
        strikerLayer.transform.position,
        tRecover,
        [posB[0] + dirX * 180, posA[1], posA[2]],
        'easeIn'
      )
    } else if (mode === 'heavy_punch') {
      addKeyframe(
        strikerLayer.transform.position,
        tRecover,
        [contactX - dirX * 45, contactY, posA[2]],
        'easeOut'
      )
    }

    // Biến dạng Scale (Squash & Stretch) tại thời điểm va chạm tHit cho cả A và B dựa trên hệ số squashRatio của chất liệu
    const squashA = Math.min(0.38, Math.max(0.05, strikerPreset.squashRatio * deform * 0.9))
    const squashB = Math.min(0.48, Math.max(0.03, targetPreset.squashRatio * deform * 1.15))
    const tPeakDeform = Number(Math.min(tEnd, tHit + 0.08).toFixed(2))

    addKeyframe(strikerLayer.transform.scale, tStart, [...startScaleA] as Vec3, 'linear')
    addKeyframe(
      strikerLayer.transform.scale,
      tPeakDeform,
      [
        Number((startScaleA[0] * (1 - squashA * 0.65)).toFixed(3)),
        Number((startScaleA[1] * (1 + squashA * 0.55)).toFixed(3)),
        startScaleA[2]
      ],
      'easeOut'
    )
    addKeyframe(strikerLayer.transform.scale, tRecover, [...startScaleA] as Vec3, 'easeOut')

    addKeyframe(targetLayer.transform.scale, tStart, [...startScaleB] as Vec3, 'linear')
    addKeyframe(
      targetLayer.transform.scale,
      tPeakDeform,
      [
        Number((startScaleB[0] * (1 + squashB * 0.85)).toFixed(3)),
        Number((startScaleB[1] * (1 - squashB * 0.78)).toFixed(3)),
        startScaleB[2]
      ],
      'easeOut'
    )
    addKeyframe(targetLayer.transform.scale, tRecover, [...startScaleB] as Vec3, 'easeOut')

    // Nếu Mục tiêu B bị tông mạnh ('heavy_punch') và không phải tường đá cố định -> bị đẩy lùi nhẹ theo khối lượng
    if (mode === 'heavy_punch' && effectiveTargetMat !== 'stone_wall' && effectiveTargetMat !== 'ground_terrain') {
      const pushDist = Math.round((95 * force) / Math.max(0.6, Math.sqrt(targetPreset.mass)))
      addKeyframe(targetLayer.transform.position, tHit, [...posB] as Vec3, 'easeOut')
      addKeyframe(
        targetLayer.transform.position,
        tRecover,
        [posB[0] + dirX * pushDist, posB[1], posB[2]],
        'easeOut'
      )
    }
  }
}
