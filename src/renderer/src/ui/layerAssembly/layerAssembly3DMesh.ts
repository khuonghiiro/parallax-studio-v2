import * as THREE from 'three'
import type { AssembledLayerItem, LayerMotionSettings } from './types'

export interface Layer3DMeshInstance {
  group: THREE.Group
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  outline: THREE.LineSegments
  anchorDot: THREE.Mesh
  layerId: string
}

const textureCache = new Map<string, THREE.Texture>()
const textureLoader = new THREE.TextureLoader()

/**
 * Nạp hoặc lấy texture từ cache theo URL
 */
export function getOrCreateLayerTexture(url: string, onLoaded?: () => void): THREE.Texture | null {
  if (!url) return null
  const cached = textureCache.get(url)
  if (cached) return cached

  const tex = textureLoader.load(
    url,
    () => {
      tex.colorSpace = THREE.SRGBColorSpace
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
 * Tạo instance 3D Mesh cho 1 layer
 */
export function createLayer3DInstance(
  layer: AssembledLayerItem,
  textureUrl: string | null,
  onRequestRender: () => void
): Layer3DMeshInstance {
  const group = new THREE.Group()
  group.name = `layer-group-${layer.id}`

  // Kích thước chuẩn mặc định cho plane
  const defaultW = 320
  const defaultH = 320
  const geom = new THREE.PlaneGeometry(defaultW, defaultH)

  const texture = textureUrl ? getOrCreateLayerTexture(textureUrl, onRequestRender) : null

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: texture ? 0xffffff : 0x4a5568,
    transparent: true,
    alphaTest: 0.02,
    side: THREE.DoubleSide,
    opacity: layer.opacity
  })

  const mesh = new THREE.Mesh(geom, material)
  mesh.name = `layer-mesh-${layer.id}`
  mesh.userData = { layerId: layer.id }

  const outline = createRectOutline(defaultW + 4, defaultH + 4, 0x38bdf8)
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
    layerId: layer.id
  }
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
  const halfH = 160 // tương ứng defaultH / 2
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

  // 4. Xoay và Scale
  const baseRotRad = (-layer.rotation * Math.PI) / 180
  group.rotation.set(0, 0, baseRotRad + motion.animRotateRad)

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
