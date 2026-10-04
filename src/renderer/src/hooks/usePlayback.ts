import { useEffect, useRef } from 'react'
import { assetStore } from '../project/assets'
import { useEditor } from '../store/editor'

/** Drives the playhead while playing and keeps the background audio in sync. */
export function usePlayback(): void {
  const playing = useEditor((s) => s.playing)
  const audioTrack = useEditor((s) => s.project.audio)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Keep an <audio> element bound to the current audio asset.
  useEffect(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (!audioTrack) return
    const asset = assetStore.get(audioTrack.assetId)
    if (!asset) return
    const el = new Audio(asset.url)
    el.preload = 'auto'
    audioRef.current = el
    return () => el.pause()
  }, [audioTrack?.assetId])

  useEffect(() => {
    if (audioRef.current && audioTrack) audioRef.current.volume = Math.max(0, Math.min(1, audioTrack.volume))
  }, [audioTrack?.volume])

  useEffect(() => {
    if (!playing) {
      audioRef.current?.pause()
      return
    }
    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const st = useEditor.getState()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      let t = st.time + dt
      const dur = st.project.comp.duration
      if (t >= dur) {
        if (st.loop) {
          t = 0
          if (audioRef.current) audioRef.current.pause()
        } else {
          st.setTime(dur)
          st.setPlaying(false)
          return
        }
      }
      st.setTime(t)
      syncAudio(audioRef.current, t, st.project.audio?.offset ?? 0)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      audioRef.current?.pause()
    }
  }, [playing])
}

function syncAudio(el: HTMLAudioElement | null, t: number, offset: number): void {
  if (!el) return
  const at = t - offset
  const inRange = at >= 0 && (!isFinite(el.duration) || at < el.duration)
  if (!inRange) {
    if (!el.paused) el.pause()
    return
  }
  if (el.paused) {
    el.currentTime = at
    el.play().catch(() => undefined)
  } else if (Math.abs(el.currentTime - at) > 0.2) {
    el.currentTime = at
  }
}
