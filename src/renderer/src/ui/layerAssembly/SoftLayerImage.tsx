import { useEffect, useRef, useState } from 'react'
import type { AssembledLayerItem } from './types'
import { createLayerAlphaTrimmedGeometry } from './layerAssemblyAlphaMesh'
import { deformSkin } from '../../engine/layerSkinning'
import type { BufferGeometry } from 'three'

interface Props { url: string; layer: AssembledLayerItem; time: number; showMesh: boolean; filter?: string }
interface ImageMesh { image: HTMLImageElement; geometry: BufferGeometry; width: number; height: number }

function expandPoint(p: [number, number], cx: number, cy: number, eps = 0.65): [number, number] {
  const dx = p[0] - cx, dy = p[1] - cy
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-4) return p
  return [p[0] + (dx / dist) * eps, p[1] + (dy / dist) * eps]
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
    ctx.lineWidth = 0.6
    ctx.stroke()
    ctx.restore()
  }
}

export function SoftLayerImage({ url, layer, time, showMesh, filter }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [data, setData] = useState<ImageMesh | null>(null)
  useEffect(() => {
    let active = true, geometry: BufferGeometry | undefined
    setData(null)
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!active) return
      const factor = Math.min(1, 380 / Math.max(image.naturalWidth, image.naturalHeight))
      const width = Math.round(image.naturalWidth * factor), height = Math.round(image.naturalHeight * factor)
      geometry = createLayerAlphaTrimmedGeometry(width, height, image)
      setData({ image, geometry, width, height })
    }
    image.src = url
    return () => { active = false; geometry?.dispose() }
  }, [url])
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !data) return
    const rest = data.geometry.userData.basePositions as Float32Array
    const positions = layer.previewRig ? deformSkin(rest, layer, layer.previewRig, time) : rest
    let minX = -data.width / 2, minY = -data.height / 2, maxX = data.width / 2, maxY = data.height / 2
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i])
      minY = Math.min(minY, -positions[i + 1]); maxY = Math.max(maxY, -positions[i + 1])
    }
    const width = Math.ceil(maxX - minX + 2), height = Math.ceil(maxY - minY + 2)
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = width * ratio; canvas.height = height * ratio
    Object.assign(canvas.style, { width: `${width}px`, height: `${height}px`, left: `${minX + data.width / 2 - 1}px`, top: `${minY + data.height / 2 - 1}px` })
    ctx.scale(ratio, ratio); ctx.translate(1 - minX, 1 - minY)
    const stroke = showMesh ? '#00e5ff' : undefined
    drawSkinTriangles(ctx, data.image, data.geometry, positions, stroke)
  }, [data, layer, time, showMesh])
  return <div style={{ width: data?.width ?? 130, height: data?.height ?? 130, position: 'relative', filter }}>
    <canvas ref={ref} style={{ position: 'absolute', pointerEvents: 'none' }} />
  </div>
}
