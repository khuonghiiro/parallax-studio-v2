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

export interface MotionOrientationGuide {
  viewAngle: MotionViewAngle
  angleDeg: number
  facing: string
  description: string
  motionRules: string[]
}

/** Xây dựng cấu trúc định hướng góc nhìn chi tiết (0° front, 45° diagonal, 90° side, 180° back) cho AI */
export function buildOrientationGuide(viewAngle: MotionViewAngle = 'front'): MotionOrientationGuide {
  switch (viewAngle) {
    case 'side':
      return {
        viewAngle: 'side',
        angleDeg: 90,
        facing: 'Góc ngang 90° (Nghiêng sườn Profile)',
        description: 'Nhân vật quay ngang 90° sang một bên. Hoạt ảnh chân và tay vung dọc theo trục trước - sau (bước tới trước và đạp ra sau).',
        motionRules: [
          'Chân bước dọc: Đùi vung ra trước (rotation ÂM: -20°..-35°), chân đạp ra sau (rotation DƯƠNG: +15°..+25°).',
          'Khớp gối: Cẳng chân gập ra sau (rotation DƯƠNG: +15°..+45°).',
          'Cánh tay: Đánh tay so le theo trục trước - sau tự nhiên.',
          'Chiều sâu: Chi tiết gần camera có Z lớn hơn chi tiết ở xa.'
        ]
      }
    case 'diagonal':
      return {
        viewAngle: 'diagonal',
        angleDeg: 45,
        facing: 'Góc chéo 3/4 (45° Nghiêng chéo bán thân)',
        description: 'Nhân vật quay góc 45° ba phần tư so với Camera. Một bên thân (gần camera) to hơn và rõ chi tiết hơn bên thân xa.',
        motionRules: [
          'Phân biệt rõ tay/chân gần camera (Foreground, Z lớn hơn) và tay/chân xa camera (Background, Z nhỏ hơn).',
          'Cánh tay gần camera vươn rộng và nằm đè lên thân áo (zOrder: 50).',
          'Nhún gối kết hợp mở nhẹ gối và thu ngắn phối cảnh scaleY (0.88..0.92).'
        ]
      }
    case 'back':
      return {
        viewAngle: 'back',
        angleDeg: 180,
        facing: 'Góc sau lưng 180° (Nhìn từ phía sau)',
        description: 'Nhân vật quay lưng 180° về phía Camera / Người xem.',
        motionRules: [
          'Lưng và mái tóc sau hiển thị trên cùng đè lên thân trước.',
          'Hai cánh tay khi vung sang 2 bên có chiều xoay đối xứng ngược lại với góc chính diện.'
        ]
      }
    case 'front':
    default:
      return {
        viewAngle: 'front',
        angleDeg: 0,
        facing: 'Chính diện 0° (Đối diện trực tiếp với Camera / Người xem)',
        description: 'Nhân vật nhìn thẳng 0° vào mắt người xem. Hai bên cơ thể đối xứng qua trục dọc giữa thân.',
        motionRules: [
          'Mặt và ngực hướng thẳng 0° vào người xem.',
          'Hai cánh tay mở sang 2 bên đối xứng chữ V (Tay trái: rotation DƯƠNG +20°..+120°, Tay phải: rotation ÂM -20°..-120°).',
          'Hai chân nhún khuỵu mở nhẹ gối sang 2 bên kết hợp thu ngắn phối cảnh scaleY (0.88..0.93), không xoay chân lộn xộn.',
          'Bàn chân tiếp đất chịu lực nén dẹt (scaleX: 1.16, scaleY: 0.84) bám sàn tự nhiên.',
          'Chiều sâu: Kính (+42) > Mặt (+30) > Đầu (+20) > Thân (0) > Cánh tay sau (-35).'
        ]
      }
  }
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
/** Tự động chuẩn hoá phối cảnh chiều sâu bước đi 2.5D (Walk Depth Perspective), hoán đổi zOrder và tay-chân nghịch pha */
function fixWalkPerspectiveAndContralateralLimbSwingInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const thighLId = roles.thighL ?? 'bone-thigh-l'
  const thighRId = roles.thighR ?? 'bone-thigh-r'
  const footLId = roles.footL ?? 'bone-foot-l'
  const footRId = roles.footR ?? 'bone-foot-r'
  const armLId = roles.armL ?? 'bone-arm-l'
  const armRId = roles.armR ?? 'bone-arm-r'

  const tlKfs = tracks[thighLId]
  const trKfs = tracks[thighRId]
  const flKfs = tracks[footLId]
  const frKfs = tracks[footRId]

  const hasLegMotion =
    (tlKfs && trKfs && tlKfs.length > 1 && trKfs.length > 1) ||
    (flKfs && frKfs && flKfs.length > 1 && frKfs.length > 1)

  let fixedDepthCount = 0

  if (hasLegMotion) {
    const tlRange = getTrackRange(tlKfs)
    const trRange = getTrackRange(trKfs)
    const flRange = getTrackRange(flKfs)
    const frRange = getTrackRange(frKfs)

    const isAlternatingLegs =
      Math.abs(tlRange.maxRot - tlRange.minRot) > 5 ||
      Math.abs(trRange.maxRot - trRange.minRot) > 5 ||
      Math.abs(flRange.maxY - flRange.minY) > 3 ||
      Math.abs(frRange.maxY - frRange.minY) > 3

    const refKfs = flKfs && flKfs.length >= 2 ? flKfs : tlKfs
    if (isAlternatingLegs && refKfs && refKfs.length >= 2) {
      const count = refKfs.length

      for (let i = 0; i < count; i++) {
        const kfL = flKfs?.[i] ?? tlKfs?.[i]
        const kfR = frKfs?.[i] ?? trKfs?.[i]
        if (!kfL || !kfR) continue

        const scoreL = (kfL.y || 0) * 1.5 + ((kfL.scaleY ?? 1) - 1) * 30 - kfL.rotation * 0.1
        const scoreR = (kfR.y || 0) * 1.5 + ((kfR.scaleY ?? 1) - 1) * 30 + kfR.rotation * 0.1

        if (Math.abs(scoreL - scoreR) > 1.0) {
          const leftIsForward = scoreL > scoreR

          if (tlKfs && tlKfs[i] && trKfs && trKfs[i]) {
            if (tlKfs[i].zOrder === undefined || trKfs[i].zOrder === undefined || tlKfs[i].zOrder === trKfs[i].zOrder) {
              tlKfs[i].zOrder = leftIsForward ? 15 : -15
              trKfs[i].zOrder = leftIsForward ? -15 : 15
              fixedDepthCount++
            }
          }

          if (flKfs && flKfs[i] && frKfs && frKfs[i]) {
            const parentHasZ = Boolean(tlKfs?.[i]?.zOrder !== undefined && trKfs?.[i]?.zOrder !== undefined)
            const needZFix =
              flKfs[i].zOrder === undefined ||
              frKfs[i].zOrder === undefined ||
              flKfs[i].zOrder === frKfs[i].zOrder

            if (needZFix) {
              if (!parentHasZ) {
                flKfs[i].zOrder = leftIsForward ? 15 : -15
                frKfs[i].zOrder = leftIsForward ? -15 : 15
              }

              if (leftIsForward) {
                flKfs[i].scaleX = Math.max(flKfs[i].scaleX ?? 1, 1.06)
                flKfs[i].scaleY = Math.max(flKfs[i].scaleY ?? 1, 1.06)
                frKfs[i].scaleX = Math.min(frKfs[i].scaleX ?? 1, 0.95)
                frKfs[i].scaleY = Math.min(frKfs[i].scaleY ?? 1, 0.95)
              } else {
                frKfs[i].scaleX = Math.max(frKfs[i].scaleX ?? 1, 1.06)
                frKfs[i].scaleY = Math.max(frKfs[i].scaleY ?? 1, 1.06)
                flKfs[i].scaleX = Math.min(flKfs[i].scaleX ?? 1, 0.95)
                flKfs[i].scaleY = Math.min(flKfs[i].scaleY ?? 1, 0.95)
              }
              fixedDepthCount++
            }
          }

          const armLKf = tracks[armLId]?.[i]
          const armRKf = tracks[armRId]?.[i]
          if (armLKf && armRKf && (armLKf.zOrder === undefined || armRKf.zOrder === undefined)) {
            armLKf.zOrder = leftIsForward ? -50 : 50
            armRKf.zOrder = leftIsForward ? 50 : -50
          }
        }
      }
    }
  }

  // Đồng bộ vị trí dọc Y trên Đùi & Cẳng chân theo phối cảnh bước tới (hạ thấp Y > 0) và nhấc chân sau (nâng cao Y < 0)
  const shinLId = roles.shinL ?? 'bone-shin-l'
  const shinRId = roles.shinR ?? 'bone-shin-r'
  let fixedLegVerticalPerspective = false

  for (const [thighId, shinId] of [
    [thighLId, shinLId],
    [thighRId, shinRId]
  ] as const) {
    const tTrack = tracks[thighId]
    const sTrack = tracks[shinId]
    if (tTrack) {
      for (const kf of tTrack) {
        const sx = kf.scaleX ?? 1
        const sy = kf.scaleY ?? 1
        if (sx >= 1.04 && sy >= 1.01 && (kf.y ?? 0) <= 0) {
          kf.y = 4
          fixedLegVerticalPerspective = true
        } else if (sx <= 0.96 && sy <= 0.94 && (kf.y ?? 0) >= 0) {
          kf.y = -8
          fixedLegVerticalPerspective = true
        }
      }
    }
    if (sTrack) {
      for (const kf of sTrack) {
        const sx = kf.scaleX ?? 1
        const sy = kf.scaleY ?? 1
        if (sx >= 1.04 && sy >= 1.01 && (kf.y ?? 0) < 0) {
          kf.y = Math.abs(kf.y)
          fixedLegVerticalPerspective = true
        } else if (sx <= 0.96 && sy <= 0.91 && (kf.y ?? 0) >= 0) {
          kf.y = -6
          fixedLegVerticalPerspective = true
        }
      }
    }
  }

  if (fixedDepthCount > 0 || fixedLegVerticalPerspective) {
    fixes.push(
      'Tự động áp dụng Phối Cảnh Bước Đi 2.5D: Chân bước tới hạ thấp & nổi lên trước (y > 0, zOrder: +15, scale: 1.06), chân sau nhấc cao & lùi sau (y < 0, zOrder: -15)'
    )
  }
}

/** Khử lỗi cộng dồn gấp đôi zOrder cha-con khi AI gán trùng cùng một mức zOrder tuyệt đối lên cả xương cha (đùi/bắp tay) lẫn xương con (cẳng chân/bàn chân/cẳng tay) */
function deduplicateHierarchicalChildZOrderInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const chains: Array<[string, string, string | undefined, number]> = [
    [roles.thighL ?? 'bone-thigh-l', roles.shinL ?? 'bone-shin-l', roles.footL ?? 'bone-foot-l', 2],
    [roles.thighR ?? 'bone-thigh-r', roles.shinR ?? 'bone-shin-r', roles.footR ?? 'bone-foot-r', 2],
    [roles.armL ?? 'bone-arm-l', roles.forearmL ?? 'bone-forearm-l', roles.handL ?? 'bone-hand-l', 8],
    [roles.armR ?? 'bone-arm-r', roles.forearmR ?? 'bone-forearm-r', roles.handR ?? 'bone-hand-r', 8]
  ]

  let deduped = false
  const findParentZAt = (parentKfs: BoneKeyframe[], t: number): number | undefined => {
    let best: BoneKeyframe | undefined
    let bestDist = Infinity
    for (const pk of parentKfs) {
      const d = Math.abs(pk.time - t)
      if (d < bestDist) {
        bestDist = d
        best = pk
      }
    }
    return bestDist <= 0.12 ? best?.zOrder : undefined
  }

  for (const [rootId, midId, tipId, maxChildDelta] of chains) {
    const rootKfs = tracks[rootId]
    if (!rootKfs || rootKfs.length === 0) continue

    for (const childId of [midId, tipId]) {
      if (!childId || !tracks[childId]) continue
      for (const ckf of tracks[childId]) {
        if (ckf.zOrder === undefined || Math.abs(ckf.zOrder) < 10) continue
        const pZ = findParentZAt(rootKfs, ckf.time)
        if (pZ !== undefined && Math.abs(pZ) >= 10 && Math.sign(pZ) === Math.sign(ckf.zOrder)) {
          if (Math.abs(ckf.zOrder - pZ) <= Math.max(12, Math.abs(pZ) * 0.45)) {
            const rawDelta = ckf.zOrder - pZ
            ckf.zOrder = Math.max(-maxChildDelta, Math.min(maxChildDelta, rawDelta))
            deduped = true
          }
        }
      }
    }
  }

  if (deduped) {
    fixes.push('Chuẩn hoá kế thừa zOrder cha-con (tránh cộng dồn gấp đôi zOrder giữa Đùi/Cẳng chân và Bắp tay/Cẳng tay)')
  }
}

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
  deduplicateHierarchicalChildZOrderInPlace(tracks, roles, fixesApplied)
  fixWalkPerspectiveAndContralateralLimbSwingInPlace(tracks, roles, fixesApplied)
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
