import * as THREE from 'three'
import type { LayerComposite, AssembledLayerItem } from './types'
import type { Layer3DMeshInstance } from './layerAssembly3DMesh'
import { findLayerMeshHit, createLayerDragPlane } from './layerAssembly3DDirectDrag'
import type { CameraOrbitState, CameraPreset } from './layerAssembly3DCamera'

export interface LayerDragState {
  layerId: string
  startHitPoint: THREE.Vector3
  dragPlane: THREE.Plane
  instance: Layer3DMeshInstance
  startLayerX: number
  startLayerY: number
  startLayerZ: number
  rotationX: number
  rotationY: number
}

export interface PointerHandlerDeps {
  container: HTMLDivElement | null
  camera: THREE.PerspectiveCamera | null
  meshInstances: Map<string, Layer3DMeshInstance>
  composite: LayerComposite
  isDraggingGizmoRef: { current: boolean }
  isDraggingRef: { current: boolean }
  dragModeRef: { current: 'orbit' | 'pan' | 'layer' }
  dragStartRef: { current: { mouseX: number; mouseY: number; moved: boolean } }
  layerDragStateRef: { current: LayerDragState | null }
  orbitRef: { current: CameraOrbitState }
  cameraPresetRef: { current: CameraPreset }
  zExaggeration: number
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onUpdateLayer?: (id: string, patch: Partial<AssembledLayerItem>) => void
  setCameraPreset: (preset: CameraPreset) => void
  setCameraYaw: (yaw: number) => void
  setCameraPitch: (pitch: number) => void
  setCameraTarget: (t: { x: number; y: number; z: number }) => void
  setCameraPosition: (p: { x: number; y: number; z: number }) => void
  requestRender: () => void
}

export function handle3DPointerDown(e: React.PointerEvent, deps: PointerHandlerDeps) {
  if (deps.isDraggingGizmoRef.current) return
  const { container, camera } = deps
  if (!container || !camera) return

  const target = e.target as HTMLElement
  if (target.tagName.toLowerCase() !== 'canvas' && target !== container) {
    return
  }

  // Click layer để kéo trực tiếp
  if (e.button === 0 && !e.altKey && !e.shiftKey) {
    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)
    const hit = findLayerMeshHit(raycaster, deps.meshInstances)

    if (hit) {
      const isAdditive = e.ctrlKey || e.metaKey
      if (isAdditive) {
        deps.onSelectLayer(hit.layerId, true)
        return
      }
      deps.onSelectLayer(hit.layerId, false)
      const hitLayer = deps.composite.layers.find((l) => l.id === hit.layerId)
      if (hitLayer && !hitLayer.locked && deps.onUpdateLayer) {
        const plane = createLayerDragPlane(hit.instance, camera, hit.point)
        deps.layerDragStateRef.current = {
          layerId: hit.layerId,
          startHitPoint: hit.point.clone(),
          dragPlane: plane,
          instance: hit.instance,
          startLayerX: hitLayer.x,
          startLayerY: hitLayer.y,
          startLayerZ: hitLayer.z,
          rotationX: hitLayer.rotationX || 0,
          rotationY: hitLayer.rotationY || 0
        }
        deps.dragModeRef.current = 'layer'
        deps.isDraggingRef.current = true
        deps.dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, moved: false }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        return
      }
    }
  }

  deps.dragModeRef.current = e.button === 2 || e.button === 1 || e.shiftKey ? 'pan' : 'orbit'
  deps.isDraggingRef.current = true
  deps.dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, moved: false }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

export function handle3DPointerMove(e: React.PointerEvent, deps: PointerHandlerDeps) {
  if (!deps.isDraggingRef.current) return
  const { container, camera } = deps

  if (deps.dragModeRef.current === 'layer' && deps.layerDragStateRef.current && camera && container) {
    const s = deps.layerDragStateRef.current
    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)

    const currentHit = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(s.dragPlane, currentHit)) {
      const worldDelta = currentHit.clone().sub(s.startHitPoint)
      const patch: Partial<AssembledLayerItem> = {
        x: Math.round(s.startLayerX + worldDelta.x),
        y: Math.round(s.startLayerY - worldDelta.y)
      }
      if ((s.rotationX !== 0 || s.rotationY !== 0) && deps.zExaggeration > 0.001) {
        const deltaZ = -worldDelta.z / deps.zExaggeration
        patch.z = Math.round(s.startLayerZ + deltaZ)
      }
      deps.onUpdateLayer?.(s.layerId, patch)
      deps.requestRender()
    }
    return
  }

  const dx = e.clientX - deps.dragStartRef.current.mouseX
  const dy = e.clientY - deps.dragStartRef.current.mouseY
  if (Math.hypot(dx, dy) > 3) deps.dragStartRef.current.moved = true

  deps.dragStartRef.current.mouseX = e.clientX
  deps.dragStartRef.current.mouseY = e.clientY
  const o = deps.orbitRef.current

  if (deps.dragModeRef.current === 'orbit') {
    o.azimuth -= dx * 0.007
    o.elevation = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, o.elevation - dy * 0.007))
    deps.setCameraPreset('orbit')
    deps.cameraPresetRef.current = 'orbit'
  } else {
    const factor = (o.distance / 1000) * 1.2
    if (camera) {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
      o.target.addScaledVector(right, -dx * factor).addScaledVector(up, dy * factor)
    }
  }
}

export function handle3DPointerUp(e: React.PointerEvent, deps: PointerHandlerDeps) {
  if (deps.isDraggingGizmoRef.current || !deps.isDraggingRef.current) return
  deps.isDraggingRef.current = false
  try { ;(e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch {}

  if (deps.dragModeRef.current === 'layer') {
    deps.layerDragStateRef.current = null
    deps.dragModeRef.current = 'orbit'
    return
  }

  const o = deps.orbitRef.current
  const cam = deps.camera
  if (cam) {
    deps.setCameraPosition({ x: Math.round(cam.position.x), y: Math.round(cam.position.y), z: Math.round(cam.position.z) })
  }
  let yawDeg = Math.round((o.azimuth * 180) / Math.PI) % 360
  if (yawDeg > 180) yawDeg -= 360
  if (yawDeg < -180) yawDeg += 360
  deps.setCameraYaw(yawDeg)
  deps.setCameraPitch(Math.round((o.elevation * 180) / Math.PI))
  deps.setCameraTarget({ x: Math.round(o.target.x), y: Math.round(o.target.y), z: Math.round(o.target.z) })

  if (!deps.dragStartRef.current.moved && deps.dragModeRef.current === 'orbit') {
    handle3DRaycastSelect(e, deps)
  }
}

export function handle3DRaycastSelect(e: React.PointerEvent, deps: PointerHandlerDeps) {
  const { container, camera } = deps
  if (!container || !camera) return

  const rect = container.getBoundingClientRect()
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)

  const meshes: THREE.Mesh[] = []
  for (const inst of deps.meshInstances.values()) {
    if (inst.group.visible) meshes.push(inst.mesh)
  }

  const isAdditive = e.ctrlKey || e.metaKey || e.shiftKey
  const intersects = raycaster.intersectObjects(meshes, false)
  if (intersects.length > 0) {
    const hitId = intersects[0].object.userData?.layerId
    if (hitId) {
      deps.onSelectLayer(hitId, isAdditive)
      return
    }
  }
  deps.onSelectLayer(null, false)
}
