import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { WorkflowNodeParams } from '@shared/types'
import { useEditor } from '../../store/editor'
import { WorkflowMotionIcon, type MotionToolIcon } from './WorkflowMotionIcons'
import { stageStrokeToMotionPath, type StagePoint } from './workflowStageStroke'
import '../../styles/workflowMotionStage.css'

export type MotionStageActiveTool = 'select' | 'straight' | 'draw'

export interface MotionStageToolButtonSpec {
  id: string
  icon: MotionToolIcon
  title: string
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
  return [
    {
      id: 'motion-tool-select',
      icon: 'select',
      title: mode === 'bbox' ? 'Chọn & kéo BBox trực tiếp' : 'Chọn & kéo BBox xuất phát',
      active: tool === 'select',
      click: () => opts.onPickTool('select')
    },
    ...(mode === 'bbox'
      ? [
          {
            id: 'motion-tool-bbox-curve',
            icon: 'draw' as const,
            title: 'Vẽ tay đường cong quỹ đạo đầu → đích',
            active: tool === 'draw',
            click: () => opts.onPickTool('draw')
          },
          {
            id: 'motion-tool-free-draw',
            icon: 'free_draw' as const,
            title: 'Vẽ quỹ đạo tự do (không khoá BBox đích)',
            active: false,
            click: opts.onSwitchToFreeDraw
          }
        ]
      : [
          {
            id: 'motion-tool-free-draw',
            icon: 'free_draw' as const,
            title: 'Vẽ quỹ đạo tự do (kéo chuột để vẽ đường đi)',
            active: tool === 'draw',
            click: () => opts.onPickTool('draw')
          },
          {
            id: 'motion-tool-straight-line',
            icon: 'straight' as const,
            title: 'Vẽ đoạn thẳng nối 2 điểm',
            active: tool === 'straight',
            click: () => opts.onPickTool('straight')
          },
          {
            id: 'motion-tool-bbox-mode',
            icon: 'target' as const,
            dividerBefore: true,
            title: 'Chuyển về BBox Đầu → Đích (#1 → #2)',
            active: false,
            click: opts.onSwitchToBboxMode
          }
        ]),
    ...(hasCustomCurve
      ? [
          {
            id: 'motion-tool-clear',
            icon: 'clear' as const,
            title: mode === 'bbox' ? 'Đặt lại quỹ đạo thẳng ngắn nhất' : 'Xóa đường vẽ tự do',
            dividerBefore: mode === 'bbox',
            click: opts.onClearCurve
          }
        ]
      : []),
    ...(mode === 'bbox'
      ? [
          {
            id: 'motion-tool-gimbal',
            icon: 'gimbal' as const,
            dividerBefore: !hasCustomCurve,
            title: `Vòng xoay Gimbal 3D (${bboxRotateGimbal ? 'Đang bật' : 'Đang tắt'}) — Xoay nghiêng BBox đích theo trục X/Y/Z`,
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
            active: playing,
            click: opts.onTogglePlay
          }
        ]
      : [])
  ]
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
    if (!points || points.length < 2) return
    const chosen = tool === 'straight' ? [points[0], points[points.length - 1]] : points
    if (mode === 'bbox') {
      patch(
        {
          bboxPathType: 'custom_curve',
          customMotionPath: chosen.map(([x, y]) => [x / width, y / height])
        },
        'wf-stage-curve'
      )
    } else {
      const worldPath = stageStrokeToMotionPath(chosen, zoom, perspective)
      if (worldPath.length >= 2) {
        patch(
          {
            motionMode: 'path',
            actionPreset: 'custom_draw',
            customMotionPath: worldPath,
            intensity: 1
          },
          'wf-stage-line'
        )
      }
    }
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
          ...(mode === 'bbox' ? { bboxPathType: 'shortest' as const } : {})
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

  const display =
    stroke && stroke.length > 1
      ? (tool === 'straight' ? [stroke[0], stroke[stroke.length - 1]] : stroke).map(
          ([x, y]): StagePoint =>
            mode === 'path' ? [x - stroke[0][0] + start[0], y - stroke[0][1] + start[1]] : [x, y]
        )
      : mode === 'path'
        ? path
        : []

  const toolbarEl = (
    <div
      className={`wf-motion-stage-tools${toolbarHost ? ' is-docked' : ''}`}
      data-mcp-region="workflow_motion_tools"
      role="toolbar"
      aria-label="Công cụ quỹ đạo và xoay BBox"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {buttons.map((button) => (
        <span key={button.id} className="wf-motion-tool-slot">
          {button.dividerBefore && <span className="wf-motion-tool-sep" aria-hidden="true" />}
          <button
            type="button"
            data-ai-id={button.id}
            title={button.title}
            aria-label={button.title}
            aria-pressed={button.active}
            onClick={(e) => {
              e.stopPropagation()
              button.click()
            }}
          >
            <WorkflowMotionIcon name={button.icon} />
          </button>
        </span>
      ))}
    </div>
  )

  return (
    <>
      {toolbarHost ? createPortal(toolbarEl, toolbarHost) : toolbarEl}
      {display.length > 1 && (
        <svg className="wf-motion-stage-path" width={width} height={height} aria-hidden="true">
          <polyline
            points={display.map((p) => p.join(',')).join(' ')}
            fill="none"
            stroke="var(--accent-cyan)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={display[0][0]} cy={display[0][1]} r="4" fill="var(--accent)" />
          <circle
            cx={display[display.length - 1][0]}
            cy={display[display.length - 1][1]}
            r="4"
            fill="var(--key)"
          />
        </svg>
      )}
      {tool !== 'select' && (
        <MotionStageDrawingSurface
          mode={mode}
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
  mode: 'bbox' | 'path'
  width: number
  height: number
  strokeRef: MutableRefObject<StagePoint[] | null>
  setStroke: (points: StagePoint[] | null) => void
  cancel: () => void
  commit: () => void
}

function MotionStageDrawingSurface({
  mode,
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
    >
      <span className="wf-motion-stage-hint">
        {mode === 'bbox'
          ? 'Vẽ đường cong · tự nối đầu và đích'
          : 'Vẽ quỹ đạo tự do · kéo chuột từ vị trí xuất phát'}{' '}
        · Esc hủy
      </span>
    </div>
  )
}
