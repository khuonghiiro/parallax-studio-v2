import type { LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { computeBoneTail } from './mohoRigHelpers'
import { analyzeCutoutParts, extractLayerDimensions, type CutoutPartRole } from './workshopCutoutRig'
import { inferHumanoidBoneRoles, type HumanoidBoneRoleMap } from './spineRigWorkflow'

export interface ClothBoneRegionMatch {
  boneId: string
  boneName: string
  role: string
  /** Tỷ lệ đoạn xương nằm trong vùng phủ của mảnh vải (0..1) */
  overlapRatio: number
  /** Mô tả vị trí vùng vải uốn theo xương (VD: "Vạt dưới bên trái (Đùi trái)") */
  regionDesc: string
  /** Các mảnh bộ phận chân/tay nằm bên dưới vùng vải này */
  coveredLayerIds: string[]
  coveredLayerNames: string[]
}

export interface GarmentOcclusionInfo {
  hasLongGarmentCoveringLegs: boolean
  garmentStyle: 'long-robe-covering-legs' | 'separated-top-and-pants'
  garmentStyleLabel: string
  robeLayers: Array<{
    id: string
    name: string
    z: number
    renderedWidth: number
    renderedHeight: number
    bottomY: number
    coveredBoneIds: string[]
    coveredBoneNames: string[]
  }>
  legLayers: Array<{
    id: string
    name: string
    z: number
    topY: number
    bottomY: number
    boneId?: string
  }>
  minRobeZ: number
  maxLegBaseZ: number
  /** Giá trị zOrder tối đa trên xương đùi để chân bước tới vẫn nằm DƯỚI tà áo dài */
  maxSafeLegZOrder: number
  aiRuleDescription: string
}

export interface CharacterPostureSummary {
  canvasSize: { width: number; height: number }
  viewAngle: MotionViewAngle
  armStance: 'T-pose' | 'A-pose' | 'down-sides' | 'raised' | 'custom'
  armStanceLabel: string
  legStance: 'parallel-straight' | 'A-stance' | 'custom'
  legStanceLabel: string
  postureSummary: string
  garmentOcclusion: GarmentOcclusionInfo
}

/** Mô tả hướng xương ở tư thế nghỉ gốc (Rest Pose) bằng ngôn ngữ tự nhiên cho AI */
export function describeBoneRestDirection(bone: LayerBone, role?: string): string {
  const tail = computeBoneTail(bone)
  const hx = Math.round(bone.x)
  const hy = Math.round(bone.y)
  const tx = Math.round(tail.x)
  const ty = Math.round(tail.y)
  const len = Math.round(bone.length)
  const ang = Number(bone.angle.toFixed(1))

  let dirText = ''
  if (ang >= -105 && ang <= -75) {
    dirText = 'hướng thẳng đứng LÊN TRÊN (về phía đỉnh đầu)'
  } else if (ang >= 75 && ang <= 105) {
    dirText = 'hướng thẳng đứng XUỐNG DƯỚI (về phía mặt đất)'
  } else if (ang > 105 && ang <= 160) {
    dirText = 'chúc chéo chữ A sang BÊN TRÁI MÀN HÌNH & hướng xuống'
  } else if (ang >= 20 && ang < 75) {
    dirText = 'chúc chéo chữ A sang BÊN PHẢI MÀN HÌNH & hướng xuống'
  } else if (Math.abs(ang) < 20) {
    dirText = 'vươn ngang chữ T sang BÊN PHẢI MÀN HÌNH (+X)'
  } else if (Math.abs(ang) > 160) {
    dirText = 'vươn ngang chữ T sang BÊN TRÁI MÀN HÌNH (-X)'
  } else if (ang < -105) {
    dirText = 'hướng chéo LÊN TRÊN & sang TRÁI màn hình'
  } else {
    dirText = 'hướng chéo LÊN TRÊN & sang PHẢI màn hình'
  }

  const roleHint = role && role !== 'custom' ? ` [${role}]` : ''
  return `Gốc (${hx}, ${hy}) ➔ Ngọn (${tx}, ${ty}), dài ${len}px, góc nghỉ ${ang}° (${dirText})${roleHint}`
}

function getBoneRoleKey(boneId: string, roles: HumanoidBoneRoleMap): string {
  for (const [k, v] of Object.entries(roles)) {
    if (v === boneId) return k
  }
  return 'custom'
}

/**
 * Quét các xương chi (Đùi, Cẳng chân, Bắp tay, Cẳng tay) nằm trong vùng bao phủ của một mảnh Layer vải/áo
 * để tự động gắn `extraBoneIds` uốn lưới Mesh mềm theo chuyển động của chân/tay bên dưới.
 */
export function scanClothFollowerRegionsForLayer(
  layer: AssembledLayerItem,
  allLayers: ReadonlyArray<AssembledLayerItem>,
  bones: ReadonlyArray<LayerBone>
): ClothBoneRegionMatch[] {
  if (!bones.length) return []
  const { w, h } = extractLayerDimensions(layer)
  if (w < 24 || h < 24) return []

  const left = layer.x - w * 0.5
  const right = layer.x + w * 0.5
  const top = layer.y - h * 0.5
  const bottom = layer.y + h * 0.5

  const roles = inferHumanoidBoneRoles(bones)
  const excludedIds = new Set<string>()
  if (layer.boneId) excludedIds.add(layer.boneId)
  if (roles.head) excludedIds.add(roles.head)

  const matches: ClothBoneRegionMatch[] = []
  const sampleTs = [0, 0.25, 0.5, 0.75, 1.0]
  const padX = Math.max(12, w * 0.08)
  const padY = Math.max(12, h * 0.06)

  for (const b of bones) {
    if (excludedIds.has(b.id)) continue
    const role = getBoneRoleKey(b.id, roles)
    // Nếu mảnh hiện tại đang gắn vào xương Thân/Hông, không lấy chính xương Thân/Hông làm xương uốn phụ
    if (
      (layer.boneId === roles.torso || layer.boneId === roles.pelvis) &&
      (role === 'torso' || role === 'pelvis')
    ) {
      continue
    }

    const tail = computeBoneTail(b)
    let hitCount = 0
    for (const t of sampleTs) {
      const px = b.x + (tail.x - b.x) * t
      const py = b.y + (tail.y - b.y) * t
      if (px >= left - padX && px <= right + padX && py >= top - padY && py <= bottom + padY) {
        hitCount++
      }
    }

    const overlapRatio = Number((hitCount / sampleTs.length).toFixed(2))
    if (overlapRatio < 0.4) continue

    const midX = (b.x + tail.x) * 0.5
    const midY = (b.y + tail.y) * 0.5
    const isLowerHalf = midY >= layer.y
    const isLeftSide = midX < layer.x

    let regionDesc = 'Vùng vải chồng lấp'
    if (role.startsWith('thigh') || role.startsWith('shin') || role.startsWith('foot')) {
      regionDesc = isLeftSide ? 'Vạt áo dưới bên trái (theo chân trái)' : 'Vạt áo dưới bên phải (theo chân phải)'
    } else if (role.startsWith('arm') || role.startsWith('forearm') || role.startsWith('hand')) {
      regionDesc = isLeftSide ? 'Tà/ống tay bên trái' : 'Tà/ống tay bên phải'
    } else {
      regionDesc = `${isLowerHalf ? 'Vạt dưới' : 'Vạt trên'} ${isLeftSide ? 'bên trái' : 'bên phải'}`
    }

    const coveredLayers = allLayers.filter(
      (other) =>
        other.id !== layer.id &&
        !other.hidden &&
        (other.boneId === b.id || other.extraBoneIds?.includes(b.id)) &&
        (other.z ?? 0) <= (layer.z ?? 0)
    )

    matches.push({
      boneId: b.id,
      boneName: b.name,
      role,
      overlapRatio,
      regionDesc,
      coveredLayerIds: coveredLayers.map((l) => l.id),
      coveredLayerNames: coveredLayers.map((l) => l.name)
    })
  }

  return matches
}

/**
 * Tự động quét toàn bộ nhân vật để phát hiện các mảnh Áo dài / Váy / Đai lưng che phủ chân/tay
 * và gắn xương uốn vải (`isCloth: true`, `extraBoneIds`, `clothAmplitude`).
 */
export function autoScanAndBindClothRegionsForComposite(
  composite: LayerComposite
): { composite: LayerComposite; updatedLayerNames: string[]; totalBoundBones: number } {
  const bones = composite.rig?.bones ?? []
  if (!bones.length || composite.layers.length <= 1) {
    return { composite, updatedLayerNames: [], totalBoundBones: 0 }
  }

  const parts = analyzeCutoutParts(composite.layers)
  const roleById = new Map<string, CutoutPartRole>(parts.map((p) => [p.layer.id, p.role]))
  const updatedLayerNames: string[] = []
  let totalBoundBones = 0

  const nextLayers = composite.layers.map((layer) => {
    const role = roleById.get(layer.id)
    const nameLow = (layer.name || '').toLowerCase()
    const isCandidateGarment =
      role === 'torso' ||
      role === 'waist_prop' ||
      role === 'hanging_prop' ||
      Boolean(layer.isCloth) ||
      /áo|váy|choàng|đai|tà|robe|skirt|dress|coat|cape/i.test(nameLow)

    if (!isCandidateGarment) return layer

    const matches = scanClothFollowerRegionsForLayer(layer, composite.layers, bones)
    // Với mảnh Thân áo (torso), ưu tiên lấy các xương đùi/chân nằm dưới vạt áo để uốn tà áo khi bước đi
    const filteredMatches =
      role === 'torso'
        ? matches.filter(
            (m) =>
              m.role.startsWith('thigh') ||
              m.role.startsWith('shin') ||
              m.coveredLayerIds.length > 0
          )
        : matches

    if (filteredMatches.length === 0) return layer

    const existingExtra = new Set(layer.extraBoneIds ?? [])
    for (const m of filteredMatches) {
      existingExtra.add(m.boneId)
    }
    const nextExtra = Array.from(existingExtra)
    totalBoundBones += filteredMatches.length
    updatedLayerNames.push(layer.name)

    return {
      ...layer,
      bindingMode: 'soft' as const,
      isCloth: true,
      clothFollowBoneId: layer.clothFollowBoneId ?? filteredMatches[0]?.boneId,
      clothAmplitude: layer.clothAmplitude ?? 45,
      extraBoneIds: nextExtra
    }
  })

  return {
    composite: {
      ...composite,
      layers: nextLayers
    },
    updatedLayerNames,
    totalBoundBones
  }
}

/**
 * Phát hiện xem nhân vật có mặc trang phục áo dài / cổ trang / váy dài che khuất phần đùi & chân hay không.
 * Dùng để:
 * 1) Báo cho AI trong JSON & Prompt không được đặt `zOrder` dương lớn cho chân đè lên áo dài.
 * 2) Tự động kẹp `zOrder` của chân khi nhập JSON hoặc hiển thị để chân luôn nằm dưới lớp áo dài.
 */
export function detectGarmentCoversLegs(
  allLayers: ReadonlyArray<AssembledLayerItem>,
  bones: ReadonlyArray<LayerBone>
): GarmentOcclusionInfo {
  const visible = allLayers.filter((l) => !l.hidden)
  const parts = analyzeCutoutParts([...visible])
  const roleById = new Map<string, CutoutPartRole>(parts.map((p) => [p.layer.id, p.role]))
  const boneRoles = inferHumanoidBoneRoles(bones)
  const legBoneIds = new Set(
    [
      boneRoles.thighL,
      boneRoles.shinL,
      boneRoles.footL,
      boneRoles.thighR,
      boneRoles.shinR,
      boneRoles.footR
    ].filter((id): id is string => Boolean(id))
  )

  const legLayers = visible
    .filter((l) => {
      const r = roleById.get(l.id)
      const nameLow = (l.name || '').toLowerCase()
      return (
        r === 'leg_left' ||
        r === 'leg_right' ||
        (l.boneId && legBoneIds.has(l.boneId)) ||
        /chân|đùi|quần|giày|leg|thigh|shin|foot|boot/i.test(nameLow)
      )
    })
    .map((l) => {
      const { h } = extractLayerDimensions(l)
      return {
        id: l.id,
        name: l.name,
        z: Math.round(l.z ?? 0),
        topY: Math.round(l.y - h * 0.5),
        bottomY: Math.round(l.y + h * 0.5),
        boneId: l.boneId
      }
    })

  const robeCandidates = visible.filter((l) => {
    if (legLayers.some((leg) => leg.id === l.id)) return false
    const r = roleById.get(l.id)
    const nameLow = (l.name || '').toLowerCase()
    return (
      r === 'torso' ||
      Boolean(l.isCloth) ||
      /áo|váy|trường bào|cổ trang|robe|dress|skirt|coat|tunic/i.test(nameLow)
    )
  })

  const robeLayers: GarmentOcclusionInfo['robeLayers'] = []
  for (const robe of robeCandidates) {
    const { w, h } = extractLayerDimensions(robe)
    const robeBottom = robe.y + h * 0.5
    const robeZ = Math.round(robe.z ?? 0)
    const matches = scanClothFollowerRegionsForLayer(robe, visible, bones).filter(
      (m) => m.role.startsWith('thigh') || m.role.startsWith('shin')
    )

    const overlapsLegsVertically =
      legLayers.length > 0 &&
      legLayers.some((leg) => {
        const legH = Math.max(20, leg.bottomY - leg.topY)
        const overlapY = robeBottom - leg.topY
        return robeZ > leg.z && overlapY >= legH * 0.22
      })

    if (overlapsLegsVertically || (matches.length > 0 && legLayers.some((leg) => robeZ > leg.z))) {
      robeLayers.push({
        id: robe.id,
        name: robe.name,
        z: robeZ,
        renderedWidth: Math.round(w),
        renderedHeight: Math.round(h),
        bottomY: Math.round(robeBottom),
        coveredBoneIds: matches.map((m) => m.boneId),
        coveredBoneNames: matches.map((m) => m.boneName)
      })
    }
  }

  const hasLongGarmentCoveringLegs = robeLayers.length > 0 && legLayers.length > 0
  if (!hasLongGarmentCoveringLegs) {
    return {
      hasLongGarmentCoveringLegs: false,
      garmentStyle: 'separated-top-and-pants',
      garmentStyleLabel: 'Trang phục áo & quần/chân tách rời (Chân có thể đổi lớp zOrder +/-15 tự do)',
      robeLayers: [],
      legLayers,
      minRobeZ: 0,
      maxLegBaseZ: legLayers.length ? Math.max(...legLayers.map((l) => l.z)) : -20,
      maxSafeLegZOrder: 15,
      aiRuleDescription:
        'Nhân vật mặc áo và quần/chân tách rời hoặc áo có Z cao hơn hẳn chân: Chân bước tới đặt zOrder: +15, chân lùi sau đặt zOrder: -15.'
    }
  }

  const minRobeZ = Math.min(...robeLayers.map((r) => r.z))
  const maxLegBaseZ = Math.max(...legLayers.map((l) => l.z))
  // Đảm bảo maxLegBaseZ + maxSafeLegZOrder <= minRobeZ - 2 để chân KHÔNG BAO GIỜ đè lên áo dài
  const maxSafeLegZOrder = Math.min(15, Math.floor(minRobeZ - maxLegBaseZ - 2))
  const robeDesc = robeLayers
    .map((r) => `"${r.name}" (${r.renderedWidth}×${r.renderedHeight}px, Z=${r.z}px, phủ tới Y=${r.bottomY}px)`)
    .join(', ')
  const legDesc = legLayers.map((l) => `"${l.name}" (Z=${l.z}px)`).join(', ')

  return {
    hasLongGarmentCoveringLegs: true,
    garmentStyle: 'long-robe-covering-legs',
    garmentStyleLabel: 'Trang phục Cổ trang / Áo trường bào / Váy dài che phủ đùi & chân trên',
    robeLayers,
    legLayers,
    minRobeZ,
    maxLegBaseZ,
    maxSafeLegZOrder,
    aiRuleDescription: `TRANG PHỤC CỔ TRANG / ÁO DÀI CHE CHÂN (CỰC KỲ QUAN TRỌNG): Nhân vật có mảnh thân áo dài ${robeDesc} che phủ phần đùi/chân trên của ${legDesc}. Nếu đặt zOrder: +15 trên xương đùi thì Z thực tế của chân (${maxLegBaseZ} + 15 = ${maxLegBaseZ + 15}) sẽ VƯỢT LÊN TRÊN lớp áo dài (Z=${minRobeZ}), làm chân đè lộ thiên lên trên tà áo cổ trang rất vô lý! BẮT BUỘC: (1) Chân bước tới chỉ đặt "zOrder": ${maxSafeLegZOrder} (để Z thực tế = ${maxLegBaseZ + maxSafeLegZOrder}px vẫn nằm DƯỚI lớp áo dài Z=${minRobeZ}px nhưng vẫn ĐÈ LÊN chân sau), chân lùi sau đặt "zOrder": -15 (Z thực tế = ${maxLegBaseZ - 15}px). (2) Giữ biên độ xoay đùi vừa phải (±3°..±8°) kết hợp dịch Y (+4..+7px chân trước / -6..-10px chân sau) và scale phối cảnh để tà áo dài (đã gắn extraBoneIds uốn mềm theo 2 đùi) tự động uốn lượn vật lý theo bước chân!`
  }
}

/**
 * Phân tích tổng hợp tư thế đứng gốc (Rest Pose) và trang phục nhân vật từ xương & kích thước mảnh
 */
export function analyzeCharacterRestPosture(
  bones: ReadonlyArray<LayerBone>,
  allLayers: ReadonlyArray<AssembledLayerItem>,
  viewAngle: MotionViewAngle = 'front',
  canvasSize = { width: 600, height: 860 }
): CharacterPostureSummary {
  const roles = inferHumanoidBoneRoles(bones)
  const byId = new Map(bones.map((b) => [b.id, b]))
  const armL = roles.armL ? byId.get(roles.armL) : undefined
  const armR = roles.armR ? byId.get(roles.armR) : undefined
  const thighL = roles.thighL ? byId.get(roles.thighL) : undefined
  const thighR = roles.thighR ? byId.get(roles.thighR) : undefined

  let armStance: CharacterPostureSummary['armStance'] = 'down-sides'
  let armStanceLabel = 'Hai tay buông dọc theo thân (~90°)'
  if (armL && armR) {
    const aL = armL.angle
    const aR = armR.angle
    if (Math.abs(aL) > 150 && Math.abs(aR) < 30) {
      armStance = 'T-pose'
      armStanceLabel = `Hai tay dang ngang chữ T (T-Pose: Tay trái ${Math.round(aL)}°, Tay phải ${Math.round(aR)}°)`
    } else if (aL >= 98 && aL <= 150 && aR >= 30 && aR <= 82) {
      armStance = 'A-pose'
      armStanceLabel = `Hai tay mở chéo chữ A tự nhiên (A-Pose: Tay trái ${Math.round(aL)}° mở sang trái-xuống, Tay phải ${Math.round(aR)}° mở sang phải-xuống)`
    } else if (aL < 0 && aR < 0) {
      armStance = 'raised'
      armStanceLabel = `Hai tay đang giơ lên cao (Tay trái ${Math.round(aL)}°, Tay phải ${Math.round(aR)}°)`
    } else {
      armStance = 'down-sides'
      armStanceLabel = `Hai tay xuôi dọc hai bên sườn (Tay trái ${Math.round(aL)}°, Tay phải ${Math.round(aR)}°)`
    }
  }

  let legStance: CharacterPostureSummary['legStance'] = 'parallel-straight'
  let legStanceLabel = 'Hai chân đứng thẳng song song hướng xuống đất (~90°)'
  if (thighL && thighR) {
    const tL = thighL.angle
    const tR = thighR.angle
    if (tL >= 96 && tR <= 84) {
      legStance = 'A-stance'
      legStanceLabel = `Hai chân đứng dạng nhẹ chữ A (Đùi trái ${Math.round(tL)}°, Đùi phải ${Math.round(tR)}°)`
    } else {
      legStance = 'parallel-straight'
      legStanceLabel = `Hai chân đứng thẳng song song (Đùi trái ${Math.round(tL)}° tại X=${Math.round(thighL.x)}, Đùi phải ${Math.round(tR)}° tại X=${Math.round(thighR.x)})`
    }
  }

  const garmentOcclusion = detectGarmentCoversLegs(allLayers, bones)
  const postureSummary = `Nhân vật trên khung ${canvasSize.width}×${canvasSize.height}px ở góc "${viewAngle}": ${armStanceLabel}; ${legStanceLabel}. Trang phục: ${garmentOcclusion.garmentStyleLabel}.`

  return {
    canvasSize,
    viewAngle,
    armStance,
    armStanceLabel,
    legStance,
    legStanceLabel,
    postureSummary,
    garmentOcclusion
  }
}
