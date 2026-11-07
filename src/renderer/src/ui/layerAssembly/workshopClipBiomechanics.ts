import type { BoneKeyframe, LayerBone, LayerRig, MotionViewAngle } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { extraSoftBoneIdsForLayer } from './workshopRig'
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
  meshEnvelope: boolean
  strength: number
  influenceReach: number
  pin?: boolean
  boundLayers: string[]
  directionGuide: string
}

export interface MotionBoneEnvelopeItem {
  boneId: string
  boneName?: string
  meshEnvelope: boolean
  strength: number
  influenceReach: number
  pin?: boolean
}

export interface MotionLayerMeshBindingItem {
  layerId: string
  layerName: string
  bindingMode: 'soft' | 'rigid'
  boneId: string | null
  extraBoneIds?: string[]
  meshWidth?: number
  meshHeight?: number
  isCloth?: boolean
  clothFollowBoneId?: string
  clothAmplitude?: number
  physics?: {
    enabled: boolean
    material: string
    role?: string
    stiffness?: number
    damping?: number
    bounciness?: number
  }
}

export interface MotionMeshExportSection {
  enabled: boolean
  meshEnvelope: boolean
  groundContactImpact: {
    enabled: boolean
    footImpactSquash: { scaleX: number; scaleY: number; offsetY: number }
    shinImpactCompression: { scaleX: number; scaleY: number; offsetY: number }
    thighImpactCompression: { scaleX: number; scaleY: number }
    airborneFootStretch: { scaleX: number; scaleY: number }
    torsoElasticity: { squashScaleX: number; squashScaleY: number; stretchScaleX: number; stretchScaleY: number }
  }
  boneEnvelopes: MotionBoneEnvelopeItem[]
  layerBindings: MotionLayerMeshBindingItem[]
}

const GENERIC_CLIP_NAME_RE =
  /^(động tác\s*\d*|động tác mới\s*\d*|động tác mặc định|tên động tác|động tác nhập.*|clip\s*\d*|new clip|untitled|motion\s*\d*)$/i

/** Kiểm tra xem tên clip có phải là tên mặc định chung chung (ví dụ "Động tác 6", "Tên động tác") hay không */
export function isGenericClipName(name?: string | null): boolean {
  if (!name || !name.trim()) return true
  return GENERIC_CLIP_NAME_RE.test(name.trim())
}

/** Xây dựng hướng dẫn chiều xoay, phối cảnh 2.5D & biến dạng lưới Mesh chịu lực cho từng vai trò khớp */
function getRoleDirectionGuide(role: AnatomicalBoneRole, viewAngle: MotionViewAngle = 'front'): string {
  const isSide = viewAngle === 'side'
  switch (role) {
    case 'pelvis':
      return 'Hông gốc (Root): y DƯƠNG (+8..+22px) = hạ trọng tâm chùng gối; y ÂM (-15..-48px) = bật nhảy lên không. Giữ -50 <= y <= +25px để chân bám sàn tự nhiên. rotation giữ nhỏ (±4°).'
    case 'torso':
      return 'Thân/Ngực (Soft Mesh): rotation ±2°..±12°. Khi nhún/tiếp đất chịu lực: nén Mesh thân (scaleX: 1.04, scaleY: 0.93, y: +3.5px); khi bật nhảy/vươn người: giãn Mesh thân (scaleX: 0.97, scaleY: 1.04, y: -3px).'
    case 'head':
      return 'Đầu: rotation DƯƠNG (+3°..+12°) = nghiêng phải; ÂM (-3°..-12°) = nghiêng trái. y DƯƠNG (+4..+18px) kèm scaleY 0.95 = gật/nén quán tính khi tiếp đất; y ÂM (-2..-6px) = ngẩng đầu.'
    case 'armL':
      return 'Bắp tay trái (mặc định chúc xuống ~95°): QUAN TRỌNG: rotation DƯƠNG (+20°..+130°) = GIƠ TAY TRÁI MỞ RA NGOÀI & LÊN CAO; rotation ÂM (-5°..-18°) = khép nhẹ vào ngực. Đặt zOrder: 50 khi vươn tay.'
    case 'forearmL':
      return 'Cẳng tay trái (Soft Mesh): rotation DƯƠNG (+10°..+45°) = mở/nâng cẳng tay trái hướng ra ngoài; có thể kèm scaleY: 0.95..1.04 tạo độ văng cơ.'
    case 'handL':
      return 'Bàn tay trái: rotation ±10°..±25° vẫy cổ tay mềm mại theo cẳng tay trái (Follow-through).'
    case 'armR':
      return 'Bắp tay phải (mặc định chúc xuống ~85°): QUAN TRỌNG: rotation ÂM (-20°..-130°) = GIƠ TAY PHẢI MỞ RA NGOÀI & LÊN CAO; rotation DƯƠNG (+5°..+18°) = khép nhẹ vào ngực. Đặt zOrder: 50..60 khi đưa tay lên trước thân.'
    case 'forearmR':
      return 'Cẳng tay phải (Soft Mesh): rotation ÂM (-15°..-45°) = gập khuỷu tay phải lên/ra ngoài; có thể kèm scaleY: 0.95..1.04.'
    case 'handR':
      return 'Bàn tay phải: rotation ±15°..±25° vẫy cổ tay mềm mại theo cẳng tay phải.'
    case 'thighL':
      return isSide
        ? 'Đùi trái (góc ngang 90°): rotation ÂM (-20°..-35°) = bước đùi về trước; DƯƠNG (+15°..+25°) = đạp chân ra sau. Khi tiếp đất: scaleX: 1.05, scaleY: 0.90.'
        : 'Đùi trái (góc 0° - Soft Mesh): khi khuỵu gối/tiếp đất đặt rotation DƯƠNG nhẹ (+4°..+7°) + TÁC LỰC NÉN MESH ĐÙI (scaleX: 1.05, scaleY: 0.88..0.91); khi bật nhảy trên không đặt scaleX: 0.97, scaleY: 1.03.'
    case 'shinL':
      return isSide
        ? 'Cẳng chân trái (góc ngang 90°): rotation DƯƠNG (+15°..+45°) = gập gối ra sau. Khi tiếp đất: scaleX: 1.06, scaleY: 0.88.'
        : 'Cẳng chân trái (góc 0° - Soft Mesh): khi khuỵu gối/tiếp đất đặt rotation ÂM nhẹ (-4°..-6°) + TÁC LỰC NÉN MESH CẲNG CHÂN (scaleX: 1.06, scaleY: 0.87..0.90, y: -5..-7px); khi trên không đặt scaleX: 0.97, scaleY: 1.04.'
    case 'footL':
      return 'Bàn chân trái (Mesh Chịu Tác Lực Tiếp Đất): Khi nhún lấy đà / chạm đất chịu lực, BẮT BUỘC nén dẹt & bè ngang lưới Mesh đế giày (scaleX: 1.14..1.18, scaleY: 0.82..0.86, y: +2..+4px, rotation: +2°..+5°); khi bật nhảy rời đất, duỗi thon bàn chân (scaleX: 0.93..0.95, scaleY: 1.08..1.12, rotation: -6°..-10°).'
    case 'thighR':
      return isSide
        ? 'Đùi phải (góc ngang 90°): rotation ÂM (-20°..-35°) = bước đùi về trước; DƯƠNG (+15°..+25°) = đạp chân ra sau.'
        : 'Đùi phải (góc 0° - Soft Mesh): khi khuỵu gối/tiếp đất đặt rotation ÂM nhẹ (-4°..-7°) đối xứng đùi trái + TÁC LỰC NÉN MESH ĐÙI (scaleX: 1.05, scaleY: 0.88..0.91); khi trên không đặt scaleX: 0.97, scaleY: 1.03.'
    case 'shinR':
      return isSide
        ? 'Cẳng chân phải (góc ngang 90°): rotation DƯƠNG (+15°..+45°) = gập gối ra sau.'
        : 'Cẳng chân phải (góc 0° - Soft Mesh): khi khuỵu gối/tiếp đất đặt rotation DƯƠNG nhẹ (+4°..+6°) + TÁC LỰC NÉN MESH CẲNG CHÂN (scaleX: 1.06, scaleY: 0.87..0.90, y: -5..-7px); khi trên không đặt scaleX: 0.97, scaleY: 1.04.'
    case 'footR':
      return 'Bàn chân phải (Mesh Chịu Tác Lực Tiếp Đất): Khi nhún lấy đà / chạm đất chịu lực, BẮT BUỘC nén dẹt & bè ngang lưới Mesh đế giày (scaleX: 1.14..1.18, scaleY: 0.82..0.86, y: +2..+4px, rotation: -2°..-5°); khi bật nhảy rời đất, duỗi thon bàn chân (scaleX: 0.93..0.95, scaleY: 1.08..1.12, rotation: +6°..+10°).'
    default:
      return 'Khớp tuỳ chỉnh (Soft Mesh): xoay mượt mà (±5°..±35°), kết hợp scaleX/scaleY (0.90..1.10) để uốn lưới tam giác theo quán tính.'
  }
}

/** Tạo danh sách metadata giải phẫu & vùng uốn Mesh chi tiết cho từng xương */
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
      meshEnvelope: b.meshEnvelope ?? composite?.rig?.meshEnvelope ?? true,
      strength: Number((b.strength ?? 1.15).toFixed(2)),
      influenceReach: Number((b.influenceReach ?? 1.1).toFixed(2)),
      ...(b.pin ? { pin: true } : {}),
      boundLayers,
      directionGuide: getRoleDirectionGuide(role, viewAngle)
    }
  })
}

/** Xuất cấu hình Mesh Deformation & Tác lực tiếp đất của nhân vật ra JSON */
export function buildMeshDeformationExportSection(
  bones: ReadonlyArray<LayerBone>,
  composite?: LayerComposite
): MotionMeshExportSection {
  const layers = composite?.layers ?? []
  const rig = composite?.rig
  return {
    enabled: true,
    meshEnvelope: rig?.meshEnvelope ?? true,
    groundContactImpact: {
      enabled: true,
      footImpactSquash: { scaleX: 1.16, scaleY: 0.84, offsetY: 2.5 },
      shinImpactCompression: { scaleX: 1.06, scaleY: 0.88, offsetY: -6.0 },
      thighImpactCompression: { scaleX: 1.05, scaleY: 0.89 },
      airborneFootStretch: { scaleX: 0.94, scaleY: 1.10 },
      torsoElasticity: { squashScaleX: 1.04, squashScaleY: 0.93, stretchScaleX: 0.97, stretchScaleY: 1.04 }
    },
    boneEnvelopes: bones.map((b) => ({
      boneId: b.id,
      boneName: b.name,
      meshEnvelope: b.meshEnvelope ?? rig?.meshEnvelope ?? true,
      strength: Number((b.strength ?? 1.15).toFixed(2)),
      influenceReach: Number((b.influenceReach ?? 1.1).toFixed(2)),
      ...(b.pin ? { pin: true } : {})
    })),
    layerBindings: layers
      .filter((l) => Boolean(l.boneId || l.extraBoneIds?.length || l.physics?.enabled || l.isCloth))
      .map((l) => {
        const extra = l.extraBoneIds?.length
          ? l.extraBoneIds
          : extraSoftBoneIdsForLayer(layers, rig, l.id, l.boneId)
        return {
          layerId: l.id,
          layerName: l.name,
          bindingMode: l.bindingMode ?? 'soft',
          boneId: l.boneId ?? null,
          ...(extra.length > 0 ? { extraBoneIds: extra } : {}),
          ...(l.meshWidth && l.meshHeight ? { meshWidth: l.meshWidth, meshHeight: l.meshHeight } : {}),
          ...(l.isCloth
            ? {
                isCloth: true,
                clothFollowBoneId: l.clothFollowBoneId,
                clothAmplitude: l.clothAmplitude ?? 40
              }
            : {}),
          ...(l.physics?.enabled
            ? {
                physics: {
                  enabled: true,
                  material: l.physics.material,
                  role: l.physics.role,
                  stiffness: l.physics.stiffness,
                  damping: l.physics.damping,
                  bounciness: l.physics.bounciness
                }
              }
            : {})
        }
      })
  }
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

  if (pelvis.minY < -14) {
    const armsHigh = Math.max(Math.abs(armL.maxRot), Math.abs(armL.minRot), Math.abs(armR.maxRot), Math.abs(armR.minRot)) > 35
    return (armsHigh ? 'Nhún nhảy vươn tay (Jump)' : 'Nhún nhảy bật cao (Jump)') + windSuffix
  }
  if (pelvis.maxY > 45) return 'Khuỵu gối tiếp đất (Land)' + windSuffix
  if (torso.minSy < 0.9 || torso.maxRot > 20 || head.maxY > 14) return 'Cúi chào lịch thiệp (Bow)' + windSuffix
  if (
    Math.max(Math.abs(thighL.maxRot), Math.abs(thighL.minRot)) >= 10 &&
    Math.max(Math.abs(thighR.maxRot), Math.abs(thighR.minRot)) >= 10
  ) {
    const isFast = Math.max(Math.abs(thighL.maxRot), Math.abs(thighL.minRot)) >= 24
    return (isFast ? 'Chạy bước nhanh (Run)' : 'Bước đi tự nhiên (Walk)') + windSuffix
  }
  const armLAmp = Math.max(Math.abs(armL.maxRot), Math.abs(armL.minRot))
  const armRAmp = Math.max(Math.abs(armR.maxRot), Math.abs(armR.minRot))
  if (armRAmp >= 35 && armLAmp < 25) return 'Vẫy tay chào (Wave)' + windSuffix
  if (armLAmp >= 35 && armRAmp < 25) return 'Vẫy tay trái (Wave)' + windSuffix
  if (armLAmp >= 30 && armRAmp >= 30) return 'Vươn hai tay (Cheer)' + windSuffix
  if (pelvis.maxY >= 8) return 'Nhún gối nhịp nhàng' + windSuffix
  if (torso.active || head.active) return 'Đứng thở tự nhiên (Idle)' + windSuffix
  const activeBoneNames = Object.keys(tracks)
    .filter((id) => getTrackRange(tracks[id]).active)
    .map((id) => bones.find((b) => b.id === id)?.name || id)
  if (activeBoneNames.length > 0) return `Cử động ${activeBoneNames.slice(0, 2).join(' & ')}${windSuffix}`
  if (windSpinesCount > 0) return 'Chuyển động Gió đung đưa'
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
            scaleX: Number((1 + 0.04 * factor).toFixed(3)),
            scaleY: Number((1 - 0.07 * factor).toFixed(3))
          }
        }
        if (py < -12) {
          const factor = Math.min(1, Math.abs(py) / 46)
          return {
            ...kf,
            y: kf.y || Number((-3.0 * factor).toFixed(2)),
            scaleX: Number((1 - 0.03 * factor).toFixed(3)),
            scaleY: Number((1 + 0.045 * factor).toFixed(3))
          }
        }
        return kf
      })
    }
  }
}

/** Chuẩn hoá khớp chân ở góc Chính diện 0° & tích hợp biến dạng lưới Mesh chịu tác lực tiếp đất (Ground Contact Impact Mesh) */
function fixFrontViewLegsAndMeshImpactInPlace(
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
  if (tlKfs && trKfs && tlKfs.length > 0 && trKfs.length > 0) {
    const tlRange = getTrackRange(tlKfs)
    const trRange = getTrackRange(trKfs)
    const isSymmetricKnockKneed =
      tlRange.minRot <= -12 &&
      (tlRange.maxRot <= 12 || Math.abs(tlRange.minRot) > tlRange.maxRot * 1.35) &&
      trRange.maxRot >= 12 &&
      (trRange.minRot >= -12 || trRange.maxRot > Math.abs(trRange.minRot) * 1.35)

    if (isSymmetricKnockKneed) {
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
                ? 1.04
                : Number((1 - bendRatio * (isShin ? 0.13 : 0.11)).toFixed(3))
          const autoSx =
            kf.scaleX !== undefined && Math.abs(kf.scaleX - 1) > 0.01
              ? kf.scaleX
              : isAirborne
                ? 0.97
                : Number((1 + bendRatio * (isShin ? 0.065 : 0.05)).toFixed(3))
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
      fixes.push('Chuẩn hoá khớp Đùi & Cẳng chân góc chính diện 2.5D (mở gối tự nhiên + thu ngắn phối cảnh scaleY thay vì vặn chân chữ X)')
    }
  }

  // Bổ sung tác lực tiếp đất (Ground Contact Impact Mesh Deformation) cho Bàn chân & Cẳng chân khi nhún/nhảy
  const pelvisKfs = tracks[pelvisId]
  if (!pelvisKfs || pelvisKfs.length === 0) return
  const pRange = getTrackRange(pelvisKfs)
  if (pRange.maxY < 6 && pRange.minY > -10) return

  let appliedFootImpact = false
  const applyFootImpactTrack = (footId: string, sideSign: 1 | -1) => {
    const baseKfs =
      tracks[footId] && tracks[footId].length === pelvisKfs.length
        ? tracks[footId]
        : pelvisKfs.map((pk) => ({
            time: pk.time,
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            easing: pk.easing
          }))
    const fRange = getTrackRange(baseKfs)
    const alreadyHasSquash = fRange.minSy < 0.92 || fRange.maxSy > 1.05
    if (alreadyHasSquash && tracks[footId]) return

    tracks[footId] = baseKfs.map((kf, idx) => {
      const py = pelvisKfs[idx]?.y ?? 0
      if (py >= 6) {
        const impact = Math.min(1, py / 20)
        appliedFootImpact = true
        return {
          ...kf,
          y: kf.y || Number((2.5 * impact).toFixed(2)),
          rotation: Number((sideSign * Math.min(4, Math.abs(kf.rotation || 3) * 0.35)).toFixed(2)),
          scaleX: Number((1 + 0.16 * impact).toFixed(3)),
          scaleY: Number((1 - 0.16 * impact).toFixed(3))
        }
      }
      if (py <= -10) {
        const air = Math.min(1, Math.abs(py) / 42)
        appliedFootImpact = true
        return {
          ...kf,
          y: kf.y || Number((-1.5 * air).toFixed(2)),
          rotation: Number((-sideSign * Math.min(8, 6 * air)).toFixed(2)),
          scaleX: Number((1 - 0.06 * air).toFixed(3)),
          scaleY: Number((1 + 0.10 * air).toFixed(3))
        }
      }
      return { ...kf, rotation: Number((kf.rotation * 0.25).toFixed(2)), scaleX: 1, scaleY: 1 }
    })
  }

  applyFootImpactTrack(footLId, 1)
  applyFootImpactTrack(footRId, -1)
  if (appliedFootImpact) {
    fixes.push('Tích hợp biến dạng lưới Mesh bàn chân & cổ chân chịu tác lực tiếp đất (Squash scaleX 1.16 / scaleY 0.84 khi chạm sàn & Stretch khi bật nhảy)')
  }
}

/**
 * Tự động kiểm tra và khử các dị dạng cơ học phổ biến do AI bên ngoài sinh ra,
 * đồng thời bổ sung biến dạng lưới Mesh chịu tác lực tiếp đất (Ground Contact Impact Mesh).
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
    fixFrontViewLegsAndMeshImpactInPlace(tracks, roles, fixesApplied)
  }

  return { tracks, fixesApplied }
}

/**
 * Tự động kích hoạt Uốn mềm Lưới Mesh (bindingMode: 'soft', meshEnvelope: true, extraBoneIds liên kết khớp)
 * cho các bộ phận cơ thể và áp dụng cấu hình meshDeformation từ JSON để hiệu ứng nén/giãn Mesh hiển thị rõ nét.
 */
export function upgradeCompositeSoftMeshForImpact(
  layers: ReadonlyArray<AssembledLayerItem>,
  rig: LayerRig,
  meshSection?: Partial<MotionMeshExportSection>
): { layers: AssembledLayerItem[]; rig: LayerRig } {
  const envMap = new Map(
    (meshSection?.boneEnvelopes ?? []).map((e) => [e.boneId.toLowerCase(), e])
  )
  const bindMap = new Map(
    (meshSection?.layerBindings ?? []).map((b) => [b.layerId.toLowerCase(), b])
  )

  const nextBones = rig.bones.map((b) => {
    const customEnv = envMap.get(b.id.toLowerCase())
    return {
      ...b,
      meshEnvelope: customEnv?.meshEnvelope ?? b.meshEnvelope ?? true,
      strength: customEnv?.strength ?? b.strength ?? 1.15,
      influenceReach: customEnv?.influenceReach ?? b.influenceReach ?? 1.1
    }
  })

  const nextRig: LayerRig = {
    ...rig,
    meshEnvelope: meshSection?.meshEnvelope ?? rig.meshEnvelope ?? true,
    bones: nextBones
  }

  const nextLayers = layers.map((l) => {
    const customBind = bindMap.get(l.id.toLowerCase())
    const isRigidAccessory = /glass|kính|hat|mũ|eye|mắt|mouth|miệng|brow|mày/i.test(`${l.id} ${l.name} ${l.slot ?? ''}`)
    const targetMode: 'soft' | 'rigid' =
      customBind?.bindingMode ?? (isRigidAccessory ? (l.bindingMode ?? 'rigid') : 'soft')
    const boneId = customBind?.boneId ?? l.boneId
    const computedExtra =
      customBind?.extraBoneIds ??
      (l.extraBoneIds?.length ? l.extraBoneIds : extraSoftBoneIdsForLayer(layers as AssembledLayerItem[], nextRig, l.id, boneId))

    return {
      ...l,
      ...(boneId ? { boneId, bindingMode: targetMode } : {}),
      ...(targetMode === 'soft' && computedExtra.length > 0 ? { extraBoneIds: computedExtra } : {}),
      ...(customBind?.isCloth !== undefined ? { isCloth: customBind.isCloth } : {}),
      ...(customBind?.clothFollowBoneId ? { clothFollowBoneId: customBind.clothFollowBoneId } : {}),
      ...(customBind?.clothAmplitude !== undefined ? { clothAmplitude: customBind.clothAmplitude } : {})
    }
  })

  return { layers: nextLayers, rig: nextRig }
}
