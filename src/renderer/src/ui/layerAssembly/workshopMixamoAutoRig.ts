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

export interface LandmarkMeta {
  id: MixamoLandmarkId
  label: string
  shortLabel: string
  color: string
  mirrorId?: MixamoLandmarkId
  radius: number
}

export const MIXAMO_LANDMARK_META: LandmarkMeta[] = [
  { id: 'headTop', label: 'Đỉnh đầu', shortLabel: 'Đầu', color: '#c084fc', radius: 6 },
  { id: 'neck', label: 'Cổ / Cằm', shortLabel: 'Cổ', color: '#38bdf8', radius: 6.5 },
  { id: 'chest', label: 'Ngực / Thân trên', shortLabel: 'Ngực', color: '#60a5fa', radius: 6.5 },
  { id: 'pelvis', label: 'Hông (Tâm gốc)', shortLabel: 'Hông', color: '#f97316', radius: 7.5 },
  { id: 'shoulderL', label: 'Vai trái', shortLabel: 'Vai T', color: '#34d399', mirrorId: 'shoulderR', radius: 5.5 },
  { id: 'elbowL', label: 'Khuỷu tay trái', shortLabel: 'Khuỷu T', color: '#10b981', mirrorId: 'elbowR', radius: 5.5 },
  { id: 'wristL', label: 'Cổ tay trái', shortLabel: 'Tay T', color: '#059669', mirrorId: 'wristR', radius: 6 },
  { id: 'shoulderR', label: 'Vai phải', shortLabel: 'Vai P', color: '#2dd4bf', mirrorId: 'shoulderL', radius: 5.5 },
  { id: 'elbowR', label: 'Khuỷu tay phải', shortLabel: 'Khuỷu P', color: '#14b8a6', mirrorId: 'elbowL', radius: 5.5 },
  { id: 'wristR', label: 'Cổ tay phải', shortLabel: 'Tay P', color: '#0d9488', mirrorId: 'wristL', radius: 6 },
  { id: 'kneeL', label: 'Đầu gối trái', shortLabel: 'Gối T', color: '#fbbf24', mirrorId: 'kneeR', radius: 6 },
  { id: 'ankleL', label: 'Cổ chân trái', shortLabel: 'Chân T', color: '#ef4444', mirrorId: 'ankleR', radius: 6.5 },
  { id: 'kneeR', label: 'Đầu gối phải', shortLabel: 'Gối P', color: '#f59e0b', mirrorId: 'kneeL', radius: 6 },
  { id: 'ankleR', label: 'Cổ chân phải', shortLabel: 'Chân P', color: '#dc2626', mirrorId: 'ankleL', radius: 6.5 }
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
 * Di chuyển một điểm nhấn, hỗ trợ đối xứng gương Trái ⇄ Phải qua trục X của Hông (pelvis.x)
 */
export function moveLandmarkPoint(
  landmarks: MixamoLandmarks,
  id: MixamoLandmarkId,
  to: LandmarkPoint,
  symmetry = true
): MixamoLandmarks {
  const rounded = { x: Math.round(to.x), y: Math.round(to.y) }
  const next: MixamoLandmarks = { ...landmarks, [id]: rounded }
  if (!symmetry) return next

  const meta = MIXAMO_LANDMARK_META.find((m) => m.id === id)
  if (meta?.mirrorId) {
    const centerX = landmarks.pelvis.x
    const dx = rounded.x - centerX
    next[meta.mirrorId] = {
      x: Math.round(centerX - dx),
      y: rounded.y
    }
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

  // Tính tỉ lệ kích thước thực tế so với chiều dài chân chuẩn (70 + 70 = 140)
  const thigh = bones.find((b) => b.id === 'bone-thigh-l')
  const shin = bones.find((b) => b.id === 'bone-shin-l')
  const legLen = (thigh?.length ?? 70) + (shin?.length ?? 70)
  const scaleRatio = Math.max(0.25, Math.min(2.5, legLen / 140))

  if (Math.abs(scaleRatio - 1) > 0.05) {
    const scaledTracks: Record<string, BoneKeyframe[]> = {}
    for (const [boneId, keys] of Object.entries(rawClip.tracks)) {
      scaledTracks[boneId] = keys.map((k) => ({
        ...k,
        x: Number((k.x * scaleRatio).toFixed(2)),
        y: Number((k.y * scaleRatio).toFixed(2))
      }))
    }
    rawClip.tracks = scaledTracks
  }

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

