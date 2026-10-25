import * as THREE from 'three'

/**
 * Bộ dựng mesh dùng chung cho Bố cục 2D: một WebGL context duy nhất vẽ mesh đã uốn (xương motion / skin)
 * rồi chép kết quả sang canvas 2D của từng layer. Nhanh hơn hàng trăm lần so với cắt-vẽ từng tam giác
 * bằng Canvas 2D (mỗi tam giác phải rasterize lại cả bức ảnh).
 */
interface SharedGL {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  width: number
  height: number
}

let shared: SharedGL | null = null
let unavailable = false
const textures = new WeakMap<HTMLImageElement, THREE.Texture>()

function getShared(): SharedGL | null {
  if (shared) return shared
  if (unavailable || typeof document === 'undefined') return null
  try {
    const canvas = document.createElement('canvas')
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true })
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    canvas.addEventListener('webglcontextlost', () => {
      shared = null
    })
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000)
    const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false })
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material)
    mesh.frustumCulled = false
    scene.add(mesh)
    shared = { renderer, scene, camera, mesh, width: 0, height: 0 }
    return shared
  } catch (err) {
    console.warn('[sharedMeshRenderer] WebGL không khả dụng, dùng Canvas 2D dự phòng:', err)
    unavailable = true
    return null
  }
}

function textureFor(image: HTMLImageElement): THREE.Texture {
  let tex = textures.get(image)
  if (!tex) {
    tex = new THREE.Texture(image)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    tex.needsUpdate = true
    textures.set(image, tex)
  }
  return tex
}

export interface MeshCanvasBounds {
  /** Toạ độ canvas (Y hướng xuống) của góc trên-trái vùng cần vẽ. */
  minX: number
  minY: number
  width: number
  height: number
}

/**
 * Vẽ mesh (positions cục bộ Y-up, uv của geometry) lên ctx tại vùng bounds.
 * Trả về false nếu WebGL không dùng được để caller vẽ dự phòng.
 */
export function renderMeshToCanvas(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  geometry: THREE.BufferGeometry,
  positions: Float32Array,
  bounds: MeshCanvasBounds,
  ratio: number
): boolean {
  const gl = getShared()
  if (!gl) return false
  const pw = Math.max(1, Math.ceil(bounds.width * ratio))
  const ph = Math.max(1, Math.ceil(bounds.height * ratio))
  // Bộ đệm chỉ nới rộng, không cấp phát lại mỗi khung hình
  if (pw > gl.width || ph > gl.height) {
    gl.width = Math.max(gl.width, pw)
    gl.height = Math.max(gl.height, ph)
    gl.renderer.setSize(gl.width, gl.height, false)
  }
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
    ; (position.array as Float32Array).set(positions)
  position.needsUpdate = true
  gl.mesh.geometry = geometry
  const tex = textureFor(image)
  if (gl.mesh.material.map !== tex) {
    const hadMap = Boolean(gl.mesh.material.map)
    gl.mesh.material.map = tex
    if (!hadMap) gl.mesh.material.needsUpdate = true
  }
  const cam = gl.camera
  cam.left = bounds.minX
  cam.right = bounds.minX + bounds.width
  cam.top = -bounds.minY
  cam.bottom = -(bounds.minY + bounds.height)
  cam.updateProjectionMatrix()
  gl.renderer.setViewport(0, 0, pw, ph)
  gl.renderer.setScissor(0, 0, pw, ph)
  gl.renderer.setScissorTest(true)
  gl.renderer.clear()
  gl.renderer.render(gl.scene, cam)
  // Vùng vẽ nằm ở góc dưới-trái bộ đệm WebGL (gốc toạ độ GL ở dưới)
  ctx.drawImage(gl.renderer.domElement, 0, gl.height - ph, pw, ph, 0, 0, pw, ph)
  return true
}
