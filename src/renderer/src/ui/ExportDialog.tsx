import { useEffect, useRef, useState } from 'react'
import type { ExportStartOptions } from '@shared/ipc'
import { SceneRenderer } from '../engine/SceneRenderer'
import { assetStore } from '../project/assets'
import { extForMime } from '../project/serialize'
import { useEditor } from '../store/editor'
import { IconExport, IconFolder } from './icons'
import { Row, Switch } from './controls'

type Phase = 'setup' | 'rendering' | 'done' | 'error'

const HEIGHTS: { label: string; h: number | 'comp' }[] = [
  { label: 'Theo composition', h: 'comp' },
  { label: '720p', h: 720 },
  { label: '1080p (Full HD)', h: 1080 },
  { label: '1440p (QHD)', h: 1440 },
  { label: '2160p (4K)', h: 2160 }
]

const QUALITY: { label: string; crf: number }[] = [
  { label: 'Cao nhất (CRF 14)', crf: 14 },
  { label: 'Cao (CRF 18)', crf: 18 },
  { label: 'Cân bằng (CRF 22)', crf: 22 },
  { label: 'Nhẹ (CRF 27)', crf: 27 }
]

const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2)

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project)
  const { comp } = project
  const [heightSel, setHeightSel] = useState<number | 'comp'>('comp')
  const [fps, setFps] = useState(comp.fps)
  const [crf, setCrf] = useState(18)
  const [speed, setSpeed] = useState<ExportStartOptions['preset']>('medium')
  const [withAudio, setWithAudio] = useState(!!project.audio)
  const [phase, setPhase] = useState<Phase>('setup')
  const [progress, setProgress] = useState({ frame: 0, total: 1, eta: 0, fps: 0 })
  const [error, setError] = useState('')
  const [outPath, setOutPath] = useState('')
  const cancelRef = useRef(false)
  const previewRef = useRef<HTMLCanvasElement>(null)

  const outH = even(heightSel === 'comp' ? comp.height : heightSel)
  const outW = even((outH * comp.width) / comp.height)
  const totalFrames = Math.max(1, Math.round(comp.duration * fps))

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && phase !== 'rendering') onClose()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [phase, onClose])

  const run = async (): Promise<void> => {
    const safeName = (comp.name || 'parallax').replace(/[\\/:*?"<>|]+/g, '_')
    const path = await window.api.chooseExportPath(`${safeName}.mp4`)
    if (!path) return
    setOutPath(path)
    cancelRef.current = false
    setPhase('rendering')

    const snapshot = useEditor.getState().project
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const r = new SceneRenderer(canvas, { preserveDrawingBuffer: true })
    r.setSize(outW, outH)

    let audio: ExportStartOptions['audio']
    if (withAudio && snapshot.audio) {
      const a = assetStore.get(snapshot.audio.assetId)
      if (a)
        audio = {
          data: a.bytes,
          ext: extForMime(a.meta.mime),
          offset: snapshot.audio.offset,
          volume: snapshot.audio.volume,
          duration: totalFrames / fps
        }
    }

    try {
      // Warm-up render so fonts/textures are uploaded before the first real frame.
      await r.waitForContext()
      r.render(snapshot, 0, { frame: 0 })
      await document.fonts.ready
      await r.waitForContext()
      r.render(snapshot, 0, { frame: 0 })

      const start = await window.api.exportStart({ width: outW, height: outH, fps, crf, preset: speed, outPath: path, audio })
      if (!start.ok) throw new Error(start.error)

      const t0 = performance.now()
      const pctx = previewRef.current?.getContext('2d')
      for (let i = 0; i < totalFrames; i++) {
        if (cancelRef.current) {
          await window.api.exportCancel()
          r.dispose()
          setPhase('setup')
          return
        }
        // If the GPU context drops mid-export, wait for it to come back and redo this frame.
        let px: Uint8Array
        let attempts = 0
        for (;;) {
          await r.waitForContext()
          r.render(snapshot, i / fps, { frame: i })
          px = r.readPixels()
          if (!r.isContextLost()) break
          if (++attempts >= 3) throw new Error('GPU liên tục mất context khi xuất video')
        }
        if (pctx && i % 4 === 0) {
          const pc = previewRef.current!
          pctx.drawImage(canvas, 0, 0, pc.width, pc.height)
        }
        await window.api.exportFrame(px)
        const elapsed = (performance.now() - t0) / 1000
        const rate = (i + 1) / elapsed
        setProgress({ frame: i + 1, total: totalFrames, fps: rate, eta: (totalFrames - i - 1) / rate })
      }
      const res = await window.api.exportFinish()
      r.dispose()
      if (!res.ok) throw new Error(res.error)
      setPhase('done')
    } catch (err) {
      r.dispose()
      await window.api.exportCancel()
      setError(String(err instanceof Error ? err.message : err))
      setPhase('error')
    }
  }

  const pct = Math.round((progress.frame / progress.total) * 100)

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && phase !== 'rendering' && onClose()}>
      <div className="modal" role="dialog" aria-labelledby="export-title">
        <div className="modal-head">
          <h2 id="export-title">Xuất video MP4</h2>
          <p>
            H.264 · {outW}×{outH} · {fps} fps · {comp.duration.toFixed(2)}s ({totalFrames} frame)
          </p>
        </div>

        <div className="modal-body">
          {phase === 'setup' && (
            <>
              <Row label="Độ phân giải">
                <select id="export-res" className="select" value={String(heightSel)} onChange={(e) => setHeightSel(e.target.value === 'comp' ? 'comp' : Number(e.target.value))}>
                  {HEIGHTS.map((h) => (
                    <option key={h.label} value={String(h.h)}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="FPS">
                <select id="export-fps" className="select" value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                  {[24, 25, 30, 50, 60].map((f) => (
                    <option key={f} value={f}>
                      {f} fps
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Chất lượng">
                <select id="export-quality" className="select" value={crf} onChange={(e) => setCrf(Number(e.target.value))}>
                  {QUALITY.map((q) => (
                    <option key={q.crf} value={q.crf}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Tốc độ encode">
                <select id="export-speed" className="select" value={speed} onChange={(e) => setSpeed(e.target.value as ExportStartOptions['preset'])}>
                  <option value="veryfast">Nhanh</option>
                  <option value="medium">Trung bình</option>
                  <option value="slow">Chậm (file nhỏ hơn)</option>
                </select>
              </Row>
              <Row label="Kèm nhạc nền">
                <Switch on={withAudio && !!project.audio} onChange={(v) => setWithAudio(v)} />
                {!project.audio && <span className="hint-text">Chưa có nhạc nền</span>}
              </Row>
            </>
          )}

          {(phase === 'rendering' || phase === 'done') && (
            <>
              <div className="export-preview">
                <canvas ref={previewRef} width={480} height={Math.round((480 * outH) / outW)} />
              </div>
              <div className="progress">
                <div style={{ width: `${phase === 'done' ? 100 : pct}%` }} />
              </div>
              <div className="stat-row">
                <span>
                  {progress.frame}/{progress.total} frame · {pct}%
                </span>
                <span>
                  {progress.fps.toFixed(1)} fps · còn {phase === 'done' ? 0 : Math.ceil(progress.eta)}s
                </span>
              </div>
              {phase === 'done' && <div style={{ color: 'var(--ok)' }}>✓ Đã xuất xong: {outPath}</div>}
            </>
          )}

          {phase === 'error' && <div className="error-box">{error}</div>}
        </div>

        <div className="modal-foot">
          {phase === 'setup' && (
            <>
              <button className="btn" onClick={onClose}>
                Huỷ
              </button>
              <button id="export-start" className="btn primary" onClick={run}>
                <IconExport /> Xuất video
              </button>
            </>
          )}
          {phase === 'rendering' && (
            <button id="export-cancel" className="btn" onClick={() => (cancelRef.current = true)}>
              Dừng
            </button>
          )}
          {phase === 'done' && (
            <>
              <button className="btn" onClick={() => window.api.revealFile(outPath)}>
                <IconFolder /> Mở thư mục
              </button>
              <button className="btn primary" onClick={onClose}>
                Xong
              </button>
            </>
          )}
          {phase === 'error' && (
            <>
              <button className="btn" onClick={onClose}>
                Đóng
              </button>
              <button className="btn primary" onClick={() => setPhase('setup')}>
                Thử lại
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
