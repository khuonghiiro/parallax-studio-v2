import type { PlantSpine, PlantSpineMotion } from '@shared/plantSpine'
import type { Params } from '../types'
import { ParamError } from '../types'
import { bool, num, str } from '../params'
import { buildPlantMotion, mirrorPlantMotion, scalePlantMotion, type PlantRecordEnd } from '../../ui/layerAssembly/plantMotionRecord'

/** Đọc mảng [[t, angle, stretch?], ...] số hữu hạn. */
function parsePairs(p: Params, key: string): Array<[number, number, number?]> | undefined {
  const raw = p[key]
  if (raw === undefined) return undefined
  if (!Array.isArray(raw) || raw.length < 2) throw new ParamError(`${key} must contain at least 2 [t, angle] pairs`)
  return raw.map((pt, i) => {
    if (!Array.isArray(pt) || (pt.length !== 2 && pt.length !== 3) || pt.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
      throw new ParamError(`${key}[${i}] must be [t, angle] or [t, angle, stretch] finite numbers`)
    }
    return [pt[0] as number, pt[1] as number, pt[2] as number | undefined]
  })
}

function keysMotion(p: Params): PlantSpineMotion | undefined {
  const pairs = parsePairs(p, 'motion_keys')
  if (!pairs) return undefined
  const sorted = [...pairs].sort((a, b) => a[0] - b[0])
  const t0 = sorted[0][0]
  const keys = sorted.map(([t, angle, stretch]) => ({
    t: t - t0,
    angle,
    ...(stretch !== undefined ? { stretch } : {})
  }))
  const last = keys[keys.length - 1].t
  const step = last / Math.max(1, keys.length - 1)
  const duration = num(p, 'motion_duration') ?? last + Math.max(0.05, step)
  if (last >= duration) throw new ParamError('motion_duration must be greater than the last key time')
  const verticalBob = num(p, 'motion_vertical_bob')
  return { keys, duration, ...(verticalBob !== undefined ? { verticalBob } : {}) }
}

function samplesMotion(p: Params, current?: PlantSpineMotion): PlantSpineMotion | undefined {
  const pairs = parsePairs(p, 'motion_samples')
  if (!pairs) return undefined
  const end = (str(p, 'motion_end') ?? 'loop') as PlantRecordEnd
  if (end !== 'loop' && end !== 'spring') throw new ParamError('motion_end must be loop or spring')
  const motion = buildPlantMotion(pairs.map(([t, angle, stretch]) => ({ t, angle, stretch })), { end, keep: current })
  if (!motion) throw new ParamError('motion_samples too short or almost still (need ≥ 0.15 s and ≥ 0.5° range)')
  return motion
}

/**
 * Tham số chuyển động vẽ tay cho layer_assembly_plant_spine:
 * motion_keys (mốc trực tiếp) | motion_samples (+ motion_end: mô phỏng nắm ngọn kéo) | clear_motion,
 * cùng motion_speed / motion_lag / motion_wind_mix / motion_vertical_bob / scale_motion / mirror_motion chỉnh phát lại.
 * Trả về undefined khi không có tham số chuyển động nào; { motion: undefined } khi xoá.
 */
export function parsePlantMotionPatch(p: Params, current?: PlantSpine['motion']): Pick<PlantSpine, 'motion'> | undefined {
  if (bool(p, 'clear_motion')) return { motion: undefined }
  let motion = keysMotion(p) ?? samplesMotion(p, current)
  const speed = num(p, 'motion_speed')
  const lag = num(p, 'motion_lag')
  const windMix = num(p, 'motion_wind_mix')
  const verticalBob = num(p, 'motion_vertical_bob')
  const scale = num(p, 'scale_motion')
  const mirror = bool(p, 'mirror_motion')
  const tweaks = speed !== undefined || lag !== undefined || windMix !== undefined || verticalBob !== undefined || scale !== undefined || mirror !== undefined
  if (!motion && !tweaks) return undefined
  motion = motion ?? current
  if (!motion) throw new ParamError('motion_speed / motion_lag / motion_wind_mix / motion_vertical_bob / scale_motion / mirror_motion need an existing or new motion')
  if (scale !== undefined && scale > 0) {
    motion = scalePlantMotion(motion, scale)
  }
  if (mirror) {
    motion = mirrorPlantMotion(motion)
  }
  return {
    motion: {
      ...motion,
      ...(speed !== undefined ? { speed } : {}),
      ...(lag !== undefined ? { lag } : {}),
      ...(windMix !== undefined ? { windMix } : {}),
      ...(verticalBob !== undefined ? { verticalBob } : {})
    }
  }
}

export function summarizePlantMotion(motion: PlantSpineMotion | undefined) {
  if (!motion) return null
  return {
    duration: motion.duration,
    key_count: motion.keys.length,
    keys: motion.keys.map((k) => [k.t, k.angle]),
    speed: motion.speed ?? 1,
    lag: motion.lag ?? 0,
    wind_mix: motion.windMix ?? 0
  }
}
