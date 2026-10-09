import type { AssembledLayerItem, LayerComposite } from './types'
import { validateRig } from './workshopRig'
import { newLayerId } from './workshopActions'

const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
export function validateWorkshop(composite: LayerComposite): void {
  if (!composite.id || typeof composite.name !== 'string' || !composite.name.trim()) throw new Error('Composite needs an ID and name')
  if (!['nature', 'prop', 'character', 'architecture', 'custom'].includes(composite.category)) throw new Error('Invalid category')
  if (![composite.width, composite.height].every((v) => finite(v) && v >= 1 && v <= 8000)) throw new Error('Frame dimensions must be 1–8000')
  if (!Array.isArray(composite.layers) || new Set(composite.layers.map((l) => l.id)).size !== composite.layers.length) throw new Error('Duplicate layer ID')
  composite.layers.forEach(validateWorkshopLayer)
  validateRig(composite)
}

export function validateWorkshopLayer(layer: AssembledLayerItem): void {
  if (!layer.id || typeof layer.id !== 'string' || typeof layer.name !== 'string') throw new Error('Layer needs an ID and name')
  if (![layer.x, layer.y, layer.z, layer.scale, layer.rotation, layer.opacity].every(finite) || layer.scale <= 0 || layer.opacity < 0 || layer.opacity > 1) throw new Error('Invalid layer transform')
  for (const key of ['rotationX', 'rotationY'] as const) if (layer[key] !== undefined && !finite(layer[key])) throw new Error(`Invalid ${key}`)
  for (const key of ['locked', 'hidden'] as const) if (layer[key] !== undefined && typeof layer[key] !== 'boolean') throw new Error(`Invalid ${key}`)
  for (const key of ['assetPath', 'imageUrl', 'boneId'] as const) if (layer[key] !== undefined && typeof layer[key] !== 'string') throw new Error(`Invalid ${key}`)
  const m = layer.motion
  if (!m || !['none', 'sway', 'breathe', 'float', 'wave', 'rocking'].includes(m.type) || !['bottom', 'center', 'top', 'left', 'right'].includes(m.anchor) ||
    ![m.speed, m.amplitude, m.phaseOffset ?? 0].every(finite)) throw new Error('Invalid layer motion')
}

export function editWorkshopLayer(c: LayerComposite, id: string, patch: Partial<AssembledLayerItem>): LayerComposite {
  const layer = c.layers.find((l) => l.id === id)
  if (!layer) throw new Error('Unknown layer ID')
  if (layer.locked && Object.keys(patch).some((key) => key !== 'locked')) throw new Error('Unlock this layer before editing')
  const next = { ...c, layers: c.layers.map((l) => l.id === id ? { ...l, ...patch, id: l.id } : l) }
  validateWorkshop(next)
  return next
}

/** Copy complete presets with remapped bone references; never leave dangling bindings. */
export function appendWorkshopComposite(target: LayerComposite, source: LayerComposite): LayerComposite {
  const boneIds = new Map(source.rig?.bones.map((b) => [b.id, `bone-${crypto.randomUUID()}`]) ?? [])
  const layers = source.layers.map((l) => ({ ...structuredClone(l), id: newLayerId(), boneId: l.boneId ? boneIds.get(l.boneId) : undefined }))
  const next = { ...target, layers: [...target.layers, ...layers] }
  if (source.rig) {
    const rig = structuredClone(target.rig ?? { ...source.rig, bones: [], tracks: {} })
    // Preserve time in seconds, extending the destination clip when needed.
    rig.duration = Math.max(rig.duration, source.rig.duration)
    rig.bones.push(...source.rig.bones.map((b) => ({ ...b, id: boneIds.get(b.id)!, parentId: b.parentId ? boneIds.get(b.parentId) : undefined })))
    for (const [id, keys] of Object.entries(source.rig.tracks)) rig.tracks[boneIds.get(id)!] = structuredClone(keys)
    next.rig = rig
  }
  validateWorkshop(next)
  return next
}
