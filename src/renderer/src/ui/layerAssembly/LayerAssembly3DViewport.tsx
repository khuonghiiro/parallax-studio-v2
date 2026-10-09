import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import type { LayerComposite, AssembledLayerItem } from './types'
import {
  createLayer3DInstance,
  updateLayer3DInstance,
  createRectOutline,
  createCameraFrustumHelper,
  createDepthGuideLine,
  type Layer3DMeshInstance
} from './layerAssembly3DMesh'
import { IconCube, IconEye, IconFocus, IconCamera } from '../icons'

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

  // Tính khoảng cách camera vừa vặn mặc định
  const defaultFitDist = useMemo(() => {
    const fovRad = (45 * Math.PI) / 180
    return Math.round(
      (Math.max(composite.width, composite.height) / (2 * Math.tan(fovRad / 2))) * 1.25
    )
  }, [composite.width, composite.height])

  // Camera Orbit state
  const orbitRef = useRef({
    azimuth: -0.55, // ~ -32 độ
    elevation: 0.35, // ~ 20 độ
    distance: defaultFitDist,
    target: new THREE.Vector3(0, 0, 0)
  })

  // Tool states
  const [camDistance, setCamDistance] = useState(defaultFitDist)
  const [zExaggeration, setZExaggeration] = useState(1.8) // Độ tách lớp Z mặc định 1.8x
  const [showGrid, setShowGrid] = useState(true)
  const [showFrustum, setShowFrustum] = useState(true)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('orbit')

  // Mouse drag interaction
  const isDraggingRef = useRef(false)
  const dragModeRef = useRef<'orbit' | 'pan'>('orbit')
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, moved: false })

  const rafRef = useRef<number>(0)

  // ------------------------------------------------------------- 1. Setup Three.js Scene
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

    // Khung chữ nhật bao quanh canvas 2D tại z = 0
    const canvasBox = createRectOutline(composite.width, composite.height, 0x64748b)
    scene.add(canvasBox)
    canvasBoxRef.current = canvasBox

    // Hình nón tháp Camera Frustum 3D
    const frustumHelper = createCameraFrustumHelper(composite.width, composite.height, defaultFitDist)
    scene.add(frustumHelper)
    frustumHelperRef.current = frustumHelper

    // Resize Observer
    const ro = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w <= 0 || h <= 0) return
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(w, h)
      requestRender()
    })
    ro.observe(container)

    requestRender()

    return () => {
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
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
    const newBox = createRectOutline(composite.width, composite.height, 0x64748b)
    sceneRef.current.add(newBox)
    canvasBoxRef.current = newBox

    if (frustumHelperRef.current) {
      sceneRef.current.remove(frustumHelperRef.current)
      frustumHelperRef.current.geometry.dispose()
    }
    const newFrustum = createCameraFrustumHelper(composite.width, composite.height, defaultFitDist)
    newFrustum.visible = showFrustum
    sceneRef.current.add(newFrustum)
    frustumHelperRef.current = newFrustum

    requestRender()
  }, [composite.width, composite.height, defaultFitDist])

  // ------------------------------------------------------------- 3. Bật tắt Helpers Lưới & Tháp Camera
  useEffect(() => {
    if (helpersGroupRef.current) {
      helpersGroupRef.current.visible = showGrid
      requestRender()
    }
  }, [showGrid])

  useEffect(() => {
    if (frustumHelperRef.current) {
      frustumHelperRef.current.visible = showFrustum
      requestRender()
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

    requestRender()
  }, [selectedLayerId, composite.layers, zExaggeration])

  // ------------------------------------------------------------- 5. Render Frame loop
  const requestRender = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      renderScene()
    })
  }, [])

  const renderScene = useCallback(() => {
    const r = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!r || !scene || !camera) return

    const o = orbitRef.current

    // Cập nhật vị trí camera từ Orbit spherical coordinates
    const cosEl = Math.cos(o.elevation)
    const sinEl = Math.sin(o.elevation)
    const sinAz = Math.sin(o.azimuth)
    const cosAz = Math.cos(o.azimuth)

    camera.position.set(
      o.target.x + o.distance * cosEl * sinAz,
      o.target.y + o.distance * sinEl,
      o.target.z + o.distance * cosEl * cosAz
    )
    camera.lookAt(o.target)
    camera.updateMatrixWorld()

    r.render(scene, camera)
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

    // Tạo hoặc cập nhật mesh cho từng layer
    for (const layer of composite.layers) {
      let inst = currentMap.get(layer.id)
      if (!inst) {
        inst = createLayer3DInstance(layer, layer.imageUrl || layer.assetPath || null, requestRender)
        layersGroup.add(inst.group)
        currentMap.set(layer.id, inst)
      }
      updateLayer3DInstance(inst, layer, time, zExaggeration, layer.id === selectedLayerId)
    }

    requestRender()
  }, [composite.layers, time, zExaggeration, selectedLayerId, requestRender])

  // ------------------------------------------------------------- 7. Tương tác Chuột / Pointer
  const handlePointerDown = (e: React.PointerEvent) => {
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

    requestRender()
  }

  const handlePointerUp = (e: React.PointerEvent) => {
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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 0.9 : 1.11
    const newDist = Math.round(Math.max(150, Math.min(15000, orbitRef.current.distance * factor)))
    orbitRef.current.distance = newDist
    setCamDistance(newDist)
    requestRender()
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
      onWheel={handleWheel}
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

      {/* Floating 3D HUD Toolbar: Góc nhìn & Presets */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          zIndex: 40,
          background: 'color-mix(in srgb, var(--bg-1) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--line-soft)',
          borderRadius: '6px',
          padding: '4px 8px',
          maxWidth: 'calc(100% - 240px)'
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            marginRight: '2px'
          }}
        >
          <IconCube width={13} height={13} style={{ color: 'var(--accent-cyan)' }} /> 3D
        </span>

        {/* Camera Preset Segmented buttons */}
        <div className="seg" style={{ display: 'inline-flex' }}>
          <button
            type="button"
            className={`btn xs${cameraPreset === 'orbit' ? ' active' : ''}`}
            onClick={() => handleApplyPreset('orbit')}
            title="Góc nhìn phối cảnh tự do (Xoay chuột để quan sát chiều sâu)"
          >
            Tự do
          </button>
          <button
            type="button"
            className={`btn xs${cameraPreset === 'top' ? ' active' : ''}`}
            onClick={() => handleApplyPreset('top')}
            title="Nhìn từ trên xuống (Thấy rõ thứ tự xếp lớp trục Z)"
          >
            Mặt trên
          </button>
          <button
            type="button"
            className={`btn xs${cameraPreset === 'side' ? ' active' : ''}`}
            onClick={() => handleApplyPreset('side')}
            title="Nhìn từ cạnh bên (Thấy các lát cắt layer đứng song song)"
          >
            Mặt cạnh
          </button>
          <button
            type="button"
            className={`btn xs${cameraPreset === 'front' ? ' active' : ''}`}
            onClick={() => handleApplyPreset('front')}
            title="Nhìn chính diện 3D"
          >
            Mặt trước
          </button>
        </div>

        <div style={{ width: '1px', height: '14px', background: 'var(--line-soft)' }} />

        {/* Quick Angles chuẩn CameraControls */}
        <div style={{ display: 'inline-flex', gap: '3px' }}>
          <button
            type="button"
            className="btn xs"
            onClick={() => applyQuickAngle(-30, 0)}
            title="Góc nhìn chéo từ bên trái 30°"
          >
            -30° Trái
          </button>
          <button
            type="button"
            className="btn xs"
            onClick={() => applyQuickAngle(30, 0)}
            title="Góc nhìn chéo từ bên phải 30°"
          >
            +30° Phải
          </button>
          <button
            type="button"
            className="btn xs"
            onClick={() => applyQuickAngle(0, 22)}
            title="Góc nhìn từ trên cao xuống 22°"
          >
            +22° Cao
          </button>
          <button
            type="button"
            className="btn xs"
            onClick={() => applyQuickAngle(0, -15)}
            title="Góc nhìn từ dưới thấp lên -15°"
          >
            -15° Thấp
          </button>
          <button
            type="button"
            className="btn xs"
            onClick={() => applyQuickAngle(0, 75)}
            title="Góc nhìn thẳng từ đỉnh xuống 75°"
          >
            75° Đỉnh
          </button>
        </div>

        <div style={{ width: '1px', height: '14px', background: 'var(--line-soft)' }} />

        {/* Nút Vừa vặn khung hình */}
        <button
          type="button"
          className="btn xs"
          onClick={handleFitFramingDistance}
          title="Đặt khoảng cách camera vừa vặn khung hình tiêu chuẩn"
        >
          📐 Vừa vặn
        </button>

        {/* Nút Focus */}
        <button
          type="button"
          className="btn xs icon"
          onClick={handleFocusAll}
          title="Lấy nét toàn bộ cụm layer (Phím F / Reset View)"
        >
          <IconFocus width={12} height={12} />
        </button>

        {/* Bật tắt Tháp Camera */}
        <button
          type="button"
          className={`btn xs icon${showFrustum ? ' active' : ''}`}
          onClick={() => setShowFrustum((f) => !f)}
          title={showFrustum ? 'Ẩn tháp hình nón camera' : 'Hiện tháp hình nón camera'}
        >
          <IconCamera width={12} height={12} />
        </button>

        {/* Bật tắt lưới sàn */}
        <button
          type="button"
          className={`btn xs icon${showGrid ? ' active' : ''}`}
          onClick={() => setShowGrid((g) => !g)}
          title={showGrid ? 'Ẩn lưới sàn 3D' : 'Hiện lưới sàn 3D'}
        >
          <IconEye width={12} height={12} />
        </button>
      </div>

      {/* Floating Camera Distance & Z-Exaggeration Slider (Góc trên phải) */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          zIndex: 40,
          background: 'color-mix(in srgb, var(--bg-1) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--line-soft)',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '11px',
          color: 'var(--text-dim)',
          minWidth: '190px'
        }}
      >
        {/* Khoảng cách Camera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span title="Khoảng cách từ camera tới cụm layer">
            Khoảng cách: <strong style={{ color: 'var(--text)' }}>{camDistance}px</strong>
          </span>
          <input
            type="range"
            min="300"
            max="4500"
            step="10"
            value={camDistance}
            onChange={(e) => {
              const val = Number(e.target.value)
              orbitRef.current.distance = val
              setCamDistance(val)
              requestRender()
            }}
            style={{ width: '85px', accentColor: 'var(--accent)', cursor: 'pointer' }}
            title="Kéo thanh trượt để di chuyển camera lại gần hoặc ra xa"
          />
        </div>

        {/* Độ tách lớp Giãn Z */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span title="Phóng đại khoảng cách chiều sâu Z giữa các layer để dễ quan sát">
            Giãn Z: <strong style={{ color: 'var(--accent-cyan)' }}>{zExaggeration.toFixed(1)}x</strong>
          </span>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={zExaggeration}
            onChange={(e) => setZExaggeration(Number(e.target.value))}
            style={{ width: '85px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            title="Kéo thanh trượt để tăng/giảm khoảng cách hiển thị trục Z giữa các lớp"
          />
        </div>
      </div>

      {/* Floating Bottom Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '10.5px',
          color: 'var(--text-dim)',
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(6px)',
          padding: '3px 10px',
          borderRadius: '12px',
          pointerEvents: 'none',
          zIndex: 30
        }}
      >
        Chuột trái: xoay 3D · Shift / chuột phải: dời khung · Cuộn: khoảng cách · Nhấp: chọn layer
      </div>
    </div>
  )
}
