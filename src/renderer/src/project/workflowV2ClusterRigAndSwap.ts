import type { Layer, Project, Vec3 } from '@shared/types'
import type { LayerBone, LayerRig } from '@shared/layerRig'
import { evaluateRig, transformRigLayer } from '../engine/layerRig'
import { findCompositeTemplate } from '../ui/layerAssembly/scenePartSwap'
import { CUTOUT_FRONT_BONES } from '../ui/layerAssembly/templates/humanoidTemplates'
import {
  MOTION_PRESETS,
  createClipFromPreset,
  createSimpleChainBones,
  type ProceduralMotionPreset
} from '../ui/layerAssembly/workshopRigPresets'

export interface ClusterRigPresetOption {
  id: ProceduralMotionPreset
  label: string
  shortLabel: string
  icon: string
  duration: number
  description: string
}

export const WORKFLOW_V2_RIG_PRESET_OPTIONS: ClusterRigPresetOption[] = MOTION_PRESETS.map((p) => ({
  id: p.id,
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

/** Suy luận ID xương (`boneId`) của từng mảnh bộ phận trong Cụm Nhân vật Anime 2.5D / Sinh vật / Cây cối */
function inferBoneIdForClusterLayer(layer: Layer, bones: LayerBone[], savedBoneId?: string): string | undefined {
  if (savedBoneId && bones.some((b) => b.id === savedBoneId)) return savedBoneId
  const key = `${layer.composite?.sourceLayerId ?? ''} ${layer.composite?.slot ?? ''} ${layer.name ?? ''}`.toLowerCase()

  const hasBone = (id: string): string | undefined => (bones.some((b) => b.id === id) ? id : undefined)

  if (key.includes('forearm-l') || key.includes('forearm_l') || key.includes('cẳng tay trái') || key.includes('bàn tay trái')) {
    return hasBone('bone-forearm-l') ?? hasBone('bone-arm-l')
  }
  if (key.includes('forearm-r') || key.includes('forearm_r') || key.includes('cẳng tay phải') || key.includes('bàn tay phải') || key.includes('đồng hồ')) {
    return hasBone('bone-forearm-r') ?? hasBone('bone-arm-r')
  }
  if (key.includes('arm-l') || key.includes('arm_l') || key.includes('bắp tay áo trái') || key.includes('bắp tay trái') || key.includes('tay áo sơ mi trái')) {
    return hasBone('bone-arm-l')
  }
  if (key.includes('arm-r') || key.includes('arm_r') || key.includes('bắp tay áo phải') || key.includes('bắp tay phải') || key.includes('tay áo sơ mi phải')) {
    return hasBone('bone-arm-r')
  }
  if (key.includes('shin-l') || key.includes('shin_l') || key.includes('ống quần & giày trái') || key.includes('giày sneaker trái') || key.includes('cẳng chân trái')) {
    return hasBone('bone-shin-l') ?? hasBone('bone-thigh-l')
  }
  if (key.includes('shin-r') || key.includes('shin_r') || key.includes('ống quần & giày phải') || key.includes('giày sneaker phải') || key.includes('cẳng chân phải')) {
    return hasBone('bone-shin-r') ?? hasBone('bone-thigh-r')
  }
  if (key.includes('thigh-l') || key.includes('thigh_l') || key.includes('đùi quần trái') || key.includes('đùi trái')) {
    return hasBone('bone-thigh-l')
  }
  if (key.includes('thigh-r') || key.includes('thigh_r') || key.includes('đùi quần phải') || key.includes('đùi phải')) {
    return hasBone('bone-thigh-r')
  }
  if (
    key.includes('head') ||
    key.includes('face') ||
    key.includes('glass') ||
    key.includes('đầu') ||
    key.includes('mái tóc') ||
    key.includes('biểu cảm') ||
    key.includes('mắt kính') ||
    key.includes('gọng kính')
  ) {
    return hasBone('bone-head') ?? hasBone('bone-chain-tip')
  }
  if (key.includes('torso') || key.includes('thân áo') || key.includes('áo gile') || key.includes('ngực')) {
    return hasBone('bone-torso') ?? hasBone('bone-chain-mid')
  }
  if (key.includes('pelvis') || key.includes('hông')) {
    return hasBone('bone-pelvis') ?? hasBone('bone-chain-root')
  }
  // Với cây cối / cành lá 3 khớp
  if (bones.some((b) => b.id === 'bone-chain-root')) {
    if (key.includes('gốc') || key.includes('thân') || key.includes('root') || key.includes('trunk')) return 'bone-chain-root'
    if (key.includes('ngọn') || key.includes('tán') || key.includes('hoa') || key.includes('tip') || key.includes('canopy')) return 'bone-chain-tip'
    return 'bone-chain-mid'
  }
  return undefined
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
    if (timeRange && k.t >= timeRange[0] - 0.01 && k.t <= timeRange[1] + 0.01) return true
    return false
  }

  for (const l of members) {
    l.transform.position.keyframes = l.transform.position.keyframes.filter((k) => !matchDrop(k))
    l.transform.rotation.keyframes = l.transform.rotation.keyframes.filter((k) => !matchDrop(k))
    const hasRemainingRig =
      l.transform.position.keyframes.some((k) => isRigKeyId(k.id)) ||
      l.transform.rotation.keyframes.some((k) => isRigKeyId(k.id))
    if (!hasRemainingRig) {
      const off: Vec3 = l.composite?.rootOffset ?? [0, 0, 0]
      l.transform.position.value = [
        Math.round((centerOrigin[0] + off[0]) * 100) / 100,
        Math.round((centerOrigin[1] + off[1]) * 100) / 100,
        Math.round((centerOrigin[2] + off[2]) * 100) / 100
      ]
      l.transform.rotation.value = [0, 0, 0]
    }
  }
}

function sampleRigLayerKeyframes(
  l: Layer,
  boneId: string,
  rig: LayerRig,
  centerOrigin: Vec3,
  scale: number,
  tStart: number,
  span: number,
  totalSteps: number,
  intensity: number,
  nodeTag: string
): boolean {
  const off: Vec3 = l.composite?.rootOffset ?? [0, 0, 0]
  const itemX = off[0] / scale
  const itemY = -off[1] / scale
  const itemZ = off[2] / scale
  const virtItem = { x: itemX, y: itemY, z: itemZ, rotation: 0, boneId, scale: 1 }

  const samples: { t: number; pos: Vec3; rot: Vec3 }[] = []
  for (let step = 0; step <= totalSteps; step++) {
    const tScene = Number((tStart + (span * step) / totalSteps).toFixed(3))
    const tClip = ((tScene - tStart) % rig.duration + rig.duration) % rig.duration
    const posed = transformRigLayer(virtItem, evaluateRig(rig, tClip))
    const dx = (posed.x - itemX) * scale * intensity
    const dy = -(posed.y - itemY) * scale * intensity
    const rotZ = posed.rotation * intensity
    samples.push({
      t: tScene,
      pos: [
        Math.round((centerOrigin[0] + off[0] + dx) * 100) / 100,
        Math.round((centerOrigin[1] + off[1] + dy) * 100) / 100,
        Math.round((centerOrigin[2] + off[2]) * 100) / 100
      ],
      rot: [0, 0, Math.round(rotZ * 100) / 100]
    })
  }

  const first = samples[0]
  const hasTrajectoryPosKeys = l.transform.position.keyframes.some(
    (k) => k.id.includes('-bboxmot-') || k.id.includes('-motpath-p-')
  )
  if (!hasTrajectoryPosKeys) {
    l.transform.position.value = first.pos
  }
  l.transform.rotation.value = first.rot

  const isStaticPos = samples.every((s) => Math.hypot(s.pos[0] - first.pos[0], s.pos[1] - first.pos[1]) < 0.05)
  const isStaticRot = samples.every((s) => Math.abs(s.rot[2] - first.rot[2]) < 0.05)
  if (isStaticPos && isStaticRot) return false

  if (!isStaticPos && !hasTrajectoryPosKeys) {
    let lastP: Vec3 | null = null
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]
      if (i === 0 || i === samples.length - 1 || !lastP || Math.hypot(s.pos[0] - lastP[0], s.pos[1] - lastP[1]) >= 0.08) {
        l.transform.position.keyframes.push({ id: `${l.id}-rig-p-${nodeTag}${i}`, t: s.t, value: s.pos, ease: 'linear' })
        lastP = s.pos
      }
    }
    l.transform.position.keyframes.sort((a, b) => a.t - b.t)
  }
  if (!isStaticRot) {
    let lastR: Vec3 | null = null
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]
      if (i === 0 || i === samples.length - 1 || !lastR || Math.abs(s.rot[2] - lastR[2]) >= 0.08) {
        l.transform.rotation.keyframes.push({ id: `${l.id}-rig-r-${nodeTag}${i}`, t: s.t, value: s.rot, ease: 'linear' })
        lastR = s.rot
      }
    }
    l.transform.rotation.keyframes.sort((a, b) => a.t - b.t)
  }
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

  // 2. Xác định bộ xương của cụm
  const compositeId = root.composite?.compositeId
  const savedComp = findCompositeTemplate(compositeId)
  const isHumanoid = members.some((l) => {
    const k = `${l.composite?.sourceLayerId ?? ''} ${l.composite?.slot ?? ''} ${l.name}`.toLowerCase()
    return k.includes('torso') || k.includes('head') || k.includes('arm') || k.includes('thigh') || k.includes('shin') || k.includes('thân áo') || k.includes('đầu')
  })
  const bones: LayerBone[] =
    savedComp?.rig?.bones && savedComp.rig.bones.length > 0
      ? savedComp.rig.bones
      : isHumanoid
        ? CUTOUT_FRONT_BONES
        : createSimpleChainBones()

  const clip = createClipFromPreset(preset, bones)
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
  const totalSteps = Math.max(4, Math.ceil(span * 15))
  const rootPos: Vec3 = [...(root.transform.position.value ?? [0, 0, 0])] as Vec3
  const rootOff: Vec3 = [...(root.composite?.rootOffset ?? [0, 0, 0])] as Vec3
  const centerOrigin: Vec3 = [rootPos[0] - rootOff[0], rootPos[1] - rootOff[1], rootPos[2] - rootOff[2]]
  const scale = Math.max(0.1, Math.abs(root.transform.scale.value?.[0] ?? 0.72))
  const nodeTag = options?.nodeId ? `${options.nodeId}-` : ''

  let animatedCount = 0
  for (const l of members) {
    const savedLayer = savedComp?.layers.find((it) => it.id === l.composite?.sourceLayerId)
    const boneId = inferBoneIdForClusterLayer(l, bones, savedLayer?.boneId)
    if (!boneId) continue
    if (sampleRigLayerKeyframes(l, boneId, rig, centerOrigin, scale, tStart, span, totalSteps, intensity, nodeTag)) {
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

  const rootPos: Vec3 = [...root.transform.position.value] as Vec3
  for (const l of members) {
    const s = l.transform.scale.value
    const signX = s[0] < 0 ? -1 : 1
    const signY = s[1] < 0 ? -1 : 1
    l.transform.scale.value = [
      Number((Math.abs(s[0] || curScale) * ratio * signX).toFixed(3)),
      Number((Math.abs(s[1] || curScale) * ratio * signY).toFixed(3)),
      s[2] ?? 1
    ]
    for (const kf of l.transform.scale.keyframes) {
      kf.value = [
        Number((kf.value[0] * ratio).toFixed(3)),
        Number((kf.value[1] * ratio).toFixed(3)),
        kf.value[2]
      ]
    }
    if (l.id !== root.id) {
      const p = l.transform.position.value
      const relX = (p[0] - rootPos[0]) * ratio
      const relY = (p[1] - rootPos[1]) * ratio
      const relZ = (p[2] - rootPos[2]) * ratio
      l.transform.position.value = [
        Math.round((rootPos[0] + relX) * 100) / 100,
        Math.round((rootPos[1] + relY) * 100) / 100,
        Math.round((rootPos[2] + relZ) * 100) / 100
      ]
      if (l.composite?.rootOffset) {
        l.composite.rootOffset = [
          Math.round(l.composite.rootOffset[0] * ratio * 100) / 100,
          Math.round(l.composite.rootOffset[1] * ratio * 100) / 100,
          Math.round(l.composite.rootOffset[2] * ratio * 100) / 100
        ]
      }
    }
  }
}

export {
  clearPartPoseKeysFromLayers,
  syncPartSwapNodeToProject,
  bakeCustomMotionPathToScene
} from './workflowV2PartAndPathBake'
export * from './workflowV2ClusterActionsAndAttach'

