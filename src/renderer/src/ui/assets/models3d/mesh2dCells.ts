import { computeContourCells } from './contourMesh'
import type { Silhouette } from './silhouette'
import { projectDeformedPoint2D, type FaceDeformParams } from './mesh2dDeform'

export interface EditorCell {
  key: string
  r: number
  c: number
  /** Full cell polygon in image pixels: [TL, TR, BR, BL] (deformed if deformFace is set). */
  corners: [number, number][]
  /** Kept mesh triangles in image pixels (contour-clipped and deformed). */
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
  silhouette: Silhouette | null
  rotation: number
  autoTrim: boolean
  hidden: Set<string>
  selected: Set<string>
  pinned: Set<string>
  deformFace?: FaceDeformParams | null
}

/**
 * Mesh cells for the 2D editor overlay — produced by the same contour builder as the 3D
 * mesh, so what you see on the image is exactly what gets built in the viewport.
 * When deformFace is provided, vertices are projected to mirror the 3D deformation.
 */
export function buildEditorCells(o: EditorCellOptions): EditorCell[] {
  const cellW = o.imgW / o.cols
  const cellH = o.imgH / o.rows
  const contour = new Map(computeContourCells(o.cols, o.rows, o.silhouette, o.rotation, o.autoTrim).map((c) => [c.key, c]))
  const list: EditorCell[] = []
  const hasDeform = Boolean(o.deformFace)

  for (let r = 0; r < o.rows; r++) {
    for (let c = 0; c < o.cols; c++) {
      const key = `${r}_${c}`
      const x0 = c * cellW
      const x1 = (c + 1) * cellW
      const y0 = r * cellH
      const y1 = (r + 1) * cellH
      const cell = contour.get(key)

      const rawCorners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
      const corners = hasDeform
        ? rawCorners.map(([px, py]) => projectDeformedPoint2D(px, py, o.imgW, o.imgH, o.deformFace))
        : rawCorners

      const triangles = cell
        ? cell.triangles.map((tri) =>
            tri.map((i) => {
              const px = cell.polygon[i][0] * o.imgW
              const py = cell.polygon[i][1] * o.imgH
              return hasDeform ? projectDeformedPoint2D(px, py, o.imgW, o.imgH, o.deformFace) : ([px, py] as [number, number])
            })
          )
        : []

      list.push({
        key,
        r,
        c,
        corners,
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
