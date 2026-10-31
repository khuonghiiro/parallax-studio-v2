import { useEffect, useState } from 'react'

export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2

export function useWorkshopPlayback(duration = 4, loop = true) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)

  useEffect(() => {
    setTime((t) => (t > duration ? 0 : t))
  }, [duration])

  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1) * speed
      last = now
      setTime((t) => {
        const next = t + delta
        if (next < duration) return next
        if (loop) return duration > 0 ? next % duration : 0
        setIsPlaying(false)
        return duration
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, duration, loop, speed])

  const toggle = () => {
    setIsPlaying((p) => {
      if (!p) {
        setTime((t) => (t >= duration - 0.05 ? 0 : t))
      }
      return !p
    })
  }

  const cycleSpeed = () => {
    setSpeed((prev) => (prev === 0.5 ? 1 : prev === 1 ? 1.5 : prev === 1.5 ? 2 : 0.5))
  }

  return { isPlaying, setIsPlaying, time, setTime, toggle, speed, setSpeed, cycleSpeed }
}
