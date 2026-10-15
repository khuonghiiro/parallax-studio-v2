import type { Handler, Params } from '../types'
import { ParamError } from '../types'
import { bool, num, str, toPlain } from '../params'
import { activeWorkshop } from './layerWorkshopRigCommands'
import { emptyRig, ensureRigClips } from '../../ui/layerAssembly/workshopRig'
import {
  DEFAULT_SKETCH_SETTINGS,
  applyMotionSketch,
  createSketchAnchor,
  type MotionSketchMode,
  type MotionSketchTiming,
  type SketchSample
} from '../../ui/layerAssembly/workshopMotionSketch'

/** points: [[x, y], ...] hoặc [[x, y, t], ...] (t = giây khi bút đi qua điểm đó). */
function parseSamples(p: Params): { samples: SketchSample[]; timed: boolean } {
  const raw = p.points
  if (!Array.isArray(raw) || raw.length < 2) throw new ParamError('points must contain at least 2 [x, y] or [x, y, t] entries')
  let timed = true
  const samples = raw.map((pt, i) => {
    if (!Array.isArray(pt) || pt.length < 2 || pt.slice(0, 3).some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
      throw new ParamError(`points[${i}] must be [x, y] or [x, y, t] with finite numbers`)
    }
    if (pt.length < 3) timed = false
    return { x: pt[0] as number, y: pt[1] as number, t: (pt[2] as number | undefined) ?? i }
  })
  if (timed && samples.some((s, i) => i > 0 && s.t < samples[i - 1].t)) throw new ParamError('point times (t) must not decrease')
  return { samples, timed }
}

function parseEnum<T extends string>(p: Params, key: string, allowed: readonly T[]): T | undefined {
  const value = str(p, key)
  if (value === undefined) return undefined
  if (!allowed.includes(value as T)) throw new ParamError(`${key} must be one of: ${allowed.join(', ')}`)
  return value as T
}

export const layerMotionSketchCommands: Record<string, Handler> = {
  /** Vẽ động tác: biến một nét vẽ (đường đi của ngọn xương) thành chuỗi keyframe cho xương đó. */
  layer_assembly_motion_sketch: (p) => {
    const session = activeWorkshop()
    const composite = session.getComposite()
    const rig = ensureRigClips(composite.rig ?? emptyRig()).rig
    if (!rig.bones.length) throw new ParamError('The composite has no skeleton yet — create bones first (layer_assembly_rig)')
    const boneId = str(p, 'bone_id', true)
    if (!rig.bones.some((b) => b.id === boneId)) throw new ParamError(`Unknown bone_id "${boneId}"`)
    const { samples, timed } = parseSamples(p)
    const duration = num(p, 'duration') ?? DEFAULT_SKETCH_SETTINGS.duration
    if (duration < 0.1 || duration > 20) throw new ParamError('duration must be between 0.1 and 20 seconds')
    const settings = {
      mode: parseEnum<MotionSketchMode>(p, 'mode', ['rotate', 'move']) ?? 'rotate',
      timing: parseEnum<MotionSketchTiming>(p, 'timing', ['hand', 'even']) ?? (timed ? 'hand' : 'even'),
      duration,
      loopBack: bool(p, 'loop_back') ?? false,
      autoPlay: bool(p, 'play') ?? false
    }
    const startTime = Math.min(rig.duration, Math.max(0, num(p, 'start_time') ?? session.getTime()))
    const anchor = createSketchAnchor(rig, boneId, startTime, samples[0])
    const result = applyMotionSketch(composite, anchor, samples, settings, startTime)
    session.setComposite(result.composite)
    if (settings.autoPlay) {
      session.setTime(startTime)
      session.setIsPlaying(true)
    }
    return {
      ok: true,
      bone_id: boneId,
      mode: settings.mode,
      timing: settings.timing,
      start_time: result.startTime,
      end_time: result.endTime,
      key_count: result.keys.length,
      keys: toPlain(result.keys),
      clip_duration: result.composite.rig?.duration
    }
  }
}
