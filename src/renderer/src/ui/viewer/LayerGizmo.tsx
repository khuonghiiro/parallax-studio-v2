import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '@shared/types'
import { evaluate } from '../../animation/keyframes'
import { evaluateScene, type EvaluatedLayer } from '../../engine/evaluateScene'
import { BOX_HANDLES, layerPivot, parentMatrix, projectPoint, ringPoint, rotationBasis, type GizmoRect, type Point } from '../../engine/layerGizmo'
import { useEditor } from '../../store/editor'
import { startGizmoDrag, type GizmoHandle } from './gizmoDrag'
import '../../styles/layer-gizmo.css'

export interface GizmoFrame { camera: THREE.Camera; rect: GizmoRect; key: string }
export interface GizmoController { update(frames: GizmoFrame[]): void }

export function LayerGizmo({ controller }: { controller: React.RefObject<GizmoController | null> }) {
  const [frames, setFrames] = useState<GizmoFrame[]>([])
  const cleanup = useRef<(() => void) | null>(null)
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selected = useEditor((s) => s.selectedLayerId)
  const playing = useEditor((s) => s.playing)
  const scene = evaluateScene(project, time)
  const el = scene.layers.find((l) => l.layer.id === selected)
  useEffect(() => {
    controller.current = { update: setFrames }
    return () => { controller.current = null; cleanup.current?.() }
  }, [controller])
  if (!el || !el.active || el.layer.locked || playing) return null
  const parent = parentMatrix(el, scene)
  function begin(e: React.PointerEvent, frame: GizmoFrame, handle: GizmoHandle): void {
    if (e.button !== 0 || !el) return
    e.preventDefault()
    e.stopPropagation()
    cleanup.current?.()
    cleanup.current = startGizmoDrag(e, frame, el, parent, handle)
  }
  return <>{frames.map((frame) => <GizmoPane key={frame.key} frame={frame} el={el} parent={parent} time={time} begin={begin} />)}</>
}

function GizmoPane({ frame, el, parent, time, begin }: {
  frame: GizmoFrame; el: EvaluatedLayer; parent: THREE.Matrix4; time: number
  begin: (e: React.PointerEvent, frame: GizmoFrame, handle: GizmoHandle) => void
}) {
  const { camera, rect } = frame
  const anchor = el.layer.transform.anchor ? evaluate(el.layer.transform.anchor, time) : [0, 0, 0] as Vec3
  const pivot = layerPivot(el, anchor)
  const depth = pivot.clone().project(camera).z
  if (depth < -1 || depth > 1) return null
  const localRect = { ...rect, x: 0, y: 0 }
  const project = (p: THREE.Vector3): Point => projectPoint(p, camera, localRect)
  const center = project(pivot)
  const handles = BOX_HANDLES.map(([x, y]) => project(new THREE.Vector3(x * el.size[0] / 2, y * el.size[1] / 2, 0).applyMatrix4(el.world)))
  const unit = pivot.clone().add(camera.getWorldDirection(new THREE.Vector3()).cross(camera.up).normalize())
  const pixel = project(unit)
  const radius = 48 / Math.max(0.001, Math.hypot(pixel[0] - center[0], pixel[1] - center[1]))
  const rotation = evaluate(el.layer.transform.rotation, time)
  const position = evaluate(el.layer.transform.position, time)
  return <svg className="layer-gizmo" aria-label="Layer transform controls" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
    <polygon className="gizmo-box" points={[0, 2, 4, 6].map((i) => handles[i].join(',')).join(' ')} />
    {handles.map(([x, y], i) => <rect key={i} className="gizmo-scale" x={x - 4} y={y - 4} width={8} height={8}
      onPointerDown={(e) => begin(e, frame, { kind: 'scale', handle: BOX_HANDLES[i] })}>
      <title>Kéo giãn ảnh · Shift: giữ tỷ lệ · Esc: hủy</title>
    </rect>)}
    {[0, 1, 2].map((axis) => {
      const basis = rotationBasis(rotation, axis, parent)
      const points = Array.from({ length: 65 }, (_, i) => project(ringPoint(axis, i / 64 * Math.PI * 2).transformDirection(basis).multiplyScalar(radius).add(pivot)))
      const direction = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? -1 : 0).transformDirection(parent)
      const end = project(direction.multiplyScalar(radius * 1.6).add(pivot))
      const edgeOn = Math.hypot(end[0] - center[0], end[1] - center[1]) < 15
      if (edgeOn) { end[0] = center[0] + 28; end[1] = center[1] + 35 }
      return <g key={axis} className={`gizmo-axis gizmo-axis-${axis}`}>
        <polyline className="gizmo-ring" points={points.map((p) => p.join(',')).join(' ')} onPointerDown={(e) => begin(e, frame, { kind: 'rotate', axis })}>
          <title>Xoay {'XYZ'[axis]} · Shift: bước 15° · Esc: hủy</title>
        </polyline>
        <g className="gizmo-translate" onPointerDown={(e) => begin(e, frame, { kind: 'translate', axis, edgeOn })}>
          <path d={`M${center.join(',')} L${end.join(',')}`} />
          <path className="gizmo-arrow" d="M0,0 L-9,-4 L-9,4 Z" transform={`translate(${end.join(' ')}) rotate(${Math.atan2(end[1] - center[1], end[0] - center[0]) * 180 / Math.PI})`} />
          <text x={end[0] + 7} y={end[1] - 7}>{'XYZ'[axis]}</text>
          <title>Di chuyển {'XYZ'[axis]}{edgeOn ? ' · Kéo lên/xuống theo chiều sâu' : ''} · Shift: bước 10</title>
        </g>
      </g>
    })}
    <circle className="gizmo-pivot" cx={center[0]} cy={center[1]} r={4} />
    <text className="gizmo-readout" x={center[0] + 12} y={center[1] + 100}>
      P {position.map((v) => v.toFixed(0)).join(' / ')} · R {rotation.map((v) => `${v.toFixed(1)}°`).join(' / ')}
    </text>
  </svg>
}
