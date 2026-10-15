import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react'
import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import type { LayerComposite } from './types'
import { plantTipAngleToward } from '../../engine/plantSpine'
import {
  applyPlantSpineAction,
  createPlantSpine,
  resolveSpineLayerIds,
  simplifyStroke,
  strokeLength
} from './workshopPlantSpines'
import {
  PLANT_AMPLITUDE_MAX,
  PLANT_LEAN_MAX,
  distanceToPolyline,
  insertPlantSpinePoint,
  learnSwayFromGesture,
  movePlantSpinePoint,
  removePlantSpinePoint,
  translatePlantSpine,
  type SwaySample
} from './plantSpineEdit'
import { layersUnderClientStroke } from './plantStrokeHitTest'
import { PlantSpineShape, SelectedSpineHandles, toPlantPath } from './PlantSpineShapes'
import { getPlantSpineEditorState, setPlantSpineEditorState, usePlantSpineEditor } from './plantSpineEditorStore'

export interface PlantSpineOverlayProps {
  composite: LayerComposite
  setComposite: (update: (prev: LayerComposite) => LayerComposite, key?: string) => void
  selectedIds: string[]
  time: number
  /** Đang ở tab Thực vật: vẽ xương mới, chọn & sửa xương bằng tay nắm. */
  drawing: boolean
  beginGesture?: () => void
  endGesture?: () => void
  onError?: (message: string) => void
}

type Drag =
  | { kind: 'draw'; pts: PlantSpinePoint[]; client: Array<{ x: number; y: number }> }
  | { kind: 'point'; spineId: string; index: number }
  | { kind: 'move'; spineId: string; start: PlantSpinePoint; origin: PlantSpinePoint[] }
  | { kind: 'grab'; spine: PlantSpine; start: number; t0: number; samples: SwaySample[] }

const GRAB_LIMIT = PLANT_AMPLITUDE_MAX + PLANT_LEAN_MAX

/** Lớp SVG trên Bố cục 2D: hiển thị xương thực vật, vẽ tay xương mới và chỉnh trực tiếp bằng tay nắm. */
export function PlantSpineOverlay(props: PlantSpineOverlayProps) {
  const { composite, setComposite, time, drawing } = props
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [stroke, setStroke] = useState<PlantSpinePoint[] | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const editor = usePlantSpineEditor()
  const spines = composite.plantSpines ?? []
  const selected = drawing ? spines.find((s) => s.id === editor.selectedSpineId) ?? null : null

  useEffect(() => {
    if (!flash) return
    const id = window.setTimeout(() => setFlash(null), 2200)
    return () => window.clearTimeout(id)
  }, [flash])

  if (!drawing && !spines.length) return null

  const toLocal = (e: { clientX: number; clientY: number }): PlantSpinePoint | null => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  const capture = (e: PointerEvent) => {
    e.stopPropagation()
    try { svgRef.current?.setPointerCapture(e.pointerId) } catch { /* pointer không còn hoạt động */ }
  }
  const patchSpine = (id: string, patch: Partial<PlantSpine>, key?: string) => {
    try {
      setComposite((c) => applyPlantSpineAction(c, { action: 'update', id, patch }), key)
    } catch (err) {
      props.onError?.(err instanceof Error ? err.message : String(err))
    }
  }

  const startHandleDrag = (e: PointerEvent, drag: Drag) => {
    if (e.button !== 0 || e.altKey) return
    capture(e)
    props.beginGesture?.()
    dragRef.current = drag
    if (drag.kind !== 'grab') setPlantSpineEditorState({ dragging: true })
  }

  const onDown = (e: PointerEvent) => {
    if (!drawing || e.button !== 0 || e.altKey) return
    const p = toLocal(e)
    if (!p) return
    capture(e)
    dragRef.current = { kind: 'draw', pts: [p], client: [{ x: e.clientX, y: e.clientY }] }
    setStroke([p])
  }

  const onMove = (e: PointerEvent) => {
    const drag = dragRef.current
    const p = drag ? toLocal(e) : null
    if (!drag || !p) return
    if (drag.kind === 'draw') {
      const last = drag.pts[drag.pts.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return
      drag.pts.push(p)
      drag.client.push({ x: e.clientX, y: e.clientY })
      setStroke([...drag.pts])
    } else if (drag.kind === 'point') {
      const spine = spines.find((s) => s.id === drag.spineId)
      if (spine) patchSpine(spine.id, { points: movePlantSpinePoint(spine.points, drag.index, p) })
    } else if (drag.kind === 'move') {
      patchSpine(drag.spineId, { points: translatePlantSpine(drag.origin, p.x - drag.start.x, p.y - drag.start.y) })
    } else {
      const raw = plantTipAngleToward(drag.spine, p) - drag.start
      const angle = Math.max(-GRAB_LIMIT, Math.min(GRAB_LIMIT, raw))
      drag.samples.push({ angle, t: (performance.now() - drag.t0) / 1000 })
      setPlantSpineEditorState({ grab: { spineId: drag.spine.id, angle } })
    }
  }

  const finishDraw = (pts: PlantSpinePoint[], client: Array<{ x: number; y: number }>) => {
    if (strokeLength(pts) < 8) {
      // Click: chọn xương gần nhất (hoặc bỏ chọn khi bấm ra ngoài)
      const hit = spines
        .map((s) => ({ id: s.id, d: distanceToPolyline(pts[0], s.points) }))
        .sort((a, b) => a.d - b.d)[0]
      setPlantSpineEditorState({ selectedSpineId: hit && hit.d < 16 ? hit.id : null })
      return
    }
    try {
      const order = composite.layers.map((l) => l.id)
      const hits = editor.target === 'auto' ? layersUnderClientStroke(svgRef.current, client, order) : []
      const layerIds = resolveSpineLayerIds(composite, editor.target, props.selectedIds, hits)
      const spine = createPlantSpine({ points: simplifyStroke(pts), layerIds, preset: editor.preset })
      setComposite((c) => applyPlantSpineAction(c, { action: 'add', spine }))
      setPlantSpineEditorState({ selectedSpineId: spine.id })
      const names = composite.layers.filter((l) => layerIds.includes(l.id)).map((l) => l.name)
      setFlash(`Gắn vào: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`)
    } catch (err) {
      props.onError?.(err instanceof Error ? err.message : String(err))
    }
  }

  const finishGrab = (drag: Extract<Drag, { kind: 'grab' }>) => {
    setPlantSpineEditorState({ grab: null })
    const learned = learnSwayFromGesture(drag.samples, drag.spine)
    if (!learned) return
    patchSpine(drag.spine.id, learned)
    const parts = [`±${learned.amplitude ?? drag.spine.amplitude}°`]
    if (learned.lean !== undefined) parts.push(`nghiêng ${learned.lean}°`)
    if (learned.speed !== undefined) parts.push(`${learned.speed} nhịp/s`)
    setFlash(`Đã học nhịp đung đưa: ${parts.join(' · ')}`)
  }

  const finish = () => {
    const drag = dragRef.current
    dragRef.current = null
    setStroke(null)
    if (!drag) return
    if (drag.kind === 'draw') return finishDraw(drag.pts, drag.client)
    if (drag.kind === 'grab') finishGrab(drag)
    if (getPlantSpineEditorState().dragging) setPlantSpineEditorState({ dragging: false })
    props.endGesture?.()
  }

  const cancel = () => {
    const drag = dragRef.current
    dragRef.current = null
    setStroke(null)
    if (drag && drag.kind !== 'draw') {
      setPlantSpineEditorState({ grab: null, dragging: false })
      props.endGesture?.()
    }
  }

  const handleProps = selected && {
    spine: selected,
    grabbing: editor.grab?.spineId === selected.id,
    onBodyDown: (e: PointerEvent) => {
      const p = toLocal(e)
      if (p) startHandleDrag(e, { kind: 'move', spineId: selected.id, start: p, origin: selected.points })
    },
    onBodyDoubleClick: (e: MouseEvent) => {
      const p = toLocal(e)
      if (p) patchSpine(selected.id, { points: insertPlantSpinePoint(selected.points, p) })
    },
    onPointDown: (e: PointerEvent, index: number) => startHandleDrag(e, { kind: 'point', spineId: selected.id, index }),
    onPointDoubleClick: (_e: MouseEvent, index: number) =>
      patchSpine(selected.id, { points: removePlantSpinePoint(selected.points, index) }),
    onGrabDown: (e: PointerEvent) => {
      const p = toLocal(e)
      if (!p) return
      startHandleDrag(e, { kind: 'grab', spine: selected, start: plantTipAngleToward(selected, p), t0: performance.now(), samples: [] })
    }
  }

  return (
    <svg
      ref={svgRef}
      className={`lw-plant-overlay${drawing ? ' drawing' : ''}`}
      viewBox={`${-composite.width / 2} ${-composite.height / 2} ${composite.width} ${composite.height}`}
      aria-label="Xương thực vật trên Bố cục 2D"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={finish}
      onPointerCancel={cancel}
    >
      {spines.map((s) => (
        <PlantSpineShape
          key={s.id}
          spine={s}
          time={time}
          selected={selected?.id === s.id}
          grabAngle={editor.grab?.spineId === s.id ? editor.grab.angle : undefined}
        />
      ))}
      {handleProps && <SelectedSpineHandles {...handleProps} />}
      {stroke && stroke.length > 1 && <path d={toPlantPath(stroke)} className="lw-plant-stroke" />}
      {stroke && <circle cx={stroke[0].x} cy={stroke[0].y} r={5} className="lw-plant-root" />}
      {flash && (
        <text x={0} y={composite.height / 2 - 18} textAnchor="middle" className="lw-plant-flash">{flash}</text>
      )}
    </svg>
  )
}
