import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import type { Face3D, Model3D } from './types'
import { resolveFaceTexture, type ResolvedTexture } from './textureResolver'
import { updateHelpersGroup, applyCameraPreset, type OrbitState } from './assemblyMeshFactory'
import { syncFaceMeshes, clearFaceMeshes, type FaceMeshCache } from './assemblyMeshCache'
import { applyProceduralMotion } from './assemblyMotion'
import { pickFace, cellKeyAt, droppedAssetPath, type PickContext } from './assemblyPicking'
import { DEFAULT_SCENE_THEME, readAssemblySceneTheme, type AssemblySceneTheme } from './assemblyTheme'
import { faceCornersThree, faceOutlineThree, modelBounds, toThree } from './assemblyGeometry'
import { resolveLightRig, resolveSkyAtmosphere } from './assemblyLighting'
import { createLightRig, applyLightRig, disposeLightRig, type SceneLightRig } from './assemblySceneLighting'
import { AssemblyGizmo } from './AssemblyGizmo'
import {
  Assembly3DVerticalPalette,
  type Assembly3DActiveTool,
  type BrushSettings
} from './meshEditor/Assembly3DVerticalPalette'
import {
  startSculptStroke,
  applySculptStrokeMove,
  endSculptStroke,
  type SculptStrokeSession
} from './meshEditor/sculptBrushEngine'
import type { GizmoRect } from '../../../engine/layerGizmo'
import { useView } from '../../../store/view'

import type { AssemblyCaptureOptions, AssemblyCameraState, SetAssemblyCameraParams } from './assemblyBridge'
import type { CameraPreset } from './assemblyMeshFactory'

export type GizmoMode = 'translate' | 'rotate' | 'both' | 'off'

interface AssemblyViewportProps {
  model: Model3D
  selectedFaceId: string | null
  showWireframe: boolean
  meshOnlyPixels?: boolean
  showGrid: boolean
  showAxes: boolean
  cameraPreset: 'front' | 'left' | 'right' | 'top' | 'iso'
  gizmoMode?: GizmoMode
  onChangeGizmoMode?: (mode: GizmoMode) => void
  meshEditMode?: 'none' | 'erase' | 'select'
  /** Changing this number frames the selected face (or the whole model). */
  frameToken?: number
  onSelectFace: (faceId: string) => void
  onUpdateFace?: (faceId: string, updates: Partial<Face3D>) => void
  onDropAsset?: (assetPath: string, pos3D?: [number, number, number], hitFaceId?: string | null) => void
  onToggleMeshCell?: (faceId: string, cellKey: string) => void
  onToggleSelectCell?: (faceId: string, cellKey: string) => void
  /** Start / end of a continuous gesture (gizmo or face drag) → one undo step. */
  onGestureChange?: (active: boolean) => void
  /** Register callback to capture viewport screenshot as base64 png */
  onRegisterCapture?: (fn: (opts?: AssemblyCaptureOptions) => string | null) => void
  /** Register camera control callbacks */
  onRegisterCamera?: (
    setCamera: (params: SetAssemblyCameraParams) => AssemblyCameraState,
    getCamera: () => AssemblyCameraState
  ) => void
}

type DragMode = 'none' | 'orbit' | 'panSpace' | 'dragFace' | 'brush'

export function AssemblyViewport({
  model,
  selectedFaceId,
  showWireframe,
  meshOnlyPixels = true,
  showGrid,
  showAxes,
  cameraPreset,
  gizmoMode = 'translate',
  onChangeGizmoMode,
  meshEditMode = 'none',
  frameToken = 0,
  onSelectFace,
  onUpdateFace,
  onDropAsset,
  onToggleMeshCell,
  onToggleSelectCell,
  onGestureChange,
  onRegisterCapture,
  onRegisterCamera
}: AssemblyViewportProps) {
  const [active3DTool, setActive3DTool] = useState<Assembly3DActiveTool>('gizmo')
  const isBrushTool = ['grab', 'inflate', 'smooth', 'crease'].includes(active3DTool)
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    radius: 10,
    strength: 0.5,
    invert: false
  })
  const sculptSessionRef = useRef<SculptStrokeSession | null>(null)
  const brushCursorRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const meshGroupRef = useRef<THREE.Group | null>(null)
  const helpersGroupRef = useRef<THREE.Group | null>(null)
  const lightRigRef = useRef<SceneLightRig | null>(null)
  const meshCacheRef = useRef<FaceMeshCache>(new Map())
  const isGizmoDraggingRef = useRef(false)
  const [gizmoRect, setGizmoRect] = useState<GizmoRect | null>(null)
  const [gizmoTick, setGizmoTick] = useState(0)
  const bumpGizmo = useCallback(() => setGizmoTick((t) => (t + 1) | 0), [])
  const onUpdateFaceRef = useRef(onUpdateFace)
  onUpdateFaceRef.current = onUpdateFace
  const appTheme = useView((s) => s.theme)
  const [sceneTheme, setSceneTheme] = useState<AssemblySceneTheme>(DEFAULT_SCENE_THEME)
  const [textureMap, setTextureMap] = useState<Map<string, ResolvedTexture>>(new Map())
  const orbitRef = useRef<OrbitState>({ azimuth: -0.6, elevation: 0.4, radius: 1400, target: new THREE.Vector3(0, 100, 200) })
  const dragRef = useRef({ mode: 'none' as DragMode, prevX: 0, prevY: 0, startX: 0, startY: 0, faceId: null as string | null, initFacePos: [0, 0, 0] as [number, number, number] })
  const scale = model.scale || 1.0

  useEffect(() => {
    if (!onRegisterCapture) return
    onRegisterCapture((opts?: AssemblyCaptureOptions) => {
      const r = rendererRef.current
      const scene = sceneRef.current
      const camera = cameraRef.current
      if (!r || !scene || !camera) return null

      const o = orbitRef.current
      const prevOrbit = { az: o.azimuth, el: o.elevation, r: o.radius, t: o.target.clone() }
      const prevCamPos = camera.position.clone()

      // Lưu trạng thái hiển thị của các thành phần phụ trợ
      const helpers = helpersGroupRef.current
      const lightRig = lightRigRef.current
      const meshGroup = meshGroupRef.current

      const prevHelpersVis = helpers ? helpers.visible : true
      const prevGroundVis = lightRig?.ground ? lightRig.ground.visible : true
      const prevMarkerVis = lightRig?.marker ? lightRig.marker.visible : true
      const prevBg = scene.background

      // Ẩn helpers (grid, axes)
      if (helpers) helpers.visible = false
      // Ẩn ground / shadow catcher và sun marker
      if (lightRig?.ground) lightRig.ground.visible = false
      if (lightRig?.marker) lightRig.marker.visible = false

      // Tạm thời ẩn các line segments (wireframe, cell borders, selection outlines)
      const hiddenLines: THREE.Object3D[] = []
      if (meshGroup) {
        meshGroup.traverse((obj) => {
          if (obj instanceof THREE.LineSegments || (obj as any).isLineSegments || (obj as any).isLine) {
            if (obj.visible) {
              hiddenLines.push(obj)
              obj.visible = false
            }
          }
        })
      }

      // Đặt góc nhìn tối ưu cho chụp ảnh
      if (opts?.frameFaceId) {
        const face = model.faces.find((f) => f.id === opts.frameFaceId && !f.hidden)
        if (face) {
          const box = new THREE.Box3().setFromPoints(faceOutlineThree(face, scale))
          const sphere = box.getBoundingSphere(new THREE.Sphere())
          o.target.copy(sphere.center)
          o.radius = Math.max(150, Math.min(6000, (sphere.radius * 1.5) / Math.tan((camera.fov * Math.PI) / 360)))
        }
      } else if (opts?.autoFit || opts?.cameraPreset === 'iso') {
        const activeFaces = model.faces.filter((f) => !f.hidden)
        if (activeFaces.length > 0) {
          const box = new THREE.Box3().setFromPoints(activeFaces.flatMap((f) => faceOutlineThree(f, scale)))
          const sphere = box.getBoundingSphere(new THREE.Sphere())
          o.target.copy(sphere.center)
          o.azimuth = -Math.PI / 4
          o.elevation = 0.45
          o.radius = Math.max(300, Math.min(8000, (sphere.radius * 1.35) / Math.tan((camera.fov * Math.PI) / 360)))
        }
      } else if (opts?.cameraPreset) {
        applyCameraPreset(o, opts.cameraPreset as CameraPreset)
      }

      // Cập nhật vị trí camera theo orbit
      camera.position.set(
        o.target.x + o.radius * Math.cos(o.elevation) * Math.sin(o.azimuth),
        o.target.y + o.radius * Math.sin(o.elevation),
        o.target.z + o.radius * Math.cos(o.elevation) * Math.cos(o.azimuth)
      )
      camera.lookAt(o.target)
      camera.updateMatrixWorld()

      if (opts?.transparent !== false) {
        scene.background = null
      }

      let dataUrl: string | null = null
      try {
        r.render(scene, camera)
        dataUrl = r.domElement.toDataURL('image/png')
      } catch (err) {
        console.warn('[AssemblyViewport] Capture error:', err)
      } finally {
        // Khôi phục lại trạng thái cũ
        o.azimuth = prevOrbit.az
        o.elevation = prevOrbit.el
        o.radius = prevOrbit.r
        o.target.copy(prevOrbit.t)
        camera.position.copy(prevCamPos)
        camera.lookAt(o.target)
        camera.updateMatrixWorld()

        if (helpers) helpers.visible = prevHelpersVis
        if (lightRig?.ground) lightRig.ground.visible = prevGroundVis
        if (lightRig?.marker) lightRig.marker.visible = prevMarkerVis
        for (const line of hiddenLines) {
          line.visible = true
        }
        scene.background = prevBg
        // Render lại frame bình thường cho viewport người dùng
        r.render(scene, camera)
      }

      return dataUrl
    })
    return () => {
      onRegisterCapture(() => null)
    }
  }, [onRegisterCapture, model.faces, scale])

  useEffect(() => {
    if (!onRegisterCamera) return
    const setCamera = (params: SetAssemblyCameraParams): AssemblyCameraState => {
      const o = orbitRef.current
      const camera = cameraRef.current
      if (params.preset) {
        applyCameraPreset(o, params.preset as CameraPreset)
      }
      if (typeof params.azimuth === 'number') {
        o.azimuth = (params.azimuth * Math.PI) / 180
      }
      if (typeof params.elevation === 'number') {
        o.elevation = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, (params.elevation * Math.PI) / 180))
      }
      if (typeof params.radius === 'number' && params.radius > 0) {
        o.radius = params.radius
      }
      if (params.target && Array.isArray(params.target) && params.target.length === 3) {
        o.target.set(params.target[0], params.target[1], -params.target[2])
      }
      if (params.frameFaceId) {
        const face = model.faces.find((f) => f.id === params.frameFaceId && !f.hidden)
        if (face && camera) {
          const box = new THREE.Box3().setFromPoints(faceOutlineThree(face, scale))
          const sphere = box.getBoundingSphere(new THREE.Sphere())
          o.target.copy(sphere.center)
          o.radius = Math.max(150, Math.min(6000, (sphere.radius * 1.5) / Math.tan((camera.fov * Math.PI) / 360)))
        }
      } else if (params.frameModel) {
        const activeFaces = model.faces.filter((f) => !f.hidden)
        if (activeFaces.length > 0 && camera) {
          const box = new THREE.Box3().setFromPoints(activeFaces.flatMap((f) => faceOutlineThree(f, scale)))
          const sphere = box.getBoundingSphere(new THREE.Sphere())
          o.target.copy(sphere.center)
          o.radius = Math.max(300, Math.min(8000, (sphere.radius * 1.8) / Math.tan((camera.fov * Math.PI) / 360)))
        }
      }
      bumpGizmo()
      return {
        azimuth: Math.round((o.azimuth * 180) / Math.PI),
        elevation: Math.round((o.elevation * 180) / Math.PI),
        radius: Math.round(o.radius),
        target: [Math.round(o.target.x), Math.round(o.target.y), Math.round(-o.target.z)]
      }
    }

    const getCamera = (): AssemblyCameraState => {
      const o = orbitRef.current
      return {
        azimuth: Math.round((o.azimuth * 180) / Math.PI),
        elevation: Math.round((o.elevation * 180) / Math.PI),
        radius: Math.round(o.radius),
        target: [Math.round(o.target.x), Math.round(o.target.y), Math.round(-o.target.z)]
      }
    }

    onRegisterCamera(setCamera, getCamera)
  }, [onRegisterCamera, model.faces, scale, bumpGizmo])

  // Load face textures asynchronously
  useEffect(() => {
    let active = true
    const paths = model.faces.map((f) => f.assetPath).filter((p): p is string => Boolean(p && p.trim()))
    if (paths.length === 0) return
    Promise.all(paths.map(async (p) => ({ path: p, res: await resolveFaceTexture(p) }))).then((results) => {
      if (!active) return
      setTextureMap((prev) => {
        const next = new Map(prev)
        for (const item of results) if (item.res) next.set(item.path, item.res)
        return next
      })
    })
    return () => {
      active = false
    }
  }, [model.faces])

  useEffect(() => {
    applyCameraPreset(orbitRef.current, cameraPreset)
    bumpGizmo()
  }, [cameraPreset, bumpGizmo])

  // Follow the app theme (Dark / Light) through the CSS design tokens.
  useEffect(() => {
    setSceneTheme(readAssemblySceneTheme(containerRef.current, appTheme))
  }, [appTheme])

  // Dynamic scene background based on lighting mood and theme
  useEffect(() => {
    const sky = resolveSkyAtmosphere(model.lighting, sceneTheme.isLight, sceneTheme.background)
    const scene = sceneRef.current
    if (scene) {
      if (scene.background instanceof THREE.Color) {
        scene.background.set(sky.background)
      } else {
        scene.background = new THREE.Color(sky.background)
      }
    }
  }, [model.lighting, sceneTheme])

  useThreeScene({ containerRef, rendererRef, sceneRef, cameraRef, meshGroupRef, helpersGroupRef, lightRigRef, orbitRef, bumpGizmo, setGizmoRect })

  // Dynamic light rig & shadow catcher
  useEffect(() => {
    if (!lightRigRef.current) return
    const spec = resolveLightRig(model.lighting)
    const bounds = modelBounds(model.faces)
    const rigBounds = bounds
      ? {
          center: toThree(bounds.center).multiplyScalar(scale),
          radius: Math.max(100, (Math.hypot(bounds.size[0], bounds.size[1], bounds.size[2]) * scale) / 2),
          minY: bounds.min[1] * scale
        }
      : { center: new THREE.Vector3(0, 0, 0), radius: 600, minY: -150 }
    applyLightRig(lightRigRef.current, spec, rigBounds)
  }, [model.lighting, model.faces, scale])

  useEffect(() => {
    if (helpersGroupRef.current) {
      const sky = resolveSkyAtmosphere(model.lighting, sceneTheme.isLight, sceneTheme.background)
      updateHelpersGroup(helpersGroupRef.current, showGrid, showAxes, sceneTheme, sky.isDarkScene)
    }
  }, [showGrid, showAxes, sceneTheme, model.lighting])

  // Reconcile face meshes: rebuild only changed geometry, reposition the rest.
  useEffect(() => {
    if (!meshGroupRef.current) return
    syncFaceMeshes(meshGroupRef.current, meshCacheRef.current, model.faces, {
      textureMap, selectedFaceId, meshOnlyPixels, showWireframe, scale, theme: sceneTheme, lockedStructure: model.lockedStructure
    })
  }, [model, selectedFaceId, showWireframe, meshOnlyPixels, textureMap, scale, sceneTheme])

  useEffect(() => {
    const cache = meshCacheRef.current
    return () => clearFaceMeshes(meshGroupRef.current, cache)
  }, [])

  // Frame selection (F key / toolbar button)
  useEffect(() => {
    if (!frameToken) return
    const camera = cameraRef.current
    const sel = model.faces.find((f) => f.id === selectedFaceId && !f.hidden)
    const faces = sel ? [sel] : model.faces.filter((f) => !f.hidden)
    if (!camera || faces.length === 0) return
    const box = new THREE.Box3().setFromPoints(faces.flatMap((f) => faceOutlineThree(f, scale)))
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const o = orbitRef.current
    o.target.copy(sphere.center)
    o.radius = Math.max(200, Math.min(6000, (sphere.radius * 1.35) / Math.tan((camera.fov * Math.PI) / 360)))
    bumpGizmo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameToken])

  const [isDragOver, setIsDragOver] = useState(false)
  const [dragOverFaceId, setDragOverFaceId] = useState<string | null>(null)

  const pickCtx = (): PickContext | null => {
    const container = containerRef.current
    const camera = cameraRef.current
    const group = meshGroupRef.current
    if (!container || !camera || !group) return null
    return { container, camera, group, faces: model.faces, textureMap }
  }
  const pick = (x: number, y: number, ignoreTransparent = true) => {
    const ctx = pickCtx()
    return ctx ? pickFace(ctx, x, y, ignoreTransparent) : null
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    if (!isDragOver) setIsDragOver(true)
    const hitId = pick(e.clientX, e.clientY)?.faceId ?? null
    if (hitId !== dragOverFaceId) setDragOverFaceId(hitId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragOver(false)
      setDragOverFaceId(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setDragOverFaceId(null)
    const assetPath = droppedAssetPath(e.dataTransfer)
    if (!assetPath) return
    const hit = pick(e.clientX, e.clientY)
    if (hit) return onDropAsset?.(assetPath, undefined, hit.faceId)
    onDropAsset?.(assetPath, dropPoint(e.clientX, e.clientY) ?? [0, 0, 0], null)
  }

  /** Drop position on the plane through the orbit target facing the camera. */
  const dropPoint = (clientX: number, clientY: number): [number, number, number] | null => {
    const container = containerRef.current
    const camera = cameraRef.current
    if (!container || !camera) return null
    const rect = container.getBoundingClientRect()
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera)
    const dir = camera.getWorldDirection(new THREE.Vector3()).negate()
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(dir, orbitRef.current.target)
    const hitPoint = new THREE.Vector3()
    if (!ray.ray.intersectPlane(plane, hitPoint)) return null
    return [Math.round(hitPoint.x / scale), Math.round(hitPoint.y / scale), Math.round(-hitPoint.z / scale)]
  }

  const startDrag = (e: React.PointerEvent, mode: DragMode, faceId: string | null = null) => {
    const ds = dragRef.current
    Object.assign(ds, { mode, faceId, prevX: e.clientX, prevY: e.clientY, startX: e.clientX, startY: e.clientY })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isGizmoDraggingRef.current) return
    if (e.button === 1) {
      e.preventDefault()
      return startDrag(e, 'orbit')
    }
    if (e.button === 2) return startDrag(e, 'panSpace')
    if (e.button !== 0) return
    const cellMode = e.shiftKey || meshEditMode === 'select' ? 'select' : e.altKey || meshEditMode === 'erase' ? 'erase' : null
    if (cellMode) {
      const hit = pick(e.clientX, e.clientY, false)
      const face = hit ? model.faces.find((f) => f.id === hit.faceId) : undefined
      if (hit && face) {
        const key = cellKeyAt(hit, face)
        if (cellMode === 'select') onToggleSelectCell?.(hit.faceId, key)
        else onToggleMeshCell?.(hit.faceId, key)
        return
      }
    }
    const hit = pick(e.clientX, e.clientY)
    const face = hit ? model.faces.find((f) => f.id === hit.faceId) : undefined
    if (!hit || !face) return startDrag(e, 'panSpace')
    onSelectFace(hit.faceId)
    if (face.locked) return startDrag(e, 'panSpace')

    // When a sculpt brush tool is active: sculpt the mesh locally like Blender!
    if (isBrushTool && hit && face) {
      const meshObj = meshGroupRef.current?.children.find(
        (c) => c.userData?.faceId === hit.faceId && (c as THREE.Mesh).isMesh
      ) as THREE.Mesh | undefined

      if (meshObj && cameraRef.current && containerRef.current) {
        const session = startSculptStroke(
          meshObj,
          hit.faceId,
          hit.point,
          e.clientX,
          e.clientY,
          cameraRef.current,
          containerRef.current.clientHeight || 500,
          active3DTool,
          brushSettings,
          face.sculptOffsets
        )
        if (session) {
          sculptSessionRef.current = session
          startDrag(e, 'brush', hit.faceId)
          onGestureChange?.(true)
          return
        }
      }
    }

    dragRef.current.initFacePos = [...face.position]
    startDrag(e, 'dragFace', hit.faceId)
    onGestureChange?.(true)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isGizmoDraggingRef.current) return
    const ds = dragRef.current
    const o = orbitRef.current
    const camera = cameraRef.current
    const container = containerRef.current

    if (container && brushCursorRef.current) {
      if (isBrushTool) {
        const rect = container.getBoundingClientRect()
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        brushCursorRef.current.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`
        brushCursorRef.current.style.display = 'block'
      } else {
        brushCursorRef.current.style.display = 'none'
      }
    }

    if (ds.mode === 'none') {
      if (!container) return
      const hit = pick(e.clientX, e.clientY)
      const locked = hit ? model.faces.find((f) => f.id === hit.faceId)?.locked : false
      if (isBrushTool) container.style.cursor = 'crosshair'
      else if (meshEditMode === 'erase' || e.altKey) container.style.cursor = hit ? 'crosshair' : 'default'
      else if (meshEditMode === 'select' || e.shiftKey) container.style.cursor = hit ? 'pointer' : 'default'
      else container.style.cursor = hit ? (locked ? 'not-allowed' : 'move') : 'grab'
      return
    }
    const dx = e.clientX - ds.prevX
    const dy = e.clientY - ds.prevY
    ds.prevX = e.clientX
    ds.prevY = e.clientY
    if (ds.mode === 'orbit') {
      if (container) container.style.cursor = 'grabbing'
      o.azimuth -= dx * 0.008
      o.elevation = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, o.elevation + dy * 0.008))
      return bumpGizmo()
    }
    if (!camera || !container) return
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    if (ds.mode === 'panSpace') {
      container.style.cursor = 'grabbing'
      const panSpeed = (o.radius / 1000) * 0.85
      o.target.addScaledVector(right, -dx * panSpeed).addScaledVector(up, dy * panSpeed)
      return bumpGizmo()
    }
    if (ds.mode === 'brush' && sculptSessionRef.current) {
      container.style.cursor = 'crosshair'
      const session = sculptSessionRef.current
      const rect = container.getBoundingClientRect()
      const mouseNdc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouseNdc, camera)
      const hits = raycaster.intersectObject(session.mesh, false)
      let currentHitWorld: THREE.Vector3
      if (hits.length > 0 && hits[0].point) {
        currentHitWorld = hits[0].point
      } else {
        const planeNormal = camera.getWorldDirection(new THREE.Vector3()).negate()
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, session.lastHitWorld)
        const planeHit = new THREE.Vector3()
        if (raycaster.ray.intersectPlane(plane, planeHit)) {
          currentHitWorld = planeHit
        } else {
          currentHitWorld = session.lastHitWorld
        }
      }
      applySculptStrokeMove(
        session,
        { x: e.clientX, y: e.clientY },
        currentHitWorld,
        camera,
        container.clientHeight || 500
      )
      return
    }
    if (ds.mode === 'dragFace' && ds.faceId && onUpdateFace) {
      container.style.cursor = 'move'
      const worldPerPx = (2 * Math.tan((camera.fov * Math.PI) / 360) * o.radius) / (container.clientHeight || 500)
      const delta = new THREE.Vector3()
        .addScaledVector(right, (e.clientX - ds.startX) * worldPerPx)
        .addScaledVector(up, -(e.clientY - ds.startY) * worldPerPx)
      const snap = (v: number) => (e.shiftKey ? Math.round(v / 10) * 10 : Math.round(v))
      onUpdateFace(ds.faceId, {
        position: [
          snap(ds.initFacePos[0] + delta.x / scale),
          snap(ds.initFacePos[1] + delta.y / scale),
          snap(ds.initFacePos[2] - delta.z / scale)
        ]
      })
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isGizmoDraggingRef.current) return
    if (dragRef.current.mode === 'brush') {
      if (sculptSessionRef.current) {
        const session = sculptSessionRef.current
        const newOffsets = endSculptStroke(session)
        sculptSessionRef.current = null
        if (onUpdateFace && session.faceId) {
          onUpdateFace(session.faceId, { sculptOffsets: newOffsets })
        }
      }
      onGestureChange?.(false)
    } else if (dragRef.current.mode === 'dragFace') {
      onGestureChange?.(false)
    }
    dragRef.current.mode = 'none'
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* pointer already released */
    }
    if (containerRef.current) containerRef.current.style.cursor = isBrushTool ? 'crosshair' : 'grab'
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const o = orbitRef.current
    o.radius = Math.max(200, Math.min(6000, o.radius * (e.deltaY > 0 ? 1.1 : 0.9)))
    bumpGizmo()
  }

  const dragOverFace = dragOverFaceId ? model.faces.find((f) => f.id === dragOverFaceId) : null
  const selectedFace = model.faces.find((f) => f.id === selectedFaceId && !f.hidden) || null
  const showGizmo =
    active3DTool === 'gizmo' &&
    selectedFace &&
    !selectedFace.locked &&
    cameraRef.current &&
    gizmoRect &&
    meshEditMode === 'none' &&
    gizmoMode !== 'off'
  const currentSky = resolveSkyAtmosphere(model.lighting, sceneTheme.isLight, sceneTheme.background)

  return (
    <div
      ref={containerRef}
      style={{ backgroundColor: currentSky.background }}
      className={`assembly-viewport-canvas-container${isDragOver ? ' drag-over-active' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        if (brushCursorRef.current) brushCursorRef.current.style.display = 'none'
      }}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault()
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Left Vertical Palette + Top Quick Controls Popup */}
      <Assembly3DVerticalPalette
        face={selectedFace || null}
        activeTool={active3DTool}
        onChangeTool={setActive3DTool}
        onUpdateFace={onUpdateFaceRef.current || onUpdateFace || (() => {})}
        gizmoMode={gizmoMode}
        onChangeGizmoMode={(mode) => onChangeGizmoMode?.(mode)}
        brushSettings={brushSettings}
        onChangeBrushSettings={(patch) => setBrushSettings((s) => ({ ...s, ...patch }))}
      />

      {/* Brush Circle Cursor Overlay: 120fps hardware accelerated via direct DOM transform, 0 React re-renders */}
      <div
        ref={brushCursorRef}
        className="assembly-3d-brush-cursor"
        style={{
          display: 'none',
          width: brushSettings.radius * 2,
          height: brushSettings.radius * 2
        }}
      />

      {showGizmo && (
        <AssemblyGizmo
          key={selectedFace.id}
          face={selectedFace}
          modelScale={scale}
          camera={cameraRef.current!}
          rect={gizmoRect!}
          tick={gizmoTick}
          gizmoMode={gizmoMode}
          onUpdateFace={onUpdateFaceRef.current || onUpdateFace || (() => {})}
          onDragStateChange={(isDragging) => {
            isGizmoDraggingRef.current = isDragging
            onGestureChange?.(isDragging)
          }}
        />
      )}
      {isDragOver && (
        <div className="viewport-drag-drop-hud">
          <div className="drag-drop-badge">
            {dragOverFace ? (
              <span>
                Thả để gán ảnh vào mặt: <strong>{dragOverFace.name}</strong>
              </span>
            ) : (
              <span>Thả vào không gian 3D để tạo mặt phẳng mới</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface SceneRefs {
  containerRef: React.MutableRefObject<HTMLDivElement | null>
  rendererRef?: React.MutableRefObject<THREE.WebGLRenderer | null>
  sceneRef: React.MutableRefObject<THREE.Scene | null>
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>
  meshGroupRef: React.MutableRefObject<THREE.Group | null>
  helpersGroupRef: React.MutableRefObject<THREE.Group | null>
  lightRigRef: React.MutableRefObject<SceneLightRig | null>
  orbitRef: React.MutableRefObject<OrbitState>
  bumpGizmo: () => void
  setGizmoRect: (r: GizmoRect) => void
}

/** Creates the renderer / scene / camera, runs the render loop and handles resizes. */
function useThreeScene(refs: SceneRefs): void {
  const { containerRef, rendererRef, sceneRef, cameraRef, meshGroupRef, helpersGroupRef, lightRigRef, orbitRef, bumpGizmo, setGizmoRect } = refs
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const width = container.clientWidth || 500
    const height = container.clientHeight || 400
    setGizmoRect({ x: 0, y: 0, w: width, h: height })

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(readAssemblySceneTheme(container, 'dark').background)
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(40, width / height, 10, 10000)
    cameraRef.current = camera
    // antialias → MSAA (alphaToCoverage), localClipping for intersection cuts, shadows for sun.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    if (rendererRef) rendererRef.current = renderer
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.localClippingEnabled = true
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(renderer.domElement)

    const lightRig = createLightRig(scene)
    lightRigRef.current = lightRig

    const helpers = new THREE.Group()
    scene.add(helpers)
    helpersGroupRef.current = helpers
    const meshGroup = new THREE.Group()
    scene.add(meshGroup)
    meshGroupRef.current = meshGroup

    const clock = new THREE.Clock()
    const prev = { az: NaN, el: NaN, r: NaN, t: new THREE.Vector3(NaN, NaN, NaN) }
    let animId = 0
    const render = () => {
      applyProceduralMotion(meshGroup, clock.getElapsedTime())
      const o = orbitRef.current
      camera.position.set(
        o.target.x + o.radius * Math.cos(o.elevation) * Math.sin(o.azimuth),
        o.target.y + o.radius * Math.sin(o.elevation),
        o.target.z + o.radius * Math.cos(o.elevation) * Math.cos(o.azimuth)
      )
      camera.lookAt(o.target)
      camera.updateMatrixWorld()
      if (o.azimuth !== prev.az || o.elevation !== prev.el || o.radius !== prev.r || !o.target.equals(prev.t)) {
        Object.assign(prev, { az: o.azimuth, el: o.elevation, r: o.radius })
        prev.t.copy(o.target)
        bumpGizmo()
      }
      renderer.render(scene, camera)
      animId = requestAnimationFrame(render)
    }
    render()

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        if (w <= 0 || h <= 0) continue
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
        setGizmoRect({ x: 0, y: 0, w, h })
        bumpGizmo()
      }
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      disposeLightRig(lightRig)
      renderer.dispose()
      renderer.domElement.parentElement?.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpGizmo])
}
