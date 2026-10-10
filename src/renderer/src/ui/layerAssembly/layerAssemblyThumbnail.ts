import type { BufferGeometry } from 'three'
import { deformSkin } from '../../engine/layerSkinning'
import { createLayerAlphaTrimmedGeometry } from './layerAssemblyAlphaMesh'
import { drawSkinTriangles } from './SoftLayerImage'
import type { LayerComposite, AssembledLayerItem } from './types'
import { resolveLayerImageUrlAsync } from './useLayerAssetImage'
import { evaluateRig, transformRigLayer, rotatePoint } from '../../engine/layerRig'
import { computeLayerMotion } from './layerAssemblyMotion'
import { computeLayer2DLighting } from './layerAssembly2DLighting'

export interface CompositeThumbnailOptions {
  /** Chiều rộng & cao của ảnh kết xuất hình vuông (pixel, mặc định 280) */
  size?: number
  /** Thời điểm hoạt ảnh playback (giây) để bắt chuẩn pose (mặc định 0) */
  time?: number
  /** Tự động cân chỉnh khung hình (framing) bao quanh các layer (mặc định true) */
  autoFit?: boolean
  /** Khoảng đệm lề viền an toàn (pixel, mặc định 20) */
  padding?: number
}

interface PreparedLayerItem {
  skin?: { geometry: BufferGeometry; positions: Float32Array; width: number; height: number }
  layer: AssembledLayerItem
  img: HTMLImageElement
  effW: number
  effH: number
  posX: number
  posY: number
  rotZ: number
  signX: number
  signY: number
  pivotX: number
  pivotY: number
}

/**
 * Tải ảnh vào đối tượng HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (src.startsWith('http')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => {
      // Thử lại không gắn crossOrigin (cho blob:, data:, local files)
      const fallback = new Image()
      fallback.onload = () => resolve(fallback)
      fallback.onerror = reject
      fallback.src = src
    }
    img.src = src
  })
}

/**
 * Tính toán 4 góc tọa độ sau khi xoay quanh điểm neo (anchor pivot)
 */
function computeRotatedCorners(
  posX: number,
  posY: number,
  halfW: number,
  halfH: number,
  pivotX: number,
  pivotY: number,
  rotZ: number
): { x: number; y: number }[] {
  const rad = (rotZ * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const localCorners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH }
  ]
  return localCorners.map((c) => {
    const dx = c.x - pivotX
    const dy = c.y - pivotY
    return {
      x: posX + pivotX + (dx * cos - dy * sin),
      y: posY + pivotY + (dx * sin + dy * cos)
    }
  })
}

/**
 * Chuẩn bị tham số hình học cho 1 layer đã tải ảnh
 */
function prepareLayerItem(
  layer: AssembledLayerItem,
  img: HTMLImageElement,
  time: number
): PreparedLayerItem {
  const nw = img.naturalWidth || 100
  const nh = img.naturalHeight || 100
  const maxDim = 380
  const imgScale = Math.min(1, maxDim / Math.max(nw, nh))

  const { animRotateDeg, animScaleX, animScaleY, animTranslateX, animTranslateY } =
    computeLayerMotion(layer.motion, time)

  const baseW = nw * imgScale
  const baseH = nh * imgScale
  const totalScaleX = layer.scale * (layer.scaleX ?? 1) * animScaleX
  const totalScaleY = layer.scale * (layer.scaleY ?? 1) * animScaleY
  const effW = baseW * Math.abs(totalScaleX)
  const effH = baseH * Math.abs(totalScaleY)

  const rotZ = (layer.rotation || 0) + animRotateDeg
  const posX = layer.x + animTranslateX
  const posY = layer.y + animTranslateY

  const anchor = layer.boneId ? 'center' : layer.motion?.anchor || 'center'
  let pivotX = 0
  let pivotY = 0
  if (anchor === 'bottom') pivotY = effH / 2
  else if (anchor === 'top') pivotY = -effH / 2
  else if (anchor === 'left') pivotX = -effW / 2
  else if (anchor === 'right') pivotX = effW / 2

  const signX = (layer.scaleX ?? 1) * animScaleX < 0 ? -1 : 1
  const signY = (layer.scaleY ?? 1) * animScaleY < 0 ? -1 : 1

  return {
    layer,
    img,
    effW,
    effH,
    posX,
    posY,
    rotZ,
    signX,
    signY,
    pivotX,
    pivotY
  }
}

/**
 * Tự động kết xuất ảnh xem trước 2D (Thumbnail 2D Preview) cho cụm layer composite.
 * Chụp ảnh trực tiếp từ bố cục 2D với tỉ lệ, hướng xoay, điểm neo, chuyển động và ánh sáng chuẩn xác.
 */
export async function captureCompositeThumbnail(
  composite: LayerComposite,
  sizeOrOptions: number | CompositeThumbnailOptions = 280
): Promise<string> {
  if (typeof document === 'undefined') return ''

  const opts: Required<CompositeThumbnailOptions> =
    typeof sizeOrOptions === 'number'
      ? { size: sizeOrOptions, time: 0, autoFit: true, padding: 20 }
      : {
          size: sizeOrOptions.size ?? 280,
          time: sizeOrOptions.time ?? 0,
          autoFit: sizeOrOptions.autoFit ?? true,
          padding: sizeOrOptions.padding ?? 20
        }

  const { size, time, autoFit, padding } = opts

  // 1. Áp dụng chuyển động khung xương (Rig) nếu có
  let effectiveLayers = composite.layers
  if (composite.rig?.bones?.length) {
    try {
      const transforms = evaluateRig(composite.rig, time)
      effectiveLayers = composite.layers.map((l) => {
        const bindPose = { x: l.x, y: l.y, rotation: l.rotation }
        const transformed = transformRigLayer(l, transforms)
        return { ...transformed, bindPose }
      })
    } catch (err) {
      console.warn('[captureCompositeThumbnail] Failed to evaluate rig:', err)
    }
  }

  // 2. Lọc các layer không bị ẩn
  const visibleLayers = effectiveLayers.filter((l) => !l.hidden)
  if (visibleLayers.length === 0) return ''

  // 3. Tải toàn bộ ảnh tài nguyên song song
  const loadedPairs = await Promise.all(
    visibleLayers.map(async (layer) => {
      try {
        const url = await resolveLayerImageUrlAsync(layer.assetPath, layer.imageUrl)
        if (!url) return null
        const img = await loadImage(url)
        return { layer, img }
      } catch {
        return null
      }
    })
  )

  const validPairs = loadedPairs.filter(
    (p): p is { layer: AssembledLayerItem; img: HTMLImageElement } => !!p
  )
  if (validPairs.length === 0) return ''

  // 4. Chuẩn bị hình học và tính bounding box toàn cảnh
  const prepared: PreparedLayerItem[] = []
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const pair of validPairs) {
    const item = prepareLayerItem(pair.layer, pair.img, time)
    if (pair.layer.bindingMode === 'soft' && pair.layer.boneId && composite.rig) {
      const factor = Math.min(1, 380 / Math.max(pair.img.naturalWidth, pair.img.naturalHeight))
      const width = Math.round(pair.img.naturalWidth * factor), height = Math.round(pair.img.naturalHeight * factor)
      const geometry = createLayerAlphaTrimmedGeometry(width, height, pair.img)
      const positions = deformSkin(geometry.userData.basePositions, pair.layer, composite.rig, time)
      item.skin = { geometry, positions, width, height }
    }
    prepared.push(item)

    const halfW = item.effW / 2
    const halfH = item.effH / 2
    const corners = computeRotatedCorners(
      item.posX,
      item.posY,
      halfW,
      halfH,
      item.pivotX,
      item.pivotY,
      item.rotZ
    )

    if (item.skin) {
      corners.length = 0
      const { positions, width, height } = item.skin
      for (let i = 0; i < positions.length; i += 3) {
        const point = rotatePoint(positions[i] * item.effW / width * item.signX,
          -positions[i + 1] * item.effH / height * item.signY, item.rotZ)
        corners.push({ x: item.posX + point.x, y: item.posY + point.y })
      }
    }
    for (const c of corners) {
      minX = Math.min(minX, c.x)
      maxX = Math.max(maxX, c.x)
      minY = Math.min(minY, c.y)
      maxY = Math.max(maxY, c.y)
    }
  }

  // 5. Xác định hệ số phóng tỉ lệ và tâm đóng khung
  let scaleFactor: number
  let contentCenterX: number
  let contentCenterY: number

  if (autoFit && minX < maxX && minY < maxY) {
    const contentW = Math.max(1, maxX - minX)
    const contentH = Math.max(1, maxY - minY)
    contentCenterX = (minX + maxX) / 2
    contentCenterY = (minY + maxY) / 2
    const drawArea = size - padding * 2
    scaleFactor = Math.min(drawArea / contentW, drawArea / contentH)
    scaleFactor = Math.min(scaleFactor, 1.4)
  } else {
    const compW = composite.width || 550
    const compH = composite.height || 600
    scaleFactor = Math.min((size - padding * 2) / compW, (size - padding * 2) / compH)
    contentCenterX = 0
    contentCenterY = 0
  }

  // 6. Sắp xếp các layer: Z càng lớn ở sau (vẽ trước), Z càng nhỏ ở trước (vẽ sau)
  prepared.sort((a, b) => (b.layer.z ?? 0) - (a.layer.z ?? 0))

  // 7. Khởi tạo canvas kết xuất
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.clearRect(0, 0, size, size)

  const maxZ = Math.max(0, ...prepared.map((p) => p.layer.z ?? 0))

  // 8. Vẽ từng layer lên canvas
  for (const item of prepared) {
    const { layer, img } = item
    const lightingResult = computeLayer2DLighting(layer, maxZ, composite.lighting)

    const drawCenterX = size / 2 + (item.posX - contentCenterX) * scaleFactor
    const drawCenterY = size / 2 + (item.posY - contentCenterY) * scaleFactor
    const drawW = item.effW * scaleFactor
    const drawH = item.effH * scaleFactor
    const drawPivotX = item.pivotX * scaleFactor
    const drawPivotY = item.pivotY * scaleFactor

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity ?? 1))
    ctx.translate(drawCenterX, drawCenterY)
    ctx.translate(drawPivotX, drawPivotY)
    ctx.rotate((item.rotZ * Math.PI) / 180)
    ctx.scale(item.signX, item.signY)
    ctx.translate(-drawPivotX, -drawPivotY)

    if (lightingResult) {
      ctx.shadowColor = lightingResult.shadowColor || 'rgba(0, 0, 0, 0.45)'
      ctx.shadowOffsetX = (lightingResult.shadowDx || 0) * scaleFactor
      ctx.shadowOffsetY = (lightingResult.shadowDy || 3) * scaleFactor
      ctx.shadowBlur = (lightingResult.shadowBlur || 8) * scaleFactor
    }

    if (item.skin) {
      ctx.scale(drawW / item.skin.width, drawH / item.skin.height)
      drawSkinTriangles(ctx, img, item.skin.geometry, item.skin.positions)
      item.skin.geometry.dispose()
    } else ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()
  }

  return canvas.toDataURL('image/png')
}
