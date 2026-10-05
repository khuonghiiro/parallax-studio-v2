import type { ImageProps } from '@shared/types'
import type { AnimatedGifData } from './assets'

/**
 * Computes the active frame index of an animated GIF/WebP at a given timeline time `t`.
 * Supports playback speed, loop modes (loop, ping-pong, once), and time offset.
 */
export function getAnimatedGifFrameIndex(
  gif: AnimatedGifData,
  t: number,
  props: Partial<ImageProps> = {}
): number {
  const frames = gif.frames
  if (!frames || frames.length <= 1) return 0

  const speed = Math.max(0.01, props.speed ?? 1)
  const loopMode = props.loopMode ?? 'loop'
  const offset = props.timeOffset ?? 0
  const duration = gif.totalDuration || 1

  let localT = (t + offset) * speed
  if (localT < 0) localT = 0

  let frameT: number
  if (loopMode === 'once') {
    frameT = Math.min(localT, Math.max(0, duration - 1e-4))
  } else if (loopMode === 'ping-pong') {
    const cycle = duration * 2
    const rem = localT % cycle
    frameT = rem < duration ? rem : cycle - rem
  } else {
    // 'loop'
    frameT = localT % duration
  }

  // Binary search for frame
  let low = 0
  let high = frames.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const f = frames[mid]
    if (frameT < f.startTime) {
      high = mid - 1
    } else if (mid + 1 < frames.length && frameT >= frames[mid + 1].startTime) {
      low = mid + 1
    } else {
      return mid
    }
  }
  return Math.max(0, Math.min(frames.length - 1, low))
}
