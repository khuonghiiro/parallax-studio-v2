import '../styles/projectLoadingOverlay.css'
import { useProjectLoading, type ProjectLoadPhase } from '../store/projectLoading'

const PHASE_ORDER: ProjectLoadPhase[] = ['parse', 'assets', 'workflow', 'gpu']

const PHASE_STEPS: { id: ProjectLoadPhase; code: string; label: string }[] = [
  { id: 'parse', code: 'BƯỚC 1', label: 'Đọc cấu trúc cảnh' },
  { id: 'assets', code: 'BƯỚC 2', label: 'Nạp ảnh & Atlas' },
  { id: 'workflow', code: 'BƯỚC 3', label: 'Sơ đồ Workflow' },
  { id: 'gpu', code: 'BƯỚC 4', label: 'Khởi tạo GPU' }
]

export function ProjectLoadingOverlay() {
  const active = useProjectLoading((s) => s.active)
  const title = useProjectLoading((s) => s.title)
  const phase = useProjectLoading((s) => s.phase)
  const stageLabel = useProjectLoading((s) => s.stageLabel)
  const detailLabel = useProjectLoading((s) => s.detailLabel)
  const loadedCount = useProjectLoading((s) => s.loadedCount)
  const totalCount = useProjectLoading((s) => s.totalCount)
  const percent = useProjectLoading((s) => s.percent)
  const shotCount = useProjectLoading((s) => s.shotCount)
  const layerCount = useProjectLoading((s) => s.layerCount)

  if (!active) return null

  const activeIdx = Math.max(0, PHASE_ORDER.indexOf(phase))
  const rightBadge =
    totalCount > 0 && phase === 'assets'
      ? `${loadedCount}/${totalCount} tài nguyên${detailLabel ? ` · ${detailLabel}` : ''}`
      : shotCount > 0 || layerCount > 0
        ? `${shotCount} cảnh · ${layerCount} layer`
        : detailLabel

  return (
    <div className="project-loading-backdrop">
      <div
        className="project-loading-card"
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-label={title || 'Tiến trình tải cảnh'}
        data-mcp-region="project_loading"
        data-mcp-dialog
        data-ai-surface="dialog"
        data-ai-surface-label="Tiến trình tải cảnh"
      >
        <div className="project-loading-head">
          <div className="project-loading-title-wrap">
            <span className="project-loading-spinner" aria-hidden="true" />
            <h2 className="project-loading-title">{title || 'Đang tải dự án…'}</h2>
          </div>
          <span className="project-loading-percent">{percent}%</span>
        </div>

        <div
          className="project-loading-bar-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="project-loading-bar-fill" style={{ width: `${percent}%` }} />
        </div>

        <div className="project-loading-steps">
          {PHASE_STEPS.map((step, idx) => {
            const stateClass = idx < activeIdx ? 'done' : idx === activeIdx ? 'active' : ''
            return (
              <div key={step.id} className={`project-loading-step ${stateClass}`.trim()}>
                <span className="project-loading-step-index">
                  {idx < activeIdx ? `✓ ${step.code}` : step.code}
                </span>
                <span className="project-loading-step-label">{step.label}</span>
              </div>
            )
          })}
        </div>

        <div className="project-loading-meta">
          <span className="project-loading-stage">{stageLabel}</span>
          {rightBadge ? <span className="project-loading-detail">{rightBadge}</span> : null}
        </div>
      </div>
    </div>
  )
}
