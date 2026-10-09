import * as THREE from 'three'
import type { AssembledLayerItem, LayerMotionSettings } from './types'
import { depthEuler } from '../../engine/spatial'

export interface Layer3DMeshInstance {
  group: THREE.Group
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  outline: THREE.LineSegments
  anchorDot: THREE.Mesh
  layerId: string
  currentTextureUrl?: string
}

const textureCache = new Map<string, THREE.Texture>()
const textureLoader = new THREE.TextureLoader()

/**
 * Nạp hoặc lấy texture từ cache theo URL với độ sắc nét cao (Anisotropic filtering 16x)
 */
export function getOrCreateLayerTexture(url: string, onLoaded?: () => void): THREE.Texture | null {
  if (!url) return null
  const cached = textureCache.get(url)
  if (cached) return cached

  const tex = textureLoader.load(
    url,
    () => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 16
      tex.needsUpdate = true
      onLoaded?.()
    },
    undefined,
    (err) => {
      console.warn('[LayerAssembly3D] Failed to load texture:', url, err)
    }
  )
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 16
  textureCache.set(url, tex)
  return tex
}

/**
 * Dọn dẹp cache texture khi cần
 */
export function clearLayerTextureCache(): void {
  for (const tex of textureCache.values()) {
    tex.dispose()
  }
  textureCache.clear()
}

/**
 * Tính toán độ dời chuyển động hoạt ảnh của layer theo thời gian thực
 */
export function computeLayer3DMotion(motion: LayerMotionSettings, time: number) {
  const { type, speed, amplitude, phaseOffset = 0 } = motion
  const t = time * speed + phaseOffset

  let animRotateDeg = 0
  let animScaleX = 1
  let animScaleY = 1
  let animTranslateX = 0
  let animTranslateY = 0

  if (type === 'sway') {
    // Đung đưa xoay góc quanh điểm neo
    animRotateDeg = Math.sin(t * Math.PI * 2) * amplitude
  } else if (type === 'breathe') {
    // Phập phồng co giãn tỉ lệ
    const factor = 1 + Math.sin(t * Math.PI * 2) * (amplitude / 100)
    animScaleX = factor
    animScaleY = factor
  } else if (type === 'float') {
    // Lơ lửng dao động dọc
    animTranslateY = Math.sin(t * Math.PI * 2) * amplitude
  } else if (type === 'rocking') {
    // Bập bênh con lắc
    animRotateDeg = Math.cos(t * Math.PI * 2) * amplitude
    animTranslateX = Math.sin(t * Math.PI * 2) * (amplitude * 0.4)
  }

  return {
    animRotateRad: (animRotateDeg * Math.PI) / 180,
    animScaleX,
    animScaleY,
    animTranslateX,
    animTranslateY
  }
}

/**
 * Tạo khung viền bao quanh hình chữ nhật 3D (Outline Bounding Box)
 */
export function createRectOutline(width: number, height: number, color = 0x2680eb): THREE.LineSegments {
  const halfW = width / 2
  const halfH = height / 2
  const points = [
    new THREE.Vector3(-halfW, -halfH, 0),
    new THREE.Vector3(halfW, -halfH, 0),
    new THREE.Vector3(halfW, -halfH, 0),
    new THREE.Vector3(halfW, halfH, 0),
    new THREE.Vector3(halfW, halfH, 0),
    new THREE.Vector3(-halfW, halfH, 0),
    new THREE.Vector3(-halfW, halfH, 0),
    new THREE.Vector3(-halfW, -halfH, 0)
  ]
  const geom = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity: 0.95
  })
  return new THREE.LineSegments(geom, mat)
}

/**
 * Điểm chấm neo (Anchor Indicator) 3D
 */
export function createAnchorDot(): THREE.Mesh {
  const geom = new THREE.SphereGeometry(6, 16, 16)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    depthTest: false,
    transparent: true
  })
  return new THREE.Mesh(geom, mat)
}

/**
 * Tính toán kích thước w, h vừa vặn bảo toàn tỉ lệ ảnh (Aspect Ratio)
 */
function computePlaneDimensions(texture: THREE.Texture | null, maxDim = 340): { w: number; h: number } {
  if (texture && texture.image && texture.image.width && texture.image.height) {
    const aspect = texture.image.width / texture.image.height
    if (aspect >= 1) {
      return { w: maxDim, h: Math.round(maxDim / aspect) }
    }
    return { w: Math.round(maxDim * aspect), h: maxDim }
  }
  return { w: 320, h: 320 }
}

/**
 * Tạo instance 3D Mesh cho 1 layer
 */
export function createLayer3DInstance(
  layer: AssembledLayerItem,
  textureUrl: string | null,
  onRequestRender: () => void
): Layer3DMeshInstance {
  const group = new THREE.Group()
  group.name = `layer-group-${layer.id}`

  const texture = textureUrl
    ? getOrCreateLayerTexture(textureUrl, () => {
        if (texture && texture.image && texture.image.width && texture.image.height) {
          const { w, h } = computePlaneDimensions(texture)
          mesh.geometry.dispose()
          mesh.geometry = new THREE.PlaneGeometry(w, h)
          outline.geometry.dispose()
          outline.geometry = createRectOutline(w + 4, h + 4, 0x38bdf8).geometry
        }
        onRequestRender()
      })
    : null

  const { w, h } = computePlaneDimensions(texture)
  const geom = new THREE.PlaneGeometry(w, h)

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: texture ? 0xffffff : 0x4a5568,
    transparent: true,
    alphaTest: 0.01,
    side: THREE.DoubleSide,
    opacity: layer.opacity,
    depthWrite: false
  })

  const mesh = new THREE.Mesh(geom, material)
  mesh.name = `layer-mesh-${layer.id}`
  mesh.userData = { layerId: layer.id }

  const outline = createRectOutline(w + 4, h + 4, 0x38bdf8)
  outline.visible = false

  const anchorDot = createAnchorDot()
  anchorDot.visible = false

  group.add(mesh)
  group.add(outline)
  group.add(anchorDot)

  return {
    group,
    mesh,
    material,
    outline,
    anchorDot,
    layerId: layer.id,
    currentTextureUrl: textureUrl || undefined
  }
}

/**
 * Cập nhật texture cho 1 layer 3D instance (khi ảnh tải xong hoặc nâng cấp lên ảnh sắc nét full-res)
 */
export function updateLayerInstanceTexture(
  inst: Layer3DMeshInstance,
  textureUrl: string | null,
  onRequestRender: () => void
): void {
  if (inst.currentTextureUrl === textureUrl) return
  inst.currentTextureUrl = textureUrl || undefined

  if (!textureUrl) {
    inst.material.map = null
    inst.material.color.setHex(0x4a5568)
    inst.material.needsUpdate = true
    onRequestRender()
    return
  }

  const texture = getOrCreateLayerTexture(textureUrl, () => {
    if (texture && texture.image && texture.image.width && texture.image.height) {
      const { w, h } = computePlaneDimensions(texture)
      inst.mesh.geometry.dispose()
      inst.mesh.geometry = new THREE.PlaneGeometry(w, h)
      inst.outline.geometry.dispose()
      inst.outline.geometry = createRectOutline(w + 4, h + 4, 0x38bdf8).geometry
    }
    inst.material.map = texture
    inst.material.color.setHex(0xffffff)
    inst.material.needsUpdate = true
    onRequestRender()
  })

  if (texture) {
    inst.material.map = texture
    inst.material.color.setHex(0xffffff)
    inst.material.needsUpdate = true
    if (texture.image && texture.image.width && texture.image.height) {
      const { w, h } = computePlaneDimensions(texture)
      inst.mesh.geometry.dispose()
      inst.mesh.geometry = new THREE.PlaneGeometry(w, h)
      inst.outline.geometry.dispose()
      inst.outline.geometry = createRectOutline(w + 4, h + 4, 0x38bdf8).geometry
    }
  }
  onRequestRender()
}

/**
 * Cập nhật vị trí, góc xoay, scale và hoạt ảnh cho 3D layer instance
 */
export function updateLayer3DInstance(
  inst: Layer3DMeshInstance,
  layer: AssembledLayerItem,
  time: number,
  zExaggeration: number,
  isSelected: boolean
): void {
  const { group, mesh, material, outline, anchorDot } = inst

  // 1. Tính toán chuyển động hoạt ảnh
  const motion = computeLayer3DMotion(layer.motion, time)

  // 2. Điểm neo (Anchor Pivot)
  const planeGeom = mesh.geometry as THREE.PlaneGeometry
  const meshH = planeGeom.parameters?.height || 320
  const halfH = meshH / 2
  let pivotOffsetY = 0
  let anchorY = 0

  if (layer.motion.anchor === 'bottom') {
    pivotOffsetY = halfH
    anchorY = -halfH
  } else if (layer.motion.anchor === 'top') {
    pivotOffsetY = -halfH
    anchorY = halfH
  }

  // 3. Tọa độ Three.js:
  // - X: ngang (layer.x)
  // - Y: dọc (-layer.y, đảo dấu vì màn hình Y hướng xuống)
  // - Z: chiều sâu (-layer.z * zExaggeration)
  const posX = layer.x + motion.animTranslateX
  const posY = -layer.y + motion.animTranslateY
  const posZ = -layer.z * zExaggeration

  group.position.set(posX, posY, posZ)

  // 4. Xoay 3D (X, Y, Z) và Scale
  const euler = depthEuler([
    layer.rotationX || 0,
    layer.rotationY || 0,
    layer.rotation || 0
  ])
  euler.z += motion.animRotateRad
  group.rotation.copy(euler)

  const scaleX = layer.scale * motion.animScaleX
  const scaleY = layer.scale * motion.animScaleY
  group.scale.set(scaleX, scaleY, 1)

  // Đặt vị trí mesh tương đối so với pivot
  mesh.position.set(0, pivotOffsetY, 0)
  outline.position.set(0, pivotOffsetY, 0.5)
  anchorDot.position.set(0, anchorY + pivotOffsetY, 2)

  // 5. Thuộc tính hiển thị
  material.opacity = layer.opacity
  group.visible = !layer.hidden

  // 6. Highlight khi được chọn
  outline.visible = isSelected
  anchorDot.visible = isSelected
}

/**
 * Tạo hình nón kim tự tháp Camera Frustum 3D thể hiện góc nhìn và khoảng cách từ camera tới canvas
 */
export function createCameraFrustumHelper(width: number, height: number, distance: number): THREE.LineSegments {
  const halfW = width / 2
  const halfH = height / 2
  const apex = new THREE.Vector3(0, 0, distance) // Đỉnh camera ở phía trước nhìn về gốc (0, 0, 0)

  // 4 góc của khung canvas tại z = 0
  const c0 = new THREE.Vector3(-halfW, -halfH, 0)
  const c1 = new THREE.Vector3(halfW, -halfH, 0)
  const c2 = new THREE.Vector3(halfW, halfH, 0)
  const c3 = new THREE.Vector3(-halfW, halfH, 0)

  const points = [
    // 4 tia nhìn từ đỉnh camera tới 4 góc canvas
    apex, c0,
    apex, c1,
    apex, c2,
    apex, c3,
    // Trục ngắm tâm (Center aim line)
    apex, new THREE.Vector3(0, 0, 0),
    // Khung viền đáy
    c0, c1,
    c1, c2,
    c2, c3,
    c3, c0
  ]

  const geom = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({
    color: 0xffc24b, // Vàng cam ấm chuẩn camera path/frustum
    transparent: true,
    opacity: 0.85,
    depthTest: false
  })

  return new THREE.LineSegments(geom, mat)
}

/**
 * Đường gióng đo độ sâu Z từ mặt phẳng tham chiếu z=0 tới vị trí của layer
 */
export function createDepthGuideLine(posX: number, posY: number, posZ: number): THREE.Line {
  const points = [
    new THREE.Vector3(posX, posY, 0),
    new THREE.Vector3(posX, posY, posZ)
  ]
  const geom = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineDashedMaterial({
    color: 0x38bdf8,
    dashSize: 8,
    gapSize: 4,
    transparent: true,
    opacity: 0.9,
    depthTest: false
  })
  const line = new THREE.Line(geom, mat)
  line.computeLineDistances()
  return line
}

