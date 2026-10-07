import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Face3D, Model3D } from './types'
import { resolveFaceTexture, type ResolvedTexture } from './textureResolver'
import { sampleAlphaGrid, buildAlphaTrimmedGeometry } from './alphaMeshBuilder'

interface AssemblyViewportProps {
  model: Model3D
  selectedFaceId: string | null
  showWireframe: boolean
  meshOnlyPixels?: boolean
  showGrid: boolean
  showAxes: boolean
  cameraPreset: 'front' | 'left' | 'right' | 'top' | 'iso'
  onSelectFace: (faceId: string) => void
}

const DEG = Math.PI / 180

export function AssemblyViewport({
  model,
  selectedFaceId,
  showWireframe,
  meshOnlyPixels = true,
  showGrid,
  showAxes,
  cameraPreset,
  onSelectFace
}: AssemblyViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const meshGroupRef = useRef<THREE.Group | null>(null)
  const helpersGroupRef = useRef<THREE.Group | null>(null)

  // Loaded textures map keyed by assetPath
  const [textureMap, setTextureMap] = useState<Map<string, ResolvedTexture>>(new Map())

  // Orbit state
  const orbitRef = useRef({
    isDragging: false,
    prevX: 0,
    prevY: 0,
    azimuth: -0.6, // rad
    elevation: 0.4, // rad
    radius: 1400,
    target: new THREE.Vector3(0, 100, 200)
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
    const o = orbitRef.current
    switch (cameraPreset) {
      case 'front':
        o.azimuth = 0
        o.elevation = 0.05
        o.radius = 1500
        break
      case 'left':
        o.azimuth = -Math.PI / 2
        o.elevation = 0.05
        o.radius = 1500
        break
      case 'right':
        o.azimuth = Math.PI / 2
        o.elevation = 0.05
        o.radius = 1500
        break
      case 'top':
        o.azimuth = 0
        o.elevation = Math.PI / 2 - 0.05
        o.radius = 1500
        break
      case 'iso':
        o.azimuth = -Math.PI / 4
        o.elevation = 0.45
        o.radius = 1600
        break
    }
  }, [cameraPreset])

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth || 500
    const height = container.clientHeight || 400

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

    // Animation loop
    let animId = 0
    const render = () => {
      const o = orbitRef.current
      const x = o.target.x + o.radius * Math.cos(o.elevation) * Math.sin(o.azimuth)
      const y = o.target.y + o.radius * Math.sin(o.elevation)
      const z = o.target.z + o.radius * Math.cos(o.elevation) * Math.cos(o.azimuth)
      camera.position.set(x, y, z)
      camera.lookAt(o.target)

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
  }, [])

  // Update helpers (Grid & Axes)
  useEffect(() => {
    const helpers = helpersGroupRef.current
    if (!helpers) return
    while (helpers.children.length > 0) {
      helpers.remove(helpers.children[0])
    }

    if (showGrid) {
      const grid = new THREE.GridHelper(2000, 20, 0x334155, 0x1e293b)
      grid.position.y = -150
      helpers.add(grid)
    }

    if (showAxes) {
      const axes = new THREE.AxesHelper(300)
      axes.position.set(0, -145, 0)
      helpers.add(axes)
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
      const resolved = face.assetPath ? textureMap.get(face.assetPath) : null

      const segX = showWireframe ? 16 : 1
      const segY = showWireframe ? 16 : 1

      let mat: THREE.Material
      let geo: THREE.BufferGeometry

      if (resolved) {
        mat = new THREE.MeshStandardMaterial({
          map: resolved.texture,
          side: THREE.DoubleSide,
          transparent: true,
          roughness: 0.5,
          metalness: 0.05
        })

        // Pixel-aware tight mesh: only generate triangles where pixels exist
        if (meshOnlyPixels && resolved.image) {
          const alphaGrid = sampleAlphaGrid(resolved.image, 16, 16, 15)
          geo = buildAlphaTrimmedGeometry(face.width * scale, face.height * scale, alphaGrid, 16, 16)
        } else {
          geo = new THREE.PlaneGeometry(face.width * scale, face.height * scale, segX, segY)
        }
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: face.color || '#8b7bff',
          side: THREE.DoubleSide,
          roughness: 0.5
        })
        geo = new THREE.PlaneGeometry(face.width * scale, face.height * scale, segX, segY)
      }

      const mesh = new THREE.Mesh(geo, mat)

      // Transform: Depth space to Three.js coordinates
      mesh.position.set(
        face.position[0] * scale,
        face.position[1] * scale,
        -face.position[2] * scale
      )

      const euler = new THREE.Euler(
        face.rotation[0] * DEG,
        -face.rotation[1] * DEG,
        -face.rotation[2] * DEG,
        'YXZ'
      )
      mesh.quaternion.setFromEuler(euler)
      mesh.userData = { faceId: face.id }
      meshGroup.add(mesh)

      // Wireframe overlay: if meshOnlyPixels is true, wireframe only shows on visible pixels!
      if (showWireframe) {
        const wireGeo = new THREE.WireframeGeometry(geo)
        const wireMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0x00ffff : 0x64748b,
          linewidth: isSelected ? 2 : 1,
          transparent: true,
          opacity: isSelected ? 0.95 : 0.55
        })
        const wire = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wire)
      }

      // Selection outline box if selected
      if (isSelected) {
        const boxGeo = new THREE.EdgesGeometry(geo)
        const boxMat = new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          linewidth: 2.5
        })
        const outline = new THREE.LineSegments(boxGeo, boxMat)
        outline.position.z += 1
        mesh.add(outline)
      }
    })
  }, [model, selectedFaceId, showWireframe, meshOnlyPixels, textureMap])

  // Mouse drag handlers for Orbit controls
  const handlePointerDown = (e: React.PointerEvent) => {
    const o = orbitRef.current
    o.isDragging = true
    o.prevX = e.clientX
    o.prevY = e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const o = orbitRef.current
    if (!o.isDragging) return
    const dx = e.clientX - o.prevX
    const dy = e.clientY - o.prevY
    o.prevX = e.clientX
    o.prevY = e.clientY

    if (e.buttons === 1) {
      // Left click = rotate
      o.azimuth -= dx * 0.008
      o.elevation = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, o.elevation + dy * 0.008))
    } else if (e.buttons === 2 || (e.buttons === 1 && e.shiftKey)) {
      // Right click or Shift+Left = Pan
      o.target.x -= dx * 0.8
      o.target.y += dy * 0.8
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    orbitRef.current.isDragging = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const o = orbitRef.current
    o.radius = Math.max(200, Math.min(6000, o.radius + e.deltaY * 1.2))
  }

  // Click on mesh to select face
  const handleClick = (e: React.MouseEvent) => {
    const container = containerRef.current
    const camera = cameraRef.current
    const meshGroup = meshGroupRef.current
    if (!container || !camera || !meshGroup) return

    const rect = container.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    const hits = raycaster.intersectObjects(meshGroup.children, true)
    if (hits.length > 0) {
      let cur: THREE.Object3D | null = hits[0].object
      while (cur && !cur.userData?.faceId && cur.parent !== meshGroup) {
        cur = cur.parent
      }
      if (cur?.userData?.faceId) {
        onSelectFace(cur.userData.faceId)
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="assembly-viewport-canvas-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      title="Kéo chuột trái: Xoay | Chuột phải/Shift+Kéo: Di chuyển | Lăn chuột: Phóng to/Thu nhỏ"
    />
  )
}
