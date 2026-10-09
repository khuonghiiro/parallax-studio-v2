/**
 * Image Mesh Contract & Coordinate System Schema
 *
 * Defines the contract between 2D source artwork, UV rest domain, and 3D mesh deformation.
 *
 * Coordinate Convention:
 * - Image Space: Normalized [0, 1] x [0, 1], origin top-left (x right, y down).
 * - Mesh UV Space: Normalized [0, 1] x [0, 1], origin bottom-left (u right, v UP).
 *
 * Single Canonical Conversion:
 *   v = 1 - y
 *   y = 1 - v
 */

export const IMAGE_CONTRACT_SCHEMA_VERSION = 1

export type CoordinateSpace = 'image' | 'uv'

export interface AttachmentBand {
  /** Bottom boundary in UV space (0..1, v up). E.g. 0.0 for petals/leaves touching bottom edge */
  vMin: number
  /** Top boundary of the attachment band in UV space */
  vMax: number
  /** Optional horizontal constraint in UV space (0..1, u right) */
  uMin?: number
  uMax?: number
  en?: string
  vi?: string
}

export interface ContentBounds {
  uMin: number
  uMax: number
  vMin: number
  vMax: number
}

export type BackSidePolicy = 'same' | 'mirror' | 'separate' | 'none'
export type SilhouettePolicy = 'strict' | 'relaxed' | 'polygon' | 'opaque'
export type ReusePolicy = 'shared' | 'unique' | 'mirrored'
export type MaterialGroup =
  | 'foliage'
  | 'petal'
  | 'stem'
  | 'center'
  | 'pot'
  | 'soil'
  | 'facade'
  | 'metal'
  | 'decor'
  | 'misc'

function roundCoord(v: number): number {
  return Math.round(v * 1e6) / 1e6
}

/**
 * Coordinate conversions between Image (top-left, y down) and UV (bottom-left, v up).
 */
export function imageYToUvV(y: number): number {
  return roundCoord(1 - y)
}

export function uvVToImageY(v: number): number {
  return roundCoord(1 - v)
}

export function imagePointToUV(pt: [number, number]): [number, number] {
  return [roundCoord(pt[0]), roundCoord(1 - pt[1])]
}

export function uvToImagePoint(uv: [number, number]): [number, number] {
  return [roundCoord(uv[0]), roundCoord(1 - uv[1])]
}

/**
 * Converts image bounding box [x0, y0, x1, y1] to UV bounding box [uMin, vMin, uMax, vMax].
 */
export function imageBoundsToUvBounds(bounds: [number, number, number, number]): [number, number, number, number] {
  const [x0, y0, x1, y1] = bounds
  return [
    Math.min(x0, x1),
    Math.min(1 - y1, 1 - y0),
    Math.max(x0, x1),
    Math.max(1 - y1, 1 - y0)
  ]
}

/**
 * Converts UV bounding box [uMin, vMin, uMax, vMax] to image bounding box [x0, y0, x1, y1].
 */
export function uvBoundsToImageBounds(bounds: [number, number, number, number]): [number, number, number, number] {
  const [uMin, vMin, uMax, vMax] = bounds
  return [
    Math.min(uMin, uMax),
    Math.min(1 - vMax, 1 - vMin),
    Math.max(uMin, uMax),
    Math.max(1 - vMax, 1 - vMin)
  ]
}

/**
 * Normalized polygon conversion between Image and UV coordinates.
 */
export function convertPolygonSpace(polygon: number[][], from: CoordinateSpace, to: CoordinateSpace): number[][] {
  if (from === to) return polygon.map(([x, y]) => [roundCoord(x), roundCoord(y)])
  return polygon.map(([x, y]) => [roundCoord(x), roundCoord(1 - y)])
}

export interface ImageMeshSlotContract {
  schemaVersion: number
  id: string
  label: string
  en: string
  /** Canvas aspect ratio [widthRatio, heightRatio] */
  aspect: [number, number]
  prompt: string
  guidance: string
  alphaMode: 'cutout' | 'opaque'
  imageOrigin: 'top-left'
  /** Attachment / Root pivot in UV space [u, v] (v up). E.g. [0.5, 0.0] for petal base */
  anchorUV: [number, number]
  /** Apex / Tip point in UV space [u, v] (v up). E.g. [0.5, 1.0] for petal tip */
  tipUV?: [number, number]
  attachmentBand?: AttachmentBand
  contentBounds?: ContentBounds
  silhouettePolicy: SilhouettePolicy
  /** Silhouette polygon in UV space [u, v] (v up) */
  silhouettePolygon?: number[][]
  symmetry: { en: string; vi: string }
  backPolicy: BackSidePolicy
  backSlotId?: string
  reusePolicy: ReusePolicy
  materialGroup?: MaterialGroup
}

/**
 * Generates comprehensive, precise bilingual generation prompts from slot contract.
 */
export function buildSlotPrompts(slot: Partial<ImageMeshSlotContract> & {
  id: string
  label: string
  en: string
  aspect: [number, number]
  alphaMode: 'cutout' | 'opaque'
  prompt: string
  symmetry: { en: string; vi: string }
}) {
  const aspectStr = `${slot.aspect[0]}:${slot.aspect[1]}`
  const anchor = slot.anchorUV ?? (slot.alphaMode === 'opaque' ? [0.5, 0.5] : [0.5, 0.0])
  const anchorYImg = (1 - anchor[1]).toFixed(2)
  const anchorXImg = anchor[0].toFixed(2)

  const alphaInstructionEn = slot.alphaMode === 'cutout'
    ? 'Clean transparent alpha background (cutout, alpha=0), strictly no checkerboard pattern, no surrounding frame or cast shadows.'
    : 'Solid opaque surface, opaque edge-to-edge (alpha=255 across all four borders).'

  const alphaInstructionVi = slot.alphaMode === 'cutout'
    ? 'Nền alpha trong suốt thật (cutout, alpha=0), tuyệt đối không vẽ nền caro hay bóng đổ ngoại cảnh.'
    : 'Bề mặt kín phủ đầy ảnh, đục tuyệt đối tới cả bốn mép viền (alpha=255).'

  const attachmentNoteEn = slot.attachmentBand
    ? `Root attachment edge touches the bottom band at UV v=${slot.attachmentBand.vMin.toFixed(2)}..${slot.attachmentBand.vMax.toFixed(2)} (image y=${(1 - slot.attachmentBand.vMax).toFixed(2)}..${(1 - slot.attachmentBand.vMin).toFixed(2)}) with solid connected pixels.`
    : `Anchor point positioned at image (${anchorXImg}, ${anchorYImg}).`

  const attachmentNoteVi = slot.attachmentBand
    ? `Chân gốc tiếp giáp chạm mép đáy ở dải UV v=${slot.attachmentBand.vMin.toFixed(2)}..${slot.attachmentBand.vMax.toFixed(2)} với pixel đặc liền khối.`
    : `Điểm neo tọa độ ảnh (${anchorXImg}, ${anchorYImg}).`

  const renderPromptEn = [
    `Orthographic flat 2D render, camera facing perpendicular. Aspect ratio ${aspectStr}.`,
    slot.prompt,
    'Neutral diffuse illumination, no 3D perspective foreshortening, no pre-bent or curved geometry (3D curvature is added procedurally by the engine).',
    slot.symmetry.en,
    attachmentNoteEn,
    alphaInstructionEn
  ].join(' ')

  const renderPromptVi = [
    `Ảnh 2D nhìn vuông góc trực diện. Tỉ lệ khung hình ${aspectStr}.`,
    slot.prompt,
    'Ánh sáng khuếch tán đều, không phối cảnh thu ngắn, không vẽ hình đã uốn cong sẵn (độ cong 3D do phần mềm tự tính).',
    slot.symmetry.vi,
    attachmentNoteVi,
    alphaInstructionVi
  ].join(' ')

  return { renderPromptEn, renderPromptVi }
}

/**
 * Generates an SVG visual guide / reference mask with coordinate markers and attachment bands.
 * Intended for AI reference and user preview - never baked into final texture.
 */
export function generateSlotGuideSvg(
  slot: Partial<ImageMeshSlotContract> & {
    id: string
    label: string
    aspect: [number, number]
    anchorUV?: [number, number]
    tipUV?: [number, number]
    attachmentBand?: AttachmentBand
    silhouettePolygon?: number[][]
    alphaMode?: 'cutout' | 'opaque'
  },
  width = 300
): string {
  const height = Math.round((width * slot.aspect[1]) / slot.aspect[0])
  const anchor = slot.anchorUV ?? [0.5, 0.0]
  const tip = slot.tipUV ?? [0.5, 1.0]

  const anchorX = anchor[0] * width
  const anchorY = (1 - anchor[1]) * height
  const tipX = tip[0] * width
  const tipY = (1 - tip[1]) * height

  let polygonSvg = ''
  if (slot.silhouettePolygon && slot.silhouettePolygon.length >= 3) {
    const pts = slot.silhouettePolygon
      .map(([u, v]) => `${(u * width).toFixed(1)},${((1 - v) * height).toFixed(1)}`)
      .join(' ')
    polygonSvg = `<polygon points="${pts}" fill="rgba(56, 189, 248, 0.15)" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 2" />`
  }

  let bandSvg = ''
  if (slot.attachmentBand) {
    const bY0 = (1 - slot.attachmentBand.vMax) * height
    const bH = (slot.attachmentBand.vMax - slot.attachmentBand.vMin) * height
    const bX0 = (slot.attachmentBand.uMin ?? 0) * width
    const bW = ((slot.attachmentBand.uMax ?? 1) - (slot.attachmentBand.uMin ?? 0)) * width
    bandSvg = `
      <rect x="${bX0.toFixed(1)}" y="${bY0.toFixed(1)}" width="${bW.toFixed(1)}" height="${bH.toFixed(1)}"
            fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3 3"/>
      <text x="${(bX0 + bW / 2).toFixed(1)}" y="${(bY0 + bH / 2 + 4).toFixed(1)}"
            font-size="10" font-family="sans-serif" font-weight="bold" fill="#ef4444" text-anchor="middle">
        VÙNG GỐC / ATTACHMENT
      </text>
    `
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <pattern id="checkers-${slot.id}" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#18181b"/>
      <rect x="8" width="8" height="8" fill="#27272a"/>
      <rect y="8" width="8" height="8" fill="#27272a"/>
      <rect x="8" y="8" width="8" height="8" fill="#18181b"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#checkers-${slot.id})"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="#52525b" stroke-width="1"/>
  ${polygonSvg}
  ${bandSvg}
  <!-- Central alignment line -->
  <line x1="${(width / 2).toFixed(1)}" y1="0" x2="${(width / 2).toFixed(1)}" y2="${height}" stroke="#3f3f46" stroke-width="1" stroke-dasharray="2 4"/>
  <!-- Tip marker -->
  <circle cx="${tipX.toFixed(1)}" cy="${tipY.toFixed(1)}" r="5" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
  <text x="${tipX.toFixed(1)}" y="${(tipY + (tipY < 20 ? 14 : -8)).toFixed(1)}" font-size="10" font-family="sans-serif" font-weight="bold" fill="#10b981" text-anchor="middle">TIP</text>
  <!-- Anchor marker -->
  <circle cx="${anchorX.toFixed(1)}" cy="${anchorY.toFixed(1)}" r="6" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5"/>
  <line x1="${(anchorX - 10).toFixed(1)}" y1="${anchorY.toFixed(1)}" x2="${(anchorX + 10).toFixed(1)}" y2="${anchorY.toFixed(1)}" stroke="#f59e0b" stroke-width="2"/>
  <text x="${anchorX.toFixed(1)}" y="${(anchorY + (anchorY > height - 20 ? -10 : 16)).toFixed(1)}" font-size="10" font-family="sans-serif" font-weight="bold" fill="#f59e0b" text-anchor="middle">ROOT (GỐC)</text>
  <text x="${(width / 2).toFixed(1)}" y="${(height - 6).toFixed(1)}" font-size="8" font-family="sans-serif" fill="#71717a" text-anchor="middle">GUIDE ONLY · KHÔNG VẼ VẠCH NÀY</text>
</svg>`
}

export function generateSlotGuideDataUrl(
  slot: Partial<ImageMeshSlotContract> & {
    id: string
    label: string
    aspect: [number, number]
    anchorUV?: [number, number]
    tipUV?: [number, number]
    attachmentBand?: AttachmentBand
    silhouettePolygon?: number[][]
    alphaMode?: 'cutout' | 'opaque'
  },
  width = 300
): string {
  const svg = generateSlotGuideSvg(slot, width)
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
