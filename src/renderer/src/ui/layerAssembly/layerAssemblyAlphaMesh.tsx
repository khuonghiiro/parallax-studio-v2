import React, { useEffect, useState } from 'react'
import * as THREE from 'three'
import { getImageSilhouette } from '../assets/models3d/silhouette'
import { computeContourCells, type ContourCell } from '../assets/models3d/contourMesh'
import { buildAlphaTrimmedGeometry } from '../assets/models3d/alphaMeshBuilder'

/** Cache các contour cells đã tính toán theo URL ảnh để tối ưu hiệu năng 60fps */
const cellsCache = new Map<string, ContourCell[]>()
const pendingLoads = new Map<string, Array<(cells: ContourCell[]) => void>>()

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
  if (cached) return cached

  if (onReady) {
    const list = pendingLoads.get(cacheKey)
    if (list) {
      list.push(onReady)
      return null
    }
    pendingLoads.set(cacheKey, [onReady])
  }

  // Tải ảnh vào đối tượng Image ngầm để đọc alpha silhouette
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    try {
      const sil = getImageSilhouette(img)
      const cells = computeContourCells(cols, rows, sil, 0, true)
      cellsCache.set(cacheKey, cells)
      const callbacks = pendingLoads.get(cacheKey)
      pendingLoads.delete(cacheKey)
      callbacks?.forEach((cb) => cb(cells))
    } catch {
      cellsCache.set(cacheKey, [])
      const callbacks = pendingLoads.get(cacheKey)
      pendingLoads.delete(cacheKey)
      callbacks?.forEach((cb) => cb([]))
    }
  }
  img.onerror = () => {
    cellsCache.set(cacheKey, [])
    const callbacks = pendingLoads.get(cacheKey)
    pendingLoads.delete(cacheKey)
    callbacks?.forEach((cb) => cb([]))
  }
  img.src = imageUrl
  return null
}

/**
 * Tạo BufferGeometry 3D bám sát pixel đục (loại bỏ pixel trong suốt) cho Three.js.
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
    return buildAlphaTrimmedGeometry(
      width,
      height,
      image,
      cols,
      rows,
      0,
      0,
      'all',
      undefined,
      0,
      undefined,
      0,
      true
    )
  } catch {
    return new THREE.PlaneGeometry(width, height, cols, rows)
  }
}

export interface LayerAssembly2DMeshOverlayProps {
  imageUrl?: string | null
  showMesh: boolean
}

/**
 * Lớp SVG Mesh hiển thị đa giác lưới bám sát pixel ảnh trên khung vẽ 2D:
 * Chỉ vẽ lưới đa giác ở những vùng có pixel thực, hoàn toàn loại bỏ vùng pixel trong suốt.
 */
export const LayerAssembly2DMeshOverlay: React.FC<LayerAssembly2DMeshOverlayProps> = ({
  imageUrl,
  showMesh
}) => {
  const [cells, setCells] = useState<ContourCell[] | null>(() => {
    return imageUrl ? getLayerContourCells(imageUrl) : null
  })

  useEffect(() => {
    if (!showMesh || !imageUrl) return
    const cached = getLayerContourCells(imageUrl, 16, 20, (loadedCells) => {
      setCells(loadedCells)
    })
    if (cached) {
      setCells(cached)
    }
  }, [imageUrl, showMesh])

  if (!showMesh || !imageUrl || !cells || cells.length === 0) {
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
      {cells.map((cell) => {
        // Chỉ vẽ những cell có chứa tam giác thực tế bên trong vùng pixel hữu hình
        if (!cell.triangles || cell.triangles.length === 0) return null
        return (
          <g key={cell.key}>
            {cell.triangles.map((tri, triIdx) => {
              const p0 = cell.polygon[tri[0]]
              const p1 = cell.polygon[tri[1]]
              const p2 = cell.polygon[tri[2]]
              if (!p0 || !p1 || !p2) return null
              const pts = `${p0[0]},${p0[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`
              return (
                <polygon
                  key={triIdx}
                  points={pts}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="0.0035"
                  strokeOpacity={0.6}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
