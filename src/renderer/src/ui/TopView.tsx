import { useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import * as THREE from 'three'
import type { Vec3 } from '@shared/types'
import { evaluate, setValueAt } from '../animation/keyframes'
import { shotAtTime } from '../animation/cameraPath'
import { evaluateScene } from '../engine/evaluateScene'
import { depthToThree, threeToDepth } from '../engine/spatial'
import { frameTolerance, useEditor } from '../store/editor'

export const TYPE_COLORS: Record<string, string> = {
  image: '#8b7bff',
  text: '#3dd6f5',
  solid: '#f59e6b',
  particles: '#ffc24b'
}

/** Which shot the depth diagram shows: the selected shot, else the one the camera looks at. */
export function useFocusShotId(): string | null {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  return useMemo(() => {
    if (selectedShotId && project.shots.some((s) => s.id === selectedShotId)) return selectedShotId
    return shotAtTime(project, time) ?? project.shots[0]?.id ?? null
  }, [project, time, selectedShotId])
}

/**
 * Top-down schematic of one shot's layer depths (shot-local space) and the camera frustum.
 * Drag layers to change depth.
 */
export function TopView({ shotId }: { shotId: string | null }) {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selected = useEditor((s) => s.selectedLayerId)
  const selectLayer = useEditor((s) => s.selectLayer)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 260, h: 220 })

  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ev = useMemo(() => evaluateScene(project, time), [project, time])
  const { comp } = project
  const shot = shotId ? ev.shots.find((s) => s.shot.id === shotId) : undefined

  // Camera in the shot's local frame.
  const inv = useMemo(() => (shot ? shot.matrix.clone().invert() : new THREE.Matrix4()), [shot])
  const toLocal = (p: Vec3): Vec3 => threeToDepth(depthToThree(p).applyMatrix4(inv))
  const camPos = toLocal(ev.camera.position)
  const camTarget = toLocal(ev.camera.target)
  const layers = ev.layers.filter((l) => l.layer.visible && (l.layer.shotId ?? null) === (shot ? shot.shot.id : null))

  const zs = [camPos[2], ...layers.map((l) => l.position[2])]
  const zMin = Math.min(...zs) - 300
  const zMax = Math.max(...zs, 0) + 400
  const xHalf = comp.width * 1.3
  const pad = 14
  const sx = (x: number): number => pad + ((x + xHalf) / (2 * xHalf)) * (size.w - pad * 2)
  const sz = (z: number): number => pad + (1 - (z - zMin) / (zMax - zMin)) * (size.h - pad * 2)
  const unz = (py: number): number => zMin + (1 - (py - pad) / (size.h - pad * 2)) * (zMax - zMin)

  const aspect = comp.width / comp.height
  const hfov = 2 * Math.atan(Math.tan(((ev.camera.fov / 2) * Math.PI) / 180) * aspect)
  const dir = Math.atan2(camTarget[0] - camPos[0], camTarget[2] - camPos[2])
  const reach = zMax - zMin
  const fx = (sign: number): [number, number] => {
    const a = dir + (sign * hfov) / 2
    return [camPos[0] + Math.sin(a) * reach * 1.5, camPos[2] + Math.cos(a) * reach * 1.5]
  }
  const [lx, lz] = fx(-1)
  const [rx, rz] = fx(1)

  // Greedy label placement: nudge names upward when they would collide.
  const labelPos = new Map<string, { x: number; y: number }>()
  {
    const placed: { x: number; y: number }[] = []
    const items = layers
      .map((l) => {
        const half = (l.size[0] * l.scale[0]) / 2
        return { id: l.layer.id, x: Math.min(sx(l.position[0] + half) + 4, size.w - 64), y: sz(l.position[2]) - 3 }
      })
      .sort((a, b) => b.y - a.y)
    for (const it of items) {
      let y = it.y
      for (let g = 0; g < 8 && placed.some((p) => Math.abs(p.y - y) < 10 && Math.abs(p.x - it.x) < 70); g++) y -= 10
      placed.push({ x: it.x, y })
      labelPos.set(it.id, { x: it.x, y })
    }
  }

  const startDrag = (e: React.PointerEvent, id: string): void => {
    e.stopPropagation()
    selectLayer(id)
    const st = useEditor.getState()
    const layer = st.project.layers.find((l) => l.id === id)
    if (!layer || layer.locked) return
    const start = evaluate(layer.transform.position, st.time) as Vec3
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    const key = `topdrag-${nanoid(6)}`
    const offset = unz(e.clientY - rect.top) - start[2]
    const move = (ev2: PointerEvent): void => {
      const s = useEditor.getState()
      const z = Math.round(unz(ev2.clientY - rect.top) - offset)
      s.update((d) => {
        const l = d.layers.find((x) => x.id === id)
        if (l) setValueAt(l.transform.position, s.time, [start[0], start[1], z], frameTolerance(s.project))
      }, key)
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="topview" ref={wrapRef} style={{ position: 'absolute', inset: 0 }} onPointerDown={() => selectLayer(null)}>
      <svg width={size.w} height={size.h}>
        <defs>
          <linearGradient id="frustum" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#3dd6f5" stopOpacity="0.22" />
            <stop offset="1" stopColor="#3dd6f5" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* depth grid */}
        {Array.from({ length: 9 }, (_, i) => {
          const y = pad + (i / 8) * (size.h - pad * 2)
          return <line key={i} x1={0} x2={size.w} y1={y} y2={y} stroke="#1a1e29" strokeWidth={1} />
        })}
        <line x1={0} x2={size.w} y1={sz(0)} y2={sz(0)} stroke="#2c3245" strokeDasharray="3 4" />
        <polygon
          points={`${sx(camPos[0])},${sz(camPos[2])} ${sx(lx)},${sz(lz)} ${sx(rx)},${sz(rz)}`}
          fill="url(#frustum)"
          stroke="#3dd6f5"
          strokeOpacity={0.35}
        />
        {layers.map((l) => {
          const half = (l.size[0] * l.scale[0]) / 2
          const y = sz(l.position[2])
          const isSel = l.layer.id === selected
          const color = TYPE_COLORS[l.layer.type]
          return (
            <g key={l.layer.id} className="tv-layer" onPointerDown={(e) => startDrag(e, l.layer.id)}>
              <line x1={sx(l.position[0] - half)} x2={sx(l.position[0] + half)} y1={y} y2={y} stroke="transparent" strokeWidth={12} />
              <line
                x1={sx(l.position[0] - half)}
                x2={sx(l.position[0] + half)}
                y1={y}
                y2={y}
                stroke={color}
                strokeWidth={isSel ? 3 : 2}
                strokeOpacity={l.active ? 1 : 0.35}
                strokeDasharray={l.layer.type === 'particles' ? '2 3' : undefined}
                style={{ filter: isSel ? `drop-shadow(0 0 4px ${color})` : undefined }}
              />
              <text className="tv-label" x={labelPos.get(l.layer.id)?.x ?? 0} y={labelPos.get(l.layer.id)?.y ?? y - 3}>
                {l.layer.name.slice(0, 14)}
              </text>
            </g>
          )
        })}
        <g transform={`translate(${sx(camPos[0])},${sz(camPos[2])})`}>
          <circle r={5} fill="#3dd6f5" />
          <circle r={9} fill="none" stroke="#3dd6f5" strokeOpacity={0.4} />
        </g>
      </svg>
    </div>
  )
}
