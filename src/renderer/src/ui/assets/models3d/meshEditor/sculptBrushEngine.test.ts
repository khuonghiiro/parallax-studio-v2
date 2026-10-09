import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  computeCosineFalloff,
  computeWorldBrushRadius,
  startSculptStroke,
  applySculptStrokeMove,
  endSculptStroke
} from './sculptBrushEngine'

describe('sculptBrushEngine - Blender Sculpt Mode Continuous Dabbing', () => {
  it('computes cosine falloff (bell curve) smoothly from 1.0 to 0.0', () => {
    const radius = 20
    expect(computeCosineFalloff(0, radius)).toBeCloseTo(1.0, 5)
    expect(computeCosineFalloff(radius, radius)).toBeCloseTo(0.0, 5)
    expect(computeCosineFalloff(radius + 5, radius)).toBe(0)

    // Giá trị ở giữa bán kính (d = 10) phải là 0.5
    expect(computeCosineFalloff(10, radius)).toBeCloseTo(0.5, 5)

    // Đơn điệu giảm dần: 0 < d1 < d2 < R => f(d1) > f(d2)
    const f5 = computeCosineFalloff(5, radius)
    const f15 = computeCosineFalloff(15, radius)
    expect(f5).toBeGreaterThan(0.5)
    expect(f15).toBeLessThan(0.5)
  })

  it('computes world brush radius proportional to distance and camera FOV', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000)
    camera.position.set(0, 0, 100)
    const hitPoint = new THREE.Vector3(0, 0, 0)
    const radiusWorld = computeWorldBrushRadius(50, hitPoint, camera, 500)
    expect(radiusWorld).toBeGreaterThan(0)
    expect(radiusWorld).toBeLessThan(100)
  })

  it('grab tool: moves pinned vertices smoothly while leaving distant mesh untouched', () => {
    // Tạo 1 plane 100x100 với 10x10 subdivisions (121 vertices)
    const geo = new THREE.PlaneGeometry(100, 100, 10, 10)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial())
    mesh.updateMatrixWorld()

    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000)
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    const hitCenter = new THREE.Vector3(0, 0, 0)
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

    expect(session.grabIndices && session.grabIndices.length).toBeGreaterThan(0)
    expect(session.grabIndices!.length).toBeLessThan(geo.attributes.position.count)

    const pos = geo.attributes.position
    const cornerIndex = 0 // x = -50, y = 50
    expect(session.grabIndices).not.toContain(cornerIndex)

    const cornerXBefore = pos.getX(cornerIndex)
    const cornerYBefore = pos.getY(cornerIndex)
    const cornerZBefore = pos.getZ(cornerIndex)

    // Kéo chuột sang phải
    applySculptStrokeMove(session, { x: 280, y: 250 }, new THREE.Vector3(10, 0, 0), camera, 500)

    // Đỉnh góc xa giữ nguyên tuyệt đối!
    expect(pos.getX(cornerIndex)).toBe(cornerXBefore)
    expect(pos.getY(cornerIndex)).toBe(cornerYBefore)
    expect(pos.getZ(cornerIndex)).toBe(cornerZBefore)

    // Đỉnh ở tâm bị kéo sang phải
    const centerIdx = session.grabIndices![0]
    expect(pos.getX(centerIdx)).not.toBe(session.initialPositions[centerIdx * 3])

    // Kết thúc stroke
    const offsets = endSculptStroke(session)
    expect(offsets.length).toBe(pos.count * 3)
    expect(offsets[cornerIndex * 3]).toBe(0)
    expect(offsets[cornerIndex * 3 + 1]).toBe(0)
    expect(offsets[cornerIndex * 3 + 2]).toBe(0)
  })

  it('inflate tool: continuous stroke dabbing deforms vertices along the brush path', () => {
    const geo = new THREE.PlaneGeometry(100, 100, 20, 20)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial())
    mesh.updateMatrixWorld()

    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000)
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    const startHit = new THREE.Vector3(-20, 0, 0)
    const session = startSculptStroke(
      mesh,
      'face-inflate',
      startHit,
      200,
      250,
      camera,
      500,
      'inflate',
      { radius: 25, strength: 0.8, invert: false }
    )

    expect(session).not.toBeNull()
    if (!session) return

    // Rê chuột lướt sang phải tới (20, 0, 0)
    const endHit = new THREE.Vector3(20, 0, 0)
    applySculptStrokeMove(session, { x: 300, y: 250 }, endHit, camera, 500)

    const pos = geo.attributes.position
    let positiveZCount = 0
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) > 0.05) {
        positiveZCount++
      }
    }

    // Các đỉnh nằm trên vệt vẽ từ x=-20 đến x=20 đều được làm phồng lên Z > 0
    expect(positiveZCount).toBeGreaterThan(5)
  })

  it('multiple strokes accumulate offsets without resetting previous strokes', () => {
    const geo = new THREE.PlaneGeometry(100, 100, 10, 10)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial())
    mesh.updateMatrixWorld()

    const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000)
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()

    // --- NÉT CỌ 1: Làm phồng góc trái (-30, 0, 0) ---
    const s1 = startSculptStroke(
      mesh,
      'face-multi',
      new THREE.Vector3(-30, 0, 0),
      150,
      250,
      camera,
      500,
      'inflate',
      { radius: 20, strength: 0.8, invert: false }
    )
    expect(s1).not.toBeNull()
    const offsets1 = endSculptStroke(s1!)

    // Kiểm tra offsets1 có phần tử Z > 0 ở vùng x < 0
    const hasZ1 = offsets1.some((v, idx) => idx % 3 === 2 && v > 0)
    expect(hasZ1).toBe(true)

    // --- NÉT CỌ 2: Làm phồng góc phải (+30, 0, 0) với existingSculptOffsets = offsets1 ---
    const s2 = startSculptStroke(
      mesh,
      'face-multi',
      new THREE.Vector3(30, 0, 0),
      350,
      250,
      camera,
      500,
      'inflate',
      { radius: 20, strength: 0.8, invert: false },
      offsets1
    )
    expect(s2).not.toBeNull()
    const offsets2 = endSculptStroke(s2!)

    // offsets2 BẮT BUỘC phải giữ lại Z của nét 1 và có thêm Z của nét 2
    // Đếm số đỉnh có Z > 0 ở nét 2 phải LỚN HƠN hoặc BẰNG nét 1
    const countZ1 = offsets1.filter((v, idx) => idx % 3 === 2 && v > 0).length
    const countZ2 = offsets2.filter((v, idx) => idx % 3 === 2 && v > 0).length
    expect(countZ2).toBeGreaterThan(countZ1)
  })
})
