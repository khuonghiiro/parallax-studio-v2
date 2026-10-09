import { useEffect, useState } from 'react'

export function useWorkshopPlayback() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)
  useEffect(() => {
    if (!isPlaying) return
    let frame = 0, last = performance.now()
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1)
      last = now
      setTime((t) => t + delta)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying])
  return { isPlaying, setIsPlaying, time, setTime, toggle: () => setIsPlaying((p) => !p) }
}
