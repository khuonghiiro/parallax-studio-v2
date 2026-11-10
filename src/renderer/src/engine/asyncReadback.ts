/**
 * Đọc pixel khung hình bất đồng bộ bằng Pixel Buffer Object (PBO) + fence của WebGL2.
 *
 * `gl.readPixels` thường bắt CPU đứng chờ GPU vẽ xong rồi mới copy (pipeline stall). Ở đây lệnh đọc
 * được xếp hàng vào PBO ngay sau khi vẽ, CPU tiếp tục dựng các frame kế tiếp; chỉ khi fence báo GPU
 * đã copy xong mới lấy dữ liệu ra bằng `getBufferSubData` (không còn chờ GPU).
 */

interface ReadbackSlot {
  pbo: WebGLBuffer
  sync: WebGLSync | null
  tag: number
}

const yieldChannel = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null
const yieldWaiters: Array<() => void> = []
if (yieldChannel) {
  yieldChannel.port1.onmessage = () => yieldWaiters.shift()?.()
}

/** Nhường vòng lặp sự kiện 1 nhịp (macrotask) — trạng thái fence WebGL chỉ cập nhật giữa các task. */
export function yieldMacrotask(): Promise<void> {
  if (!yieldChannel) return new Promise((resolve) => setTimeout(resolve, 0))
  return new Promise((resolve) => {
    yieldWaiters.push(resolve)
    yieldChannel.port2.postMessage(0)
  })
}

export class AsyncFrameReadback {
  private readonly free: ReadbackSlot[] = []
  private readonly pending: ReadbackSlot[] = []
  private readonly byteLength: number
  private disposed = false
  private invalidated = false
  private readonly onContextLost = (): void => { this.invalidated = true }

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly width: number,
    readonly height: number,
    slots = 3
  ) {
    this.byteLength = width * height * 4
    for (let i = 0; i < Math.max(1, slots); i++) {
      const pbo = gl.createBuffer()
      if (!pbo) throw new Error('Không tạo được Pixel Buffer Object')
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo)
      gl.bufferData(gl.PIXEL_PACK_BUFFER, this.byteLength, gl.STREAM_READ)
      this.free.push({ pbo, sync: null, tag: -1 })
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    gl.canvas.addEventListener('webglcontextlost', this.onContextLost)
  }

  get invalid(): boolean { return this.invalidated || this.gl.isContextLost() || this.disposed }

  get pendingCount(): number {
    return this.pending.length
  }

  get hasFreeSlot(): boolean {
    return this.free.length > 0
  }

  /** Xếp hàng lệnh copy framebuffer hiện tại vào PBO (không chờ GPU). `tag` = số thứ tự frame. */
  capture(tag: number): void {
    const slot = this.free.pop()
    if (!slot) throw new Error('AsyncFrameReadback: hết slot trống, hãy lấy frame cũ ra trước')
    const gl = this.gl
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.pbo)
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, 0)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    slot.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
    slot.tag = tag
    gl.flush()
    this.pending.push(slot)
  }

  private isSignaled(sync: WebGLSync): boolean {
    const gl = this.gl
    const status = gl.clientWaitSync(sync, 0, 0)
    if (status === gl.WAIT_FAILED && !this.invalid) throw new Error('GPU không thể chờ fence đọc pixel')
    return status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED
  }

  /**
   * Lấy frame cũ nhất đã xếp hàng vào `out` (RGBA, hàng từ dưới lên). Trả về `tag` của frame,
   * hoặc `null` nếu GL context bị mất trong lúc chờ (người gọi cần dựng lại frame).
   */
  async takeOldest(out: Uint8Array, isCancelled: () => boolean = () => false): Promise<number | null> {
    const slot = this.pending[0]
    if (!slot) throw new Error('AsyncFrameReadback: không có frame nào đang chờ')
    const gl = this.gl
    if (this.invalid || isCancelled()) return null
    if (!slot.sync) throw new Error('GPU không tạo được fence đọc pixel')
    const started = performance.now()
    while (slot.sync && !this.isSignaled(slot.sync)) {
      if (this.invalid || isCancelled()) return null
      if (performance.now() - started > 30000) throw new Error('GPU quá hạn trả frame (30 giây)')
      await yieldMacrotask()
    }
    if (this.invalid || isCancelled()) return null
    if (out.byteLength !== this.byteLength) throw new Error('AsyncFrameReadback: sai kích thước buffer đích')
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, slot.pbo)
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out)
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
    if (slot.sync) gl.deleteSync(slot.sync)
    slot.sync = null
    this.pending.shift()
    this.free.push(slot)
    return slot.tag
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    gl.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    if (!this.invalidated && !gl.isContextLost()) for (const slot of [...this.free, ...this.pending]) {
      if (slot.sync) gl.deleteSync(slot.sync)
      gl.deleteBuffer(slot.pbo)
    }
    this.free.length = 0
    this.pending.length = 0
  }
}
