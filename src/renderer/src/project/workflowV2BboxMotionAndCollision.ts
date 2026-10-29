import { findWorkflowContact } from './workflowBboxContact'
import { bboxStartPosition, bboxStartScale } from './workflowMotionStart'
import { layerNominalSize } from '../engine/spatial'
import type { Layer, PhysicsImpactPulse, Project, Vec3, WorkflowNodeParams } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { createDefaultLayerPhysics, MATERIAL_PHYSICS_PRESETS } from '../engine/layerPhysicsPresets'
import {
  getClusterMemberLayers,
  getClusterRootLayer,
  getLockedClusterMemberLayers
} from './workflowV2ClusterRigAndSwap'

const isBboxMotKeyId = (id: string, nodeId?: string): boolean =>
  nodeId ? id.includes(`-bboxmot-${nodeId}-`) : id.includes('-bboxmot-')

const isBboxColKeyId = (id: string, nodeId?: string): boolean =>
  nodeId ? id.includes(`-bboxcol-${nodeId}-`) : id.includes('-bboxcol-')

const isGeneratedMotionKeyId = (id: string): boolean =>
  id.includes('-bboxmot-') || id.includes('-bboxcol-') || id.includes('-motpath-p-') || id.includes('-col-')

/**
 * Chuyển đổi qua lại giữa Độ sâu 3D (`position[2]`: càng nhỏ càng gần Camera)
 * và `Z-Index` trực quan cho người dùng (`Z-Index = 1000 - depthZ`: Z-Index càng lớn càng nổi lên trước vật cản).
 */
export const depthToZIndex = (depthZ: number): number => Math.round(1000 - depthZ)
export const zIndexToDepth = (zIndex: number): number => Math.round(1000 - zIndex)

/** Đọc vị trí gốc (#1) của Layer tại mốc `t`, bỏ qua các keyframe sinh tự động bởi Node Motion/Va chạm */
export function evaluateCleanLayerPos(layer: Layer, t: number): Vec3 {
  const cleanKfs = layer.transform.position.keyframes.filter((k) => !isGeneratedMotionKeyId(k.id))
  if (cleanKfs.length === 0) {
    return [...(layer.transform.position.value ?? [0, 0, 0])] as Vec3
  }
  return evaluate({ value: layer.transform.position.value, keyframes: cleanKfs }, t)
}

/** Đọc tỷ lệ gốc (#1) của Layer tại mốc `t`, bỏ qua các keyframe sinh tự động bởi Node Motion/Va chạm */
export function evaluateCleanLayerScale(layer: Layer, t: number): Vec3 {
  const cleanKfs = layer.transform.scale.keyframes.filter((k) => !isGeneratedMotionKeyId(k.id))
  if (cleanKfs.length === 0) {
    return [...(layer.transform.scale.value ?? [1, 1, 1])] as Vec3
  }
  return evaluate({ value: layer.transform.scale.value, keyframes: cleanKfs }, t)
}

/** Gỡ toàn bộ keyframe chuyển động BBox (`-bboxmot-`) và va chạm BBox (`-bboxcol-`) do Node sinh ra */
export function clearBboxMotionKeysFromScene(project: Project, nodeId?: string): void {
  for (const l of project.layers) {
    l.transform.position.keyframes = l.transform.position.keyframes.filter(
      (k) => !isBboxMotKeyId(k.id, nodeId) && !isBboxColKeyId(k.id, nodeId)
    )
    l.transform.scale.keyframes = l.transform.scale.keyframes.filter(
      (k) => !isBboxMotKeyId(k.id, nodeId) && !isBboxColKeyId(k.id, nodeId)
    )
    l.transform.rotation.keyframes = l.transform.rotation.keyframes.filter(
      (k) => !isBboxColKeyId(k.id, nodeId)
    )
    if (l.physics?.impacts?.length && nodeId) {
      l.physics.impacts = l.physics.impacts.filter((imp) => !imp.id.startsWith(`wf-bboxcol-${nodeId}`))
    }
  }
}

/** Ước lượng kích thước cơ sở (width, height) của 1 Layer hoặc Cụm 2.5D trong không gian cảnh */
export function estimateLayerWorldSize(project: Project, layer: Layer): { w: number; h: number } {
  const [w, h] = layerNominalSize(layer)
  return { w, h }
}

/** Làm mượt đường vẽ tay 2D (giữ nguyên điểm đầu & điểm cuối) để triệt tiêu hiện tượng giật tay chuột */
export function smoothNormalizedStroke(
  path: [number, number][],
  passes = 2
): [number, number][] {
  if (path.length <= 2) return path
  let pts = path.map((p): [number, number] => [p[0], p[1]])
  for (let pass = 0; pass < passes; pass++) {
    const next: [number, number][] = [pts[0]]
    for (let i = 1; i < pts.length - 1; i++) {
      next.push([
        0.25 * pts[i - 1][0] + 0.5 * pts[i][0] + 0.25 * pts[i + 1][0],
        0.25 * pts[i - 1][1] + 0.5 * pts[i][1] + 0.25 * pts[i + 1][1]
      ])
    }
    next.push(pts[pts.length - 1])
    pts = next
  }
  return pts
}

/** Lấy điểm chuẩn hoá trên đường vẽ `customMotionPath` theo tỉ lệ độ dài cung đều `u in [0..1]` */
export function sampleNormalizedStroke(path: [number, number][], u: number): [number, number] {
  if (path.length === 0) return [0.5, 0.5]
  if (path.length === 1) return path[0]
  const clamped = Math.max(0, Math.min(1, u))
  const segLens: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
    segLens.push(d)
    total += d
  }
  if (total < 1e-5) return path[path.length - 1]
  const target = clamped * total
  let acc = 0
  for (let i = 0; i < segLens.length; i++) {
    const seg = segLens[i]
    if (acc + seg >= target || i === segLens.length - 1) {
      const localT = seg > 1e-5 ? (target - acc) / seg : 0
      return [
        path[i][0] + (path[i + 1][0] - path[i][0]) * localT,
        path[i][1] + (path[i + 1][1] - path[i][1]) * localT
      ]
    }
    acc += seg
  }
  return path[path.length - 1]
}

/**
 * Nội suy toạ độ thế giới `(x, y, z, scaleRatio)` tại tiến độ `u in [0..1]` giữa BBox #1 và BBox #2:
 * - `shortest`: Đi theo đường thẳng khoảng cách ngắn nhất từ tâm BBox #1 tới tâm BBox #2.
 * - `custom_curve`: Đi theo đường cong người dùng vẽ nhưng tự động neo điểm đầu khớp BBox #1 và điểm cuối khớp BBox #2.
 */
export function evaluateBboxTrajectoryAt(
  startPos: Vec3,
  targetX: number,
  targetY: number,
  startZ: number,
  targetZ: number,
  targetScaleRatio: number,
  u: number,
  pathType: 'shortest' | 'custom_curve' = 'shortest',
  customPath?: [number, number][]
): { x: number; y: number; z: number; scaleRatio: number } {
  const t = Math.max(0, Math.min(1, u))
  const baseLineX = startPos[0] + (targetX - startPos[0]) * t
  const baseLineY = startPos[1] + (targetY - startPos[1]) * t
  const z = startZ + (targetZ - startZ) * t
  const scaleRatio = 1 + (targetScaleRatio - 1) * t

  if (pathType === 'custom_curve' && customPath && customPath.length >= 2) {
    const smoothPath = smoothNormalizedStroke(customPath, 2)
    const pFirst = smoothPath[0]
    const pLast = smoothPath[smoothPath.length - 1]
    const pCur = sampleNormalizedStroke(smoothPath, t)
    const chordX = pFirst[0] + (pLast[0] - pFirst[0]) * t
    const chordY = pFirst[1] + (pLast[1] - pFirst[1]) * t
    const devNormX = pCur[0] - chordX
    const devNormY = pCur[1] - chordY
    const worldDist = Math.max(320, Math.hypot(targetX - startPos[0], targetY - startPos[1]))
    return {
      x: baseLineX + devNormX * worldDist * 1.15,
      y: baseLineY - devNormY * worldDist * 1.15,
      z,
      scaleRatio
    }
  }

  return { x: baseLineX, y: baseLineY, z, scaleRatio }
}

export interface DetectedPathCollision {
  layerId: string
  layerName: string
  hitTime: number
  hitRatio: number
  hitPoint: [number, number]
  obstacleZ: number
  movingZAtHit: number
  depthRelationAtHit: 'same_plane' | 'in_front' | 'behind'
}

/**
 * Phát hiện các Layer vật cản trong cùng cảnh mà Layer/Cụm 2.5D sẽ đi cắt qua trên hành trình BBox #1 -> #2.
 */
export function detectPathCollisionsInScene(
  project: Project, targetLayerIds: string[], params: WorkflowNodeParams, nodeId = '__bbox_preview__'
): DetectedPathCollision[] {
  // Use the exact baked/eased trajectory in a private copy; never alter project state for a preview.
  const simulation: Project = { ...project, layers: project.layers.map(layer => ({
    ...layer, physics: layer.physics ? { ...layer.physics, impacts: [...(layer.physics.impacts ?? [])] } : undefined,
    transform: { ...layer.transform,
      position: { ...layer.transform.position, keyframes: [...layer.transform.position.keyframes] },
      scale: { ...layer.transform.scale, keyframes: [...layer.transform.scale.keyframes] },
      rotation: { ...layer.transform.rotation, keyframes: [...layer.transform.rotation.keyframes] }
    }
  })) }
  bakeBboxTargetMotionToScene(simulation, targetLayerIds, { ...params, collisionOnPathEnabled: false }, nodeId)
  const direct = simulation.layers.filter(l => targetLayerIds.includes(l.id))
  if (!direct.length) return []
  const instance = params.instanceId ?? direct.find(l => l.composite?.instanceId)?.composite?.instanceId
  const members = instance ? getClusterMemberLayers(simulation, instance) : direct
  const root = getClusterRootLayer(members) ?? direct[0]
  const moving = new Set(members.map(l => l.id))
  const start = params.timeStart ?? root.inPoint
  const end = Math.min(project.comp.duration, params.timeEnd ?? start + 3)
  const flat = params.depthMode !== 'depth_z'
  const result: DetectedPathCollision[] = []
  for (const obstacle of simulation.layers) {
    if (moving.has(obstacle.id) || obstacle.type === 'particles' ||
      (obstacle.type === 'solid' && Boolean(obstacle.props.pattern)) ||
      (obstacle.composite?.instanceId && !obstacle.composite.isRoot) ||
      (params.collisionTargetLayerId && params.collisionTargetLayerId !== obstacle.id)) continue
    const hit = findWorkflowContact(simulation, root, obstacle, start, end, flat ? Number.MAX_VALUE : 24)
    if (!hit) continue
    result.push({ layerId: obstacle.id, layerName: obstacle.composite?.compositeName || obstacle.name,
      hitTime: hit.time, hitRatio: (hit.time - start) / Math.max(0.001, end - start),
      hitPoint: [hit.positionA[0], hit.positionA[1]], obstacleZ: hit.positionB[2],
      movingZAtHit: hit.positionA[2], depthRelationAtHit: 'same_plane' })
  }
  return result.sort((a, b) => a.hitTime - b.hitTime)
}

/**
 * Bake chuyển động BBox #1 -> #2 (bao gồm nội suy vị trí mượt 60fps không dừng ngắt quãng,
 * phóng to/thu nhỏ khớp BBox #2, chiều sâu Z vượt qua / bị che bởi vật cản, và phản ứng va chạm) xuống Project.
 */
export function bakeBboxTargetMotionToScene(
  project: Project,
  targetLayerIds: string[],
  params: WorkflowNodeParams,
  nodeId: string
): void {
  // 1. Gỡ sạch keyframe cũ của node này trước khi đọc vị trí gốc #1
  clearBboxMotionKeysFromScene(project, nodeId)

  const idSet = new Set(targetLayerIds)
  const directLayers = project.layers.filter((l) => idSet.has(l.id))
  if (directLayers.length === 0) return

  const instId = params.instanceId ?? directLayers.find((l) => l.composite?.instanceId)?.composite?.instanceId
  const members = instId ? getLockedClusterMemberLayers(project, instId) : directLayers
  const effectiveLayers = members.length > 0 ? members : directLayers
  const rootLayer = getClusterRootLayer(effectiveLayers) ?? effectiveLayers[0]
  if (!rootLayer) return

  const compDur = Math.max(1, project.comp.duration || 5)
  const tStart = Math.max(0, params.timeStart ?? rootLayer.inPoint ?? 0)
  const tEnd = Math.max(tStart + 0.3, Math.min(compDur, params.timeEnd ?? tStart + 3))
  const span = Math.max(0.3, tEnd - tStart)

  // Gỡ cả keyframe `-motpath-p-` và `-rig-p-` trùng khoảng thời gian để tránh xung đột gây giật
  for (const m of effectiveLayers) {
    m.transform.position.keyframes = m.transform.position.keyframes.filter((k) => {
      if (nodeId && k.id.includes(`-motpath-p-${nodeId}-`)) return false
      if ((k.id.includes('-motpath-p-') || k.id.includes('-rig-p-')) && k.t >= tStart - 0.02 && k.t <= tEnd + 0.02) return false
      return true
    })
  }

  const rootBasePos: Vec3 = bboxStartPosition(rootLayer, tStart, nodeId)
  const targetX = params.bboxTargetX ?? Math.round(rootBasePos[0] + 280)
  const targetY = params.bboxTargetY ?? Math.round(rootBasePos[1])
  const targetScaleRatio = Math.max(0.15, Math.min(4.0, (params.bboxTargetScalePct ?? 135) / 100))

  const depthMode = params.depthMode ?? 'flat_2d'
  const startZ = params.bboxStartZ ?? rootBasePos[2]
  let targetZ = startZ

  if (depthMode === 'depth_z') {
    const refLayer = params.depthRefLayerId ? project.layers.find((l) => l.id === params.depthRefLayerId) : undefined
    if (refLayer) {
      const refZ = evaluateCleanLayerPos(refLayer, tStart)[2]
      targetZ =
        params.depthRelation === 'behind'
          ? Math.max(params.bboxTargetZ ?? refZ + 60, refZ + 30)
          : Math.min(params.bboxTargetZ ?? refZ - 60, refZ - 30)
    } else if (typeof params.bboxTargetZ === 'number') {
      targetZ = params.bboxTargetZ
    } else {
      targetZ = Math.round(startZ - (targetScaleRatio - 1) * 180)
    }
  }

  // Kiểm tra va chạm trên đường đi nếu bật `collisionOnPathEnabled`
  const collisions = params.collisionOnPathEnabled
    ? detectPathCollisionsInScene(project, targetLayerIds, params, nodeId)
    : []
  const activeCollision =
    (params.collisionTargetLayerId
      ? collisions.find((c) => c.layerId === params.collisionTargetLayerId)
      : undefined) ?? collisions[0]
  const colResponse = params.collisionResponse ?? 'bounce'
  const hitRatio = activeCollision ? Math.max(0.15, Math.min(0.92, activeCollision.hitRatio)) : null

  const pathType = params.bboxPathType ?? 'shortest'
  const isLoop = Boolean(params.customMotionLoop)
  const cycleDur = isLoop
    ? Math.max(0.3, Math.min(span, params.customMotionCycleSec ?? span))
    : span
  const cycles = isLoop ? Math.max(1, Math.ceil(span / cycleDur)) : 1

  // Xây dựng tập điểm mẫu tiến độ `uSteps` tối giản để di chuyển mượt tuyệt đối (không chia đoạn easeInOut thừa!)
  let uSteps: number[]
  if (pathType === 'shortest') {
    if (hitRatio === null) {
      // Đường thẳng ngắn nhất không va chạm: chỉ 2 keyframe đầu-cuối giúp easeInOut mượt 60fps liền mạch!
      uSteps = [0, 1]
    } else if (colResponse === 'stop' || colResponse === 'bounce' || colResponse === 'push') {
      uSteps = [0, hitRatio, 1]
    } else {
      const pre = Number(Math.max(0.05, hitRatio - 0.08).toFixed(3))
      const post = Number(Math.min(0.95, hitRatio + 0.08).toFixed(3))
      uSteps = Array.from(new Set([0, pre, hitRatio, post, 1])).sort((a, b) => a - b)
    }
  } else {
    // Đường cong vẽ tay: lấy 14 mẫu cách đều độ dài cung với nội suy tuyến tính mượt
    uSteps = Array.from({ length: 15 }, (_, idx) => Number((idx / 14).toFixed(4)))
  }

  for (const m of effectiveLayers) {
    const mBasePos: Vec3 = bboxStartPosition(m, tStart, nodeId)
    const mBaseScale: Vec3 = bboxStartScale(m, tStart, nodeId)
    const relX = mBasePos[0] - rootBasePos[0]
    const relY = mBasePos[1] - rootBasePos[1]
    const relZ = mBasePos[2] - rootBasePos[2]

    // Nếu tStart > 0.05s, neo giữ trạng thái gốc ngay trước tStart để layer không bị trôi trước mốc chạy
    if (tStart > 0.05 && !m.transform.position.keyframes.some(k => k.t <= tStart)) {
      const preT = Number(Math.max(0, tStart - 0.02).toFixed(3))
      m.transform.position.keyframes.push({
        id: `${m.id}-bboxmot-${nodeId}-p-pre`,
        t: preT,
        value: [mBasePos[0], mBasePos[1], startZ + relZ],
        ease: 'linear'
      })
      m.transform.scale.keyframes.push({
        id: `${m.id}-bboxmot-${nodeId}-s-pre`,
        t: preT,
        value: [...mBaseScale] as Vec3,
        ease: 'linear'
      })
    }

    let keyIdx = 0
    for (let c = 0; c < cycles; c++) {
      const cStart = tStart + c * cycleDur
      if (cStart >= tEnd - 0.01) break

      for (let s = 0; s < uSteps.length; s++) {
        if (c > 0 && s === 0) continue
        const rawU = uSteps[s]
        const t = Number((cStart + rawU * cycleDur).toFixed(3))
        if (t > tEnd + 0.005) break

        // Nếu có va chạm dừng ('stop') hoặc nảy bật ('bounce'), biến đổi tiến độ u sau thời điểm chạm
        let effU = rawU
        if (hitRatio !== null && rawU > hitRatio) {
          if (colResponse === 'stop') {
            effU = hitRatio
          } else if (colResponse === 'bounce') {
            const post = (rawU - hitRatio) / Math.max(0.08, 1 - hitRatio)
            effU = Math.max(0, hitRatio - post * hitRatio * 0.48)
          }
        }

        const pt = evaluateBboxTrajectoryAt(
          rootBasePos,
          targetX,
          targetY,
          startZ,
          targetZ,
          targetScaleRatio,
          effU,
          pathType,
          params.customMotionPath
        )

        let shakeX = 0
        let shakeY = 0
        if (hitRatio !== null && colResponse === 'shake' && Math.abs(rawU - hitRatio) <= 0.09) {
          const decay = 1 - Math.abs(rawU - hitRatio) / 0.09
          shakeX = (s % 2 === 0 ? 1 : -1) * 24 * decay
          shakeY = (s % 2 === 0 ? -1 : 1) * 14 * decay
        }

        const mx = Math.round((pt.x + relX * pt.scaleRatio + shakeX) * 100) / 100
        const my = Math.round((pt.y + relY * pt.scaleRatio + shakeY) * 100) / 100
        const mz = Math.round((pt.z + relZ) * 100) / 100

        const segEase =
          pathType === 'shortest' && hitRatio === null
            ? 'easeInOut'
            : hitRatio !== null && Math.abs(rawU - hitRatio) < 0.02
              ? 'easeOut'
              : 'linear'

        m.transform.position.keyframes.push({
          id: `${m.id}-bboxmot-${nodeId}-p-${keyIdx}`,
          t,
          value: [mx, my, mz],
          ease: segEase
        })

        let squashX = 1
        let squashY = 1
        if (
          hitRatio !== null &&
          (colResponse === 'jelly' || colResponse === 'bounce') &&
          Math.abs(rawU - hitRatio) <= 0.02
        ) {
          squashX = 0.82
          squashY = 1.2
        }

        m.transform.scale.keyframes.push({
          id: `${m.id}-bboxmot-${nodeId}-s-${keyIdx}`,
          t,
          value: [
            Number((mBaseScale[0] * pt.scaleRatio * squashX).toFixed(3)),
            Number((mBaseScale[1] * pt.scaleRatio * squashY).toFixed(3)),
            mBaseScale[2]
          ],
          ease: segEase
        })

        keyIdx++
      }
    }

    m.transform.position.keyframes.sort((a, b) => a.t - b.t)
    m.transform.scale.keyframes.sort((a, b) => a.t - b.t)
  }

  // 2. Nếu có va chạm với Layer vật cản trên đường đi, tạo phản ứng vật lý cho cả Layer vật cản!
  if (activeCollision) {
    const obsLayer = project.layers.find((l) => l.id === activeCollision.layerId)
    if (obsLayer) {
      const tHit = activeCollision.hitTime
      const tRecover = Number(Math.min(tEnd, tHit + 0.55).toFixed(3))
      const obsBasePos: Vec3 = evaluateCleanLayerPos(obsLayer, tHit)
      const obsBaseScale: Vec3 = evaluateCleanLayerScale(obsLayer, tHit)
      const dirX = targetX >= rootBasePos[0] ? 1 : -1
      const dirY = targetY >= rootBasePos[1] ? 1 : -1

      const matTag = obsLayer.physics?.material && obsLayer.physics.material !== 'none'
        ? obsLayer.physics.material
        : 'wood_tree'
      const preset = MATERIAL_PHYSICS_PRESETS[matTag] ?? MATERIAL_PHYSICS_PRESETS.wood_tree
      const basePhys = obsLayer.physics ?? createDefaultLayerPhysics(matTag)
      const pulse: PhysicsImpactPulse = {
        id: `wf-bboxcol-${nodeId}`,
        time: tHit,
        type: colResponse === 'jelly' ? 'press' : 'punch',
        velocity: [dirX * 680, dirY * 180, 0],
        contactUV: [0.5, 0.55],
        sourceLayerId: rootLayer.id,
        duration: 0.85
      }
      obsLayer.physics = {
        ...basePhys,
        enabled: true,
        material: matTag,
        bounciness: preset.bounciness,
        impacts: [...(basePhys.impacts ?? []).filter((i) => i.id !== pulse.id), pulse]
      }

      if (colResponse === 'push') {
        const minClearance = Math.abs(targetX - obsBasePos[0]) + 150
        const pushX = dirX * Math.max(150, Math.round(minClearance))
        const pushY = Math.round((targetY - rootBasePos[1]) * 0.22)
        const preHitT = Number(Math.max(obsLayer.inPoint ?? 0, tStart).toFixed(3))
        if (tHit > preHitT + 0.02) {
          obsLayer.transform.position.keyframes.push({
            id: `${obsLayer.id}-bboxcol-${nodeId}-op-pre`,
            t: preHitT,
            value: [...obsBasePos] as Vec3,
            ease: 'linear'
          })
        }
        obsLayer.transform.position.keyframes.push(
          {
            id: `${obsLayer.id}-bboxcol-${nodeId}-op0`,
            t: tHit,
            value: [...obsBasePos] as Vec3,
            ease: 'easeOut'
          },
          {
            id: `${obsLayer.id}-bboxcol-${nodeId}-op1`,
            t: tRecover,
            value: [obsBasePos[0] + pushX, obsBasePos[1] + pushY, obsBasePos[2]],
            ease: 'easeOut'
          }
        )
        obsLayer.transform.position.keyframes.sort((a, b) => a.t - b.t)
      }

      // Hiệu ứng rung / lún đàn hồi trên Layer vật cản tại tHit
      const tPeak = Number(Math.min(tEnd, tHit + 0.08).toFixed(3))
      obsLayer.transform.scale.keyframes.push(
        {
          id: `${obsLayer.id}-bboxcol-${nodeId}-os0`,
          t: tHit,
          value: [...obsBaseScale] as Vec3,
          ease: 'linear'
        },
        {
          id: `${obsLayer.id}-bboxcol-${nodeId}-os1`,
          t: tPeak,
          value: [
            Number((obsBaseScale[0] * 1.16).toFixed(3)),
            Number((obsBaseScale[1] * 0.86).toFixed(3)),
            obsBaseScale[2]
          ],
          ease: 'easeOut'
        },
        {
          id: `${obsLayer.id}-bboxcol-${nodeId}-os2`,
          t: tRecover,
          value: [...obsBaseScale] as Vec3,
          ease: 'easeOut'
        }
      )
      obsLayer.transform.scale.keyframes.sort((a, b) => a.t - b.t)
    }
  }
}
