import React, { useEffect, useState } from 'react'
import * as THREE from 'three'
import { getImageSilhouette, silhouetteFromBoolGrid } from '../assets/models3d/silhouette'
import { computeContourCells, type ContourCell } from '../assets/models3d/contourMesh'

const MAX_CACHE_ENTRIES = 128

/** Cache các contour cells đã tính toán theo URL ảnh để tối ưu hiệu năng 60fps */
const cellsCache = new Map<string, ContourCell[]>()
/** Cache chuỗi SVG path duy nhất để render 1 phần tử <path> duy nhất 0ms */
const svgPathCache = new Map<string, string>()
const pendingLoads = new Map<string, Array<(cells: ContourCell[]) => void>>()

/**
 * Chuyển đổi các tam giác trong tế bào contour thành chuỗi SVG path duy nhất dạng M...L...L...Z
 * Giúp trình duyệt chỉ cần render đúng 1 phần tử DOM <path>, triệt tiêu 100% tình trạng giật lag.
 */
export function buildMeshSvgPath(cells: ContourCell[]): string {
  const parts: string[] = []
  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c]
    if (!cell.triangles || cell.triangles.length === 0) continue
    const poly = cell.polygon
    for (let t = 0; t < cell.triangles.length; t++) {
      const tri = cell.triangles[t]
      const p0 = poly[tri[0]]
      const p1 = poly[tri[1]]
      const p2 = poly[tri[2]]
      if (!p0 || !p1 || !p2) continue
      parts.push(
        `M${p0[0].toFixed(4)} ${p0[1].toFixed(4)}L${p1[0].toFixed(4)} ${p1[1].toFixed(4)}L${p2[0].toFixed(4)} ${p2[1].toFixed(4)}Z`
      )
    }
  }
  return parts.join('')
}

/**
 * Lấy chuỗi SVG path từ cache nếu đã được tính toán sẵn
 */
export function getLayerMeshSvgPath(
  imageUrl?: string | null,
  cols = 16,
  rows = 20
): string | null {
  if (!imageUrl) return null
  const cacheKey = `${imageUrl}_${cols}x${rows}`
  const cachedPath = svgPathCache.get(cacheKey)
  if (cachedPath !== undefined) return cachedPath
  const cells = cellsCache.get(cacheKey)
  if (cells) {
    const path = buildMeshSvgPath(cells)
    svgPathCache.set(cacheKey, path)
    return path
  }
  return null
}

/**
 * Xóa cache mesh (tế bào đa giác và chuỗi SVG path) khi ảnh hoặc cấu trúc layer bị thay đổi
 */
export function invalidateLayerMeshCache(imageUrlOrPrefix?: string): void {
  if (!imageUrlOrPrefix) {
    cellsCache.clear()
    svgPathCache.clear()
    return
  }
  for (const key of Array.from(cellsCache.keys())) {
    if (key.startsWith(imageUrlOrPrefix)) {
      cellsCache.delete(key)
    }
  }
  for (const key of Array.from(svgPathCache.keys())) {
    if (key.startsWith(imageUrlOrPrefix)) {
      svgPathCache.delete(key)
    }
  }
}

/**
 * Xóa toàn bộ dữ liệu mesh đã cache
 */
export function clearLayerMeshCache(): void {
  cellsCache.clear()
  svgPathCache.clear()
}

/**
 * Trích xuất hoặc lấy từ cache danh sách tế bào lưới đa giác bám sát pixel ảnh (loại bỏ hoàn toàn pixel trong suốt).
 */
export function getLayerContourCells(
  imageUrl: string | null | undefined,
  cols = 16,
  rows = 20,
  onReady?: (cells: ContourCell[]) => void
): ContourCell[] | null {
  if (!imageUrl) return null
  const cacheKey = `${imageUrl}_${cols}x${rows}`
  const cached = cellsCache.get(cacheKey)
  if (cached) {
    if (onReady) onReady(cached)
    return cached
  }

  const list = pendingLoads.get(cacheKey)
  if (list) {
    if (onReady) list.push(onReady)
    return null
  }
  pendingLoads.set(cacheKey, onReady ? [onReady] : [])

  // Tải ảnh vào đối tượng Image ngầm để đọc alpha silhouette
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    try {
      const sil = getImageSilhouette(img, true)
      const cells = sil ? computeContourCells(cols, rows, sil, 0, true) : []
      cellsCache.set(cacheKey, cells)
      svgPathCache.set(cacheKey, buildMeshSvgPath(cells))
      if (cellsCache.size > MAX_CACHE_ENTRIES) {
        cellsCache.delete(cellsCache.keys().next().value!)
        svgPathCache.delete(svgPathCache.keys().next().value!)
      }
      const callbacks = pendingLoads.get(cacheKey)
      pendingLoads.delete(cacheKey)
      callbacks?.forEach((cb) => cb(cells))
    } catch {
      cellsCache.set(cacheKey, [])
      svgPathCache.set(cacheKey, '')
      const callbacks = pendingLoads.get(cacheKey)
      pendingLoads.delete(cacheKey)
      callbacks?.forEach((cb) => cb([]))
    }
  }
  img.onerror = () => {
    cellsCache.set(cacheKey, [])
    svgPathCache.set(cacheKey, '')
    const callbacks = pendingLoads.get(cacheKey)
    pendingLoads.delete(cacheKey)
    callbacks?.forEach((cb) => cb([]))
  }
  img.src = imageUrl
  return null
}

/**
 * Tạo BufferGeometry 3D bám sát pixel đục (loại bỏ pixel trong suốt) cho Three.js với bộ đệm cache.
 */
export function createLayerAlphaTrimmedGeometry(
  width: number,
  height: number,
  image: HTMLImageElement | HTMLCanvasElement | boolean[][] | null | undefined,
  cols = 16,
  rows = 20
): THREE.BufferGeometry {
  if (!image) {
    return new THREE.PlaneGeometry(width, height, cols, rows)
  }
  try {
    let cells: ContourCell[] | undefined
    let cacheKey: string | null = null

    // Tận dụng cache nếu là HTMLImageElement có src
    if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement && image.src) {
      cacheKey = `${image.src}_${cols}x${rows}`
      cells = cellsCache.get(cacheKey)
    }

    if (!cells) {
      const silhouette = Array.isArray(image)
        ? silhouetteFromBoolGrid(image, image[0]?.length ?? 1, image.length)
        : getImageSilhouette(image, true)
      cells = silhouette ? computeContourCells(cols, rows, silhouette, 0, true) : []
      if (cacheKey) {
        cellsCache.set(cacheKey, cells)
        svgPathCache.set(cacheKey, buildMeshSvgPath(cells))
        if (cellsCache.size > MAX_CACHE_ENTRIES) {
          cellsCache.delete(cellsCache.keys().next().value!)
          svgPathCache.delete(svgPathCache.keys().next().value!)
        }
      }
    }

    const geometry = geometryFromLayerCells(width, height, cells)
    return geometry
  } catch (error) {
    console.warn('[Layer mesh] Cannot read alpha', error)
    return geometryFromLayerCells(width, height, [])
  }
}

export interface LayerAssembly2DMeshOverlayProps {
  imageUrl?: string | null
  showMesh: boolean
}

/**
 * Lớp SVG Mesh hiển thị đa giác lưới bám sát pixel ảnh trên khung vẽ 2D:
 * - Dùng chuỗi SVG path duy nhất (1 phần tử <path>) được cache trong bộ nhớ.
 * - Triệt tiêu 100% hiện tượng đơ/giật khi bật/tắt mesh.
 * - Bọc React.memo để không bị re-render vô ích khi parent cập nhật hoạt ảnh animation.
 */
export const LayerAssembly2DMeshOverlay = React.memo(function LayerAssembly2DMeshOverlay({
  imageUrl,
  showMesh
}: LayerAssembly2DMeshOverlayProps) {
  const [svgPath, setSvgPath] = useState<string | null>(() => {
    return imageUrl ? getLayerMeshSvgPath(imageUrl) : null
  })

  useEffect(() => {
    if (!showMesh || !imageUrl) return
    const cached = getLayerMeshSvgPath(imageUrl)
    if (cached) {
      setSvgPath(cached)
      return
    }
    let active = true
    getLayerContourCells(imageUrl, 16, 20, (loadedCells) => {
      if (active) {
        setSvgPath(buildMeshSvgPath(loadedCells))
      }
    })
    return () => {
      active = false
    }
  }, [imageUrl, showMesh])

  if (!showMesh || !imageUrl || !svgPath) {
    return null
  }

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 15
      }}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      <path
        d={svgPath}
        fill="none"
        stroke="var(--accent-cyan)"
        strokeWidth="0.75"
        strokeOpacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
})

/** Weld shared vertices so the image, wireframe and deformation share identical topology. */
export function geometryFromLayerCells(width: number, height: number, cells: ContourCell[]): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  const ids = new Map<string, number>()
  for (const cell of cells) for (const triangle of cell.triangles) for (const index of triangle) {
    const [u, v] = cell.polygon[index]
    const key = `${u.toFixed(9)}:${v.toFixed(9)}`
    let id = ids.get(key)
    if (id === undefined) {
      id = positions.length / 3
      ids.set(key, id)
      positions.push((u - 0.5) * width, (0.5 - v) * height, 0)
      uvs.push(u, 1 - v)
    }
    indices.push(id)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.userData = { basePositions: new Float32Array(positions), width, height }
  return geometry
}
