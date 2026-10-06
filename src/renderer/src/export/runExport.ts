import type { ExportStartOptions } from '@shared/ipc'
import type { Project } from '@shared/types'
import { SceneRenderer } from '../engine/SceneRenderer'
import { assetStore } from '../project/assets'
import { getProjectAudioTracks, mixAudioTracksToWav } from '../project/audioTracks'
import { extForMime } from '../project/serialize'

export interface ExportOptions {
  outPath: string
  /** Output height (width follows the comp aspect). Default = comp height. */
  height?: number
  fps?: number
  crf?: number
  preset?: ExportStartOptions['preset']
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

export interface ExportOutcome {
  ok: boolean
  cancelled?: boolean
  error?: string
  outPath: string
  frames: number
  seconds: number
}

const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2)

export function exportSize(project: Project, height?: number): { width: number; height: number } {
  const h = even(height ?? project.comp.height)
  return { width: even((h * project.comp.width) / project.comp.height), height: h }
}

let running = false
export const isExporting = (): boolean => running

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
  const fps = opts.fps ?? project.comp.fps
  const { width, height } = exportSize(project, opts.height)
  const start = Math.max(0, opts.start ?? 0)
  const end = Math.min(project.comp.duration, opts.end ?? project.comp.duration)
  const total = Math.max(1, Math.round((end - start) * fps))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const r = new SceneRenderer(canvas, { preserveDrawingBuffer: true })
  r.setSize(width, height)
  const t0 = performance.now()

  try {
    let audio: ExportStartOptions['audio']
    if (opts.withAudio ?? true) {
      const tracks = getProjectAudioTracks(project)
      if (tracks.length > 1) {
        const wavData = await mixAudioTracksToWav(tracks, total / fps, start)
        if (wavData) {
          audio = {
            data: wavData,
            ext: 'wav',
            offset: 0,
            volume: 1,
            duration: total / fps
          }
        }
      } else if (tracks.length === 1) {
        const tr = tracks[0]
        const a = assetStore.get(tr.assetId)
        const data = await assetStore.getBytes(tr.assetId)
        if (a && data) {
          audio = {
            data,
            ext: extForMime(a.meta.mime),
            offset: tr.offset - start,
            volume: tr.volume,
            duration: total / fps
          }
        }
      }
    }

    // Warm-up so fonts and first-frame textures are ready.
    await r.waitForContext()
    await document.fonts.ready
    await r.prepare(project, start, height)
    r.render(project, start, { frame: 0 })

    const started = await window.api.exportStart({
      width,
      height,
      fps,
      crf: opts.crf ?? 18,
      preset: opts.preset ?? 'medium',
      outPath: opts.outPath,
      audio
    })
    if (!started.ok) throw new Error(started.error)

    const pctx = preview?.getContext('2d')
    for (let i = 0; i < total; i++) {
      if (isCancelled()) {
        await window.api.exportCancel()
        return { ok: false, cancelled: true, outPath: opts.outPath, frames: i, seconds: (performance.now() - t0) / 1000 }
      }
      const t = start + i / fps
      // If the GPU context drops mid-export, wait for it to come back and redo this frame.
      let px: Uint8Array
      let attempts = 0
      for (;;) {
        await r.waitForContext()
        await r.prepare(project, t, height)
        r.render(project, t, { frame: i, prefetch: true })
        px = r.readPixels()
        if (!r.isContextLost()) break
        if (++attempts >= 3) throw new Error('GPU liên tục mất context khi xuất video')
      }
      if (pctx && preview && i % 4 === 0) pctx.drawImage(canvas, 0, 0, preview.width, preview.height)
      await window.api.exportFrame(px)
      const elapsed = (performance.now() - t0) / 1000
      const rate = (i + 1) / elapsed
      onProgress({ frame: i + 1, total, fps: rate, eta: (total - i - 1) / rate })
    }
    const res = await window.api.exportFinish()
    if (!res.ok) throw new Error(res.error)
    return { ok: true, outPath: opts.outPath, frames: total, seconds: (performance.now() - t0) / 1000 }
  } catch (err) {
    await window.api.exportCancel()
    return {
      ok: false,
      error: String(err instanceof Error ? err.message : err),
      outPath: opts.outPath,
      frames: 0,
      seconds: (performance.now() - t0) / 1000
    }
  } finally {
    r.dispose()
    running = false
  }
}
