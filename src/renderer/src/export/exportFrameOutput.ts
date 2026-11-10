import type { ExportPixelFormat } from '@shared/ipc'
import type { SceneRenderer } from '../engine/SceneRenderer'
import { supportsYuvPacking, YuvPacker } from '../engine/yuvPacker'

/** Định dạng được chọn một lần trước exportStart; không đổi giữa một luồng rawvideo. */
export class ExportFrameOutput {
  private packer: YuvPacker | null = null

  constructor(
    private readonly scene: SceneRenderer,
    readonly width: number,
    readonly height: number,
    preference: 'auto' | ExportPixelFormat = 'auto'
  ) {
    if (preference === 'rgba' || !supportsYuvPacking(width, height)) return
    const candidate = new YuvPacker(width, height)
    if (candidate.validate(scene.webglRenderer)) this.packer = candidate
    else candidate.dispose()
  }

  get pixelFormat(): ExportPixelFormat { return this.packer ? 'yuv420p' : 'rgba' }
  get target() { return this.packer?.frameTarget }
  get readWidth(): number { return this.packer?.packedWidth ?? this.width }
  get readHeight(): number { return this.packer?.packedHeight ?? this.height }
  get byteLength(): number { return this.readWidth * this.readHeight * 4 }

  pack(): void { this.packer?.pack(this.scene.webglRenderer) }

  read(out: Uint8Array): Uint8Array {
    if (!this.packer) return this.scene.readPixels(out)
    this.scene.webglRenderer.readRenderTargetPixels(
      this.packer.packedTarget, 0, 0, this.readWidth, this.readHeight, out
    )
    return out
  }

  present(): void {
    if (this.packer) this.scene.presentTarget(this.packer.frameTarget)
  }

  /** Sau context loss, Three.js dựng lại tài nguyên; shader phải qua kiểm tra lần nữa. */
  recover(): void {
    if (this.packer && !this.packer.validate(this.scene.webglRenderer)) {
      throw new Error('Không khôi phục được GPU YUV; hãy xuất lại bằng RGBA')
    }
  }

  dispose(): void { this.packer?.dispose() }
}
