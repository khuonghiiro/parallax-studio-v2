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
  /** Độ lồi (+) hoặc lõm (-) trung bình từ cọ điêu khắc 3D (Relief) */
  depthRelief?: number
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
  const sculpt = o.deformFace?.sculptOffsets
  const hasSculpt = Boolean(sculpt && sculpt.length > 0)

  const getOffset = (row: number, col: number) => {
    if (!sculpt) return { ox: 0, oy: 0, oz: 0 }
    const vIdx = row * (o.cols + 1) + col
    return {
      ox: sculpt[vIdx * 3] || 0,
      oy: sculpt[vIdx * 3 + 1] || 0,
      oz: sculpt[vIdx * 3 + 2] || 0
    }
  }

  for (let r = 0; r < o.rows; r++) {
    for (let c = 0; c < o.cols; c++) {
      const key = `${r}_${c}`
      const x0 = c * cellW
      const x1 = (c + 1) * cellW
      const y0 = r * cellH
      const y1 = (r + 1) * cellH
      const cell = contour.get(key)

      const dTL = hasSculpt ? getOffset(r, c) : null
      const dTR = hasSculpt ? getOffset(r, c + 1) : null
      const dBR = hasSculpt ? getOffset(r + 1, c + 1) : null
      const dBL = hasSculpt ? getOffset(r + 1, c) : null

      const rawCorners: [number, number][] = [
        [x0 + (dTL ? dTL.ox : 0), y0 - (dTL ? dTL.oy : 0)],
        [x1 + (dTR ? dTR.ox : 0), y0 - (dTR ? dTR.oy : 0)],
        [x1 + (dBR ? dBR.ox : 0), y1 - (dBR ? dBR.oy : 0)],
        [x0 + (dBL ? dBL.ox : 0), y1 - (dBL ? dBL.oy : 0)]
      ]
      const corners = hasDeform
        ? rawCorners.map(([px, py]) => projectDeformedPoint2D(px, py, o.imgW, o.imgH, o.deformFace))
        : rawCorners

      const triangles = cell
        ? cell.triangles.map((tri) =>
            tri.map((i) => {
              let px = cell.polygon[i][0] * o.imgW
              let py = cell.polygon[i][1] * o.imgH
              if (hasSculpt) {
                const uRel = Math.max(0, Math.min(1, cellW > 0 ? (px - x0) / cellW : 0))
                const vRel = Math.max(0, Math.min(1, cellH > 0 ? (py - y0) / cellH : 0))
                const ox =
                  (1 - uRel) * (1 - vRel) * (dTL?.ox || 0) +
                  uRel * (1 - vRel) * (dTR?.ox || 0) +
                  uRel * vRel * (dBR?.ox || 0) +
                  (1 - uRel) * vRel * (dBL?.ox || 0)
                const oy =
                  (1 - uRel) * (1 - vRel) * (dTL?.oy || 0) +
                  uRel * (1 - vRel) * (dTR?.oy || 0) +
                  uRel * vRel * (dBR?.oy || 0) +
                  (1 - uRel) * vRel * (dBL?.oy || 0)
                px += ox
                py -= oy
              }
              return hasDeform ? projectDeformedPoint2D(px, py, o.imgW, o.imgH, o.deformFace) : ([px, py] as [number, number])
            })
          )
        : []

      const avgZ =
        hasSculpt && (dTL || dTR || dBR || dBL)
          ? ((dTL?.oz || 0) + (dTR?.oz || 0) + (dBR?.oz || 0) + (dBL?.oz || 0)) / 4
          : 0

      list.push({
        key,
        r,
        c,
        corners,
        triangles,
        isOpaque: Boolean(cell),
        isHidden: o.hidden.has(key),
        isSelected: o.selected.has(key),
        isPinned: o.pinned.has(key),
        depthRelief: Math.round(avgZ * 10) / 10
      })
    }
  }
  return list
}
