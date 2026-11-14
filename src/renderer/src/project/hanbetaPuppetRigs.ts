import type { ImageLayer } from '@shared/types'
import type { PlantSpine } from '@shared/plantSpine'
import { addKeyframe } from '../animation/keyframes'
import { buildLayerSkinMesh } from './donghuaSceneryRigs'

interface SpineSpec {
  id: string
  name: string
  points: { x: number; y: number }[]
  amplitude: number
  speed: number
  stiffness: number
  flexibility: number
  waveLag: number
  turbulence: number
  lean?: number
  phaseOffset?: number
  reach?: number
  verticalBob?: number
}

function makeSpine(layerId: string, spec: SpineSpec): PlantSpine {
  return {
    id: spec.id,
    name: spec.name,
    points: spec.points,
    layerIds: [layerId],
    amplitude: spec.amplitude,
    speed: spec.speed,
    stiffness: spec.stiffness,
    flexibility: spec.flexibility,
    waveLag: spec.waveLag,
    turbulence: spec.turbulence,
    lean: spec.lean ?? 0,
    phaseOffset: spec.phaseOffset ?? 0,
    reach: spec.reach ?? 0,
    verticalBob: spec.verticalBob ?? 0,
    enabled: true
  }
}

/**
 * Gắn xương sóng lụa S-wave cho vạt áo khoác bay gió (neo ở vai/lưng, xòe dần xuống gấu áo).
 * Quy ước hệ tọa độ PlantSpine: -Y hướng lên đỉnh ảnh, +Y hướng xuống đáy ảnh.
 */
export function applyCoatBackWindSpines(coatLayer: ImageLayer, phaseSeed = 0): void {
  const spines = [
    makeSpine(coatLayer.id, {
      id: `${coatLayer.id}-coat-main`,
      name: 'Vạt Áo Khoác Chính (S-Wave)',
      points: [
        { x: 110, y: -250 },
        { x: -10, y: -60 },
        { x: -165, y: 125 },
        { x: -330, y: 290 }
      ],
      amplitude: 12.5,
      speed: 0.6,
      stiffness: 0.18,
      flexibility: 0.74,
      waveLag: 0.84,
      turbulence: 0.24,
      lean: -3.2,
      phaseOffset: phaseSeed,
      reach: 320,
      verticalBob: 0
    }),
    makeSpine(coatLayer.id, {
      id: `${coatLayer.id}-coat-hem`,
      name: 'Đuôi Áo Phía Sau (S-Wave)',
      points: [
        { x: 165, y: -210 },
        { x: 115, y: 0 },
        { x: 55, y: 180 },
        { x: -20, y: 315 }
      ],
      amplitude: 10.5,
      speed: 0.56,
      stiffness: 0.22,
      flexibility: 0.68,
      waveLag: 0.78,
      turbulence: 0.2,
      lean: -2.4,
      phaseOffset: phaseSeed + 0.55,
      reach: 280,
      verticalBob: 0
    })
  ]
  coatLayer.mesh = buildLayerSkinMesh(coatLayer, { segX: 16, segY: 18, plantSpines: spines })
}

/**
 * Đèn trần hành lang đung đưa nặng nề từ dây treo phía trên (y = -420 -> +245).
 */
export function applyCorridorLampSpine(lampLayer: ImageLayer, phaseSeed = 0): void {
  const spines = [
    makeSpine(lampLayer.id, {
      id: `${lampLayer.id}-lamp-pendulum`,
      name: 'Dây Treo Đèn Trần',
      points: [
        { x: 0, y: -420 },
        { x: 0, y: -150 },
        { x: 0, y: 80 },
        { x: 0, y: 245 }
      ],
      amplitude: 5.2,
      speed: 0.44,
      stiffness: 0.28,
      flexibility: 0.26,
      waveLag: 0.35,
      turbulence: 0.18,
      lean: 0.6,
      phaseOffset: phaseSeed,
      reach: 0,
      verticalBob: 0
    })
  ]
  lampLayer.mesh = buildLayerSkinMesh(lampLayer, { segX: 12, segY: 18, plantSpines: spines })
}

/**
 * Dây niêm cảnh báo & lá bùa tiền cảnh khẽ rung theo luồng gió lạnh hành lang.
 */
export function applyCautionForegroundSpines(cautionLayer: ImageLayer, phaseSeed = 0): void {
  const spines = [
    makeSpine(cautionLayer.id, {
      id: `${cautionLayer.id}-talisman-l`,
      name: 'Lá Bùa Trái',
      points: [
        { x: -390, y: -210 },
        { x: -396, y: -20 },
        { x: -406, y: 185 }
      ],
      amplitude: 10.5,
      speed: 0.62,
      stiffness: 0.22,
      flexibility: 0.68,
      waveLag: 0.78,
      turbulence: 0.26,
      lean: -2.0,
      phaseOffset: phaseSeed,
      reach: 190,
      verticalBob: 0
    }),
    makeSpine(cautionLayer.id, {
      id: `${cautionLayer.id}-talisman-c`,
      name: 'Dải Bùa Giữa',
      points: [
        { x: 20, y: -205 },
        { x: 15, y: -10 },
        { x: 4, y: 175 }
      ],
      amplitude: 9.0,
      speed: 0.58,
      stiffness: 0.25,
      flexibility: 0.64,
      waveLag: 0.74,
      turbulence: 0.24,
      lean: -1.6,
      phaseOffset: phaseSeed + 0.7,
      reach: 200,
      verticalBob: 0
    }),
    makeSpine(cautionLayer.id, {
      id: `${cautionLayer.id}-talisman-r`,
      name: 'Lá Bùa Phải',
      points: [
        { x: 430, y: -210 },
        { x: 422, y: -15 },
        { x: 410, y: 185 }
      ],
      amplitude: 11.2,
      speed: 0.66,
      stiffness: 0.2,
      flexibility: 0.72,
      waveLag: 0.8,
      turbulence: 0.28,
      lean: -2.2,
      phaseOffset: phaseSeed + 1.35,
      reach: 190,
      verticalBob: 0
    })
  ]
  cautionLayer.mesh = buildLayerSkinMesh(cautionLayer, { segX: 20, segY: 14, plantSpines: spines })
}

/**
 * Thực thể bóng đen uốn lượn quái dị từ thân dưới (+Y) bốc lên đầu/vuốt phía trên (-Y).
 */
export function applyShadowEntitySpines(shadowLayer: ImageLayer, phaseSeed = 0): void {
  const spines = [
    makeSpine(shadowLayer.id, {
      id: `${shadowLayer.id}-tendril-l`,
      name: 'Luồng Hắc Khí Trái',
      points: [
        { x: -90, y: 360 },
        { x: -115, y: 80 },
        { x: -125, y: -160 },
        { x: -105, y: -380 }
      ],
      amplitude: 9.5,
      speed: 0.5,
      stiffness: 0.22,
      flexibility: 0.66,
      waveLag: 0.82,
      turbulence: 0.3,
      lean: -1.4,
      phaseOffset: phaseSeed,
      reach: 260,
      verticalBob: 0
    }),
    makeSpine(shadowLayer.id, {
      id: `${shadowLayer.id}-tendril-r`,
      name: 'Luồng Hắc Khí Phải',
      points: [
        { x: 95, y: 360 },
        { x: 115, y: 90 },
        { x: 120, y: -150 },
        { x: 95, y: -380 }
      ],
      amplitude: 8.8,
      speed: 0.46,
      stiffness: 0.24,
      flexibility: 0.62,
      waveLag: 0.78,
      turbulence: 0.28,
      lean: 1.4,
      phaseOffset: phaseSeed + 0.9,
      reach: 260,
      verticalBob: 0
    })
  ]
  shadowLayer.mesh = buildLayerSkinMesh(shadowLayer, { segX: 16, segY: 20, plantSpines: spines })
}

/**
 * Chuyển động trôi sương lạnh lơ lửng ngang hành lang / sân thượng.
 */
export function applyMistDriftMotion(mistLayer: ImageLayer, startT: number, endT: number, seed = 1): void {
  const [x, y, z] = mistLayer.transform.position.value
  const span = Math.max(1, endT - startT)
  addKeyframe(mistLayer.transform.position, startT, [x + 35, y, z], 'easeInOut')
  addKeyframe(mistLayer.transform.position, Number((startT + span * 0.5).toFixed(2)), [x - 45, y + 8, z], 'easeInOut')
  addKeyframe(mistLayer.transform.position, endT, [x - 95, y - 4, z], 'easeInOut')
  mistLayer.motion = {
    enabled: true,
    type: 'float',
    speed: 0.28,
    amplitude: [28, 8, 0],
    amount: 0.6,
    phase: seed * 1.1,
    startTime: startT,
    duration: span
  }
}

/**
 * Hoạt ảnh Ấn Triện Phá Giải Quy Tắc: bùng mở dứt khoát tại Cảnh 3, xoay trận pháp và tụ quang.
 */
export function choreographRuleBreakSeal(sealLayer: ImageLayer, startT = 10.0, endT = 15.0): void {
  const [baseScale] = sealLayer.transform.scale.value
  addKeyframe(sealLayer.transform.opacity, startT, 0, 'easeOut')
  addKeyframe(sealLayer.transform.opacity, Number((startT + 0.35).toFixed(2)), 0.98, 'easeInOut')
  addKeyframe(sealLayer.transform.opacity, Number((startT + 2.4).toFixed(2)), 0.88, 'easeInOut')
  addKeyframe(sealLayer.transform.opacity, endT, 0.96, 'easeInOut')

  addKeyframe(sealLayer.transform.scale, startT, [baseScale * 0.25, baseScale * 0.25, 1], 'easeOut')
  addKeyframe(sealLayer.transform.scale, Number((startT + 0.55).toFixed(2)), [baseScale * 1.18, baseScale * 1.18, 1], 'easeInOut')
  addKeyframe(sealLayer.transform.scale, endT, [baseScale * 1.05, baseScale * 1.05, 1], 'easeInOut')

  addKeyframe(sealLayer.transform.rotation, startT, [0, 0, 0], 'linear')
  addKeyframe(sealLayer.transform.rotation, endT, [0, 0, 220], 'linear')
}
