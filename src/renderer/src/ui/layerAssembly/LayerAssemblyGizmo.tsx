import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import type { AssembledLayerItem } from './types'
import type { Layer3DMeshInstance } from './layerAssembly3DMesh'
import {
  BOX_HANDLES,
  projectPoint,
  ringPoint,
  rotationBasis,
  type GizmoRect
} from '../../engine/layerGizmo'
import {
  startLayerAssemblyGizmoDrag,
  type LayerGizmoHandle
} from './layerAssemblyGizmoDrag'
import '../../styles/layer-gizmo.css'

export interface LayerAssemblyGizmoProps {
  layer: AssembledLayerItem | null
  instance: Layer3DMeshInstance | null
  camera: THREE.PerspectiveCamera | null
  rect: GizmoRect | null
  zExaggeration: number
  showTranslate?: boolean
  showRotate?: boolean
  tick?: number
  onUpdateLayer?: (id: string, patch: Partial<AssembledLayerItem>) => void
  onDragStateChange?: (isDragging: boolean) => void
}

/**
 * 3D Transform Gizmo cho layer được chọn trong Xưởng Lắp Ráp Layer:
 * - 3 Trục di chuyển 3D XYZ (Mũi tên X đỏ, Y xanh lá, Z xanh dương)
 * - 3 Vòng xoay góc quay theo 3 trục 3D (X đỏ: Pitch, Y xanh lá: Yaw, Z xanh dương: Roll)
 * - 8 điểm mút Bounding Box kéo giãn tỉ lệ (Scale handles)
 */
export function LayerAssemblyGizmo({
  layer,
  instance,
  camera,
  rect,
  zExaggeration,
  showTranslate = true,
  showRotate = true,
  onUpdateLayer,
  onDragStateChange
}: LayerAssemblyGizmoProps) {
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  if (!layer || !instance || !camera || !rect || rect.w <= 0 || rect.h <= 0) {
    return null
  }

  if (!showTranslate && !showRotate) {
    return null
  }

  // 1. Ma trận thế giới của layer mesh
  instance.group.updateMatrixWorld(true)
  const worldMatrix = instance.group.matrixWorld.clone()

  // 2. Điểm tâm Pivot và chiếu lên màn hình
  const pivot = new THREE.Vector3().setFromMatrixPosition(worldMatrix)
  const depth = pivot.clone().project(camera).z
  if (depth < -1 || depth > 1) {
    return null
  }

  const center = projectPoint(pivot, camera, rect)

  // 3. Kích thước hình học của mặt phẳng
  const planeGeom = instance.mesh.geometry as THREE.PlaneGeometry
  const baseW = planeGeom.parameters?.width || 320
  const baseH = planeGeom.parameters?.height || 320
  const w = baseW * layer.scale
  const h = baseH * layer.scale

  // 4. Tọa độ 8 điểm mút Bounding Box trên màn hình
  const handles = BOX_HANDLES.map(([hx, hy]) => {
    const localPt = new THREE.Vector3((hx * w) / 2, (hy * h) / 2, 0)
    const worldPt = localPt.applyMatrix4(worldMatrix)
    return projectPoint(worldPt, camera, rect)
  })

  // 5. Tính bán kính vòng xoay phù hợp với khoảng cách camera
  const camDir = camera.getWorldDirection(new THREE.Vector3())
  const camRight = camDir.clone().cross(camera.up).normalize()
  const unit = pivot.clone().add(camRight)
  const pixel = projectPoint(unit, camera, rect)
  const radius = 54 / Math.max(0.001, Math.hypot(pixel[0] - center[0], pixel[1] - center[1]))

  // 6. Vector xoay 3D hiện tại [rotX, rotY, rotZ]
  const currentRot: [number, number, number] = [
    layer.rotationX || 0,
    layer.rotationY || 0,
    layer.rotation || 0
  ]

  // 7. Dữ liệu các trục tọa độ 3D và 3 vòng xoay (X: đỏ, Y: xanh lá, Z: xanh dương)
  const parent = new THREE.Matrix4()
  const axesData = [0, 1, 2].map((axis) => {
    const basis = rotationBasis(currentRot, axis, parent)
    const points = Array.from({ length: 65 }, (_, i) => {
      const angle = (i / 64) * Math.PI * 2
      const ptWorld = ringPoint(axis, angle)
        .transformDirection(basis)
        .multiplyScalar(radius)
        .add(pivot)
      return projectPoint(ptWorld, camera, rect)
    })
    const direction = new THREE.Vector3(
      axis === 0 ? 1 : 0,
      axis === 1 ? 1 : 0,
      axis === 2 ? -1 : 0
    ).transformDirection(parent)
    const endWorld = direction.multiplyScalar(radius * 1.6).add(pivot)
    const end = projectPoint(endWorld, camera, rect)
    const edgeOn = Math.hypot(end[0] - center[0], end[1] - center[1]) < 14
    if (edgeOn) {
      end[0] = center[0] + 28
      end[1] = center[1] + 32
    }
    const angleDeg = (Math.atan2(end[1] - center[1], end[0] - center[0]) * 180) / Math.PI
    return { axis, points, end, edgeOn, angleDeg }
  })

  function begin(e: React.PointerEvent, handle: LayerGizmoHandle): void {
    if (e.button !== 0 || !layer || !camera || !rect || !onUpdateLayer) return
    e.preventDefault()
    e.stopPropagation()
    cleanupRef.current?.()
    cleanupRef.current = startLayerAssemblyGizmoDrag(
      e,
      {
        layer,
        camera,
        rect,
        worldMatrix,
        zExaggeration,
        onUpdateLayer,
        onDragStateChange
      },
      handle
    )
  }

  return (
    <svg
      className="layer-gizmo"
      aria-label="3D Layer Transform Gizmo"
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        pointerEvents: 'none'
      }}
    >
      {/* Khung chữ nhật bao quanh Bounding Box & 8 điểm mút Scale */}
      {showTranslate && (
        <>
          <polygon
            className="gizmo-box"
            points={[0, 2, 4, 6].map((i) => handles[i].join(',')).join(' ')}
          />

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
              <title>Kéo tỉ lệ layer · Shift: bước 0.1 · Esc: hủy</title>
            </rect>
          ))}
        </>
      )}

      {/* 3 Trục tọa độ và 3 Vòng xoay góc 3D (X: đỏ, Y: xanh lá, Z: xanh dương) */}
      {axesData.map(({ axis, points, end, edgeOn, angleDeg }) => {
        const angleRad = (angleDeg * Math.PI) / 180
        const badgeX = end[0] + Math.cos(angleRad) * 16
        const badgeY = end[1] + Math.sin(angleRad) * 16
        const pointsStr = points.map((p) => p.join(',')).join(' ')
        const axisLetter = 'XYZ'[axis]
        const rotLabel = ['Nghiêng (Pitch)', 'Lắc (Yaw)', 'Xoay (Roll)'][axis]

        return (
          <g key={`axis-${axis}`} className={`gizmo-axis gizmo-axis-${axis}`}>
            {/* Vòng xoay góc 3D với vùng tương tác mở rộng 22px */}
            {showRotate && (
              <g className="gizmo-ring-group">
                <polyline
                  className="gizmo-ring-hit"
                  points={pointsStr}
                  onPointerDown={(e) => begin(e, { kind: 'rotate', axis })}
                >
                  <title>Xoay trục {axisLetter} ({rotLabel}) · Shift: bước 15° · Esc: hủy</title>
                </polyline>
                <polyline className="gizmo-ring" points={pointsStr} />
              </g>
            )}

            {/* Trục di chuyển tịnh tiến XYZ */}
            {showTranslate && (
              <g
                className="gizmo-translate"
                onPointerDown={(e) => begin(e, { kind: 'translate', axis, edgeOn })}
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
                    {axisLetter}
                  </text>
                </g>
                <title>
                  {axis === 0
                    ? `Kéo trục X (Ngang: ${layer.x}px) · Shift: bước 10px`
                    : axis === 1
                      ? `Kéo trục Y (Dọc: ${layer.y}px) · Shift: bước 10px`
                      : `Kéo trục Z (Độ sâu: ${layer.z}px) · Shift: bước 10px`}
                  {' · Esc: hủy'}
                </title>
              </g>
            )}
          </g>
        )
      })}

      {/* Điểm tâm Pivot */}
      <circle className="gizmo-pivot" cx={center[0]} cy={center[1]} r={5} />

      {/* Thẻ hiển thị thông số tọa độ ngay dưới Gizmo */}
      <text className="gizmo-readout" x={center[0] + 12} y={center[1] + 68}>
        P: {layer.x}, {layer.y}, {layer.z} · R: {layer.rotationX || 0}°, {layer.rotationY || 0}°, {Math.round(layer.rotation)}° · S: {Math.round(layer.scale * 100)}%
      </text>
    </svg>
  )
}
