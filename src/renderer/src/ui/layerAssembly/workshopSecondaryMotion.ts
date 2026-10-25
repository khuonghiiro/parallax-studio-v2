import type { LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { applyRigAction, emptyRig, ensureRigClips, type RigAction } from './workshopRig'
import type { AnimationAction } from './workshopAnimation'
import { reduceKeys } from './workshopMotionSketch'

/**
 * Chuyển động thứ cấp (Secondary motion / Bone dynamics) — giống Spine 4.2 Physics, VRM SpringBone, Moho Bone Dynamics:
 * tóc, đuôi, tai, vải… tự trễ nhịp, nảy theo chuyển động của xương cha, đồng thời phản ứng với Gió (windSpeed + turbulence)
 * và Trọng lực (gravity). Mô phỏng ngọn mỗi xương như một hạt có quán tính nối lò xo về hướng nghỉ, rồi NƯỚNG thành keyframe
 * (nên xem được ở mọi nơi: timeline, chèn cảnh, xuất video) và hoàn tác được bằng Ctrl+Z.
 */

export interface SecondaryMotionSettings {
  /** 0..1 — càng cứng càng ít trễ, bật về nhanh. */
  stiffness: number
  /** 0..1 — giảm chấn: cao = ít nảy qua lại. */
  damping: number
  /** 0..2 — nhân độ lệch (1 = tự nhiên). */
  strength: number
  /** Góc lệch tối đa (độ). */
  maxAngle: number
  /** Có tính cả xương được chọn (true) hay chỉ các xương con của nó. */
  includeRoot: boolean
  /** -2..2 — lực gió thổi ngang (dương = thổi sang phải, âm = sang trái, 0 = tắt). */
  windSpeed?: number
  /** 0..1 — độ nhiễu loạn nhịp gió tự nhiên (gusts). */
  windTurbulence?: number
  /** -1..1 — trọng lực kéo xuống (dương = rủ xuống +Y, âm = bay lên -Y, 0 = tắt). */
  gravity?: number
}

export type SecondaryPresetId = 'hair' | 'tail' | 'cloth' | 'antenna' | 'wind-breeze'

export const SECONDARY_PRESETS: Array<{ id: SecondaryPresetId; label: string; settings: Omit<SecondaryMotionSettings, 'includeRoot'> }> = [
  { id: 'hair', label: 'Tóc', settings: { stiffness: 0.45, damping: 0.55, strength: 1, maxAngle: 45, windSpeed: 0, windTurbulence: 0.3, gravity: 0 } },
  { id: 'tail', label: 'Đuôi', settings: { stiffness: 0.3, damping: 0.35, strength: 1.2, maxAngle: 70, windSpeed: 0, windTurbulence: 0.3, gravity: 0 } },
  { id: 'cloth', label: 'Vải / áo choàng', settings: { stiffness: 0.25, damping: 0.6, strength: 0.9, maxAngle: 55, windSpeed: 0, windTurbulence: 0.35, gravity: 0.1 } },
  { id: 'antenna', label: 'Tai / ăng-ten nảy', settings: { stiffness: 0.6, damping: 0.15, strength: 1.3, maxAngle: 40, windSpeed: 0, windTurbulence: 0.2, gravity: 0 } },
  { id: 'wind-breeze', label: '🌬️ Gió thổi bay', settings: { stiffness: 0.35, damping: 0.45, strength: 1.15, maxAngle: 60, windSpeed: 0.85, windTurbulence: 0.55, gravity: 0.05 } }
]

export const DEFAULT_SECONDARY: SecondaryMotionSettings = { ...SECONDARY_PRESETS[0].settings, includeRoot: true }

const SIM_FPS = 60
const KEY_FPS = 30
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const wrap = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180

/** Xương được mô phỏng: xương gốc (tuỳ chọn) + toàn bộ con cháu, theo thứ tự cha trước con. */
export function secondaryBoneIds(rig: LayerRig, rootBoneId: string, includeRoot: boolean): string[] {
  const out: string[] = []
  const visit = (id: string) => {
    for (const child of rig.bones.filter((b) => b.parentId === id)) {
      if (out.includes(child.id)) continue
      out.push(child.id)
      visit(child.id)
    }
  }
  if (includeRoot) out.push(rootBoneId)
  visit(rootBoneId)
  return out
}

interface Particle { p: { x: number; y: number }; prev: { x: number; y: number } }

/** Mô phỏng và trả về độ lệch góc (độ) của từng xương tại mỗi khung keyframe (KEY_FPS) trong cả clip. */
export function simulateSecondary(rig: LayerRig, boneIds: string[], settings: SecondaryMotionSettings): Map<string, number[]> {
  const flat = { ...rig, loop: false }
  const k = 30 + 570 * settings.stiffness * settings.stiffness
  const drag = 0.02 + 0.28 * clamp(settings.damping, 0, 1)
  const wind = settings.windSpeed ?? 0
  const turb = clamp(settings.windTurbulence ?? 0.3, 0, 1)
  const grav = settings.gravity ?? 0
  const dt = 1 / SIM_FPS
  const steps = Math.max(2, Math.round(rig.duration * SIM_FPS))
  const offsets = new Map(boneIds.map((id) => [id, 0]))
  const particles = new Map<string, Particle>()
  const bones = new Map(rig.bones.map((b) => [b.id, b]))
  const out = new Map(boneIds.map((id) => [id, [] as number[]]))
  const passes = rig.loop ? 2 : 1 // clip lặp: chạy nháp 1 vòng cho ổn định để chỗ nối vòng liền mạch
  const ratio = SIM_FPS / KEY_FPS
  const omega = (Math.PI * 2) / Math.max(0.2, rig.duration)

  for (let pass = 0; pass < passes; pass++) {
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(rig.duration, s * dt)
      const tfs = evaluateRig(flat, t, false, (id, pose) => (offsets.has(id) ? { ...pose, rotation: pose.rotation + (offsets.get(id) ?? 0) } : pose))
      for (const [idx, id] of boneIds.entries()) {
        const bone = bones.get(id)
        const tf = tfs.get(id)
        if (!bone || !tf) continue
        const restAngle = bone.angle + tf.rotation - (offsets.get(id) ?? 0)
        const dir = rotatePoint(bone.length, 0, restAngle)
        const target = { x: tf.x + dir.x, y: tf.y + dir.y }
        let part = particles.get(id)
        if (!part) { part = { p: { ...target }, prev: { ...target } }; particles.set(id, part) }

        // Lực gió hài tuần hoàn theo thời lượng clip (đảm bảo vòng lặp liền mạch) + trọng lực
        const gustWave = Math.sin(omega * t - idx * 0.45) + 0.45 * Math.sin(omega * 2 * t - idx * 0.7)
        const windAccelX = wind * 950 * (1 + turb * gustWave)
        const windAccelY = Math.abs(wind) * turb * 260 * Math.cos(omega * t - idx * 0.5) + grav * 900

        const next = {
          x: part.p.x + (part.p.x - part.prev.x) * (1 - drag) + (k * (target.x - part.p.x) + windAccelX) * dt * dt,
          y: part.p.y + (part.p.y - part.prev.y) * (1 - drag) + (k * (target.y - part.p.y) + windAccelY) * dt * dt
        }
        const len = Math.hypot(next.x - tf.x, next.y - tf.y) || 1
        const constrained = { x: tf.x + ((next.x - tf.x) / len) * bone.length, y: tf.y + ((next.y - tf.y) / len) * bone.length }
        part.prev = part.p
        part.p = constrained
        const raw = wrap((Math.atan2(constrained.y - tf.y, constrained.x - tf.x) * 180) / Math.PI - restAngle)
        offsets.set(id, clamp(raw * settings.strength, -settings.maxAngle, settings.maxAngle))
      }
      if (pass === passes - 1 && s % ratio === 0) for (const id of boneIds) out.get(id)!.push(offsets.get(id) ?? 0)
    }
  }
  return out
}

export interface SecondaryResult {
  composite: LayerComposite
  boneIds: string[]
  keyCount: number
}

/** Nướng chuyển động thứ cấp cho nhánh xương rootBoneId: ghi keyframe = chuyển động gốc + độ trễ vật lý + gió. */
export function bakeSecondaryMotion(composite: LayerComposite, rootBoneId: string, settings: SecondaryMotionSettings): SecondaryResult {
  const rig = ensureRigClips(composite.rig ?? emptyRig()).rig
  if (!rig.bones.some((b) => b.id === rootBoneId)) throw new Error(`Không tìm thấy xương "${rootBoneId}"`)
  const boneIds = secondaryBoneIds(rig, rootBoneId, settings.includeRoot)
  if (!boneIds.length) throw new Error('Xương này chưa có xương con — bật "Tính cả xương đang chọn" hoặc chọn xương gốc của nhánh tóc/đuôi')
  const offsets = simulateSecondary(rig, boneIds, settings)
  const flat = { ...rig, loop: false }
  const ops: AnimationAction[] = []
  let keyCount = 0
  for (const boneId of boneIds) {
    const series = offsets.get(boneId) ?? []
    const rows = series.map((off, i) => {
      const t = Math.min(rig.duration, i / KEY_FPS)
      return [t, sampleBonePose(flat, boneId, t).rotation + off]
    })
    if (rows.length < 2) continue
    const keep = new Set([0, rows.length - 1])
    reduceKeys(rows, 0, rows.length - 1, [0.35], keep)
    for (const k of rig.tracks[boneId] ?? []) ops.push({ action: 'delete-key', boneId, time: k.time })
    for (const i of [...keep].sort((a, b) => a - b)) {
      ops.push({ action: 'set-key', boneId, key: { time: Number(rows[i][0].toFixed(4)), rotation: Number(rows[i][1].toFixed(2)), easing: 'smooth' } })
      keyCount++
    }
  }
  const actions: RigAction[] = []
  for (let i = 0; i < ops.length; i += 200) actions.push({ action: 'batch', operations: ops.slice(i, i + 200) })
  return { composite: actions.reduce((c, a) => applyRigAction(c, a), composite), boneIds, keyCount }
}
