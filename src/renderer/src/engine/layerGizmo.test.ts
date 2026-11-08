import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createProject, createSolidLayer } from '../project/factory'
import { evaluateScene } from './evaluateScene'
import { composeDepthMatrix } from './spatial'
import { layerPivot, localPlaneHit, parentMatrix, projectPoint, resizedScale, ringPoint, rotationAngle, rotationBasis } from './layerGizmo'

describe('layer transform gizmo geometry', () => {
  it('recovers rotation angles on an oblique ring plane', () => {
    const camera = new THREE.PerspectiveCamera(45, 1.5, 1, 10000)
    camera.position.set(500, 350, 1800)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const rect = { x: 100, y: 30, w: 900, h: 600 }
    const basis = rotationBasis([20, 35, 10], 2, new THREE.Matrix4())
    const pivot = new THREE.Vector3(20, 30, -100)
    for (const angle of [-2, -0.5, 0.8, 2.9]) {
      const world = ringPoint(2, angle).transformDirection(basis).multiplyScalar(200).add(pivot)
      expect(rotationAngle(projectPoint(world, camera, rect), camera, rect, pivot, basis, 2)).toBeCloseTo(angle, 7)
    }
  })
  it('round trips an oblique, scaled image through perspective projection', () => {
    const camera = new THREE.PerspectiveCamera(45, 1.5, 1, 10000)
    camera.position.set(0, 0, 1800)
    camera.updateMatrixWorld()
    const world = composeDepthMatrix([80, 20, 300], [20, 35, 28], [1.7, 0.8, 1])
    const local = new THREE.Vector3(200, 100, 0)
    const rect = { x: 400, y: 30, w: 900, h: 600 }
    const screen = projectPoint(local.clone().applyMatrix4(world), camera, rect)
    const hit = localPlaneHit(screen, camera, rect, world)!
    expect(hit.distanceTo(local)).toBeLessThan(1e-8)
  })

  it('scales around the anchor and preserves the ratio with Shift', () => {
    const anchor = new THREE.Vector3(50, 25, 0)
    const from = new THREE.Vector3(150, 125, 0)
    const to = new THREE.Vector3(250, 225, 0)
    expect(resizedScale([2, 3, 1], from, to, anchor, [1, 1], true)).toEqual([4, 6, 1])
    expect(resizedScale([2, 3, 1], from, to, anchor, [1, 0], false)).toEqual([4, 3, 1])
  })

  it('keeps flipped scales and avoids singular transforms at zero', () => {
    const result = resizedScale([1, 1, 1], new THREE.Vector3(10, 10, 0), new THREE.Vector3(-10, 0, 0), new THREE.Vector3(), [1, 1], false)
    expect(result).toEqual([-1, 0.001, 1])
  })

  it('uses the parent layer matrix and the authored anchor as the pivot', () => {
    const project = createProject()
    const parent = createSolidLayer(project.comp)
    const child = createSolidLayer(project.comp)
    parent.autoScale = child.autoScale = false
    parent.transform.rotation.value = [15, 30, 45]
    child.parentId = parent.id
    child.transform.position.value = [10, 20, 30]
    child.transform.anchor = { value: [0.25, 0.5, 0], keyframes: [] }
    project.layers = [parent, child]
    const scene = evaluateScene(project, 0)
    const matrix = parentMatrix(scene.layers[1], scene)
    expect(matrix.elements).toEqual(scene.layers[0].world.elements)
    const expected = new THREE.Vector3(10, 20, -30).applyMatrix4(matrix)
    expect(layerPivot(scene.layers[1], [0.25, 0.5, 0]).distanceTo(expected)).toBeLessThan(1e-8)
  })

  it('computes tight 2.5D composite bounding box without huge empty gaps', () => {
    const project = createProject()
    const l1 = createSolidLayer(project.comp)
    const l2 = createSolidLayer(project.comp)
    l1.autoScale = l2.autoScale = false
    l1.props.width = 100
    l1.props.height = 100
    l2.props.width = 100
    l2.props.height = 100
    l1.transform.position.value = [0, 0, 0]
    l2.transform.position.value = [50, 50, 0]
    l1.composite = { instanceId: 'comp-1', compositeId: 'c1', compositeName: 'Comp', isRoot: true, lockedGroup: true, centerPosition: [0, 0, 0], rootOffset: [0, 0, 0] }
    l2.composite = { instanceId: 'comp-1', compositeId: 'c1', compositeName: 'Comp', isRoot: false, lockedGroup: true, centerPosition: [0, 0, 0], rootOffset: [50, 50, 0] }
    project.layers = [l1, l2]
    const scene = evaluateScene(project, 0)

    const groupLayers = scene.layers.filter((l) => l.layer.composite?.instanceId === 'comp-1')
    const tightBox = new THREE.Box3()
    const _vCorner = new THREE.Vector3()
    for (const gl of groupLayers) {
      for (const [hx, hy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
        _vCorner.set(hx * gl.size[0], hy * gl.size[1], 0).applyMatrix4(gl.world)
        tightBox.expandByPoint(_vCorner)
      }
    }
    const size = tightBox.getSize(new THREE.Vector3())
    // l1: [-50, 50] in x, l2: [0, 100] in x => total width = 150
    expect(size.x).toBeCloseTo(150, 1)
    expect(size.y).toBeCloseTo(150, 1)
  })
})
