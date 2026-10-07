import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import type { Face3D, Model3D } from './types'
import { resolveFaceTexture, type ResolvedTexture } from './textureResolver'
import {
  createFaceMesh,
  updateHelpersGroup,
  applyCameraPreset,
  type OrbitState
} from './assemblyMeshFactory'
import { computeProceduralMotionOffset } from './meshEffectsAE'
import { AssemblyGizmo } from './AssemblyGizmo'
import type { GizmoRect } from '../../../engine/layerGizmo'

export type GizmoMode = 'translate' | 'rotate' | 'off'

interface AssemblyViewportProps {
  model: Model3D
  selectedFaceId: string | null
  showWireframe: boolean
  meshOnlyPixels?: boolean
  showGrid: boolean
  showAxes: boolean
  cameraPreset: 'front' | 'left' | 'right' | 'top' | 'iso'
  gizmoMode?: GizmoMode
  meshEditMode?: 'none' | 'erase' | 'select'
  onSelectFace: (faceId: string) => void
  onUpdateFace?: (faceId: string, updates: Partial<Face3D>) => void
  onDropAsset?: (assetPath: string, pos3D?: [number, number, number], hitFaceId?: string | null) => void
  onToggleMeshCell?: (faceId: string, cellKey: string) => void
  onToggleSelectCell?: (faceId: string, cellKey: string) => void
}

export function AssemblyViewport({
  model,
  selectedFaceId,
  showWireframe,
  meshOnlyPixels = true,
  showGrid,
  showAxes,
  cameraPreset,
  gizmoMode = 'translate',
  meshEditMode = 'none',
  onSelectFace,
  onUpdateFace,
  onDropAsset,
  onToggleMeshCell,
  onToggleSelectCell
}: AssemblyViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const meshGroupRef = useRef<THREE.Group | null>(null)
  const helpersGroupRef = useRef<THREE.Group | null>(null)
  const isGizmoDraggingRef = useRef(false)
  const [gizmoRect, setGizmoRect] = useState<GizmoRect | null>(null)
  const [gizmoTick, setGizmoTick] = useState(0)
  const bumpGizmo = useCallback(() => setGizmoTick((t) => (t + 1) | 0), [])
  const prevOrbitRef = useRef({ azimuth: 0, elevation: 0, radius: 0, targetX: 0, targetY: 0, targetZ: 0 })
  const onUpdateFaceRef = useRef(onUpdateFace)
  onUpdateFaceRef.current = onUpdateFace
  const modelScaleRef = useRef(model.scale || 1.0)
  modelScaleRef.current = model.scale || 1.0

  // Loaded textures map keyed by assetPath
  const [textureMap, setTextureMap] = useState<Map<string, ResolvedTexture>>(new Map())

  // Orbit state
  const orbitRef = useRef<OrbitState>({
    azimuth: -0.6, // rad
    elevation: 0.4, // rad
    radius: 1400,
    target: new THREE.Vector3(0, 100, 200)
  })

  // Drag interaction state (Blender Middle-click Orbit & Left-click Pan/Asset Move)
  const dragStateRef = useRef<{
    mode: 'none' | 'orbit' | 'panSpace' | 'dragFace'
    prevX: number
    prevY: number
    startX: number
    startY: number
    faceId: string | null
    initFacePos: [number, number, number]
  }>({
    mode: 'none',
    prevX: 0,
    prevY: 0,
    startX: 0,
    startY: 0,
    faceId: null,
    initFacePos: [0, 0, 0]
  })

  // Load textures asynchronously for faces
  useEffect(() => {
    let active = true
    const pathsToLoad = model.faces
      .map((f) => f.assetPath)
      .filter((p): p is string => Boolean(p && p.trim()))

    if (pathsToLoad.length === 0) return

    Promise.all(
      pathsToLoad.map(async (p) => {
        const res = await resolveFaceTexture(p)
        return { path: p, res }
      })
    ).then((results) => {
      if (!active) return
      setTextureMap((prev) => {
        const next = new Map(prev)
        for (const item of results) {
          if (item.res) next.set(item.path, item.res)
        }
        return next
      })
    })

    return () => {
      active = false
    }
  }, [model.faces])

  // Set camera by preset
  useEffect(() => {
    applyCameraPreset(orbitRef.current, cameraPreset)
    bumpGizmo()
  }, [cameraPreset, bumpGizmo])

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth || 500
    const height = container.clientHeight || 400
    setGizmoRect({ x: 0, y: 0, w: width, h: height })

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0f1319')
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(40, width / height, 10, 10000)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer

    container.appendChild(renderer.domElement)

    // Lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.95)
    scene.add(amb)
    const dir = new THREE.DirectionalLight(0xffffff, 0.65)
    dir.position.set(500, 1000, 800)
    scene.add(dir)

    // Helpers group
    const helpers = new THREE.Group()
    scene.add(helpers)
    helpersGroupRef.current = helpers

    // Meshes group
    const meshGroup = new THREE.Group()
    scene.add(meshGroup)
    meshGroupRef.current = meshGroup

    // Animation loop (supports After Effects procedural mesh motion)
    const clock = new THREE.Clock()
    let animId = 0
    const render = () => {
      const elapsedTime = clock.getElapsedTime()

      // Procedural mesh vertex animation (wind, wave, breathe, wiggle)
      if (meshGroupRef.current) {
        const meshes = meshGroupRef.current.children
        for (let i = 0; i < meshes.length; i++) {
          const obj = meshes[i] as THREE.Mesh
          const motion = obj.userData?.motion
          if (!motion || motion.type === 'none' || motion.amplitude === 0) continue

          const geo = obj.geometry
          const basePos = geo.userData?.basePositions as Float32Array | undefined
          const uvs = geo.userData?.uvs as Float32Array | undefined
          const posAttr = geo.getAttribute('position')

          if (basePos && uvs && posAttr) {
            const vertCount = posAttr.count
            for (let vi = 0; vi < vertCount; vi++) {
              const bx = basePos[vi * 3]
              const by = basePos[vi * 3 + 1]
              const bz = basePos[vi * 3 + 2]
              const u = uvs[vi * 2]
              const v = uvs[vi * 2 + 1]

              const [dx, dy, dz] = computeProceduralMotionOffset({
                u,
                v,
                width: motion.width,
                height: motion.height,
                time: elapsedTime,
                motionType: motion.type,
                speed: motion.speed,
                amplitude: motion.amplitude,
                direction: motion.direction,
                anchor: motion.anchor
              })

              posAttr.setXYZ(vi, bx + dx, by + dy, bz + dz)
            }
            posAttr.needsUpdate = true
          }
        }
      }

      const o = orbitRef.current
      const x = o.target.x + o.radius * Math.cos(o.elevation) * Math.sin(o.azimuth)
      const y = o.target.y + o.radius * Math.sin(o.elevation)
      const z = o.target.z + o.radius * Math.cos(o.elevation) * Math.cos(o.azimuth)
      camera.position.set(x, y, z)
      camera.lookAt(o.target)
      camera.updateMatrixWorld()

      if (
        Math.abs(o.azimuth - prevOrbitRef.current.azimuth) > 1e-4 ||
        Math.abs(o.elevation - prevOrbitRef.current.elevation) > 1e-4 ||
        Math.abs(o.radius - prevOrbitRef.current.radius) > 1e-1 ||
        Math.abs(o.target.x - prevOrbitRef.current.targetX) > 1e-1 ||
        Math.abs(o.target.y - prevOrbitRef.current.targetY) > 1e-1 ||
        Math.abs(o.target.z - prevOrbitRef.current.targetZ) > 1e-1
      ) {
        prevOrbitRef.current = {
          azimuth: o.azimuth,
          elevation: o.elevation,
          radius: o.radius,
          targetX: o.target.x,
          targetY: o.target.y,
          targetZ: o.target.z
        }
        bumpGizmo()
      }

      renderer.render(scene, camera)
      animId = requestAnimationFrame(render)
    }
    render()

    // Resize handler
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        const h = entry.contentRect.height
        if (w > 0 && h > 0) {
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h)
          setGizmoRect({ x: 0, y: 0, w, h })
          bumpGizmo()
        }
      }
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.dispose()
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement)
      }
    }
  }, [bumpGizmo])

  // Update helpers (Grid & Axes)
  useEffect(() => {
    if (helpersGroupRef.current) {
      updateHelpersGroup(helpersGroupRef.current, showGrid, showAxes)
    }
  }, [showGrid, showAxes])

  // Update 3D faces, textures and pixel-trimmed wireframe mesh
  useEffect(() => {
    const meshGroup = meshGroupRef.current
    if (!meshGroup) return

    // Clear old meshes
    while (meshGroup.children.length > 0) {
      const child = meshGroup.children[0]
      meshGroup.remove(child)
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
        else child.material.dispose()
      }
    }

    const scale = model.scale || 1.0

    model.faces.forEach((face: Face3D) => {
      const isSelected = face.id === selectedFaceId
      const resolved = face.assetPath ? textureMap.get(face.assetPath) || null : null
      const mesh = createFaceMesh(face, resolved, meshOnlyPixels, showWireframe, scale, isSelected)
      meshGroup.add(mesh)
    })
  }, [model, selectedFaceId, showWireframe, meshOnlyPixels, textureMap])

  // Drag-and-drop HUD state
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragOverFaceId, setDragOverFaceId] = useState<string | null>(null)

  // Raycast helper to find face under cursor
  const raycastFace = (clientX: number, clientY: number): string | null => {
    const container = containerRef.current
    const camera = cameraRef.current
    const meshGroup = meshGroupRef.current
    if (!container || !camera || !meshGroup) return null

    const rect = container.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    const hits = raycaster.intersectObjects(meshGroup.children, true)
    if (hits.length > 0) {
      let cur: THREE.Object3D | null = hits[0].object
      while (cur && !cur.userData?.faceId && cur.parent !== meshGroup) {
        cur = cur.parent
      }
      if (cur?.userData?.faceId) {
        return cur.userData.faceId
      }
    }
    return null
  }

  // Raycast helper to find face AND UV for sub-mesh cell trimming
  const raycastFaceWithUV = (
    clientX: number,
    clientY: number
  ): { faceId: string; uv: THREE.Vector2 } | null => {
    const container = containerRef.current
    const camera = cameraRef.current
    const meshGroup = meshGroupRef.current
    if (!container || !camera || !meshGroup) return null

    const rect = container.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    const hits = raycaster.intersectObjects(meshGroup.children, true)
    for (const hit of hits) {
      let cur: THREE.Object3D | null = hit.object
      while (cur && !cur.userData?.faceId && cur.parent !== meshGroup) {
        cur = cur.parent
      }
      if (cur?.userData?.faceId && hit.uv) {
        return { faceId: cur.userData.faceId, uv: hit.uv }
      }
    }
    return null
  }

  // Drag over viewport
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    if (!isDragOver) setIsDragOver(true)
    const hitFaceId = raycastFace(e.clientX, e.clientY)
    if (hitFaceId !== dragOverFaceId) {
      setDragOverFaceId(hitFaceId)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragOver(false)
      setDragOverFaceId(null)
    }
  }

  // Drop image texture directly into 3D scene
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setDragOverFaceId(null)

    let assetPath = ''

    // 1. Files dropped directly from computer explorer
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        assetPath = (file as any).path || URL.createObjectURL(file)
      }
    }

    // 2. Dragged from AssemblyAssetSidebar
    if (!assetPath) {
      try {
        const jsonStr = e.dataTransfer.getData('application/json')
        if (jsonStr) {
          const data = JSON.parse(jsonStr)
          if (data.assetPath) assetPath = data.assetPath
        }
      } catch {}
    }

    // 3. Fallback text/plain
    if (!assetPath) {
      const text = e.dataTransfer.getData('text/plain')
      if (text && (text.endsWith('.png') || text.endsWith('.jpg') || text.endsWith('.webp') || text.includes('/'))) {
        assetPath = text.trim()
      }
    }

    if (!assetPath) return

    // If dropped on an existing face -> replace its texture
    const hitFaceId = raycastFace(e.clientX, e.clientY)
    if (hitFaceId) {
      onDropAsset?.(assetPath, undefined, hitFaceId)
      return
    }

    // Otherwise calculate 3D world position where ray hits camera target plane
    const container = containerRef.current
    const camera = cameraRef.current
    if (!container || !camera) return

    const rect = container.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      camDir.negate(),
      orbitRef.current.target
    )
    const hitPoint = new THREE.Vector3()
    const scale = model.scale || 1.0

    if (raycaster.ray.intersectPlane(plane, hitPoint)) {
      const targetPos: [number, number, number] = [
        Math.round(hitPoint.x / scale),
        Math.round(hitPoint.y / scale),
        Math.round(-hitPoint.z / scale)
      ]
      onDropAsset?.(assetPath, targetPos, null)
    } else {
      onDropAsset?.(assetPath, [0, 0, 0], null)
    }
  }

  // Pointer Down: Middle-click -> Orbit (Blender) | Left-click -> Asset Move or Space Pan
  const handlePointerDown = (e: React.PointerEvent) => {
    // If interacting with 3D manipulator gizmo (TransformControls), skip viewport dragging
    if (isGizmoDraggingRef.current) return

    const ds = dragStateRef.current
    ds.prevX = e.clientX
    ds.prevY = e.clientY
    ds.startX = e.clientX
    ds.startY = e.clientY

    // Middle Mouse Button (Nhấn giữ scroll chuột giữa) = Xoay không gian 3D (Blender style)
    if (e.button === 1) {
      e.preventDefault()
      ds.mode = 'orbit'
      ds.faceId = null
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Left Mouse Button (Chuột trái)
    if (e.button === 0) {
      // 1. Shift + Click hoặc Chế độ Select: Chọn ô mesh để bẻ cong / điều chỉnh
      if (e.shiftKey || meshEditMode === 'select') {
        const hitData = raycastFaceWithUV(e.clientX, e.clientY)
        if (hitData && onToggleSelectCell) {
          const targetFace = model.faces.find((f) => f.id === hitData.faceId)
          const cols = targetFace?.gridCols || targetFace?.gridRes || 16
          const rows = targetFace?.gridRows || targetFace?.gridRes || 16
          const c = Math.floor(hitData.uv.x * cols)
          const r = Math.floor((1 - hitData.uv.y) * rows)
          onToggleSelectCell(hitData.faceId, `${r}_${c}`)
          return
        }
      }

      // 2. Alt + Click hoặc Chế độ Erase: Gọt/tỉa 1 phần ô lưới trực tiếp trên 3D
      if (e.altKey || meshEditMode === 'erase') {
        const hitData = raycastFaceWithUV(e.clientX, e.clientY)
        if (hitData && onToggleMeshCell) {
          const targetFace = model.faces.find((f) => f.id === hitData.faceId)
          const cols = targetFace?.gridCols || targetFace?.gridRes || 32
          const rows = targetFace?.gridRows || targetFace?.gridRes || 32
          const c = Math.floor(hitData.uv.x * cols)
          const r = Math.floor((1 - hitData.uv.y) * rows)
          onToggleMeshCell(hitData.faceId, `${r}_${c}`)
          return
        }
      }

      const hitFaceId = raycastFace(e.clientX, e.clientY)
      if (hitFaceId) {
        // Click trúng asset -> Chọn mặt phẳng và bắt đầu kéo di chuyển
        onSelectFace(hitFaceId)
        const targetFace = model.faces.find((f) => f.id === hitFaceId)
        ds.mode = 'dragFace'
        ds.faceId = hitFaceId
        ds.initFacePos = targetFace ? [...targetFace.position] : [0, 0, 0]
      } else {
        // Click nền trống -> Di chuyển không gian (pan)
        ds.mode = 'panSpace'
        ds.faceId = null
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }

    // Right Mouse Button (Chuột phải)
    if (e.button === 2) {
      ds.mode = 'panSpace'
      ds.faceId = null
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
  }

  // Pointer Move: Orbit / Pan Space / Drag Asset Face
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isGizmoDraggingRef.current) return
    const ds = dragStateRef.current
    const o = orbitRef.current
    const camera = cameraRef.current
    const container = containerRef.current

    // Hover state: update cursor when not dragging
    if (ds.mode === 'none') {
      const hitFaceId = raycastFace(e.clientX, e.clientY)
      if (container) {
        if (meshEditMode === 'erase' || e.altKey) {
          container.style.cursor = hitFaceId ? 'crosshair' : 'default'
        } else if (meshEditMode === 'select' || e.shiftKey) {
          container.style.cursor = hitFaceId ? 'pointer' : 'default'
        } else {
          container.style.cursor = hitFaceId ? 'move' : 'grab'
        }
      }
      return
    }

    const dx = e.clientX - ds.prevX
    const dy = e.clientY - ds.prevY
    ds.prevX = e.clientX
    ds.prevY = e.clientY

    // 1. Orbit (Nhấn giữ chuột giữa xoay không gian 3D như Blender)
    if (ds.mode === 'orbit') {
      if (container) container.style.cursor = 'grabbing'
      o.azimuth -= dx * 0.008
      o.elevation = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, o.elevation + dy * 0.008))
      bumpGizmo()
      return
    }

    // 2. Pan Space (Chuột trái kéo nền trống để di chuyển không gian)
    if (ds.mode === 'panSpace') {
      if (container) container.style.cursor = 'grabbing'
      if (!camera) return
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
      const panSpeed = (o.radius / 1000) * 0.85
      o.target.addScaledVector(right, -dx * panSpeed)
      o.target.addScaledVector(up, dy * panSpeed)
      bumpGizmo()
      return
    }

    // 3. Drag Face (Chuột trái kéo asset để di chuyển trong không gian 3D)
    if (ds.mode === 'dragFace') {
      if (container) container.style.cursor = 'move'
      if (!camera || !container || !ds.faceId || !onUpdateFace) return

      const totalDx = e.clientX - ds.startX
      const totalDy = e.clientY - ds.startY

      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)

      const vFovRad = (camera.fov * Math.PI) / 180
      const containerH = container.clientHeight || 500
      const worldPerPx = (2 * Math.tan(vFovRad / 2) * o.radius) / containerH

      const deltaWorld = new THREE.Vector3()
        .addScaledVector(right, totalDx * worldPerPx)
        .addScaledVector(up, -totalDy * worldPerPx)

      const scale = model.scale || 1.0
      const newX = Math.round(ds.initFacePos[0] + deltaWorld.x / scale)
      const newY = Math.round(ds.initFacePos[1] + deltaWorld.y / scale)
      const newZ = Math.round(ds.initFacePos[2] - deltaWorld.z / scale)

      onUpdateFace(ds.faceId, { position: [newX, newY, newZ] })
    }
  }

  // Pointer Up: Kết thúc kéo
  const handlePointerUp = (e: React.PointerEvent) => {
    if (isGizmoDraggingRef.current) return
    dragStateRef.current.mode = 'none'
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab'
    }
  }

  // Wheel: Zoom in / Zoom out
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const o = orbitRef.current
    o.radius = Math.max(200, Math.min(6000, o.radius + e.deltaY * 1.2))
    bumpGizmo()
  }

  const dragOverFace = dragOverFaceId ? model.faces.find((f) => f.id === dragOverFaceId) : null
  const selectedFace = model.faces.find((f) => f.id === selectedFaceId) || null
  const selectedMesh =
    (meshGroupRef.current?.children.find((c) => c.userData?.faceId === selectedFaceId) as
      | THREE.Mesh
      | undefined) || null
  if (selectedMesh) selectedMesh.updateMatrixWorld()

  return (
    <div
      ref={containerRef}
      className={`assembly-viewport-canvas-container${isDragOver ? ' drag-over-active' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault()
      }}
      onContextMenu={(e) => e.preventDefault()}
      title="Chuột giữa: Xoay không gian 3D | Chuột trái: Kéo di chuyển Asset / Không gian | Alt+Click: Gọt/tỉa ô lưới | Kéo thả ảnh trực tiếp vào đây"
    >
      {/* 3D Face Transform Gizmo (After Effects style) */}
      {selectedFace && cameraRef.current && gizmoRect && meshEditMode === 'none' && gizmoMode !== 'off' && (
        <AssemblyGizmo
          key={`${selectedFace.id}-${gizmoTick}`}
          face={selectedFace}
          modelScale={model.scale || 1.0}
          camera={cameraRef.current}
          rect={gizmoRect}
          mesh={selectedMesh}
          onUpdateFace={onUpdateFaceRef.current || onUpdateFace || (() => {})}
          onDragStateChange={(isDragging) => {
            isGizmoDraggingRef.current = isDragging
          }}
        />
      )}
      {/* Drag Over HUD Overlay */}
      {isDragOver && (
        <div className="viewport-drag-drop-hud">
          <div className="drag-drop-badge">
            {dragOverFace ? (
              <>
                <span className="hud-icon">🎯</span>
                <span>
                  Thả để gán ảnh vào mặt: <strong>{dragOverFace.name}</strong>
                </span>
              </>
            ) : (
              <>
                <span className="hud-icon">✨</span>
                <span>Thả vào không gian 3D để tạo mặt phẳng mới</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
