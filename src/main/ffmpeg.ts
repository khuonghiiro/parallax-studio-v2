import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import ffmpegStatic from 'ffmpeg-static'
import type { ExportResult, ExportStartOptions } from '@shared/ipc'

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

/**
 * Streams raw RGBA frames (bottom-up, as returned by WebGL readPixels) into ffmpeg
 * and encodes an H.264 MP4, optionally muxing an audio track.
 */
export class FfmpegEncoder {
  private proc: ChildProcessWithoutNullStreams
  private stderrTail = ''
  private exited: Promise<number | null>
  private doneCallbacks: Array<() => void> = []
  private cancelled = false

  constructor(
    private opts: ExportStartOptions,
    audioPath?: string
  ) {
    const { width, height, fps, crf, preset, outPath, audio } = opts
    const args = [
      '-y',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', `${width}x${height}`,
      '-r', String(fps),
      '-i', 'pipe:0'
    ]
    if (audioPath && audio) {
      if (audio.offset < 0) args.push('-ss', String(-audio.offset))
      args.push('-i', audioPath)
    }
    args.push(
      '-vf', 'vflip',
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', String(crf),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart'
    )
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
    const expected = this.opts.width * this.opts.height * 4
    if (frame.byteLength !== expected) {
      throw new Error(`Frame size mismatch: got ${frame.byteLength}, expected ${expected}`)
    }
    if (this.proc.exitCode !== null) throw new Error(`ffmpeg exited early:\n${this.stderrTail}`)
    const ok = this.proc.stdin.write(Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength))
    if (!ok) {
      await new Promise<void>((resolve) => this.proc.stdin.once('drain', () => resolve()))
    }
  }

  async finish(): Promise<ExportResult> {
    this.proc.stdin.end()
    const code = await this.exited
    if (this.cancelled) return { ok: false, error: 'Cancelled' }
    if (code === 0) return { ok: true, outPath: this.opts.outPath }
    return { ok: false, error: `ffmpeg exited with code ${code}\n${this.stderrTail}` }
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
