import { computeBendLateralX, type BendRegion } from './alphaMeshBuilder'
import type { Face3D } from './types'

export type FaceDeformParams = Pick<
  Face3D,
  'bendX' | 'bendY' | 'bendLateral' | 'bendRegion' | 'arcAngle' | 'taperRatio' | 'sculptOffsets'
>

/**
 * Checks whether a face has any 3D deformation applied.
 */
export function hasFaceDeformation(face?: FaceDeformParams | null): boolean {
  if (!face) return false
  return (
    (face.bendX !== undefined && face.bendX !== 0) ||
    (face.bendY !== undefined && face.bendY !== 0) ||
    (face.bendLateral !== undefined && face.bendLateral !== 0) ||
    (face.arcAngle !== undefined && face.arcAngle > 0) ||
    (face.taperRatio !== undefined && Math.abs(face.taperRatio - 1) > 0.001) ||
    Boolean(face.sculptOffsets && face.sculptOffsets.length > 0 && face.sculptOffsets.some((v) => Math.abs(v) > 0.01))
  )
}

/**
 * Projects a 2D image pixel coordinate (px, py) within [0..imgW, 0..imgH] into
 * the deformed 2D coordinate resulting from 3D bends (taper, lateral curve, arc, etc.).
 *
 * Coordinates:
 * - u in [0, 1] horizontally (left to right)
 * - v in [0, 1] vertically (0 at bottom, 1 at top)
 */
export function projectDeformedPoint2D(
  px: number,
  py: number,
  imgW: number,
  imgH: number,
  deform?: FaceDeformParams | null
): [number, number] {
  if (!deform || !hasFaceDeformation(deform)) {
    return [px, py]
  }

  const {
    bendX = 0,
    bendY = 0,
    bendLateral = 0,
    bendRegion = 'all',
    arcAngle = 0,
    taperRatio = 1
  } = deform

  const u = Math.max(0, Math.min(1, imgW > 0 ? px / imgW : 0))
  const v = Math.max(0, Math.min(1, imgH > 0 ? 1 - py / imgH : 0))

  // 1. Taper deformation (bottom v=0 -> width 100%, top v=1 -> width taperRatio)
  const sV = taperRatio !== 1 ? 1 - (1 - taperRatio) * v : 1
  const cx = imgW / 2
  let x = cx + (px - cx) * sV

  // 2. Lateral curve deformation (S-curve, C-curve, dạt ngọn lá sang trái/phải)
  if (bendLateral !== 0) {
    const latDx = computeBendLateralX(u, v, imgW, imgH, bendLateral, bendRegion as BendRegion)
    x += latDx
  }

  // 3. Cylindrical Arc Angle (cuộn tròn thành ống trụ hoặc vòm)
  if (arcAngle > 0) {
    const bendFactor = bendX !== 0 ? bendX / 100 : 1.0
    const alpha = ((arcAngle * Math.PI) / 180) * bendFactor
    const halfAngle = alpha / 2
    if (Math.abs(halfAngle) > 1e-4) {
      const localW = imgW * sV
      const radius = localW / 2 / Math.sin(halfAngle)
      const theta = (u - 0.5) * alpha
      // Projected horizontal position
      const arcX = radius * Math.sin(theta)
      // Replace x offset from center with projected arc X
      const latOffset = bendLateral !== 0 ? computeBendLateralX(u, v, imgW, imgH, bendLateral, bendRegion as BendRegion) : 0
      x = cx + arcX + latOffset
    }
  }

  // 4. Vertical bend (bendY: co nhẹ hình chiếu đứng khi uốn vòm dọc)
  let y = py
  if (bendY !== 0) {
    const ySqueeze = (Math.abs(bendY) / 100) * Math.sin(v * Math.PI) * (imgH * 0.05)
    y = py + (bendY > 0 ? -ySqueeze : ySqueeze)
  }

  return [x, y]
}

/**
 * Generates an SVG path data string for the deformed boundary frame of the image,
 * sampling points along the bottom, right, top, and left edges.
 */
export function generateDeformedFramePath(
  imgW: number,
  imgH: number,
  deform?: FaceDeformParams | null,
  samplesPerEdge = 24
): string {
  if (!deform || !hasFaceDeformation(deform)) {
    return `M 0 0 L ${imgW} 0 L ${imgW} ${imgH} L 0 ${imgH} Z`
  }

  const pts: [number, number][] = []

  // Top edge: x from 0 to imgW at y = 0
  for (let i = 0; i <= samplesPerEdge; i++) {
    const t = i / samplesPerEdge
    pts.push(projectDeformedPoint2D(t * imgW, 0, imgW, imgH, deform))
  }

  // Right edge: y from 0 to imgH at x = imgW
  for (let i = 1; i <= samplesPerEdge; i++) {
    const t = i / samplesPerEdge
    pts.push(projectDeformedPoint2D(imgW, t * imgH, imgW, imgH, deform))
  }

  // Bottom edge: x from imgW down to 0 at y = imgH
  for (let i = 1; i <= samplesPerEdge; i++) {
    const t = 1 - i / samplesPerEdge
    pts.push(projectDeformedPoint2D(t * imgW, imgH, imgW, imgH, deform))
  }

  // Left edge: y from imgH up to 0 at x = 0
  for (let i = 1; i < samplesPerEdge; i++) {
    const t = 1 - i / samplesPerEdge
    pts.push(projectDeformedPoint2D(0, t * imgH, imgW, imgH, deform))
  }

  if (pts.length === 0) return ''
  const [first, ...rest] = pts
  return `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} ` + rest.map((p) => `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + ' Z'
}
