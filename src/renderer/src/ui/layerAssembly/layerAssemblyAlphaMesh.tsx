import React, { useEffect, useState } from 'react'
import * as THREE from 'three'
import { getImageSilhouette, silhouetteFromBoolGrid } from '../assets/models3d/silhouette'
import { computeContourCells, type ContourCell } from '../assets/models3d/contourMesh'

const MAX_CACHE_ENTRIES = 160

/** Cache các contour cells đã tính toán theo khóa URL rút gọn O(1) để tối ưu hiệu năng 60fps (tránh băm chuỗi data:image 400KB) */
const cellsCache = new Map<string, ContourCell[]>()
/** Cache chuỗi SVG path duy nhất (khởi tạo lười khi thực sự bật xem lưới Mesh) */
const svgPathCache = new Map<string, string>()
const pendingLoads = new Map<string, Array<(cells: ContourCell[]) => void>>()
const canvasObjectIds = new WeakMap<object, string>()
let nextCanvasObjSeq = 1

function makeFastImageCacheKey(url: string, cols: number, rows: number): string {
  if (url.length <= 240) return `${url}_${cols}x${rows}`
  let hash = 2166136261
  const samples = 64
  const step = Math.max(1, Math.floor(url.length / samples))
  for (let i = 0; i < url.length; i += step) {
    hash ^= url.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= url.charCodeAt(url.length - 1)
  hash = Math.imul(hash, 16777619)
  return `${url.slice(0, 64)}#${url.length}#${(hash >>> 0).toString(36)}_${cols}x${rows}`
}

function storeCellsCache(cacheKey: string, cells: ContourCell[]): void {
  cellsCache.set(cacheKey, cells)
  if (cellsCache.size > MAX_CACHE_ENTRIES) {
    const oldest = cellsCache.keys().next().value
    if (oldest !== undefined) {
      cellsCache.delete(oldest)
      svgPathCache.delete(oldest)
    }
  }
}

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
  const cacheKey = makeFastImageCacheKey(imageUrl, cols, rows)
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
  const shortPrefix = imageUrlOrPrefix.length > 64 ? imageUrlOrPrefix.slice(0, 64) : imageUrlOrPrefix
  for (const key of Array.from(cellsCache.keys())) {
    if (key.startsWith(imageUrlOrPrefix) || key.startsWith(shortPrefix)) {
      cellsCache.delete(key)
    }
  }
  for (const key of Array.from(svgPathCache.keys())) {
    if (key.startsWith(imageUrlOrPrefix) || key.startsWith(shortPrefix)) {
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
  const cacheKey = makeFastImageCacheKey(imageUrl, cols, rows)
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

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    try {
      const sil = getImageSilhouette(img, true)
      const cells = sil ? computeContourCells(cols, rows, sil, 0, true) : []
      storeCellsCache(cacheKey, cells)
      const callbacks = pendingLoads.get(cacheKey)
      pendingLoads.delete(cacheKey)
      callbacks?.forEach((cb) => cb(cells))
    } catch {
      storeCellsCache(cacheKey, [])
      const callbacks = pendingLoads.get(cacheKey)
      pendingLoads.delete(cacheKey)
      callbacks?.forEach((cb) => cb([]))
    }
  }
  img.onerror = () => {
    storeCellsCache(cacheKey, [])
    const callbacks = pendingLoads.get(cacheKey)
    pendingLoads.delete(cacheKey)
    callbacks?.forEach((cb) => cb([]))
  }
  img.src = imageUrl
  return null
}

/**
 * Tạo BufferGeometry 3D bám sát pixel đục (loại bỏ pixel trong suốt) cho Three.js với bộ đệm cache O(1).
 */
export function createLayerAlphaTrimmedGeometry(
  width: number,
  height: number,
  image: HTMLImageElement | HTMLCanvasElement | boolean[][] | null | undefined,
  cols = 16,
  rows = 20
): THREE.BufferGeometry {
  if (!image) {
    const fallback = new THREE.PlaneGeometry(width, height, cols, rows)
    const pos = fallback.getAttribute('position')
    if (pos) {
      fallback.userData = { basePositions: new Float32Array(pos.array as Float32Array), width, height }
    }
    return fallback
  }
  try {
    let cells: ContourCell[] | undefined
    let cacheKey: string | null = null

    if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement && image.src) {
      cacheKey = makeFastImageCacheKey(image.src, cols, rows)
      cells = cellsCache.get(cacheKey)
    } else if (!Array.isArray(image) && typeof image === 'object') {
      let objId = canvasObjectIds.get(image)
      if (!objId) {
        objId = `canvas#${nextCanvasObjSeq++}`
        canvasObjectIds.set(image, objId)
      }
      cacheKey = `${objId}_${cols}x${rows}`
      cells = cellsCache.get(cacheKey)
    }

    if (!cells) {
      const silhouette = Array.isArray(image)
        ? silhouetteFromBoolGrid(image, image[0]?.length ?? 1, image.length)
        : getImageSilhouette(image, true)
      cells = silhouette ? computeContourCells(cols, rows, silhouette, 0, true) : []
      if (cacheKey) {
        storeCellsCache(cacheKey, cells)
      }
    }

    return geometryFromLayerCells(width, height, cells)
  } catch (error) {
    console.warn('[Layer mesh] Cannot read alpha', error)
    return geometryFromLayerCells(width, height, [])
  }
}

export interface LayerAssembly2DMeshOverlayProps {
  imageUrl?: string | null
  showMesh: boolean
}

export const LayerAssembly2DMeshOverlay = React.memo(function LayerAssembly2DMeshOverlay({
  imageUrl,
  showMesh
}: LayerAssembly2DMeshOverlayProps) {
  const [svgPath, setSvgPath] = useState<string | null>(() => {
    return showMesh && imageUrl ? getLayerMeshSvgPath(imageUrl) : null
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
