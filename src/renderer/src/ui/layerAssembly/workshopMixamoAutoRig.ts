import type { AnimationClip, BoneKeyframe, LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { createClipFromPreset, type ProceduralMotionPreset } from './workshopRigPresets'

/**
 * Hệ thống Gắn Điểm Định Vị Khớp Xương & Kế Thừa Động Tác Tự Động (Mixamo-style Auto-Rigger 2.5D).
 * Người dùng chỉ cần đặt các điểm nhấn (Landmarks) lên hình nhân vật (nhỏ, vừa, lớn),
 * hệ thống sẽ tự động tính toán toạ độ, độ dài, góc xoay của toàn bộ khung xương
 * và co giãn biên độ động tác mẫu cho khớp với tỷ lệ cơ thể nhân vật.
 */

export type MixamoLandmarkId =
  | 'headTop'
  | 'neck'
  | 'chest'
  | 'pelvis'
  | 'shoulderL'
  | 'elbowL'
  | 'wristL'
  | 'shoulderR'
  | 'elbowR'
  | 'wristR'
  | 'kneeL'
  | 'ankleL'
  | 'kneeR'
  | 'ankleR'

export interface LandmarkPoint {
  x: number
  y: number
}

export type MixamoLandmarks = Record<MixamoLandmarkId, LandmarkPoint>

export type MixamoRingGroupId = 'chin' | 'wrists' | 'elbows' | 'knees' | 'groin'

export interface MixamoRingGroupMeta {
  groupId: MixamoRingGroupId
  title: string
  viTitle: string
  hint: string
  color: string
  landmarkIds: MixamoLandmarkId[]
}

/**
 * 5 nhóm vòng tròn định vị chuẩn Mixamo Auto-Rigger (tổng cộng 8 vòng tròn tâm rỗng):
 * - CHIN (Cằm): 1 vòng màu Xanh Cyan (#00d4e5)
 * - WRISTS (Cổ tay): 2 vòng màu Xanh Lá (#8bc34a)
 * - ELBOWS (Khuỷu tay): 2 vòng màu Vàng (#e6d74c)
 * - KNEES (Đầu gối): 2 vòng màu Cam (#e88e2d)
 * - GROIN (Háng / Tâm hông): 1 vòng màu Hồng (#e06287)
 */
export const MIXAMO_RING_GROUPS: MixamoRingGroupMeta[] = [
  {
    groupId: 'chin',
    title: 'CHIN',
    viTitle: 'Cằm',
    hint: 'Đặt vào dưới cằm (khớp cổ/đầu)',
    color: '#00d4e5',
    landmarkIds: ['neck']
  },
  {
    groupId: 'wrists',
    title: 'WRISTS',
    viTitle: 'Cổ tay',
    hint: 'Đặt vào 2 cổ tay trái & phải',
    color: '#8bc34a',
    landmarkIds: ['wristL', 'wristR']
  },
  {
    groupId: 'elbows',
    title: 'ELBOWS',
    viTitle: 'Khuỷu tay',
    hint: 'Đặt vào 2 khuỷu tay trái & phải',
    color: '#e6d74c',
    landmarkIds: ['elbowL', 'elbowR']
  },
  {
    groupId: 'knees',
    title: 'KNEES',
    viTitle: 'Đầu gối',
    hint: 'Đặt vào 2 đầu gối trái & phải',
    color: '#e88e2d',
    landmarkIds: ['kneeL', 'kneeR']
  },
  {
    groupId: 'groin',
    title: 'GROIN',
    viTitle: 'Háng',
    hint: 'Đặt vào giữa háng (gốc hông & trục đối xứng)',
    color: '#e06287',
    landmarkIds: ['pelvis']
  }
]

export const MIXAMO_CORE_LANDMARK_IDS: MixamoLandmarkId[] = [
  'neck',
  'wristL',
  'wristR',
  'elbowL',
  'elbowR',
  'kneeL',
  'kneeR',
  'pelvis'
]

export interface LandmarkMeta {
  id: MixamoLandmarkId
  label: string
  shortLabel: string
  mixamoTag?: string
  color: string
  mirrorId?: MixamoLandmarkId
  radius: number
  isCoreMixamo?: boolean
}

export const MIXAMO_LANDMARK_META: LandmarkMeta[] = [
  // 8 vòng tròn chính chuẩn Mixamo (5 nhóm màu)
  { id: 'neck', label: 'CHIN · Cằm / Cổ', shortLabel: 'Cằm', mixamoTag: 'CHIN', color: '#00d4e5', radius: 7.5, isCoreMixamo: true },
  { id: 'wristL', label: 'WRISTS · Cổ tay trái', shortLabel: 'Cổ tay T', mixamoTag: 'WRISTS', color: '#8bc34a', mirrorId: 'wristR', radius: 7, isCoreMixamo: true },
  { id: 'wristR', label: 'WRISTS · Cổ tay phải', shortLabel: 'Cổ tay P', mixamoTag: 'WRISTS', color: '#8bc34a', mirrorId: 'wristL', radius: 7, isCoreMixamo: true },
  { id: 'elbowL', label: 'ELBOWS · Khuỷu tay trái', shortLabel: 'Khuỷu T', mixamoTag: 'ELBOWS', color: '#e6d74c', mirrorId: 'elbowR', radius: 7, isCoreMixamo: true },
  { id: 'elbowR', label: 'ELBOWS · Khuỷu tay phải', shortLabel: 'Khuỷu P', mixamoTag: 'ELBOWS', color: '#e6d74c', mirrorId: 'elbowL', radius: 7, isCoreMixamo: true },
  { id: 'kneeL', label: 'KNEES · Đầu gối trái', shortLabel: 'Gối T', mixamoTag: 'KNEES', color: '#e88e2d', mirrorId: 'kneeR', radius: 7, isCoreMixamo: true },
  { id: 'kneeR', label: 'KNEES · Đầu gối phải', shortLabel: 'Gối P', mixamoTag: 'KNEES', color: '#e88e2d', mirrorId: 'kneeL', radius: 7, isCoreMixamo: true },
  { id: 'pelvis', label: 'GROIN · Háng (Tâm gốc)', shortLabel: 'Háng', mixamoTag: 'GROIN', color: '#e06287', radius: 8, isCoreMixamo: true },
  // 6 khớp phụ tự động suy ra từ 8 vòng tròn chính (có thể bật tinh chỉnh nâng cao)
  { id: 'headTop', label: 'Đỉnh đầu (Tự động)', shortLabel: 'Đầu', color: '#c084fc', radius: 5, isCoreMixamo: false },
  { id: 'chest', label: 'Ngực / Thân trên (Tự động)', shortLabel: 'Ngực', color: '#60a5fa', radius: 5, isCoreMixamo: false },
  { id: 'shoulderL', label: 'Vai trái (Tự động)', shortLabel: 'Vai T', color: '#34d399', mirrorId: 'shoulderR', radius: 5, isCoreMixamo: false },
  { id: 'shoulderR', label: 'Vai phải (Tự động)', shortLabel: 'Vai P', color: '#34d399', mirrorId: 'shoulderL', radius: 5, isCoreMixamo: false },
  { id: 'ankleL', label: 'Cổ chân trái (Tự động)', shortLabel: 'Chân T', color: '#f87171', mirrorId: 'ankleR', radius: 5, isCoreMixamo: false },
  { id: 'ankleR', label: 'Cổ chân phải (Tự động)', shortLabel: 'Chân P', color: '#f87171', mirrorId: 'ankleL', radius: 5, isCoreMixamo: false }
]

/** Toạ độ chuẩn (scale = 1.0) khớp với bộ xương createHumanoidBones mặc định */
const BASE_LANDMARKS: MixamoLandmarks = {
  headTop: { x: 0, y: -145 },
  neck: { x: 0, y: -85 },
  chest: { x: 0, y: -20 },
  pelvis: { x: 0, y: 30 },
  shoulderL: { x: -35, y: -70 },
  elbowL: { x: -38, y: -15 },
  wristL: { x: -38, y: 35 },
  shoulderR: { x: 35, y: -70 },
  elbowR: { x: 38, y: -15 },
  wristR: { x: 38, y: 35 },
  kneeL: { x: -25, y: 105 },
  ankleL: { x: -25, y: 175 },
  kneeR: { x: 25, y: 105 },
  ankleR: { x: 25, y: 175 }
}

const STANDARD_TOTAL_HEIGHT = 320 // từ headTop (-145) đến ankle (175)

/**
 * Tạo bộ điểm nhấn theo tỉ lệ kích thước (VD: 0.55 = Nhân vật nhỏ/Chibi, 1.0 = Chuẩn, 1.3 = Cao lớn)
 */
export function createScaledLandmarks(scale = 1, offsetX = 0, offsetY = 0): MixamoLandmarks {
  const s = Math.max(0.2, Math.min(3, scale))
  const out = {} as MixamoLandmarks
  for (const [key, pt] of Object.entries(BASE_LANDMARKS) as [MixamoLandmarkId, LandmarkPoint][]) {
    out[key] = {
      x: Math.round(pt.x * s + offsetX),
      y: Math.round(pt.y * s + offsetY)
    }
  }
  return out
}

/**
 * Tự động phân tích vùng bao hoặc các mảnh cơ thể của nhân vật trong composite để đặt điểm nhấn vừa khít
 */
export function autoDetectLandmarksFromComposite(composite: LayerComposite): MixamoLandmarks {
  const visibleLayers = composite.layers.filter((l) => !l.hidden)
  const pool = visibleLayers.length > 0 ? visibleLayers : composite.layers
  const canvasScale = Math.max(0.5, (composite.height || 480) / 480)
  if (pool.length === 0) return createScaledLandmarks(Number(canvasScale.toFixed(2)))

  // Kiểm tra nếu nhân vật được ghép từ các mảnh bộ phận chuẩn (head, torso, arm, forearm, thigh, shin)
  const findPart = (regex: RegExp) => pool.find((l) => regex.test((l.name || '') + ' ' + (l.id || '')))
  const headLayer = findPart(/\b(head|đầu)\b/i)
  const torsoLayer = findPart(/\b(torso|thân|ngực|body)\b/i)
  const shinLLayer = findPart(/shin.*(?:left|[-_]l\b)|cẳng chân.*trái/i)
  const shinRLayer = findPart(/shin.*(?:right|[-_]r\b)|cẳng chân.*phải/i)

  if (headLayer && torsoLayer && (shinLLayer || shinRLayer)) {
    const armL = findPart(/\barm.*(?:left|[-_]l\b)|bắp tay.*trái/i)
    const armR = findPart(/\barm.*(?:right|[-_]r\b)|bắp tay.*phải/i)
    const forearmL = findPart(/forearm.*(?:left|[-_]l\b)|cẳng tay.*trái/i)
    const forearmR = findPart(/forearm.*(?:right|[-_]r\b)|cẳng tay.*phải/i)
    const thighL = findPart(/thigh.*(?:left|[-_]l\b)|đùi.*trái/i)
    const thighR = findPart(/thigh.*(?:right|[-_]r\b)|đùi.*phải/i)

    const s = torsoLayer.scale || 1
    const cx = Math.round(torsoLayer.x)
    const neckY = Math.round((headLayer.y + torsoLayer.y) * 0.5)
    const headTopY = Math.round(headLayer.y - Math.max(40, Math.abs(neckY - headLayer.y) * 0.6))
    const chestY = Math.round(torsoLayer.y + 15 * s)
    const pelvisY = thighL ? Math.round((torsoLayer.y + thighL.y) * 0.5 + 10 * s) : Math.round(torsoLayer.y + 115 * s)

    const shLX = armL ? Math.round(armL.x + 10 * s) : cx - Math.round(90 * s)
    const shRX = armR ? Math.round(armR.x - 10 * s) : cx + Math.round(90 * s)
    const shY = armL ? Math.round(armL.y - 75 * s) : neckY + Math.round(15 * s)

    const elLX = forearmL ? Math.round(forearmL.x) : shLX - Math.round(15 * s)
    const elRX = forearmR ? Math.round(forearmR.x) : shRX + Math.round(15 * s)
    const elY = forearmL && armL ? Math.round((armL.y + forearmL.y) * 0.5) : chestY + Math.round(30 * s)

    const wrY = forearmL ? Math.round(forearmL.y + Math.max(45, Math.abs(forearmL.y - elY) * 0.85)) : pelvisY + Math.round(55 * s)

    const knLX = thighL ? Math.round(thighL.x - 6 * s) : cx - Math.round(48 * s)
    const knRX = thighR ? Math.round(thighR.x - 4 * s) : cx + Math.round(42 * s)
    const knY =
      thighL && shinLLayer
        ? Math.round((thighL.y + shinLLayer.y) * 0.5 - 8 * s)
        : pelvisY + Math.round(175 * s)

    const ankLX = shinLLayer ? Math.round(shinLLayer.x) : knLX
    const ankRX = shinRLayer ? Math.round(shinRLayer.x) : knRX
    const ankY = shinLLayer
      ? Math.round(shinLLayer.y + Math.max(60, Math.abs(shinLLayer.y - knY) * 0.9))
      : knY + Math.round(190 * s)

    return {
      headTop: { x: cx, y: headTopY },
      neck: { x: cx, y: neckY },
      chest: { x: cx, y: chestY },
      pelvis: { x: cx, y: pelvisY },
      shoulderL: { x: shLX, y: shY },
      elbowL: { x: elLX, y: elY },
      wristL: { x: elLX, y: wrY },
      shoulderR: { x: shRX, y: shY },
      elbowR: { x: elRX, y: elY },
      wristR: { x: elRX, y: wrY },
      kneeL: { x: knLX, y: knY },
      ankleL: { x: ankLX, y: ankY },
      kneeR: { x: knRX, y: knY },
      ankleR: { x: ankRX, y: ankY }
    }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const l of pool) {
    const scale = l.scale || 1
    const halfW = Math.max(45, Math.round((composite.width || 480) * 0.16 * scale))
    const halfH = Math.max(80, Math.round((composite.height || 480) * 0.34 * scale))
    if (l.x - halfW < minX) minX = l.x - halfW
    if (l.x + halfW > maxX) maxX = l.x + halfW
    if (l.y - halfH < minY) minY = l.y - halfH
    if (l.y + halfH > maxY) maxY = l.y + halfH
  }

  const centerX = Math.round((minX + maxX) / 2)
  const centerY = Math.round((minY + maxY) / 2)
  const spanH = Math.max(100, maxY - minY)
  const estimatedScale = Math.max(0.35, Math.min(2.6, (spanH * 0.88) / STANDARD_TOTAL_HEIGHT))

  return createScaledLandmarks(Number(estimatedScale.toFixed(2)), centerX, centerY - Math.round(15 * estimatedScale))
}

/**
 * Khôi phục điểm nhấn từ bộ xương hiện có của nhân vật (nếu nhân vật đã có xương humanoid)
 */
export function extractLandmarksFromBones(bones: LayerBone[]): MixamoLandmarks | null {
  const find = (id: string) => bones.find((b) => b.id === id)
  const pelvis = find('bone-pelvis')
  const torso = find('bone-torso')
  const head = find('bone-head')
  if (!pelvis || !torso || !head) return null

  const tailOf = (b: LayerBone): LandmarkPoint => {
    const rad = (b.angle * Math.PI) / 180
    return {
      x: Math.round(b.x + Math.cos(rad) * b.length),
      y: Math.round(b.y + Math.sin(rad) * b.length)
    }
  }

  const armL = find('bone-arm-l')
  const forearmL = find('bone-forearm-l')
  const armR = find('bone-arm-r')
  const forearmR = find('bone-forearm-r')
  const thighL = find('bone-thigh-l')
  const shinL = find('bone-shin-l')
  const thighR = find('bone-thigh-r')
  const shinR = find('bone-shin-r')

  return {
    pelvis: { x: Math.round(pelvis.x), y: Math.round(pelvis.y) },
    chest: { x: Math.round(torso.x), y: Math.round(torso.y) },
    neck: { x: Math.round(head.x), y: Math.round(head.y) },
    headTop: tailOf(head),
    shoulderL: armL ? { x: Math.round(armL.x), y: Math.round(armL.y) } : { x: torso.x - 35, y: head.y + 15 },
    elbowL: forearmL ? { x: Math.round(forearmL.x), y: Math.round(forearmL.y) } : armL ? tailOf(armL) : { x: -38, y: -15 },
    wristL: forearmL ? tailOf(forearmL) : { x: -38, y: 35 },
    shoulderR: armR ? { x: Math.round(armR.x), y: Math.round(armR.y) } : { x: torso.x + 35, y: head.y + 15 },
    elbowR: forearmR ? { x: Math.round(forearmR.x), y: Math.round(forearmR.y) } : armR ? tailOf(armR) : { x: 38, y: -15 },
    wristR: forearmR ? tailOf(forearmR) : { x: 38, y: 35 },
    kneeL: shinL ? { x: Math.round(shinL.x), y: Math.round(shinL.y) } : thighL ? tailOf(thighL) : { x: -25, y: 105 },
    ankleL: shinL ? tailOf(shinL) : { x: -25, y: 175 },
    kneeR: shinR ? { x: Math.round(shinR.x), y: Math.round(shinR.y) } : thighR ? tailOf(thighR) : { x: 25, y: 105 },
    ankleR: shinR ? tailOf(shinR) : { x: 25, y: 175 }
  }
}

/**
 * Tự động nội suy 6 khớp phụ (Đỉnh đầu, Ngực, 2 Vai, 2 Cổ chân) từ 8 vòng tròn chính của Mixamo
 * (CHIN, WRISTS, ELBOWS, KNEES, GROIN) để người dùng chỉ cần đặt đúng 8 vòng tròn như Mixamo là có đủ 15 xương.
 */
export function syncDerivedLandmarksFromCore8(lm: MixamoLandmarks): MixamoLandmarks {
  const chin = lm.neck
  const groin = lm.pelvis
  const torsoDx = chin.x - groin.x
  const torsoDy = chin.y - groin.y
  const torsoLen = Math.max(20, Math.hypot(torsoDx, torsoDy))

  const chest: LandmarkPoint = {
    x: Math.round(groin.x + torsoDx * 0.435),
    y: Math.round(groin.y + torsoDy * 0.435)
  }

  const headLen = Math.max(24, Math.round(torsoLen * 0.522))
  const headTop: LandmarkPoint = {
    x: chin.x,
    y: Math.round(chin.y - headLen)
  }

  const shY = Math.round(chin.y + (groin.y - chin.y) * 0.13)
  const computeShoulderX = (elbow: LandmarkPoint, side: -1 | 1): number => {
    const dx = elbow.x - chin.x
    const dy = Math.abs(elbow.y - shY)
    const ratio = dy > torsoLen * 0.25 ? 0.92 : 0.48
    const rawOffset = dx * ratio
    const minSpan = Math.max(12, Math.round(torsoLen * 0.18))
    const signedOffset =
      side < 0
        ? Math.min(-minSpan, rawOffset)
        : Math.max(minSpan, rawOffset)
    return Math.round(chin.x + signedOffset)
  }

  const shoulderL: LandmarkPoint = {
    x: computeShoulderX(lm.elbowL, -1),
    y: shY
  }
  const shoulderR: LandmarkPoint = {
    x: computeShoulderX(lm.elbowR, 1),
    y: shY
  }

  const thighDyL = Math.max(18, lm.kneeL.y - groin.y)
  const thighDyR = Math.max(18, lm.kneeR.y - groin.y)
  const ankleL: LandmarkPoint = {
    x: lm.kneeL.x,
    y: Math.round(lm.kneeL.y + thighDyL * 0.933)
  }
  const ankleR: LandmarkPoint = {
    x: lm.kneeR.x,
    y: Math.round(lm.kneeR.y + thighDyR * 0.933)
  }

  return {
    ...lm,
    headTop,
    chest,
    shoulderL,
    shoulderR,
    ankleL,
    ankleR
  }
}

/**
 * Di chuyển một điểm nhấn, hỗ trợ đối xứng gương Trái ⇄ Phải qua trục X của Hông (pelvis.x)
 * và tự động cập nhật các khớp phụ khi di chuyển 1 trong 8 vòng tròn chính của Mixamo.
 */
export function moveLandmarkPoint(
  landmarks: MixamoLandmarks,
  id: MixamoLandmarkId,
  to: LandmarkPoint,
  symmetry = true,
  syncDerived = true
): MixamoLandmarks {
  const rounded = { x: Math.round(to.x), y: Math.round(to.y) }
  const next: MixamoLandmarks = { ...landmarks, [id]: rounded }
  const meta = MIXAMO_LANDMARK_META.find((m) => m.id === id)

  if (symmetry && meta?.mirrorId) {
    const centerX = next.pelvis.x
    const dx = rounded.x - centerX
    next[meta.mirrorId] = {
      x: Math.round(centerX - dx),
      y: rounded.y
    }
  }

  if (syncDerived && meta?.isCoreMixamo) {
    return syncDerivedLandmarksFromCore8(next)
  }
  return next
}

function segmentLengthAndAngle(from: LandmarkPoint, to: LandmarkPoint): { length: number; angle: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.max(8, Math.round(Math.hypot(dx, dy)))
  const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI)
  return { length, angle }
}

/**
 * Tự động sinh ra 15 xương chuẩn Humanoid từ vị trí các điểm nhấn (Mixamo Landmarks)
 */
export function buildHumanoidBonesFromLandmarks(lm: MixamoLandmarks): LayerBone[] {
  const pelvisSeg = segmentLengthAndAngle(lm.pelvis, lm.chest)
  const torsoSeg = segmentLengthAndAngle(lm.chest, lm.neck)
  const headSeg = segmentLengthAndAngle(lm.neck, lm.headTop)

  const armLSeg = segmentLengthAndAngle(lm.shoulderL, lm.elbowL)
  const forearmLSeg = segmentLengthAndAngle(lm.elbowL, lm.wristL)
  const handLLen = Math.max(8, Math.round(forearmLSeg.length * 0.48))

  const armRSeg = segmentLengthAndAngle(lm.shoulderR, lm.elbowR)
  const forearmRSeg = segmentLengthAndAngle(lm.elbowR, lm.wristR)
  const handRLen = Math.max(8, Math.round(forearmRSeg.length * 0.48))

  // Điểm khớp háng trái/phải tự động nội suy từ hông và đầu gối
  const hipOffsetX = Math.max(8, Math.round(Math.abs(lm.kneeR.x - lm.kneeL.x) * 0.42))
  const hipL: LandmarkPoint = { x: lm.pelvis.x - hipOffsetX, y: lm.pelvis.y + Math.max(2, Math.round(pelvisSeg.length * 0.1)) }
  const hipR: LandmarkPoint = { x: lm.pelvis.x + hipOffsetX, y: lm.pelvis.y + Math.max(2, Math.round(pelvisSeg.length * 0.1)) }

  const thighLSeg = segmentLengthAndAngle(hipL, lm.kneeL)
  const shinLSeg = segmentLengthAndAngle(lm.kneeL, lm.ankleL)
  const footLLen = Math.max(10, Math.round(shinLSeg.length * 0.42))

  const thighRSeg = segmentLengthAndAngle(hipR, lm.kneeR)
  const shinRSeg = segmentLengthAndAngle(lm.kneeR, lm.ankleR)
  const footRLen = Math.max(10, Math.round(shinRSeg.length * 0.42))

  return [
    { id: 'bone-pelvis', name: 'Hông (Root)', x: lm.pelvis.x, y: lm.pelvis.y, length: pelvisSeg.length, angle: pelvisSeg.angle },
    { id: 'bone-torso', name: 'Thân / Ngực', parentId: 'bone-pelvis', x: lm.chest.x, y: lm.chest.y, length: torsoSeg.length, angle: torsoSeg.angle },
    { id: 'bone-head', name: 'Đầu', parentId: 'bone-torso', x: lm.neck.x, y: lm.neck.y, length: headSeg.length, angle: headSeg.angle },
    { id: 'bone-arm-l', name: 'Bắp tay trái', parentId: 'bone-torso', x: lm.shoulderL.x, y: lm.shoulderL.y, length: armLSeg.length, angle: armLSeg.angle },
    { id: 'bone-forearm-l', name: 'Cẳng tay trái', parentId: 'bone-arm-l', x: lm.elbowL.x, y: lm.elbowL.y, length: forearmLSeg.length, angle: forearmLSeg.angle },
    { id: 'bone-hand-l', name: 'Bàn tay trái', parentId: 'bone-forearm-l', x: lm.wristL.x, y: lm.wristL.y, length: handLLen, angle: forearmLSeg.angle },
    { id: 'bone-arm-r', name: 'Bắp tay phải', parentId: 'bone-torso', x: lm.shoulderR.x, y: lm.shoulderR.y, length: armRSeg.length, angle: armRSeg.angle },
    { id: 'bone-forearm-r', name: 'Cẳng tay phải', parentId: 'bone-arm-r', x: lm.elbowR.x, y: lm.elbowR.y, length: forearmRSeg.length, angle: forearmRSeg.angle },
    { id: 'bone-hand-r', name: 'Bàn tay phải', parentId: 'bone-forearm-r', x: lm.wristR.x, y: lm.wristR.y, length: handRLen, angle: forearmRSeg.angle },
    { id: 'bone-thigh-l', name: 'Đùi trái', parentId: 'bone-pelvis', x: hipL.x, y: hipL.y, length: thighLSeg.length, angle: thighLSeg.angle },
    { id: 'bone-shin-l', name: 'Cẳng chân trái', parentId: 'bone-thigh-l', x: lm.kneeL.x, y: lm.kneeL.y, length: shinLSeg.length, angle: shinLSeg.angle },
    { id: 'bone-foot-l', name: 'Bàn chân trái', parentId: 'bone-shin-l', x: lm.ankleL.x, y: lm.ankleL.y, length: footLLen, angle: 0 },
    { id: 'bone-thigh-r', name: 'Đùi phải', parentId: 'bone-pelvis', x: hipR.x, y: hipR.y, length: thighRSeg.length, angle: thighRSeg.angle },
    { id: 'bone-shin-r', name: 'Cẳng chân phải', parentId: 'bone-thigh-r', x: lm.kneeR.x, y: lm.kneeR.y, length: shinRSeg.length, angle: shinRSeg.angle },
    { id: 'bone-foot-r', name: 'Bàn chân phải', parentId: 'bone-shin-r', x: lm.ankleR.x, y: lm.ankleR.y, length: footRLen, angle: 0 }
  ]
}

/**
 * Tạo AnimationClip cho bộ xương vừa gắn điểm, tự động co giãn biên độ dịch chuyển (x, y)
 * theo tỉ lệ chiều dài chân thực tế của nhân vật (nhân vật nhỏ bước nhỏ, nhân vật lớn bước rộng).
 */
export function buildMixamoClipForBones(options: {
  preset: ProceduralMotionPreset | 'blank'
  bones: LayerBone[]
  name: string
  viewAngle: MotionViewAngle
  duration: number
  loop: boolean
}): AnimationClip {
  const { preset, bones, name, viewAngle, duration, loop } = options
  if (preset === 'blank') {
    return {
      id: `clip-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      duration: Math.max(0.2, duration),
      loop,
      tracks: {},
      viewAngle,
      description: `Động tác tự do theo góc nhìn ${viewAngle}`
    }
  }

  const rawClip = createClipFromPreset(preset, bones, name, viewAngle)
  rawClip.duration = Math.max(0.2, duration || rawClip.duration)
  rawClip.loop = loop
  rawClip.viewAngle = viewAngle

  return rawClip
}

/**
 * Tự động liên kết (bind) các layer của nhân vật vào bộ xương 15 khớp vừa tạo từ điểm nhấn:
 * - Nếu nhân vật chỉ có 1 layer (ảnh toàn thân), tự gắn Uốn mềm (soft mesh 2D) vào `bone-pelvis` để toàn bộ 15 xương cùng uốn lưới.
 * - Nếu nhân vật có nhiều layer bộ phận (Đầu, Thân, Tay, Chân...), tự động nhận diện theo tên hoặc giữ liên kết hợp lệ.
 */
export function autoBindLayersToMixamoBones(
  layers: LayerComposite['layers'],
  bones: LayerBone[]
): LayerComposite['layers'] {
  const validIds = new Set(bones.map((b) => b.id))
  const visibleLayers = layers.filter((l) => !l.hidden)

  if (visibleLayers.length === 1) {
    const targetId = visibleLayers[0].id
    return layers.map((l) =>
      l.id === targetId
        ? { ...l, boneId: 'bone-pelvis', bindingMode: 'soft' }
        : l.boneId && !validIds.has(l.boneId)
          ? { ...l, boneId: undefined }
          : l
    )
  }

  const matchBoneByName = (name: string): { boneId: string; mode: 'rigid' | 'soft' } => {
    const n = name.toLowerCase()
    if (/đầu|head|mặt|face|mũ|nón|tóc|hair/i.test(n)) return { boneId: 'bone-head', mode: 'soft' }
    if (/bàn tay.*trái|hand.*l/i.test(n)) return { boneId: 'bone-hand-l', mode: 'rigid' }
    if (/bàn tay.*phải|hand.*r/i.test(n)) return { boneId: 'bone-hand-r', mode: 'rigid' }
    if (/cẳng tay.*trái|forearm.*l/i.test(n)) return { boneId: 'bone-forearm-l', mode: 'soft' }
    if (/cẳng tay.*phải|forearm.*r/i.test(n)) return { boneId: 'bone-forearm-r', mode: 'soft' }
    if (/tay.*trái|arm.*l/i.test(n)) return { boneId: 'bone-arm-l', mode: 'soft' }
    if (/tay.*phải|arm.*r/i.test(n)) return { boneId: 'bone-arm-r', mode: 'soft' }
    if (/bàn chân.*trái|giày.*trái|foot.*l/i.test(n)) return { boneId: 'bone-foot-l', mode: 'rigid' }
    if (/bàn chân.*phải|giày.*phải|foot.*r/i.test(n)) return { boneId: 'bone-foot-r', mode: 'rigid' }
    if (/cẳng chân.*trái|shin.*l|calf.*l/i.test(n)) return { boneId: 'bone-shin-l', mode: 'soft' }
    if (/cẳng chân.*phải|shin.*r|calf.*r/i.test(n)) return { boneId: 'bone-shin-r', mode: 'soft' }
    if (/đùi.*trái|chân.*trái|thigh.*l|leg.*l/i.test(n)) return { boneId: 'bone-thigh-l', mode: 'soft' }
    if (/đùi.*phải|chân.*phải|thigh.*r|leg.*r/i.test(n)) return { boneId: 'bone-thigh-r', mode: 'soft' }
    if (/thân|ngực|áo|torso|chest|body/i.test(n)) return { boneId: 'bone-torso', mode: 'soft' }
    return { boneId: 'bone-pelvis', mode: 'soft' }
  }

  return layers.map((l) => {
    if (l.boneId && validIds.has(l.boneId)) {
      return { ...l, bindingMode: l.bindingMode ?? 'soft' }
    }
    const matched = matchBoneByName(l.name || '')
    return {
      ...l,
      boneId: validIds.has(matched.boneId) ? matched.boneId : 'bone-pelvis',
      bindingMode: l.bindingMode ?? matched.mode
    }
  })
}

const STARTER_MIXAMO_PRESETS: Array<{ preset: ProceduralMotionPreset; name: string; duration: number }> = [
  { preset: 'walk', name: 'Bước đi [0° Chính diện]', duration: 1.6 },
  { preset: 'idle', name: 'Đứng thở [0° Chính diện]', duration: 2.4 },
  { preset: 'run', name: 'Chạy nhanh [0° Chính diện]', duration: 1.0 },
  { preset: 'wave', name: 'Vẫy tay chào [0° Chính diện]', duration: 1.8 },
  { preset: 'jump', name: 'Nhún nhảy [0° Chính diện]', duration: 1.4 },
  { preset: 'action', name: 'Vung đòn [0° Chính diện]', duration: 1.5 },
  { preset: 'bow', name: 'Cúi chào [0° Chính diện]', duration: 2.0 }
]

/**
 * Sinh trọn bộ động tác mẫu chuẩn (Đi bộ, Đứng thở, Chạy, Vẫy tay, Nhảy, Vung đòn, Cúi chào)
 * đã tự động co giãn biên độ theo đúng bộ xương 15 khớp vừa gắn từ 8 vòng tròn Mixamo.
 */
export function buildStarterPresetClipsForBones(
  bones: LayerBone[],
  viewAngle: MotionViewAngle = 'front'
): AnimationClip[] {
  return STARTER_MIXAMO_PRESETS.map((item) =>
    buildMixamoClipForBones({
      preset: item.preset,
      bones,
      name: item.name,
      viewAngle,
      duration: item.duration,
      loop: true
    })
  )
}


