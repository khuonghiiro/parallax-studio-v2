import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { Face3D } from './types'
import type { ResolvedTexture } from './textureResolver'
import { buildFaceGeometry, createFaceMaterial } from './assemblyMeshFactory'
import { faceGridSize } from './types'

export interface DeformedMesh2DCanvasProps {
  face: Face3D
  resolvedTexture: ResolvedTexture | null
  width: number
  height: number
  meshOnlyPixels?: boolean
}

/**
 * Render chiếu thẳng trực diện (Orthographic Front Projection) của mesh 3D trên không gian 2D.
 * Giúp người dùng nhìn thấy chính xác 100% hình ảnh texture đã bị biến dạng (uốn cong,
 * vát nhọn taper, lượn sóng lateral, và các nét điêu khắc cọ lồi lõm sống lá) đối chiếu với 3D.
 */
export function DeformedMesh2DCanvas({
  face,
  resolvedTexture,
  width,
  height,
  meshOnlyPixels = true
}: DeformedMesh2DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)

  // Khởi tạo WebGL Renderer và Scene một lần duy nhất
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Camera chiếu thẳng góc trực diện (Orthographic view)
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.1,
      4000
    )
    camera.position.set(0, 0, 1000)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Ánh sáng dịu nhẹ làm nổi bật khối 3D mà không làm sai lệch màu texture
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.88)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.42)
    dirLight.position.set(200, 300, 600)
    scene.add(dirLight)

    return () => {
      renderer.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
    }
  }, [])

  // Cập nhật kích thước camera khi width/height thay đổi
  useEffect(() => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    if (!renderer || !camera) return

    renderer.setSize(width, height)
    camera.left = -width / 2
    camera.right = width / 2
    camera.top = height / 2
    camera.bottom = -height / 2
    camera.updateProjectionMatrix()
  }, [width, height])

  // Rebuild mesh và re-render khi face hoặc texture thay đổi
  useEffect(() => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!renderer || !scene || !camera) return

    // Dọn dẹp mesh cũ
    if (meshRef.current) {
      scene.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      if (Array.isArray(meshRef.current.material)) {
        meshRef.current.material.forEach((m) => m.dispose())
      } else {
        meshRef.current.material.dispose()
      }
      meshRef.current = null
    }

    const { cols, rows } = faceGridSize(face)
    const bendX = face.bendX || 0
    const bendY = face.bendY || 0
    const bendLateral = face.bendLateral || 0
    const bendRegion = face.bendRegion || 'all'
    const gridRotation = face.gridRotation || 0
    const selectedCells = face.selectedCells || []
    const cellBendAngle = face.cellBendAngle || 0
    const hiddenCells = face.hiddenCells || []

    const geo = buildFaceGeometry(
      face,
      resolvedTexture,
      meshOnlyPixels,
      1.0, // scale = 1.0 (chuẩn kích thước pixel)
      cols,
      rows,
      bendX,
      bendY,
      bendRegion,
      hiddenCells,
      gridRotation,
      selectedCells,
      cellBendAngle,
      bendLateral
    )

    const mat = createFaceMaterial(face, resolvedTexture?.texture ?? null, '#4ade80')
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(0, 0, 0)
    mesh.rotation.set(0, 0, 0)
    scene.add(mesh)
    meshRef.current = mesh

    renderer.render(scene, camera)
  }, [face, resolvedTexture, meshOnlyPixels])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    />
  )
}
