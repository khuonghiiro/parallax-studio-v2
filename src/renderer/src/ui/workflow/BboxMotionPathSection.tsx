import { OptionPills } from './WorkflowV2NodeParams'
import type { BboxMotionModel } from './useBboxMotionModel'

export function BboxMotionPathSection({ model }: { model: BboxMotionModel }) {
  const { p, pathType, targetScalePct, draftCurve, setDraftCurve, applyBboxPatch, distPx, speedPxPerSec } = model
  return (
<div className="vl-subcard" style={{ padding: '6px 7px' }}>
        <div className="vl-row-header" style={{ marginBottom: 4 }}>
          <span className="vl-subtitle">Đường đi</span>
          <span className="vl-value-badge">
            {distPx}px · ~{speedPxPerSec}px/s
          </span>
        </div>
        <OptionPills
          cols={2}
          options={[
            { id: 'shortest', label: 'Đường thẳng' },
            { id: 'custom_curve', label: 'Vẽ đường cong' }
          ]}
          value={pathType}
          onPick={(nextType) =>
            applyBboxPatch(
              {
                bboxPathType: nextType,
                ...(nextType === 'custom_curve' && (!p.customMotionPath || p.customMotionPath.length < 2)
                  ? {
                      customMotionPath: [
                        [0.15, 0.72],
                        [0.5, 0.24],
                        [0.85, 0.68]
                      ]
                    }
                  : {})
              },
              'wf-bbox-pathtype'
            )
          }
        />

        {/* Nếu chọn Dạng 2 (Đặt đích rồi vẽ đường đi): hiện bảng vẽ nối từ đầu -> đích */}
        {pathType === 'custom_curve' && (
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                position: 'relative',
                height: 112,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line-soft)',
                background:
                  'var(--bg-1)',
                cursor: 'crosshair',
                touchAction: 'none',
                overflow: 'hidden'
              }}
              title="Kéo chuột để vẽ đường cong nối từ BBox đầu sang BBox đích (hoặc bấm nút ✏️ Vẽ đường đầu↝đích trên Khung BBox 2D phía trên)"
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                const toNorm = (cx: number, cy: number): [number, number] => [
                  Number(Math.max(0.04, Math.min(0.96, (cx - rect.left) / Math.max(1, rect.width))).toFixed(4)),
                  Number(Math.max(0.04, Math.min(0.96, (cy - rect.top) / Math.max(1, rect.height))).toFixed(4))
                ]
                const pts: [number, number][] = [toNorm(e.clientX, e.clientY)]
                setDraftCurve(pts)
                const onMove = (pev: PointerEvent): void => {
                  const next = toNorm(pev.clientX, pev.clientY)
                  const prev = pts[pts.length - 1]
                  if (Math.hypot(next[0] - prev[0], next[1] - prev[1]) >= 0.012) {
                    pts.push(next)
                    setDraftCurve([...pts])
                  }
                }
                const onUp = (): void => {
                  window.removeEventListener('pointermove', onMove)
                  window.removeEventListener('pointerup', onUp)
                  setDraftCurve(null)
                  if (pts.length >= 2) {
                    applyBboxPatch({ bboxPathType: 'custom_curve', customMotionPath: pts }, 'wf-bbox-curve')
                  }
                }
                window.addEventListener('pointermove', onMove)
                window.addEventListener('pointerup', onUp)
              }}
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                {/* Khung đầu và đích minh hoạ */}
                <rect x={8} y={40} width={14} height={20} rx={2} fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth={1.2} />
                <rect
                  x={76}
                  y={Math.max(8, Math.min(72, 50 - 10 * (targetScalePct / 100)))}
                  width={Math.max(8, Math.min(22, 14 * (targetScalePct / 100)))}
                  height={Math.max(10, Math.min(34, 20 * (targetScalePct / 100)))}
                  rx={2}
                  fill="rgba(245, 158, 11, 0.18)"
                  stroke="#f59e0b"
                  strokeDasharray="2.5 1.5"
                  strokeWidth={1.2}
                />
                {(() => {
                  const stroke = draftCurve ?? p.customMotionPath ?? [
                    [0.15, 0.5],
                    [0.5, 0.22],
                    [0.83, 0.5]
                  ]
                  if (stroke.length < 2) return null
                  const poly = stroke.map(([x, y]) => `${(x * 100).toFixed(1)},${(y * 100).toFixed(1)}`).join(' ')
                  return (
                    <polyline
                      fill="none"
                      stroke="var(--accent-cyan)"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={poly}
                    />
                  )
                })()}
              </svg>
              <span
                style={{
                  position: 'absolute',
                  left: 6,
                  bottom: 4,
                  fontSize: 9.5,
                  color: 'var(--text-dim)',
                  pointerEvents: 'none'
                }}
              >
                ✏️ Vẽ đường cong tại đây hoặc trên Khung BBox 2D — tự khớp đầu và đích
              </span>
            </div>
          </div>
        )}
      </div>
  )
}
