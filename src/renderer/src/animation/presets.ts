import type { CameraSettings, Composition, ParticleProps, Vec3 } from '@shared/types'
import { ease } from './easing'
import { addKeyframe } from './keyframes'
import { referenceDistance } from './math'

export type CameraPreset =
  | 'dollyIn'
  | 'dollyOut'
  | 'truckLeft'
  | 'truckRight'
  | 'craneUp'
  | 'craneDown'
  | 'orbitLeft'
  | 'orbitRight'
  | 'zoomIn'
  | 'dollyZoom'
  | 'reset'

export const CAMERA_PRESETS: { id: CameraPreset; label: string; hint: string }[] = [
  { id: 'dollyIn', label: 'Dolly In', hint: 'Camera tiến vào cảnh' },
  { id: 'dollyOut', label: 'Dolly Out', hint: 'Camera lùi ra xa' },
  { id: 'truckLeft', label: 'Truck Left', hint: 'Trượt ngang sang trái' },
  { id: 'truckRight', label: 'Truck Right', hint: 'Trượt ngang sang phải' },
  { id: 'craneUp', label: 'Crane Up', hint: 'Nâng camera lên' },
  { id: 'craneDown', label: 'Crane Down', hint: 'Hạ camera xuống' },
  { id: 'orbitLeft', label: 'Orbit Left', hint: 'Xoay quanh tâm cảnh' },
  { id: 'orbitRight', label: 'Orbit Right', hint: 'Xoay quanh tâm cảnh' },
  { id: 'zoomIn', label: 'Zoom In (FOV)', hint: 'Phóng to bằng ống kính' },
  { id: 'dollyZoom', label: 'Dolly Zoom', hint: 'Hiệu ứng Vertigo' },
  { id: 'reset', label: 'Reset camera', hint: 'Xoá keyframe camera' }
]

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

/**
 * Replace the camera animation with a preset move between t0 and t1.
 * `intensity` scales the move (1 = default). `toWorld` maps the preset's local frame
 * (a v1-style scene around the origin) into world space, e.g. a shot's transform.
 * Mutates (use inside an immer producer).
 */
export function applyCameraPreset(
  cam: CameraSettings,
  preset: CameraPreset,
  comp: Composition,
  t0: number,
  t1: number,
  intensity = 1,
  toWorld: (p: Vec3) => Vec3 = (p) => p
): void {
  const d = referenceDistance(comp)
  const p0: Vec3 = [0, 0, -d]
  const tg0: Vec3 = [0, 0, 0]
  const W = toWorld

  cam.position.keyframes = []
  cam.target.keyframes = []
  cam.fov.keyframes = []
  cam.position.value = W(p0)
  cam.target.value = W(tg0)
  cam.fov.value = 40

  const move = (delta: Vec3, moveTarget = true): void => {
    addKeyframe(cam.position, t0, W(p0), 'easeInOut')
    addKeyframe(cam.position, t1, W(add(p0, delta)), 'easeInOut')
    if (moveTarget) {
      addKeyframe(cam.target, t0, W(tg0), 'easeInOut')
      addKeyframe(cam.target, t1, W(add(tg0, delta)), 'easeInOut')
    }
  }

  const k = intensity
  switch (preset) {
    case 'dollyIn':
      move([0, 0, d * 0.4 * k])
      break
    case 'dollyOut':
      addKeyframe(cam.position, t0, W(add(p0, [0, 0, d * 0.4 * k])), 'easeInOut')
      addKeyframe(cam.position, t1, W(p0), 'easeInOut')
      addKeyframe(cam.target, t0, W(add(tg0, [0, 0, d * 0.4 * k])), 'easeInOut')
      addKeyframe(cam.target, t1, W(tg0), 'easeInOut')
      break
    case 'truckLeft':
      move([-comp.width * 0.12 * k, 0, 0])
      break
    case 'truckRight':
      move([comp.width * 0.12 * k, 0, 0])
      break
    case 'craneUp':
      move([0, comp.height * 0.12 * k, 0])
      break
    case 'craneDown':
      move([0, -comp.height * 0.12 * k, 0])
      break
    case 'orbitLeft':
    case 'orbitRight': {
      // Sample an arc; spacing follows the ease so the overall move eases in/out.
      const dir = preset === 'orbitLeft' ? -1 : 1
      const range = ((12 * k) * Math.PI) / 180
      const pivot: Vec3 = [0, 0, d * 0.6]
      const radius = d * 1.6
      cam.target.value = W(pivot)
      const steps = 10
      for (let i = 0; i <= steps; i++) {
        const u = ease('easeInOut', i / steps)
        const a = dir * (u - 0.5) * range * 2
        const pos: Vec3 = [pivot[0] + Math.sin(a) * radius, 0, pivot[2] - Math.cos(a) * radius]
        addKeyframe(cam.position, t0 + ((t1 - t0) * i) / steps, W(pos), 'linear')
      }
      break
    }
    case 'zoomIn':
      addKeyframe(cam.fov, t0, 40, 'easeInOut')
      addKeyframe(cam.fov, t1, 40 - 10 * k, 'easeInOut')
      break
    case 'dollyZoom': {
      // Keep the z=0 plane the same size while moving the camera: tan(fov/2) * dist = const.
      const steps = 8
      const c = Math.tan((20 * Math.PI) / 180) * d
      for (let i = 0; i <= steps; i++) {
        const u = ease('easeInOut', i / steps)
        const dist = d * (1 - 0.45 * k * u)
        const fov = (2 * Math.atan(c / dist) * 180) / Math.PI
        const t = t0 + ((t1 - t0) * i) / steps
        addKeyframe(cam.position, t, W([0, 0, -dist]), 'linear')
        addKeyframe(cam.fov, t, fov, 'linear')
      }
      break
    }
    case 'reset':
      break
  }
}

export type ParticlePreset = 'dust' | 'fireflies' | 'rain' | 'snow' | 'fog' | 'leaves'

export const PARTICLE_PRESETS: Record<
  ParticlePreset,
  { label: string; hint: string; props: Partial<ParticleProps> }
> = {
  dust: {
    label: 'Bụi sáng / Ánh nắng',
    hint: 'Bụi vàng li ti trôi lơ lửng dưới tia nắng',
    props: {
      count: 320,
      size: 5,
      color: '#fff4cc',
      velocity: [6, 10, 0],
      sway: 25,
      twinkle: true,
      glow: true
    }
  },
  fireflies: {
    label: 'Đom đóm hoàng hôn',
    hint: 'Đom đóm ánh vàng xanh nhấp nháy buổi tối',
    props: {
      count: 280,
      size: 7,
      color: '#ffe082',
      velocity: [10, 16, 0],
      sway: 40,
      twinkle: true,
      glow: true
    }
  },
  rain: {
    label: 'Mưa rào gió lốc',
    hint: 'Mưa rơi hạt dài nhanh theo chiều gió',
    props: {
      count: 2200,
      size: 9,
      color: '#c2e3fc',
      velocity: [-160, -1800, -80],
      sway: 8,
      twinkle: false,
      glow: false
    }
  },
  snow: {
    label: 'Tuyết rơi mùa đông',
    hint: 'Tuyết trắng rơi nhẹ nhàng bồng bềnh',
    props: {
      count: 650,
      size: 7,
      color: '#ffffff',
      velocity: [-25, -220, 0],
      sway: 45,
      twinkle: false,
      glow: false
    }
  },
  fog: {
    label: 'Sương mù lơ lửng',
    hint: 'Các đám mây sương hạt to mềm trôi chậm',
    props: {
      count: 140,
      size: 150,
      color: '#e2e8f0',
      velocity: [45, 3, 0],
      sway: 65,
      twinkle: false,
      glow: true
    }
  },
  leaves: {
    label: 'Lá vàng / Cánh hoa',
    hint: 'Lá cây hoặc cánh hoa cuốn bay theo gió',
    props: {
      count: 320,
      size: 12,
      color: '#f6ad55',
      velocity: [-120, -140, 20],
      sway: 55,
      twinkle: false,
      glow: false
    }
  }
}
