import type { EaseName, Keyframe, Vec3 } from '@shared/types'
import { nanoid } from 'nanoid'

export type MotionPresetId =
  | 'walk_into_depth'
  | 'emerge_from_depth'
  | 'jump_arc'
  | 'trip_and_fall'
  | 'cross_screen'
  | 'floating_hover'
  | 'dramatic_zoom_in'
  | 'retreat_disappear'

export interface MotionPresetDef {
  id: MotionPresetId
  name: { en: string; vi: string }
  category: 'depth' | 'action' | 'ambient' | 'dramatic'
  description: { en: string; vi: string }
  defaultDuration: number
  recommendedClips: string[]
  paramsGuide: {
    depthZ?: number
    deltaX?: number
    deltaY?: number
    jumpHeight?: number
    endScale?: number
    fadeOpacity?: boolean
  }
}

export const MOTION_PRESETS_CATALOG: MotionPresetDef[] = [
  {
    id: 'walk_into_depth',
    name: { en: 'Walk into Depth / Deep Forest', vi: 'Đi vào chiều sâu / Rừng sâu' },
    category: 'depth',
    description: {
      en: 'Subject moves deep into the 3D space (Z increases drastically). Automatically shrinks scale to enhance perspective and fades opacity to 0 at the end to vanish into the deep background.',
      vi: 'Nhân vật/đối tượng di chuyển sâu vào không gian 3D (Z tăng mạnh). Tự động thu nhỏ scale theo luật phối cảnh và giảm dần opacity về 0 ở cuối để biến mất vào rừng sâu/sương mù.'
    },
    defaultDuration: 3.5,
    recommendedClips: ['walk', 'run'],
    paramsGuide: { depthZ: 2500, deltaX: 120, deltaY: 20, endScale: 0.08, fadeOpacity: true }
  },
  {
    id: 'emerge_from_depth',
    name: { en: 'Emerge from Depth', vi: 'Bước ra từ chiều sâu' },
    category: 'depth',
    description: {
      en: 'Subject steps out from deep background into the foreground (Z decreases toward 0). Scale grows from tiny to full size, and opacity fades in from 0 to 100%.',
      vi: 'Đối tượng từ sâu trong hậu cảnh bước ra tiền cảnh (Z giảm dần về 0). Scale phóng to từ nhỏ lên kích thước chuẩn, opacity hiện rõ dần từ 0 lên 100%.'
    },
    defaultDuration: 3.0,
    recommendedClips: ['walk', 'run'],
    paramsGuide: { depthZ: -2500, deltaX: -80, deltaY: 0, endScale: 1.0, fadeOpacity: true }
  },
  {
    id: 'jump_arc',
    name: { en: 'Jump Arc (Parabolic Leap)', vi: 'Nhảy vòng cung parabol' },
    category: 'action',
    description: {
      en: 'Parabolic jump over an obstacle or stream. Y rises in a peak arc with physics gravity, accompanied by squash & stretch scale anticipation and impact landing.',
      vi: 'Cú nhảy vòng cung hình parabol vượt chướng ngại vật hoặc suối. Y bổng lên theo quỹ đạo parabol trọng lực, kết hợp hiệu ứng co giãn (squash & stretch) khi nhún lấy đà và tiếp đất.'
    },
    defaultDuration: 1.4,
    recommendedClips: ['jump', 'action'],
    paramsGuide: { deltaX: 280, deltaY: 0, jumpHeight: 180, endScale: 1.0 }
  },
  {
    id: 'trip_and_fall',
    name: { en: 'Trip & Fall (Stumble Landing)', vi: 'Vấp ngã (Té sấp)' },
    category: 'action',
    description: {
      en: 'Subject trips abruptly, lunges forward, Y drops to the floor level, rotation tilts 70 degrees forward, bounces once and remains down.',
      vi: 'Nhân vật đang di chuyển bất ngờ vấp khựng lại, chúi nhào tới trước, Y sụp xuống sàn đất, xoay nghiêng Z chúi xuống 70 độ, nảy nhẹ và nằm sấp.'
    },
    defaultDuration: 1.8,
    recommendedClips: ['fall', 'idle'],
    paramsGuide: { deltaX: 80, deltaY: -80 }
  },
  {
    id: 'cross_screen',
    name: { en: 'Cross Screen (Horizontal March)', vi: 'Đi ngang màn hình' },
    category: 'action',
    description: {
      en: 'Subject traverses horizontally from left to right or vice versa across the shot frame, with subtle natural step bobbing.',
      vi: 'Đối tượng băng ngang khung hình từ mép này sang mép kia, kèm độ nhấp nhô (bobbing) nhẹ nhàng tự nhiên theo nhịp chân bước.'
    },
    defaultDuration: 4.0,
    recommendedClips: ['walk', 'run'],
    paramsGuide: { deltaX: 800, deltaY: 0 }
  },
  {
    id: 'floating_hover',
    name: { en: 'Floating Hover (Gentle Bob)', vi: 'Bay lượn bồng bềnh' },
    category: 'ambient',
    description: {
      en: 'Smooth harmonic floating motion in Y and slight tilt for fairies, spirits, hot air balloons, or flying creatures.',
      vi: 'Chuyển động bay bổng êm ái nhấp nhô theo sóng sin trên trục Y và nghiêng nhẹ cho tiên linh, bóng ma, khinh khí cầu hoặc sinh vật bay.'
    },
    defaultDuration: 3.0,
    recommendedClips: ['sway', 'idle'],
    paramsGuide: { deltaY: 45 }
  },
  {
    id: 'dramatic_zoom_in',
    name: { en: 'Dramatic Impact Zoom', vi: 'Phóng to kịch tính' },
    category: 'dramatic',
    description: {
      en: 'Fast dramatic dash toward camera with heavy easing for impactful combat moves or dramatic revelations.',
      vi: 'Lao nhanh về phía camera với gia tốc mạnh, tạo hiệu ứng giật gân, xuất kích hoặc nhấn mạnh khoảnh khắc kịch tính.'
    },
    defaultDuration: 1.0,
    recommendedClips: ['action', 'jump'],
    paramsGuide: { depthZ: -1200, endScale: 1.6 }
  },
  {
    id: 'retreat_disappear',
    name: { en: 'Retreat & Fade Away', vi: 'Lùi lại và biến mất' },
    category: 'depth',
    description: {
      en: 'Subject steps backward into shadow, gradually fading opacity down to 0.',
      vi: 'Đối tượng lùi dần về sau vào bóng tối, mờ dần opacity về 0.'
    },
    defaultDuration: 2.5,
    recommendedClips: ['walk', 'idle'],
    paramsGuide: { depthZ: 800, deltaX: -40, endScale: 0.6, fadeOpacity: true }
  }
]

export interface SpatialMotionOptions {
  time?: number
  duration?: number
  fromPosition?: Vec3
  toPosition?: Vec3
  depthZ?: number
  deltaX?: number
  deltaY?: number
  jumpHeight?: number
  fromScale?: Vec3
  toScale?: Vec3
  endScaleMultiplier?: number
  fromOpacity?: number
  toOpacity?: number
  fadeOpacity?: boolean
  ease?: EaseName
}

export interface GeneratedTransformTracks {
  position: Keyframe<Vec3>[]
  rotation: Keyframe<Vec3>[]
  scale: Keyframe<Vec3>[]
  opacity: Keyframe<number>[]
}

/**
 * Sinh keyframes After Effects cho chuyển động không gian theo preset.
 */
export function generatePresetSpatialTracks(
  presetId: MotionPresetId,
  current: { position: Vec3; rotation: Vec3; scale: Vec3; opacity: number },
  opts: SpatialMotionOptions = {}
): GeneratedTransformTracks {
  const meta = MOTION_PRESETS_CATALOG.find((p) => p.id === presetId)
  const t0 = opts.time ?? 0
  const duration = opts.duration ?? meta?.defaultDuration ?? 2.0
  const t1 = t0 + duration

  const pos0: Vec3 = opts.fromPosition ? [...opts.fromPosition] : [...current.position]
  const rot0: Vec3 = [...current.rotation]
  const sc0: Vec3 = opts.fromScale ? [...opts.fromScale] : [...current.scale]
  const op0 = opts.fromOpacity ?? current.opacity

  const defaultEase: EaseName = opts.ease || 'easeInOut'

  const res: GeneratedTransformTracks = {
    position: [],
    rotation: [],
    scale: [],
    opacity: []
  }

  switch (presetId) {
    case 'walk_into_depth': {
      const dZ = opts.depthZ ?? meta?.paramsGuide.depthZ ?? 2400
      const dX = opts.deltaX ?? meta?.paramsGuide.deltaX ?? 100
      const dY = opts.deltaY ?? meta?.paramsGuide.deltaY ?? 15
      const endScaleMul = opts.endScaleMultiplier ?? meta?.paramsGuide.endScale ?? 0.1
      const pos1: Vec3 = opts.toPosition ? [...opts.toPosition] : [pos0[0] + dX, pos0[1] + dY, pos0[2] + dZ]
      const sc1: Vec3 = opts.toScale ? [...opts.toScale] : [sc0[0] * endScaleMul, sc0[1] * endScaleMul, sc0[2] * endScaleMul]

      res.position.push(
        { id: nanoid(8), t: t0, value: pos0, ease: defaultEase },
        { id: nanoid(8), t: t1, value: pos1, ease: defaultEase }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: sc0, ease: defaultEase },
        { id: nanoid(8), t: t1, value: sc1, ease: defaultEase }
      )

      const shouldFade = opts.fadeOpacity !== false
      if (shouldFade) {
        // Giữ rõ trong 60% thời gian đầu, 40% cuối mờ dần vào rừng sâu
        const tFadeStart = t0 + duration * 0.6
        res.opacity.push(
          { id: nanoid(8), t: t0, value: op0, ease: 'linear' },
          { id: nanoid(8), t: tFadeStart, value: op0, ease: 'easeOut' },
          { id: nanoid(8), t: t1, value: 0, ease: 'easeOut' }
        )
      } else {
        res.opacity.push({ id: nanoid(8), t: t0, value: op0, ease: 'linear' })
      }
      break
    }

    case 'emerge_from_depth': {
      const dZ = opts.depthZ ?? meta?.paramsGuide.depthZ ?? -2400
      const dX = opts.deltaX ?? meta?.paramsGuide.deltaX ?? -80
      const pos1: Vec3 = opts.toPosition ? [...opts.toPosition] : [pos0[0] + dX, pos0[1], pos0[2] + dZ]
      const sc1: Vec3 = opts.toScale ? [...opts.toScale] : [sc0[0], sc0[1], sc0[2]]
      const startSc: Vec3 = [sc0[0] * 0.1, sc0[1] * 0.1, sc0[2] * 0.1]

      res.position.push(
        { id: nanoid(8), t: t0, value: pos0, ease: defaultEase },
        { id: nanoid(8), t: t1, value: pos1, ease: defaultEase }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: startSc, ease: defaultEase },
        { id: nanoid(8), t: t1, value: sc1, ease: defaultEase }
      )
      res.opacity.push(
        { id: nanoid(8), t: t0, value: 0, ease: 'easeIn' },
        { id: nanoid(8), t: t0 + duration * 0.4, value: 1.0, ease: 'easeIn' },
        { id: nanoid(8), t: t1, value: 1.0, ease: 'linear' }
      )
      break
    }

    case 'jump_arc': {
      const dX = opts.deltaX ?? meta?.paramsGuide.deltaX ?? 260
      const dY = opts.deltaY ?? 0
      const jH = opts.jumpHeight ?? meta?.paramsGuide.jumpHeight ?? 180
      const tMid = t0 + duration * 0.5
      const posMid: Vec3 = [pos0[0] + dX * 0.5, pos0[1] + dY * 0.5 + jH, pos0[2] + (opts.depthZ ?? 100)]
      const pos1: Vec3 = opts.toPosition ? [...opts.toPosition] : [pos0[0] + dX, pos0[1] + dY, pos0[2] + (opts.depthZ ?? 200)]

      // Parabol vị trí: bay lên bằng easeOut, rơi xuống bằng easeIn
      res.position.push(
        { id: nanoid(8), t: t0, value: pos0, ease: 'easeOut' },
        { id: nanoid(8), t: tMid, value: posMid, ease: 'easeIn' },
        { id: nanoid(8), t: t1, value: pos1, ease: 'easeOut' }
      )

      // Squash & Stretch
      const squashPrep: Vec3 = [sc0[0] * 1.15, sc0[1] * 0.85, sc0[2]]
      const stretchMid: Vec3 = [sc0[0] * 0.9, sc0[1] * 1.15, sc0[2]]
      const squashLand: Vec3 = [sc0[0] * 1.12, sc0[1] * 0.88, sc0[2]]
      res.scale.push(
        { id: nanoid(8), t: t0, value: pos0, ease: 'linear' },
        { id: nanoid(8), t: t0 + duration * 0.15, value: squashPrep, ease: 'easeOut' },
        { id: nanoid(8), t: tMid, value: stretchMid, ease: 'easeInOut' },
        { id: nanoid(8), t: t1 - duration * 0.1, value: squashLand, ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: sc0, ease: 'easeOut' }
      )
      break
    }

    case 'trip_and_fall': {
      const dX = opts.deltaX ?? 70
      const dY = opts.deltaY ?? -80
      const tTrip = t0 + duration * 0.25
      const tImpact = t0 + duration * 0.55
      const tBounce = t0 + duration * 0.75

      const posTrip: Vec3 = [pos0[0] + dX * 0.4, pos0[1] + 15, pos0[2] + 20]
      const posFloor: Vec3 = [pos0[0] + dX, pos0[1] + dY, pos0[2] + 40]
      const posBounce: Vec3 = [pos0[0] + dX + 10, pos0[1] + dY + 12, pos0[2] + 45]

      res.position.push(
        { id: nanoid(8), t: t0, value: pos0, ease: 'linear' },
        { id: nanoid(8), t: tTrip, value: posTrip, ease: 'easeIn' },
        { id: nanoid(8), t: tImpact, value: posFloor, ease: 'easeOut' },
        { id: nanoid(8), t: tBounce, value: posBounce, ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: posFloor, ease: 'linear' }
      )

      // Chúi ngã về phía trước trên trục Z
      const rotTrip: Vec3 = [rot0[0], rot0[1], rot0[2] + 20]
      const rotFloor: Vec3 = [rot0[0], rot0[1], rot0[2] + 75]
      const rotBounce: Vec3 = [rot0[0], rot0[1], rot0[2] + 68]
      const rotFinal: Vec3 = [rot0[0], rot0[1], rot0[2] + 72]

      res.rotation.push(
        { id: nanoid(8), t: t0, value: rot0, ease: 'linear' },
        { id: nanoid(8), t: tTrip, value: rotTrip, ease: 'easeIn' },
        { id: nanoid(8), t: tImpact, value: rotFloor, ease: 'easeOut' },
        { id: nanoid(8), t: tBounce, value: rotBounce, ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: rotFinal, ease: 'linear' }
      )
      break
    }

    case 'cross_screen': {
      const dX = opts.deltaX ?? 800
      const stepsCount = 4
      res.position.push({ id: nanoid(8), t: t0, value: pos0, ease: 'linear' })
      for (let s = 1; s < stepsCount; s++) {
        const u = s / stepsCount
        const curT = t0 + duration * u
        const bobY = (s % 2 === 1 ? 1 : -1) * 8
        res.position.push({
          id: nanoid(8),
          t: curT,
          value: [pos0[0] + dX * u, pos0[1] + bobY, pos0[2]],
          ease: 'easeInOut'
        })
      }
      res.position.push({
        id: nanoid(8),
        t: t1,
        value: opts.toPosition ? [...opts.toPosition] : [pos0[0] + dX, pos0[1], pos0[2]],
        ease: 'linear'
      })
      break
    }

    case 'floating_hover': {
      const ampY = opts.deltaY ?? 40
      const tCycle1 = t0 + duration * 0.25
      const tCycle2 = t0 + duration * 0.5
      const tCycle3 = t0 + duration * 0.75

      res.position.push(
        { id: nanoid(8), t: t0, value: pos0, ease: 'easeInOut' },
        { id: nanoid(8), t: tCycle1, value: [pos0[0], pos0[1] + ampY, pos0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: tCycle2, value: pos0, ease: 'easeInOut' },
        { id: nanoid(8), t: tCycle3, value: [pos0[0], pos0[1] - ampY * 0.8, pos0[2]], ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: pos0, ease: 'easeInOut' }
      )
      res.rotation.push(
        { id: nanoid(8), t: t0, value: rot0, ease: 'easeInOut' },
        { id: nanoid(8), t: tCycle1, value: [rot0[0], rot0[1], rot0[2] + 4], ease: 'easeInOut' },
        { id: nanoid(8), t: tCycle3, value: [rot0[0], rot0[1], rot0[2] - 4], ease: 'easeInOut' },
        { id: nanoid(8), t: t1, value: rot0, ease: 'easeInOut' }
      )
      break
    }

    case 'dramatic_zoom_in': {
      const dZ = opts.depthZ ?? -1400
      const scMul = opts.endScaleMultiplier ?? 1.6
      const pos1: Vec3 = opts.toPosition ? [...opts.toPosition] : [pos0[0], pos0[1], pos0[2] + dZ]
      const sc1: Vec3 = opts.toScale ? [...opts.toScale] : [sc0[0] * scMul, sc0[1] * scMul, sc0[2]]

      res.position.push(
        { id: nanoid(8), t: t0, value: pos0, ease: 'easeInOutStrong' },
        { id: nanoid(8), t: t1, value: pos1, ease: 'easeInOutStrong' }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: sc0, ease: 'easeInOutStrong' },
        { id: nanoid(8), t: t1, value: sc1, ease: 'easeInOutStrong' }
      )
      break
    }

    case 'retreat_disappear': {
      const dZ = opts.depthZ ?? 900
      const scMul = opts.endScaleMultiplier ?? 0.5
      const pos1: Vec3 = opts.toPosition ? [...opts.toPosition] : [pos0[0], pos0[1], pos0[2] + dZ]
      const sc1: Vec3 = opts.toScale ? [...opts.toScale] : [sc0[0] * scMul, sc0[1] * scMul, sc0[2]]

      res.position.push(
        { id: nanoid(8), t: t0, value: pos0, ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: pos1, ease: 'easeOut' }
      )
      res.scale.push(
        { id: nanoid(8), t: t0, value: sc0, ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: sc1, ease: 'easeOut' }
      )
      res.opacity.push(
        { id: nanoid(8), t: t0, value: op0, ease: 'linear' },
        { id: nanoid(8), t: t0 + duration * 0.3, value: op0, ease: 'easeOut' },
        { id: nanoid(8), t: t1, value: 0, ease: 'easeOut' }
      )
      break
    }
  }

  return res
}
