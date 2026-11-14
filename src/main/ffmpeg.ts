import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import ffmpegStatic from 'ffmpeg-static'
import type { ExportResult, ExportStartOptions, ExportVideoEncoder } from '@shared/ipc'
import { resolveVideoEncoder, videoCodecArgs } from './ffmpegEncoders'
import { rgbaToYuv420pRust } from './pxsNativeAccel'

/** Resolve the ffmpeg binary from env, local project bin, ffmpeg-static, or system PATH. */
export function ffmpegPath(): string {
  if (process.env.FFMPEG_BIN && existsSync(process.env.FFMPEG_BIN)) {
    return process.env.FFMPEG_BIN
  }
  const binName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const localBin = join(process.cwd(), 'bin', binName)
  if (existsSync(localBin)) {
    return localBin
  }
  const staticPath = (ffmpegStatic as unknown as string)
  if (staticPath) {
    const unpacked = staticPath.replace('app.asar', 'app.asar.unpacked')
    if (existsSync(unpacked)) {
      return unpacked
    }
  }
  return 'ffmpeg'
}

/** Số byte mỗi frame thô theo định dạng điểm ảnh gửi sang ffmpeg. */
export function frameByteLength(opts: Pick<ExportStartOptions, 'width' | 'height' | 'pixelFormat'>): number {
  const px = opts.width * opts.height
  return opts.pixelFormat === 'yuv420p' ? (px * 3) / 2 : px * 4
}

/**
 * Streams raw RGBA frames (bottom-up, as returned by WebGL readPixels) into ffmpeg
 * and encodes an H.264 MP4, optionally muxing an audio track.
 * `vflip` của ffmpeg chỉ đảo con trỏ dòng (zero-copy) nên không tốn thêm CPU.
 */
export class FfmpegEncoder {
  private proc: ChildProcessWithoutNullStreams
  private stderrTail = ''
  private exited: Promise<number | null>
  private doneCallbacks: Array<() => void> = []
  private cancelled = false
  private readonly cpuYuvFallback: boolean

  /** Chọn encoder theo `opts.encoder` (GPU nếu chạy được, không thì libx264) rồi khởi động ffmpeg. */
  static async create(opts: ExportStartOptions, audioPath?: string): Promise<FfmpegEncoder> {
    const videoEncoder = await resolveVideoEncoder(ffmpegPath(), opts.encoder, opts.width, opts.height)
    return new FfmpegEncoder(opts, audioPath, videoEncoder)
  }

  constructor(
    private opts: ExportStartOptions,
    audioPath?: string,
    readonly videoEncoder: ExportVideoEncoder = 'libx264'
  ) {
    const { width, height, fps, crf, preset, outPath, audio } = opts
    this.cpuYuvFallback = Boolean(
      opts.cpuYuvFallback &&
        opts.pixelFormat !== 'yuv420p' &&
        width % 2 === 0 &&
        height % 2 === 0
    )
    const yuv = opts.pixelFormat === 'yuv420p' || this.cpuYuvFallback
    const args = [
      '-y',
      '-f', 'rawvideo',
      '-pix_fmt', yuv ? 'yuv420p' : 'rgba',
      '-s', `${width}x${height}`,
      '-r', String(fps),
      '-i', 'pipe:0'
    ]
    if (audioPath && audio) {
      if (audio.offset < 0) args.push('-ss', String(-audio.offset))
      args.push('-i', audioPath)
    }
    // Frame RGBA đọc từ WebGL là hàng từ dưới lên → cần vflip; YUV420p đã được GPU sắp xếp từ trên xuống.
    if (!yuv) args.push('-vf', 'vflip')
    args.push(...videoCodecArgs(videoEncoder, preset, crf), '-movflags', '+faststart')
    if (audioPath && audio) {
      const filters: string[] = []
      if (audio.offset > 0) filters.push(`adelay=${Math.round(audio.offset * 1000)}:all=1`)
      filters.push(`volume=${audio.volume.toFixed(3)}`, 'apad')
      args.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k')
      args.push('-af', filters.join(','))
      args.push('-t', audio.duration.toFixed(3))
    }
    args.push(outPath)

    this.proc = spawn(ffmpegPath(), args, { windowsHide: true })
    this.proc.stderr.on('data', (d: Buffer) => {
      this.stderrTail = (this.stderrTail + d.toString()).slice(-4000)
    })
    this.proc.stdin.on('error', () => undefined)
    this.exited = new Promise((resolve) => {
      this.proc.on('error', (err) => {
        this.stderrTail += `\n${String(err)}`
        resolve(-1)
      })
      this.proc.on('close', (code) => {
        this.doneCallbacks.forEach((cb) => cb())
        resolve(code)
      })
    })
  }

  onDone(cb: () => void): void {
    this.doneCallbacks.push(cb)
  }

  async writeFrame(frame: Uint8Array): Promise<void> {
    const expected = frameByteLength(this.opts)
    if (frame.byteLength !== expected) {
      throw new Error(`Frame size mismatch: got ${frame.byteLength}, expected ${expected}`)
    }
    if (this.proc.exitCode !== null) throw new Error(`ffmpeg exited early:\n${this.stderrTail}`)
    const out = this.cpuYuvFallback
      ? rgbaToYuv420pRust(frame, this.opts.width, this.opts.height, true)
      : frame
    const ok = this.proc.stdin.write(Buffer.from(out.buffer, out.byteOffset, out.byteLength))
    if (!ok) await this.waitDrain()
  }

  /** Chờ pipe stdin rút hết dữ liệu; báo lỗi (thay vì treo vĩnh viễn) nếu ffmpeg thoát giữa chừng. */
  private waitDrain(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        this.proc.stdin.off('drain', onDrain)
        this.proc.stdin.off('error', onFail)
        this.proc.off('close', onFail)
      }
      const onDrain = (): void => {
        cleanup()
        resolve()
      }
      const onFail = (): void => {
        cleanup()
        reject(new Error(`ffmpeg exited early:\n${this.stderrTail}`))
      }
      this.proc.stdin.once('drain', onDrain)
      this.proc.stdin.once('error', onFail)
      this.proc.once('close', onFail)
    })
  }

  async finish(): Promise<ExportResult> {
    this.proc.stdin.end()
    const code = await this.exited
    if (this.cancelled) return { ok: false, error: 'Cancelled' }
    if (code === 0) return { ok: true, outPath: this.opts.outPath }
    return { ok: false, error: `ffmpeg (${this.videoEncoder}) exited with code ${code}\n${this.stderrTail}` }
  }

  cancel(): void {
    this.cancelled = true
    try {
      this.proc.stdin.destroy()
      this.proc.kill('SIGKILL')
    } catch {
      /* already gone */
    }
  }
}
