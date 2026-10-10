import { useState, useRef, useEffect, useCallback } from 'react'
import type { AssembledLayerItem } from './types'
import { getLayerFullResUrl } from './useLayerAssetImage'
import { resolveFaceTexture } from '../assets/models3d/textureResolver'

export type Assembly2DTool = 'select' | 'eraser'

export interface BrushSettings {
  size: number // Bán kính cọ tính bằng pixel (2..120)
  opacity: number // Độ mờ đục tẩy xoá (0.05..1.0, <1 tạo độ mờ xuyên thấu nhẹ)
  hardness: number // Độ cứng nét cọ (0 = mềm mịn mờ viền, 1 = sắc cạnh)
}

export interface UseLayerBrushEraserOptions {
  selectedLayer: AssembledLayerItem | null
  compositeWidth: number
  compositeHeight: number
  zoom: number
  pan: { x: number; y: number }
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Hook quản lý công cụ cọ tẩy xoá pixel thừa và làm mờ xuyên thấu nhẹ cho layer 2D
 */
export function useLayerBrushEraser({
  selectedLayer,
  compositeWidth,
  compositeHeight,
  zoom,
  pan,
  onUpdateLayer,
  containerRef
}: UseLayerBrushEraserOptions) {
  const [activeTool, setActiveTool] = useState<Assembly2DTool>('select')
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 28,
    opacity: 1.0,
    hardness: 0.4
  })
  const [isBrushPopoverOpen, setIsBrushPopoverOpen] = useState(false)
  const [isErasing, setIsErasing] = useState(false)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Canvas offscreen lưu trữ pixel hiện tại của layer đang chọn
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const layerImgRef = useRef<HTMLImageElement | null>(null)
  const activeLayerIdRef = useRef<string | null>(null)

  // Nạp ảnh hiện tại của layer vào offscreen canvas
  const syncLayerToCanvas = useCallback((layer: AssembledLayerItem | null) => {
    if (!layer) {
      offscreenCanvasRef.current = null
      layerImgRef.current = null
      activeLayerIdRef.current = null
      return
    }

    activeLayerIdRef.current = layer.id

    const resolveUrl = async (): Promise<string | null> => {
      if (layer.imageUrl) return layer.imageUrl
      const direct = getLayerFullResUrl(layer.assetPath, layer.imageUrl)
      if (direct) return direct
      if (layer.assetPath) {
        const res = await resolveFaceTexture(layer.assetPath).catch(() => null)
        return res?.url || null
      }
      return null
    }

    resolveUrl().then((url) => {
      if (!url || activeLayerIdRef.current !== layer.id) return
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (activeLayerIdRef.current !== layer.id) return
        layerImgRef.current = img
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 400
        canvas.height = img.naturalHeight || 400
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(img, 0, 0)
        }
        offscreenCanvasRef.current = canvas
      }
      img.src = url
    })
  }, [])

  useEffect(() => {
    syncLayerToCanvas(selectedLayer)
  }, [selectedLayer?.id, selectedLayer?.imageUrl, syncLayerToCanvas])

  // Chuyển đổi toạ độ chuột màn hình sang toạ độ pixel cục bộ trên layer ảnh gốc
  const screenToLayerPixel = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!selectedLayer || !containerRef.current || !layerImgRef.current || !offscreenCanvasRef.current) {
        return null
      }

      const rect = containerRef.current.getBoundingClientRect()
      // 1. Toạ độ trong Viewport (đã khử Pan và Zoom)
      const vpX = (clientX - rect.left - pan.x) / zoom
      const vpY = (clientY - rect.top - pan.y) / zoom

      // 2. Toạ độ tương đối so với tâm của layer trên canvas composite
      const layerCenterX = compositeWidth / 2 + selectedLayer.x
      const layerCenterY = compositeHeight / 2 + selectedLayer.y
      const relX = vpX - layerCenterX
      const relY = vpY - layerCenterY

      // 3. Khử góc xoay layer (Rotation quanh trục Z)
      const rad = (-selectedLayer.rotation * Math.PI) / 180
      const rotX = relX * Math.cos(rad) - relY * Math.sin(rad)
      const rotY = relX * Math.sin(rad) + relY * Math.cos(rad)

      // 4. Khử tỉ lệ co dãn (Scale & ScaleX / ScaleY)
      const totalScaleX = Math.max(0.001, selectedLayer.scale * (selectedLayer.scaleX ?? 1))
      const totalScaleY = Math.max(0.001, selectedLayer.scale * (selectedLayer.scaleY ?? 1))
      const unscaledX = rotX / totalScaleX
      const unscaledY = rotY / totalScaleY

      // 5. Chuyển về toạ độ pixel trên ảnh gốc (tâm ảnh ở W/2, H/2)
      const imgW = offscreenCanvasRef.current.width
      const imgH = offscreenCanvasRef.current.height
      const px = unscaledX + imgW / 2
      const py = unscaledY + imgH / 2

      return { x: px, y: py }
    },
    [selectedLayer, containerRef, pan, zoom, compositeWidth, compositeHeight]
  )

  // Thực hiện một điểm chấm cọ xoá tại (x, y) trên canvas với destination-out & radial gradient
  const eraseStamp = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'

      const h = Math.max(0.01, Math.min(1.0, brushSettings.hardness))
      const innerRadius = radius * h

      if (h >= 0.98) {
        // Cọ sắc cạnh 100%
        ctx.fillStyle = `rgba(0, 0, 0, ${brushSettings.opacity})`
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Cọ mềm mịn mờ viền (Soft radial gradient)
        const grad = ctx.createRadialGradient(x, y, innerRadius, x, y, radius)
        grad.addColorStop(0, `rgba(0, 0, 0, ${brushSettings.opacity})`)
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    },
    [brushSettings]
  )

  // Bắt đầu quẹt cọ
  const handleEraserPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool !== 'eraser' || e.button !== 0 || !selectedLayer) return
      const canvas = offscreenCanvasRef.current
      if (!canvas) return

      const pt = screenToLayerPixel(e.clientX, e.clientY)
      if (!pt) return

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      setIsErasing(true)
      lastPointRef.current = pt

      // Bán kính cọ trong không gian pixel gốc của ảnh
      const layerScale = Math.max(0.001, selectedLayer.scale)
      const radius = brushSettings.size / layerScale

      eraseStamp(ctx, pt.x, pt.y, radius)
    },
    [activeTool, selectedLayer, screenToLayerPixel, brushSettings.size, eraseStamp]
  )

  // Di chuyển cọ và nội suy nét vẽ liên tục
  const handleEraserPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === 'eraser') {
        const container = containerRef.current
        if (container) {
          const rect = container.getBoundingClientRect()
          setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        }
      }

      if (!isErasing || activeTool !== 'eraser' || !selectedLayer) return
      const canvas = offscreenCanvasRef.current
      const last = lastPointRef.current
      if (!canvas || !last) return

      const curr = screenToLayerPixel(e.clientX, e.clientY)
      if (!curr) return

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      const layerScale = Math.max(0.001, selectedLayer.scale)
      const radius = brushSettings.size / layerScale

      // Nội suy khoảng cách giữa 2 điểm liên tiếp để nét cọ mượt mà, không đứt đoạn
      const dx = curr.x - last.x
      const dy = curr.y - last.y
      const dist = Math.hypot(dx, dy)
      const step = Math.max(1, radius * 0.25)
      const numSteps = Math.ceil(dist / step)

      for (let i = 1; i <= numSteps; i++) {
        const t = i / numSteps
        const x = last.x + dx * t
        const y = last.y + dy * t
        eraseStamp(ctx, x, y, radius)
      }

      lastPointRef.current = curr
    },
    [isErasing, activeTool, selectedLayer, containerRef, screenToLayerPixel, brushSettings.size, eraseStamp]
  )

  // Kết thúc quẹt cọ và cập nhật data URL vào layer để kích hoạt Undo/Redo
  const handleEraserPointerUp = useCallback(() => {
    if (!isErasing || !selectedLayer) return
    setIsErasing(false)
    lastPointRef.current = null

    const canvas = offscreenCanvasRef.current
    if (!canvas) return

    try {
      const dataUrl = canvas.toDataURL('image/png')
      onUpdateLayer(selectedLayer.id, { imageUrl: dataUrl })
    } catch (err) {
      console.warn('[useLayerBrushEraser] toDataURL failed:', err)
    }
  }, [isErasing, selectedLayer, onUpdateLayer])

  // Khôi phục ảnh gốc của layer (huỷ bỏ mọi thao tác tẩy xoá)
  const resetLayerImage = useCallback(() => {
    if (!selectedLayer) return
    onUpdateLayer(selectedLayer.id, { imageUrl: undefined })
    setIsBrushPopoverOpen(false)
  }, [selectedLayer, onUpdateLayer])

  return {
    activeTool,
    setActiveTool,
    brushSettings,
    setBrushSettings,
    isBrushPopoverOpen,
    setIsBrushPopoverOpen,
    isErasing,
    cursorPos,
    setCursorPos,
    handleEraserPointerDown,
    handleEraserPointerMove,
    handleEraserPointerUp,
    resetLayerImage
  }
}
