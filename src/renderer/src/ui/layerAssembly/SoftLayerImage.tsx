import { useEffect, useRef, useState } from 'react'
import type { AssembledLayerItem } from './types'
import { createLayerAlphaTrimmedGeometry, LayerAssembly2DMeshOverlay } from './layerAssemblyAlphaMesh'
import { deformSkin } from '../../engine/layerSkinning'
import { deformPlantSpines } from '../../engine/plantSpine'
import { renderMeshToCanvas, type MeshCanvasBounds } from './sharedMeshRenderer'
import type { BufferGeometry } from 'three'

interface Props { url: string; layer: AssembledLayerItem; time: number; showMesh: boolean; filter?: string }
interface ImageMesh { image: HTMLImageElement; geometry: BufferGeometry; width: number; height: number }

function expandPoint(p: [number, number], cx: number, cy: number, eps = 0.65): [number, number] {
  const dx = p[0] - cx, dy = p[1] - cy
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-4) return p
  return [p[0] + (dx / dist) * eps, p[1] + (dy / dist) * eps]
}

function loadMeshImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (src.startsWith('http')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => {
      const fallback = new Image()
      fallback.onload = () => resolve(fallback)
      fallback.onerror = reject
      fallback.src = src
    }
    img.src = src
  })
}

/** Canvas affine triangles use the same welded geometry as Three.js and exported meshes. */
export function drawSkinTriangles(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  geometry: BufferGeometry,
  positions: Float32Array,
  stroke?: string
): void {
  const uv = geometry.getAttribute('uv'), indices = geometry.getIndex()
  if (!indices) return

  // 1. Vẽ các mảnh tam giác texture của layer
  for (let i = 0; i < indices.count; i += 3) {
    const ids = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)]
    const src = ids.map((id) => [uv.getX(id) * image.naturalWidth, (1 - uv.getY(id)) * image.naturalHeight])
    const dst = ids.map((id) => [positions[id * 3], -positions[id * 3 + 1]])
    const [s0, s1, s2] = src, [p0, p1, p2] = dst
    const ux = s1[0] - s0[0], uy = s1[1] - s0[1], vx = s2[0] - s0[0], vy = s2[1] - s0[1]
    const det = ux * vy - uy * vx
    if (Math.abs(det) < 1e-8) continue
    const a = ((p1[0] - p0[0]) * vy - (p2[0] - p0[0]) * uy) / det
    const c = ((p2[0] - p0[0]) * ux - (p1[0] - p0[0]) * vx) / det
    const b = ((p1[1] - p0[1]) * vy - (p2[1] - p0[1]) * uy) / det
    const d = ((p2[1] - p0[1]) * ux - (p1[1] - p0[1]) * vx) / det
    const cx = (p0[0] + p1[0] + p2[0]) / 3, cy = (p0[1] + p1[1] + p2[1]) / 3
    const ep0 = expandPoint(p0 as [number, number], cx, cy)
    const ep1 = expandPoint(p1 as [number, number], cx, cy)
    const ep2 = expandPoint(p2 as [number, number], cx, cy)
    ctx.save()
    ctx.beginPath(); ctx.moveTo(...ep0); ctx.lineTo(...ep1); ctx.lineTo(...ep2); ctx.closePath()
    ctx.clip()
    ctx.transform(a, b, c, d, p0[0] - a * s0[0] - c * s0[1], p0[1] - b * s0[0] - d * s0[1])
    ctx.drawImage(image, 0, 0)
    ctx.restore()
  }

  // 2. Gom toàn bộ viền tam giác thành 1 path duy nhất, gọi stroke đúng 1 lần (tăng tốc gấp 50 lần)
  if (stroke) {
    ctx.save()
    ctx.beginPath()
    for (let i = 0; i < indices.count; i += 3) {
      const id0 = indices.getX(i), id1 = indices.getX(i + 1), id2 = indices.getX(i + 2)
      ctx.moveTo(positions[id0 * 3], -positions[id0 * 3 + 1])
      ctx.lineTo(positions[id1 * 3], -positions[id1 * 3 + 1])
      ctx.lineTo(positions[id2 * 3], -positions[id2 * 3 + 1])
      ctx.closePath()
    }
    ctx.strokeStyle = stroke
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.restore()
  }
}

/** Vẽ khung lưới mesh (gom 1 path, stroke 1 lần) phục vụ chế độ xem lưới. */
function strokeMeshWireframe(ctx: CanvasRenderingContext2D, geometry: BufferGeometry, positions: Float32Array, color: string): void {
  const indices = geometry.getIndex()
  if (!indices) return
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2)
    ctx.moveTo(positions[a * 3], -positions[a * 3 + 1])
    ctx.lineTo(positions[b * 3], -positions[b * 3 + 1])
    ctx.lineTo(positions[c * 3], -positions[c * 3 + 1])
    ctx.closePath()
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 0.8
  ctx.stroke()
  ctx.restore()
}

export function SoftLayerImage({ url, layer, time, showMesh, filter }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const allocRef = useRef<(MeshCanvasBounds & { ratio: number }) | null>(null)
  const [data, setData] = useState<ImageMesh | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let active = true, geometry: BufferGeometry | undefined
    setData(null)
    setLoadFailed(false)
    loadMeshImage(url)
      .then((image) => {
        if (!active) return
        const width = image.naturalWidth, height = image.naturalHeight
        geometry = createLayerAlphaTrimmedGeometry(width, height, image)
        allocRef.current = null
        setData({ image, geometry, width, height })
      })
      .catch((err) => {
        if (!active) return
        console.warn('[SoftLayerImage] Failed to load image for soft mesh:', err)
        setLoadFailed(true)
      })
    return () => { active = false; geometry?.dispose() }
  }, [url])

  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !data) return
    const rest = data.geometry.userData.basePositions as Float32Array
    const skinned = layer.previewRig && layer.bindingMode === 'soft' && layer.boneId
      ? deformSkin(rest, layer, layer.previewRig, time) : rest
    const positions = layer.previewPlantSpines?.length
      ? deformPlantSpines(skinned, layer, layer.previewPlantSpines, time) : skinned
    let minX = -data.width / 2, minY = -data.height / 2, maxX = data.width / 2, maxY = data.height / 2
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i])
      minY = Math.min(minY, -positions[i + 1]); maxY = Math.max(maxY, -positions[i + 1])
    }
    const ratio = 1
    let alloc = allocRef.current
    const fits = alloc && alloc.ratio === ratio && minX >= alloc.minX && minY >= alloc.minY &&
      maxX <= alloc.minX + alloc.width && maxY <= alloc.minY + alloc.height
    if (!alloc || !fits) {
      // Cấp phát dư một khoảng đệm để các khung hình sau không phải đổi kích thước canvas (tránh giật)
      const pad = Math.max(12, Math.round(Math.max(data.width, data.height) * 0.18))
      alloc = { minX: Math.floor(minX - pad), minY: Math.floor(minY - pad), width: Math.ceil(maxX - minX + pad * 2), height: Math.ceil(maxY - minY + pad * 2), ratio }
      allocRef.current = alloc
      canvas.width = Math.ceil(alloc.width * ratio); canvas.height = Math.ceil(alloc.height * ratio)
      Object.assign(canvas.style, { width: `${alloc.width}px`, height: `${alloc.height}px`, left: `${alloc.minX + data.width / 2}px`, top: `${alloc.minY + data.height / 2}px` })
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const drawnByGL = renderMeshToCanvas(ctx, data.image, data.geometry, positions, alloc, ratio)
    ctx.setTransform(ratio, 0, 0, ratio, -alloc.minX * ratio, -alloc.minY * ratio)
    if (!drawnByGL) drawSkinTriangles(ctx, data.image, data.geometry, positions)
    if (showMesh) strokeMeshWireframe(ctx, data.geometry, positions, '#00e5ff')
  }, [data, layer.x, layer.y, layer.rotation, layer.scale, layer.scaleX, layer.scaleY, layer.bindingMode, layer.boneId, layer.previewRig, layer.previewPlantSpines, time, showMesh])

  if (loadFailed || !data) {
    return (
      <div style={{ position: 'relative', filter }}>
        <img
          src={url}
          alt={layer.name}
          style={{
            display: 'block',
            pointerEvents: 'none',
            imageRendering: '-webkit-optimize-contrast',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden'
          }}
          draggable={false}
        />
        <LayerAssembly2DMeshOverlay imageUrl={url} showMesh={showMesh} />
      </div>
    )
  }

  return (
    <div style={{ width: data.width, height: data.height, position: 'relative', filter }}>
      <canvas ref={ref} style={{ position: 'absolute', pointerEvents: 'none' }} />
    </div>
  )
}
