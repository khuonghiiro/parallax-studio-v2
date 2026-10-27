import type { CompositeCustomAction, Layer, Project, Vec3, WorkflowNode } from '@shared/types'
import { BUILTIN_COMPOSITES, getStoredComposites, saveComposite } from '../ui/layerAssembly/layerAssemblyStorage'

function findCompositeTemplateLocal(compositeId?: string) {
  if (!compositeId) return undefined
  return getStoredComposites().find((c) => c.id === compositeId) ?? BUILTIN_COMPOSITES.find((c) => c.id === compositeId)
}
import {
  detectClusterExpressions,
  getClusterMemberLayers,
  getClusterPartShortName,
  getClusterRootLayer
} from './workflowV2ClusterRigAndSwap'
import { extractCompositeDynamicParts } from './workflowV2CompositeParts'

export interface ClusterDynamicActionItem {
  id: string
  name: string
  icon: string
  kind: 'sprite_cycle' | 'part_pose' | 'rig_clip' | 'plant_spine'
  /** Danh sách ID layer trong cảnh (Scene Layer IDs) tham gia động tác */
  layerIds: string[]
  speedHz: number
  duration: number
  loop: boolean
  rotDeg?: number
  rigClipId?: string
  isCustomSaved?: boolean
}

const isDynActKeyId = (id: string, nodeId?: string): boolean =>
  nodeId ? id.includes(`-dynact-${nodeId}-`) : id.includes('-dynact-')

/** Gỡ keyframe động tác đặt tên động (`-dynact-`) khỏi danh sách Layer */
export function clearClusterCustomActionKeys(layers: Layer[], nodeId?: string): void {
  for (const l of layers) {
    l.transform.opacity.keyframes = l.transform.opacity.keyframes.filter((k) => !isDynActKeyId(k.id, nodeId))
    l.transform.rotation.keyframes = l.transform.rotation.keyframes.filter((k) => !isDynActKeyId(k.id, nodeId))
  }
}

/** Ánh xạ danh sách ID mảnh trong mẫu Xưởng (`sourceLayerId`) hoặc ID cảnh sang Scene Layer IDs thực tế */
function resolveSceneLayerIdsForAction(members: Layer[], rawIds: string[]): string[] {
  if (!Array.isArray(members) || members.length === 0) return []
  const out: string[] = []
  for (const rawId of rawIds) {
    const found = members.find(
      (m) =>
        m &&
        (m.id === rawId ||
          m.composite?.sourceLayerId === rawId ||
          getClusterPartShortName(m).toLowerCase() === rawId.toLowerCase())
    )
    if (found && !out.includes(found.id)) out.push(found.id)
  }
  return out
}

/**
 * Lấy danh sách các Động tác có Tên Động của Cụm 2.5D (từ Tab `Animation` / `Motion` trong Xưởng 2.5D
 * + các động tác nhép miệng / nháy mắt / đổi biểu cảm tự phát hiện từ các mảnh biến thể).
 */
export function extractClusterDynamicActions(
  project: Project,
  instanceId?: string,
  fallbackLayer?: Layer
): ClusterDynamicActionItem[] {
  const members = getClusterMemberLayers(project, instanceId, fallbackLayer)
  if (members.length === 0) return []
  const root = getClusterRootLayer(members) ?? members[0]
  const compId = root?.composite?.compositeId
  const template = findCompositeTemplateLocal(compId)
  const items: ClusterDynamicActionItem[] = []
  const seenIds = new Set<string>()

  // 1. Các động tác đặt tên động (`customActions`) lưu trên Root Layer hoặc trong mẫu Xưởng 2.5D
  const savedList: CompositeCustomAction[] = [
    ...(root?.composite?.customActions ?? []),
    ...(template?.customActions ?? [])
  ]
  for (const act of savedList) {
    if (!act?.id || seenIds.has(act.id)) continue
    seenIds.add(act.id)
    const sceneIds = resolveSceneLayerIdsForAction(members, act.layerIds ?? [])
    items.push({
      id: act.id,
      name: act.name || 'Động tác tuỳ chỉnh',
      icon: act.icon || (act.kind === 'part_pose' ? '👋' : '👄'),
      kind: act.kind,
      layerIds: sceneIds.length > 0 ? sceneIds : members.slice(0, 2).map((m) => m.id),
      speedHz: act.speedHz ?? 4.0,
      duration: act.duration ?? 2.5,
      loop: act.loop !== false,
      rotDeg: act.rotDeg ?? 15,
      rigClipId: act.rigClipId,
      isCustomSaved: true
    })
  }

  // 2. Các Clip xương có tên động trong Tab `Animation` của Xưởng 2.5D (`template.rig.clips`)
  for (const clip of template?.rig?.clips ?? []) {
    const cid = `clip:${clip.id}`
    if (seenIds.has(cid)) continue
    seenIds.add(cid)
    items.push({
      id: cid,
      name: clip.name || clip.id,
      icon: '🦴',
      kind: 'rig_clip',
      layerIds: members.map((m) => m.id),
      speedHz: 1.0,
      duration: Math.max(0.5, clip.duration || 2.5),
      loop: clip.loop !== false,
      rigClipId: clip.id
    })
  }

  // 3. Các Xương Motion có tên động trong Tab `Motion` của Xưởng 2.5D (`template.plantSpines`)
  for (const spine of template?.plantSpines ?? []) {
    const sid = `spine:${spine.id}`
    if (seenIds.has(sid)) continue
    seenIds.add(sid)
    const spineLayers = resolveSceneLayerIdsForAction(members, spine.layerIds ?? [])
    items.push({
      id: sid,
      name: spine.name || 'Chuyển động uốn 2.5D',
      icon: '🌿',
      kind: 'plant_spine',
      layerIds: spineLayers.length > 0 ? spineLayers : members.map((m) => m.id),
      speedHz: spine.speed ?? 1.0,
      duration: 3.0,
      loop: true,
      rotDeg: spine.amplitude ?? 14
    })
  }

  // 4. Tự động tạo các động tác Nhép miệng / Nháy mắt / Đổi biểu cảm từ các bộ phận có >= 2 mảnh biến thể
  const expressions = detectClusterExpressions(members)
  if (expressions.length >= 2) {
    const exprIds = expressions.map((e) => e.layerId)
    const mouthFiltered = expressions
      .filter((e) => /miệng|môi|talk|nói|cười|vui|mở|happy|open/i.test(e.label))
      .map((e) => e.layerId)
    const blinkFiltered = expressions
      .filter((e) => /mắt|nháy|chớp|nhắm|blink|eye|wink|sleep/i.test(e.label))
      .map((e) => e.layerId)

    if (!items.some((x) => /nhép miệng|mouth/i.test(x.name))) {
      items.push({
        id: 'auto:mouth_talk',
        name: 'Nhép miệng nói',
        icon: '👄',
        kind: 'sprite_cycle',
        layerIds: mouthFiltered.length >= 2 ? mouthFiltered : exprIds.slice(0, 3),
        speedHz: 4.5,
        duration: 2.5,
        loop: true
      })
    }
    if (!items.some((x) => /nháy mắt|blink/i.test(x.name))) {
      items.push({
        id: 'auto:eye_blink',
        name: 'Nháy mắt tự nhiên',
        icon: '👁',
        kind: 'sprite_cycle',
        layerIds: blinkFiltered.length >= 2 ? blinkFiltered : exprIds.slice(0, 2),
        speedHz: 0.8,
        duration: 2.5,
        loop: true
      })
    }
  }

  const parts = extractCompositeDynamicParts(project, instanceId, root)
  for (const part of parts) {
    if (part.layerIds.length < 2) continue
    const pid = `auto:part_${part.id}`
    if (seenIds.has(pid) || part.id === 'face') continue
    seenIds.add(pid)
    items.push({
      id: pid,
      name: `Chuyển động: ${part.title}`,
      icon: part.icon || '🔄',
      kind: 'sprite_cycle',
      layerIds: part.layerIds,
      speedHz: 2.0,
      duration: 2.5,
      loop: true
    })
  }

  return items
}

/** Lưu hoặc đổi tên một Động tác đặt tên động (`CompositeCustomAction`) cho Cụm 2.5D */
export function saveClusterCustomAction(
  project: Project,
  instanceId: string | undefined,
  action: CompositeCustomAction,
  fallbackLayer?: Layer
): void {
  const members = getClusterMemberLayers(project, instanceId, fallbackLayer)
  const root = getClusterRootLayer(members) ?? members[0]
  if (!root?.composite) return

  const prevList = [...(root.composite.customActions ?? [])]
  const idx = prevList.findIndex((a) => a.id === action.id)
  if (idx >= 0) {
    prevList[idx] = { ...prevList[idx], ...action }
  } else {
    prevList.push(action)
  }
  root.composite.customActions = prevList

  const tpl = findCompositeTemplateLocal(root.composite.compositeId)
  if (tpl) {
    const tplActions = [...(tpl.customActions ?? [])]
    const tIdx = tplActions.findIndex((a) => a.id === action.id)
    if (tIdx >= 0) tplActions[tIdx] = { ...tplActions[tIdx], ...action }
    else tplActions.push(action)
    try {
      saveComposite({ ...tpl, customActions: tplActions, updatedAt: Date.now() })
    } catch {
      /* ignore storage errors in headless tests */
    }
  }
}

/** Bake động tác đặt tên động (`sprite_cycle` nhép miệng/nháy mắt hoặc `part_pose`) lên Cụm 2.5D theo mốc giây */
export function bakeClusterCustomActionToScene(
  project: Project,
  instanceId: string | undefined,
  actionId: string,
  options?: {
    timeStart?: number
    timeEnd?: number
    speedHz?: number
    nodeId?: string
    fallbackLayer?: Layer
  }
): boolean {
  const members = getClusterMemberLayers(project, instanceId, options?.fallbackLayer)
  if (members.length === 0) return false
  clearClusterCustomActionKeys(members, options?.nodeId)

  const catalog = extractClusterDynamicActions(project, instanceId, options?.fallbackLayer)
  const item = catalog.find((a) => a.id === actionId || a.name === actionId)
  if (!item) return false

  const compDur = Math.max(1, project.comp.duration || 5)
  const tStart = Math.max(0, options?.timeStart ?? 0)
  const tEnd = Math.max(tStart + 0.25, Math.min(compDur, options?.timeEnd ?? tStart + item.duration))
  const span = tEnd - tStart
  const hz = Math.max(0.25, Math.min(10, options?.speedHz ?? item.speedHz ?? 3.5))
  const tag = options?.nodeId ? `${options.nodeId}-` : ''

  const safeMembers = Array.isArray(members) ? members : []
  const targetLayers = item.layerIds
    .map((id) => safeMembers.find((m) => m && m.id === id))
    .filter((l): l is Layer => Boolean(l))

  if (item.kind === 'sprite_cycle' && targetLayers.length >= 2) {
    const stepSec = Math.max(0.06, 1 / (hz * 2))
    const totalSteps = Math.max(2, Math.min(80, Math.round(span / stepSec)))
    for (let idx = 0; idx < targetLayers.length; idx++) {
      const l = targetLayers[idx]
      l.visible = true
      l.transform.opacity.value = idx === 0 ? 1 : 0
      for (let s = 0; s <= totalSteps; s++) {
        const t = Number((tStart + (span * s) / totalSteps).toFixed(3))
        const activeIdx = s === totalSteps ? 0 : s % targetLayers.length
        l.transform.opacity.keyframes.push({
          id: `${l.id}-dynact-${tag}op-${s}`,
          t,
          value: activeIdx === idx ? 1 : 0,
          ease: 'linear'
        })
      }
      l.transform.opacity.keyframes.sort((a, b) => a.t - b.t)
    }
    return true
  }

  // Fallback hoặc part_pose / plant_spine: xoay nhịp nhàng các mảnh trong khoảng [tStart, tEnd]
  const poseLayers = targetLayers.length > 0 ? targetLayers : members
  const deg = item.rotDeg ?? 14
  const stepSec = Math.max(0.1, 1 / (hz * 2))
  const totalSteps = Math.max(2, Math.min(60, Math.round(span / stepSec)))
  for (const l of poseLayers) {
    const baseRot: Vec3 = [...(l.transform.rotation.value ?? [0, 0, 0])] as Vec3
    for (let s = 0; s <= totalSteps; s++) {
      const t = Number((tStart + (span * s) / totalSteps).toFixed(3))
      const sign = s === 0 || s === totalSteps ? 0 : s % 2 === 1 ? 1 : -0.65
      l.transform.rotation.keyframes.push({
        id: `${l.id}-dynact-${tag}rot-${s}`,
        t,
        value: [baseRot[0], baseRot[1], Math.round((baseRot[2] + deg * sign) * 100) / 100],
        ease: 'easeInOut'
      })
    }
    l.transform.rotation.keyframes.sort((a, b) => a.t - b.t)
  }
  return true
}

/**
 * Khi kết nối 1 Layer mới bên ngoài vào `Node Khoá Cụm 2.5D` (`cluster_lock`) trên Workflow:
 * Tự động khoá trạng thái của Layer đó vào cùng Cụm 2.5D (`instanceId`) và tính `rootOffset`
 * để người dùng cấu hình vị trí công cụ/đạo cụ ngay trên Workflow mà không cần vào Xưởng 2.5D.
 */
export function attachExternalLayerToClusterV2(
  project: Project,
  externalLayerIds: string[],
  clusterNode: WorkflowNode
): string[] {
  const p = clusterNode.params ?? {}
  const existingMemberIds = p.targetLayerIds ?? []
  const firstExisting = project.layers.find((l) => existingMemberIds.includes(l.id))
  const members = getClusterMemberLayers(project, p.instanceId, firstExisting)
  const rootLayer = getClusterRootLayer(members) ?? firstExisting
  if (!rootLayer) return []

  const instId = p.instanceId ?? rootLayer.composite?.instanceId ?? `comp-inst-${rootLayer.id}`
  const compId = p.compositeId ?? rootLayer.composite?.compositeId ?? 'custom-workflow-cluster'
  const compName =
    rootLayer.composite?.compositeName ??
    clusterNode.title.replace(/^🔒\s*Khoá Cụm:\s*/i, '').trim() ??
    'Cụm 2.5D'
  const isLocked = p.lockedGroup !== false
  const rootPos: Vec3 = [...(rootLayer.transform.position.value ?? [0, 0, 0])] as Vec3

  if (!rootLayer.composite) {
    rootLayer.composite = {
      instanceId: instId,
      compositeId: compId,
      compositeName: compName,
      isRoot: true,
      lockedGroup: isLocked,
      centerPosition: [...rootPos],
      rootOffset: [0, 0, 0],
      sourceLayerId: rootLayer.id
    }
  }

  const attachedIds: string[] = []
  for (const extId of externalLayerIds) {
    const layer = project.layers.find((l) => l.id === extId)
    if (!layer || layer.id === rootLayer.id) continue
    const pos: Vec3 = [...(layer.transform.position.value ?? [0, 0, 0])] as Vec3
    const dx = Math.round((pos[0] - rootPos[0]) * 100) / 100
    const dy = Math.round((pos[1] - rootPos[1]) * 100) / 100
    const dz = Math.round((pos[2] - rootPos[2]) * 100) / 100
    layer.shotId = rootLayer.shotId
    layer.composite = {
      instanceId: instId,
      compositeId: compId,
      compositeName: compName,
      isRoot: false,
      lockedGroup: isLocked,
      centerPosition: [...rootPos],
      rootOffset: [dx, dy, dz],
      sourceLayerId: layer.composite?.sourceLayerId ?? layer.id,
      partGroupId: layer.composite?.partGroupId ?? 'attached_prop'
    }
    attachedIds.push(layer.id)
  }

  if (attachedIds.length > 0) {
    const mergedTargets = Array.from(new Set([...existingMemberIds, ...attachedIds]))
    clusterNode.params = {
      ...clusterNode.params,
      instanceId: instId,
      compositeId: compId,
      targetLayerIds: mergedTargets,
      childLayerCount: mergedTargets.length,
      activeMemberLayerId: attachedIds[0]
    }
  }
  return attachedIds
}

/**
 * Cập nhật vị trí tương đối (`rootOffset` X, Y, Z), tỉ lệ (`scalePct`) và góc xoay (`rotDeg`)
 * của một Layer thành viên (hoặc công cụ/đạo cụ mới gắn vào) trong Cụm 2.5D ngay trên Workflow.
 */
export function updateClusterMemberOffsetV2(
  project: Project,
  instanceId: string | undefined,
  memberLayerId: string,
  patch: {
    offsetX?: number
    offsetY?: number
    offsetZ?: number
    scalePct?: number
    rotDeg?: number
  },
  fallbackLayer?: Layer
): void {
  const members = getClusterMemberLayers(project, instanceId, fallbackLayer)
  const safeMembers = Array.isArray(members) ? members : []
  const root = getClusterRootLayer(safeMembers)
  const target = safeMembers.find((m) => m && m.id === memberLayerId) ?? project.layers.find((l) => l.id === memberLayerId)
  if (!target || !root) return

  const rootPos: Vec3 = [...(root.transform.position.value ?? [0, 0, 0])] as Vec3
  const curPos: Vec3 = [...(target.transform.position.value ?? [0, 0, 0])] as Vec3
  const curOff: Vec3 = target.composite?.rootOffset
    ? ([...target.composite.rootOffset] as Vec3)
    : [curPos[0] - rootPos[0], curPos[1] - rootPos[1], curPos[2] - rootPos[2]]

  const nextOff: Vec3 = [
    patch.offsetX !== undefined ? Math.round(patch.offsetX * 100) / 100 : curOff[0],
    patch.offsetY !== undefined ? Math.round(patch.offsetY * 100) / 100 : curOff[1],
    patch.offsetZ !== undefined ? Math.round(patch.offsetZ * 100) / 100 : curOff[2]
  ]

  target.transform.position.value = [
    Math.round((rootPos[0] + nextOff[0]) * 100) / 100,
    Math.round((rootPos[1] + nextOff[1]) * 100) / 100,
    Math.round((rootPos[2] + nextOff[2]) * 100) / 100
  ]
  if (target.composite) {
    target.composite.rootOffset = nextOff
  }

  if (patch.scalePct !== undefined) {
    const s = Math.max(0.05, Math.min(4.0, patch.scalePct / 100))
    const curS = target.transform.scale.value
    const signX = curS[0] < 0 ? -1 : 1
    const signY = curS[1] < 0 ? -1 : 1
    target.transform.scale.value = [
      Number((s * signX).toFixed(3)),
      Number((s * signY).toFixed(3)),
      curS[2] ?? 1
    ]
  }

  if (patch.rotDeg !== undefined) {
    const curR = target.transform.rotation.value
    target.transform.rotation.value = [curR[0] ?? 0, curR[1] ?? 0, Math.round(patch.rotDeg * 100) / 100]
  }
}
