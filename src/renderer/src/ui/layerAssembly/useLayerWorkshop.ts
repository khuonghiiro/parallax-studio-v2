import { useState } from 'react'
import type { AssembledLayerItem, LayerComposite } from './types'
import { useWorkshopHistory } from './useWorkshopHistory'
import { applyWorkshopAction, newLayerId, type WorkshopAction } from './workshopActions'

export function useLayerWorkshop(initial?: LayerComposite | null) {
  const state = useWorkshopHistory(() => initial ? structuredClone(initial) : {
    id: `comp-${crypto.randomUUID()}`, name: 'Chi tiết Layer Mới', category: 'nature', width: 600, height: 600, layers: []
  })
  const { composite, setComposite } = state
  const [ids, setIds] = useState<string[]>(initial?.layers[0] ? [initial.layers[0].id] : [])
  const selection = ids.filter((id) => composite.layers.some((l) => l.id === id))
  const selectedLayerId = selection.at(-1) ?? null
  const select = (id: string | null, additive = false) => setIds((prev) => id ? additive ? prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id] : [id] : [])
  const run = (action: WorkshopAction, spacing?: number, targetIds = selection) => {
    setComposite((prev) => applyWorkshopAction(prev, action, targetIds, spacing))
  }
  const update = (id: string, patch: Partial<AssembledLayerItem>) => setComposite((prev) => ({ ...prev,
    layers: prev.layers.map((l) => l.id === id && (!l.locked || Object.keys(patch).every((key) => key === 'locked')) ? { ...l, ...patch } : l)
  }), `${id}:${Object.keys(patch).sort().join(',')}`)
  const append = (layers: AssembledLayerItem[], offset?: { x: number; y: number }) => {
    const ox = offset?.x ?? 0
    const oy = offset?.y ?? 0
    const added = layers.map((l) => ({ ...l, id: newLayerId(), x: l.x + ox, y: l.y + oy, motion: { ...l.motion } }))
    setComposite((prev) => ({ ...prev, layers: [...prev.layers, ...added] }))
    setIds(added.map((l) => l.id))
  }
  const add = (name: string, assetPath: string, imageUrl?: string, pos?: { x: number; y: number }) => append([{
    id: '', name, assetPath, imageUrl, x: pos?.x ?? 0, y: pos?.y ?? 0,
    z: composite.layers.length ? Math.min(...composite.layers.map((l) => l.z)) - 80 : 0,
    scale: 1, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 15, anchor: 'bottom' }
  }])
  const move = (id: string, direction: 'up' | 'down') => setComposite((prev) => {
    const index = prev.layers.findIndex((l) => l.id === id)
    const target = index + (direction === 'up' ? -1 : 1)
    if (index < 0 || prev.layers[index].locked || target < 0 || target >= prev.layers.length) return prev
    const layers = [...prev.layers]
    ;[layers[index], layers[target]] = [layers[target], layers[index]]
    return { ...prev, layers }
  })
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
    setIds([])
  }
  return { ...state, selection, selectedLayerId, select, setIds, run, update, append, add, move, createNew }
}
