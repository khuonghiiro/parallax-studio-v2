import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import type { LayerComposite, AssembledLayerItem } from './types'
import {
  createLayer3DInstance,
  updateLayer3DInstance,
  createRectOutline,
  type Layer3DMeshInstance
} from './layerAssembly3DMesh'
import { useLayerAssetImage } from './useLayerAssetImage'
import { IconCube, IconEye, IconFocus } from '../icons'

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

  // Mesh instances map
  const meshInstancesRef = useRef<Map<string, Layer3DMeshInstance>>(new Map())

  // Camera Orbit state
  const orbitRef = useRef({
    azimuth: -0.55, // ~ -32 độ
    elevation: 0.35, // ~ 20 độ
    distance: Math.max(900, Math.hypot(composite.width, composite.height) * 1.3),
    target: new THREE.Vector3(0, 0, 0)
  })

  // Tool states
  const [zExaggeration, setZExaggeration] = useState(1.8) // Độ tách lớp Z mặc định 1.8x
  const [showGrid, setShowGrid] = useState(true)
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

  // ------------------------------------------------------------- 2. Cập nhật khung tham chiếu Canvas
  useEffect(() => {
    if (!canvasBoxRef.current || !sceneRef.current) return
    sceneRef.current.remove(canvasBoxRef.current)
    canvasBoxRef.current.geometry.dispose()
    const newBox = createRectOutline(composite.width, composite.height, 0x64748b)
    sceneRef.current.add(newBox)
    canvasBoxRef.current = newBox
    requestRender()
  }, [composite.width, composite.height])

  // ------------------------------------------------------------- 3. Bật tắt Helpers Lưới & Trục
  useEffect(() => {
    if (helpersGroupRef.current) {
      helpersGroupRef.current.visible = showGrid
      requestRender()
    }
  }, [showGrid])

  // ------------------------------------------------------------- 4. Render Frame loop
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

  // ------------------------------------------------------------- 5. Đồng bộ hóa Mesh các Layers
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

  // ------------------------------------------------------------- 6. Tương tác Chuột / Pointer
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
    orbitRef.current.distance = Math.max(150, Math.min(15000, orbitRef.current.distance * factor))
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

  // ------------------------------------------------------------- 7. Chuyển đổi Camera Preset
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

  // Lấy nét lại toàn cảnh (Focus / Reset View)
  const handleFocusAll = () => {
    const o = orbitRef.current
    o.target.set(0, 0, 0)
    o.distance = Math.max(900, Math.hypot(composite.width, composite.height) * 1.3)
    o.azimuth = -0.55
    o.elevation = 0.35
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

      {/* Floating 3D HUD Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 40,
          background: 'color-mix(in srgb, var(--bg-1) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--line-soft)',
          borderRadius: '6px',
          padding: '4px 8px'
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
            marginRight: '4px'
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

        {/* Nút Focus */}
        <button
          type="button"
          className="btn xs icon"
          onClick={handleFocusAll}
          title="Lấy nét toàn bộ cụm layer (Phím F / Reset View)"
        >
          <IconFocus width={12} height={12} />
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

      {/* Floating Z-Exaggeration Slider (Góc trên phải) */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 40,
          background: 'color-mix(in srgb, var(--bg-1) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--line-soft)',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          color: 'var(--text-dim)'
        }}
      >
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
          style={{ width: '75px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
          title="Kéo thanh trượt để tăng/giảm khoảng cách hiển thị trục Z giữa các lớp"
        />
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
        Chuột trái: xoay 3D · Shift / chuột phải: dời khung · Cuộn: thu phóng · Nhấp: chọn layer
      </div>
    </div>
  )
}
