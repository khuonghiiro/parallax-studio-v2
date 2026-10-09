import type { Handler, Params } from '../types'
import { ParamError } from '../types'
import { str, num, toPlain } from '../params'
import type { LayerComposite } from '../../ui/layerAssembly/types'
import {
  getStoredComposites,
  saveComposite,
  deleteComposite
} from '../../ui/layerAssembly/layerAssemblyStorage'
import {
  getActiveLayerAssemblySession,
  requestOpenLayerAssembly,
  requestCloseLayerAssembly
} from '../../ui/layerAssembly/layerAssemblyBridge'
import { insertLayerCompositeToScene } from '../../ui/layerAssembly/insertLayerComposite'
import { captureCompositeThumbnail } from '../../ui/layerAssembly/layerAssemblyThumbnail'

function resolveTargetComposite(p: Params): LayerComposite {
  const compId = str(p, 'composite_id') || str(p, 'id')
  const session = getActiveLayerAssemblySession()

  if (!compId && session) {
    return session.getComposite()
  }
  if (compId && session && session.getComposite().id === compId) {
    return session.getComposite()
  }

  const list = getStoredComposites()
  if (!compId) {
    if (list.length > 0) return list[0]
    throw new ParamError('Missing "composite_id" and no Layer Assembly session is active')
  }

  const found = list.find((c) => c.id === compId)
  if (!found) throw new ParamError(`Layer composite "${compId}" not found in storage`)
  return found
}

export const layerAssemblyCommands: Record<string, Handler> = {
  list_layer_composites: async () => {
    const list = getStoredComposites()
    const session = getActiveLayerAssemblySession()

    return {
      count: list.length,
      activeSessionId: session ? session.getComposite().id : null,
      composites: list.map((c) => {
        const mainMotion =
          c.layers.find((l) => l.motion?.type && l.motion.type !== 'none')?.motion?.type || 'none'
        return {
          id: c.id,
          name: c.name,
          category: c.category,
          description: c.description,
          width: c.width,
          height: c.height,
          layerCount: c.layers.length,
          mainMotion,
          hasThumbnail: Boolean(c.thumbnail)
        }
      })
    }
  },

  get_layer_composite: async (p) => {
    const composite = resolveTargetComposite(p)
    return toPlain(composite)
  },

  save_layer_composite: async (p) => {
    const raw = (p.composite as LayerComposite) || (p as unknown as LayerComposite)
    const id = str(p, 'id') || raw.id || `comp-${Date.now().toString(36)}`
    const name = str(p, 'name') || raw.name || 'Chi tiết lắp ráp mới'
    const category = (str(p, 'category') as LayerComposite['category']) || raw.category || 'nature'
    const width = num(p, 'width') ?? raw.width ?? 550
    const height = num(p, 'height') ?? raw.height ?? 600
    const layers = Array.isArray(p.layers) ? p.layers : raw.layers || []

    let thumbnail = str(p, 'thumbnail') || raw.thumbnail
    const candidate: LayerComposite = {
      id,
      name,
      category,
      description: str(p, 'description') || raw.description,
      thumbnail,
      width,
      height,
      layers
    }

    // Tự động kết xuất thumbnail 2D nếu chưa có
    if (!thumbnail && typeof document !== 'undefined') {
      try {
        thumbnail = await captureCompositeThumbnail(candidate)
        candidate.thumbnail = thumbnail
      } catch (err) {
        console.warn('[save_layer_composite] Failed to capture thumbnail:', err)
      }
    }

    saveComposite(candidate)

    const session = getActiveLayerAssemblySession()
    if (session && session.getComposite().id === id) {
      session.setComposite(candidate)
    }

    return {
      ok: true,
      id: candidate.id,
      name: candidate.name,
      layerCount: candidate.layers.length,
      hasThumbnail: Boolean(candidate.thumbnail)
    }
  },

  delete_layer_composite: async (p) => {
    const id = str(p, 'id') || str(p, 'composite_id')
    if (!id) throw new ParamError('Missing "id" or "composite_id" to delete')

    deleteComposite(id)

    const session = getActiveLayerAssemblySession()
    if (session && session.getComposite().id === id) {
      session.close()
    }

    return { ok: true, deletedId: id }
  },

  insert_layer_composite: async (p) => {
    const composite = resolveTargetComposite(p)
    const targetShotId = str(p, 'shot_id') || undefined
    const posX = num(p, 'x') ?? 0
    const posY = num(p, 'y') ?? 0
    const posZ = num(p, 'z') ?? 0
    const globalScale = num(p, 'scale') ?? 1.0

    const createdLayerIds = await insertLayerCompositeToScene({
      composite,
      targetShotId,
      positionOffset: [posX, posY, posZ],
      globalScale
    })

    return {
      ok: true,
      compositeId: composite.id,
      name: composite.name,
      targetShotId: targetShotId || null,
      createdLayerIds,
      layerCount: createdLayerIds.length
    }
  },

  open_layer_assembly: async (p) => {
    const compId = str(p, 'composite_id') || str(p, 'id') || undefined
    requestOpenLayerAssembly(compId)
    return { ok: true, message: 'Layer assembly workshop opened', compositeId: compId || null }
  },

  close_layer_assembly: async () => {
    requestCloseLayerAssembly()
    return { ok: true, message: 'Layer assembly workshop closed' }
  },

  get_layer_assembly_state: async () => {
    const session = getActiveLayerAssemblySession()
    if (!session) {
      return { isOpen: false, activeSession: null }
    }

    const composite = session.getComposite()
    return {
      isOpen: true,
      activeSessionId: composite.id,
      selectedLayerId: session.getSelectedLayerId(),
      isPlaying: session.getIsPlaying(),
      time: Number(session.getTime().toFixed(3)),
      composite: toPlain(composite)
    }
  }
}
