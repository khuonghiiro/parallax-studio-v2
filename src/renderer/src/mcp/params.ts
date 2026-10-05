import type { Animatable, AnimValue, BlendMode, EaseName, Layer, Project, Shot, Vec3 } from '@shared/types'
import type { Draft } from 'immer'
import { addKeyframe, isAnimated, setValueAt } from '../animation/keyframes'
import { frameTolerance, type CameraProp, type LayerProp, type PropRef, type ShotProp } from '../store/editor'
import { ParamError, ed, proj, type Params } from './types'

export function has(p: Params, k: string): boolean {
  return p[k] !== undefined && p[k] !== null
}

export function str(p: Params, k: string): string | undefined
export function str(p: Params, k: string, required: true): string
export function str(p: Params, k: string, required = false): string | undefined {
  const v = p[k]
  if (v === undefined || v === null) {
    if (required) throw new ParamError(`Missing parameter "${k}"`)
    return undefined
  }
  if (typeof v !== 'string') throw new ParamError(`"${k}" must be a string`)
  return v
}

export function num(p: Params, k: string): number | undefined
export function num(p: Params, k: string, required: true): number
export function num(p: Params, k: string, required = false): number | undefined {
  const v = p[k]
  if (v === undefined || v === null) {
    if (required) throw new ParamError(`Missing parameter "${k}"`)
    return undefined
  }
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ParamError(`"${k}" must be a number`)
  return n
}

export function bool(p: Params, k: string): boolean | undefined {
  const v = p[k]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'boolean') throw new ParamError(`"${k}" must be true/false`)
  return v
}

export function vec3(p: Params, k: string): Vec3 | undefined {
  const v = p[k]
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || v.length !== 3 || v.some((x) => typeof x !== 'number' || !Number.isFinite(x)))
    throw new ParamError(`"${k}" must be [x, y, z]`)
  return [v[0], v[1], v[2]]
}

/** Scale accepts a number (uniform 2D scale) or [x, y, z]. */
export function scale3(p: Params, k: string): Vec3 | undefined {
  const v = p[k]
  if (typeof v === 'number') return [v, v, 1]
  return vec3(p, k)
}

export const EASES: EaseName[] = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'easeInOutStrong', 'hold']
export function easeOf(p: Params, k = 'ease'): EaseName {
  const e = str(p, k) ?? 'easeInOut'
  if (!EASES.includes(e as EaseName)) throw new ParamError(`"${k}" must be one of ${EASES.join(', ')}`)
  return e as EaseName
}

export const BLENDS: BlendMode[] = ['normal', 'add', 'screen', 'multiply']
export function blendOf(p: Params): BlendMode | undefined {
  const b = str(p, 'blend_mode')
  if (b === undefined) return undefined
  if (!BLENDS.includes(b as BlendMode)) throw new ParamError(`"blend_mode" must be one of ${BLENDS.join(', ')}`)
  return b as BlendMode
}

export function requireShot(project: Project, id: string | undefined): Shot {
  const s = project.shots.find((x) => x.id === id || (!!id && x.name === id))
  if (!s) throw new ParamError(`Shot "${id}" not found. Use get_project_info to list shots.`)
  return s
}

export function requireLayer(project: Project, id: string | undefined): Layer {
  const l = project.layers.find((x) => x.id === id)
  if (!l) throw new ParamError(`Layer "${id}" not found. Use get_project_info to list layers.`)
  return l
}

/** shot_id param → owning shot id. Omitted = selected shot (or global when none); "global"/null = global. */
export function shotIdParam(p: Params): string | null {
  if (!('shot_id' in p)) {
    const sel = ed().selectedShotId
    return sel && proj().shots.some((s) => s.id === sel) ? sel : null
  }
  const v = p.shot_id
  if (v === null || v === '' || v === 'global') return null
  return requireShot(proj(), String(v)).id
}

/**
 * Set an animatable property. With `at_time` → key at that time. Otherwise After-Effects
 * style: animated properties get a key at the current time, static ones change value.
 */
export function setAnim<T extends AnimValue>(a: Draft<Animatable<T>>, value: T, p: Params, project: Project): void {
  const at = num(p, 'at_time')
  if (at !== undefined) addKeyframe(a as Animatable<T>, at, value, easeOf(p))
  else setValueAt(a as Animatable<T>, ed().time, value, frameTolerance(project))
}

export function keyedProps<T extends object>(obj: T, keys: (keyof T)[]): string[] {
  return keys.filter((k) => isAnimated(obj[k] as unknown as Animatable<AnimValue>)).map(String)
}

export function toPlain<T>(v: T): T {
  return v === undefined ? (null as T) : (JSON.parse(JSON.stringify(v)) as T)
}

export const round = (v: number, d = 2): number => Math.round(v * 10 ** d) / 10 ** d
export const r3 = (v: Vec3): Vec3 => [round(v[0]), round(v[1]), round(v[2])]

export const LAYER_PROPS: LayerProp[] = ['position', 'rotation', 'scale', 'opacity']
export const CAMERA_PROPS: CameraProp[] = ['position', 'target', 'fov', 'focusDistance', 'aperture', 'fade']
export const SHOT_PROPS: ShotProp[] = ['position', 'rotation']
export const CAMERA_ALIASES: Record<string, CameraProp> = { focus_distance: 'focusDistance' }

export function propRef(p: Params): PropRef {
  const target = str(p, 'target', true)
  const prop = str(p, 'property', true)
  if (target === 'camera') {
    const cp = (CAMERA_ALIASES[prop] ?? prop) as CameraProp
    if (!CAMERA_PROPS.includes(cp)) throw new ParamError(`camera property must be one of ${CAMERA_PROPS.join(', ')}`)
    return { kind: 'camera', prop: cp }
  }
  if (target === 'shot') {
    if (!SHOT_PROPS.includes(prop as ShotProp)) throw new ParamError(`shot property must be one of ${SHOT_PROPS.join(', ')}`)
    return { kind: 'shot', shotId: requireShot(proj(), str(p, 'id', true)).id, prop: prop as ShotProp }
  }
  if (target === 'layer') {
    if (!LAYER_PROPS.includes(prop as LayerProp)) throw new ParamError(`layer property must be one of ${LAYER_PROPS.join(', ')}`)
    return { kind: 'layer', layerId: requireLayer(proj(), str(p, 'id', true)).id, prop: prop as LayerProp }
  }
  throw new ParamError('"target" must be layer, camera or shot')
}

export function isScalarProp(ref: PropRef): boolean {
  return (ref.kind === 'layer' && ref.prop === 'opacity') || (ref.kind === 'camera' && !['position', 'target'].includes(ref.prop))
}

export function valueFor(ref: PropRef, p: Params): AnimValue {
  if (isScalarProp(ref)) return num(p, 'value', true)
  const v = ref.kind === 'layer' && ref.prop === 'scale' ? scale3(p, 'value') : vec3(p, 'value')
  if (!v) throw new ParamError('Missing parameter "value" ([x, y, z])')
  return v
}
