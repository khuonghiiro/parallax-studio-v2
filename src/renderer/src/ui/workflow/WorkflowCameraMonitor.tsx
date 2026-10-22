import React, { useEffect, useState } from 'react'
import type { Project, WorkflowNode } from '@shared/types'
import { useEditor } from '../../store/editor'
import { shotAtTime } from '../../animation/cameraPath'
import { useWorkflowCameraPreview } from './useWorkflowCameraPreview'
import { getNodePreviewTime } from './workflowPreviewTime'

export const WorkflowCameraMonitor = React.memo(function WorkflowCameraMonitor({ project, node }: { project: Project; node: WorkflowNode }) {
  const [time, setTime] = useState(() => getNodePreviewTime(project, node, useEditor.getState().time))
  const [playing, setPlaying] = useState(false)
  const duration = Math.max(0, project.comp.duration)
  const { mountRef, error, loading } = useWorkflowCameraPreview(project, time, playing)
  const shotId = shotAtTime(project, time)
  const shotName = project.shots.find((shot) => shot.id === shotId)?.name ?? 'Toàn cảnh'
  useEffect(() => { setTime((value) => Math.min(value, duration)) }, [duration])
  useEffect(() => {
    if (!playing || duration <= 0) return
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const delta = Math.min((now - last) / 1000, 0.15)
      last = now
      setTime((value) => (value + delta) % duration)
    }, 1000 / 30)
    return () => window.clearInterval(timer)
  }, [playing, duration])
  return (
    <section className="wf-camera-preview" data-mcp-region="workflow_node_camera_preview" aria-label="Preview camera trực tiếp">
      <div className="wf-camera-preview-heading"><strong>Camera preview</strong><span>● Trực tiếp</span></div>
      <div className="wf-camera-preview-stage">
        <div ref={mountRef} className="wf-camera-preview-surface" aria-label={`Camera: ${shotName}`} aria-busy={loading} />
        {loading && !error && <div className="wf-camera-preview-loading" role="status">Đang chuẩn bị camera…</div>}
        {error && <div className="wf-camera-preview-error" role="alert">Không thể dựng preview: {error}</div>}
      </div>
      <div className="wf-camera-preview-transport">
        <button type="button" className="btn ghost sm" onClick={() => setPlaying((value) => !value)} disabled={!duration || !!error || loading} aria-label={playing ? 'Dừng preview' : 'Phát preview'}>{playing ? 'Ⅱ Dừng' : '▶ Phát'}</button>
        <input type="range" min={0} max={duration} step={1 / Math.max(1, project.comp.fps)} value={time} aria-label="Thời gian preview camera" onChange={(event) => { setPlaying(false); setTime(Number(event.target.value)) }} />
        <output>{time.toFixed(2)} / {duration.toFixed(2)}s</output>
      </div>
      <div className="wf-camera-preview-caption"><span>{shotName}</span><span>{project.comp.width} × {project.comp.height}</span></div>
      <p className="wf-camera-preview-note">Chỉnh thông số bên phải để xem kết quả. Phát hoặc tua để kiểm tra chuyển động.</p>
      {!node.enabled && <p className="wf-camera-preview-note">Node đang tắt. Bật node để kiểm tra tác động trên cảnh.</p>}
      <p className="wf-camera-preview-note">Preview hình ảnh dùng camera của dự án; không phát âm thanh.</p>
    </section>
  )
})
