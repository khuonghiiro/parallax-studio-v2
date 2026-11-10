import { describe, expect, it } from 'vitest'
import { FrameBufferPool, FrameSendQueue } from './frameSendQueue'

const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('FrameSendQueue', () => {
  it('gửi frame tuần tự đúng thứ tự dù hàm gửi có độ trễ khác nhau', async () => {
    const sent: number[] = []
    let active = 0
    let maxActive = 0
    const q = new FrameSendQueue(async (f) => {
      active++
      maxActive = Math.max(maxActive, active)
      await tick(f[0] % 2 === 0 ? 4 : 0)
      sent.push(f[0])
      active--
    }, 3)
    for (let i = 0; i < 10; i++) await q.push(new Uint8Array([i]))
    await q.drain()
    expect(sent).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(maxActive).toBe(1)
  })

  it('chặn push khi hàng đợi đầy và giải phóng buffer sau khi gửi', async () => {
    const released: Uint8Array[] = []
    let unblock: () => void = () => undefined
    const gate = new Promise<void>((r) => (unblock = r))
    const q = new FrameSendQueue(() => gate, 2, (f) => released.push(f))
    await q.push(new Uint8Array(1))
    await q.push(new Uint8Array(1))
    let third = false
    const p = q.push(new Uint8Array(1)).then(() => (third = true))
    await tick(5)
    expect(third).toBe(false)
    expect(q.size).toBe(2)
    unblock()
    await p
    await q.drain()
    expect(third).toBe(true)
    expect(released).toHaveLength(3)
  })

  it('ném lỗi gửi đầu tiên ở lần push / drain kế tiếp và không gửi thêm', async () => {
    let calls = 0
    const q = new FrameSendQueue(async () => {
      calls++
      throw new Error('ffmpeg exited early')
    }, 2)
    await q.push(new Uint8Array(1))
    await tick()
    await expect(q.push(new Uint8Array(1))).rejects.toThrow(/ffmpeg exited early/)
    await expect(q.drain()).rejects.toThrow(/ffmpeg exited early/)
    expect(calls).toBe(1)
  })
})

describe('FrameBufferPool', () => {
  it('tái sử dụng buffer đúng kích thước', () => {
    const pool = new FrameBufferPool(16)
    const a = pool.acquire()
    pool.release(a)
    expect(pool.acquire()).toBe(a)
    pool.release(new Uint8Array(8))
    expect(pool.acquire().byteLength).toBe(16)
  })
})
