import * as THREE from 'three'

/**
 * Tạo hình nón kim tự tháp Camera Frustum 3D thể hiện góc nhìn và khoảng cách từ camera tới canvas
 */
export function createCameraFrustumHelper(
  width: number,
  height: number,
  distance: number,
  isLight = false,
  backDepth = 220
): THREE.LineSegments {
  const halfW = width / 2
  const halfH = height / 2
  const apex = new THREE.Vector3(0, 0, distance) // Đỉnh camera ở phía trước nhìn về gốc (0, 0, 0)

  // 4 góc của khung canvas tại z = 0
  const c0 = new THREE.Vector3(-halfW, -halfH, 0)
  const c1 = new THREE.Vector3(halfW, -halfH, 0)
  const c2 = new THREE.Vector3(halfW, halfH, 0)
  const c3 = new THREE.Vector3(-halfW, halfH, 0)

  // 4 góc mở rộng ở phía sau mặt phẳng canvas z = -backDepth để bao bọc toàn bộ chiều sâu các layer
  const k = Math.max(1.05, (distance + backDepth) / Math.max(1, distance))
  const d0 = new THREE.Vector3(-halfW * k, -halfH * k, -backDepth)
  const d1 = new THREE.Vector3(halfW * k, -halfH * k, -backDepth)
  const d2 = new THREE.Vector3(halfW * k, halfH * k, -backDepth)
  const d3 = new THREE.Vector3(-halfW * k, halfH * k, -backDepth)

  // Biểu tượng thân máy ảnh (Camera Body) ở phía sau đỉnh camera
  const camW = Math.max(28, width * 0.06)
  const camH = Math.max(24, height * 0.06)
  const camD = 35
  const b0 = new THREE.Vector3(-camW / 2, -camH / 2, distance + camD)
  const b1 = new THREE.Vector3(camW / 2, -camH / 2, distance + camD)
  const b2 = new THREE.Vector3(camW / 2, camH / 2, distance + camD)
  const b3 = new THREE.Vector3(-camW / 2, camH / 2, distance + camD)

  const points = [
    // 4 tia nhìn từ đỉnh camera tới 4 góc canvas z = 0
    apex, c0,
    apex, c1,
    apex, c2,
    apex, c3,
    // 4 tia mở rộng tiếp từ canvas z = 0 ra sau z = -backDepth
    c0, d0,
    c1, d1,
    c2, d2,
    c3, d3,
    // Khung viền đáy trước (Khung Camera soi Canvas tại z = 0)
    c0, c1,
    c1, c2,
    c2, c3,
    c3, c0,
    // Khung viền giới hạn đáy sau (z = -backDepth)
    d0, d1,
    d1, d2,
    d2, d3,
    d3, d0,
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

