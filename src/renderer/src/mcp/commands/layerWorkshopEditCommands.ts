import type { Handler, Params } from '../types'
import { ParamError } from '../types'
import { str, toPlain } from '../params'
import type { AssembledLayerItem, LayerComposite } from '../../ui/layerAssembly/types'
import { activeWorkshop } from './layerWorkshopRigCommands'
import { appendWorkshopComposite, editWorkshopLayer, validateWorkshop } from '../../ui/layerAssembly/workshopEdits'
import { getStoredComposites } from '../../ui/layerAssembly/layerAssemblyStorage'
import { normalizeLighting } from '../../ui/assets/models3d/assemblyLighting'
import { newLayerId } from '../../ui/layerAssembly/workshopActions'

function fields(p: Params, allowed: string[]): Params {
  for (const key of Object.keys(p)) if (!allowed.includes(key)) throw new ParamError(`Unknown field: ${key}`)
  return p
}

function layerPatch(p: Params): Partial<AssembledLayerItem> {
  if (!p.patch || typeof p.patch !== 'object' || Array.isArray(p.patch)) throw new ParamError('patch must be an object')
  return fields(p.patch as Params, ['name', 'assetPath', 'imageUrl', 'x', 'y', 'z', 'scale', 'rotation', 'rotationX', 'rotationY', 'opacity', 'hidden', 'locked', 'motion'])
}

function commit(next: LayerComposite) {
  validateWorkshop(next)
  activeWorkshop().setComposite(next)
  return { ok: true, composite: toPlain(next) }
}

export const layerWorkshopEditCommands: Record<string, Handler> = {
  add_layer_assembly_layer: (p) => {
    const session = activeWorkshop(), c = session.getComposite()
    const layer: AssembledLayerItem = { id: newLayerId(), name: 'Layer mới', x: 0, y: 0,
      z: c.layers.length ? Math.min(...c.layers.map((l) => l.z)) - 80 : 0, scale: 1, rotation: 0, opacity: 1,
      motion: { type: 'none', speed: 1, amplitude: 15, anchor: 'bottom' }, ...layerPatch(p) }
    const result = commit({ ...c, layers: [...c.layers, layer] })
    session.setSelectedLayerId(layer.id)
    return { ...result, layerId: layer.id }
  },
  update_layer_assembly_layer: (p) => commit(editWorkshopLayer(activeWorkshop().getComposite(), str(p, 'layer_id', true), layerPatch(p))),
  reorder_layer_assembly_layer: (p) => {
    const c = activeWorkshop().getComposite(), id = str(p, 'layer_id', true), direction = str(p, 'direction', true)
    if (!['up', 'down'].includes(direction)) throw new ParamError('direction must be up or down')
    const index = c.layers.findIndex((l) => l.id === id), offset = direction === 'up' ? -1 : 1
    if (index < 0) throw new ParamError('Unknown layer ID')
    if (c.layers[index].locked) throw new ParamError('Layer is locked')
    const layers = [...c.layers]
    if (layers[index + offset]) [layers[index], layers[index + offset]] = [layers[index + offset], layers[index]]
    return commit({ ...c, layers })
  },
  update_layer_assembly: (p) => {
    if (!p.patch || typeof p.patch !== 'object' || Array.isArray(p.patch)) throw new ParamError('patch must be an object')
    const patch = fields(p.patch as Params, ['name', 'description', 'category', 'width', 'height', 'lighting'])
    if (patch.lighting !== undefined) {
      if (!patch.lighting || typeof patch.lighting !== 'object' || Array.isArray(patch.lighting)) throw new ParamError('Invalid lighting')
      patch.lighting = normalizeLighting(patch.lighting)
    }
    return commit({ ...activeWorkshop().getComposite(), ...patch })
  },
  load_layer_assembly: (p) => {
    const session = activeWorkshop(), id = str(p, 'composite_id'), mode = str(p, 'mode') ?? 'replace'
    if (!['replace', 'append', 'new'].includes(mode)) throw new ParamError('mode must be replace, append or new')
    const source = mode === 'new' ? { id: `comp-${crypto.randomUUID()}`, name: 'Mẫu Layer Mới', category: 'custom' as const, width: 600, height: 600, layers: [] }
      : getStoredComposites().find((c) => c.id === id)
    if (!source) throw new ParamError('Unknown composite ID')
    const next = mode === 'append' ? appendWorkshopComposite(session.getComposite(), source) : structuredClone(source)
    const result = commit(next)
    session.setSelectedLayerIds?.([])
    session.setSelectedBoneId?.(null)
    session.setTime(0); session.setIsPlaying(false)
    return result
  }
}
