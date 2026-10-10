export interface BrushPoint { x: number; y: number }
export interface StrokeSettings { radiusX: number; radiusY: number; opacity: number; hardness: number }

/** Stroke coverage is a maximum, not a sum: 20% erasing remains 20% at overlaps. */
export function createAlphaStroke(data: Uint8ClampedArray, width: number, height: number, settings: StrokeSettings) {
  const original = data.slice()
  const coverage = new Float32Array(width * height)
  const rx = Math.max(0.01, Math.abs(settings.radiusX)), ry = Math.max(0.01, Math.abs(settings.radiusY))
  const opacity = Math.max(0, Math.min(1, settings.opacity)), hardness = Math.max(0, Math.min(1, settings.hardness))
  let changed = false
  function segment(from: BrushPoint, to: BrushPoint) {
    const dx = (to.x - from.x) / rx, dy = (to.y - from.y) / ry
    const length2 = dx * dx + dy * dy
    const left = Math.max(0, Math.floor(Math.min(from.x, to.x) - rx - 1))
    const right = Math.min(width - 1, Math.ceil(Math.max(from.x, to.x) + rx + 1))
    const top = Math.max(0, Math.floor(Math.min(from.y, to.y) - ry - 1))
    const bottom = Math.min(height - 1, Math.ceil(Math.max(from.y, to.y) + ry + 1))
    const feather = Math.max(1 - hardness, 1 / Math.min(rx, ry))
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const px = (x + 0.5 - from.x) / rx, py = (y + 0.5 - from.y) / ry
      const t = length2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / length2)) : 0
      const distance = Math.hypot(px - dx * t, py - dy * t)
      const fade = Math.max(0, Math.min(1, (1 - distance) / feather))
      const amount = fade * fade * (3 - 2 * fade)
      const i = y * width + x
      if (amount <= coverage[i]) continue
      coverage[i] = amount
      const alpha = Math.round(original[i * 4 + 3] * (1 - opacity * amount))
      if (alpha !== data[i * 4 + 3]) changed = true
      data[i * 4 + 3] = alpha
    }
  }
  return { segment, get changed() { return changed } }
}

/** Convert a flat rest-pose viewport into source pixels, retaining mirrored scales. */
export function brushPixel(point: BrushPoint, center: BrushPoint, zoom: number,
  layer: { x: number; y: number; rotation: number; scale: number; scaleX?: number; scaleY?: number },
  width: number, height: number): BrushPoint | null {
  const factor = Math.min(1, 380 / Math.max(width, height))
  const sx = layer.scale * (layer.scaleX ?? 1) * factor, sy = layer.scale * (layer.scaleY ?? 1) * factor
  if (Math.abs(sx * sy * zoom) < 1e-8) return null
  const x = (point.x - center.x) / zoom - layer.x, y = (point.y - center.y) / zoom - layer.y
  const radians = -layer.rotation * Math.PI / 180
  return { x: (x * Math.cos(radians) - y * Math.sin(radians)) / sx + width / 2,
    y: (x * Math.sin(radians) + y * Math.cos(radians)) / sy + height / 2 }
}
