import { useState, type DragEvent } from 'react'
import type { LayerComposite } from './types'
import type { PartAssetCandidate } from './workshopParts'

/**
 * Kéo – thả cho bảng Bộ phận: nhận chip layer nội bộ, thẻ layer cột "Dự án" và ảnh từ cột "Tài nguyên".
 * Dùng MIME riêng cho chip nội bộ để khung nhìn 2D không hiểu nhầm thành thao tác dời layer.
 */
export const PART_LAYER_MIME = 'application/x-pxs-part-layer'

export type PartDrop = { kind: 'layer'; id: string } | { kind: 'asset'; cand: PartAssetCandidate }

export function startLayerDrag(e: DragEvent, layerId: string): void {
  e.dataTransfer.setData(PART_LAYER_MIME, layerId)
  e.dataTransfer.effectAllowed = 'copyMove'
}

function acceptsDrag(e: DragEvent): boolean {
  const types = Array.from(e.dataTransfer.types)
  return types.includes(PART_LAYER_MIME) || types.includes('application/json')
}

/** Đọc dữ liệu thả: layer trong cụm hiện tại hoặc ảnh tài nguyên (đường dẫn / data URL). */
export function readPartDrop(e: DragEvent, composite: LayerComposite): PartDrop | null {
  const id = e.dataTransfer.getData(PART_LAYER_MIME)
  if (id && composite.layers.some((l) => l.id === id)) return { kind: 'layer', id }
  const raw = e.dataTransfer.getData('application/json')
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as { type?: string; layer?: { id?: string }; path?: string; name?: string; url?: string }
    if (data.type === 'layer' && data.layer?.id && composite.layers.some((l) => l.id === data.layer!.id)) return { kind: 'layer', id: data.layer.id }
    if (data.type === 'asset' && data.path) {
      const name = data.name || data.path.split(/[\\/]/).pop() || 'part'
      return { kind: 'asset', cand: { path: data.path, name, previewUrl: data.url } }
    }
  } catch {
    return null
  }
  return null
}

/** Hook vùng thả: trả về trạng thái đang rê qua + bộ handler gắn vào phần tử. */
export function usePartDropTarget(composite: LayerComposite, onDrop: (drop: PartDrop) => void, onError?: (message: string) => void) {
  const [over, setOver] = useState(false)
  const handlers = {
    onDragOver: (e: DragEvent) => {
      if (!acceptsDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
      if (!over) setOver(true)
    },
    onDragLeave: (e: DragEvent) => {
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) setOver(false)
    },
    onDrop: (e: DragEvent) => {
      setOver(false)
      const drop = readPartDrop(e, composite)
      if (!drop) return
      e.preventDefault()
      e.stopPropagation()
      try {
        onDrop(drop)
      } catch (err) {
        onError?.(err instanceof Error ? err.message : String(err))
      }
    }
  }
  return { over, handlers }
}
