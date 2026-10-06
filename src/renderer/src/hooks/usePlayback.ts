import { useEffect, useRef } from 'react'
import { assetStore } from '../project/assets'
import { getProjectAudioTracks } from '../project/audioTracks'
import { useEditor } from '../store/editor'

/** Drives the playhead while playing and keeps all background audio tracks in sync. */
export function usePlayback(): void {
  const playing = useEditor((s) => s.playing)
  const audioTracks = useEditor((s) => s.project.audioTracks)
  const audio = useEditor((s) => s.project.audio)
  const audiosRef = useRef<Map<string, { el: HTMLAudioElement; assetId: string }>>(new Map())

  // Keep <audio> elements bound to each active audio track.
  useEffect(() => {
    const st = useEditor.getState()
    const tracks = getProjectAudioTracks(st.project)
    const currentMap = audiosRef.current
    const activeIds = new Set(tracks.map((t) => t.id))

    // Cleanup tracks that are removed
    for (const [id, entry] of currentMap.entries()) {
      if (!activeIds.has(id)) {
        entry.el.pause()
        currentMap.delete(id)
      }
    }

    // Add or update active tracks
    for (const track of tracks) {
      const asset = assetStore.get(track.assetId)
      if (!asset) continue
      const existing = currentMap.get(track.id)
      if (!existing || existing.assetId !== track.assetId) {
        if (existing) existing.el.pause()
        const el = new Audio(asset.url)
        el.preload = 'auto'
        el.volume = Math.max(0, Math.min(1, track.volume))
        currentMap.set(track.id, { el, assetId: track.assetId })
      } else {
        existing.el.volume = Math.max(0, Math.min(1, track.volume))
      }
    }
  }, [audioTracks, audio])

  useEffect(() => {
    if (!playing) {
      for (const entry of audiosRef.current.values()) entry.el.pause()
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
          for (const entry of audiosRef.current.values()) entry.el.pause()
        } else {
          st.setTime(dur)
          st.setPlaying(false)
          for (const entry of audiosRef.current.values()) entry.el.pause()
          return
        }
      }
      st.setTime(t)

      const tracks = getProjectAudioTracks(st.project)
      for (const track of tracks) {
        const entry = audiosRef.current.get(track.id)
        if (entry) {
          syncAudio(entry.el, t, track)
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      for (const entry of audiosRef.current.values()) entry.el.pause()
    }
  }, [playing])
}

function syncAudio(
  el: HTMLAudioElement | null,
  t: number,
  track: import('@shared/types').AudioTrackItem
): void {
  if (!el) return
  if (track.muted) {
    if (!el.paused) el.pause()
    return
  }
  const at = t - track.offset
  const rate = track.playbackRate || 1
  if (Math.abs(el.playbackRate - rate) > 0.01) {
    el.playbackRate = rate
  }
  const trimIn = track.trimIn || 0
  const maxDur = track.duration

  const targetTime = trimIn + at * rate
  const inRange =
    at >= 0 &&
    (!maxDur || at < maxDur) &&
    (!isFinite(el.duration) || targetTime < el.duration)

  if (!inRange) {
    if (!el.paused) el.pause()
    return
  }
  if (el.paused) {
    el.currentTime = targetTime
    el.play().catch(() => undefined)
  } else if (Math.abs(el.currentTime - targetTime) > 0.25) {
    el.currentTime = targetTime
  }
}
