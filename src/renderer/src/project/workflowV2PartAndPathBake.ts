import type { Layer, Project, Vec3, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import {
  clearBboxMotionKeysFromScene,
  evaluateCleanLayerPos,
  sampleNormalizedStroke,
  smoothNormalizedStroke
} from './workflowV2BboxMotionAndCollision'
import {
  detectClusterExpressions,
  getClusterMemberLayers,
  getClusterPartShortName
} from './workflowV2ClusterRigAndSwap'

const isPartPoseKeyId = (id: string, nodeId?: string): boolean =>
  nodeId ? id.includes(`-partpose-${nodeId}-`) : id.includes('-partpose-')
const isPartSwapKeyId = (id: string, nodeId?: string): boolean =>
  nodeId ? id.includes(`-partswap-${nodeId}-`) : id.includes('-partswap-')

/** Gỡ keyframe tư thế & đánh tráo bộ phận (`-partpose-`, `-partswap-`) của một Node */
export function clearPartPoseKeysFromLayers(
  layers: Layer[],
  nodeId?: string,
  includeSwapOpacity = true
): void {
  for (const l of layers) {
    l.transform.position.keyframes = l.transform.position.keyframes.filter((k) => !isPartPoseKeyId(k.id, nodeId))
    l.transform.rotation.keyframes = l.transform.rotation.keyframes.filter((k) => !isPartPoseKeyId(k.id, nodeId))
    l.transform.scale.keyframes = l.transform.scale.keyframes.filter((k) => !isPartPoseKeyId(k.id, nodeId))
    if (includeSwapOpacity) {
      l.transform.opacity.keyframes = l.transform.opacity.keyframes.filter((k) => !isPartSwapKeyId(k.id, nodeId))
    }
  }
}

/** Bake keyframe đánh tráo biến thể / biểu cảm bộ phận theo khoảng thời gian `[timeStart, timeEnd]` */
function applyTimedVariantSwapToGroup(
  project: Project,
  groupPool: Layer[],
  chosenLayer: Layer,
  node: WorkflowNode,
  params: WorkflowNodeParams
): void {
  for (const m of groupPool) {
    m.transform.opacity.keyframes = m.transform.opacity.keyframes.filter((k) => !isPartSwapKeyId(k.id, node.id))
  }
  const defaultLayer = groupPool[0]
  if (!node.enabled) {
    for (const m of groupPool) m.visible = m.id === defaultLayer?.id
    return
  }
  const compDur = Math.max(1, project.comp.duration || 5)
  const shotIn = defaultLayer?.inPoint ?? 0
  const shotOut = defaultLayer?.outPoint ?? compDur
  const tStart = Math.max(0, params.timeStart ?? shotIn)
  const tEnd = Math.max(tStart + 0.2, Math.min(compDur, params.timeEnd ?? shotOut))
  const isSubSegment = tStart > shotIn + 0.05 || tEnd < shotOut - 0.05

  if (!isSubSegment || chosenLayer.id === defaultLayer?.id) {
    for (const m of groupPool) {
      m.visible = m.id === chosenLayer.id
      m.transform.opacity.value = 1
    }
    return
  }

  const holdAfterEnd = Boolean(params.partSwapHoldAfterEnd)
  for (const m of groupPool) {
    const isChosen = m.id === chosenLayer.id
    const isDefault = m.id === defaultLayer?.id
    m.visible = isChosen || isDefault
    if (!isChosen && !isDefault) continue
    const activeVal = isChosen ? 1 : 0
    const idleVal = isChosen ? 0 : 1
    m.transform.opacity.value = idleVal
    const pts: { t: number; v: number }[] = []
    if (tStart > shotIn + 0.05) {
      pts.push({ t: Number(shotIn.toFixed(3)), v: idleVal })
      pts.push({ t: Number(Math.max(shotIn, tStart - 0.02).toFixed(3)), v: idleVal })
    }
    pts.push({ t: Number(tStart.toFixed(3)), v: activeVal })
    if (!holdAfterEnd && tEnd < shotOut - 0.05) {
      pts.push({ t: Number(Math.max(tStart + 0.02, tEnd - 0.02).toFixed(3)), v: activeVal })
      pts.push({ t: Number(tEnd.toFixed(3)), v: idleVal })
    } else {
      pts.push({ t: Number(tEnd.toFixed(3)), v: activeVal })
    }
    pts.forEach((pt, idx) => {
      m.transform.opacity.keyframes.push({
        id: `${m.id}-partswap-${node.id}-${idx}`,
        t: pt.t,
        value: pt.v,
        ease: 'linear'
      })
    })
    m.transform.opacity.keyframes.sort((a, b) => a.t - b.t)
  }
}

/** Bake keyframe Cử động & Tư thế riêng của Bộ phận con (`partRotDeg`, `partOffsetX`, `partOffsetY`, `partScalePct`) theo mốc giây */
function bakePartPoseKeysForNode(
  project: Project,
  partLayers: Layer[],
  node: WorkflowNode,
  params: WorkflowNodeParams
): void {
  clearPartPoseKeysFromLayers(partLayers, node.id, false)
  if (!node.enabled || partLayers.length === 0) return

  const rotDeg = params.partRotDeg ?? 0
  const offX = params.partOffsetX ?? 0
  const offY = params.partOffsetY ?? 0
  const scalePct = params.partScalePct ?? 100
  const hasPose =
    Math.abs(rotDeg) >= 0.5 ||
    Math.abs(offX) >= 0.5 ||
    Math.abs(offY) >= 0.5 ||
    Math.abs(scalePct - 100) >= 1
  if (!hasPose) return

  const compDur = Math.max(1, project.comp.duration || 5)
  const tStart = Math.max(0, params.timeStart ?? 0)
  const tEnd = Math.max(tStart + 0.25, Math.min(compDur, params.timeEnd ?? compDur))
  const span = tEnd - tStart
  const wave = params.partPoseWave ?? 'smooth'

  for (const l of partLayers) {
    const basePos: Vec3 = [...(l.transform.position.value ?? [0, 0, 0])] as Vec3
    const baseRot: Vec3 = [...(l.transform.rotation.value ?? [0, 0, 0])] as Vec3
    const baseScale: Vec3 = [...(l.transform.scale.value ?? [1, 1, 1])] as Vec3
    const scaleMul = Math.max(0.2, Math.min(3.0, scalePct / 100))

    const points: { ratio: number; weight: number }[] =
      wave === 'hold'
        ? [
            { ratio: 0, weight: 1 },
            { ratio: 1, weight: 1 }
          ]
        : wave === 'oscillate'
          ? [
              { ratio: 0, weight: 0 },
              { ratio: 0.2, weight: 1 },
              { ratio: 0.4, weight: -0.75 },
              { ratio: 0.6, weight: 1 },
              { ratio: 0.8, weight: -0.6 },
              { ratio: 1, weight: 0 }
            ]
          : [
              { ratio: 0, weight: 0 },
              { ratio: 0.25, weight: 1 },
              { ratio: 0.78, weight: 1 },
              { ratio: 1, weight: 0 }
            ]

    points.forEach((pt, idx) => {
      const t = Number((tStart + span * pt.ratio).toFixed(3))
      const w = pt.weight
      if (Math.abs(offX) >= 0.5 || Math.abs(offY) >= 0.5) {
        l.transform.position.keyframes.push({
          id: `${l.id}-partpose-${node.id}-p-${idx}`,
          t,
          value: [
            Math.round((basePos[0] + offX * w) * 100) / 100,
            Math.round((basePos[1] + offY * w) * 100) / 100,
            basePos[2]
          ],
          ease: 'easeInOut'
        })
      }
      if (Math.abs(rotDeg) >= 0.5) {
        l.transform.rotation.keyframes.push({
          id: `${l.id}-partpose-${node.id}-r-${idx}`,
          t,
          value: [baseRot[0], baseRot[1], Math.round((baseRot[2] + rotDeg * w) * 100) / 100],
          ease: 'easeInOut'
        })
      }
      if (Math.abs(scalePct - 100) >= 1) {
        const m = 1 + (scaleMul - 1) * Math.abs(w)
        l.transform.scale.keyframes.push({
          id: `${l.id}-partpose-${node.id}-s-${idx}`,
          t,
          value: [
            Number((baseScale[0] * m).toFixed(3)),
            Number((baseScale[1] * m).toFixed(3)),
            baseScale[2]
          ],
          ease: 'easeInOut'
        })
      }
    })

    l.transform.position.keyframes.sort((a, b) => a.t - b.t)
    l.transform.rotation.keyframes.sort((a, b) => a.t - b.t)
    l.transform.scale.keyframes.sort((a, b) => a.t - b.t)
  }
}

/** Đồng bộ Node Bộ Phận Cụm (`part_swap`) xuống các Layer của bộ phận / cụm trong Project */
export function syncPartSwapNodeToProject(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams
): void {
  if (params.partTimeline) { clearPartPoseKeysFromLayers(project.layers, node.id); return }
  const targetIds = new Set(params.targetLayerIds ?? [])
  const firstLayer = project.layers.find((l) => targetIds.has(l.id))
  const members = getClusterMemberLayers(project, params.instanceId, firstLayer)
  const safeMembers = Array.isArray(members) ? members : []
  if (safeMembers.length === 0) return

  // 1. Nếu chọn biến thể trong cùng một Bộ phận / Khe (`swapVariant`)
  if (params.swapVariant) {
    const expressions = detectClusterExpressions(safeMembers)
    const chosenExpr = expressions.find(
      (e) => e.layerId === params.swapVariant || e.slotKey === params.swapVariant || e.label === params.swapVariant
    )
    if (chosenExpr) {
      const exprLayers = expressions
        .map((e) => safeMembers.find((m) => m && m.id === e.layerId))
        .filter((l): l is Layer => Boolean(l))
      const chosenLayer = safeMembers.find((m) => m && m.id === chosenExpr.layerId)
      if (chosenLayer && exprLayers.length > 1) {
        applyTimedVariantSwapToGroup(project, exprLayers, chosenLayer, node, params)
      }
    } else {
      const targetVariantLayer = safeMembers.find(
        (m) =>
          m &&
          (m.id === params.swapVariant ||
            m.id === params.swapTargetLayerId ||
            m.composite?.variant === params.swapVariant ||
            m.composite?.sourceLayerId === params.swapVariant ||
            getClusterPartShortName(m) === params.swapVariant)
      )
      if (targetVariantLayer) {
        const slot = targetVariantLayer.composite?.slot
        const partGroupId = targetVariantLayer.composite?.partGroupId
        const groupPool = slot
          ? safeMembers.filter((m) => m.composite?.slot === slot)
          : partGroupId
            ? safeMembers.filter((m) => m.composite?.partGroupId === partGroupId)
            : targetIds.size > 1
              ? safeMembers.filter((m) => targetIds.has(m.id))
              : []
        if (groupPool.length > 1) {
          applyTimedVariantSwapToGroup(project, groupPool, targetVariantLayer, node, params)
        } else {
          targetVariantLayer.visible = node.enabled
        }
      }
    }
  }

  // 2. Nếu bật/tắt hoặc thay ảnh cho một mảnh bộ phận cụ thể (`swapTargetLayerId`)
  if (params.swapTargetLayerId) {
    const targetPart = safeMembers.find((m) => m && m.id === params.swapTargetLayerId)
    if (targetPart) {
      if (params.swapAssetId && node.enabled && targetPart.type === 'image') {
        targetPart.props.assetId = params.swapAssetId
      } else if (params.swapMode === 'toggle_part') {
        targetPart.visible = node.enabled
      }
    }
  }

  // 3. Nếu là Node con Bộ phận có chỉnh Cử động & Tư thế (`partRotDeg`, `partOffsetX`, `partOffsetY`, `partScalePct`)
  const partLayers = targetIds.size > 0 ? members.filter((m) => targetIds.has(m.id)) : []
  if (partLayers.length > 0) {
    bakePartPoseKeysForNode(project, partLayers, node, params)
  }
}

const isMotPathKeyId = (id: string, nodeId?: string): boolean =>
  nodeId ? id.includes(`-motpath-p-${nodeId}-`) : id.includes('-motpath-p-')

/** Bake quỹ đạo chuyển động vẽ tay 2D (`customMotionPath`) lên các Layer mục tiêu trong khoảng `[timeStart, timeEnd]` */
export function bakeCustomMotionPathToScene(
  project: Project,
  targetLayerIds: string[],
  path: [number, number][],
  options?: {
    timeStart?: number
    timeEnd?: number
    intensity?: number
    loop?: boolean
    cycleDuration?: number
    nodeId?: string
  }
): void {
  const idSet = new Set(targetLayerIds)
  const directLayers = project.layers.filter((l) => idSet.has(l.id))
  const clusterInstIds = new Set(directLayers.map((l) => l.composite?.instanceId).filter((v): v is string => Boolean(v)))
  const layers = project.layers.filter(
    (l) => idSet.has(l.id) || (l.composite?.instanceId && clusterInstIds.has(l.composite.instanceId) && l.composite.lockedGroup !== false)
  )
  const compDur = Math.max(1, project.comp.duration || 5)
  const tStart = Math.max(0, options?.timeStart ?? 0)
  const tEnd = Math.max(tStart + 0.3, Math.min(compDur, options?.timeEnd ?? compDur))
  const nodeId = options?.nodeId

  if (nodeId) {
    clearBboxMotionKeysFromScene(project, nodeId)
  }

  for (const l of layers) {
    l.transform.position.keyframes = l.transform.position.keyframes.filter((k) => {
      if (!isMotPathKeyId(k.id)) return true
      if (nodeId && isMotPathKeyId(k.id, nodeId)) return false
      if (!nodeId) return false
      // Xoá key legacy hoặc key trùng khoảng thời gian
      if (!k.id.includes('-motpath-p-v2-')) return false
      return k.t < tStart - 0.01 || k.t > tEnd + 0.01
    })
  }
  const cleanPath = (path ?? []).filter(
    (pt): pt is [number, number] =>
      Array.isArray(pt) &&
      pt.length >= 2 &&
      typeof pt[0] === 'number' &&
      typeof pt[1] === 'number' &&
      Number.isFinite(pt[0]) &&
      Number.isFinite(pt[1])
  )
  if (cleanPath.length < 2) return

  const span = tEnd - tStart
  const isNorm = cleanPath.every((pt) => Math.abs(pt[0]) <= 1.2 && Math.abs(pt[1]) <= 1.2)
  const compW = project.comp?.width || 1920
  const compH = project.comp?.height || 1080
  const baseScaleX = isNorm ? Math.round(compW * 0.28) : 1
  const baseScaleY = isNorm ? Math.round(compH * 0.36) : 1
  const intensity = Math.max(0.1, Math.min(3.0, options?.intensity ?? 1.0))
  const scaleX = baseScaleX * intensity
  const scaleY = baseScaleY * intensity
  const isLoop = Boolean(options?.loop)
  const closedPath: [number, number][] =
    isLoop &&
    (Math.abs(cleanPath[cleanPath.length - 1][0] - cleanPath[0][0]) > 0.02 ||
      Math.abs(cleanPath[cleanPath.length - 1][1] - cleanPath[0][1]) > 0.02)
      ? [...cleanPath, cleanPath[0]]
      : cleanPath
  const effectivePath = smoothNormalizedStroke(closedPath, 2)
  const rawCycle = options?.cycleDuration && options.cycleDuration > 0.2 ? options.cycleDuration : span
  const numCycles = isLoop ? Math.max(1, Math.min(16, Math.round(span / Math.min(span, rawCycle)))) : 1
  const cycleSpan = span / numCycles
  const tag = nodeId ? `${nodeId}-` : ''
  const sampleCount = effectivePath.length <= 2 ? 1 : 14

  for (const l of layers) {
    const basePos: Vec3 = evaluateCleanLayerPos(l, tStart)
    if (tStart > 0.05) {
      l.transform.position.keyframes.push({
        id: `${l.id}-motpath-p-${tag}pre`,
        t: Number(Math.max(0, tStart - 0.02).toFixed(3)),
        value: [basePos[0], basePos[1], basePos[2]],
        ease: 'linear'
      })
    }
    const p0 = effectivePath[0]
    let keyIdx = 0
    for (let c = 0; c < numCycles; c++) {
      const cStart = tStart + c * cycleSpan
      const startStep = c === 0 ? 0 : 1
      for (let s = startStep; s <= sampleCount; s++) {
        const u = s / sampleCount
        const pt = sampleNormalizedStroke(effectivePath, u)
        const t = Number((cStart + cycleSpan * u).toFixed(3))
        const dx = Math.round((pt[0] - p0[0]) * scaleX * 10) / 10
        const dy = Math.round((isNorm ? -(pt[1] - p0[1]) : pt[1] - p0[1]) * scaleY * 10) / 10
        l.transform.position.keyframes.push({
          id: `${l.id}-motpath-p-${tag}${keyIdx++}`,
          t,
          value: [basePos[0] + dx, basePos[1] + dy, basePos[2]],
          ease: sampleCount === 1 ? 'easeInOut' : 'linear'
        })
      }
    }
    l.transform.position.keyframes.sort((a, b) => a.t - b.t)
  }
}
