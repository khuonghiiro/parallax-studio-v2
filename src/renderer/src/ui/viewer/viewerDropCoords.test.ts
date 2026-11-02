import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { screenToScenePoint } from './viewerDropCoords'
import { createProject, createShot } from '../../project/factory'
import { EditorCamera } from '../../engine/EditorCamera'

describe('screenToScenePoint', () => {
  it('converts center screen coords to approximately [0, 0, 0] in camera view', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const shot = createShot('Shot 1')
    project.shots = [shot]

    const canvasEl = {
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 600 })
    } as unknown as HTMLCanvasElement

    const layout = {
      dpr: 1,
      cam: { x: 0, y: 0, w: 800, h: 600 },
      ed: null,
      stage2d: null
    }

    const cam = new THREE.PerspectiveCamera(35, 800 / 600, 1, 10000)
    cam.position.set(0, 0, 1850)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()

    const mockRenderer = {
      camera: cam,
      rayAt: (_ndcX: number, _ndcY: number, camera: THREE.Camera) => {
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(_ndcX, _ndcY), camera)
        return raycaster.ray
      }
    } as any

    const edCam = new EditorCamera()

    // Center click: clientX = 100 + 400 = 500, clientY = 50 + 300 = 350
    const point = screenToScenePoint({
      clientX: 500,
      clientY: 350,
      canvasEl,
      layout,
      renderer: mockRenderer,
      edCam,
      project,
      time: 0,
      targetShotId: shot.id
    })

    expect(Math.abs(point[0])).toBeLessThan(2)
    expect(Math.abs(point[1])).toBeLessThan(2)
    expect(point[2]).toBe(0)
  })

  it('returns shifted coordinate when dropping offset from center', () => {
    const project = createProject({ width: 1920, height: 1080, duration: 10 })
    const shot = createShot('Shot 1')
    project.shots = [shot]

    const canvasEl = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
    } as unknown as HTMLCanvasElement

    const layout = {
      dpr: 1,
      cam: { x: 0, y: 0, w: 800, h: 600 },
      ed: null,
      stage2d: null
    }

    const cam = new THREE.PerspectiveCamera(35, 800 / 600, 1, 10000)
    cam.position.set(0, 0, 1850)
    cam.lookAt(0, 0, 0)
    cam.updateMatrixWorld()

    const mockRenderer = {
      camera: cam,
      rayAt: (_ndcX: number, _ndcY: number, camera: THREE.Camera) => {
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(_ndcX, _ndcY), camera)
        return raycaster.ray
      }
    } as any

    const edCam = new EditorCamera()

    // Click to the right of center: clientX = 600 (x > 400), clientY = 300
    const point = screenToScenePoint({
      clientX: 600,
      clientY: 300,
      canvasEl,
      layout,
      renderer: mockRenderer,
      edCam,
      project,
      time: 0,
      targetShotId: shot.id
    })

    expect(point[0]).toBeGreaterThan(100)
    expect(Math.abs(point[1])).toBeLessThan(2)
  })
})
