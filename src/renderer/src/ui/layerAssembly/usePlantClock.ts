import { useEffect, useRef, useState } from 'react'

/**
 * Đồng hồ liên tục cho Xương motion: thanh phát lặp lại (vd 4s) sẽ nhảy thời gian về 0,
 * làm cây giật về tư thế khác. Hook trả về phần bù (giây) cộng dồn mỗi lần lặp để chuyển động không bị đứt.
 * Khi người dùng tự tua (đang dừng), phần bù về 0 để thanh thời gian khớp đúng tư thế.
 */
export function usePlantClockOffset(time: number, isPlaying: boolean, duration: number): number {
  const ref = useRef({ prev: time, offset: 0 })
  const state = ref.current
  if (isPlaying) {
    if (time < state.prev - 1e-6) state.offset += Math.max(0.001, duration)
  } else if (Math.abs(time - state.prev) > 1e-6) {
    state.offset = 0
  }
  state.prev = time
  return state.offset
}

/**
 * Đồng hồ "gió trực tiếp" cho tab Motion: cây tự đung đưa ngay khi vẽ/chỉnh mà không cần bấm phát.
 * enabled = false → về 0 (trả cây về đúng thời gian timeline); running = false → đứng hình tại chỗ (khi đang kéo tay nắm).
 */
export function usePlantLiveClock(enabled: boolean, running: boolean): number {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setElapsed(0)
      return
    }
    if (!running) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000)
      last = now
      setElapsed((e) => e + delta)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [enabled, running])
  return enabled ? elapsed : 0
}
