import type { Face3D, Model3D, SunPreset } from '../../ui/assets/models3d/types'
import { getActiveAssemblySession } from '../../ui/assets/models3d/assemblyBridge'
import { fetchDiskModels3D, getStoredModels3D, saveModel3D } from '../../ui/assets/models3d/models3dStorage'
import { insertModel3DToScene } from '../../ui/assets/models3d/insertModel3D'
import { joinFaces, type JoinEdge, type JoinScaleMode } from '../../ui/assets/models3d/assemblyJoin'
import { applyClipSuggestions, suggestClipRules } from '../../ui/assets/models3d/assemblyClip'
import { applySunPreset, normalizeLighting } from '../../ui/assets/models3d/assemblyLighting'
import { appendTemplate, findTemplate, replaceWithTemplate } from '../../ui/assets/models3d/assemblyTemplates'
import { deleteFace, newFaceId, patchFace } from '../../ui/assets/models3d/assemblyFaceOps'
import { ParamError, type Handler, type Params } from '../types'
import { bool, has, num, str, toPlain, vec3 } from '../params'

async function resolveTargetModel(p: Params): Promise<{ model: Model3D; isSession: boolean }> {
  const modelId = str(p, 'model_id') || str(p, 'id')
  const session = getActiveAssemblySession()
  if (!modelId && session) {
    return { model: session.getModel(), isSession: true }
  }
  if (modelId && session && session.getModel().id === modelId) {
    return { model: session.getModel(), isSession: true }
  }
  if (!modelId) {
    const stored = getStoredModels3D()
    if (stored.length > 0) return { model: stored[0], isSession: false }
    throw new ParamError('Missing "model_id" and no 3D Assembly session is active')
  }
  const models = await fetchDiskModels3D()
  const found = models.find((m) => m.id === modelId)
  if (!found) throw new ParamError(`Model "${modelId}" not found`)
  return { model: found, isSession: false }
}

function persistModel(model: Model3D, isSession: boolean): void {
  if (isSession) {
    const session = getActiveAssemblySession()
    if (session) session.setModel(model)
  } else {
    saveModel3D(model)
  }
}

export const assemblyCommands: Record<string, Handler> = {
  list_models3d: async () => {
    const models = await fetchDiskModels3D()
    const session = getActiveAssemblySession()
    return {
      count: models.length,
      activeSessionId: session ? session.getModel().id : null,
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        description: m.description,
        scale: m.scale,
        faceCount: m.faces.length,
        hasLighting: !!m.lighting,
        updatedAt: m.updatedAt
      }))
    }
  },

  get_model3d: async (p) => {
    const id = str(p, 'id') || str(p, 'model_id')
    const session = getActiveAssemblySession()
    if (!id && session) {
      return { model: toPlain(session.getModel()), isSession: true }
    }
    if (!id) throw new ParamError('Provide "id" or "model_id", or open 3D Assembly modal')
    const models = await fetchDiskModels3D()
    const found = models.find((m) => m.id === id)
    if (!found) throw new ParamError(`Model "${id}" not found`)
    return { model: toPlain(found), isSession: session?.getModel().id === id }
  },

  get_assembly_state: () => {
    const session = getActiveAssemblySession()
    if (!session) {
      return { isOpen: false, model: null, selectedFaceId: null }
    }
    const model = session.getModel()
    return {
      isOpen: true,
      selectedFaceId: session.getSelectedFaceId(),
      model: toPlain(model),
      faceCount: model.faces.length
    }
  },

  save_assembly_model: (p) => {
    const raw = p.model as Partial<Model3D> | undefined
    const id = str(p, 'id') || str(p, 'model_id') || raw?.id
    if (!id) throw new ParamError('Missing "id" or "model" object with id')
    const models = getStoredModels3D()
    const existing = models.find((m) => m.id === id)
    const model: Model3D = {
      id,
      name: str(p, 'name') || raw?.name || existing?.name || 'Mô hình 3D',
      description: str(p, 'description') || raw?.description || existing?.description,
      category: (str(p, 'category') as Model3D['category']) || raw?.category || existing?.category || 'custom',
      thumbnail: str(p, 'thumbnail') || raw?.thumbnail || existing?.thumbnail,
      scale: num(p, 'scale') ?? raw?.scale ?? existing?.scale ?? 1.0,
      faces: (p.faces as Face3D[]) || raw?.faces || existing?.faces || [],
      lighting: (p.lighting as Model3D['lighting']) || raw?.lighting || existing?.lighting,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    }
    saveModel3D(model)
    const session = getActiveAssemblySession()
    if (session && session.getModel().id === model.id) {
      session.setModel(model)
    }
    return { ok: true, id: model.id, name: model.name, faceCount: model.faces.length }
  },

  insert_assembly_model: async (p) => {
    const id = str(p, 'id') || str(p, 'model_id')
    const globalScale = num(p, 'global_scale') ?? 1.0
    const pos = vec3(p, 'position_offset') ?? [0, 0, 0]
    const targetShotId = str(p, 'target_shot_id') || null
    const session = getActiveAssemblySession()

    let model: Model3D | null = null
    if (!id && session) {
      model = session.getModel()
    } else if (id) {
      const models = await fetchDiskModels3D()
      model = models.find((m) => m.id === id) || null
    }
    if (!model) throw new ParamError('Provide "model_id" or open 3D Assembly modal')
    const insertedLayerIds = await insertModel3DToScene({
      model,
      globalScale,
      positionOffset: pos,
      targetShotId
    })
    return { ok: true, modelId: model.id, modelName: model.name, insertedLayerIds, count: insertedLayerIds.length }
  },

  add_assembly_face: async (p) => {
    const { model, isSession } = await resolveTargetModel(p)
    const face: Face3D = {
      id: str(p, 'id') || newFaceId(),
      name: str(p, 'name') || `Mặt ${model.faces.length + 1}`,
      assetPath: str(p, 'asset_path'),
      width: num(p, 'width') ?? 500,
      height: num(p, 'height') ?? 500,
      position: vec3(p, 'position') ?? [0, 0, 0],
      rotation: vec3(p, 'rotation') ?? [0, 0, 0],
      color: str(p, 'color') || '#38bdf8'
    }
    const updated = { ...model, faces: [...model.faces, face] }
    persistModel(updated, isSession)
    if (isSession) {
      getActiveAssemblySession()?.setSelectedFaceId(face.id)
    }
    return { ok: true, face, modelId: model.id, faceCount: updated.faces.length }
  },

  update_assembly_face: async (p) => {
    const faceId = str(p, 'face_id', true)
    const { model, isSession } = await resolveTargetModel(p)
    const patch: Partial<Face3D> = {}
    if (has(p, 'name')) patch.name = str(p, 'name')
    if (has(p, 'asset_path')) patch.assetPath = str(p, 'asset_path')
    if (has(p, 'width')) patch.width = num(p, 'width')
    if (has(p, 'height')) patch.height = num(p, 'height')
    if (has(p, 'position')) patch.position = vec3(p, 'position')
    if (has(p, 'rotation')) patch.rotation = vec3(p, 'rotation')
    if (has(p, 'color')) patch.color = str(p, 'color')
    if (has(p, 'hidden')) patch.hidden = bool(p, 'hidden')
    if (has(p, 'locked')) patch.locked = bool(p, 'locked')
    if (has(p, 'clip_by')) patch.clipBy = p.clip_by as string[]
    if (has(p, 'join_points')) patch.joinPoints = p.join_points as [[number, number], [number, number]]

    const updated = { ...model, faces: patchFace(model.faces, faceId, patch) }
    persistModel(updated, isSession)
    return { ok: true, faceId, modelId: model.id }
  },

  delete_assembly_face: async (p) => {
    const faceId = str(p, 'face_id', true)
    const { model, isSession } = await resolveTargetModel(p)
    const res = deleteFace(model.faces, faceId)
    const updated = { ...model, faces: res.faces }
    persistModel(updated, isSession)
    if (isSession) {
      getActiveAssemblySession()?.setSelectedFaceId(res.nextSelected)
    }
    return { ok: true, deletedFaceId: faceId, modelId: model.id, nextSelected: res.nextSelected }
  },

  join_assembly_faces: async (p) => {
    const targetId = str(p, 'target_id', true)
    const sourceId = str(p, 'source_id', true)
    const targetEdge = str(p, 'target_edge', true) as JoinEdge
    const sourceEdge = str(p, 'source_edge', true) as JoinEdge
    const angle = num(p, 'angle') ?? 90
    const scaleMode = (str(p, 'scale_mode') ?? 'longest') as JoinScaleMode
    const flip = bool(p, 'flip') ?? false

    const { model, isSession } = await resolveTargetModel(p)
    const res = joinFaces(model.faces, {
      targetId,
      sourceId,
      targetEdge,
      sourceEdge,
      angle,
      scaleMode,
      flip
    })
    const updated = { ...model, faces: res.faces }
    persistModel(updated, isSession)
    return { ok: true, targetId, sourceId, modelId: model.id, scale: res.scale, scaledFaceId: res.scaledFaceId }
  },

  auto_assembly_clip: async (p) => {
    const { model, isSession } = await resolveTargetModel(p)
    const suggestions = suggestClipRules(model.faces)
    const updatedFaces = applyClipSuggestions(model.faces, suggestions)
    const updated = { ...model, faces: updatedFaces }
    persistModel(updated, isSession)
    return { ok: true, modelId: model.id, rulesApplied: suggestions.length, suggestions }
  },

  set_assembly_lighting: async (p) => {
    const { model, isSession } = await resolveTargetModel(p)
    let lighting = normalizeLighting(model.lighting)
    const preset = str(p, 'preset') as SunPreset | undefined
    if (preset) {
      lighting = applySunPreset(lighting, preset)
    }
    if (has(p, 'sun')) lighting.sun = !!bool(p, 'sun')
    if (has(p, 'shadows')) lighting.shadows = !!bool(p, 'shadows')
    if (has(p, 'azimuth')) lighting.azimuth = num(p, 'azimuth')!
    if (has(p, 'elevation')) lighting.elevation = num(p, 'elevation')!
    if (has(p, 'intensity')) lighting.intensity = num(p, 'intensity')!

    const updated = { ...model, lighting }
    persistModel(updated, isSession)
    return { ok: true, modelId: model.id, lighting }
  },

  apply_assembly_template: async (p) => {
    const templateId = str(p, 'template_id', true)
    const mode = (str(p, 'mode') ?? 'replace') as 'replace' | 'append'
    const tpl = findTemplate(templateId)
    if (!tpl) throw new ParamError(`Template "${templateId}" not found`)

    const { model, isSession } = await resolveTargetModel(p)
    const faces = mode === 'append' ? appendTemplate(tpl, model.faces) : replaceWithTemplate(tpl, model.faces)
    const updated = { ...model, faces }
    persistModel(updated, isSession)
    if (isSession) {
      getActiveAssemblySession()?.setSelectedFaceId(faces[0]?.id || null)
    }
    return { ok: true, templateId, mode, modelId: model.id, faceCount: faces.length }
  },

  get_assembly_screenshot: async () => {
    const session = getActiveAssemblySession()
    if (!session) {
      throw new ParamError('3D Assembly workshop modal is not currently open')
    }
    const dataUrl = session.captureScreenshot ? session.captureScreenshot() : null
    if (!dataUrl) {
      throw new ParamError('Failed to capture workshop canvas or canvas not ready')
    }
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    return { mime: 'image/png', data: base64, modelId: session.getModel().id }
  }
}
