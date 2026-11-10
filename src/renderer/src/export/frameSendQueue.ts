/**
 * Gửi frame xuất video sang encoder theo đúng thứ tự, chạy song song với việc dựng frame kế tiếp.
 *
 * - Tuần tự: frame N+1 chỉ được gửi khi frame N đã gửi xong (bridge web/remote dùng HTTP POST nên
 *   không được gửi chồng, tránh đảo thứ tự frame).
 * - Có giới hạn (`maxQueued`): renderer không chạy quá xa encoder → bộ nhớ không phình.
 * - Tái sử dụng buffer qua `FrameBufferPool` để tránh cấp phát 8–33 MB mỗi frame (giảm GC).
 */
export class FrameBufferPool {
  private readonly spare: Uint8Array[] = []

  constructor(readonly byteLength: number) {}

  acquire(): Uint8Array {
    return this.spare.pop() ?? new Uint8Array(this.byteLength)
  }

  release(buf: Uint8Array): void {
    if (buf.byteLength === this.byteLength) this.spare.push(buf)
  }
}

export class FrameSendQueue {
  private tail: Promise<void> = Promise.resolve()
  private queued = 0
  private failure: unknown = null
  private waiters: Array<() => void> = []
  /** Tổng thời gian renderer phải đứng chờ vì hàng đợi đầy (encoder chậm hơn renderer). */
  blockedMs = 0

  constructor(
    private readonly send: (frame: Uint8Array) => Promise<void>,
    private readonly maxQueued = 2,
    private readonly onSent: (frame: Uint8Array) => void = () => undefined
  ) {}

  get size(): number {
    return this.queued
  }

  private settleOne(): void {
    this.queued--
    this.waiters.shift()?.()
  }

  /** Xếp frame vào hàng gửi; chỉ chờ khi hàng đợi đã đầy. Ném lỗi nếu lần gửi trước đã thất bại. */
  async push(frame: Uint8Array): Promise<void> {
    if (this.failure) throw this.failure
    if (this.queued >= this.maxQueued) {
      const t0 = performance.now()
      while (this.queued >= this.maxQueued && !this.failure) {
        await new Promise<void>((resolve) => this.waiters.push(resolve))
      }
      this.blockedMs += performance.now() - t0
      if (this.failure) throw this.failure
    }
    this.queued++
    this.tail = this.tail.then(async () => {
      try {
        if (!this.failure) await this.send(frame)
      } catch (err) {
        this.failure ??= err
      } finally {
        this.onSent(frame)
        this.settleOne()
      }
    })
  }

  /** Chờ toàn bộ frame đã xếp hàng được gửi xong; ném lỗi gửi đầu tiên nếu có. */
  async drain(): Promise<void> {
    const t0 = performance.now()
    await this.tail
    this.blockedMs += performance.now() - t0
    if (this.failure) throw this.failure
  }
}
