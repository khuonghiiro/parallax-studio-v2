import { computeContourCells, type AlphaField } from './contourMesh'

export interface EditorCell {
  key: string
  r: number
  c: number
  /** Full cell rectangle in image pixels: [TL, TR, BR, BL] (used for marquee hit tests). */
  corners: [number, number][]
  /** Kept mesh triangles in image pixels (contour-clipped on boundary cells). */
  triangles: [number, number][][]
  /** The cell carries mesh geometry (not fully transparent). */
  isOpaque: boolean
  isHidden: boolean
  isSelected: boolean
  isPinned: boolean
}

export interface EditorCellOptions {
  cols: number
  rows: number
  imgW: number
  imgH: number
  field: AlphaField | null
  rotation: number
  autoTrim: boolean
  hidden: Set<string>
  selected: Set<string>
  pinned: Set<string>
}

/**
 * Mesh cells for the 2D editor overlay — produced by the same contour builder as the 3D
 * mesh, so what you see on the image is exactly what gets built in the viewport.
 */
export function buildEditorCells(o: EditorCellOptions): EditorCell[] {
  const cellW = o.imgW / o.cols
  const cellH = o.imgH / o.rows
  const contour = new Map(computeContourCells(o.cols, o.rows, o.field, o.rotation, o.autoTrim).map((c) => [c.key, c]))
  const list: EditorCell[] = []
  for (let r = 0; r < o.rows; r++) {
    for (let c = 0; c < o.cols; c++) {
      const key = `${r}_${c}`
      const x0 = c * cellW
      const x1 = (c + 1) * cellW
      const y0 = r * cellH
      const y1 = (r + 1) * cellH
      const cell = contour.get(key)
      const triangles = cell
        ? cell.triangles.map((tri) => tri.map((i) => [cell.polygon[i][0] * o.imgW, cell.polygon[i][1] * o.imgH] as [number, number]))
        : []
      list.push({
        key,
        r,
        c,
        corners: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
        triangles,
        isOpaque: Boolean(cell),
        isHidden: o.hidden.has(key),
        isSelected: o.selected.has(key),
        isPinned: o.pinned.has(key)
      })
    }
  }
  return list
}
