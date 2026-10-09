import { useEffect, useState } from 'react'

export function useWorkshopPlayback(duration = 4, loop = true) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)
  useEffect(() => {
    if (!isPlaying) return
    let frame = 0, last = performance.now()
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now
      setTime((t) => {
        const next = t + delta
        if (next < duration) return next
        if (loop) return next % duration
        setIsPlaying(false)
        return duration
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, duration, loop])
  return { isPlaying, setIsPlaying, time, setTime, toggle: () => setIsPlaying((p) => !p) }
}
