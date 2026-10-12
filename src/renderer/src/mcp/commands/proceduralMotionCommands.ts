import type { LayerMotion } from '@shared/types'
import { MOTION_TYPES, patchLayerMotion, sampleLayerMotion } from '../../animation/proceduralMotion'
import { useEditor } from '../../store/editor'
import { bool, num, requireLayer, str, vec3 } from '../params'
import { ParamError, type Handler, type Params } from '../types'
import { layerNominalSize } from '../../engine/spatial'

function motionPatch(p: Params): Partial<LayerMotion> {
  const patch: Partial<LayerMotion> = {}
  if (p.type !== undefined) {
    const type = str(p, 'type') as LayerMotion['type']
    if (!MOTION_TYPES.includes(type)) throw new ParamError('Invalid motion type')
    patch.type = type
  }
  for (const [input, field, min, max] of [
    ['speed', 'speed', 0, Infinity], ['amount', 'amount', 0, 1], ['phase', 'phase', -Infinity, Infinity],
    ['start_time', 'startTime', 0, Infinity], ['duration', 'duration', 0, Infinity],
    ['fade_in', 'fadeIn', 0, Infinity], ['fade_out', 'fadeOut', 0, Infinity],
    ['loop_width', 'loopWidth', 0.01, Infinity], ['seed', 'seed', 0, 999999]
  ] as const) {
    if (p[input] === undefined) continue
    const value = num(p, input, true)
    if (value < min || value > max || (field === 'seed' && !Number.isInteger(value))) {
      throw new ParamError(`Invalid ${input}: expected ${min}..${max}${field === 'seed' ? ' integer' : ''}`)
    }
    patch[field] = value
  }
  if (p.enabled !== undefined) patch.enabled = bool(p, 'enabled')
  if (p.amplitude !== undefined) patch.amplitude = vec3(p, 'amplitude')
  if (p.direction !== undefined) {
    const direction = p.direction
    const names = ['right', 'up-right', 'up', 'up-left', 'left', 'down-left', 'down', 'down-right']
    if (!(typeof direction === 'number' && Number.isFinite(direction)) && !names.includes(String(direction))) {
      throw new ParamError('direction must be finite degrees or a named compass direction')
    }
    patch.direction = direction as LayerMotion['direction']
  }
  if (p.loop_mode !== undefined) {
    const mode = str(p, 'loop_mode')
    if (!['uv', 'wrap', 'ping-pong', 'continuous'].includes(mode ?? '')) throw new ParamError('Invalid loop_mode')
    patch.loopMode = mode as LayerMotion['loopMode']
  }
  return patch
}

export const proceduralMotionCommands: Record<string, Handler> = {
  set_layer_motion: (p) => {
    const id = str(p, 'layer_id', true)
    const patch = motionPatch(p)
    const reset = bool(p, 'reset') ?? false
    requireLayer(useEditor.getState().project, id)
    useEditor.getState().update((project) => {
      const layer = requireLayer(project, id)
      layer.motion = patchLayerMotion(layer.motion, patch, reset)
    })
    return { ok: true, layer_id: id, motion: requireLayer(useEditor.getState().project, id).motion }
  },
  get_layer_motion: (p) => {
    const layer = requireLayer(useEditor.getState().project, str(p, 'layer_id', true))
    const time = num(p, 'time') ?? useEditor.getState().time
    return { layer_id: layer.id, motion: layer.motion ?? { type: 'none' }, time,
      sample: sampleLayerMotion(layer.motion, time, layerNominalSize(layer)) }
  }
}
