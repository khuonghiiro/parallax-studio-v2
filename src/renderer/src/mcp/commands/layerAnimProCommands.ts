import type { Handler, Params } from '../types'
import { ParamError } from '../types'
import { bool, num, str } from '../params'
import { activeWorkshop } from './layerWorkshopRigCommands'
import { applyRigAction, emptyRig, ensureRigClips } from '../../ui/layerAssembly/workshopRig'
import { IK_CHAIN_MAX, solveIkPose } from '../../ui/layerAssembly/workshopIk'
import {
  DEFAULT_SECONDARY,
  SECONDARY_PRESETS,
  bakeSecondaryMotion,
  type SecondaryMotionSettings
} from '../../ui/layerAssembly/workshopSecondaryMotion'

function parseTarget(p: Params): { x: number; y: number } {
  const t = p.target
  if (Array.isArray(t) && t.length === 2 && t.every((v) => typeof v === 'number' && Number.isFinite(v))) return { x: t[0], y: t[1] }
  throw new ParamError('target must be [x, y] in composite coordinates (Y down, origin at center)')
}

function requireRig() {
  const session = activeWorkshop()
  const composite = session.getComposite()
  const rig = ensureRigClips(composite.rig ?? emptyRig()).rig
  if (!rig.bones.length) throw new ParamError('The composite has no skeleton yet — create bones first (layer_assembly_rig)')
  return { session, composite, rig }
}

function secondarySettings(p: Params): SecondaryMotionSettings {
  const presetId = str(p, 'preset')
  const preset = presetId ? SECONDARY_PRESETS.find((x) => x.id === presetId) : undefined
  if (presetId && !preset) throw new ParamError(`preset must be one of: ${SECONDARY_PRESETS.map((x) => x.id).join(', ')}`)
  const base: SecondaryMotionSettings = { ...DEFAULT_SECONDARY, ...(preset?.settings ?? {}) }
  const pick = (key: string, lo: number, hi: number, fallback: number) => {
    const v = num(p, key)
    if (v === undefined) return fallback
    if (v < lo || v > hi) throw new ParamError(`${key} must be between ${lo} and ${hi}`)
    return v
  }
  return {
    stiffness: pick('stiffness', 0, 1, base.stiffness),
    damping: pick('damping', 0, 1, base.damping),
    strength: pick('strength', 0, 2, base.strength),
    maxAngle: pick('max_angle', 5, 120, base.maxAngle),
    includeRoot: bool(p, 'include_root') ?? base.includeRoot
  }
}

/** Công cụ hoạt hoạ chuyên nghiệp: IK kéo ngọn và nướng vật lý thứ cấp (tóc / đuôi / vải). */
export const layerAnimProCommands: Record<string, Handler> = {
  /** IK: kéo ngọn xương tới điểm target, các xương cha trong chuỗi tự xoay; ghi key xoay tại thời điểm time. */
  layer_assembly_ik_pose: (p) => {
    const { session, composite, rig } = requireRig()
    const boneId = str(p, 'bone_id', true)
    if (!rig.bones.some((b) => b.id === boneId)) throw new ParamError(`Unknown bone_id "${boneId}"`)
    const chain = Math.round(num(p, 'chain_length') ?? 2)
    if (chain < 1 || chain > IK_CHAIN_MAX) throw new ParamError(`chain_length must be between 1 and ${IK_CHAIN_MAX}`)
    const time = Math.min(rig.duration, Math.max(0, num(p, 'time') ?? session.getTime()))
    const rotations = solveIkPose(rig, time, boneId, parseTarget(p), chain)
    const next = applyRigAction(composite, {
      action: 'batch',
      operations: rotations.map(({ boneId: id, rotation }) => ({ action: 'set-key' as const, boneId: id, key: { time, rotation } }))
    })
    session.setComposite(next)
    session.setIsPlaying(false)
    session.setTime(time)
    return { ok: true, time, chain_bones: rotations.map((r) => r.boneId), rotations }
  },

  /** Vật lý thứ cấp: mô phỏng quán tính cho nhánh xương con và nướng thành keyframe (thay key cũ của nhánh). */
  layer_assembly_secondary_motion: (p) => {
    const { session, composite } = requireRig()
    const boneId = str(p, 'bone_id', true)
    const settings = secondarySettings(p)
    let result
    try {
      result = bakeSecondaryMotion(composite, boneId, settings)
    } catch (err) {
      throw new ParamError(err instanceof Error ? err.message : String(err))
    }
    session.setComposite(result.composite)
    if (bool(p, 'play') ?? true) {
      session.setTime(0)
      session.setIsPlaying(true)
    }
    return { ok: true, bone_ids: result.boneIds, key_count: result.keyCount, settings }
  }
}
