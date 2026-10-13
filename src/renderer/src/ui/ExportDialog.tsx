import { useEffect, useRef, useState } from 'react'
import type { ExportStartOptions } from '@shared/ipc'
import { exportSize, runExport } from '../export/runExport'
import { getProjectAudioTracks } from '../project/audioTracks'
import { useEditor } from '../store/editor'
import { IconExport, IconFolder, IconX } from './icons'
import { Row, Select, Switch } from './controls'

type Phase = 'setup' | 'rendering' | 'done' | 'error'

const HEIGHTS: { label: string; h: number | 'comp' }[] = [
  { label: 'Theo composition', h: 'comp' },
  { label: '720p (HD)', h: 720 },
  { label: '1080p (Full HD)', h: 1080 },
  { label: '1440p (QHD 2K)', h: 1440 },
  { label: '2160p (4K Ultra HD)', h: 2160 }
]

const QUALITY: { label: string; crf: number }[] = [
  { label: 'Cao nhất — Master (CRF 14)', crf: 14 },
  { label: 'Cao — Chuẩn YouTube (CRF 18)', crf: 18 },
  { label: 'Cân bằng (CRF 22)', crf: 22 },
  { label: 'Nhẹ — Xem trước nhanh (CRF 27)', crf: 27 }
]

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project)
  const { comp } = project
  const audioTracks = getProjectAudioTracks(project).filter((t) => !t.muted)
  const hasAudio = audioTracks.length > 0

  const [heightSel, setHeightSel] = useState<number | 'comp'>('comp')
  const [fps, setFps] = useState(comp.fps)
  const [crf, setCrf] = useState(18)
  const [speed, setSpeed] = useState<ExportStartOptions['preset']>('medium')
  const [withAudio, setWithAudio] = useState(hasAudio)
  const [phase, setPhase] = useState<Phase>('setup')
  const [progress, setProgress] = useState({ frame: 0, total: 1, eta: 0, fps: 0 })
  const [error, setError] = useState('')
  const [outPath, setOutPath] = useState('')
  const cancelRef = useRef(false)
  const previewRef = useRef<HTMLCanvasElement>(null)

  const { width: outW, height: outH } = exportSize(project, heightSel === 'comp' ? undefined : heightSel)
  const totalFrames = Math.max(1, Math.round(comp.duration * fps))

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && phase !== 'rendering') {
        e.preventDefault()
        onClose()
      }
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
    const res = await runExport(
      snapshot,
      { outPath: path, height: outH, fps, crf, preset: speed, withAudio: withAudio && hasAudio },
      setProgress,
      () => cancelRef.current,
      previewRef.current
    )
    if (res.cancelled) setPhase('setup')
    else if (res.ok) setPhase('done')
    else {
      setError(res.error ?? 'Lỗi không xác định')
      setPhase('error')
    }
  }

  const pct = Math.round((progress.frame / Math.max(1, progress.total)) * 100)

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && phase !== 'rendering' && onClose()}
    >
      <div className="modal export-modal" role="dialog" aria-labelledby="export-title">
        <div className="modal-head modal-head-row">
          <div className="modal-head-title-group">
            <span className="modal-head-badge">
              <IconExport width={15} height={15} />
            </span>
            <div>
              <h2 id="export-title">Xuất video MP4 (Render Queue)</h2>
              <p>
                H.264 · {outW}×{outH}px · {fps} fps · {comp.duration.toFixed(2)}s ({totalFrames} frame)
              </p>
            </div>
          </div>
          {phase !== 'rendering' && (
            <button type="button" className="btn icon ghost sm modal-close-btn" onClick={onClose} title="Đóng (Esc)">
              <IconX width={14} height={14} />
            </button>
          )}
        </div>

        <div className="modal-body">
          {phase === 'setup' && (
            <>
              <Row label="Độ phân giải">
                <Select
                  id="export-res"
                  value={String(heightSel)}
                  options={HEIGHTS.map((h) => ({ value: String(h.h), label: h.label }))}
                  onChange={(val) => setHeightSel(val === 'comp' ? 'comp' : Number(val))}
                />
              </Row>
              <Row label="Khung hình / giây">
                <Select
                  id="export-fps"
                  value={fps}
                  options={[24, 25, 30, 50, 60].map((f) => ({ value: f, label: `${f} fps` }))}
                  onChange={(val) => setFps(Number(val))}
                />
              </Row>
              <Row label="Chất lượng nén">
                <Select
                  id="export-quality"
                  value={crf}
                  options={QUALITY.map((q) => ({ value: q.crf, label: q.label }))}
                  onChange={(val) => setCrf(Number(val))}
                />
              </Row>
              <Row label="Tốc độ encode">
                <Select
                  id="export-speed"
                  value={speed}
                  options={[
                    { value: 'veryfast', label: 'Nhanh (Veryfast)' },
                    { value: 'medium', label: 'Chuẩn cân bằng (Medium)' },
                    { value: 'slow', label: 'Nén kỹ — File nhẹ (Slow)' }
                  ]}
                  onChange={(val) => setSpeed(val as ExportStartOptions['preset'])}
                />
              </Row>
              <Row label="Kèm âm thanh">
                <Switch on={withAudio && hasAudio} onChange={(v) => hasAudio && setWithAudio(v)} />
                <span className="hint-text">
                  {hasAudio
                    ? `Gộp ${audioTracks.length} luồng âm thanh đang bật`
                    : 'Chưa có luồng âm thanh trong dự án'}
                </span>
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
              {phase === 'done' && <div className="export-done-banner">✓ Đã xuất xong: {outPath}</div>}
            </>
          )}

          {phase === 'error' && <div className="error-box">{error}</div>}
        </div>

        <div className="modal-foot">
          {phase === 'setup' && (
            <>
              <button type="button" className="btn" onClick={onClose}>
                Huỷ
              </button>
              <button type="button" id="export-start" className="btn primary" onClick={run}>
                <IconExport /> Bắt đầu Render MP4
              </button>
            </>
          )}
          {phase === 'rendering' && (
            <button type="button" id="export-cancel" className="btn danger" onClick={() => (cancelRef.current = true)}>
              Dừng Render
            </button>
          )}
          {phase === 'done' && (
            <>
              <button type="button" className="btn" onClick={() => window.api.revealFile(outPath)}>
                <IconFolder /> Mở thư mục chứa file
              </button>
              <button type="button" className="btn primary" onClick={onClose}>
                Hoàn tất
              </button>
            </>
          )}
          {phase === 'error' && (
            <>
              <button type="button" className="btn" onClick={onClose}>
                Đóng
              </button>
              <button type="button" className="btn primary" onClick={() => setPhase('setup')}>
                Thử lại
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

