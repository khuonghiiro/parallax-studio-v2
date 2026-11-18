import { createPortal } from 'react-dom'
import React, { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { WorkflowNodeParams } from '@shared/types'
import {
  buildLiveBboxPreviewCurveScreenPoints,
  buildNormalizedBboxCurveFromGesture,
  decimateAndSmoothStroke,
  evaluateCatmullRom2D
} from '../../project/workflowCurveMath'
import { useEditor } from '../../store/editor'
import { StudioTooltip, type StudioTooltipBadgeTone } from '../controls/StudioTooltip'
import { WorkflowMotionIcon, type MotionToolIcon } from './WorkflowMotionIcons'
import { stageStrokeToMotionPath, type StagePoint } from './workflowStageStroke'
import '../../styles/workflowMotionStage.css'

export type MotionStageActiveTool = 'select' | 'straight' | 'draw'

export interface MotionStageToolButtonSpec {
  id: string
  icon: MotionToolIcon
  title: string
  description: string
  badge?: string
  badgeTone?: StudioTooltipBadgeTone
  active?: boolean
  dividerBefore?: boolean
  click: () => void
}

export function buildMotionStageToolButtons(opts: {
  mode: 'bbox' | 'path'
  tool: MotionStageActiveTool
  hasCustomCurve: boolean
  bboxRotateGimbal: boolean
  hasToolbarHost: boolean
  playing: boolean
  onPickTool: (next: MotionStageActiveTool) => void
  onSwitchToFreeDraw: () => void
  onSwitchToBboxMode: () => void
  onClearCurve: () => void
  onToggleGimbal: () => void
  onTogglePlay: () => void
}): MotionStageToolButtonSpec[] {
  const { mode, tool, hasCustomCurve, bboxRotateGimbal, hasToolbarHost, playing } = opts
  const canUseGimbal = mode === 'bbox' || (mode === 'path' && hasCustomCurve)
  return [
    {
      id: 'motion-tool-select',
      icon: 'select',
      title: mode === 'bbox' ? 'Chọn & kéo BBox trực tiếp' : 'Chọn & kéo BBox đầu / đích',
      description:
        mode === 'bbox'
          ? 'Kéo dời vị trí BBox #2 hoặc nắm 4 góc trắng để phóng to / thu nhỏ tại đích'
          : 'Kéo chỉnh BBox đích hoặc nắm 4 góc trắng để đổi kích thước kết thúc đường vẽ',
      badge: 'Chọn',
      badgeTone: 'cyan',
      active: tool === 'select',
      click: () => opts.onPickTool('select')
    },
    ...(mode === 'bbox'
      ? [
          {
            id: 'motion-tool-bbox-curve',
            icon: 'draw' as const,
            title: 'Uốn đường cong đầu → đích',
            description: 'Kéo chuột vẽ dáng cong mượt nối tự động từ tâm BBox #1 sang tâm BBox #2',
            badge: 'Cong #1→#2',
            badgeTone: 'cyan' as const,
            active: tool === 'draw',
            click: () => opts.onPickTool('draw')
          },
          {
            id: 'motion-tool-free-draw',
            icon: 'free_draw' as const,
            title: 'Vẽ quỹ đạo tự do',
            description: 'Kéo chuột vẽ đường đi bất kỳ; vẽ xong sẽ hiện BBox Đích để chỉnh cỡ & xoay',
            badge: 'Tự do',
            badgeTone: 'amber' as const,
            active: false,
            click: opts.onSwitchToFreeDraw
          }
        ]
      : [
          {
            id: 'motion-tool-free-draw',
            icon: 'free_draw' as const,
            title: 'Vẽ quỹ đạo tự do',
            description: 'Kéo chuột từ vị trí xuất phát; nhả chuột sẽ hiện BBox Đích để chỉnh cỡ & xoay',
            badge: 'Đang dùng',
            badgeTone: 'amber' as const,
            active: tool === 'draw',
            click: () => opts.onPickTool('draw')
          },
          {
            id: 'motion-tool-straight-line',
            icon: 'straight' as const,
            title: 'Vẽ đoạn thẳng 2 điểm',
            description: 'Kéo một đường thẳng dứt khoát từ điểm xuất phát tới điểm kết thúc',
            badge: 'Thẳng',
            badgeTone: 'neutral' as const,
            active: tool === 'straight',
            click: () => opts.onPickTool('straight')
          },
          {
            id: 'motion-tool-bbox-mode',
            icon: 'target' as const,
            dividerBefore: true,
            title: 'Chuyển về BBox #1 → #2',
            description: 'Quay lại chế độ đặt khung BBox Đầu → Đích tiêu chuẩn',
            badge: 'BBox',
            badgeTone: 'cyan' as const,
            active: false,
            click: opts.onSwitchToBboxMode
          }
        ]),
    ...(hasCustomCurve
      ? [
          {
            id: 'motion-tool-clear',
            icon: 'clear' as const,
            title: mode === 'bbox' ? 'Đặt lại đường thẳng ngắn nhất' : 'Xóa đường vẽ tự do',
            description:
              mode === 'bbox'
                ? 'Xoá độ uốn cong để đối tượng đi thẳng trực tiếp từ #1 sang #2'
                : 'Xoá đường đi hiện tại để vẽ lại nét mới từ đầu',
            badge: 'Reset',
            badgeTone: 'neutral' as const,
            dividerBefore: mode === 'bbox',
            click: opts.onClearCurve
          }
        ]
      : []),
    ...(canUseGimbal
      ? [
          {
            id: 'motion-tool-gimbal',
            icon: 'gimbal' as const,
            dividerBefore: mode === 'bbox' ? !hasCustomCurve : false,
            title: 'Vòng xoay Gimbal 3D tại Đích',
            description: 'Mở vòng xoay trực quan trên BBox Đích để nghiêng / xoay đối tượng theo trục X, Y, Z',
            badge: bboxRotateGimbal ? 'Đang bật' : '3D',
            badgeTone: (bboxRotateGimbal ? 'green' : 'neutral') as StudioTooltipBadgeTone,
            active: bboxRotateGimbal,
            click: opts.onToggleGimbal
          }
        ]
      : []),
    ...(!hasToolbarHost
      ? [
          {
            id: 'motion-tool-play',
            icon: (playing ? 'stop' : 'play') as MotionToolIcon,
            dividerBefore: true,
            title: playing ? 'Dừng xem thử' : 'Xem thử chuyển động',
            description: 'Phát thử hành trình chuyển động ngay trên khung 2D',
            badge: 'Space',
            badgeTone: 'green' as const,
            active: playing,
            click: opts.onTogglePlay
          }
        ]
      : [])
  ]
}

function smoothFreehandScreenStroke(raw: StagePoint[], start: StagePoint): StagePoint[] {
  if (raw.length < 2) return []
  const anchored = raw.map(([x, y]): StagePoint => [x - raw[0][0] + start[0], y - raw[0][1] + start[1]])
  if (anchored.length === 2) return anchored
  const knots = decimateAndSmoothStroke(anchored, 14, 3)
  const out: StagePoint[] = []
  const steps = 36
  for (let i = 0; i <= steps; i++) {
    out.push(evaluateCatmullRom2D(knots, i / steps))
  }
  return out
}

type Props = {
  toolbarHost: HTMLDivElement | null
  mode: 'bbox' | 'path'
  nodeId: string
  params: WorkflowNodeParams
  width: number
  height: number
  zoom: number
  perspective: number
  start: StagePoint
  end?: StagePoint
  path: StagePoint[]
  patch: (patch: Partial<WorkflowNodeParams>, mergeKey?: string) => void
}

export function WorkflowMotionStageTools({
  toolbarHost,
  mode,
  nodeId,
  params,
  width,
  height,
  zoom,
  perspective,
  start,
  end,
  path,
  patch
}: Props) {
  const hasCustomCurve = Boolean(params.customMotionPath && params.customMotionPath.length > 0)
  const [tool, setTool] = useState<MotionStageActiveTool>(() =>
    mode === 'path' && !hasCustomCurve ? 'draw' : 'select'
  )
  const [stroke, setStroke] = useState<StagePoint[] | null>(null)
  const strokeRef = useRef<StagePoint[] | null>(null)
  const autoStartDrawRef = useRef(false)
  const playing = useEditor((s) => s.playing)

  const cancel = (): void => {
    strokeRef.current = null
    setStroke(null)
  }

  useEffect(() => {
    strokeRef.current = null
    setStroke(null)
    if (mode === 'path' && (autoStartDrawRef.current || !hasCustomCurve)) {
      autoStartDrawRef.current = false
      setTool('draw')
    } else {
      autoStartDrawRef.current = false
      setTool('select')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, mode])

  useEffect(() => {
    const onRequestFreeDraw = (ev: Event): void => {
      const detail = (ev as CustomEvent<{ nodeId?: string }>).detail
      if (!detail?.nodeId || detail.nodeId === nodeId) {
        strokeRef.current = null
        setStroke(null)
        setTool('draw')
      }
    }
    window.addEventListener('pxs:vn2d-start-free-draw', onRequestFreeDraw)
    return () => window.removeEventListener('pxs:vn2d-start-free-draw', onRequestFreeDraw)
  }, [nodeId])

  useEffect(() => {
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        strokeRef.current = null
        setStroke(null)
        setTool('select')
      }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])

  const pick = (next: MotionStageActiveTool): void => {
    cancel()
    useEditor.getState().setPlaying(false)
    useEditor.getState().setTime(params.timeStart ?? 0)
    if (mode === 'bbox' && next === 'straight') {
      patch({ bboxPathType: 'shortest' }, 'wf-stage-straight')
      setTool('select')
    } else {
      setTool(next)
    }
  }

  const commit = (): void => {
    const points = strokeRef.current
    cancel()
    if (!points || points.length === 0) return
    if (mode === 'bbox') {
      const targetEnd: StagePoint = end ?? [start[0] + 120, start[1]]
      const normalizedArch = buildNormalizedBboxCurveFromGesture(points, start, targetEnd, width)
      patch(
        {
          bboxPathType: 'custom_curve',
          customMotionPath: normalizedArch
        },
        'wf-stage-curve'
      )
      setTool('select')
      return
    }
    if (points.length < 2) return
    const chosen =
      tool === 'straight'
        ? [points[0], points[points.length - 1]]
        : decimateAndSmoothStroke(points, 16, 3)
    const worldPath = stageStrokeToMotionPath(chosen, zoom, perspective)
    if (worldPath.length >= 2) {
      const lastWorld = worldPath[worldPath.length - 1]
      patch(
        {
          motionMode: 'path',
          actionPreset: 'custom_draw',
          customMotionPath: worldPath,
          intensity: 1,
          bboxTargetScalePct: params.bboxTargetScalePct ?? 100,
          // Ghi nhận độ lệch đích của nét vẽ tự do để BBox Đích hiện ngay cuối đường vẽ
          bboxTargetX: Math.round(lastWorld[0]),
          bboxTargetY: Math.round(lastWorld[1])
        },
        'wf-stage-line'
      )
    }
    // Chuyển ngay về công cụ Chọn để người dùng kéo chỉnh cỡ / góc xoay trên BBox Đích vừa hiện ra!
    setTool('select')
  }

  const buttons = buildMotionStageToolButtons({
    mode,
    tool,
    hasCustomCurve,
    bboxRotateGimbal: Boolean(params.bboxRotateGimbal),
    hasToolbarHost: Boolean(toolbarHost),
    playing,
    onPickTool: pick,
    onSwitchToFreeDraw: () => {
      cancel()
      useEditor.getState().setPlaying(false)
      useEditor.getState().setTime(params.timeStart ?? 0)
      autoStartDrawRef.current = true
      setTool('draw')
      patch(
        {
          motionMode: 'path',
          actionPreset: 'custom_draw',
          customMotionPath: []
        },
        'wf-stage-switch-free-draw'
      )
    },
    onSwitchToBboxMode: () => {
      cancel()
      useEditor.getState().setPlaying(false)
      useEditor.getState().setTime(params.timeStart ?? 0)
      setTool('select')
      patch(
        {
          motionMode: 'bbox',
          actionPreset: 'bbox_target',
          bboxPathType: 'shortest',
          customMotionPath: []
        },
        'wf-stage-switch-bbox'
      )
    },
    onClearCurve: () => {
      cancel()
      setTool(mode === 'path' ? 'draw' : 'select')
      patch(
        {
          customMotionPath: [],
          ...(mode === 'bbox' ? { bboxPathType: 'shortest' as const } : { bboxRotateGimbal: false })
        },
        'wf-stage-clear'
      )
    },
    onToggleGimbal: () => {
      patch({ bboxRotateGimbal: !params.bboxRotateGimbal }, 'wf-stage-gimbal')
    },
    onTogglePlay: () => {
      cancel()
      setTool('select')
      const ed = useEditor.getState()
      if (!ed.playing) ed.setTime(params.timeStart ?? 0)
      ed.setPlaying(!ed.playing)
    }
  })

  const display = useMemo<StagePoint[]>(() => {
    if (stroke && stroke.length >= 1) {
      if (mode === 'bbox' && end) {
        return buildLiveBboxPreviewCurveScreenPoints(stroke, start, end, width, height, 36)
      }
      if (stroke.length < 2) return []
      if (tool === 'straight') {
        const p0 = stroke[0]
        const pLast = stroke[stroke.length - 1]
        return [
          [start[0], start[1]],
          [pLast[0] - p0[0] + start[0], pLast[1] - p0[1] + start[1]]
        ]
      }
      return smoothFreehandScreenStroke(stroke, start)
    }
    return mode === 'path' ? path : []
  }, [stroke, mode, end, start, width, height, tool, path])

  const toolbarEl = (
    <div
      className={`wf-motion-stage-tools${toolbarHost ? ' is-docked' : ''}`}
      data-mcp-region="workflow_motion_tools"
      role="toolbar"
      aria-label="Công cụ quỹ đạo và xoay BBox"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {buttons.map((button) => (
        <React.Fragment key={button.id}>
          {button.dividerBefore && <span className="wf-motion-tool-sep" aria-hidden="true" />}
          <StudioTooltip
            title={button.title}
            description={button.description}
            badge={button.badge}
            badgeTone={button.badgeTone}
            placement={toolbarHost ? 'top' : 'left'}
          >
            <button
              type="button"
              className="wf-motion-tool-btn"
              data-ai-id={button.id}
              aria-label={button.title}
              aria-pressed={button.active}
              onClick={(e) => {
                e.stopPropagation()
                button.click()
              }}
            >
              <WorkflowMotionIcon name={button.icon} />
            </button>
          </StudioTooltip>
        </React.Fragment>
      ))}
      {tool !== 'select' && toolbarHost && (
        <>
          <span className="wf-motion-tool-sep" aria-hidden="true" />
          <StudioTooltip
            title="Thoát chế độ vẽ / uốn"
            badge="Esc"
            badgeTone="neutral"
            description="Hủy chế độ vẽ hiện tại và quay về công cụ Chọn & kéo BBox"
            placement="top"
          >
            <button
              type="button"
              className="wf-motion-inline-cancel"
              aria-label="Hủy chế độ vẽ (Esc)"
              onClick={(e) => {
                e.stopPropagation()
                cancel()
                setTool('select')
              }}
            >
              <span>{mode === 'bbox' ? 'Đang uốn' : 'Đang vẽ'}</span>
              <kbd>Esc</kbd>
            </button>
          </StudioTooltip>
        </>
      )}
    </div>
  )

  return (
    <>
      {toolbarHost ? createPortal(toolbarEl, toolbarHost) : toolbarEl}
      {display.length > 1 && (
        <svg className="wf-motion-stage-path" width={width} height={height} aria-hidden="true">
          <defs>
            <marker
              id={`wf-free-path-arrow-${nodeId}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="var(--accent-cyan)" />
            </marker>
          </defs>
          <polyline
            points={display.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
            fill="none"
            stroke="var(--accent-cyan)"
            strokeOpacity={0.22}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={display.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
            fill="none"
            stroke="var(--accent-cyan)"
            strokeWidth="2"
            strokeDasharray={stroke ? 'none' : '5 3.5'}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={`url(#wf-free-path-arrow-${nodeId})`}
          />
          <circle cx={display[0][0]} cy={display[0][1]} r="4" fill="#10b981" />
        </svg>
      )}
      {tool !== 'select' && (
        <MotionStageDrawingSurface
          width={width}
          height={height}
          strokeRef={strokeRef}
          setStroke={setStroke}
          cancel={cancel}
          commit={commit}
        />
      )}
    </>
  )
}

type SurfaceProps = {
  width: number
  height: number
  strokeRef: MutableRefObject<StagePoint[] | null>
  setStroke: (points: StagePoint[] | null) => void
  cancel: () => void
  commit: () => void
}

function MotionStageDrawingSurface({
  width,
  height,
  strokeRef,
  setStroke,
  cancel,
  commit
}: SurfaceProps) {
  return (
    <div
      className="wf-motion-stage-draw"
      data-mcp-region="workflow_motion_draw"
      aria-label="Vẽ đường đi trên khung BBox"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        e.preventDefault()
        useEditor.getState().setPlaying(false)
        e.currentTarget.setPointerCapture(e.pointerId)
        const rect = e.currentTarget.getBoundingClientRect()
        const point: StagePoint = [
          ((e.clientX - rect.left) * width) / rect.width,
          ((e.clientY - rect.top) * height) / rect.height
        ]
        strokeRef.current = [point]
        setStroke([point])
      }}
      onPointerMove={(e) => {
        const points = strokeRef.current
        if (!points) return
        const rect = e.currentTarget.getBoundingClientRect()
        const point: StagePoint = [
          ((e.clientX - rect.left) * width) / rect.width,
          ((e.clientY - rect.top) * height) / rect.height
        ]
        const previous = points[points.length - 1]
        if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 2) return
        points.push(point)
        setStroke([...points])
      }}
      onPointerUp={(e) => {
        e.stopPropagation()
        commit()
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    />
  )
}
