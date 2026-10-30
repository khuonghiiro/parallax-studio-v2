import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { WorkflowNodeParams } from '@shared/types'
import { useEditor } from '../../store/editor'
import { WorkflowMotionIcon, type MotionToolIcon } from './WorkflowMotionIcons'
import { stageStrokeToMotionPath, type StagePoint } from './workflowStageStroke'
import '../../styles/workflowMotionStage.css'

type Props = {
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

export function WorkflowMotionStageTools({ mode, nodeId, params, width, height, zoom, perspective, start, path, patch }: Props) {
  const [tool, setTool] = useState<'select' | 'straight' | 'draw'>('select')
  const [stroke, setStroke] = useState<StagePoint[] | null>(null)
  const strokeRef = useRef<StagePoint[] | null>(null)
  const playing = useEditor(s => s.playing)
  const cancel = () => { strokeRef.current = null; setStroke(null) }
  useEffect(() => { setTool('select'); strokeRef.current = null; setStroke(null) }, [nodeId, mode])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { strokeRef.current = null; setStroke(null); setTool('select') }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  const pick = (next: typeof tool) => {
    cancel()
    useEditor.getState().setPlaying(false)
    useEditor.getState().setTime(params.timeStart ?? 0)
    if (mode === 'bbox' && next === 'straight') {
      patch({ bboxPathType: 'shortest' }, 'wf-stage-straight')
      setTool('select')
    } else setTool(next)
  }
  const commit = () => {
    const points = strokeRef.current
    cancel()
    if (!points || points.length < 2) return
    const chosen = tool === 'straight' ? [points[0], points[points.length - 1]] : points
    if (mode === 'bbox') {
      patch({ bboxPathType: 'custom_curve', customMotionPath: chosen.map(([x, y]) => [x / width, y / height]) }, 'wf-stage-curve')
    } else {
      const worldPath = stageStrokeToMotionPath(chosen, zoom, perspective)
      if (worldPath.length >= 2) patch({ motionMode: 'path', actionPreset: 'custom_draw', customMotionPath: worldPath, intensity: 1 }, 'wf-stage-line')
    }
    setTool('select')
  }
  const buttons: { icon: MotionToolIcon; title: string; active?: boolean; click: () => void }[] = [
    { icon: 'select', title: 'Chọn / kéo BBox', active: tool === 'select', click: () => pick('select') },
    { icon: 'straight', title: mode === 'bbox' ? 'Đường thẳng đầu → đích' : 'Vẽ đoạn thẳng trên khung', active: mode === 'bbox' ? params.bboxPathType !== 'custom_curve' : tool === 'straight', click: () => pick('straight') },
    { icon: 'draw', title: mode === 'bbox' ? 'Vẽ đường cong đầu → đích' : 'Vẽ line trên khung BBox', active: tool === 'draw', click: () => pick('draw') },
    { icon: 'clear', title: mode === 'bbox' ? 'Xóa đường cong, về đường thẳng' : 'Xóa line', click: () => { cancel(); setTool('select'); patch({ customMotionPath: [], ...(mode === 'bbox' ? { bboxPathType: 'shortest' as const } : {}) }, 'wf-stage-clear') } },
    { icon: playing ? 'stop' : 'play', title: playing ? 'Dừng xem thử' : 'Xem thử chuyển động', active: playing, click: () => { cancel(); setTool('select'); const ed = useEditor.getState(); if (!ed.playing) ed.setTime(params.timeStart ?? 0); ed.setPlaying(!ed.playing) } }
  ]
  const display = stroke && stroke.length > 1
    ? (tool === 'straight' ? [stroke[0], stroke[stroke.length - 1]] : stroke).map(([x, y]): StagePoint => mode === 'path' ? [x - stroke[0][0] + start[0], y - stroke[0][1] + start[1]] : [x, y])
    : mode === 'path' ? path : []
  return <>
    <div className="wf-motion-stage-tools" data-mcp-region="workflow_motion_tools" role="toolbar" aria-label="Chỉnh đường đi Motion" onPointerDown={e => e.stopPropagation()}>
      {buttons.map(button => <button key={button.icon} type="button" title={button.title} aria-label={button.title} aria-pressed={button.active} onClick={e => { e.stopPropagation(); button.click() }}><WorkflowMotionIcon name={button.icon}/></button>)}
    </div>
    {display.length > 1 && <svg className="wf-motion-stage-path" width={width} height={height} aria-hidden="true"><polyline points={display.map(p => p.join(',')).join(' ')} fill="none" stroke="var(--accent-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx={display[0][0]} cy={display[0][1]} r="4" fill="var(--accent)"/><circle cx={display[display.length-1][0]} cy={display[display.length-1][1]} r="4" fill="var(--key)"/></svg>}
    {tool !== 'select' && <MotionStageDrawingSurface mode={mode} width={width} height={height} strokeRef={strokeRef} setStroke={setStroke} cancel={cancel} commit={commit} />}
  </>
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
function MotionStageDrawingSurface({ mode, width, height, strokeRef, setStroke, cancel, commit }: SurfaceProps) {
  return <div className="wf-motion-stage-draw" data-mcp-region="workflow_motion_draw" aria-label="Vẽ đường đi trên khung BBox"
      onPointerDown={e => {
        if (e.button !== 0) return
        e.stopPropagation(); e.preventDefault()
        useEditor.getState().setPlaying(false)
        e.currentTarget.setPointerCapture(e.pointerId)
        const rect = e.currentTarget.getBoundingClientRect()
        const point: StagePoint = [(e.clientX - rect.left) * width / rect.width, (e.clientY - rect.top) * height / rect.height]
        strokeRef.current = [point]; setStroke([point])
      }}
      onPointerMove={e => {
        const points = strokeRef.current
        if (!points) return
        const rect = e.currentTarget.getBoundingClientRect()
        const point: StagePoint = [(e.clientX - rect.left) * width / rect.width, (e.clientY - rect.top) * height / rect.height]
        const previous = points[points.length - 1]
        if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 2) return
        points.push(point); setStroke([...points])
      }}
      onPointerUp={e => { e.stopPropagation(); commit(); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }}
      onPointerCancel={cancel} onLostPointerCapture={cancel}
    ><span className="wf-motion-stage-hint">{mode === 'bbox' ? 'Vẽ đường cong · tự nối đầu và đích' : 'Kéo để vẽ · đường đi bắt đầu từ BBox'} · Esc hủy</span></div>
}
