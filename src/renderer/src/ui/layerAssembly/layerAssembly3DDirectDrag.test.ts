import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  findLayerMeshHit,
  createLayerDragPlane,
  computeLayerDragDisplacement
} from './layerAssembly3DDirectDrag'
import type { Layer3DMeshInstance } from './layerAssembly3DMesh'

describe('layerAssembly3DDirectDrag', () => {
  function makeMockInstance(id: string, pos: [number, number, number] = [0, 0, 0]): Layer3DMeshInstance {
    const group = new THREE.Group()
    group.position.set(pos[0], pos[1], pos[2])
    const geom = new THREE.PlaneGeometry(100, 100)
    const mat = new THREE.MeshLambertMaterial()
    const mesh = new THREE.Mesh(geom, mat)
    mesh.userData = { layerId: id }
    group.add(mesh)
    return {
      group,
      mesh,
      material: mat,
      outline: new THREE.LineSegments(),
      anchorDot: new THREE.Mesh(),
      layerId: id
    }
  }

  it('phát hiện click trúng mesh layer qua Raycaster', () => {
    const inst = makeMockInstance('layer-1', [0, 0, 0])
    const map = new Map<string, Layer3DMeshInstance>()
    map.set('layer-1', inst)

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 500), new THREE.Vector3(0, 0, -1))
    const hit = findLayerMeshHit(raycaster, map)

    expect(hit).not.toBeNull()
    expect(hit?.layerId).toBe('layer-1')
    expect(hit?.point.x).toBeCloseTo(0)
    expect(hit?.point.y).toBeCloseTo(0)
    expect(hit?.point.z).toBeCloseTo(0)
  })

  it('tạo drag plane có pháp tuyến hướng về phía camera', () => {
    const inst = makeMockInstance('layer-1', [0, 0, 0])
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000)
    camera.position.set(0, 0, 500)
    camera.lookAt(0, 0, 0)

    const hitPoint = new THREE.Vector3(0, 0, 0)
    const plane = createLayerDragPlane(inst, camera, hitPoint)

    expect(plane.normal.z).toBeGreaterThan(0)
  })

  it('tính toán độ dời chuột trên mặt phẳng layer chính xác', () => {
    const inst = makeMockInstance('layer-1', [0, 0, 0])
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000)
    camera.position.set(0, 0, 500)
    camera.lookAt(0, 0, 0)

    const hitPoint = new THREE.Vector3(0, 0, 0)
    const plane = createLayerDragPlane(inst, camera, hitPoint)

    // Raycast bắn vào điểm (25, 30, 0)
    const raycaster = new THREE.Raycaster(new THREE.Vector3(25, 30, 500), new THREE.Vector3(0, 0, -1))
    const disp = computeLayerDragDisplacement(raycaster, plane, hitPoint, inst)

    expect(disp).not.toBeNull()
    expect(disp?.dx).toBeCloseTo(25)
    expect(disp?.dy).toBeCloseTo(30)
  })
})
