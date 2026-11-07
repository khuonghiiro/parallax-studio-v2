import { useState } from 'react'
import type { AssembledLayerItem, LayerComposite } from './types'
import { useWorkshopHistory } from './useWorkshopHistory'
import { applyWorkshopAction, newLayerId, type WorkshopAction } from './workshopActions'
import { invalidateLayerMeshCache } from './layerAssemblyAlphaMesh'
import { moveLinked, scaleAndMoveLayerWithBoundBones } from './workshopParts'
import { trimImageTransparency } from './imageAutoTrim'

export function computeNextLayerZ(layers: { z?: number }[], customZ?: number): number {
  if (typeof customZ === 'number') return customZ
  if (layers.length === 0) return 11 // 10 + 1 cho layer đầu tiên
  const maxZ = Math.max(10, ...layers.map((l) => l.z ?? 10))
  return maxZ + 1 // layer vào sau tăng thêm 1 (như tay 10+1, áo 10+1+1)
}

/**
 * Tính chiều sâu Z cho layer mới sao cho luôn nằm ở phía trước (tiền cảnh, Z nhỏ hơn)
 * đồng bộ 100% với quy ước zIndex = 1000 - z của Bố cục 2D và Chiều sâu 3D.
 */
/**
 * Tính chiều sâu Z cho layer mới sao cho luôn nằm ở phía trước (tiền cảnh, Z lớn nhất đè lên tất cả)
 * đồng bộ 100% với quy ước zIndex = 1000 + z của Bố cục 2D và Chiều sâu 3D (Z càng cao càng ở phía trước).
 */
export function computeFrontLayerZ(layers: { z?: number }[], customZ?: number): number {
  if (typeof customZ === 'number') return customZ
  if (layers.length === 0) return 10
  const maxZ = Math.max(0, ...layers.map((l) => l.z ?? 0))
  return maxZ + 1
}

/**
 * Tự động chuẩn hoá quy ước Z-Index: Z CÀNG CAO THÌ CÀNG Ở PHÍA TRƯỚC (FOREGROUND).
 * Nếu phát hiện composite mẫu cũ (legacy) có kính/mặt/mũ bị gán Z âm trong khi tay/chân bị gán Z dương,
 * hàm sẽ tự động đảo dấu Z (z = -z) để chuyển đổi hoàn toàn sang quy ước mới.
 */
export function normalizeCompositeZIndex(comp: LayerComposite): LayerComposite {
  if (!comp?.layers || comp.layers.length < 2) return comp
  const hasInvertedFrontLayer = comp.layers.some(
    (l) => /glasses|face|kính|mặt/i.test(`${l.id} ${l.name}`) && (l.z ?? 0) < -5
  )
  const hasInvertedBackLayer = comp.layers.some(
    (l) => /arm|thigh|shin|tay|đùi|chân/i.test(`${l.id} ${l.name}`) && (l.z ?? 0) > 5
  )

  if (hasInvertedFrontLayer && hasInvertedBackLayer) {
    return {
      ...comp,
      layers: comp.layers.map((l) => ({
        ...l,
        z: -Math.round(l.z ?? 0)
      }))
    }
  }
  return comp
}

export function useLayerWorkshop(initial?: LayerComposite | null) {
  const state = useWorkshopHistory(() => {
    const raw = initial ? structuredClone(initial) : {
      id: `comp-${crypto.randomUUID()}`, name: 'Chi tiết Layer Mới', category: 'nature', width: 600, height: 600, layers: []
    }
    return normalizeCompositeZIndex(raw)
  })
  const { composite, setComposite } = state
  const [ids, setIds] = useState<string[]>(initial?.layers[0] ? [initial.layers[0].id] : [])
  const selection = ids.filter((id) => composite.layers.some((l) => l.id === id))
  const selectedLayerId = selection.at(-1) ?? null
  const select = (id: string | null, additive = false) => setIds((prev) => id ? additive ? prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id] : [id] : [])
  const run = (action: WorkshopAction, spacing?: number, targetIds = selection) => {
    setComposite((prev) => applyWorkshopAction(prev, action, targetIds, spacing))
  }
  const update = (id: string, patch: Partial<AssembledLayerItem>) => {
    if (patch.imageUrl !== undefined || patch.assetPath !== undefined) {
      const existing = composite.layers.find((l) => l.id === id)
      if (existing?.imageUrl) invalidateLayerMeshCache(existing.imageUrl)
    }
    setComposite((prev) => ({ ...prev,
      layers: prev.layers.map((l) => l.id === id && (!l.locked || Object.keys(patch).every((key) => key === 'locked')) ? { ...l, ...patch } : l),
      rig: patch.scale !== undefined ? scaleAndMoveLayerWithBoundBones(prev, id, patch).rig : prev.rig
    }), `${id}:${Object.keys(patch).sort().join(',')}`)
  }
  /** Dời X/Y một layer; nếu layer thuộc nhóm bộ phận đang khoá liên kết thì cả nhóm dời theo. */
  const moveLayer = (id: string, x: number, y: number) => {
    setComposite((prev) => moveLinked(prev, id, x, y), `${id}:x,y`)
  }
  const append = (layers: AssembledLayerItem[], offset?: { x: number; y: number }) => {
    const ox = offset?.x ?? 0
    const oy = offset?.y ?? 0
    const added = layers.map((l) => ({ ...l, id: newLayerId(), x: l.x + ox, y: l.y + oy, motion: { ...l.motion } }))
    setComposite((prev) => ({ ...prev, layers: [...prev.layers, ...added] }))
    setIds(added.map((l) => l.id))
  }
  const add = (
    name: string,
    assetPath: string,
    imageUrl?: string,
    pos?: { x: number; y: number },
    customZ?: number,
    initialScale = 1
  ) => {
    const nextZ = computeFrontLayerZ(composite.layers, customZ)
    const safeScale = Number.isFinite(initialScale) && initialScale > 0 ? initialScale : 1
    const targetId = newLayerId()
    const ox = pos?.x ?? 0
    const oy = pos?.y ?? 0

    const newLayer: AssembledLayerItem = {
      id: targetId,
      name,
      assetPath,
      imageUrl,
      x: ox,
      y: oy,
      z: nextZ,
      scale: safeScale,
      rotation: 0,
      opacity: 1,
      motion: { type: 'none', speed: 1, amplitude: 15, anchor: 'bottom' }
    }

    setComposite((prev) => {
      const nextLayers = [...prev.layers, newLayer]
      return { ...prev, layers: nextLayers }
    })
    setIds([targetId])

    // Tự động phân tích viền trong suốt thừa và co giãn kích thước sân khấu phù hợp
    if (imageUrl) {
      trimImageTransparency(imageUrl).then((res) => {
        setComposite((prev) => {
          const target = prev.layers.find((l) => l.id === targetId)
          if (!target) return prev

          let nextW = prev.width
          let nextH = prev.height
          const effW = res.trimmed ? res.width : res.originalWidth
          const effH = res.trimmed ? res.height : res.originalHeight

          // Nếu kích thước layer lớn hơn sân khấu hiện tại (tránh nhân vật bị tràn lố như ảnh 1), tự co giãn sân khấu
          if (effW > nextW - 60 || effH > nextH - 60) {
            const pad = 60
            nextW = Math.min(4000, Math.max(nextW, Math.ceil((effW + pad * 2) / 20) * 20))
            nextH = Math.min(4000, Math.max(nextH, Math.ceil((effH + pad * 2) / 20) * 20))
          }

          if (!res.trimmed && nextW === prev.width && nextH === prev.height) return prev

          return {
            ...prev,
            width: nextW,
            height: nextH,
            layers: prev.layers.map((l) =>
              l.id === targetId
                ? {
                    ...l,
                    ...(res.trimmed
                      ? {
                          imageUrl: res.dataUrl || l.imageUrl,
                          x: l.x + res.offsetX,
                          y: l.y + res.offsetY,
                          name: l.name.includes('(') ? l.name : `${l.name} (${res.width}×${res.height})`
                        }
                      : {})
                  }
                : l
            )
          }
        })
      }).catch(() => {})
    }
  }
  const move = (id: string, direction: 'up' | 'down') => setComposite((prev) => {
    const index = prev.layers.findIndex((l) => l.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index < 0 || prev.layers[index].locked || target < 0 || target >= prev.layers.length) return prev
    const layers = [...prev.layers]
    ;[layers[index], layers[target]] = [layers[target], layers[index]]
    return { ...prev, layers }
  })
  const trimLayer = async (id: string): Promise<boolean> => {
    const target = composite.layers.find((l) => l.id === id)
    if (!target?.imageUrl) return false
    const res = await trimImageTransparency(target.imageUrl)
    if (!res.trimmed) return false
    update(id, {
      imageUrl: res.dataUrl || target.imageUrl,
      x: target.x + res.offsetX,
      y: target.y + res.offsetY,
      name: target.name.includes('(') ? target.name : `${target.name} (${res.width}×${res.height})`
    })
    return true
  }

  const createNew = (fresh?: Partial<LayerComposite>) => {
    const next: LayerComposite = {
      id: `comp-${crypto.randomUUID()}`,
      name: 'Mẫu Layer Mới',
      category: 'custom',
      width: 600,
      height: 600,
      layers: [],
      ...fresh
    }
    state.resetComposite(next)
    setIds(next.layers[0] ? [next.layers[0].id] : [])
  }
  return { ...state, selection, selectedLayerId, select, setIds, run, update, moveLayer, append, add, move, createNew, trimLayer }
}
