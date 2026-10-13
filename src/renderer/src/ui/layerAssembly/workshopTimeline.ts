import type { LayerRig } from '@shared/layerRig'
import { KEY_EPSILON } from './workshopAnimation'

export function timelineTime(clientX: number, left: number, width: number, duration: number, fps: number, snap: boolean) {
  const time = (clientX - left) / Math.max(1, width) * duration
  return Math.max(0, Math.min(duration, snap ? Math.round(time * fps) / fps : time))
}

export function adjacentKeyTime(rig: LayerRig, time: number, direction: -1 | 1, boneId?: string | null) {
  const tracks = boneId ? [rig.tracks[boneId] ?? []] : Object.values(rig.tracks)
  const times = [...new Set(tracks.flatMap((keys) => keys.map((k) => k.time)))].sort((a, b) => a - b)
  return direction === -1 ? times.filter((t) => t < time - KEY_EPSILON).at(-1) : times.find((t) => t > time + KEY_EPSILON)
}

