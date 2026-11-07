import type { AnimationClip, LayerBone, LayerRig } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { buildStarterPresetClipsForBones } from './workshopMixamoAutoRig'

/** Các vai trò giải phẫu nhận diện không gian cho từng mảnh layer trong nhân vật 2.5D */
export type CutoutPartRole =
  | 'head' // Khuôn mặt, đầu
  | 'hair_front' // Mái tóc trước, kẹp tóc, vương miện
  | 'hair_back' // Tóc sau, bím tóc sau
  | 'torso' // Thân áo chính, ngực, bụng
  | 'arm_left' // Cánh tay / tay áo bên trái nhân vật
  | 'arm_right' // Cánh tay / tay áo bên phải nhân vật
  | 'leg_left' // Chân / ống quần / giày bên trái
  | 'leg_right' // Chân / ống quần / giày bên phải
  | 'waist_prop' // Đai lưng, ngọc bội, thắt lưng
  | 'hanging_prop' // Mặt nạ, phụ kiện đeo lủng lẳng
  | 'prop_general' // Đạo cụ khác

export interface CutoutPartInfo {
  layer: AssembledLayerItem
  role: CutoutPartRole
  roleLabel: string
  roleIcon: string
  suggestedParentRole?: CutoutPartRole
  suggestedBindingMode: 'rigid' | 'soft'
  cx: number
  cy: number
  w: number
  h: number
}

const ROLE_META: Record<CutoutPartRole, { label: string; icon: string; defaultMode: 'rigid' | 'soft' }> = {
  head: { label: 'Khuôn mặt / Đầu', icon: '👤', defaultMode: 'rigid' },
  hair_front: { label: 'Tóc trước & Kẹp tóc', icon: '✨', defaultMode: 'rigid' },
  hair_back: { label: 'Mái tóc sau', icon: '💇', defaultMode: 'soft' },
  torso: { label: 'Thân áo chính', icon: '🥋', defaultMode: 'rigid' },
  arm_left: { label: 'Cánh tay trái', icon: '💪', defaultMode: 'rigid' },
  arm_right: { label: 'Cánh tay phải', icon: '🦾', defaultMode: 'rigid' },
  leg_left: { label: 'Chân trái', icon: '🦵', defaultMode: 'rigid' },
  leg_right: { label: 'Chân phải', icon: '🦿', defaultMode: 'rigid' },
  waist_prop: { label: 'Đai ngọc / Thắt lưng', icon: '💎', defaultMode: 'soft' },
  hanging_prop: { label: 'Mặt nạ / Đạo cụ treo', icon: '🎭', defaultMode: 'rigid' },
  prop_general: { label: 'Phụ kiện', icon: '🎀', defaultMode: 'rigid' }
}

/** Trích xuất kích thước thực tế của layer (ưu tiên meshWidth -> parse từ tên '(387×726)' -> mặc định) */
export function extractLayerDimensions(l: AssembledLayerItem): { w: number; h: number } {
  const s = l.scale || 1
  let rawW = l.meshWidth
  let rawH = l.meshHeight

  if (!rawW || !rawH) {
    const m = (l.name || '').match(/(\d+)\s*[×x*]\s*(\d+)/)
    if (m) {
      rawW = rawW || Number(m[1])
      rawH = rawH || Number(m[2])
    }
  }

  return {
    w: (rawW || 120) * s * (l.scaleX ?? 1),
    h: (rawH || 120) * s * (l.scaleY ?? 1)
  }
}

/**
 * Phân tích không gian (Spatial Layout Analysis): Nhận diện vai trò giải phẫu của từng mảnh layer
 * dựa vào toạ độ thực tế (x, y), kích thước (w, h), độ sâu Z và tỷ lệ không gian của nhân vật.
 */
export function analyzeCutoutParts(layers: AssembledLayerItem[]): CutoutPartInfo[] {
  const visible = layers.filter((l) => !l.hidden)
  const pool = visible.length > 0 ? visible : layers
  if (pool.length === 0) return []

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  const metrics = pool.map((l) => {
    const { w, h } = extractLayerDimensions(l)
    const cx = l.x
    const cy = l.y
    const left = cx - w * 0.5
    const right = cx + w * 0.5
    const top = cy - h * 0.5
    const bottom = cy + h * 0.5

    if (left < minX) minX = left
    if (right > maxX) maxX = right
    if (top < minY) minY = top
    if (bottom > maxY) maxY = bottom

    return { layer: l, cx, cy, w, h, area: w * h, left, right, top, bottom }
  })

  const totalW = Math.max(80, maxX - minX)
  const totalH = Math.max(120, maxY - minY)
  const midX = (minX + maxX) * 0.5

  // Xác định Thân chính (Torso)
  const torsoCandidates = metrics.filter((m) => {
    const relY = (m.cy - minY) / totalH
    const relXDiff = Math.abs(m.cx - midX) / totalW
    return relY >= 0.2 && relY <= 0.7 && relXDiff <= 0.28
  })
  torsoCandidates.sort((a, b) => b.area - a.area)
  const torsoMetric = torsoCandidates[0] ?? metrics.reduce((max, cur) => (cur.area > max.area ? cur : max), metrics[0])
  const torsoId = torsoMetric.layer.id

  return metrics.map((m) => {
    const l = m.layer
    const relY = (m.cy - minY) / totalH
    const name = (l.name || '').toLowerCase()

    let role: CutoutPartRole = 'prop_general'
    let suggestedParentRole: CutoutPartRole | undefined

    const dxFromMid = m.cx - midX
    const isOuterSide = Math.abs(dxFromMid) > totalW * 0.15
    const isBelowWaistForLegs =
      relY >= 0.72 || (relY >= 0.55 && m.cy >= torsoMetric.bottom - torsoMetric.h * 0.18)

    if (l.id === torsoId) {
      role = 'torso'
    } else if (relY < 0.36) {
      if (/hair.*back|tóc sau|đuôi tóc/i.test(name) || (m.area > 20000 && l.z >= 10)) {
        role = 'hair_back'
        suggestedParentRole = 'head'
      } else if (/head|face|mặt|đầu/i.test(name) || (m.area > 15000 && Math.abs(dxFromMid) < totalW * 0.18)) {
        role = 'head'
        suggestedParentRole = 'torso'
      } else {
        role = 'hair_front'
        suggestedParentRole = 'head'
      }
    } else if (isOuterSide && relY < 0.8) {
      // Cánh tay ở 2 bên sườn (dù buông thõng xuống ngang đùi như nhân vật chibi)
      role = dxFromMid < 0 ? 'arm_left' : 'arm_right'
      suggestedParentRole = 'torso'
    } else if (isBelowWaistForLegs) {
      // Đôi chân ở nửa dưới cơ thể gần trục giữa (nằm thấp hơn vùng bụng/đai hông của thân áo)
      role = dxFromMid < 0 ? 'leg_left' : 'leg_right'
      suggestedParentRole = 'torso'
    } else {
      // Vùng thân: Đai ngọc, mặt nạ, tua rua, phụ kiện đeo hông
      if (/mask|mặt nạ|treo|tua rua/i.test(name) || (m.w < totalW * 0.18 && m.area < 16000 && relY > 0.38)) {
        role = 'hanging_prop'
        suggestedParentRole = 'waist_prop'
      } else if (/belt|waist|đai|ngọc|thắt lưng/i.test(name) || relY >= 0.42) {
        role = 'waist_prop'
        suggestedParentRole = 'torso'
      } else {
        role = 'prop_general'
        suggestedParentRole = 'torso'
      }
    }

    const meta = ROLE_META[role]
    return {
      layer: l,
      role,
      roleLabel: meta.label,
      roleIcon: meta.icon,
      suggestedParentRole,
      suggestedBindingMode: meta.defaultMode,
      cx: m.cx,
      cy: m.cy,
      w: m.w,
      h: m.h
    }
  })
}

/**
 * 1-Click: Tự động dựng toàn bộ khung xương khớp chuẩn giải phẫu cho nhân vật được ghép từ các mảnh layer.
 */
export function autoRigAllCutoutParts(composite: LayerComposite): LayerComposite {
  const parts = analyzeCutoutParts(composite.layers)
  if (parts.length === 0) return composite

  const bones: LayerBone[] = []
  const layerBoneMap = new Map<string, { boneId: string; mode: 'rigid' | 'soft' }>()

  const torsoPart = parts.find((p) => p.role === 'torso') || parts[0]
  const headPart = parts.find((p) => p.role === 'head')
  const hairBackPart = parts.find((p) => p.role === 'hair_back')
  const hairFrontParts = parts.filter((p) => p.role === 'hair_front')
  const armLPart = parts.find((p) => p.role === 'arm_left')
  const armRPart = parts.find((p) => p.role === 'arm_right')
  const legLPart = parts.find((p) => p.role === 'leg_left')
  const legRPart = parts.find((p) => p.role === 'leg_right')
  const waistPropPart = parts.find((p) => p.role === 'waist_prop')
  const hangingPropParts = parts.filter((p) => p.role === 'hanging_prop')
  const otherProps = parts.filter((p) => p.role === 'prop_general')

  // 1. Xương Thân
  const torsoH = Math.max(80, torsoPart.h * 0.65)
  const boneTorso: LayerBone = {
    id: 'bone-torso',
    name: 'Xương Thân',
    x: Math.round(torsoPart.cx),
    y: Math.round(torsoPart.cy + torsoH * 0.35),
    length: Math.round(torsoH),
    angle: -90,
    strength: 1.2
  }
  bones.push(boneTorso)
  layerBoneMap.set(torsoPart.layer.id, { boneId: boneTorso.id, mode: 'rigid' })

  // 2. Xương Đầu
  if (headPart) {
    const headH = Math.max(70, headPart.h * 0.6)
    const boneHead: LayerBone = {
      id: 'bone-head',
      name: 'Xương Đầu',
      parentId: boneTorso.id,
      x: Math.round(headPart.cx),
      y: Math.round(boneTorso.y - boneTorso.length),
      length: Math.round(headH),
      angle: -90,
      strength: 1.1
    }
    bones.push(boneHead)
    layerBoneMap.set(headPart.layer.id, { boneId: boneHead.id, mode: 'rigid' })

    hairFrontParts.forEach((hp) => {
      layerBoneMap.set(hp.layer.id, { boneId: boneHead.id, mode: 'rigid' })
    })

    if (hairBackPart) {
      const hairH = Math.max(80, hairBackPart.h * 0.7)
      const boneHairBack: LayerBone = {
        id: 'bone-hair-back',
        name: 'Xương Tóc Sau',
        parentId: boneHead.id,
        x: Math.round(hairBackPart.cx),
        y: Math.round(boneHead.y + 15),
        length: Math.round(hairH),
        angle: 90,
        strength: 1.4,
        influenceReach: 1.3
      }
      bones.push(boneHairBack)
      layerBoneMap.set(hairBackPart.layer.id, { boneId: boneHairBack.id, mode: 'soft' })
    }
  }

  // 3. Xương Tay Trái
  if (armLPart) {
    const armH = Math.max(60, armLPart.h * 0.6)
    const shoulderX = Math.round(boneTorso.x - torsoPart.w * 0.28)
    const shoulderY = Math.round(boneTorso.y - boneTorso.length * 0.75)
    const boneArmL: LayerBone = {
      id: 'bone-arm-l',
      name: 'Xương Tay Trái',
      parentId: boneTorso.id,
      x: shoulderX,
      y: shoulderY,
      length: Math.round(armH),
      angle: 115,
      strength: 1.1
    }
    bones.push(boneArmL)
    layerBoneMap.set(armLPart.layer.id, { boneId: boneArmL.id, mode: 'rigid' })
  }

  // 4. Xương Tay Phải
  if (armRPart) {
    const armH = Math.max(60, armRPart.h * 0.6)
    const shoulderX = Math.round(boneTorso.x + torsoPart.w * 0.28)
    const shoulderY = Math.round(boneTorso.y - boneTorso.length * 0.75)
    const boneArmR: LayerBone = {
      id: 'bone-arm-r',
      name: 'Xương Tay Phải',
      parentId: boneTorso.id,
      x: shoulderX,
      y: shoulderY,
      length: Math.round(armH),
      angle: 65,
      strength: 1.1
    }
    bones.push(boneArmR)
    layerBoneMap.set(armRPart.layer.id, { boneId: boneArmR.id, mode: 'rigid' })
  }

  // 5. Xương Chân Trái
  if (legLPart) {
    const legH = Math.max(70, legLPart.h * 0.75)
    const hipX = Math.round(legLPart.cx)
    const boneLegL: LayerBone = {
      id: 'bone-leg-l',
      name: 'Xương Chân Trái',
      parentId: boneTorso.id,
      x: hipX,
      y: Math.round(boneTorso.y),
      length: Math.round(legH),
      angle: 90,
      strength: 1.0
    }
    bones.push(boneLegL)
    layerBoneMap.set(legLPart.layer.id, { boneId: boneLegL.id, mode: 'rigid' })
  }

  // 6. Xương Chân Phải
  if (legRPart) {
    const legH = Math.max(70, legRPart.h * 0.75)
    const hipX = Math.round(legRPart.cx)
    const boneLegR: LayerBone = {
      id: 'bone-leg-r',
      name: 'Xương Chân Phải',
      parentId: boneTorso.id,
      x: hipX,
      y: Math.round(boneTorso.y),
      length: Math.round(legH),
      angle: 90,
      strength: 1.0
    }
    bones.push(boneLegR)
    layerBoneMap.set(legRPart.layer.id, { boneId: boneLegR.id, mode: 'rigid' })
  }

  // 7. Xương Đai Ngọc
  let waistBoneId = boneTorso.id
  if (waistPropPart) {
    const propH = Math.max(40, waistPropPart.h * 0.5)
    const boneWaist: LayerBone = {
      id: 'bone-waist-prop',
      name: 'Xương Đai Ngọc',
      parentId: boneTorso.id,
      x: Math.round(waistPropPart.cx),
      y: Math.round(waistPropPart.cy - propH * 0.5),
      length: Math.round(propH),
      angle: 90,
      strength: 1.0
    }
    bones.push(boneWaist)
    waistBoneId = boneWaist.id
    layerBoneMap.set(waistPropPart.layer.id, { boneId: boneWaist.id, mode: 'soft' })
  }

  // 8. Các phụ kiện treo
  hangingPropParts.forEach((hp, idx) => {
    const propH = Math.max(35, hp.h * 0.4)
    const boneHanging: LayerBone = {
      id: `bone-hanging-${idx + 1}`,
      name: `Xương ${hp.layer.name.slice(0, 14)}`,
      parentId: waistBoneId,
      x: Math.round(hp.cx),
      y: Math.round(hp.cy - propH * 0.5),
      length: Math.round(propH),
      angle: 90,
      strength: 1.0
    }
    bones.push(boneHanging)
    layerBoneMap.set(hp.layer.id, { boneId: boneHanging.id, mode: 'rigid' })
  })

  // 9. Các phụ kiện khác
  otherProps.forEach((op) => {
    layerBoneMap.set(op.layer.id, { boneId: boneTorso.id, mode: 'rigid' })
  })

  // 10. Đảm bảo 100% tất cả các mảnh trong composite đều được gán xương (Zero-Unbound Guarantee)
  const boneHairBack = bones.find((b) => b.id === 'bone-hair-back')
  const boneArmL = bones.find((b) => b.id === 'bone-arm-l')
  const boneArmR = bones.find((b) => b.id === 'bone-arm-r')
  const boneLegL = bones.find((b) => b.id === 'bone-leg-l')
  const boneLegR = bones.find((b) => b.id === 'bone-leg-r')

  parts.forEach((p) => {
    if (layerBoneMap.has(p.layer.id)) return
    if (p.role === 'head' || p.role === 'hair_front') {
      layerBoneMap.set(p.layer.id, { boneId: (bones.find((b) => b.id === 'bone-head') || boneTorso).id, mode: 'rigid' })
    } else if (p.role === 'hair_back') {
      layerBoneMap.set(p.layer.id, {
        boneId: (boneHairBack || bones.find((b) => b.id === 'bone-head') || boneTorso).id,
        mode: 'soft'
      })
    } else if (p.role === 'arm_left') {
      layerBoneMap.set(p.layer.id, { boneId: (boneArmL || boneTorso).id, mode: 'rigid' })
    } else if (p.role === 'arm_right') {
      layerBoneMap.set(p.layer.id, { boneId: (boneArmR || boneTorso).id, mode: 'rigid' })
    } else if (p.role === 'leg_left') {
      layerBoneMap.set(p.layer.id, { boneId: (boneLegL || boneTorso).id, mode: 'rigid' })
    } else if (p.role === 'leg_right') {
      layerBoneMap.set(p.layer.id, { boneId: (boneLegR || boneTorso).id, mode: 'rigid' })
    } else if (p.role === 'waist_prop' || p.role === 'hanging_prop') {
      layerBoneMap.set(p.layer.id, { boneId: waistBoneId || boneTorso.id, mode: 'soft' })
    } else {
      layerBoneMap.set(p.layer.id, { boneId: boneTorso.id, mode: 'rigid' })
    }
  })

  const updatedLayers = composite.layers.map((l) => {
    const match = layerBoneMap.get(l.id)
    if (!match) return l
    return {
      ...l,
      boneId: match.boneId,
      bindingMode: match.mode
    }
  })

  const starterClips: AnimationClip[] = buildStarterPresetClipsForBones(bones, 'front')

  const updatedRig: LayerRig = {
    bones,
    duration: composite.rig?.duration ?? 2.0,
    loop: composite.rig?.loop ?? true,
    fps: composite.rig?.fps ?? 24,
    tracks: composite.rig?.tracks ?? {},
    clips: starterClips,
    activeClipId: starterClips[0]?.id
  }

  return {
    ...composite,
    rig: updatedRig,
    layers: updatedLayers
  }
}

/**
 * Tạo một xương chuẩn dọc theo chiều dài của 1 layer cụ thể và tự động gán vào layer đó.
 */
export function createBoneForSingleLayer(
  layerId: string,
  composite: LayerComposite,
  parentId?: string,
  mode: 'rigid' | 'soft' = 'rigid'
): LayerComposite {
  const layer = composite.layers.find((l) => l.id === layerId)
  if (!layer) return composite

  const bones = [...(composite.rig?.bones ?? [])]
  const parts = analyzeCutoutParts(composite.layers)
  const partInfo = parts.find((p) => p.layer.id === layerId)

  const { w, h } = extractLayerDimensions(layer)
  const cx = layer.x
  const cy = layer.y

  let length = Math.max(30, Math.round(Math.max(w, h) * 0.65))
  let angle = -90
  let originX = cx
  let originY = cy + length * 0.5

  if (partInfo) {
    if (partInfo.role === 'torso' || partInfo.role === 'head') {
      angle = -90
      originY = cy + h * 0.25
      length = Math.max(40, Math.round(h * 0.6))
    } else if (partInfo.role === 'leg_left' || partInfo.role === 'leg_right' || partInfo.role === 'hair_back') {
      angle = 90
      originY = cy - h * 0.25
      length = Math.max(40, Math.round(h * 0.6))
    } else if (partInfo.role === 'arm_left') {
      angle = 115
      originX = cx + w * 0.2
      originY = cy - h * 0.25
    } else if (partInfo.role === 'arm_right') {
      angle = 65
      originX = cx - w * 0.2
      originY = cy - h * 0.25
    }
  }

  let finalParentId = parentId
  if (!finalParentId && bones.length > 0) {
    if (partInfo?.suggestedParentRole) {
      const parentPart = parts.find((p) => p.role === partInfo.suggestedParentRole && p.layer.boneId)
      if (parentPart?.layer.boneId) {
        finalParentId = parentPart.layer.boneId
      }
    }
    if (!finalParentId) {
      const root = bones.find((b) => !b.parentId) || bones[0]
      finalParentId = root.id
    }
  }

  const cleanName = layer.name.replace(/\[.*?\]/g, '').trim()
  const newBone: LayerBone = {
    id: `bone-${crypto.randomUUID()}`,
    name: `Xương ${cleanName.slice(0, 16)}`,
    parentId: finalParentId,
    x: Math.round(originX),
    y: Math.round(originY),
    length: Math.round(length),
    angle,
    strength: mode === 'soft' ? 1.3 : 1.0
  }

  bones.push(newBone)

  const updatedLayers = composite.layers.map((l) => {
    if (l.id !== layerId) return l
    return {
      ...l,
      boneId: newBone.id,
      bindingMode: mode
    }
  })

  return {
    ...composite,
    rig: {
      ...(composite.rig ?? { duration: 2.0, loop: true, tracks: {} }),
      bones
    },
    layers: updatedLayers
  }
}
