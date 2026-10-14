import { useRef, useState, type PointerEvent } from 'react'
import type { PlantSpinePoint } from '@shared/plantSpine'
import type { LayerComposite } from './types'
import { evaluatePlantSpine } from '../../engine/plantSpine'
import {
  applyPlantSpineAction,
  createPlantSpine,
  resolveSpineLayerIds,
  simplifyStroke,
  strokeLength
} from './workshopPlantSpines'
import { setPlantSpineEditorState, usePlantSpineEditor } from './plantSpineEditorStore'

export interface PlantSpineOverlayProps {
  composite: LayerComposite
  setComposite: (update: (prev: LayerComposite) => LayerComposite, key?: string) => void
  selectedIds: string[]
  time: number
  /** Đang ở tab Thực vật: kéo chuột để vẽ xương mới, click để chọn xương. */
  drawing: boolean
  onError?: (message: string) => void
}

const toPath = (pts: PlantSpinePoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

function distanceToPolyline(p: PlantSpinePoint, pts: PlantSpinePoint[]): number {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t))
  }
  return best
}

/** Lớp SVG trên Bố cục 2D: hiển thị xương thực vật (nghỉ + đang uốn) và cho phép vẽ tay xương mới. */
export function PlantSpineOverlay({ composite, setComposite, selectedIds, time, drawing, onError }: PlantSpineOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const strokeRef = useRef<PlantSpinePoint[] | null>(null)
  const [stroke, setStroke] = useState<PlantSpinePoint[] | null>(null)
  const editor = usePlantSpineEditor()
  const spines = composite.plantSpines ?? []
  if (!drawing && !spines.length) return null

  const toLocal = (e: PointerEvent): PlantSpinePoint | null => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  const onDown = (e: PointerEvent) => {
    if (!drawing || e.button !== 0 || e.altKey) return
    const p = toLocal(e)
    if (!p) return
    e.stopPropagation()
    strokeRef.current = [p]
    setStroke([p])
    try { svgRef.current?.setPointerCapture(e.pointerId) } catch { /* pointer không còn hoạt động */ }
  }

  const onMove = (e: PointerEvent) => {
    const current = strokeRef.current
    const p = toLocal(e)
    if (!current || !p) return
    const last = current[current.length - 1]
    if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return
    current.push(p)
    setStroke([...current])
  }

  const finish = () => {
    const pts = strokeRef.current
    strokeRef.current = null
    setStroke(null)
    if (!pts) return
    if (strokeLength(pts) < 8) {
      // Click: chọn xương gần nhất
      const hit = spines
        .map((s) => ({ id: s.id, d: distanceToPolyline(pts[0], s.points) }))
        .sort((a, b) => a.d - b.d)[0]
      setPlantSpineEditorState({ selectedSpineId: hit && hit.d < 14 ? hit.id : null })
      return
    }
    try {
      const layerIds = resolveSpineLayerIds(composite, editor.target, selectedIds)
      const spine = createPlantSpine({ points: simplifyStroke(pts), layerIds, preset: editor.preset })
      setComposite((c) => applyPlantSpineAction(c, { action: 'add', spine }))
      setPlantSpineEditorState({ selectedSpineId: spine.id })
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err))
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
      onPointerCancel={() => { strokeRef.current = null; setStroke(null) }}
    >
      {spines.map((s) => {
        const frame = evaluatePlantSpine(s, time)
        const selected = editor.selectedSpineId === s.id
        const root = frame.rest[0]
        const tip = frame.bent[frame.bent.length - 1]
        return (
          <g key={s.id} className={`lw-plant-spine${selected ? ' selected' : ''}${s.enabled === false ? ' disabled' : ''}`}>
            <path d={toPath(frame.rest)} className="lw-plant-rest" />
            <path d={toPath(frame.bent)} className="lw-plant-bent" />
            <circle cx={root.x} cy={root.y} r={5} className="lw-plant-root" />
            <circle cx={tip.x} cy={tip.y} r={3.5} className="lw-plant-tip" />
            {selected && (
              <text x={root.x + 8} y={root.y + 4} className="lw-plant-label">{s.name}</text>
            )}
          </g>
        )
      })}
      {stroke && stroke.length > 1 && <path d={toPath(stroke)} className="lw-plant-stroke" />}
      {stroke && <circle cx={stroke[0].x} cy={stroke[0].y} r={5} className="lw-plant-root" />}
    </svg>
  )
}
