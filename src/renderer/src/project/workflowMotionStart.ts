import type { Animatable, Layer, Vec3 } from '@shared/types'
import { evaluate } from '../animation/keyframes'

/** Keep completed steps, exclude this step and future generated keys from the start pose. */
function startTrack(track: Animatable<Vec3>, t: number, nodeId?: string): Vec3 {
  return evaluate({ ...track, keyframes: track.keyframes.filter(k => {
    const generated = /-bboxmot-|-bboxcol-|-motpath-p-|^wfcol:/.test(k.id)
    if (!generated) return true
    if (nodeId && (k.id.includes(`-bboxmot-${nodeId}-`) || k.id.includes(`-bboxcol-${nodeId}-`) || k.id.startsWith(`wfcol:${nodeId}:`))) return false
    return k.t <= t + 1e-6
  }) }, t)
}

export const bboxStartPosition = (layer: Layer, t: number, nodeId?: string): Vec3 => startTrack(layer.transform.position, t, nodeId)
export const bboxStartScale = (layer: Layer, t: number, nodeId?: string): Vec3 => startTrack(layer.transform.scale, t, nodeId)
