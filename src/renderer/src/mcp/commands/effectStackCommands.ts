import { useEditor } from '../../store/editor'
import { listLayerEffects, migrateLayerMotion, updateMotionEffect } from '../../animation/motionEffects'
import { retimeLayerEffect } from '../../animation/effectTiming'
import { bool, num, requireLayer, str } from '../params'
import { ParamError, type Handler } from '../types'
import { motionPatch } from './proceduralMotionCommands'
import { toggleLayerEffect } from '../../ui/timeline/timelineEffects'

export const effectStackCommands: Record<string, Handler> = {
  list_layer_fx: (p) => {
    const layer = requireLayer(useEditor.getState().project, str(p, 'layer_id', true))
    return { layer_id: layer.id, effects: listLayerEffects(layer) }
  },
  update_layer_fx: (p) => {
    const id = str(p, 'layer_id', true), fxId = str(p, 'fx_id', true)
    const layer = requireLayer(useEditor.getState().project, id)
    if (layer.locked) throw new ParamError('Layer is locked')
    const original = listLayerEffects(layer).find((f) => f.id === fxId)
    if (!original) throw new ParamError('Effect not found')
    const name = str(p, 'name')
    const enabled = bool(p, 'enabled')
    const reset = bool(p, 'reset') ?? false
    const patch = motionPatch(p)
    const motionOnly = ['type', 'speed', 'amplitude', 'amount', 'phase', 'seed', 'fade_in', 'fade_out', 'direction', 'loop_mode', 'loop_width']
    if (!original.motion && (reset || motionOnly.some((key) => p[key] !== undefined))) throw new ParamError('Motion parameters require a Motion effect')
    const timing = { startTime: num(p, 'start_time') ?? original.startTime, duration: num(p, 'duration') ?? original.duration }
    useEditor.getState().update((project) => {
      const current = requireLayer(project, id)
      migrateLayerMotion(current)
      retimeLayerEffect(current, fxId, timing)
      if (original.motion) updateMotionEffect(current, fxId, patch, reset)
      if (enabled !== undefined) toggleLayerEffect(current, fxId, enabled)
      const effect = current.appliedEffects!.find((f) => f.id === fxId)!
      if (name !== undefined) effect.name = name
    })
    return { ok: true, effect: listLayerEffects(requireLayer(useEditor.getState().project, id)).find((f) => f.id === fxId) }
  }
}
