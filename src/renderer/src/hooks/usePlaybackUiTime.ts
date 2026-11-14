import { useEditor } from '../store/editor'

/**
 * Returns `time` quantized to `hz` updates/sec ONLY while `playing === true`,
 * and exact un-throttled `time` whenever paused, scrubbing, or stepping frames.
 *
 * This prevents 60Hz full-DOM reconciliation on heavy secondary panels
 * (Inspector inputs, 250-node Workflow V2 graph) while keeping WebGL viewport
 * and Timeline playhead running at native 60fps.
 */
export function usePlaybackUiTime(hz = 8): number {
  return useEditor((s) => {
    const raw = Number.isFinite(s.time) ? s.time : 0
    if (!s.playing) return raw
    return Math.floor(raw * hz) / hz
  })
}
