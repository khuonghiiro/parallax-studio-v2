import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import type { LayerComposite, AssembledLayerItem } from './types'
import {
  createLayer3DInstance,
  updateLayer3DInstance,
  updateLayerInstanceTexture,
  createRectOutline,
  createCameraFrustumHelper,
  createCameraClippingPlanes,
  createDepthGuideLine,
  type Layer3DMeshInstance
} from './layerAssembly3DMesh'
import { getLayerFullResUrl } from './useLayerAssetImage'
import { resolveFaceTexture } from '../assets/models3d/textureResolver'
import { useView } from '../../store/view'
import { LayerAssemblyGizmo } from './LayerAssemblyGizmo'
import { LayerAssembly3DToolbar } from './LayerAssembly3DToolbar'
import type { GizmoRect } from '../../engine/layerGizmo'

export interface LayerAssembly3DViewportProps {
  composite: LayerComposite
  selectedLayerId: string | null
  onSelectLayer: (id: string | null) => void
  onUpdateLayer?: (id: string, patch: Partial<AssembledLayerItem>) => void
  time: number
}

type CameraPreset = 'orbit' | 'top' | 'side' | 'front'

export function LayerAssembly3DViewport({
  composite,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  time
}: LayerAssembly3DViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Three.js instances
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const layersGroupRef = useRef<THREE.Group | null>(null)
  const helpersGroupRef = useRef<THREE.Group | null>(null)
  const canvasBoxRef = useRef<THREE.LineSegments | null>(null)
  const frustumHelperRef = useRef<THREE.LineSegments | null>(null)
  const depthGuideRef = useRef<THREE.Line | null>(null)

  // Mesh instances map
  const meshInstancesRef = useRef<Map<string, Layer3DMeshInstance>>(new Map())

  // Tính khoảng cách camera vừa vặn chính xác góc nhìn 45° của camera
  const defaultFitDist = useMemo(() => {
    const fovRad = (45 * Math.PI) / 180
    return Math.round(composite.height / (2 * Math.tan(fovRad / 2)))
  }, [composite.height])

  // Camera Orbit state
  const orbitRef = useRef({
    azimuth: -0.55, // ~ -32 độ
    elevation: 0.35, // ~ 20 độ
    distance: defaultFitDist,
    target: new THREE.Vector3(0, 0, 0)
  })

  const theme = useView((s) => s.theme)
  const isLight = theme === 'light'

  // Tool states
  const [camDistance, setCamDistance] = useState(defaultFitDist)
  const [zExaggeration, setZExaggeration] = useState(1.8) // Độ tách lớp Z mặc định 1.8x
  const [showGrid, setShowGrid] = useState(true)
  const [showFrustum, setShowFrustum] = useState(true)
  const [clipToCamera, setClipToCamera] = useState(true) // Cắt các phần layer vượt ra ngoài tầm nhìn camera
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('orbit')

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
    renderer.localClippingEnabled = true
    rendererRef.current = renderer

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 1.4)
    scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6)
    dirLight.position.set(400, 800, 600)
    scene.add(dirLight)

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

    // Khung chữ nhật bao quanh canvas 2D tại z = 0 (theme sáng dùng xanh dương, theme tối dùng slate)
    const initialBoxColor = isLight ? 0x0284c7 : 0x64748b
    const canvasBox = createRectOutline(composite.width, composite.height, initialBoxColor)
    scene.add(canvasBox)
    canvasBoxRef.current = canvasBox

    // Hình nón tháp Camera Frustum 3D (theme sáng dùng Royal Blue đậm nét, theme tối dùng vàng ấm)
    const frustumHelper = createCameraFrustumHelper(composite.width, composite.height, defaultFitDist, isLight)
    scene.add(frustumHelper)
    frustumHelperRef.current = frustumHelper

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
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      rendererRef.current.setSize(w, h)
      setGizmoRect({ x: 0, y: 0, w, h })
      setGizmoTick((t) => (t + 1) | 0)
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.dispose()
      meshInstancesRef.current.clear()
    }
  }, [])

  // ------------------------------------------------------------- 2. Cập nhật khung tham chiếu Canvas & Frustum
  useEffect(() => {
    if (!sceneRef.current) return

    if (canvasBoxRef.current) {
      sceneRef.current.remove(canvasBoxRef.current)
      canvasBoxRef.current.geometry.dispose()
    }
    const boxColor = isLight ? 0x0284c7 : 0x64748b
    const newBox = createRectOutline(composite.width, composite.height, boxColor)
    sceneRef.current.add(newBox)
    canvasBoxRef.current = newBox

    if (frustumHelperRef.current) {
      sceneRef.current.remove(frustumHelperRef.current)
      frustumHelperRef.current.geometry.dispose()
    }
    const newFrustum = createCameraFrustumHelper(composite.width, composite.height, defaultFitDist, isLight)
    newFrustum.visible = showFrustum
    sceneRef.current.add(newFrustum)
    frustumHelperRef.current = newFrustum
  }, [composite.width, composite.height, defaultFitDist, isLight, showFrustum])

  // ------------------------------------------------------------- 3. Bật tắt Helpers Lưới & Tháp Camera
  useEffect(() => {
    if (helpersGroupRef.current) {
      helpersGroupRef.current.visible = showGrid
    }
  }, [showGrid])

  useEffect(() => {
    if (frustumHelperRef.current) {
      frustumHelperRef.current.visible = showFrustum
    }
  }, [showFrustum])

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

  // Giữ callback rỗng để tương thích với các API load texture
  const requestRender = useCallback(() => {}, [])

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

      // Đặt renderOrder = 0 để Three.js sắp xếp theo khoảng cách chiều sâu 3D (camera distance)
      // và Z-buffer, thay vì bị ép cứng theo thứ tự mảng idx làm sai lệch layer trước/sau
      inst.mesh.renderOrder = 0

      updateLayer3DInstance(
        inst,
        visualLayer,
        time,
        zExaggeration,
        layer.id === selectedLayerId,
        idx,
        cameraClippingPlanes
      )
    })
  }, [composite.layers, time, zExaggeration, selectedLayerId, requestRender, cameraClippingPlanes])

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

    // Chuột phải hoặc giữ Shift -> Pan góc nhìn
    if (e.button === 2 || e.shiftKey) {
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
      // Xoay tự do Orbit
      o.azimuth -= dx * 0.007
      o.elevation = Math.max(-Math.PI / 2 + 0.04, Math.min(Math.PI / 2 - 0.04, o.elevation + dy * 0.007))
      setCameraPreset('orbit')
    } else {
      // Pan dịch chuyển target
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

    // Nếu chỉ click chuột (không rê chuột) -> Raycast chọn Layer
    if (!dragStartRef.current.moved && dragModeRef.current === 'orbit') {
      handleRaycastSelect(e.clientX, e.clientY)
    }
  }

  // Bắn tia Raycast để chọn layer trong 3D
  const handleRaycastSelect = (clientX: number, clientY: number) => {
    const container = containerRef.current
    const camera = cameraRef.current
    if (!container || !camera) return

    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)

    const meshes: THREE.Mesh[] = []
    for (const inst of meshInstancesRef.current.values()) {
      if (inst.group.visible) meshes.push(inst.mesh)
    }

    const intersects = raycaster.intersectObjects(meshes, false)
    if (intersects.length > 0) {
      const hit = intersects[0]
      const hitLayerId = hit.object.userData?.layerId
      if (hitLayerId) {
        onSelectLayer(hitLayerId)
        return
      }
    }
    onSelectLayer(null)
  }

  // ------------------------------------------------------------- 8. Camera Controls & Quick Angles
  const handleApplyPreset = (preset: CameraPreset) => {
    setCameraPreset(preset)
    const o = orbitRef.current
    if (preset === 'top') {
      o.azimuth = 0
      o.elevation = Math.PI / 2 - 0.01
    } else if (preset === 'side') {
      o.azimuth = -Math.PI / 2
      o.elevation = 0
    } else if (preset === 'front') {
      o.azimuth = 0
      o.elevation = 0
      o.target.set(0, 0, 0)
      o.distance = defaultFitDist
      setCamDistance(defaultFitDist)
    } else {
      o.azimuth = -0.55
      o.elevation = 0.35
    }
    requestRender()
  }

  // Áp dụng góc xoay nhanh chuẩn CameraControls
  const applyQuickAngle = (yawDeg: number, pitchDeg: number) => {
    const o = orbitRef.current
    o.azimuth = (yawDeg * Math.PI) / 180
    o.elevation = (pitchDeg * Math.PI) / 180
    setCameraPreset('orbit')
    requestRender()
  }

  // Vừa vặn khung hình tiêu chuẩn (Fit Framing Distance)
  const handleFitFramingDistance = () => {
    const o = orbitRef.current
    o.target.set(0, 0, 0)
    o.distance = defaultFitDist
    o.azimuth = 0
    o.elevation = 0
    setCamDistance(defaultFitDist)
    setCameraPreset('front')
    requestRender()
  }

  // Lấy nét lại toàn cảnh (Focus / Reset View)
  const handleFocusAll = () => {
    const o = orbitRef.current
    o.target.set(0, 0, 0)
    o.distance = defaultFitDist
    o.azimuth = -0.55
    o.elevation = 0.35
    setCamDistance(defaultFitDist)
    setCameraPreset('orbit')
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
        background: 'var(--bg-0)',
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
      />

      {/* Floating Bottom Right Hint - góc phải thoáng đãng, không đè lên Transport Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '14px',
          fontSize: '10px',
          color: 'var(--text-faint)',
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(6px)',
          padding: '2px 8px',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: 30
        }}
      >
        Chuột trái: xoay · Shift / phải: dời · Cuộn: zoom · F: căn giữa
      </div>
    </div>
  )
}
