import { pickLayersUnderStroke } from './plantSpineEdit'

/**
 * Hit-test DOM: tìm các layer nằm dưới nét vẽ trên Bố cục 2D (dựa vào thuộc tính data-layer-id).
 * Bỏ qua layer phủ gần kín khung (nền trời / nền đất toàn cảnh) để xương không gắn nhầm vào nền.
 */
export function layersUnderClientStroke(
  overlay: SVGSVGElement | null,
  clientPoints: Array<{ x: number; y: number }>,
  layerOrder: string[]
): string[] {
  if (!overlay || !clientPoints.length || typeof document.elementsFromPoint !== 'function') return []
  const viewport = overlay.closest('.layer-workshop-viewport')
  const frame = overlay.getBoundingClientRect()
  const frameArea = Math.max(1, frame.width * frame.height)
  const step = Math.max(1, Math.floor(clientPoints.length / 16))
  const hits: string[][] = []
  for (let i = 0; i < clientPoints.length; i += step) {
    const { x, y } = clientPoints[i]
    const ids: string[] = []
    for (const el of document.elementsFromPoint(x, y)) {
      const id = (el as HTMLElement).dataset?.layerId
      if (!id || (viewport && el.closest('.layer-workshop-viewport') !== viewport)) continue
      const rect = el.getBoundingClientRect()
      if (rect.width * rect.height > frameArea * 0.85) continue
      ids.push(id)
    }
    hits.push(ids)
  }
  return pickLayersUnderStroke(hits, layerOrder)
}
