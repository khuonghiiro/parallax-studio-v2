import type { Layer } from '@shared/types'
import { shotAtTime } from '../../animation/cameraPath'
import type { CameraProp, LayerProp, ShotProp } from '../../store/editor'

export const NAME_W = 268
export const PAD = 10

export const LAYER_PROPS: { prop: LayerProp; label: string }[] = [
  { prop: 'position', label: 'Vị trí' },
  { prop: 'rotation', label: 'Xoay' },
  { prop: 'scale', label: 'Scale' },
  { prop: 'opacity', label: 'Opacity' }
]

export const CAMERA_PROPS: { prop: CameraProp; label: string }[] = [
  { prop: 'position', label: 'Vị trí' },
  { prop: 'target', label: 'Điểm nhìn' },
  { prop: 'fov', label: 'FOV' },
  { prop: 'focusDistance', label: 'Khoảng focus' },
  { prop: 'aperture', label: 'Khẩu độ' },
  { prop: 'fade', label: 'Fade đen' }
]

export const SHOT_PROPS: { prop: ShotProp; label: string }[] = [
  { prop: 'position', label: 'Vị trí cảnh' },
  { prop: 'rotation', label: 'Xoay cảnh' }
]

export const TYPE_LETTER: Record<Layer['type'], string> = {
  image: 'IMG',
  text: 'T',
  solid: 'S',
  particles: '✦'
}

/** Contiguous time ranges during which the camera looks at the same shot. */
export function shotSegments(
  project: Parameters<typeof shotAtTime>[0]
): { id: string | null; t0: number; t1: number }[] {
  const { duration, fps } = project.comp
  const n = Math.max(2, Math.min(900, Math.round(duration * fps)))
  const segs: { id: string | null; t0: number; t1: number }[] = []
  for (let i = 0; i <= n; i++) {
    const t = (duration * i) / n
    const id = shotAtTime(project, t)
    const last = segs[segs.length - 1]
    if (last && last.id === id) last.t1 = t
    else segs.push({ id, t0: last ? last.t1 : 0, t1: t })
  }
  return segs
}
