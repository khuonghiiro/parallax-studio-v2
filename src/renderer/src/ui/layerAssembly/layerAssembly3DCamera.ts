import * as THREE from 'three'
import { computeFramingDistance } from './layerAssembly3DMesh'
import { saveLayerWorkshopViewPrefs } from './layerAssemblyViewPrefs'

export type CameraPreset = 'orbit' | 'top' | 'side' | 'front'

export interface CameraOrbitState {
  azimuth: number
  elevation: number
  distance: number
  target: THREE.Vector3
}

export interface CameraPresetChangeCallbacks {
  setCameraPreset: (preset: CameraPreset) => void
  setCameraYaw: (yaw: number) => void
  setCameraPitch: (pitch: number) => void
  setCamDistance: (dist: number) => void
  setCameraTarget: (t: { x: number; y: number; z: number }) => void
  requestRender: () => void
}

/**
 * Áp dụng góc nhìn định sẵn (Top, Side, Front, Orbit)
 */
export function applyCameraPreset(
  preset: CameraPreset,
  orbit: CameraOrbitState,
  fitDistance: number,
  callbacks: CameraPresetChangeCallbacks
) {
  callbacks.setCameraPreset(preset)
  let nextYaw = -32
  let nextPitch = 20

  if (preset === 'top') {
    orbit.azimuth = 0
    orbit.elevation = Math.PI / 2 - 0.02
    nextYaw = 0
    nextPitch = 89
  } else if (preset === 'side') {
    orbit.azimuth = -Math.PI / 2
    orbit.elevation = 0
    nextYaw = -90
    nextPitch = 0
  } else if (preset === 'front') {
    orbit.azimuth = 0
    orbit.elevation = 0
    orbit.target.set(0, 0, 0)
    orbit.distance = fitDistance
    callbacks.setCamDistance(fitDistance)
    nextYaw = 0
    nextPitch = 0
    callbacks.setCameraTarget({ x: 0, y: 0, z: 0 })
  } else {
    orbit.azimuth = -0.55
    orbit.elevation = 0.35
    nextYaw = -32
    nextPitch = 20
  }

  callbacks.setCameraYaw(nextYaw)
  callbacks.setCameraPitch(nextPitch)
  saveLayerWorkshopViewPrefs({ cameraPreset: preset, cameraYaw: nextYaw, cameraPitch: nextPitch })
  callbacks.requestRender()
}

/**
 * Áp dụng góc xoay nhanh (Yaw & Pitch)
 */
export function applyQuickAngle(
  yawDeg: number,
  pitchDeg: number,
  orbit: CameraOrbitState,
  callbacks: Pick<CameraPresetChangeCallbacks, 'setCameraPreset' | 'setCameraYaw' | 'setCameraPitch' | 'requestRender'>
) {
  orbit.azimuth = (yawDeg * Math.PI) / 180
  orbit.elevation = (pitchDeg * Math.PI) / 180
  callbacks.setCameraYaw(yawDeg)
  callbacks.setCameraPitch(pitchDeg)
  callbacks.setCameraPreset('orbit')
  saveLayerWorkshopViewPrefs({ cameraYaw: yawDeg, cameraPitch: pitchDeg, cameraPreset: 'orbit' })
  callbacks.requestRender()
}

/**
 * Đóng khung vừa vặn camera (Fit Framing Distance)
 */
export function fitCameraFraming(
  orbit: CameraOrbitState,
  fitDistance: number,
  callbacks: CameraPresetChangeCallbacks
) {
  orbit.target.set(0, 0, 0)
  orbit.distance = fitDistance
  orbit.azimuth = 0
  orbit.elevation = 0
  callbacks.setCamDistance(fitDistance)
  callbacks.setCameraYaw(0)
  callbacks.setCameraPitch(0)
  callbacks.setCameraTarget({ x: 0, y: 0, z: 0 })
  callbacks.setCameraPreset('front')
  saveLayerWorkshopViewPrefs({ cameraPreset: 'front', cameraYaw: 0, cameraPitch: 0 })
  callbacks.requestRender()
}

/**
 * Focus toàn cảnh (Focus / Reset Orbit View)
 */
export function focusAllCamera(
  orbit: CameraOrbitState,
  fitDistance: number,
  callbacks: CameraPresetChangeCallbacks
) {
  orbit.target.set(0, 0, 0)
  orbit.distance = fitDistance
  orbit.azimuth = -0.55
  orbit.elevation = 0.35
  callbacks.setCamDistance(fitDistance)
  callbacks.setCameraYaw(-32)
  callbacks.setCameraPitch(20)
  callbacks.setCameraTarget({ x: 0, y: 0, z: 0 })
  callbacks.setCameraPreset('orbit')
  saveLayerWorkshopViewPrefs({ cameraPreset: 'orbit', cameraYaw: -32, cameraPitch: 20 })
  callbacks.requestRender()
}

/**
 * Cập nhật vị trí và hướng nhìn của PerspectiveCamera theo Orbit state
 */
export function updateOrbitCameraPosition(
  camera: THREE.PerspectiveCamera,
  orbit: CameraOrbitState
) {
  const cosEl = Math.cos(orbit.elevation)
  const sinEl = Math.sin(orbit.elevation)
  const sinAz = Math.sin(orbit.azimuth)
  const cosAz = Math.cos(orbit.azimuth)

  camera.position.set(
    orbit.target.x + orbit.distance * cosEl * sinAz,
    orbit.target.y + orbit.distance * sinEl,
    orbit.target.z + orbit.distance * cosEl * cosAz
  )
  camera.lookAt(orbit.target)
  camera.updateMatrixWorld()
}

/**
 * Tạo điểm nhìn mục tiêu (Target Marker 3D)
 */
export function createTargetMarkerMesh(): THREE.Group {
  const targetMarker = new THREE.Group()
  targetMarker.name = 'target-marker'
  const ringGeo = new THREE.RingGeometry(10, 12, 32)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
    depthTest: false
  })
  targetMarker.add(new THREE.Mesh(ringGeo, ringMat))
  return targetMarker
}

/**
 * Cập nhật tầm nhìn (FOV)
 */
export function updateCameraFov(
  fov: number,
  camera: THREE.PerspectiveCamera | null,
  setCameraFov: (fov: number) => void,
  requestRender: () => void
) {
  setCameraFov(fov)
  saveLayerWorkshopViewPrefs({ cameraFov: fov })
  if (camera) {
    camera.fov = fov
    camera.updateProjectionMatrix()
    requestRender()
  }
}

/**
 * Cập nhật góc xoay ngang (Yaw)
 */
export function updateCameraYaw(
  yawDeg: number,
  orbit: CameraOrbitState,
  setCameraYaw: (yaw: number) => void,
  setCameraPreset: (preset: CameraPreset) => void,
  cameraPresetRef: { current: CameraPreset },
  requestRender: () => void
) {
  setCameraYaw(yawDeg)
  saveLayerWorkshopViewPrefs({ cameraYaw: yawDeg, cameraPreset: 'orbit' })
  orbit.azimuth = (yawDeg * Math.PI) / 180
  setCameraPreset('orbit')
  cameraPresetRef.current = 'orbit'
  requestRender()
}

/**
 * Cập nhật góc ngẩng / cúi (Pitch)
 */
export function updateCameraPitch(
  pitchDeg: number,
  orbit: CameraOrbitState,
  setCameraPitch: (pitch: number) => void,
  setCameraPreset: (preset: CameraPreset) => void,
  cameraPresetRef: { current: CameraPreset },
  requestRender: () => void
) {
  setCameraPitch(pitchDeg)
  saveLayerWorkshopViewPrefs({ cameraPitch: pitchDeg, cameraPreset: 'orbit' })
  orbit.elevation = (pitchDeg * Math.PI) / 180
  setCameraPreset('orbit')
  cameraPresetRef.current = 'orbit'
  requestRender()
}

/**
 * Nhắm điểm nhìn vào layer đang chọn
 */
export function aimAtSelectedLayer(
  layer: { x: number; y: number; z: number },
  orbit: CameraOrbitState,
  zExaggeration: number,
  setCameraTarget: (t: { x: number; y: number; z: number }) => void,
  requestRender: () => void
) {
  const tx = Math.round(layer.x)
  const ty = Math.round(-layer.y)
  const tz = Math.round(-layer.z * zExaggeration)
  orbit.target.set(tx, ty, tz)
  setCameraTarget({ x: tx, y: ty, z: tz })
  requestRender()
}

