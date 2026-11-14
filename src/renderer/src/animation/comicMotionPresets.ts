import type { Vec3 } from '@shared/types'
import { nanoid } from 'nanoid'
import type { MotionPresetDef, SpatialMotionOptions, SpatialMotionTracks } from './motionPresets'

export type ComicMotionPresetId =
  | 'comic_shiver'
  | 'system_pop_bounce'
  | 'comedic_tumble_out'
  | 'soul_escape_ascend'
  | 'foreground_weapon_slam'

export const COMIC_MOTION_PRESETS_CATALOG: MotionPresetDef[] = [
  {
    id: 'comic_shiver',
    name: { en: 'Comic Terror Shiver (18Hz)', vi: 'Run cầm cập kinh hãi (18Hz)' },
    category: 'dramatic',
    description: {
      en: 'High-frequency horizontal micro-jitter and nervous cowering squash for terrified characters facing overwhelming bosses.',
      vi: 'Rung lắc ngang tần số cao (18Hz) biên độ nhỏ kèm co rúm người khi nhân vật khiếp sợ trước uy áp của Boss.'
    },
    defaultDuration: 2.5,
    recommendedClips: ['idle', 'cower'],
    paramsGuide: { deltaX: 7, endScale: 0.96 }
  },
  {
    id: 'system_pop_bounce',
    name: { en: 'System UI / Emote Pop Bounce', vi: 'Bật nảy bảng Hệ Thống / Biểu cảm' },
    category: 'action',
    description: {
      en: 'Snappy elastic pop-in (0% -> 108% -> 97% -> 100%) for System Quest Hologram panels, giant "?" marks, and "💢" rage icons.',
      vi: 'Hiệu ứng bật nảy đàn hồi dứt khoát (0% -> 108% -> 97% -> 100%) cho bảng Nhiệm Vụ Hệ Thống, dấu hỏi "?" và gân máu giận dữ "💢".'
    },
    defaultDuration: 2.4,
    recommendedClips: ['idle'],
    paramsGuide: { endScale: 1.0 }
  },
  {
    id: 'comedic_tumble_out',
    name: { en: 'Comedic Eject & Tumble Hook', vi: 'Văng nhào xuất thế (Mở màn hài)' },
    category: 'action',
    description: {
      en: 'Character tumbles out diagonally with comic Z-spin, bounces off the ground with squash-and-stretch, and settles dazedly.',
      vi: 'Nhân vật văng nhào chéo ra khỏi miệng thú / cổng không gian kèm xoay vòng hài hước, nảy nhẹ trên mặt đất rồi choáng váng đứng dậy.'
    },
    defaultDuration: 2.4,
    recommendedClips: ['fall', 'jump'],
    paramsGuide: { deltaX: -220, deltaY: -90, jumpHeight: 95 }
  },
  {
    id: 'soul_escape_ascend',
    name: { en: 'Soul / Clone Escape to Clouds', vi: 'Giải thi / Hồn vút lên chín tầng mây' },
    category: 'depth',
    description: {
      en: 'Translucent soul or escaping demon surges diagonally skyward into the clouds while shrinking slightly into high altitude.',
      vi: 'Hồn phách hoặc chân thân thi triển Giải Thi Thuật vút chéo lên chín tầng mây, lượn sóng nhẹ và mờ dần ở cuối.'
    },
    defaultDuration: 2.8,
    recommendedClips: ['jump', 'sway'],
    paramsGuide: { deltaX: 240, deltaY: 260, depthZ: 180, endScale: 0.78, fadeOpacity: true }
  },
  {
    id: 'foreground_weapon_slam',
    name: { en: 'Foreground Diagonal Weapon Slam', vi: 'Binh khí bổ chéo xuyên tiền cảnh' },
    category: 'dramatic',
    description: {
      en: 'Forced-perspective weapon thrusts diagonally from upper corner into extreme foreground, freezes on impact (hitstop), and recoils.',
      vi: 'Binh khí phóng đại phối cảnh lao chéo từ góc trên xuống sát ống kính tiền cảnh, khựng lực va chạm (Hitstop) rồi nảy nhẹ.'
    },
    defaultDuration: 1.8,
    recommendedClips: ['action'],
    paramsGuide: { deltaX: 210, deltaY: -180, depthZ: -120, endScale: 1.18 }
  }
]

export function generateComicPresetSpatialTracks(
  preset: ComicMotionPresetId,
  baseTransform: { position: Vec3; rotation: Vec3; scale: Vec3; opacity: number },
  opts: SpatialMotionOptions,
  t0: number,
  t1: number,
  duration: number
): SpatialMotionTracks {
  const res: SpatialMotionTracks = { position: [], rotation: [], scale: [], opacity: [] }
  const pos0: Vec3 = opts.fromPosition ? [...opts.fromPosition] : [...baseTransform.position]
  const rot0: Vec3 = [...baseTransform.rotation]
  const sc0: Vec3 = opts.fromScale ? [...opts.fromScale] : [...baseTransform.scale]
  const op0 = baseTransform.opacity ?? 1

  switch (preset) {
    case 'comic_shiver': {
      const ampX = opts.deltaX ?? 6.5
      const stepSec = 1 / 18
      const steps = Math.max(4, Math.min(90, Math.floor(duration / stepSec)))
      res.position.push({ id: nanoid(8), t: t0, value: pos0, ease: 'linear' })
      for (let i = 1; i < steps; i++) {
        const curT = Number((t0 + (duration * i) / steps).toFixed(3))
        const dir = i % 2 === 0 ? 1 : -1
        const decay = 0.75 + 0.25 * Math.sin(i * 0.9)
        res.position.push({
          id: nanoid(8),
          t: curT,
          value: [pos0[0] + dir * ampX * decay, pos0[1] - 2 * (i % 2), pos0[2]],
          ease: 'linear'
        })
      }
      res.position.push({ id: nanoid(8), t: t1, value: pos0, ease: 'easeOut' })
      res.scale.push(
        { id: nanoid(8), t: t0, value: sc0, ease: 'easeOut' },
        { id: nanoid(8), t: t0 + Math.min(0.2, duration * 0.2), value: [sc0[0] * 1.03, sc0[1] * 0.95, sc0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: sc0, ease: 'easeOut' }
      )
      break
    }

    case 'system_pop_bounce': {
      const popT1 = Math.min(t1 - 0.05, t0 + Math.min(0.22, duration * 0.22))
      const popT2 = Math.min(t1 - 0.02, t0 + Math.min(0.34, duration * 0.34))
      const popT3 = Math.min(t1, t0 + Math.min(0.46, duration * 0.46))
      res.scale.push(
        { id: nanoid(8), t: t0, value: [sc0[0] * 0.08, sc0[1] * 0.08, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: popT1, value: [sc0[0] * 1.08, sc0[1] * 1.08, sc0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: popT2, value: [sc0[0] * 0.97, sc0[1] * 0.97, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: popT3, value: sc0, ease: 'linear' },
        { id: nanoid(8), t: t1, value: sc0, ease: 'linear' }
      )
      res.opacity.push(
        { id: nanoid(8), t: t0, value: 0, ease: 'easeOut' },
        { id: nanoid(8), t: Math.min(t1, t0 + 0.12), value: op0, ease: 'linear' },
        { id: nanoid(8), t: t1, value: op0, ease: 'linear' }
      )
      break
    }

    case 'comedic_tumble_out': {
      const dX = opts.deltaX ?? -210
      const dY = opts.deltaY ?? -85
      const jH = opts.jumpHeight ?? 95
      const tPeak = t0 + duration * 0.28
      const tLand = t0 + duration * 0.58
      const tBounce = t0 + duration * 0.76
      const posStart: Vec3 = [pos0[0] - dX, pos0[1] - dY + 40, pos0[2] + 60]
      const posPeak: Vec3 = [pos0[0] - dX * 0.45, pos0[1] + jH, pos0[2] + 25]
      const posBounce: Vec3 = [pos0[0] + dX * 0.06, pos0[1] + 22, pos0[2]]

      res.position.push(
        { id: nanoid(8), t: t0, value: posStart, ease: 'easeOut' },
        { id: nanoid(8), t: tPeak, value: posPeak, ease: 'easeIn' },
        { id: nanoid(8), t: tLand, value: pos0, ease: 'easeOut' },
        { id: nanoid(8), t: tBounce, value: posBounce, ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: pos0, ease: 'easeOut' }
      )
      res.rotation.push(
        { id: nanoid(8), t: t0, value: [rot0[0], rot0[1], rot0[2] - 42], ease: 'easeOut' },
        { id: nanoid(8), t: tPeak, value: [rot0[0], rot0[1], rot0[2] + 18], ease: 'easeIn' },
        { id: nanoid(8), t: tLand, value: [rot0[0], rot0[1], rot0[2] - 8], ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: rot0, ease: 'easeOut' }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: [sc0[0] * 0.72, sc0[1] * 0.72, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: tLand, value: [sc0[0] * 1.12, sc0[1] * 0.88, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: sc0, ease: 'easeOut' }
      )
      break
    }

    case 'soul_escape_ascend': {
      const dX = opts.deltaX ?? 230
      const dY = opts.deltaY ?? 250
      const dZ = opts.depthZ ?? 160
      const endMul = opts.endScaleMultiplier ?? 0.78
      const tMid = t0 + duration * 0.45
      res.position.push(
        { id: nanoid(8), t: t0, value: pos0, ease: 'easeOut' },
        { id: nanoid(8), t: tMid, value: [pos0[0] + dX * 0.48, pos0[1] + dY * 0.55, pos0[2] + dZ * 0.45], ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: [pos0[0] + dX, pos0[1] + dY, pos0[2] + dZ], ease: 'easeIn' }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: [sc0[0] * 0.85, sc0[1] * 1.1, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: [sc0[0] * endMul, sc0[1] * endMul, sc0[2]], ease: 'easeInOut' }
      )
      if (opts.fadeOpacity !== false) {
        res.opacity.push(
          { id: nanoid(8), t: t0, value: 0, ease: 'easeOut' },
          { id: nanoid(8), t: t0 + Math.min(0.2, duration * 0.15), value: op0, ease: 'linear' },
          { id: nanoid(8), t: t0 + duration * 0.78, value: op0 * 0.9, ease: 'easeOut' },
          { id: nanoid(8), t: t1, value: 0.15, ease: 'easeOut' }
        )
      }
      break
    }

    case 'foreground_weapon_slam': {
      const dX = opts.deltaX ?? 200
      const dY = opts.deltaY ?? -170
      const dZ = opts.depthZ ?? -110
      const scMul = opts.endScaleMultiplier ?? 1.16
      const tStrike = t0 + Math.min(0.24, duration * 0.24)
      const tHold = Math.min(t1 - 0.08, tStrike + 0.16)
      const startPos: Vec3 = [pos0[0] - dX, pos0[1] - dY, pos0[2] - dZ]
      const impactPos: Vec3 = [...pos0]
      const settlePos: Vec3 = [pos0[0] - dX * 0.04, pos0[1] - dY * 0.04, pos0[2]]

      res.position.push(
        { id: nanoid(8), t: t0, value: startPos, ease: 'easeOut' },
        { id: nanoid(8), t: tStrike, value: impactPos, ease: 'hold' },
        { id: nanoid(8), t: tHold, value: impactPos, ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: settlePos, ease: 'linear' }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: [sc0[0] * 0.82, sc0[1] * 0.82, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: tStrike, value: [sc0[0] * scMul, sc0[1] * scMul, sc0[2]], ease: 'hold' },
        { id: nanoid(8), t: tHold, value: [sc0[0] * scMul, sc0[1] * scMul, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: sc0, ease: 'linear' }
      )
      break
    }
  }

  return res
}
