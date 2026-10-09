import type { LayerComposite, AssembledLayerItem } from './types'

export const WORKSHOP_ACTIONS = ['center-x', 'center-y', 'distribute-x', 'distribute-y', 'depth-forward',
  'depth-reverse', 'flatten', 'reset-transform', 'duplicate', 'delete', 'hide', 'show', 'lock', 'unlock', 'stagger', 'stop-motion', 'estimate-frame'] as const
export type WorkshopAction = typeof WORKSHOP_ACTIONS[number]
export const newLayerId = () => `layer-${crypto.randomUUID()}`

/** One immutable transaction for UI and MCP; locked layers cannot be transformed or deleted. */
export function applyWorkshopAction(composite: LayerComposite, action: WorkshopAction, ids: string[], spacing = 80): LayerComposite {
  if (!WORKSHOP_ACTIONS.includes(action)) throw new Error('Unknown workshop action')
  if (!Number.isFinite(spacing) || spacing < 1 || spacing > 2000) throw new Error('spacing must be between 1 and 2000')
  if (ids.some((id) => !composite.layers.some((l) => l.id === id))) throw new Error('Unknown layer ID')
  const selection = new Set(ids)
  if (action === 'estimate-frame') return estimateWorkshopFrame(composite, selection)
  const targets = composite.layers.filter((l) => selection.has(l.id) && (!l.locked || action === 'unlock' || action === 'lock'))
  if (!targets.length) return composite
  if ((action.startsWith('distribute') && targets.length < 3) || (action.startsWith('depth') && targets.length < 2)) return composite
  const patches = new Map<string, Partial<AssembledLayerItem>>()
  const axis = action === 'distribute-x' ? 'x' : 'y'
  const ordered = action.startsWith('distribute') ? [...targets].sort((a, b) => a[axis] - b[axis]) : targets
  ordered.forEach((layer, index) => {
    const patch: Partial<AssembledLayerItem> = {}
    if (action === 'center-x') patch.x = 0
    if (action === 'center-y') patch.y = 0
    if (action.startsWith('distribute')) patch[axis] = ordered[0][axis] + index * (ordered.at(-1)![axis] - ordered[0][axis]) / (ordered.length - 1)
    if (action.startsWith('depth')) patch.z = (((ordered.length - 1) / 2 - index) * spacing * (action === 'depth-forward' ? 1 : -1)) || 0
    if (action === 'flatten') patch.z = 0
    if (action === 'reset-transform') Object.assign(patch, { x: 0, y: 0, z: 0, scale: 1, rotation: 0, rotationX: 0, rotationY: 0 })
    if (action === 'hide' || action === 'show') patch.hidden = action === 'hide'
    if (action === 'lock' || action === 'unlock') patch.locked = action === 'lock'
    if (action === 'stagger') patch.motion = { ...layer.motion, phaseOffset: index * 0.35 }
    if (action === 'stop-motion') patch.motion = { ...layer.motion, type: 'none' }
    patches.set(layer.id, patch)
  })
  if (action === 'delete') return { ...composite, layers: composite.layers.filter((l) => !patches.has(l.id)) }
  if (action === 'duplicate') return { ...composite, layers: [...composite.layers, ...targets.map((l) => ({
    ...l, id: newLayerId(), name: `${l.name} (Bản sao)`, x: l.x + 15, y: l.y + 15, motion: { ...l.motion }
  }))] }
  const layers = composite.layers.map((l) => patches.has(l.id) ? { ...l, ...patches.get(l.id) } : l)
  return JSON.stringify(layers) === JSON.stringify(composite.layers) ? composite : { ...composite, layers }
}

/** Conservative 2D estimate using the renderer's 380px maximum image dimension. */
function estimateWorkshopFrame(composite: LayerComposite, selection: Set<string>): LayerComposite {
  const visible = composite.layers.filter((l) => selection.has(l.id) && !l.hidden)
  if (!visible.length) return composite
  let halfWidth = 100, halfHeight = 100
  for (const layer of visible) {
    const angle = layer.rotation * Math.PI / 180
    const extent = 190 * Math.abs(layer.scale) * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)))
    halfWidth = Math.max(halfWidth, Math.abs(layer.x) + extent)
    halfHeight = Math.max(halfHeight, Math.abs(layer.y) + extent)
  }
  const size = (half: number) => Math.min(4000, Math.max(400, Math.ceil((half * 2 + 60) / 50) * 50))
  const width = size(halfWidth), height = size(halfHeight)
  return composite.width === width && composite.height === height ? composite : { ...composite, width, height }
}
