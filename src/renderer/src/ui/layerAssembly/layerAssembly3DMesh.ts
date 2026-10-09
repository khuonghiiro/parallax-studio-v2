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
import { computeLayerMotion } from './layerAssemblyMotion'

export function computeLayer3DMotion(motion: LayerMotionSettings, time: number) {
  return computeLayerMotion(motion, time)
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
 * Tính toán khoảng cách camera để đóng khung vừa vặn (Fit Framing Distance)
 * bảo đảm cả chiều rộng lẫn chiều cao đều nằm trọn trong khung nhìn camera fov 45°
 */
export function computeFramingDistance(
  targetWidth: number,
  targetHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  fovDeg = 45,
  padding = 1.16
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    const fovRad = (fovDeg * Math.PI) / 180
    return Math.round((Math.max(targetWidth, targetHeight) * padding) / (2 * Math.tan(fovRad / 2)))
  }
  const aspect = viewportWidth / viewportHeight
  const fovRad = (fovDeg * Math.PI) / 180
  const tanHalf = Math.tan(fovRad / 2)
  const distV = (targetHeight * padding) / (2 * tanHalf)
  const distH = (targetWidth * padding) / (2 * tanHalf * aspect)
  return Math.round(Math.max(distV, distH))
}

/**
 * Mặt phẳng Canvas 2D tại z = 0 trong không gian 3D:
 * Gồm mặt nền bán trong suốt, khung viền cyan sắc nét và tâm chữ thập định vị,
 * giúp người dùng nhận diện ngay lập tức khung canvas tương đồng 100% với khung 2D.
 */
export function createCanvasPlaneHelper(width: number, height: number): THREE.Group {
  const group = new THREE.Group()
  group.name = 'canvas-plane-helper'

  const halfW = width / 2
  const halfH = height / 2

  // 1. Mặt phẳng nền bán trong suốt (Card canvas 3D)
  const planeGeom = new THREE.PlaneGeometry(width, height)
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    side: THREE.DoubleSide
  })
  const planeMesh = new THREE.Mesh(planeGeom, planeMat)
  planeMesh.position.set(0, 0, -0.2)
  group.add(planeMesh)

  // 2. Khung viền canvas sáng rõ nét (cyan var(--line-focus))
  const border = createRectOutline(width, height, 0x38bdf8)
  group.add(border)

  // 3. Đường chữ thập định tâm tại z = 0
  const crossPoints = [
    new THREE.Vector3(-halfW, 0, 0),
    new THREE.Vector3(halfW, 0, 0),
    new THREE.Vector3(0, -halfH, 0),
    new THREE.Vector3(0, halfH, 0)
  ]
  const crossGeom = new THREE.BufferGeometry().setFromPoints(crossPoints)
  const crossMat = new THREE.LineBasicMaterial({
    color: 0x334155,
    transparent: true,
    opacity: 0.5,
    depthTest: false
  })
  const crosshairs = new THREE.LineSegments(crossGeom, crossMat)
  group.add(crosshairs)

  return group
}

/**
 * Thu dọn tài nguyên mặt phẳng Canvas 2D 3D
 */
export function disposeCanvasPlaneHelper(group: THREE.Group): void {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).geometry) {
      ;(obj as THREE.Mesh).geometry.dispose()
    }
    if ((obj as THREE.Mesh).material) {
      const mat = (obj as THREE.Mesh).material
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose())
      } else {
        mat.dispose()
      }
    }
  })
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
function computePlaneDimensions(texture: THREE.Texture | null, maxDim = 380): { w: number; h: number } {
  if (texture && texture.image && texture.image.width && texture.image.height) {
    const aspect = texture.image.width / texture.image.height
    if (aspect >= 1) {
      return { w: maxDim, h: Math.round(maxDim / aspect) }
    }
    return { w: Math.round(maxDim * aspect), h: maxDim }
  }
  return { w: 380, h: 380 }
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

  const opacity = Math.max(0, Math.min(1, layer.opacity ?? 1))
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: texture ? 0xffffff : 0x4a5568,
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
    opacity,
    depthWrite: opacity >= 0.95
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
  isSelected: boolean,
  layerIndex = 0,
  clippingPlanes?: THREE.Plane[]
): void {
  const { group, mesh, material, outline, anchorDot } = inst

  // 1. Tính toán chuyển động hoạt ảnh
  const motion = computeLayer3DMotion(layer.motion, time)

  // 2. Điểm neo (Anchor Pivot) tính theo nửa kích thước của plane geometry
  const planeGeom = mesh.geometry as THREE.PlaneGeometry
  const meshW = planeGeom.parameters?.width || 380
  const meshH = planeGeom.parameters?.height || 380
  const halfW = meshW / 2
  const halfH = meshH / 2

  let ax = 0
  let ay = 0
  if (layer.motion.anchor === 'bottom') {
    ay = -halfH
  } else if (layer.motion.anchor === 'top') {
    ay = halfH
  } else if (layer.motion.anchor === 'left') {
    ax = -halfW
  } else if (layer.motion.anchor === 'right') {
    ax = halfW
  }

  // 3. Tọa độ Three.js đồng bộ chuẩn 2D:
  // - X: ngang (layer.x + animTranslateX)
  // - Y: dọc (-(layer.y + animTranslateY), đảo dấu vì màn hình Y hướng xuống)
  // - Z: chiều sâu (-layer.z * zExaggeration + micro-offset layerIndex để triệt tiêu Z-fighting khi trùng Z)
  const posX = layer.x + motion.animTranslateX
  const posY = -(layer.y + motion.animTranslateY)
  const posZ = -layer.z * zExaggeration + layerIndex * 0.05

  // Group được định vị chính xác tại tâm của layer trong không gian 3D
  group.position.set(posX, posY, posZ)

  // 4. Xoay 3D (X, Y, Z) và Scale
  const euler = depthEuler([
    layer.rotationX || 0,
    layer.rotationY || 0,
    layer.rotation || 0
  ])
  group.rotation.copy(euler)

  const scaleX = layer.scale * motion.animScaleX
  const scaleY = layer.scale * motion.animScaleY
  group.scale.set(scaleX, scaleY, 1)

  // 5. Chuyển động đung đưa xoay quanh điểm neo P = (ax, ay) đồng bộ 100% với 2D CSS
  // Trong CSS 2D, góc xoay dương theo chiều kim đồng hồ (Clockwise).
  // Trong Three.js, góc xoay quanh trục Z dương ngược chiều kim đồng hồ, do đó theta = -motion.animRotateRad
  // Khi xoay quanh điểm neo P(ax, ay) một góc theta, tâm mesh C(0, 0) dịch chuyển:
  // shiftX = ax * (1 - cos(theta)) + ay * sin(theta)
  // shiftY = ay * (1 - cos(theta)) - ax * sin(theta)
  // Đảm bảo: điểm neo (ax, ay) cố định tuyệt đối, tán cây nghiêng đúng hướng và đồng bộ hoàn hảo với 2D!
  const theta = -motion.animRotateRad
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const shiftX = ax * (1 - cosT) + ay * sinT
  const shiftY = ay * (1 - cosT) - ax * sinT

  mesh.position.set(shiftX, shiftY, 0)
  mesh.rotation.z = theta
  outline.position.set(shiftX, shiftY, 0.5)
  outline.rotation.z = theta
  anchorDot.position.set(ax, ay, 2)

  // 5. Thuộc tính hiển thị & Cắt góc nhìn camera
  const op = Math.max(0, Math.min(1, layer.opacity ?? 1))
  material.opacity = op
  material.depthWrite = op >= 0.95
  if (clippingPlanes) {
    material.clippingPlanes = clippingPlanes
  } else {
    material.clippingPlanes = null as any
  }
  group.visible = !layer.hidden

  // 6. Highlight khi được chọn
  outline.visible = isSelected
  anchorDot.visible = isSelected
}

/**
 * Tạo hình nón kim tự tháp Camera Frustum 3D thể hiện góc nhìn và khoảng cách từ camera tới canvas
 */
export function createCameraFrustumHelper(
  width: number,
  height: number,
  distance: number,
  isLight = false
): THREE.LineSegments {
  const halfW = width / 2
  const halfH = height / 2
  const apex = new THREE.Vector3(0, 0, distance) // Đỉnh camera ở phía trước nhìn về gốc (0, 0, 0)

  // 4 góc của khung canvas tại z = 0
  const c0 = new THREE.Vector3(-halfW, -halfH, 0)
  const c1 = new THREE.Vector3(halfW, -halfH, 0)
  const c2 = new THREE.Vector3(halfW, halfH, 0)
  const c3 = new THREE.Vector3(-halfW, halfH, 0)

  // Biểu tượng thân máy ảnh (Camera Body) ở phía sau đỉnh camera
  const camW = Math.max(28, width * 0.06)
  const camH = Math.max(24, height * 0.06)
  const camD = 35
  const b0 = new THREE.Vector3(-camW / 2, -camH / 2, distance + camD)
  const b1 = new THREE.Vector3(camW / 2, -camH / 2, distance + camD)
  const b2 = new THREE.Vector3(camW / 2, camH / 2, distance + camD)
  const b3 = new THREE.Vector3(-camW / 2, camH / 2, distance + camD)

  const points = [
    // 4 tia nhìn từ đỉnh camera tới 4 góc canvas
    apex, c0,
    apex, c1,
    apex, c2,
    apex, c3,
    // Khung viền đáy (Khung Camera soi Canvas tại z = 0)
    c0, c1,
    c1, c2,
    c2, c3,
    c3, c0,
    // Thân máy ảnh ở vị trí camera
    apex, b0,
    apex, b1,
    apex, b2,
    apex, b3,
    b0, b1,
    b1, b2,
    b2, b3,
    b3, b0
  ]

  const geom = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({
    color: isLight ? 0x2563eb : 0xffc24b, // Theme sáng dùng xanh Royal Blue đậm nét, Theme tối dùng vàng ấm
    transparent: true,
    opacity: isLight ? 0.95 : 0.9,
    depthTest: false
  })

  return new THREE.LineSegments(geom, mat)
}

/**
 * Tạo 4 mặt phẳng cắt (Clipping Planes) giới hạn tầm nhìn camera tại kích thước width x height
 */
export function createCameraClippingPlanes(width: number, height: number): THREE.Plane[] {
  const halfW = width / 2
  const halfH = height / 2
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), halfW), // x >= -halfW
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfW), // x <= halfW
    new THREE.Plane(new THREE.Vector3(0, 1, 0), halfH), // y >= -halfH
    new THREE.Plane(new THREE.Vector3(0, -1, 0), halfH) // y <= halfH
  ]
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

