import type { BoneKeyframe, LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { inferHumanoidBoneRoles, type HumanoidBoneRoleMap } from './spineRigWorkflow'

export type AnatomicalBoneRole = keyof HumanoidBoneRoleMap | 'custom'

export interface BoneBiomechanicsMeta {
  id: string
  name: string
  parentId: string | null
  role: AnatomicalBoneRole
  x: number
  y: number
  length: number
  angle: number
  boundLayers: string[]
  directionGuide: string
}

const GENERIC_CLIP_NAME_RE =
  /^(động tác\s*\d*|động tác mới|động tác mặc định|tên động tác|động tác nhập.*|clip\s*\d*|new clip|untitled|motion\s*\d*)$/i

/** Kiểm tra xem tên clip có phải là tên mặc định chung chung (ví dụ "Động tác 6", "Tên động tác") hay không */
export function isGenericClipName(name?: string | null): boolean {
  if (!name || !name.trim()) return true
  return GENERIC_CLIP_NAME_RE.test(name.trim())
}

/** Xây dựng hướng dẫn chiều xoay & phối cảnh 2.5D cho từng vai trò khớp giải phẫu */
function getRoleDirectionGuide(role: AnatomicalBoneRole, viewAngle: MotionViewAngle = 'front'): string {
  const isSide = viewAngle === 'side'
  switch (role) {
    case 'pelvis':
      return 'Hông gốc (Root): y DƯƠNG (+8..+22px) = hạ trọng tâm chùng gối; y ÂM (-15..-48px) = bật nhảy lên không. Tuyệt đối giữ -50 <= y <= +25px để chân không lún xuyên sàn hay bay khỏi khung. rotation giữ nhỏ (±4°).'
    case 'torso':
      return 'Thân/Ngực: rotation ±2°..±12° (nghiêng/xoay thân). Phối cảnh 2.5D: scaleY < 1 (0.80..0.94) + y dương (+5..+14px) = gập ngực cúi chào hoặc nén người lấy đà; scaleY > 1 (1.01..1.05) = hít thở / vươn người bật nhảy.'
    case 'head':
      return 'Đầu: rotation DƯƠNG (+3°..+12°) = nghiêng đầu sang phải; ÂM (-3°..-12°) = nghiêng sang trái. y DƯƠNG (+6..+24px) kèm scaleY 0.93 = gật đầu cúi xuống 2.5D; y ÂM (-2..-6px) = ngẩng đầu.'
    case 'armL':
      return 'Bắp tay trái (mặc định chúc xuống ~95°): QUAN TRỌNG: rotation DƯƠNG (+20°..+130°) = GIƠ TAY TRÁI MỞ RA NGOÀI & LÊN CAO; rotation ÂM (-5°..-20°) = khép nhẹ vào ngực. Không dùng góc âm lớn làm tay đâm xuyên qua bụng!'
    case 'forearmL':
      return 'Cẳng tay trái: rotation DƯƠNG (+10°..+45°) = mở/nâng cẳng tay trái hướng ra ngoài; rotation ÂM (-10°..-35°) = gập khuỷu tay trái vào trong.'
    case 'handL':
      return 'Bàn tay trái: rotation ±10°..±25° vẫy cổ tay mềm mại theo cẳng tay trái (Follow-through).'
    case 'armR':
      return 'Bắp tay phải (mặc định chúc xuống ~85°): QUAN TRỌNG: rotation ÂM (-20°..-130°) = GIƠ TAY PHẢI MỞ RA NGOÀI & LÊN CAO; rotation DƯƠNG (+5°..+20°) = khép nhẹ vào ngực. Đặt zOrder: 50..60 khi đưa tay lên trước thân.'
    case 'forearmR':
      return 'Cẳng tay phải: rotation ÂM (-15°..-45°) = gập khuỷu tay phải lên/ra ngoài (khi vẫy tay: dao động -15°..-60°); rotation DƯƠNG (+10°..+35°) = gập vào trong.'
    case 'handR':
      return 'Bàn tay phải: rotation ±15°..±25° vẫy cổ tay mềm mại theo cẳng tay phải.'
    case 'thighL':
      return isSide
        ? 'Đùi trái (góc ngang 90°): rotation ÂM (-20°..-35°) = bước đùi về trước; DƯƠNG (+15°..+25°) = đạp chân ra sau.'
        : 'Đùi trái (góc chính diện 0°): khi khuỵu gối đặt rotation DƯƠNG (+8°..+16°) mở gối nhẹ + scaleY (0.88..0.94) thu ngắn phối cảnh 2.5D. Cấm dùng góc âm lớn làm 2 đầu gối chụm chữ X!'
    case 'shinL':
      return isSide
        ? 'Cẳng chân trái (góc ngang 90°): rotation DƯƠNG (+15°..+45°) = gập gối ra sau.'
        : 'Cẳng chân trái (góc chính diện 0°): khi khuỵu gối đặt rotation ÂM (-6°..-14°) ngược dấu đùi trái để ống chân thẳng đứng + scaleY (0.88..0.94).'
    case 'footL':
      return 'Bàn chân trái: bù góc nhẹ (±4°..±16°) để đế giày bám phẳng mặt đất khi nhún hoặc duỗi mũi chân (-15°) khi bật nhảy.'
    case 'thighR':
      return isSide
        ? 'Đùi phải (góc ngang 90°): rotation ÂM (-20°..-35°) = bước đùi về trước; DƯƠNG (+15°..+25°) = đạp chân ra sau.'
        : 'Đùi phải (góc chính diện 0°): khi khuỵu gối đặt rotation ÂM (-8°..-16°) đối xứng gương với đùi trái + scaleY (0.88..0.94) thu ngắn phối cảnh 2.5D.'
    case 'shinR':
      return isSide
        ? 'Cẳng chân phải (góc ngang 90°): rotation DƯƠNG (+15°..+45°) = gập gối ra sau.'
        : 'Cẳng chân phải (góc chính diện 0°): khi khuỵu gối đặt rotation DƯƠNG (+6°..+14°) ngược dấu đùi phải để ống chân thẳng đứng + scaleY (0.88..0.94).'
    case 'footR':
      return 'Bàn chân phải: bù góc nhẹ (±4°..±16°) đối xứng với bàn chân trái để giữ thăng bằng.'
    default:
      return 'Khớp tuỳ chỉnh: xoay mượt mà (±5°..±35°) theo hướng gốc của xương.'
  }
}

/** Tạo danh sách metadata giải phẫu chi tiết cho từng xương để xuất JSON và gắn vào Prompt AI */
export function buildBoneBiomechanicsGuide(
  bones: ReadonlyArray<LayerBone>,
  composite?: LayerComposite,
  viewAngle: MotionViewAngle = 'front'
): BoneBiomechanicsMeta[] {
  const roleMap = inferHumanoidBoneRoles(bones)
  const idToRole = new Map<string, AnatomicalBoneRole>()
  for (const [role, boneId] of Object.entries(roleMap)) {
    if (boneId) idToRole.set(boneId, role as AnatomicalBoneRole)
  }

  return bones.map((b) => {
    const role = idToRole.get(b.id) ?? 'custom'
    const boundLayers = (composite?.layers ?? [])
      .filter((l) => l.boneId === b.id || l.extraBoneIds?.includes(b.id))
      .map((l) => `${l.name} (${l.id})`)
    return {
      id: b.id,
      name: b.name,
      parentId: b.parentId || null,
      role,
      x: Math.round(b.x),
      y: Math.round(b.y),
      length: Math.round(b.length),
      angle: Math.round(b.angle),
      boundLayers,
      directionGuide: getRoleDirectionGuide(role, viewAngle)
    }
  })
}

function getTrackRange(kfs?: BoneKeyframe[]) {
  if (!kfs || kfs.length === 0) {
    return { minRot: 0, maxRot: 0, minY: 0, maxY: 0, minSy: 1, maxSy: 1, active: false }
  }
  let minRot = Infinity
  let maxRot = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minSy = Infinity
  let maxSy = -Infinity
  for (const k of kfs) {
    if (k.rotation < minRot) minRot = k.rotation
    if (k.rotation > maxRot) maxRot = k.rotation
    if (k.y < minY) minY = k.y
    if (k.y > maxY) maxY = k.y
    const sy = k.scaleY ?? 1
    if (sy < minSy) minSy = sy
    if (sy > maxSy) maxSy = sy
  }
  const active =
    Math.abs(maxRot - minRot) > 0.5 ||
    Math.abs(maxRot) > 1 ||
    Math.abs(minRot) > 1 ||
    Math.abs(maxY - minY) > 1 ||
    Math.abs(minSy - 1) > 0.02
  return { minRot, maxRot, minY, maxY, minSy, maxSy, active }
}

/** Tự động suy luận tên động tác tiếng Việt giàu hình ảnh từ dữ liệu keyframe & gió */
export function inferDescriptiveClipName(
  tracks: Record<string, BoneKeyframe[]>,
  bones: ReadonlyArray<LayerBone> = [],
  windSpinesCount = 0,
  fallbackHint?: string
): string {
  if (fallbackHint && fallbackHint.trim() && !isGenericClipName(fallbackHint)) {
    const cleaned = fallbackHint
      .trim()
      .replace(/^(nhân vật|hãy|tạo|thiết kế|động tác|hoạt ảnh)\s+/i, '')
      .trim()
    if (cleaned.length >= 3 && cleaned.length <= 42) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    }
  }

  const roles = inferHumanoidBoneRoles(bones)
  const pelvis = getTrackRange(tracks[roles.pelvis ?? 'bone-pelvis'])
  const torso = getTrackRange(tracks[roles.torso ?? 'bone-torso'])
  const head = getTrackRange(tracks[roles.head ?? 'bone-head'])
  const armL = getTrackRange(tracks[roles.armL ?? 'bone-arm-l'])
  const armR = getTrackRange(tracks[roles.armR ?? 'bone-arm-r'])
  const thighL = getTrackRange(tracks[roles.thighL ?? 'bone-thigh-l'])
  const thighR = getTrackRange(tracks[roles.thighR ?? 'bone-thigh-r'])

  const windSuffix = windSpinesCount > 0 ? ' + Gió' : ''

  // 1. Nhún nhảy bật cao (Pelvis nhảy lên y < -14)
  if (pelvis.minY < -14) {
    const armsHigh = Math.max(Math.abs(armL.maxRot), Math.abs(armL.minRot), Math.abs(armR.maxRot), Math.abs(armR.minRot)) > 35
    return (armsHigh ? 'Nhún nhảy vươn tay (Jump)' : 'Nhún nhảy bật cao (Jump)') + windSuffix
  }
  // 2. Vấp ngã / Khuỵu sâu (Pelvis hạ sâu y > 45)
  if (pelvis.maxY > 45) {
    return 'Khuỵu gối tiếp đất (Land)' + windSuffix
  }
  // 3. Cúi chào (Torso scaleY < 0.90 hoặc gập sâu)
  if (torso.minSy < 0.9 || torso.maxRot > 20 || head.maxY > 14) {
    return 'Cúi chào lịch thiệp (Bow)' + windSuffix
  }
  // 4. Bước đi / Chạy (2 đùi đều chuyển động biên độ >= 10°)
  if (
    Math.max(Math.abs(thighL.maxRot), Math.abs(thighL.minRot)) >= 10 &&
    Math.max(Math.abs(thighR.maxRot), Math.abs(thighR.minRot)) >= 10
  ) {
    const isFast = Math.max(Math.abs(thighL.maxRot), Math.abs(thighL.minRot)) >= 24
    return (isFast ? 'Chạy bước nhanh (Run)' : 'Bước đi tự nhiên (Walk)') + windSuffix
  }
  // 5. Vẫy tay / Vung tay
  const armLAmp = Math.max(Math.abs(armL.maxRot), Math.abs(armL.minRot))
  const armRAmp = Math.max(Math.abs(armR.maxRot), Math.abs(armR.minRot))
  if (armRAmp >= 35 && armLAmp < 25) {
    return 'Vẫy tay chào (Wave)' + windSuffix
  }
  if (armLAmp >= 35 && armRAmp < 25) {
    return 'Vẫy tay trái (Wave)' + windSuffix
  }
  if (armLAmp >= 30 && armRAmp >= 30) {
    return 'Vươn hai tay (Cheer)' + windSuffix
  }
  // 6. Nhún gối hạ trọng tâm
  if (pelvis.maxY >= 8) {
    return 'Nhún gối nhịp nhàng' + windSuffix
  }
  // 7. Đứng thở nhẹ
  if (torso.active || head.active) {
    return 'Đứng thở tự nhiên (Idle)' + windSuffix
  }
  // 8. Chỉ có gió hoặc xương bất kỳ
  const activeBoneNames = Object.keys(tracks)
    .filter((id) => getTrackRange(tracks[id]).active)
    .map((id) => bones.find((b) => b.id === id)?.name || id)
  if (activeBoneNames.length > 0) {
    return `Cử động ${activeBoneNames.slice(0, 2).join(' & ')}${windSuffix}`
  }
  if (windSpinesCount > 0) {
    return 'Chuyển động Gió đung đưa'
  }
  return 'Động tác tuỳ chỉnh'
}

/** Sửa lỗi ngược dấu 2 cánh tay (khi AI dùng âm cho tay trái và dương cho tay phải làm 2 tay đâm chéo qua bụng) */
function fixCrossedArmsInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const armLId = roles.armL ?? 'bone-arm-l'
  const armRId = roles.armR ?? 'bone-arm-r'
  const armL = getTrackRange(tracks[armLId])
  const armR = getTrackRange(tracks[armRId])

  const leftCrossedInward =
    armL.minRot <= -22 && (armL.maxRot <= 25 || Math.abs(armL.minRot) > armL.maxRot * 1.35)
  const rightCrossedInward =
    armR.maxRot >= 22 && (armR.minRot >= -25 || armR.maxRot > Math.abs(armR.minRot) * 1.35)

  if (leftCrossedInward && rightCrossedInward) {
    const mapArmTrack = (kfs: BoneKeyframe[] | undefined, sign: 1 | -1, isForearmOrHand: boolean) => {
      if (!kfs) return undefined
      return kfs.map((kf) => {
        const mag = Math.abs(kf.rotation)
        const boost = !isForearmOrHand && mag >= 60 ? Math.min(112, mag * 1.28) : isForearmOrHand ? mag * 0.65 : mag
        const rot = Number((sign * boost).toFixed(2))
        return {
          ...kf,
          rotation: rot,
          ...(!isForearmOrHand && mag >= 45 && kf.zOrder === undefined ? { zOrder: 50 } : {})
        }
      })
    }

    const fL = roles.forearmL ?? 'bone-forearm-l'
    const hL = roles.handL ?? 'bone-hand-l'
    const fR = roles.forearmR ?? 'bone-forearm-r'
    const hR = roles.handR ?? 'bone-hand-r'

    if (tracks[armLId]) tracks[armLId] = mapArmTrack(tracks[armLId], 1, false)!
    if (tracks[fL]) tracks[fL] = mapArmTrack(tracks[fL], 1, true)!
    if (tracks[hL]) tracks[hL] = mapArmTrack(tracks[hL], 1, true)!
    if (tracks[armRId]) tracks[armRId] = mapArmTrack(tracks[armRId], -1, false)!
    if (tracks[fR]) tracks[fR] = mapArmTrack(tracks[fR], -1, true)!
    if (tracks[hR]) tracks[hR] = mapArmTrack(tracks[hR], -1, true)!

    fixes.push('Đảo chiều 2 cánh tay mở hướng ra ngoài & vươn lên chữ V tự nhiên (khắc phục lỗi 2 tay đâm chéo qua bụng)')
  }
}

/** Chuẩn hoá biên độ Hông (pelvis.y) và tự động bổ sung Squash & Stretch cho Thân/Đầu */
function fixPelvisAndTorsoSquashInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const pelvisId = roles.pelvis ?? 'bone-pelvis'
  const torsoId = roles.torso ?? 'bone-torso'
  const pelvisKfs = tracks[pelvisId]
  if (!pelvisKfs || pelvisKfs.length === 0) return

  const pRange = getTrackRange(pelvisKfs)
  const needsPositiveClamp = pRange.maxY > 24
  const needsNegativeClamp = pRange.minY < -52

  if (needsPositiveClamp || needsNegativeClamp) {
    const posScale = pRange.maxY > 24 ? 22 / pRange.maxY : 1
    const negScale = pRange.minY < -52 ? 46 / Math.abs(pRange.minY) : 1
    tracks[pelvisId] = pelvisKfs.map((kf) => ({
      ...kf,
      y: Number((kf.y > 0 ? kf.y * posScale : kf.y * negScale).toFixed(2))
    }))
    fixes.push(
      `Cân chỉnh biên độ nhún/nhảy của Hông (${Math.round(pRange.minY)}..+${Math.round(pRange.maxY)}px ➔ -46..+22px) chống lún đất & bay khỏi khung`
    )
  }

  // Bổ sung độ nén giãn Squash & Stretch 2.5D cho thân nếu thân chưa có scaleY
  const torsoKfs = tracks[torsoId]
  if (torsoKfs && torsoKfs.length === tracks[pelvisId].length) {
    const tRange = getTrackRange(torsoKfs)
    if (Math.abs(tRange.minSy - 1) < 0.01 && Math.abs(tRange.maxSy - 1) < 0.01) {
      tracks[torsoId] = torsoKfs.map((kf, idx) => {
        const py = tracks[pelvisId][idx]?.y ?? 0
        if (py > 8) {
          const factor = Math.min(1, py / 22)
          return {
            ...kf,
            y: kf.y || Number((3.5 * factor).toFixed(2)),
            scaleX: Number((1 + 0.035 * factor).toFixed(3)),
            scaleY: Number((1 - 0.065 * factor).toFixed(3))
          }
        }
        if (py < -12) {
          const factor = Math.min(1, Math.abs(py) / 46)
          return {
            ...kf,
            y: kf.y || Number((-3.0 * factor).toFixed(2)),
            scaleX: Number((1 - 0.025 * factor).toFixed(3)),
            scaleY: Number((1 + 0.045 * factor).toFixed(3))
          }
        }
        return kf
      })
    }
  }
}

/** Chuẩn hoá khớp chân ở góc Chính diện 0° (khắc phục lỗi chụm gối chữ X & bổ sung thu ngắn phối cảnh scaleY) */
function fixFrontViewLegsInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const thighLId = roles.thighL ?? 'bone-thigh-l'
  const thighRId = roles.thighR ?? 'bone-thigh-r'
  const shinLId = roles.shinL ?? 'bone-shin-l'
  const shinRId = roles.shinR ?? 'bone-shin-r'
  const footLId = roles.footL ?? 'bone-foot-l'
  const footRId = roles.footR ?? 'bone-foot-r'
  const pelvisId = roles.pelvis ?? 'bone-pelvis'

  const tlKfs = tracks[thighLId]
  const trKfs = tracks[thighRId]
  if (!tlKfs || !trKfs || tlKfs.length === 0 || trKfs.length === 0) return

  const tlRange = getTrackRange(tlKfs)
  const trRange = getTrackRange(trKfs)

  // Phát hiện squat đối xứng bị ngược dấu (thighL âm, thighR dương cùng lúc -> chụm gối chữ X)
  const isSymmetricKnockKneed =
    tlRange.minRot <= -12 &&
    (tlRange.maxRot <= 12 || Math.abs(tlRange.minRot) > tlRange.maxRot * 1.35) &&
    trRange.maxRot >= 12 &&
    (trRange.minRot >= -12 || trRange.maxRot > Math.abs(trRange.minRot) * 1.35)
  if (!isSymmetricKnockKneed) return

  const maxRawThigh = Math.max(Math.abs(tlRange.minRot), Math.abs(trRange.maxRot), 1)
  const thighScale = maxRawThigh > 6 ? 6 / maxRawThigh : 1

  const mapLegTrack = (kfs: BoneKeyframe[], outSign: 1 | -1, maxDeg: number, isShin: boolean) => {
    const rawMax = Math.max(...kfs.map((k) => Math.abs(k.rotation)), 1)
    const scale = rawMax > maxDeg ? maxDeg / rawMax : thighScale
    return kfs.map((kf, idx) => {
      const py = tracks[pelvisId]?.[idx]?.y ?? 0
      const isAirborne = py < -12
      const mag = Math.abs(kf.rotation) * scale
      const rot = Number(((isAirborne ? -outSign * 0.6 : outSign) * mag).toFixed(2))
      const bendRatio = Math.min(1, Math.abs(kf.rotation) / 25)
      const autoSy =
        kf.scaleY !== undefined && Math.abs(kf.scaleY - 1) > 0.01
          ? kf.scaleY
          : isAirborne
            ? 1.03
            : Number((1 - bendRatio * (isShin ? 0.13 : 0.12)).toFixed(3))
      const autoSx =
        kf.scaleX !== undefined && Math.abs(kf.scaleX - 1) > 0.01
          ? kf.scaleX
          : isAirborne
            ? 0.98
            : Number((1 + bendRatio * 0.035).toFixed(3))
      return {
        ...kf,
        rotation: rot,
        scaleX: autoSx,
        scaleY: autoSy,
        ...(isShin && !isAirborne && bendRatio > 0.2 && kf.y === 0 ? { y: Number((-7 * bendRatio).toFixed(2)) } : {})
      }
    })
  }

  tracks[thighLId] = mapLegTrack(tlKfs, 1, 6, false)
  tracks[thighRId] = mapLegTrack(trKfs, -1, 6, false)
  if (tracks[shinLId]) tracks[shinLId] = mapLegTrack(tracks[shinLId], -1, 5, true)
  if (tracks[shinRId]) tracks[shinRId] = mapLegTrack(tracks[shinRId], 1, 5, true)
  if (tracks[footLId]) {
    tracks[footLId] = tracks[footLId].map((kf) => ({ ...kf, rotation: Number((Math.abs(kf.rotation) * 0.25).toFixed(2)) }))
  }
  if (tracks[footRId]) {
    tracks[footRId] = tracks[footRId].map((kf) => ({ ...kf, rotation: Number((-Math.abs(kf.rotation) * 0.25).toFixed(2)) }))
  }

  fixes.push('Chuẩn hoá khớp Đùi & Cẳng chân góc chính diện 2.5D (mở gối tự nhiên + thu ngắn phối cảnh scaleY thay vì vặn chân chữ X)')
}

/**
 * Tự động kiểm tra và khử các dị dạng cơ học phổ biến do AI bên ngoài sinh ra
 * (tay bắt chéo bụng, chân chụm chữ X ở góc 0°, hông nhảy vọt/lún sàn, thiếu co giãn phối cảnh 2.5D).
 */
export function normalizeAndFixBiomechanicalTracks(
  rawTracks: Record<string, BoneKeyframe[]>,
  bones: ReadonlyArray<LayerBone> = [],
  viewAngle: MotionViewAngle = 'front'
): { tracks: Record<string, BoneKeyframe[]>; fixesApplied: string[] } {
  const tracks = structuredClone(rawTracks)
  const fixesApplied: string[] = []
  const roles = inferHumanoidBoneRoles(bones)

  fixCrossedArmsInPlace(tracks, roles, fixesApplied)
  fixPelvisAndTorsoSquashInPlace(tracks, roles, fixesApplied)
  if (viewAngle !== 'side') {
    fixFrontViewLegsInPlace(tracks, roles, fixesApplied)
  }

  return { tracks, fixesApplied }
}
