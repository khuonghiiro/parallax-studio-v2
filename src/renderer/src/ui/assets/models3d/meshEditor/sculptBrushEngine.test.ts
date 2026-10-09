import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  computeWorldBrushRadius,
  startSculptStroke,
  applySculptStrokeMove,
  endSculptStroke
} from './sculptBrushEngine'

describe('sculptBrushEngine - Local Blender-style Sculpting', () => {
  it('computes world brush radius proportional to distance and camera FOV', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000)
    camera.position.set(0, 0, 100)
    const hitPoint = new THREE.Vector3(0, 0, 0)
    const radiusWorld = computeWorldBrushRadius(50, hitPoint, camera, 500)
    expect(radiusWorld).toBeGreaterThan(0)
    expect(radiusWorld).toBeLessThan(100)
  })

  it('only affects vertices within brush radius, leaving surrounding mesh untouched', () => {
    // Tạo 1 plane 100x100 với 10x10 subdivisions (121 vertices)
    const geo = new THREE.PlaneGeometry(100, 100, 10, 10)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial())
    mesh.updateMatrixWorld()

    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000)
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    const hitCenter = new THREE.Vector3(0, 0, 0) // Tâm mesh
    const session = startSculptStroke(
      mesh,
      'face-test',
      hitCenter,
      250,
      250,
      camera,
      500,
      'grab',
      { radius: 15, strength: 0.8, invert: false }
    )

    expect(session).not.toBeNull()
    if (!session) return

    // Bán kính nhỏ nên chỉ một phần nhỏ các đỉnh bị ảnh hưởng, không phải toàn bộ 121 đỉnh
    expect(session.affectedIndices.length).toBeGreaterThan(0)
    expect(session.affectedIndices.length).toBeLessThan(geo.attributes.position.count)

    // Đỉnh ở 4 góc xa (ví dụ x=50, y=50) tuyệt đối không nằm trong affectedIndices
    const pos = geo.attributes.position
    const cornerIndex = 0 // x = -50, y = 50
    expect(session.affectedIndices).not.toContain(cornerIndex)

    // Thực hiện kéo cọ (grab move)
    const cornerXBefore = pos.getX(cornerIndex)
    const cornerYBefore = pos.getY(cornerIndex)
    const cornerZBefore = pos.getZ(cornerIndex)

    applySculptStrokeMove(session, { x: 280, y: 250 }, camera, 500)

    // Đỉnh góc xa giữ nguyên tuyệt đối!
    expect(pos.getX(cornerIndex)).toBe(cornerXBefore)
    expect(pos.getY(cornerIndex)).toBe(cornerYBefore)
    expect(pos.getZ(cornerIndex)).toBe(cornerZBefore)

    // Đỉnh ở tâm (bị affected) thì bị biến dạng
    const centerIdx = session.affectedIndices[0]
    expect(pos.getX(centerIdx)).not.toBe(session.initialPositions[centerIdx * 3])

    // Kết thúc stroke
    const offsets = endSculptStroke(session)
    expect(offsets.length).toBe(pos.count * 3)
    // Độ lệch đỉnh góc xa là 0
    expect(offsets[cornerIndex * 3]).toBe(0)
    expect(offsets[cornerIndex * 3 + 1]).toBe(0)
    expect(offsets[cornerIndex * 3 + 2]).toBe(0)
  })

  it('supports inflate brush to locally push vertices along Z', () => {
    const geo = new THREE.PlaneGeometry(50, 50, 6, 6)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial())
    mesh.updateMatrixWorld()

    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000)
    camera.position.set(0, 0, 80)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    const hitCenter = new THREE.Vector3(0, 0, 0)
    const session = startSculptStroke(
      mesh,
      'face-inflate',
      hitCenter,
      250,
      250,
      camera,
      500,
      'inflate',
      { radius: 30, strength: 0.9, invert: false }
    )

    expect(session).not.toBeNull()
    if (!session) return

    applySculptStrokeMove(session, { x: 250, y: 270 }, camera, 500)

    const pos = geo.attributes.position
    const centerIdx = session.affectedIndices.find((idx) => {
      return Math.abs(session.initialPositions[idx * 3]) < 1 && Math.abs(session.initialPositions[idx * 3 + 1]) < 1
    })

    if (centerIdx !== undefined) {
      expect(pos.getZ(centerIdx)).toBeGreaterThan(0)
    }
  })
})
