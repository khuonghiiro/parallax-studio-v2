import type { ExportEncoderPreference, ExportPixelFormat, ExportStartOptions } from '@shared/ipc'
import type { Project } from '@shared/types'
import { SceneRenderer } from '../engine/SceneRenderer'
import type { AsyncFrameReadback } from '../engine/asyncReadback'
import { assetStore } from '../project/assets'
import { getProjectAudioTracks, mixAudioTracksToWav } from '../project/audioTracks'
import { extForMime } from '../project/serialize'
import { FrameBufferPool, FrameSendQueue } from './frameSendQueue'
import { ExportFrameOutput } from './exportFrameOutput'

export interface ExportOptions {
  outPath: string
  /** Output height (width follows the comp aspect). Default = comp height. */
  height?: number
  fps?: number
  crf?: number
  preset?: ExportStartOptions['preset']
  /** Bộ mã hoá: `auto` = GPU (NVENC / Quick Sync / AMF) nếu có, không thì CPU x264. */
  encoder?: ExportEncoderPreference
  /** Cách đọc pixel: `async` (mặc định, PBO + fence) hoặc `sync` (readPixels đồng bộ — để đối chiếu hiệu năng). */
  readback?: 'async' | 'sync'
  pixelFormat?: 'auto' | ExportPixelFormat
  withAudio?: boolean
  /** Export only [start, end) seconds. */
  start?: number
  end?: number
}

export interface ExportProgress {
  frame: number
  total: number
  fps: number
  eta: number
}

/** Tổng thời gian (ms) renderer dành cho từng bước — dùng để tìm nút thắt khi xuất video. */
export interface ExportTimings {
  /** Chờ giải mã / nạp texture cho frame. */
  prepareMs: number
  /** Dựng cảnh và gửi lệnh vẽ lên GPU. */
  renderMs: number
  /** Chờ GPU trả pixel về CPU. */
  readbackMs: number
  /** Xếp lệnh copy framebuffer vào PBO (chế độ bất đồng bộ). */
  captureMs: number
  /** Đứng chờ vì encoder (ffmpeg) chưa nhận kịp frame. */
  sendWaitMs: number
  /** `true` khi dùng PBO bất đồng bộ (WebGL2), `false` khi phải đọc pixel đồng bộ. */
  asyncReadback: boolean
}

export interface ExportOutcome {
  ok: boolean
  cancelled?: boolean
  error?: string
  outPath: string
  frames: number
  seconds: number
  /** Encoder thực tế ffmpeg đã dùng (ví dụ `h264_qsv`, `libx264`). */
  encoder?: string
  pixelFormat?: ExportPixelFormat
  timings?: ExportTimings
}

/** Số frame GPU được phép dựng trước khi CPU lấy pixel ra (độ sâu pipeline PBO). */
const READBACK_SLOTS = 3
/** Số frame tối đa nằm chờ gửi sang encoder. */
const MAX_QUEUED_FRAMES = 3
/** Cập nhật ảnh xem trước mỗi N frame (drawImage từ canvas WebGL cũng tốn băng thông GPU). */
const PREVIEW_EVERY = 8

const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2)

export function exportSize(project: Project, height?: number): { width: number; height: number } {
  const h = even(height ?? project.comp.height)
  return { width: even((h * project.comp.width) / project.comp.height), height: h }
}

let running = false
export const isExporting = (): boolean => running

async function resolveExportAudio(
  project: Project,
  duration: number,
  start: number
): Promise<ExportStartOptions['audio']> {
  const tracks = getProjectAudioTracks(project)
  if (tracks.length > 1) {
    const wavData = await mixAudioTracksToWav(tracks, duration, start)
    return wavData ? { data: wavData, ext: 'wav', offset: 0, volume: 1, duration } : undefined
  }
  if (tracks.length === 1) {
    const tr = tracks[0]
    const a = assetStore.get(tr.assetId)
    const data = await assetStore.getBytes(tr.assetId)
    if (a && data) {
      return { data, ext: extForMime(a.meta.mime), offset: tr.offset - start, volume: tr.volume, duration }
    }
  }
  return undefined
}

interface FrameLoop {
  output: ExportFrameOutput
  r: SceneRenderer
  project: Project
  canvas: HTMLCanvasElement
  start: number
  fps: number
  total: number
  height: number
  t0: number
  preview?: HTMLCanvasElement | null
  onProgress: (p: ExportProgress) => void
  isCancelled: () => boolean
  timings: ExportTimings
  useAsyncReadback: boolean
}

/** Nạp texture rồi vẽ frame `i` lên canvas (chưa đọc pixel). */
async function renderFrame(loop: FrameLoop, i: number): Promise<void> {
  const t = loop.start + i / loop.fps
  const s0 = performance.now()
  await loop.r.waitForContext()
  await loop.r.prepare(loop.project, t, loop.height)
  const s1 = performance.now()
  loop.r.render(loop.project, t, { frame: i, prefetch: true, target: loop.output.target })
  loop.output.pack()
  loop.timings.prepareMs += s1 - s0
  loop.timings.renderMs += performance.now() - s1
}

function drawPreview(loop: FrameLoop, i: number): void {
  const pv = loop.preview
  if (!pv || i % PREVIEW_EVERY !== 0) return
  loop.output.present()
  pv.getContext('2d')?.drawImage(loop.canvas, 0, 0, pv.width, pv.height)
}

function reportProgress(loop: FrameLoop, done: number): void {
  const elapsed = (performance.now() - loop.t0) / 1000
  const rate = done / Math.max(1e-3, elapsed)
  loop.onProgress({ frame: done, total: loop.total, fps: rate, eta: (loop.total - done) / rate })
}

/**
 * Vòng lặp xuất frame dạng pipeline: GPU dựng trước tối đa `READBACK_SLOTS` frame, pixel được đọc
 * bất đồng bộ qua PBO và gửi sang ffmpeg trong nền theo đúng thứ tự. Nếu GL context bị mất, dựng lại
 * từ frame đầu tiên chưa gửi. Trả về số frame đã gửi, `cancelled` nếu người dùng dừng.
 */
async function encodeFrames(loop: FrameLoop): Promise<{ frames: number; cancelled: boolean }> {
  const { r } = loop
  const pool = new FrameBufferPool(loop.output.byteLength)
  const queue = new FrameSendQueue((f) => window.api.exportFrame(f), MAX_QUEUED_FRAMES, (f) => pool.release(f))
  const createReadback = (): AsyncFrameReadback | null => loop.useAsyncReadback
    ? r.createFrameReadback(READBACK_SLOTS, loop.output.readWidth, loop.output.readHeight) : null
  let readback = createReadback()
  loop.timings.asyncReadback = !!readback
  let next = 0
  let done = 0
  let retries = 0

  const recover = async (): Promise<void> => {
    if (++retries > 3) throw new Error('GPU liên tục mất context khi xuất video')
    readback?.dispose()
    await r.waitForContext()
    loop.output.recover()
    readback = createReadback()
    next = done
  }
  const deliver = async (buf: Uint8Array): Promise<void> => {
    retries = 0
    await queue.push(buf)
    done++
    reportProgress(loop, done)
  }

  try {
    while (done < loop.total) {
      if (loop.isCancelled()) return { frames: done, cancelled: true }
      if (next < loop.total && (!readback || readback.hasFreeSlot)) {
        await renderFrame(loop, next)
        if (r.isContextLost() || readback?.invalid) {
          await recover()
          continue
        }
        if (readback) {
          const c0 = performance.now()
          readback.capture(next)
          loop.timings.captureMs += performance.now() - c0
          drawPreview(loop, next++)
          continue
        }
        const s = performance.now()
        const buf = loop.output.read(pool.acquire())
        loop.timings.readbackMs += performance.now() - s
        if (r.isContextLost()) {
          pool.release(buf)
          await recover()
          continue
        }
        drawPreview(loop, next++)
        await deliver(buf)
        continue
      }
      const buf = pool.acquire()
      const s = performance.now()
      const tag = readback ? await readback.takeOldest(buf, loop.isCancelled) : null
      loop.timings.readbackMs += performance.now() - s
      if (tag === null || r.isContextLost()) {
        pool.release(buf)
        if (loop.isCancelled()) return { frames: done, cancelled: true }
        await recover()
        continue
      }
      await deliver(buf)
    }
    await queue.drain()
    return { frames: done, cancelled: false }
  } finally {
    readback?.dispose()
    // Không để frame cũ còn chạy qua IPC sau khi phiên xuất đã kết thúc hoặc bị huỷ.
    try { await queue.drain() } finally { loop.timings.sendWaitMs += queue.blockedMs }
  }
}

/**
 * Render a project frame-by-frame into an MP4 through the main-process FFmpeg pipe.
 * Deterministic: every frame awaits `prepare()` so all textures it needs are resident
 * at full quality before it is drawn (streaming never shows placeholders in exports).
 */
export async function runExport(
  project: Project,
  opts: ExportOptions,
  onProgress: (p: ExportProgress) => void = () => undefined,
  isCancelled: () => boolean = () => false,
  preview?: HTMLCanvasElement | null
): Promise<ExportOutcome> {
  if (running) throw new Error('Đang có một tiến trình xuất video khác')
  running = true
  const began = performance.now()
  try {
    return await runExportSession(project, opts, onProgress, isCancelled, preview)
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err), outPath: opts.outPath,
      frames: 0, seconds: (performance.now() - began) / 1000 }
  } finally {
    running = false
  }
}

function createExportSetup(project: Project, opts: ExportOptions) {
  const fps = opts.fps ?? project.comp.fps
  const { width, height } = exportSize(project, opts.height)
  const start = Math.max(0, opts.start ?? 0)
  const end = Math.min(project.comp.duration, opts.end ?? project.comp.duration)
  const total = Math.max(1, Math.round((end - start) * fps))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const r = new SceneRenderer(canvas, { preserveDrawingBuffer: true })
  try { r.setSize(width, height) } catch (err) { r.dispose(); throw err }
  const t0 = performance.now()
  const timings: ExportTimings = {
    prepareMs: 0,
    renderMs: 0,
    readbackMs: 0,
    captureMs: 0,
    sendWaitMs: 0,
    asyncReadback: false
  }
  return { fps, width, height, start, total, canvas, r, t0, timings }
}

async function runExportSession(
  project: Project, opts: ExportOptions, onProgress: (p: ExportProgress) => void,
  isCancelled: () => boolean, preview?: HTMLCanvasElement | null
): Promise<ExportOutcome> {
  const { fps, width, height, start, total, canvas, r, t0, timings } = createExportSetup(project, opts)
  const elapsed = (): number => (performance.now() - t0) / 1000
  let output: ExportFrameOutput | undefined

  try {
    const audio = (opts.withAudio ?? true) ? await resolveExportAudio(project, total / fps, start) : undefined

    // Warm-up so fonts and first-frame textures are ready.
    await r.waitForContext()
    await document.fonts.ready
    await r.prepare(project, start, height)
    r.render(project, start, { frame: 0 })
    output = new ExportFrameOutput(r, width, height, opts.pixelFormat)

    const started = await window.api.exportStart({
      width,
      height,
      fps,
      crf: opts.crf ?? 18,
      preset: opts.preset ?? 'medium',
      encoder: opts.encoder ?? 'auto',
      pixelFormat: output.pixelFormat,
      outPath: opts.outPath,
      audio
    })
    if (!started.ok) throw new Error(started.error)
    const encoder = started.encoder
    // Main cũ/remote cũ có thể chỉ nhận RGBA: dùng đúng định dạng mà bên nhận xác nhận.
    if (output.pixelFormat !== (started.pixelFormat ?? 'rgba')) {
      output.dispose()
      output = new ExportFrameOutput(r, width, height, 'rgba')
    }
    const pixelFormat = output.pixelFormat

    const loop: FrameLoop = {
      r, output, project, canvas, start, fps, total, height, t0, preview, onProgress, isCancelled, timings,
      useAsyncReadback: opts.readback !== 'sync'
    }
    const { frames, cancelled } = await encodeFrames(loop)
    if (cancelled) {
      await window.api.exportCancel()
      return { ok: false, cancelled: true, outPath: opts.outPath, frames, seconds: elapsed(), encoder, pixelFormat, timings }
    }
    const res = await window.api.exportFinish()
    if (!res.ok) throw new Error(res.error)
    return { ok: true, outPath: opts.outPath, frames: total, seconds: elapsed(), encoder, pixelFormat, timings }
  } catch (err) {
    await window.api.exportCancel()
    return {
      ok: false,
      error: String(err instanceof Error ? err.message : err),
      outPath: opts.outPath,
      frames: 0,
      seconds: elapsed(),
      timings
    }
  } finally {
    output?.dispose()
    r.dispose()
  }
}
