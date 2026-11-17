import type { Vec3 } from '@shared/types'
import { nanoid } from 'nanoid'
import type { MotionPresetDef, SpatialMotionOptions, SpatialMotionTracks } from './motionPresets'

export type ComicMotionPresetId =
  | 'comic_shiver'
  | 'system_pop_bounce'
  | 'comedic_tumble_out'
  | 'soul_escape_ascend'
  | 'foreground_weapon_slam'
  | 'pop_up_bottom'
  | 'slide_in_side'
  | 'pendulum_question'
  | 'anger_vein_throb'
  | 'fade_materialize_in'
  | 'thought_vision_manifest'
  | 'oppressive_tower_grow'
  | 'oppressed_shrink_tremble'

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
  },
  {
    id: 'pop_up_bottom',
    name: { en: 'Bust Pop-Up from Bottom Edge', vi: 'Nhân vật trồi nảy từ mép dưới' },
    category: 'action',
    description: {
      en: 'Waist-up character springs up from below the bottom border with squash-and-stretch while keeping its bottom waist edge safely below the frame.',
      vi: 'Nhân vật bán thân trồi nảy đàn hồi từ dưới mép khung hình lên kèm co giãn mượt mà, giữ mép cắt hông luôn khuất dưới đáy màn hình.'
    },
    defaultDuration: 2.5,
    recommendedClips: ['idle'],
    paramsGuide: { deltaY: 140, endScale: 1.0 }
  },
  {
    id: 'slide_in_side',
    name: { en: 'Elastic Side Slide-In + Hover', vi: 'Lướt ngang đàn hồi + Nhấp nhô' },
    category: 'action',
    description: {
      en: 'Mascot or secondary character slides in smoothly from the side with elastic overshoot and gentle floating hover.',
      vi: 'Linh vật Hệ Thống hoặc nhân vật phụ lướt vào từ cạnh màn hình với nhịp phanh đàn hồi rồi lơ lửng nhẹ.'
    },
    defaultDuration: 2.8,
    recommendedClips: ['idle'],
    paramsGuide: { deltaX: -240, deltaY: 18 }
  },
  {
    id: 'pendulum_question',
    name: { en: 'Giant Question Pop & Pendulum Tilt', vi: 'Dấu hỏi bật nảy & Lắc quả lắc' },
    category: 'ambient',
    description: {
      en: 'Giant "?" icon pops up from behind the character and rocks left-right like a confused pendulum.',
      vi: 'Dấu hỏi "?" khổng lồ bật lên từ sau lưng nhân vật rồi nghiêng qua lại như quả lắc ngơ ngác.'
    },
    defaultDuration: 2.6,
    recommendedClips: ['idle'],
    paramsGuide: { endScale: 1.0 }
  },
  {
    id: 'anger_vein_throb',
    name: { en: 'Rage Heartbeat Throb', vi: 'Nhịp đập gân máu nổi điên' },
    category: 'dramatic',
    description: {
      en: 'Rhythmic comic rage pulse (scale beat + micro-shake) for furious characters.',
      vi: 'Nhịp đập co giãn dồn dập kèm rung nhẹ khi nhân vật tức giận phát điên.'
    },
    defaultDuration: 2.6,
    recommendedClips: ['idle'],
    paramsGuide: { deltaX: 4, endScale: 1.06 }
  },
  {
    id: 'fade_materialize_in',
    name: { en: 'Smooth Fade Materialize In/Out', vi: 'Hiện hình mờ → đậm & Ẩn đậm → nhạt' },
    category: 'ambient',
    description: {
      en: 'Character materializes smoothly from transparent to solid (0 -> 100% opacity) with a subtle breathing lift, and optionally dissolves out at the end.',
      vi: 'Nhân vật xuất hiện mượt mà từ mờ sang đậm (0 -> 100% opacity) kèm nhịp thở sống động, và mờ dần từ đậm sang nhạt khi rời cảnh.'
    },
    defaultDuration: 2.8,
    recommendedClips: ['idle', 'talk'],
    paramsGuide: { deltaY: 16, endScale: 1.0, fadeOpacity: true }
  },
  {
    id: 'thought_vision_manifest',
    name: { en: 'Thought Vision / Imagination Manifest', vi: 'Hư ảnh suy nghĩ / Tưởng tượng (Mờ → Đậm → Tan)' },
    category: 'dramatic',
    description: {
      en: 'Imagined group (e.g. Tang Sanzang & disciples in Skeletons mind) materializes from mist (0 -> 90% opacity), floats above in contemplation, and dissolves out (90 -> 0%).',
      vi: 'Hình ảnh trong suy nghĩ (VD: Tiểu Khô Lâu tưởng tượng ra 4 thầy trò Đường Tăng) hiện dần từ mờ sang đậm (0 -> 90%), lơ lửng phía trên rồi tan dần từ đậm sang nhạt.'
    },
    defaultDuration: 3.0,
    recommendedClips: ['idle'],
    paramsGuide: { deltaY: 36, endScale: 1.08, fadeOpacity: true }
  },
  {
    id: 'oppressive_tower_grow',
    name: { en: 'Progressive Oppression Tower Grow', vi: 'Áp bức dâng cao & Phóng to dần' },
    category: 'dramatic',
    description: {
      en: 'Overwhelming villain/boss group fades in and progressively rises higher while growing larger (scale 0.88x -> 1.28x), crushing the viewer with intimidation.',
      vi: 'Nhóm nhân vật áp bức (VD: 4 thầy trò sát khí) hiện từ mờ sang đậm, dâng cao dần lên và phình to dần (0.88x -> 1.28x) tạo bóng đè nghẹt thở.'
    },
    defaultDuration: 3.6,
    recommendedClips: ['idle', 'action'],
    paramsGuide: { deltaY: 75, endScale: 1.28, fadeOpacity: false }
  },
  {
    id: 'oppressed_shrink_tremble',
    name: { en: 'Oppressed Cower Shrink & Tremble', vi: 'Bị áp bức nhỏ dần & Run cầm cập' },
    category: 'dramatic',
    description: {
      en: 'Terrified protagonist progressively shrinks smaller (scale 1.05x -> 0.74x) and sinks lower in the frame while shivering under overwhelming pressure.',
      vi: 'Nhân vật yếu thế (VD: Tiểu Khô Lâu) vừa run cầm cập vừa co rúm nhỏ dần đi (1.05x -> 0.74x) và tụt thấp xuống dưới sức ép của đối phương.'
    },
    defaultDuration: 3.6,
    recommendedClips: ['idle'],
    paramsGuide: { deltaX: 6, deltaY: -48, endScale: 0.74 }
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

    case 'pop_up_bottom': {
      const dropY = Math.min(110, Math.abs(opts.deltaY ?? 95))
      const tPop = Math.min(t1 - 0.06, t0 + Math.min(0.24, duration * 0.22))
      const tSettle = Math.min(t1 - 0.02, t0 + Math.min(0.38, duration * 0.36))
      res.position.push(
        { id: nanoid(8), t: t0, value: [pos0[0], pos0[1] - dropY, pos0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: tPop, value: [pos0[0], pos0[1] + 10, pos0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: tSettle, value: pos0, ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: [pos0[0], pos0[1] + 6, pos0[2]], ease: 'easeInOut' }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: [sc0[0] * 0.92, sc0[1] * 1.08, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: tPop, value: [sc0[0] * 1.04, sc0[1] * 0.97, sc0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: tSettle, value: sc0, ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: sc0, ease: 'linear' }
      )
      res.opacity.push(
        { id: nanoid(8), t: t0, value: 0, ease: 'easeOut' },
        { id: nanoid(8), t: Math.min(t1, t0 + 0.2), value: op0, ease: 'linear' },
        { id: nanoid(8), t: t1, value: op0, ease: 'linear' }
      )
      break
    }

    case 'slide_in_side': {
      const fromOffsetX = opts.deltaX ?? 260
      const bobY = opts.deltaY ?? 18
      const tArrive = Math.min(t1 - 0.1, t0 + Math.min(0.32, duration * 0.25))
      const tSettle = Math.min(t1 - 0.05, t0 + Math.min(0.46, duration * 0.36))
      const tMidBob = t0 + duration * 0.68
      res.position.push(
        { id: nanoid(8), t: t0, value: [pos0[0] + fromOffsetX, pos0[1] - 12, pos0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: tArrive, value: [pos0[0] - Math.sign(fromOffsetX) * 16, pos0[1] + 8, pos0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: tSettle, value: pos0, ease: 'easeInOut' },
        { id: nanoid(8), t: tMidBob, value: [pos0[0], pos0[1] + bobY, pos0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: pos0, ease: 'easeInOut' }
      )
      res.opacity.push(
        { id: nanoid(8), t: t0, value: 0, ease: 'easeOut' },
        { id: nanoid(8), t: Math.min(t1, t0 + 0.22), value: op0, ease: 'linear' },
        { id: nanoid(8), t: t1, value: op0, ease: 'linear' }
      )
      break
    }

    case 'pendulum_question': {
      const tPop = Math.min(t1 - 0.1, t0 + 0.22)
      const tSettle = Math.min(t1 - 0.06, t0 + 0.36)
      const tSwing1 = t0 + duration * 0.55
      const tSwing2 = t0 + duration * 0.8
      res.scale.push(
        { id: nanoid(8), t: t0, value: [sc0[0] * 0.05, sc0[1] * 0.05, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: tPop, value: [sc0[0] * 1.15, sc0[1] * 1.15, sc0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: tSettle, value: sc0, ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: sc0, ease: 'linear' }
      )
      res.rotation.push(
        { id: nanoid(8), t: t0, value: [rot0[0], rot0[1], rot0[2] - 14], ease: 'easeOut' },
        { id: nanoid(8), t: tSettle, value: [rot0[0], rot0[1], rot0[2] + 10], ease: 'easeInOut' },
        { id: nanoid(8), t: tSwing1, value: [rot0[0], rot0[1], rot0[2] - 9], ease: 'easeInOut' },
        { id: nanoid(8), t: tSwing2, value: [rot0[0], rot0[1], rot0[2] + 8], ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: [rot0[0], rot0[1], rot0[2] - 4], ease: 'easeOut' }
      )
      break
    }

    case 'anger_vein_throb': {
      const beats = Math.max(3, Math.min(12, Math.floor(duration * 3.2)))
      res.scale.push({ id: nanoid(8), t: t0, value: sc0, ease: 'easeOut' })
      res.position.push({ id: nanoid(8), t: t0, value: pos0, ease: 'easeOut' })
      for (let i = 1; i < beats; i++) {
        const bt = Number((t0 + (duration * i) / beats).toFixed(3))
        const isPeak = i % 2 === 1
        const mul = isPeak ? 1.045 : 0.985
        const dx = isPeak ? 4 : -4
        res.scale.push({ id: nanoid(8), t: bt, value: [sc0[0] * mul, sc0[1] * mul, sc0[2]], ease: 'easeInOut' })
        res.position.push({ id: nanoid(8), t: bt, value: [pos0[0] + dx, pos0[1], pos0[2]], ease: 'easeInOut' })
      }
      res.scale.push({ id: nanoid(8), t: t1, value: sc0, ease: 'easeOut' })
      res.position.push({ id: nanoid(8), t: t1, value: pos0, ease: 'easeOut' })
      break
    }

    case 'fade_materialize_in': {
      const liftY = opts.deltaY ?? 18
      const fadeInEnd = Math.min(t1 - 0.1, t0 + Math.min(0.36, duration * 0.22))
      const fadeOutStart = Math.max(fadeInEnd + 0.05, t1 - Math.min(0.32, duration * 0.2))
      const midT = Number(((t0 + t1) * 0.5).toFixed(3))
      res.position.push(
        { id: nanoid(8), t: t0, value: [pos0[0], pos0[1] - liftY, pos0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: fadeInEnd, value: pos0, ease: 'easeInOut' },
        { id: nanoid(8), t: midT, value: [pos0[0], pos0[1] + 8, pos0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: pos0, ease: 'easeOut' }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: [sc0[0] * 0.94, sc0[1] * 0.94, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: fadeInEnd, value: sc0, ease: 'easeInOut' },
        { id: nanoid(8), t: midT, value: [sc0[0] * 1.02, sc0[1] * 1.02, sc0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: sc0, ease: 'easeOut' }
      )
      res.opacity.push(
        { id: nanoid(8), t: t0, value: 0, ease: 'easeOut' },
        { id: nanoid(8), t: fadeInEnd, value: op0, ease: 'linear' },
        { id: nanoid(8), t: fadeOutStart, value: op0, ease: 'easeIn' },
        { id: nanoid(8), t: t1, value: opts.fadeOpacity ? 0 : op0, ease: 'linear' }
      )
      break
    }

    case 'thought_vision_manifest': {
      const riseY = opts.deltaY ?? 36
      const endMul = opts.endScaleMultiplier ?? 1.08
      const tAppear = Math.min(t1 - 0.2, t0 + Math.min(0.45, duration * 0.25))
      const tFadeStart = Math.max(tAppear + 0.1, t1 - Math.min(0.42, duration * 0.24))
      res.position.push(
        { id: nanoid(8), t: t0, value: [pos0[0], pos0[1] - riseY * 0.6, pos0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: tAppear, value: pos0, ease: 'easeInOut' },
        { id: nanoid(8), t: tFadeStart, value: [pos0[0], pos0[1] + riseY * 0.4, pos0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: [pos0[0], pos0[1] + riseY * 0.65, pos0[2]], ease: 'easeIn' }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: [sc0[0] * 0.84, sc0[1] * 0.84, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: tAppear, value: sc0, ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: [sc0[0] * endMul, sc0[1] * endMul, sc0[2]], ease: 'easeInOut' }
      )
      res.opacity.push(
        { id: nanoid(8), t: t0, value: 0, ease: 'easeOut' },
        { id: nanoid(8), t: tAppear, value: Math.min(0.92, op0), ease: 'linear' },
        { id: nanoid(8), t: tFadeStart, value: Math.min(0.92, op0), ease: 'easeIn' },
        { id: nanoid(8), t: t1, value: opts.fadeOpacity === false ? Math.min(0.92, op0) : 0, ease: 'linear' }
      )
      break
    }

    case 'oppressive_tower_grow': {
      const riseY = opts.deltaY ?? 72
      const endMul = opts.endScaleMultiplier ?? 1.28
      const tFadeIn = Math.min(t1 - 0.15, t0 + 0.28)
      res.position.push(
        { id: nanoid(8), t: t0, value: [pos0[0], pos0[1] - riseY * 0.45, pos0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: tFadeIn, value: pos0, ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: [pos0[0], pos0[1] + riseY, pos0[2]], ease: 'easeInOut' }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: [sc0[0] * 0.88, sc0[1] * 0.88, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: tFadeIn, value: sc0, ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: [sc0[0] * endMul, sc0[1] * endMul, sc0[2]], ease: 'easeInOut' }
      )
      res.opacity.push(
        { id: nanoid(8), t: t0, value: 0, ease: 'easeOut' },
        { id: nanoid(8), t: tFadeIn, value: op0, ease: 'linear' },
        { id: nanoid(8), t: t1, value: op0, ease: 'linear' }
      )
      break
    }

    case 'oppressed_shrink_tremble': {
      const ampX = opts.deltaX ?? 6
      const sinkY = Math.abs(opts.deltaY ?? 48)
      const endMul = opts.endScaleMultiplier ?? 0.74
      const stepSec = 1 / 16
      const steps = Math.max(6, Math.min(90, Math.floor(duration / stepSec)))
      res.position.push({ id: nanoid(8), t: t0, value: [pos0[0], pos0[1] + 18, pos0[2]], ease: 'linear' })
      for (let i = 1; i < steps; i++) {
        const ratio = i / steps
        const curT = Number((t0 + duration * ratio).toFixed(3))
        const dir = i % 2 === 0 ? 1 : -1
        const curY = Math.round(pos0[1] + 18 - (sinkY + 18) * ratio)
        res.position.push({
          id: nanoid(8),
          t: curT,
          value: [pos0[0] + dir * ampX, curY, pos0[2]],
          ease: 'linear'
        })
      }
      res.position.push({ id: nanoid(8), t: t1, value: [pos0[0], pos0[1] - sinkY, pos0[2]], ease: 'easeOut' })
      res.scale.push(
        { id: nanoid(8), t: t0, value: [sc0[0] * 1.05, sc0[1] * 1.05, sc0[2]], ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: [sc0[0] * endMul, sc0[1] * endMul, sc0[2]], ease: 'easeInOut' }
      )
      res.opacity.push(
        { id: nanoid(8), t: t0, value: 0, ease: 'easeOut' },
        { id: nanoid(8), t: Math.min(t1, t0 + 0.18), value: op0, ease: 'linear' },
        { id: nanoid(8), t: t1, value: op0, ease: 'linear' }
      )
      break
    }
  }

  return res
}
