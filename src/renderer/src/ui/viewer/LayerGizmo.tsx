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
  const isModel3D = !!el.layer.model3d
  const compRef = el.layer.composite
  const isCompLocked = !!compRef?.lockedGroup
  const modelInstanceId = el.layer.model3d?.instanceId
  const compInstanceId = isCompLocked ? compRef?.instanceId : undefined

  const groupLayers = modelInstanceId
    ? scene.layers.filter((l) => l.layer.model3d?.instanceId === modelInstanceId)
    : compInstanceId
      ? scene.layers.filter((l) => l.layer.composite?.instanceId === compInstanceId)
      : [el]

  function begin(e: React.PointerEvent, frame: GizmoFrame, handle: GizmoHandle): void {
    if (e.button !== 0 || !el) return
    e.preventDefault()
    e.stopPropagation()
    cleanup.current?.()
    cleanup.current = startGizmoDrag(e, frame, el, parent, handle, groupLayers)
  }
  return <>{frames.map((frame) => <GizmoPane key={frame.key} frame={frame} el={el} parent={parent} time={time} begin={begin} groupLayers={groupLayers} />)}</>
}

function GizmoPane({ frame, el, parent, time, begin, groupLayers }: {
  frame: GizmoFrame; el: EvaluatedLayer; parent: THREE.Matrix4; time: number
  begin: (e: React.PointerEvent, frame: GizmoFrame, handle: GizmoHandle) => void
  groupLayers: EvaluatedLayer[]
}) {
  const { camera, rect } = frame
  const isModel3D = !!el.layer.model3d
  const compRef = el.layer.composite
  const isCompLocked = !!compRef?.lockedGroup
  const isGroup = isModel3D || isCompLocked

  let pivot: THREE.Vector3
  let groupBounds: THREE.Box3 | null = null

  if (isGroup) {
    groupBounds = new THREE.Box3()
    for (const gl of groupLayers) {
      if (!gl.bounds.isEmpty()) groupBounds.union(gl.bounds)
    }
    if (groupBounds.isEmpty()) groupBounds.copy(el.bounds)
    pivot = groupBounds.getCenter(new THREE.Vector3())
  } else {
    const anchor = el.layer.transform.anchor ? evaluate(el.layer.transform.anchor, time) : [0, 0, 0] as Vec3
    pivot = layerPivot(el, anchor)
  }

  const depth = pivot.clone().project(camera).z
  if (depth < -1 || depth > 1) return null
  const localRect = { ...rect, x: 0, y: 0 }
  const project = (p: THREE.Vector3): Point => projectPoint(p, camera, localRect)
  const center = project(pivot)

  let handles: Point[]
  let boxPoints: string

  if (isGroup && groupBounds) {
    const b = groupBounds
    const corners3D = [
      new THREE.Vector3(b.min.x, b.min.y, b.min.z),
      new THREE.Vector3(b.max.x, b.min.y, b.min.z),
      new THREE.Vector3(b.max.x, b.max.y, b.min.z),
      new THREE.Vector3(b.min.x, b.max.y, b.min.z),
      new THREE.Vector3(b.min.x, b.min.y, b.max.z),
      new THREE.Vector3(b.max.x, b.min.y, b.max.z),
      new THREE.Vector3(b.max.x, b.max.y, b.max.z),
      new THREE.Vector3(b.min.x, b.max.y, b.max.z)
    ]
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of corners3D) {
      const pt = project(c)
      if (pt[0] < minX) minX = pt[0]
      if (pt[1] < minY) minY = pt[1]
      if (pt[0] > maxX) maxX = pt[0]
      if (pt[1] > maxY) maxY = pt[1]
    }
    const pad = 6
    minX -= pad; minY -= pad; maxX += pad; maxY += pad
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2
    handles = [
      [minX, minY],
      [midX, minY],
      [maxX, minY],
      [maxX, midY],
      [maxX, maxY],
      [midX, maxY],
      [minX, maxY],
      [minX, midY]
    ]
    boxPoints = `${minX},${minY} ${maxX},${minY} ${maxX},${maxY} ${minX},${maxY}`
  } else {
    handles = BOX_HANDLES.map(([x, y]) => project(new THREE.Vector3(x * el.size[0] / 2, y * el.size[1] / 2, 0).applyMatrix4(el.world)))
    boxPoints = [0, 2, 4, 6].map((i) => handles[i].join(',')).join(' ')
  }

  const unit = pivot.clone().add(camera.getWorldDirection(new THREE.Vector3()).cross(camera.up).normalize())
  const pixel = project(unit)
  const radius = 48 / Math.max(0.001, Math.hypot(pixel[0] - center[0], pixel[1] - center[1]))
  const rotation = evaluate(el.layer.transform.rotation, time)
  const position = isGroup ? [pivot.x, pivot.y, -pivot.z] as Vec3 : evaluate(el.layer.transform.position, time)
  return <svg className="layer-gizmo" aria-label="Layer transform controls" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
    <polygon className="gizmo-box" points={boxPoints} />
    {handles.map(([x, y], i) => <rect key={i} className="gizmo-scale" x={x - 4} y={y - 4} width={8} height={8}
      onPointerDown={(e) => begin(e, frame, { kind: 'scale', handle: BOX_HANDLES[i] })}>
      <title>{isModel3D ? 'Co giãn Model 3D · Shift: giữ tỷ lệ · Esc: hủy' : isCompLocked ? 'Co giãn Cụm Layer · Shift: giữ tỷ lệ · Esc: hủy' : 'Kéo giãn ảnh · Shift: giữ tỷ lệ · Esc: hủy'}</title>
    </rect>)}
    {[0, 1, 2].map((axis) => {
      const basis = isGroup ? parent : rotationBasis(rotation, axis, parent)
      const points = Array.from({ length: 65 }, (_, i) => project(ringPoint(axis, i / 64 * Math.PI * 2).transformDirection(basis).multiplyScalar(radius).add(pivot)))
      const direction = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? -1 : 0).transformDirection(parent)
      const end = project(direction.multiplyScalar(radius * 1.6).add(pivot))
      const edgeOn = Math.hypot(end[0] - center[0], end[1] - center[1]) < 15
      if (edgeOn) { end[0] = center[0] + 28; end[1] = center[1] + 35 }
      const angleDeg = (Math.atan2(end[1] - center[1], end[0] - center[0]) * 180) / Math.PI
      const angleRad = (angleDeg * Math.PI) / 180
      const badgeX = end[0] + Math.cos(angleRad) * 16
      const badgeY = end[1] + Math.sin(angleRad) * 16
      const pointsStr = points.map((p) => p.join(',')).join(' ')

      return (
        <g key={axis} className={`gizmo-axis gizmo-axis-${axis}`}>
          {/* Rotation Ring with Expanded 22px Hit Area */}
          <g className="gizmo-ring-group">
            <polyline
              className="gizmo-ring-hit"
              points={pointsStr}
              onPointerDown={(e) => begin(e, frame, { kind: 'rotate', axis })}
            >
              <title>Xoay {'XYZ'[axis]} · Shift: bước 15° · Esc: hủy</title>
            </polyline>
            <polyline className="gizmo-ring" points={pointsStr} />
          </g>

          {/* Translation Axis with Hit Shaft, Visual Shaft, Arrowhead & Badge */}
          <g
            className="gizmo-translate"
            onPointerDown={(e) => begin(e, frame, { kind: 'translate', axis, edgeOn })}
          >
            <line
              className="gizmo-translate-hit"
              x1={center[0]}
              y1={center[1]}
              x2={end[0]}
              y2={end[1]}
            />
            <line
              className="gizmo-translate-shaft"
              x1={center[0]}
              y1={center[1]}
              x2={end[0]}
              y2={end[1]}
            />
            <path
              className="gizmo-arrow"
              d="M0,0 L-10,-5 L-7,0 L-10,5 Z"
              transform={`translate(${end.join(' ')}) rotate(${angleDeg})`}
            />
            <g className="gizmo-axis-badge" transform={`translate(${badgeX}, ${badgeY})`}>
              <circle className="gizmo-badge-bg" r={9} />
              <text className="gizmo-badge-text" textAnchor="middle" dominantBaseline="central">
                {'XYZ'[axis]}
              </text>
            </g>
            <title>
              Di chuyển {'XYZ'[axis]}
              {edgeOn ? ' · Kéo lên/xuống theo chiều sâu' : ''} · Shift: bước 10
            </title>
          </g>
        </g>
      )
    })}
    <circle className="gizmo-pivot" cx={center[0]} cy={center[1]} r={5} />
    <text className="gizmo-readout" x={center[0] + 12} y={center[1] + 100}>
      {isModel3D
        ? `Model 3D [${el.layer.model3d?.modelName || 'Khối 3D'}] · ${groupLayers.length} mặt`
        : isCompLocked
          ? `Cụm [${compRef?.compositeName || 'Layer'}] · 🔒 Khóa nhóm · ${groupLayers.length} lớp`
          : `P ${position.map((v) => v.toFixed(0)).join(' / ')} · R ${rotation.map((v) => `${v.toFixed(1)}°`).join(' / ')}`}
    </text>
  </svg>
}
