import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import type { LayerComposite, AssembledLayerItem } from './types'
import {
  createLayer3DInstance,
  updateLayer3DInstance,
  updateLayerInstanceTexture,
  createCameraFrustumHelper,
  createCameraClippingPlanes,
  createCanvasPlaneHelper,
  disposeCanvasPlaneHelper,
  computeFramingDistance,
  createDepthGuideLine,
  type Layer3DMeshInstance
} from './layerAssembly3DMesh'
import { getLayerFullResUrl } from './useLayerAssetImage'
import { resolveFaceTexture } from '../assets/models3d/textureResolver'
import { LayerAssembly3DToolbar } from './LayerAssembly3DToolbar'
import { LayerAssemblyGizmo } from './LayerAssemblyGizmo'
import { useView } from '../../store/view'
import type { GizmoRect } from '../../engine/layerGizmo'
import {
  createLightRig,
  applyLightRig,
  disposeLightRig,
  type SceneLightRig,
  type RigBounds
} from '../assets/models3d/assemblySceneLighting'
import {
  resolveLightRig,
  resolveSkyAtmosphere,
  normalizeLighting,
  DEFAULT_LIGHTING
} from '../assets/models3d/assemblyLighting'
import type { AssemblyLighting } from '../assets/models3d/types'

export interface LayerAssembly3DViewportProps {
  composite: LayerComposite
  selectedLayerId: string | null
  selectedIds?: string[]
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onUpdateLayer?: (id: string, patch: Partial<AssembledLayerItem>) => void
  onChangeComposite?: (update: LayerComposite | ((prev: LayerComposite) => LayerComposite)) => void
  time: number
}

type CameraPreset = 'orbit' | 'top' | 'side' | 'front'

export function LayerAssembly3DViewport({
  composite,
  selectedLayerId,
  selectedIds,
  onSelectLayer,
  onUpdateLayer,
  onChangeComposite,
  time
}: LayerAssembly3DViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Three.js instances
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const lightRigRef = useRef<SceneLightRig | null>(null)
  const layersGroupRef = useRef<THREE.Group | null>(null)
  const helpersGroupRef = useRef<THREE.Group | null>(null)
  const canvasBoxRef = useRef<THREE.Group | null>(null)
  const frustumHelperRef = useRef<THREE.LineSegments | null>(null)
  const depthGuideRef = useRef<THREE.Line | null>(null)
  const targetMarkerRef = useRef<THREE.Group | null>(null)

  // Mesh instances map
  const meshInstancesRef = useRef<Map<string, Layer3DMeshInstance>>(new Map())

  // Kích thước thực tế của viewport container
  const viewDimsRef = useRef({ w: 600, h: 500 })
  const cameraPresetRef = useRef<CameraPreset>('orbit')

  // Hàm tính khoảng cách camera đóng khung vừa vặn chuẩn tỉ lệ khung hình thực tế
  const getFitDistance = useCallback(() => {
    const { w, h } = viewDimsRef.current
    return computeFramingDistance(composite.width, composite.height, w, h)
  }, [composite.width, composite.height])

  const initialFitDist = useMemo(() => {
    return computeFramingDistance(composite.width, composite.height, 500, 700)
  }, [composite.width, composite.height])

  // Camera Orbit state
  const orbitRef = useRef({
    azimuth: -0.55, // ~ -32 độ
    elevation: 0.35, // ~ 20 độ
    distance: initialFitDist,
    target: new THREE.Vector3(0, 0, 0)
  })

  const theme = useView((s) => s.theme)
  const isLight = theme === 'light'

  // Trạng thái Hướng sáng Ngày/Đêm & Đổ bóng 3D
  const [lighting, setLighting] = useState<AssemblyLighting>(() =>
    normalizeLighting(composite.lighting || DEFAULT_LIGHTING)
  )

  useEffect(() => {
    if (composite.lighting) {
      setLighting(normalizeLighting(composite.lighting))
    }
  }, [composite.lighting])

  const handleUpdateLighting = useCallback(
    (newLighting: AssemblyLighting) => {
      setLighting(newLighting)
      if (onChangeComposite) {
        onChangeComposite((prev) => ({
          ...prev,
          lighting: newLighting
        }))
      }
    },
    [onChangeComposite]
  )

  const [camDistance, setCamDistance] = useState(initialFitDist)
  const [zExaggeration, setZExaggeration] = useState(1.8) // Độ tách lớp Z mặc định 1.8x
  const [showGrid, setShowGrid] = useState(true)
  const [showFrustum, setShowFrustum] = useState(true)
  const [clipToCamera, setClipToCamera] = useState(true) // Cắt các phần layer vượt ra ngoài tầm nhìn camera
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('orbit')

  // Trạng thái Tầm nhìn (FOV), Góc xoay 360 độ, Điểm nhìn (Target) và Vị trí Camera
  const [cameraFov, setCameraFov] = useState(45)
  const [cameraYaw, setCameraYaw] = useState(-32)
  const [cameraPitch, setCameraPitch] = useState(20)
  const [cameraTarget, setCameraTarget] = useState({ x: 0, y: 0, z: 0 })
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0, z: initialFitDist })

  // 4 mặt phẳng cắt không gian camera 3D (Clipping Planes)
  const cameraClippingPlanes = useMemo(() => {
    return clipToCamera ? createCameraClippingPlanes(composite.width, composite.height) : []
  }, [clipToCamera, composite.width, composite.height])

  // 3D Gizmo states: Bật/tắt trục XYZ và vòng xoay góc
  const [showTranslate, setShowTranslate] = useState(true) // Trục di chuyển 3D XYZ
  const [showRotate, setShowRotate] = useState(true) // Vòng xoay góc 3D
  const [gizmoRect, setGizmoRect] = useState<GizmoRect | null>(null)
  const [gizmoTick, setGizmoTick] = useState(0)
  const isDraggingGizmoRef = useRef(false)
  const [isDraggingGizmo, setIsDraggingGizmo] = useState(false)

  // Layer được chọn & mesh instance 3D tương ứng
  const selectedLayer = useMemo(
    () => composite.layers.find((l) => l.id === selectedLayerId) || null,
    [composite.layers, selectedLayerId]
  )
  const selectedInst = selectedLayerId ? meshInstancesRef.current.get(selectedLayerId) || null : null

  // Mouse drag interaction
  const isDraggingRef = useRef(false)
  const dragModeRef = useRef<'orbit' | 'pan'>('orbit')
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, moved: false })

  const rafRef = useRef<number>(0)

  // ------------------------------------------------------------- 1. Setup Three.js Scene & Continuous Render Loop
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const width = container.clientWidth || 600
    const height = container.clientHeight || 500

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 60000)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    // Light Rig (Hệ thống chiếu sáng ngày/đêm và đổ bóng soft shadow)
    const lightRig = createLightRig(scene)
    lightRigRef.current = lightRig

    // Layers Root Group
    const layersGroup = new THREE.Group()
    layersGroup.name = 'layers-root'
    scene.add(layersGroup)
    layersGroupRef.current = layersGroup

    // Helpers Group (Lưới và trục)
    const helpersGroup = new THREE.Group()
    helpersGroup.name = 'helpers-root'
    scene.add(helpersGroup)
    helpersGroupRef.current = helpersGroup

    // Lưới mặt sàn 3D
    const gridHelper = new THREE.GridHelper(3000, 40, 0x2680eb, 0x334155)
    gridHelper.position.y = -composite.height / 2
    helpersGroup.add(gridHelper)

    // Trục tọa độ (X đỏ, Y xanh lá, Z xanh dương)
    const axesHelper = new THREE.AxesHelper(140)
    axesHelper.position.set(-composite.width / 2, -composite.height / 2, 0)
    helpersGroup.add(axesHelper)

    // Khung chữ nhật & Mặt phẳng Canvas 2D tại z = 0 (cyan outline + dark card + center crosshairs)
    const canvasBox = createCanvasPlaneHelper(composite.width, composite.height)
    scene.add(canvasBox)
    canvasBoxRef.current = canvasBox

    // Hình nón tháp Camera Frustum 3D
    const frustumHelper = createCameraFrustumHelper(composite.width, composite.height, initialFitDist, isLight)
    frustumHelper.visible = showFrustum && cameraPresetRef.current !== 'front'
    scene.add(frustumHelper)
    frustumHelperRef.current = frustumHelper

    // 🎯 Điểm nhìn mục tiêu (Target Marker 3D)
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
    scene.add(targetMarker)
    targetMarkerRef.current = targetMarker

    setGizmoRect({ x: 0, y: 0, w: width, h: height })

    // Vòng lặp render liên tục 60fps (đảm bảo camera orbit, zoom và chuyển động layer mượt mà)
    const prevOrbit = { az: NaN, el: NaN, dist: NaN, target: new THREE.Vector3(NaN, NaN, NaN) }
    let animId = 0
    const render = () => {
      const r = rendererRef.current
      const s = sceneRef.current
      const cam = cameraRef.current
      if (r && s && cam) {
        const o = orbitRef.current
        const cosEl = Math.cos(o.elevation)
        const sinEl = Math.sin(o.elevation)
        const sinAz = Math.sin(o.azimuth)
        const cosAz = Math.cos(o.azimuth)

        cam.position.set(
          o.target.x + o.distance * cosEl * sinAz,
          o.target.y + o.distance * sinEl,
          o.target.z + o.distance * cosEl * cosAz
        )
        cam.lookAt(o.target)
        cam.updateMatrixWorld()

        if (targetMarkerRef.current) {
          targetMarkerRef.current.position.copy(o.target)
          targetMarkerRef.current.quaternion.copy(cam.quaternion)
          targetMarkerRef.current.visible = showGrid || o.target.lengthSq() > 1
        }

        if (
          o.azimuth !== prevOrbit.az ||
          o.elevation !== prevOrbit.el ||
          o.distance !== prevOrbit.dist ||
          !o.target.equals(prevOrbit.target)
        ) {
          prevOrbit.az = o.azimuth
          prevOrbit.el = o.elevation
          prevOrbit.dist = o.distance
          prevOrbit.target.copy(o.target)
          setGizmoTick((t) => (t + 1) | 0)
        }

        r.render(s, cam)
      }
      animId = requestAnimationFrame(render)
    }
    render()

    // Resize Observer
    const ro = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w <= 0 || h <= 0) return
      viewDimsRef.current = { w, h }
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      rendererRef.current.setSize(w, h)
      setGizmoRect({ x: 0, y: 0, w, h })
      setGizmoTick((t) => (t + 1) | 0)

      // Nếu đang ở góc nhìn Front (Camera chính diện), tự động cân đối khoảng cách vừa vặn tỉ lệ khung hình mới
      if (cameraPresetRef.current === 'front') {
        const fitD = computeFramingDistance(composite.width, composite.height, w, h)
        orbitRef.current.distance = fitD
        setCamDistance(fitD)
      }
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.dispose()
      if (canvasBoxRef.current) {
        disposeCanvasPlaneHelper(canvasBoxRef.current)
        canvasBoxRef.current = null
      }
      if (lightRigRef.current) {
        disposeLightRig(lightRigRef.current)
        lightRigRef.current = null
      }
      if (targetMarkerRef.current) {
        scene.remove(targetMarkerRef.current)
        targetMarkerRef.current = null
      }
      meshInstancesRef.current.clear()
    }
  }, [])

  // ------------------------------------------------------------- Cập nhật Hướng sáng Ngày/Đêm & Đổ bóng 3D
  useEffect(() => {
    if (!lightRigRef.current) return
    const spec = resolveLightRig(lighting)
    const bounds: RigBounds = {
      center: new THREE.Vector3(0, 0, 0),
      radius: Math.max(composite.width, composite.height, 400) * 0.9,
      minY: -composite.height / 2
    }
    applyLightRig(lightRigRef.current, spec, bounds)
  }, [lighting, composite.width, composite.height])

  const sky = useMemo(() => resolveSkyAtmosphere(lighting, isLight), [lighting, isLight])

  // ------------------------------------------------------------- 2. Cập nhật khung tham chiếu Canvas & Frustum
  useEffect(() => {
    if (!sceneRef.current) return

    if (canvasBoxRef.current) {
      sceneRef.current.remove(canvasBoxRef.current)
      disposeCanvasPlaneHelper(canvasBoxRef.current)
      canvasBoxRef.current = null
    }
    const newBox = createCanvasPlaneHelper(composite.width, composite.height)
    sceneRef.current.add(newBox)
    canvasBoxRef.current = newBox

    if (frustumHelperRef.current) {
      sceneRef.current.remove(frustumHelperRef.current)
      frustumHelperRef.current.geometry.dispose()
      frustumHelperRef.current = null
    }
    const fitD = getFitDistance()
    const newFrustum = createCameraFrustumHelper(composite.width, composite.height, fitD, isLight)
    newFrustum.visible = showFrustum && cameraPreset !== 'front'
    sceneRef.current.add(newFrustum)
    frustumHelperRef.current = newFrustum
  }, [composite.width, composite.height, getFitDistance, showFrustum, cameraPreset, isLight])

  // ------------------------------------------------------------- 3. Bật tắt Helpers Lưới & Tháp Camera
  useEffect(() => {
    if (helpersGroupRef.current) {
      helpersGroupRef.current.visible = showGrid
    }
  }, [showGrid])

  useEffect(() => {
    if (frustumHelperRef.current) {
      frustumHelperRef.current.visible = showFrustum && cameraPreset !== 'front'
    }
  }, [showFrustum, cameraPreset])

  // ------------------------------------------------------------- 4. Đường gióng độ sâu Z cho layer được chọn
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (depthGuideRef.current) {
      scene.remove(depthGuideRef.current)
      depthGuideRef.current.geometry.dispose()
      depthGuideRef.current = null
    }

    const selLayer = composite.layers.find((l) => l.id === selectedLayerId)
    if (selLayer && Math.abs(selLayer.z) > 1) {
      const guide = createDepthGuideLine(selLayer.x, -selLayer.y, -selLayer.z * zExaggeration)
      scene.add(guide)
      depthGuideRef.current = guide
    }
  }, [selectedLayerId, composite.layers, zExaggeration])

  // Kích hoạt render lại và cập nhật hình học layer khi ảnh load xong
  const [renderTrigger, setRenderTrigger] = useState(0)
  const requestRender = useCallback(() => {
    setRenderTrigger((t) => (t + 1) | 0)
  }, [])

  // ------------------------------------------------------------- 6. Đồng bộ hóa Mesh các Layers
  useEffect(() => {
    const layersGroup = layersGroupRef.current
    if (!layersGroup) return

    const currentMap = meshInstancesRef.current
    const activeLayerIds = new Set(composite.layers.map((l) => l.id))

    // Xóa mesh của các layer không còn tồn tại
    for (const [id, inst] of currentMap.entries()) {
      if (!activeLayerIds.has(id)) {
        layersGroup.remove(inst.group)
        inst.mesh.geometry.dispose()
        inst.outline.geometry.dispose()
        inst.anchorDot.geometry.dispose()
        currentMap.delete(id)
      }
    }

    // Kiểm tra xem tất cả các layer có đang ở Z = 0 không
    const allZeroZ =
      composite.layers.length > 1 &&
      composite.layers.every((l) => Math.abs(l.z || 0) < 0.001)

    // Tạo hoặc cập nhật mesh cho từng layer với ảnh full-resolution sắc nét
    composite.layers.forEach((layer, idx) => {
      let inst = currentMap.get(layer.id)
      const fullResUrl = getLayerFullResUrl(layer.assetPath, layer.imageUrl)

      if (!inst) {
        inst = createLayer3DInstance(layer, fullResUrl, requestRender)
        layersGroup.add(inst.group)
        currentMap.set(layer.id, inst)
      } else if (fullResUrl && inst.currentTextureUrl !== fullResUrl) {
        updateLayerInstanceTexture(inst, fullResUrl, requestRender)
      }

      // Nếu chưa có texture url và có assetPath (e.g. built-in assets), giải quyết bất đồng bộ
      if (!fullResUrl && layer.assetPath) {
        resolveFaceTexture(layer.assetPath).then((res) => {
          if (res?.url && inst) {
            updateLayerInstanceTexture(inst, res.url, requestRender)
          }
        })
      }

      // Nếu tất cả layer có Z = 0, tự động phân tách tầng thị giác so le
      // để trong không gian 3D người dùng thấy rõ các tấm layer xếp chồng chứ không bị hợp nhất phẳng bẹp
      const visualLayer = allZeroZ
        ? {
            ...layer,
            z: Math.round((idx - (composite.layers.length - 1) / 2) * -50)
          }
        : layer

      // Thiết lập renderOrder để Three.js vẽ đúng thứ tự
      inst.mesh.renderOrder = idx

      updateLayer3DInstance(
        inst,
        visualLayer,
        time,
        zExaggeration,
        selectedIds ? selectedIds.includes(layer.id) : layer.id === selectedLayerId,
        idx,
        cameraClippingPlanes
      )
    })
  }, [composite.layers, time, zExaggeration, selectedLayerId, selectedIds, requestRender, renderTrigger, cameraClippingPlanes])

  // Native non-passive wheel listener để Chromium không chặn zoom
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const factor = e.deltaY < 0 ? 0.88 : 1.14
      const o = orbitRef.current
      const newDist = Math.round(Math.max(100, Math.min(6000, o.distance * factor)))
      o.distance = newDist
      setCamDistance(newDist)
    }

    container.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleNativeWheel)
    }
  }, [])

  // ------------------------------------------------------------- 7. Tương tác Chuột / Pointer
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isDraggingGizmoRef.current) return
    const container = containerRef.current
    if (!container) return

    // Chuột phải (button 2), Chuột giữa (button 1) hoặc giữ Shift -> Pan dịch chuyển góc nhìn
    if (e.button === 2 || e.button === 1 || e.shiftKey) {
      dragModeRef.current = 'pan'
    } else {
      dragModeRef.current = 'orbit'
    }

    isDraggingRef.current = true
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      moved: false
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - dragStartRef.current.mouseX
    const dy = e.clientY - dragStartRef.current.mouseY

    if (Math.hypot(dx, dy) > 3) {
      dragStartRef.current.moved = true
    }

    dragStartRef.current.mouseX = e.clientX
    dragStartRef.current.mouseY = e.clientY

    const o = orbitRef.current

    if (dragModeRef.current === 'orbit') {
      // Xoay tự do Orbit 360 độ (kéo chuột lên -> nhìn xuống, kéo chuột xuống -> nhìn lên)
      o.azimuth -= dx * 0.007
      o.elevation = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, o.elevation - dy * 0.007))
      setCameraPreset('orbit')
      cameraPresetRef.current = 'orbit'
    } else {
      // Pan dịch chuyển target trong không gian 3D
      const factor = (o.distance / 1000) * 1.2
      const camera = cameraRef.current
      if (camera) {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
        o.target.addScaledVector(right, -dx * factor).addScaledVector(up, dy * factor)
      }
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingGizmoRef.current) return
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}

    // Cập nhật vị trí và góc quay camera cho panel điều khiển
    const o = orbitRef.current
    const cam = cameraRef.current
    if (cam) {
      setCameraPosition({
        x: Math.round(cam.position.x),
        y: Math.round(cam.position.y),
        z: Math.round(cam.position.z)
      })
    }
    let yawDeg = Math.round((o.azimuth * 180) / Math.PI) % 360
    if (yawDeg > 180) yawDeg -= 360
    if (yawDeg < -180) yawDeg += 360
    setCameraYaw(yawDeg)
    setCameraPitch(Math.round((o.elevation * 180) / Math.PI))
    setCameraTarget({
      x: Math.round(o.target.x),
      y: Math.round(o.target.y),
      z: Math.round(o.target.z)
    })

    // Nếu chỉ click chuột (không rê chuột) -> Raycast chọn Layer
    if (!dragStartRef.current.moved && dragModeRef.current === 'orbit') {
      handleRaycastSelect(e)
    }
  }

  // Bắn tia Raycast để chọn layer trong 3D
  const handleRaycastSelect = (e: React.PointerEvent) => {
    const container = containerRef.current
    const camera = cameraRef.current
    if (!container || !camera) return

    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)

    const meshes: THREE.Mesh[] = []
    for (const inst of meshInstancesRef.current.values()) {
      if (inst.group.visible) meshes.push(inst.mesh)
    }

    const isAdditive = e.ctrlKey || e.metaKey || e.shiftKey
    const intersects = raycaster.intersectObjects(meshes, false)
    if (intersects.length > 0) {
      const hit = intersects[0]
      const hitLayerId = hit.object.userData?.layerId
      if (hitLayerId) {
        onSelectLayer(hitLayerId, isAdditive)
        return
      }
    }
    onSelectLayer(null, false)
  }

  // ------------------------------------------------------------- 8. Camera Controls & Quick Angles
  // Xử lý thay đổi tầm nhìn (FOV)
  const handleChangeCameraFov = (fov: number) => {
    setCameraFov(fov)
    if (cameraRef.current) {
      cameraRef.current.fov = fov
      cameraRef.current.updateProjectionMatrix()
      requestRender()
    }
  }

  // Xử lý thay đổi góc xoay ngang 360 độ (Yaw)
  const handleChangeCameraYaw = (yawDeg: number) => {
    setCameraYaw(yawDeg)
    const o = orbitRef.current
    o.azimuth = (yawDeg * Math.PI) / 180
    setCameraPreset('orbit')
    cameraPresetRef.current = 'orbit'
    requestRender()
  }

  // Xử lý thay đổi góc ngẩng / cúi (Pitch)
  const handleChangeCameraPitch = (pitchDeg: number) => {
    setCameraPitch(pitchDeg)
    const o = orbitRef.current
    o.elevation = (pitchDeg * Math.PI) / 180
    setCameraPreset('orbit')
    cameraPresetRef.current = 'orbit'
    requestRender()
  }

  // Xử lý thay đổi điểm nhìn (Target X, Y, Z)
  const handleChangeCameraTarget = (t: { x: number; y: number; z: number }) => {
    setCameraTarget(t)
    orbitRef.current.target.set(t.x, t.y, t.z)
    requestRender()
  }

  // Nhắm điểm nhìn vào layer đang chọn
  const handleAimAtSelectedLayer = useCallback(() => {
    if (!selectedLayer) return
    const o = orbitRef.current
    const tx = Math.round(selectedLayer.x)
    const ty = Math.round(-selectedLayer.y)
    const tz = Math.round(-selectedLayer.z * zExaggeration)
    o.target.set(tx, ty, tz)
    setCameraTarget({ x: tx, y: ty, z: tz })
    requestRender()
  }, [selectedLayer, zExaggeration, requestRender])

  const handleApplyPreset = (preset: CameraPreset) => {
    setCameraPreset(preset)
    cameraPresetRef.current = preset
    const o = orbitRef.current
    if (preset === 'top') {
      o.azimuth = 0
      o.elevation = Math.PI / 2 - 0.02
      setCameraYaw(0)
      setCameraPitch(89)
    } else if (preset === 'side') {
      o.azimuth = -Math.PI / 2
      o.elevation = 0
      setCameraYaw(-90)
      setCameraPitch(0)
    } else if (preset === 'front') {
      const fitD = getFitDistance()
      o.azimuth = 0
      o.elevation = 0
      o.target.set(0, 0, 0)
      o.distance = fitD
      setCamDistance(fitD)
      setCameraYaw(0)
      setCameraPitch(0)
      setCameraTarget({ x: 0, y: 0, z: 0 })
    } else {
      o.azimuth = -0.55
      o.elevation = 0.35
      setCameraYaw(-32)
      setCameraPitch(20)
    }
    requestRender()
  }

  // Áp dụng góc xoay nhanh chuẩn CameraControls
  const applyQuickAngle = (yawDeg: number, pitchDeg: number) => {
    const o = orbitRef.current
    o.azimuth = (yawDeg * Math.PI) / 180
    o.elevation = (pitchDeg * Math.PI) / 180
    setCameraYaw(yawDeg)
    setCameraPitch(pitchDeg)
    setCameraPreset('orbit')
    cameraPresetRef.current = 'orbit'
    requestRender()
  }

  // Vừa vặn khung hình tiêu chuẩn (Fit Framing Distance)
  const handleFitFramingDistance = () => {
    const o = orbitRef.current
    const fitD = getFitDistance()
    o.target.set(0, 0, 0)
    o.distance = fitD
    o.azimuth = 0
    o.elevation = 0
    setCamDistance(fitD)
    setCameraYaw(0)
    setCameraPitch(0)
    setCameraTarget({ x: 0, y: 0, z: 0 })
    setCameraPreset('front')
    cameraPresetRef.current = 'front'
    requestRender()
  }

  // Lấy nét lại toàn cảnh (Focus / Reset View)
  const handleFocusAll = () => {
    const o = orbitRef.current
    const fitD = getFitDistance()
    o.target.set(0, 0, 0)
    o.distance = fitD
    o.azimuth = -0.55
    o.elevation = 0.35
    setCamDistance(fitD)
    setCameraYaw(-32)
    setCameraPitch(20)
    setCameraTarget({ x: 0, y: 0, z: 0 })
    setCameraPreset('orbit')
    cameraPresetRef.current = 'orbit'
    requestRender()
  }

  // Phím tắt W (Trục XYZ) / E (Trục Xoay) cho Gizmo 3D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
        return
      }
      if (e.key === 'w' || e.key === 'W') {
        setShowTranslate((v) => !v)
      } else if (e.key === 'e' || e.key === 'E') {
        setShowRotate((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      ref={containerRef}
      className="layer-workshop-3d-viewport"
      style={{
        position: 'relative',
        flex: '1 1 0%',
        minWidth: 0,
        height: '100%',
        background: sky.background,
        transition: 'background 0.35s ease',
        overflow: 'hidden',
        userSelect: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isDraggingRef.current ? 'grabbing' : 'grab'
        }}
      />

      {/* 3D Gizmo tương tác trực tiếp trên Layer đã chọn */}
      {selectedLayer && selectedInst && cameraRef.current && (
        <LayerAssemblyGizmo
          layer={selectedLayer}
          instance={selectedInst}
          camera={cameraRef.current}
          rect={gizmoRect}
          zExaggeration={zExaggeration}
          showTranslate={showTranslate}
          showRotate={showRotate}
          tick={gizmoTick}
          onUpdateLayer={onUpdateLayer}
          onDragStateChange={(isDragging) => {
            setIsDraggingGizmo(isDragging)
            isDraggingGizmoRef.current = isDragging
            if (!isDragging) {
              requestRender()
            }
          }}
        />
      )}

      {/* 3D Vertical Dock Toolbar với Rich Tooltip chuẩn AE */}
      <LayerAssembly3DToolbar
        cameraPreset={cameraPreset}
        onApplyPreset={handleApplyPreset}
        onApplyQuickAngle={applyQuickAngle}
        onFitFramingDistance={handleFitFramingDistance}
        onFocusAll={handleFocusAll}
        showFrustum={showFrustum}
        onToggleFrustum={() => setShowFrustum((f) => !f)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((g) => !g)}
        clipToCamera={clipToCamera}
        onToggleClipToCamera={() => setClipToCamera((v) => !v)}
        showTranslate={showTranslate}
        onToggleTranslate={() => setShowTranslate((v) => !v)}
        showRotate={showRotate}
        onToggleRotate={() => setShowRotate((v) => !v)}
        camDistance={camDistance}
        onChangeCamDistance={(dist) => {
          orbitRef.current.distance = dist
          setCamDistance(dist)
          requestRender()
        }}
        zExaggeration={zExaggeration}
        onChangeZExaggeration={(zEx) => {
          setZExaggeration(zEx)
          requestRender()
        }}
        cameraFov={cameraFov}
        onChangeCameraFov={handleChangeCameraFov}
        cameraYaw={cameraYaw}
        onChangeCameraYaw={handleChangeCameraYaw}
        cameraPitch={cameraPitch}
        onChangeCameraPitch={handleChangeCameraPitch}
        cameraTarget={cameraTarget}
        onChangeCameraTarget={handleChangeCameraTarget}
        cameraPosition={cameraPosition}
        onAimAtSelectedLayer={handleAimAtSelectedLayer}
        selectedLayerName={selectedLayer ? selectedLayer.name : null}
        lighting={lighting}
        onChangeLighting={handleUpdateLighting}
      />

      {/* Floating Bottom Right Hint - góc phải thoáng đãng, không đè lên Transport Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '14px',
          fontSize: '10px',
          color: 'var(--text-dim)',
          background: 'var(--bg-1)',
          backdropFilter: 'blur(6px)',
          padding: '2px 8px',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: 30
        }}
      >
        Chuột trái: xoay 360° · Chuột giữa / Shift: dời · Cuộn: zoom · F: căn giữa
      </div>
    </div>
  )
}
