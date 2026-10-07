import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import type { Face3D } from './types'
import {
  BOX_HANDLES,
  projectPoint,
  ringPoint,
  rotationBasis,
  type GizmoRect
} from '../../../engine/layerGizmo'
import { composeDepthMatrix } from '../../../engine/spatial'
import {
  startAssemblyGizmoDrag,
  type AssemblyGizmoHandle
} from './assemblyGizmoDrag'
import '../../../styles/layer-gizmo.css'

export interface AssemblyGizmoProps {
  face: Face3D | null
  modelScale: number
  camera: THREE.PerspectiveCamera | null
  rect: GizmoRect | null
  mesh: THREE.Mesh | null
  onUpdateFace: (faceId: string, updates: Partial<Face3D>) => void
  onDragStateChange?: (isDragging: boolean) => void
}

export function AssemblyGizmo({
  face,
  modelScale,
  camera,
  rect,
  mesh,
  onUpdateFace,
  onDragStateChange
}: AssemblyGizmoProps) {
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  if (!face || !camera || !rect || rect.w <= 0 || rect.h <= 0) return null

  const worldMatrix = mesh
    ? mesh.matrixWorld.clone()
    : composeDepthMatrix(
        [face.position[0] * modelScale, face.position[1] * modelScale, face.position[2] * modelScale],
        face.rotation,
        [1, 1, 1],
        undefined,
        [0, 0, 0],
        [face.width * modelScale, face.height * modelScale]
      )

  const pivot = new THREE.Vector3().setFromMatrixPosition(worldMatrix)
  const depth = pivot.clone().project(camera).z
  if (depth < -1 || depth > 1) return null

  const center = projectPoint(pivot, camera, rect)
  const w = face.width * modelScale
  const h = face.height * modelScale

  const handles = BOX_HANDLES.map(([hx, hy]) => {
    const localPt = new THREE.Vector3((hx * w) / 2, (hy * h) / 2, 0)
    const worldPt = localPt.applyMatrix4(worldMatrix)
    return projectPoint(worldPt, camera, rect)
  })

  const camDir = camera.getWorldDirection(new THREE.Vector3())
  const camRight = camDir.clone().cross(camera.up).normalize()
  const unit = pivot.clone().add(camRight)
  const pixel = projectPoint(unit, camera, rect)
  const radius = 48 / Math.max(0.001, Math.hypot(pixel[0] - center[0], pixel[1] - center[1]))

  const parent = new THREE.Matrix4()
  const axesData = [0, 1, 2].map((axis) => {
    const basis = rotationBasis(face.rotation, axis, parent)
    const points = Array.from({ length: 65 }, (_, i) => {
      const angle = (i / 64) * Math.PI * 2
      const ptWorld = ringPoint(axis, angle).transformDirection(basis).multiplyScalar(radius).add(pivot)
      return projectPoint(ptWorld, camera, rect)
    })
    const direction = new THREE.Vector3(
      axis === 0 ? 1 : 0,
      axis === 1 ? 1 : 0,
      axis === 2 ? -1 : 0
    ).transformDirection(parent)
    const endWorld = direction.multiplyScalar(radius * 1.6).add(pivot)
    const end = projectPoint(endWorld, camera, rect)
    const edgeOn = Math.hypot(end[0] - center[0], end[1] - center[1]) < 15
    if (edgeOn) {
      end[0] = center[0] + 28
      end[1] = center[1] + 35
    }
    const angleDeg = (Math.atan2(end[1] - center[1], end[0] - center[0]) * 180) / Math.PI
    return { axis, points, end, edgeOn, angleDeg }
  })

  function begin(e: React.PointerEvent, handle: AssemblyGizmoHandle): void {
    if (e.button !== 0 || !face) return
    e.preventDefault()
    e.stopPropagation()
    cleanupRef.current?.()
    cleanupRef.current = startAssemblyGizmoDrag(
      e,
      {
        face,
        modelScale,
        camera,
        rect,
        worldMatrix,
        onUpdateFace,
        onDragStateChange
      },
      handle
    )
  }

  return (
    <svg
      className="layer-gizmo"
      aria-label="3D Face transform gizmo"
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        pointerEvents: 'none'
      }}
    >
      {/* Bounding box polygon */}
      <polygon
        className="gizmo-box"
        points={[0, 2, 4, 6].map((i) => handles[i].join(',')).join(' ')}
      />

      {/* 8 Bounding Box Scale Handles */}
      {handles.map(([hx, hy], i) => (
        <rect
          key={`scale-${i}`}
          className="gizmo-scale"
          x={hx - 4}
          y={hy - 4}
          width={8}
          height={8}
          onPointerDown={(e) => begin(e, { kind: 'scale', handle: BOX_HANDLES[i] })}
        >
          <title>Kéo giãn ảnh · Shift: giữ tỷ lệ · Esc: hủy</title>
        </rect>
      ))}

      {/* 3 Rotation Rings & Translation Axes */}
      {axesData.map(({ axis, points, end, edgeOn, angleDeg }) => (
        <g key={`axis-${axis}`} className={`gizmo-axis gizmo-axis-${axis}`}>
          <polyline
            className="gizmo-ring"
            points={points.map((p) => p.join(',')).join(' ')}
            onPointerDown={(e) => begin(e, { kind: 'rotate', axis })}
          >
            <title>Xoay {'XYZ'[axis]} · Shift: bước 15° · Esc: hủy</title>
          </polyline>
          <g
            className="gizmo-translate"
            onPointerDown={(e) => begin(e, { kind: 'translate', axis, edgeOn })}
          >
            <path d={`M${center.join(',')} L${end.join(',')}`} />
            <path
              className="gizmo-arrow"
              d="M0,0 L-9,-4 L-9,4 Z"
              transform={`translate(${end.join(' ')}) rotate(${angleDeg})`}
            />
            <text x={end[0] + 7} y={end[1] - 7}>
              {'XYZ'[axis]}
            </text>
            <title>
              Di chuyển {'XYZ'[axis]}
              {edgeOn ? ' · Kéo theo chiều sâu' : ''} · Shift: bước 10 · Esc: hủy
            </title>
          </g>
        </g>
      ))}

      {/* Center Pivot */}
      <circle className="gizmo-pivot" cx={center[0]} cy={center[1]} r={4} />

      {/* Coordinates Readout */}
      <text className="gizmo-readout" x={center[0] + 12} y={center[1] + 80}>
        P {face.position.join(' / ')} · R {face.rotation.map((v) => `${v}°`).join(' / ')} · {face.width}×{face.height}
      </text>
    </svg>
  )
}
