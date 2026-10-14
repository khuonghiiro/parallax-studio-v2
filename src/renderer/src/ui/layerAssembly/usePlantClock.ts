import { useRef } from 'react'

/**
 * Đồng hồ liên tục cho Xương thực vật: thanh phát lặp lại (vd 4s) sẽ nhảy thời gian về 0,
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
