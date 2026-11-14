import { scaleClusterFromSnapshot } from './clusterTransform'
import type { Layer, Project, Vec3 } from '@shared/types'
import type { LayerBone, LayerRig } from '@shared/layerRig'
import { findCompositeTemplate } from '../ui/layerAssembly/scenePartSwap'
import {
  MOTION_PRESETS,
  createClipFromPreset,
  type MotionPresetArchetype,
  type ProceduralMotionPreset
} from '../ui/layerAssembly/workshopRigPresets'
import {
  buildCleanTrajectoryTrack,
  captureTrajectorySnapshot,
  inferClusterBoneId,
  resolveClusterRigBones,
  sampleTrajectoryAwareRigKeyframes,
  type TrajectorySnapshot
} from './workflowV2RigSampling'

export { captureTrajectorySnapshot, type TrajectorySnapshot }

export interface ClusterRigPresetOption {
  id: ProceduralMotionPreset
  archetype: MotionPresetArchetype
  label: string
  shortLabel: string
  icon: string
  duration: number
  description: string
}

export const WORKFLOW_V2_RIG_PRESET_OPTIONS: ClusterRigPresetOption[] = MOTION_PRESETS.map((p) => ({
  id: p.id,
  archetype: p.archetype,
  label: `${p.icon} ${p.name}`,
  shortLabel: `${p.icon} ${p.name.replace(/\s*\([^)]*\)/, '')}`,
  icon: p.icon,
  duration: p.duration,
  description: p.description
}))

export interface ClusterExpressionEntry {
  layerId: string
  slotKey: string
  label: string
  visible: boolean
}

export interface ClusterAccessoryEntry {
  layerId: string
  label: string
  visible: boolean
}

/** Tìm toàn bộ các Layer thuộc cùng Cụm 2.5D (`composite.instanceId`) hoặc Mô hình 3D (`model3d.instanceId`) */
export function getClusterMemberLayers(project: Project, instanceId?: string | null, fallbackLayer?: Layer | null): Layer[] {
  if (!project || !Array.isArray(project.layers)) return fallbackLayer ? [fallbackLayer] : []
  const instId = instanceId || fallbackLayer?.composite?.instanceId || fallbackLayer?.model3d?.instanceId
  if (!instId) return fallbackLayer ? [fallbackLayer] : []
  return project.layers.filter((l) => l && (l.composite?.instanceId === instId || l.model3d?.instanceId === instId))
}

/** Tìm các Layer thuộc Cụm đang thực sự kết nối (khoá theo cụm `lockedGroup !== false`) vào Node Khoá Cụm */
export function getLockedClusterMemberLayers(project: Project, instanceId?: string | null, fallbackLayer?: Layer | null): Layer[] {
  return getClusterMemberLayers(project, instanceId, fallbackLayer).filter((l) => {
    if (l.composite) return l.composite.lockedGroup !== false
    if (l.model3d) return l.model3d.lockedGroup !== false
    return true
  })
}

/** Tìm Layer đóng vai trò Gốc neo (`isRoot`) của một cụm 2.5D hoặc khối 3D */
export function getClusterRootLayer(members: Layer[] | undefined | null): Layer | undefined {
  if (!Array.isArray(members) || members.length === 0) return undefined
  return members.find((l) => l?.composite?.isRoot) ?? members[0]
}

/** Đổi Gốc neo định vị (`isRoot`) của cụm 2.5D sang một mảnh con mới và tính lại `rootOffset` cho các mảnh khác */
export function setClusterRootLayer(members: Layer[] | undefined | null, newRootId: string): void {
  if (!Array.isArray(members) || members.length === 0) return
  const nextRoot = members.find((l) => l?.id === newRootId)
  if (!nextRoot) return
  const rp = nextRoot.transform.position.value
  for (const m of members) {
    if (!m.composite) continue
    m.composite.isRoot = m.id === nextRoot.id
    const mp = m.transform.position.value
    m.composite.rootOffset = [
      Math.round((mp[0] - rp[0]) * 100) / 100,
      Math.round((mp[1] - rp[1]) * 100) / 100,
      Math.round((mp[2] - rp[2]) * 100) / 100
    ]
  }
}

const SLUG_PART_LABELS: Record<string, string> = {
  'arm-left': 'Bắp tay trái',
  'arm-right': 'Bắp tay phải',
  'forearm-left': 'Cẳng tay trái',
  'forearm-right': 'Cẳng tay phải',
  'thigh-left': 'Đùi trái',
  'thigh-right': 'Đùi phải',
  'shin-left': 'Cẳng chân trái',
  'shin-right': 'Cẳng chân phải',
  torso: 'Thân áo',
  head: 'Đầu & Tóc',
  'face-normal': 'Mặt thường',
  'face-happy': 'Mặt cười',
  glasses: 'Kính mắt'
}

/** Khôi phục tên ngắn gọn của mảnh con trong cụm (ưu tiên tên bộ phận trong Xưởng 2.5D, bỏ tiền tố `[Tên Cụm]` lặp lại) */
export function getClusterPartShortName(layer: Layer): string {
  const raw = (layer.name || 'Mảnh con').replace(/^\[[^\]]+\]\s*/, '').trim()
  const lowerRaw = raw.toLowerCase()
  if (SLUG_PART_LABELS[lowerRaw]) return SLUG_PART_LABELS[lowerRaw]
  if (layer.composite?.compositeId && layer.composite?.sourceLayerId) {
    const tpl = findCompositeTemplate(layer.composite.compositeId)
    const found = tpl?.layers.find((it) => it.id === layer.composite?.sourceLayerId)
    if (found?.name) {
      const cleaned = found.name.replace(/^\d+[A-Z]?\.\s*/, '').trim()
      return SLUG_PART_LABELS[cleaned.toLowerCase()] || cleaned
    }
  }
  return raw || layer.name || 'Mảnh con'
}

/** Phát hiện danh sách các layer Biểu cảm khuôn mặt (`face-*` / `Biểu cảm *`) có thể chuyển đổi 1 chạm trong cụm */
export function detectClusterExpressions(members: Layer[]): ClusterExpressionEntry[] {
  const out: ClusterExpressionEntry[] = []
  for (const l of members) {
    const src = (l.composite?.sourceLayerId || l.composite?.slot || '').toLowerCase()
    const shortName = getClusterPartShortName(l)
    const nameLow = shortName.toLowerCase()
    const isFaceExpr =
      src.includes('face') ||
      nameLow.startsWith('biểu cảm') ||
      nameLow.includes('face expression') ||
      nameLow.includes('khuôn mặt:')
    if (!isFaceExpr) continue
    const cleanLabel = shortName
      .replace(/^biểu cảm\s*\d*\s*:\s*/i, '')
      .replace(/\s*\(ẩn sẵn\)/i, '')
      .trim()
    out.push({
      layerId: l.id,
      slotKey: src || l.id,
      label: cleanLabel || shortName,
      visible: l.visible !== false
    })
  }
  return out
}

/** Phát hiện các layer Phụ kiện tách rời (Kính cận, mũ, vũ khí, áo choàng...) có thể bật/tắt nhanh trong cụm */
export function detectClusterAccessories(members: Layer[]): ClusterAccessoryEntry[] {
  const out: ClusterAccessoryEntry[] = []
  for (const l of members) {
    const src = (l.composite?.sourceLayerId || l.composite?.slot || '').toLowerCase()
    const shortName = getClusterPartShortName(l)
    const nameLow = shortName.toLowerCase()
    const isAcc =
      src.includes('glass') ||
      src.includes('hat') ||
      src.includes('weapon') ||
      src.includes('cape') ||
      src.includes('acc') ||
      nameLow.includes('mắt kính') ||
      nameLow.includes('gọng kính') ||
      nameLow.includes('(bật/tắt)')
    if (!isAcc) continue
    out.push({
      layerId: l.id,
      label: shortName.replace(/\s*\(bật\/tắt\)/i, '').trim() || shortName,
      visible: l.visible !== false
    })
  }
  return out
}

const isRigKeyId = (id: string, nodeId?: string): boolean => {
  if (nodeId) return id.includes(`-rig-p-${nodeId}-`) || id.includes(`-rig-r-${nodeId}-`)
  return id.includes('-rig-p-') || id.includes('-rig-r-')
}

/** Gỡ sạch toàn bộ keyframe hành động xương (`-rig-`) trên các layer của cụm và trả về tư thế đứng chuẩn */
export function clearClusterRigKeysFromScene(
  members: Layer[],
  nodeId?: string,
  timeRange?: [number, number]
): void {
  if (members.length === 0) return
  const root = getClusterRootLayer(members)
  if (!root) return

  const rootBasePos: Vec3 = [...(root.transform.position.value ?? [0, 0, 0])] as Vec3
  const rootOff: Vec3 = [...(root.composite?.rootOffset ?? [0, 0, 0])] as Vec3
  const centerOrigin: Vec3 = [
    rootBasePos[0] - rootOff[0],
    rootBasePos[1] - rootOff[1],
    rootBasePos[2] - rootOff[2]
  ]

  const matchDrop = (k: { id: string; t: number }): boolean => {
    if (!isRigKeyId(k.id)) return false
    if (!nodeId && !timeRange) return true
    if (nodeId && isRigKeyId(k.id, nodeId)) return true
    if (!k.id.includes('-rig-p-v2-') && !k.id.includes('-rig-r-v2-')) return true
    if (timeRange && k.t > timeRange[0] + 0.015 && k.t < timeRange[1] - 0.015) return true
    return false
  }

  const savedComp = findCompositeTemplate(root.composite?.compositeId)

  for (const l of members) {
    l.transform.position.keyframes = l.transform.position.keyframes.filter((k) => !matchDrop(k))
    l.transform.rotation.keyframes = l.transform.rotation.keyframes.filter((k) => !matchDrop(k))
    const hasRemainingRig =
      l.transform.position.keyframes.some((k) => isRigKeyId(k.id)) ||
      l.transform.rotation.keyframes.some((k) => isRigKeyId(k.id))
    if (!hasRemainingRig) {
      const hasTraj =
        l.transform.position.keyframes.some((k) => k.id.includes('-bboxmot-') || k.id.includes('-motpath-p-')) ||
        l.transform.rotation.keyframes.some((k) => k.id.includes('-bboxmot-') || k.id.includes('-motpath-p-'))
      if (!hasTraj) {
        const off: Vec3 = l.composite?.rootOffset ?? [0, 0, 0]
        l.transform.position.value = [
          Math.round((centerOrigin[0] + off[0]) * 100) / 100,
          Math.round((centerOrigin[1] + off[1]) * 100) / 100,
          Math.round((centerOrigin[2] + off[2]) * 100) / 100
        ]
      }
      const savedItem = savedComp?.layers.find((it) => it.id === l.composite?.sourceLayerId)
      l.transform.rotation.value = [0, 0, savedItem?.rotation ?? 0]
    }
  }
}

function applyPresetToCustomSoftRig(
  layer: Layer,
  preset: ProceduralMotionPreset,
  intensity: number
): boolean {
  const rig = layer.mesh?.skin?.rig
  if (!layer.mesh?.skin?.binding?.boneId || !rig?.bones?.length || !rig.clips?.length) return false
  const clip = rig.clips.find((c) => c.presetKey === preset || c.id === preset)
  if (!clip) return false
  const scaledTracks: LayerRig['tracks'] = {}
  for (const [boneId, keys] of Object.entries(clip.tracks)) {
    scaledTracks[boneId] = keys.map((k) => ({
      ...k,
      x: Math.round(k.x * intensity * 100) / 100,
      y: Math.round(k.y * intensity * 100) / 100,
      rotation: Math.round(k.rotation * intensity * 100) / 100,
      ...(k.scaleX !== undefined ? { scaleX: Math.round((1 + (k.scaleX - 1) * intensity) * 1000) / 1000 } : {}),
      ...(k.scaleY !== undefined ? { scaleY: Math.round((1 + (k.scaleY - 1) * intensity) * 1000) / 1000 } : {})
    }))
  }
  rig.tracks = scaledTracks
  rig.duration = clip.duration
  rig.loop = clip.loop
  rig.activeClipId = clip.id
  return true
}

/**
 * Bake trực tiếp một Hành động Xương Nhân vật 2.5D (`idle`, `walk`, `wave`, `bow`, `run`, `jump`, `action`, `sway`...)
 * lên toàn bộ các mảnh bộ phận của Cụm 2.5D trong khoảng `[timeStart, timeEnd]`.
 */
export function bakeClusterRigPresetToScene(
  project: Project,
  instanceId: string,
  preset: ProceduralMotionPreset,
  options?: {
    timeStart?: number
    timeEnd?: number
    intensity?: number
    nodeId?: string
    rigBonePreset?: string
    trajSnapshot?: TrajectorySnapshot
  }
): number {
  const members = getClusterMemberLayers(project, instanceId)
  if (members.length === 0) return 0
  const root = getClusterRootLayer(members)
  if (!root) return 0

  const compDur = Math.max(1, project.comp.duration || 5)
  const tStart = Math.max(0, options?.timeStart ?? root.inPoint ?? 0)
  const tEnd = Math.max(tStart + 0.3, Math.min(compDur, options?.timeEnd ?? root.outPoint ?? compDur))

  // 1. Dọn sạch keyframe rig cũ của cùng Node hoặc trùng miền thời gian (idempotent 100%)
  clearClusterRigKeysFromScene(members, options?.nodeId, options?.nodeId ? [tStart, tEnd] : undefined)

  // 2. Xác định bộ xương chuẩn theo hình thái (Người, Thú 4 chân, Chim, Quái vật, Chuỗi uốn)
  const savedComp = findCompositeTemplate(root.composite?.compositeId)
  const bones: LayerBone[] = resolveClusterRigBones(members, savedComp, preset, options?.rigBonePreset)

  const preferredAngle = savedComp?.rig?.clips?.[0]?.viewAngle
  const clip = createClipFromPreset(preset, bones, undefined, preferredAngle)
  const rig: LayerRig = {
    bones,
    duration: clip.duration,
    loop: true,
    tracks: clip.tracks,
    clips: [clip],
    activeClipId: clip.id
  }

  const span = tEnd - tStart
  const intensity = Math.max(0.15, Math.min(2.2, options?.intensity ?? 1.0))
  const savedRoot = savedComp?.layers.find((it) => it.id === root.composite?.sourceLayerId)
  const rootItemScale = Math.max(0.08, Math.abs((savedRoot?.scale ?? 1) * (savedRoot?.scaleX ?? 1)))
  const baseRootScale = Math.max(0.08, Math.abs(root.transform.scale.value?.[0] ?? 0.72))
  const baseScale = baseRootScale / rootItemScale
  const rootOff: Vec3 = [...(root.composite?.rootOffset ?? [0, 0, 0])] as Vec3
  const rootSnap = options?.trajSnapshot?.get(root.id)
  const rootTrajTrack = rootSnap
    ? { value: [...root.transform.position.value] as Vec3, keyframes: rootSnap.pos }
    : buildCleanTrajectoryTrack(root.transform.position.keyframes, root.transform.position.value)
  const rootScaleTrack = rootSnap
    ? { value: [...root.transform.scale.value] as Vec3, keyframes: rootSnap.scale }
    : {
        value: [...root.transform.scale.value] as Vec3,
        keyframes: root.transform.scale.keyframes.map((k) => ({ ...k, value: [...k.value] as Vec3 }))
      }
  const rootRotTrack = rootSnap
    ? { value: [...root.transform.rotation.value] as Vec3, keyframes: rootSnap.rot }
    : buildCleanTrajectoryTrack(root.transform.rotation.keyframes, root.transform.rotation.value)
  const nodeTag = options?.nodeId ? `${options.nodeId}-` : ''

  let animatedCount = 0
  for (const l of members) {
    if (applyPresetToCustomSoftRig(l, preset, intensity)) {
      animatedCount++
      continue
    }
    const savedLayer = savedComp?.layers.find((it) => it.id === l.composite?.sourceLayerId)
    const boneId = inferClusterBoneId(l, bones, savedLayer?.boneId)
    if (!boneId) continue
    if (
      sampleTrajectoryAwareRigKeyframes({
        layer: l,
        root,
        boneId,
        rig,
        baseScale,
        baseRotZ: savedLayer?.rotation ?? 0,
        baseRootScale,
        rootOff,
        rootTrajTrack,
        rootScaleTrack,
        rootRotTrack,
        tStart,
        span,
        intensity,
        nodeTag
      })
    ) {
      animatedCount++
    }
  }
  return animatedCount
}

/** Dịch chuyển đồng bộ toàn bộ các mảnh trong Cụm 2.5D / Khối 3D theo vị trí mới của Gốc neo */
export function translateClusterToRootPos(members: Layer[], nextRootPos: Partial<{ x: number; y: number; z: number }>): void {
  const root = getClusterRootLayer(members)
  if (!root) return
  const curRoot = root.transform.position.value
  const dx = nextRootPos.x !== undefined ? nextRootPos.x - curRoot[0] : 0
  const dy = nextRootPos.y !== undefined ? nextRootPos.y - curRoot[1] : 0
  const dz = nextRootPos.z !== undefined ? nextRootPos.z - curRoot[2] : 0
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001 && Math.abs(dz) < 0.001) return

  for (const l of members) {
    const p = l.transform.position.value
    l.transform.position.value = [
      Math.round((p[0] + dx) * 100) / 100,
      Math.round((p[1] + dy) * 100) / 100,
      Math.round((p[2] + dz) * 100) / 100
    ]
    for (const kf of l.transform.position.keyframes) {
      kf.value = [
        Math.round((kf.value[0] + dx) * 100) / 100,
        Math.round((kf.value[1] + dy) * 100) / 100,
        Math.round((kf.value[2] + dz) * 100) / 100
      ]
    }
    if (l.composite?.centerPosition) {
      l.composite.centerPosition = [
        Math.round((l.composite.centerPosition[0] + dx) * 100) / 100,
        Math.round((l.composite.centerPosition[1] + dy) * 100) / 100,
        Math.round((l.composite.centerPosition[2] + dz) * 100) / 100
      ]
    }
  }
}

/** Phóng to / thu nhỏ đồng bộ toàn bộ các mảnh trong Cụm 2.5D quanh Gốc neo (bảo toàn vị trí ghép nối) */
export function scaleClusterAroundRoot(members: Layer[], nextScalePct: number): void {
  const root = getClusterRootLayer(members)
  if (!root) return
  const curScale = Math.max(0.05, Math.abs(root.transform.scale.value[0] || 1))
  const nextScale = Math.max(0.05, Math.min(4.0, nextScalePct / 100))
  const ratio = nextScale / curScale
  if (Math.abs(ratio - 1) < 0.002) return

  const sources = members.map(l => ({
    ...l, transform: {
      ...l.transform,
      position: { ...l.transform.position, keyframes: [...l.transform.position.keyframes] },
      scale: { ...l.transform.scale, keyframes: [...l.transform.scale.keyframes] }
    },
    composite: l.composite ? { ...l.composite } : undefined,
    model3d: l.model3d ? { ...l.model3d } : undefined
  }))
  scaleClusterFromSnapshot(members, sources, [...root.transform.position.value], ratio)
}

export {
  clearPartPoseKeysFromLayers,
  syncPartSwapNodeToProject,
  bakeCustomMotionPathToScene
} from './workflowV2PartAndPathBake'
export * from './workflowV2ClusterActionsAndAttach'

