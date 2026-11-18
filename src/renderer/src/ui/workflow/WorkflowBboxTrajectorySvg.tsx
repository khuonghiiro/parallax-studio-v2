import React from 'react'
import { buildNormalizedBboxCurveFromGesture } from '../../project/workflowCurveMath'
import { useEditor } from '../../store/editor'
import { StudioTooltip } from '../controls/StudioTooltip'

export interface TrajectoryEntityRenderItem {
  id: string
  accentColor: string
  box1Cx: number
  box1Cy: number
  box2Cx: number
  box2Cy: number
  pathPts: [number, number][]
  hasCustomCurve: boolean
}

export interface WorkflowBboxTrajectorySvgProps {
  stageW: number
  stageH: number
  items: TrajectoryEntityRenderItem[]
  focusedEntityId?: string
  isMultiEntity: boolean
  tStart: number
  onBendCurve: (customMotionPath: [number, number][]) => void
  onResetStraight: () => void
}

/**
 * Lớp vẽ dây cung quỹ đạo BBox #1 → #2 kèm Chốt kéo uốn đường cong trực tiếp (Bezier Midpoint Handle):
 * Người dùng có thể nắm trực tiếp chốt tròn giữa đường nối kéo lên / xuống để uốn vòm Bezier mượt 60fps
 * mà không cần đổi công cụ, hoặc nhấp đúp vào chốt để trả về đường thẳng ngắn nhất.
 */
export const WorkflowBboxTrajectorySvg: React.FC<WorkflowBboxTrajectorySvgProps> = ({
  stageW,
  stageH,
  items,
  focusedEntityId,
  isMultiEntity,
  tStart,
  onBendCurve,
  onResetStraight
}) => {
  const focused = items.find((i) => !isMultiEntity || i.id === focusedEntityId) ?? items[0]
  const chordLen = focused
    ? Math.hypot(focused.box2Cx - focused.box1Cx, focused.box2Cy - focused.box1Cy)
    : 0
  const midPt =
    focused && focused.pathPts.length >= 2
      ? focused.pathPts[Math.floor(focused.pathPts.length / 2)]
      : null

  const startHandleDrag = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (!focused || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const ed = useEditor.getState()
    ed.setPlaying(false)
    ed.setTime(tStart)

    const canvasEl = e.currentTarget.closest('.wf-v2-direct-canvas') as HTMLElement | null
    if (!canvasEl) return
    const startPt: [number, number] = [focused.box1Cx, focused.box1Cy]
    const endPt: [number, number] = [focused.box2Cx, focused.box2Cy]

    const onMove = (pev: PointerEvent): void => {
      const rect = canvasEl.getBoundingClientRect()
      const cx = ((pev.clientX - rect.left) * stageW) / Math.max(1, rect.width)
      const cy = ((pev.clientY - rect.top) * stageH) / Math.max(1, rect.height)
      const nextCurve = buildNormalizedBboxCurveFromGesture([[cx, cy]], startPt, endPt, stageW)
      onBendCurve(nextCurve)
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <>
      <svg
        className="wf-v2-direct-cam-svg"
        width={stageW}
        height={stageH}
        style={{ zIndex: 24, pointerEvents: 'none' }}
      >
        <defs>
          {items.map((item) => (
            <marker
              key={`arrow-${item.id}`}
              id={`wf-bbox-arrow-${item.id}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill={item.accentColor} />
            </marker>
          ))}
        </defs>
        {items.map((item) => {
          if (item.pathPts.length < 2) return null
          const isFocused = !isMultiEntity || item.id === focusedEntityId
          return (
            <React.Fragment key={`svg-${item.id}`}>
              <polyline
                fill="none"
                stroke={item.accentColor}
                strokeOpacity={isFocused ? 0.22 : 0.06}
                strokeWidth={isFocused ? 4.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={item.pathPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
              />
              <polyline
                fill="none"
                stroke={item.accentColor}
                strokeWidth={isFocused ? 1.8 : 1}
                strokeOpacity={isFocused ? 0.95 : 0.3}
                strokeDasharray={isFocused ? '5 3.5' : '3 3'}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={isFocused ? `url(#wf-bbox-arrow-${item.id})` : undefined}
                points={item.pathPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
              />
              <circle
                cx={item.box1Cx}
                cy={item.box1Cy}
                r={isFocused ? 4 : 2.8}
                fill="#10b981"
                stroke="#0f172a"
                strokeWidth={1.5}
                opacity={isFocused ? 1 : 0.45}
              />
              <circle
                cx={item.box2Cx}
                cy={item.box2Cy}
                r={isFocused ? 4.5 : 3}
                fill={item.accentColor}
                stroke="#0f172a"
                strokeWidth={1.5}
                opacity={isFocused ? 1 : 0.45}
              />
            </React.Fragment>
          )
        })}
      </svg>

      {focused && midPt && chordLen >= 36 && (
        <div
          className="wf-bbox-curve-handle-pos"
          style={{
            position: 'absolute',
            left: Math.round(midPt[0]),
            top: Math.round(midPt[1]),
            transform: 'translate(-50%, -50%)',
            zIndex: 37,
            pointerEvents: 'auto'
          }}
        >
          <StudioTooltip
            title="Chốt uốn đường cong #1 → #2"
            badge={focused.hasCustomCurve ? 'Đang uốn' : 'Kéo uốn'}
            badgeTone={focused.hasCustomCurve ? 'green' : 'cyan'}
            description="Nắm kéo lên / xuống để uốn cong quỹ đạo mượt theo ý muốn · Nhấp đúp để đặt thẳng lại"
            placement="top"
          >
            <button
              type="button"
              className={`wf-bbox-curve-handle${focused.hasCustomCurve ? ' is-curved' : ''}`}
              data-ai-id="bbox-curve-midpoint-handle"
              aria-label="Chốt uốn đường cong #1 → #2"
              style={{ ['--wf-v2-accent' as string]: focused.accentColor }}
              onPointerDown={startHandleDrag}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onResetStraight()
              }}
            >
              <span className="wf-bbox-curve-handle-dot" />
            </button>
          </StudioTooltip>
        </div>
      )}
    </>
  )
}
