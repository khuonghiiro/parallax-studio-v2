import type { LayerComposite } from './types'

export interface ContentBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
  centerX: number
  centerY: number
}

/**
 * Tính toán Bounding Box bao trọn toàn bộ nội dung của nhân vật / mô hình
 * dựa trên toạ độ các layer và các khớp xương thực tế (head/tail).
 */
export function computeCompositeContentBounds(composite: LayerComposite): ContentBounds | null {
  const points: Array<{ x: number; y: number }> = []

  // 1. Thu thập các khớp xương (phản ánh chính xác giải phẫu nhân vật)
  if (composite.rig && composite.rig.bones.length > 0) {
    for (const b of composite.rig.bones) {
      const rad = (b.angle * Math.PI) / 180
      const hx = b.x
      const hy = b.y
      const tx = hx + Math.cos(rad) * b.length
      const ty = hy + Math.sin(rad) * b.length
      points.push({ x: hx, y: hy }, { x: tx, y: ty })
    }
  }

  // 2. Thu thập phạm vi của các layer
  const visibleLayers = composite.layers.filter((l) => !l.hidden)
  if (visibleLayers.length > 0) {
    for (const l of visibleLayers) {
      const scale = Math.max(0.05, l.scale || 1)
      // Ước tính kích thước mảnh layer dựa trên scale (khoảng 80-160px xung quanh tâm)
      const radius = Math.max(40, Math.min(220, 110 * scale))
      points.push(
        { x: l.x - radius, y: l.y - radius },
        { x: l.x + radius, y: l.y + radius }
      )
    }
  }

  if (points.length === 0) return null

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const width = Math.max(10, maxX - minX)
  const height = Math.max(10, maxY - minY)

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  }
}

/**
 * Phóng to / thu nhỏ nhân vật để vừa vặn chiếm ~84% chiều cao hoặc chiều rộng của khung sân khấu hiện tại.
 * Đồng thời căn tâm nhân vật về chính giữa (0, 0).
 */
export function fitCharacterToCanvas(composite: LayerComposite): LayerComposite {
  const bounds = computeCompositeContentBounds(composite)
  if (!bounds || bounds.width <= 10 || bounds.height <= 10) return composite

  const canvasW = composite.width
  const canvasH = composite.height

  // Mục tiêu: nhân vật chiếm 84% sân khấu
  const targetW = canvasW * 0.84
  const targetH = canvasH * 0.84

  const factorW = targetW / bounds.width
  const factorH = targetH / bounds.height
  const factor = Math.min(factorW, factorH)

  if (!Number.isFinite(factor) || factor <= 0.05 || factor >= 20 || Math.abs(factor - 1) < 0.02) {
    return composite
  }

  const cx = bounds.centerX
  const cy = bounds.centerY

  // Scale các layer quanh tâm nhân vật
  const nextLayers = composite.layers.map((l) => ({
    ...l,
    x: Math.round((l.x - cx) * factor),
    y: Math.round((l.y - cy) * factor),
    scale: Number(Math.max(0.05, l.scale * factor).toFixed(3))
  }))

  // Scale các xương đồng bộ
  let nextRig = composite.rig
  if (nextRig && nextRig.bones.length > 0) {
    const nextBones = nextRig.bones.map((b) => ({
      ...b,
      x: Math.round((b.x - cx) * factor),
      y: Math.round((b.y - cy) * factor),
      length: Math.max(5, Math.round(b.length * factor))
    }))
    nextRig = { ...nextRig, bones: nextBones }
  }

  return {
    ...composite,
    layers: nextLayers,
    rig: nextRig
  }
}

/**
 * Điều chỉnh kích thước khung sân khấu (width, height) ôm vừa sát nhân vật (cộng margin 50px).
 * Đồng thời đưa tâm nhân vật về (0, 0).
 */
export function fitCanvasToCharacter(composite: LayerComposite): LayerComposite {
  const bounds = computeCompositeContentBounds(composite)
  if (!bounds || bounds.width <= 10 || bounds.height <= 10) return composite

  const pad = 50
  const newW = Math.min(4000, Math.max(300, Math.ceil((bounds.width + pad * 2) / 20) * 20))
  const newH = Math.min(4000, Math.max(300, Math.ceil((bounds.height + pad * 2) / 20) * 20))

  const cx = bounds.centerX
  const cy = bounds.centerY

  const nextLayers = composite.layers.map((l) => ({
    ...l,
    x: Math.round(l.x - cx),
    y: Math.round(l.y - cy)
  }))

  let nextRig = composite.rig
  if (nextRig && nextRig.bones.length > 0) {
    const nextBones = nextRig.bones.map((b) => ({
      ...b,
      x: Math.round(b.x - cx),
      y: Math.round(b.y - cy)
    }))
    nextRig = { ...nextRig, bones: nextBones }
  }

  return {
    ...composite,
    width: newW,
    height: newH,
    layers: nextLayers,
    rig: nextRig
  }
}
