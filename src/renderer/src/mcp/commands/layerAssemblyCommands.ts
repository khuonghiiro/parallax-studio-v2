import type { Handler, Params } from '../types'
import { ParamError } from '../types'
import { str, num, bool, has, toPlain } from '../params'
import type { LayerComposite } from '../../ui/layerAssembly/types'
import {
  getStoredComposites,
  saveComposite,
  deleteComposite,
  exportLayerCompositeToJson,
  importLayerCompositeFromJson,
  setAssetAliasInComposite,
  replaceAssetPathInComposite
} from '../../ui/layerAssembly/layerAssemblyStorage'
import {
  getActiveLayerAssemblySession,
  requestOpenLayerAssembly,
  requestCloseLayerAssembly
} from '../../ui/layerAssembly/layerAssemblyBridge'
import { insertLayerCompositeToScene } from '../../ui/layerAssembly/insertLayerComposite'
import { captureCompositeThumbnail } from '../../ui/layerAssembly/layerAssemblyThumbnail'
import { applyWorkshopAction, type WorkshopAction } from '../../ui/layerAssembly/workshopActions'
import { layerWorkshopRigCommands } from './layerWorkshopRigCommands'
import { layerPlantSpineCommands } from './layerPlantSpineCommands'
import { layerMotionSketchCommands } from './layerMotionSketchCommands'
import { layerAnimProCommands } from './layerAnimProCommands'
import { getPlantSpineEditorState } from '../../ui/layerAssembly/plantSpineEditorStore'
import { getAnimAssist } from '../../ui/layerAssembly/animAssistStore'
import { layerWorkshopEditCommands } from './layerWorkshopEditCommands'
import { validateWorkshop } from '../../ui/layerAssembly/workshopEdits'

function workshopSession() {
  const session = getActiveLayerAssemblySession()
  if (!session) throw new ParamError('Open the layer assembly workshop first')
  return session
}

function workshopLayerIds(p: Params, composite: LayerComposite, fallback: string[]): string[] {
  const ids = p.layer_ids ?? fallback
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !composite.layers.some((l) => l.id === id))) {
    throw new ParamError('layer_ids must contain existing layer IDs')
  }
  return [...new Set(ids)] as string[]
}

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
  ...layerWorkshopRigCommands,
  ...layerPlantSpineCommands,
  ...layerMotionSketchCommands,
  ...layerAnimProCommands,
  ...layerWorkshopEditCommands,
  layer_assembly_action: (p) => {
    const session = workshopSession()
    const before = session.getComposite()
    const ids = workshopLayerIds(p, before, session.getSelectedLayerIds?.() ?? [])
    const action = str(p, 'action', true) as WorkshopAction
    const next = applyWorkshopAction(before, action, ids, num(p, 'spacing') ?? 80)
    session.setComposite(next)
    return { ok: true, changed: before !== next, layerCount: next.layers.length, composite: toPlain(next) }
  },
  select_layer_assembly_layers: (p) => {
    const session = workshopSession()
    const ids = workshopLayerIds(p, session.getComposite(), [])
    if (!session.setSelectedLayerIds) throw new ParamError('Workshop selection is unavailable; reopen the workshop')
    session.setSelectedLayerIds(ids)
    return { ok: true, selectedLayerIds: ids }
  },
  layer_assembly_history: (p) => {
    const session = workshopSession()
    const action = str(p, 'action', true)
    if (action !== 'undo' && action !== 'redo') throw new ParamError('action must be undo or redo')
    if (!session[action]) throw new ParamError('Workshop history is unavailable; reopen the workshop')
    session[action]()
    return { ok: true, canUndo: session.canUndo?.() ?? false, canRedo: session.canRedo?.() ?? false,
      composite: toPlain(session.getComposite()) }
  },
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
    const active = getActiveLayerAssemblySession()?.getComposite()
    const raw = { ...(p.layers === undefined ? active : undefined), ...(p.composite as LayerComposite ?? p) } as LayerComposite
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
      layers,
      rig: raw.rig,
      lighting: raw.lighting
    }
    validateWorkshop(candidate)

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

  export_layer_composite_json: async (p) => {
    const composite = resolveTargetComposite(p)
    const pretty = bool(p, 'pretty') ?? true
    const json = exportLayerCompositeToJson(composite, pretty)
    return { ok: true, id: composite.id, name: composite.name, json, layerCount: composite.layers.length }
  },

  import_layer_composite_json: async (p, cmd) => {
    let jsonStr: string
    if (has(p, 'json')) {
      const j = p.json
      jsonStr = typeof j === 'string' ? j : JSON.stringify(j)
    } else if (cmd.file) {
      jsonStr = new TextDecoder('utf-8').decode(cmd.file.data)
    } else {
      throw new ParamError('Provide "json" string/object or "file_path"')
    }
    const composite = importLayerCompositeFromJson(jsonStr)
    saveComposite(composite)
    const session = getActiveLayerAssemblySession()
    if (session && session.getComposite().id === composite.id) {
      session.setComposite(composite)
    }
    return { ok: true, id: composite.id, name: composite.name, layerCount: composite.layers.length }
  },

  set_layer_composite_asset_alias: async (p) => {
    const composite = resolveTargetComposite(p)
    const alias = str(p, 'alias', true)
    const path = str(p, 'path', true)
    const updated = setAssetAliasInComposite(composite, alias, path)
    saveComposite(updated)
    const session = getActiveLayerAssemblySession()
    if (session && session.getComposite().id === composite.id) {
      session.setComposite(updated)
    }
    return { ok: true, compositeId: composite.id, alias, path }
  },

  replace_layer_composite_asset_path: async (p) => {
    const composite = resolveTargetComposite(p)
    const oldPath = str(p, 'old_path', true)
    const newPath = str(p, 'new_path', true)
    const { composite: updated, replacedCount } = replaceAssetPathInComposite(composite, oldPath, newPath)
    saveComposite(updated)
    const session = getActiveLayerAssemblySession()
    if (session && session.getComposite().id === composite.id) {
      session.setComposite(updated)
    }
    return { ok: true, compositeId: composite.id, oldPath, newPath, replacedCount }
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
    const plantEditor = getPlantSpineEditorState()
    return {
      isOpen: true,
      activeSessionId: composite.id,
      selectedLayerId: session.getSelectedLayerId(),
      selectedLayerIds: session.getSelectedLayerIds?.() ?? [session.getSelectedLayerId()].filter(Boolean),
      canUndo: session.canUndo?.() ?? false,
      canRedo: session.canRedo?.() ?? false,
      isPlaying: session.getIsPlaying(),
      time: Number(session.getTime().toFixed(3)),
      tab: session.getTab?.() ?? 'layers',
      selectedBoneId: session.getSelectedBoneId?.() ?? null,
      selectedSpineId: plantEditor.selectedSpineId,
      animAssist: getAnimAssist(),
      plantEditor: {
        preset: plantEditor.preset,
        target: plantEditor.target,
        selectedSpineId: plantEditor.selectedSpineId,
        live: plantEditor.live,
        grabMode: plantEditor.grabMode,
        pathRecord: plantEditor.pathRecord,
        recordEnd: plantEditor.recordEnd
      },
      composite: toPlain(composite)
    }
  }
}
