import { describe, it, expect } from 'vitest'
import {
  computeLayer3DMotion,
  createRectOutline,
  createAnchorDot,
  createLayer3DInstance,
  updateLayer3DInstance,
  createCameraFrustumHelper,
  createCameraClippingPlanes
} from './layerAssembly3DMesh'
import type { AssembledLayerItem } from './types'

describe('layerAssembly3DMesh', () => {
  it('computes 3D motion for sway correctly', () => {
    const motion = {
      type: 'sway' as const,
      speed: 1.0,
      amplitude: 10,
      anchor: 'bottom' as const
    }
    const result0 = computeLayer3DMotion(motion, 0)
    expect(result0.animRotateRad).toBeCloseTo(0)

    const resultQuarter = computeLayer3DMotion(motion, 0.25)
    // sin(0.25 * 2pi) = sin(pi/2) = 1 -> 10 deg in radians
    const expectedRad = (10 * Math.PI) / 180
    expect(resultQuarter.animRotateRad).toBeCloseTo(expectedRad)
  })

  it('computes 3D motion for breathe correctly', () => {
    const motion = {
      type: 'breathe' as const,
      speed: 1.0,
      amplitude: 20,
      anchor: 'center' as const
    }
    const resultQuarter = computeLayer3DMotion(motion, 0.25)
    // 1 + 20/100 = 1.2
    expect(resultQuarter.animScaleX).toBeCloseTo(1.2)
    expect(resultQuarter.animScaleY).toBeCloseTo(1.2)
  })

  it('creates rect outline and anchor dot', () => {
    const outline = createRectOutline(200, 200)
    expect(outline).toBeDefined()
    expect(outline.type).toBe('LineSegments')

    const dot = createAnchorDot()
    expect(dot).toBeDefined()
    expect(dot.type).toBe('Mesh')
  })

  it('creates and updates layer 3D instance with depth exaggeration', () => {
    const layer: AssembledLayerItem = {
      id: 'test-layer-1',
      name: 'Test Layer',
      x: 50,
      y: 100,
      z: 30,
      scale: 1.2,
      rotation: 45,
      opacity: 0.8,
      motion: {
        type: 'none',
        speed: 1,
        amplitude: 0,
        anchor: 'bottom'
      }
    }

    const inst = createLayer3DInstance(layer, null, () => {})
    expect(inst.group).toBeDefined()
    expect(inst.mesh.userData.layerId).toBe('test-layer-1')

    // Update with zExaggeration = 2 and default layerIndex = 0
    updateLayer3DInstance(inst, layer, 0, 2.0, true)

    expect(inst.group.position.x).toBe(50)
    expect(inst.group.position.y).toBe(-100) // Three.js Y is inverted
    expect(inst.group.position.z).toBe(-60) // -30 * 2.0 + 0 * 0.05
    expect(inst.outline.visible).toBe(true)
    expect(inst.anchorDot.visible).toBe(true)
    expect(inst.material.opacity).toBe(0.8)
    expect(inst.material.depthWrite).toBe(false) // opacity 0.8 < 0.95 -> false
  })

  it('correctly configures material depthWrite, alphaTest and coplanar micro-offset', () => {
    const potLayer: AssembledLayerItem = {
      id: 'bonsai-pot',
      name: 'Chậu Bonsai',
      x: 0,
      y: 155,
      z: -5,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
    }
    const trunkLayer: AssembledLayerItem = {
      id: 'bonsai-trunk',
      name: 'Thân Bonsai',
      x: 0,
      y: 10,
      z: 0,
      scale: 1.0,
      rotation: 0,
      opacity: 1.0,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
    }

    const potInst = createLayer3DInstance(potLayer, null, () => {})
    const trunkInst = createLayer3DInstance(trunkLayer, null, () => {})

    expect(potInst.material.depthWrite).toBe(true)
    expect(potInst.material.alphaTest).toBe(0.05)
    expect(trunkInst.material.depthWrite).toBe(true)

    // Update with exaggeration = 1.8 and their respective indices (pot = 0, trunk = 1)
    updateLayer3DInstance(potInst, potLayer, 0, 1.8, false, 0)
    updateLayer3DInstance(trunkInst, trunkLayer, 0, 1.8, false, 1)

    // Pot is at z = -5, trunk is at z = 0
    // In Three.js: pot posZ = -(-5) * 1.8 + 0 * 0.05 = 9.0
    // trunk posZ = -(0) * 1.8 + 1 * 0.05 = 0.05
    // Pot must be positioned closer to camera (+Z) than trunk!
    expect(potInst.group.position.z).toBeCloseTo(9.0)
    expect(trunkInst.group.position.z).toBeCloseTo(0.05)
    expect(potInst.group.position.z).toBeGreaterThan(trunkInst.group.position.z)
  })

  it('creates camera frustum helper with high contrast blue in light theme and gold in dark theme', () => {
    const lightFrustum = createCameraFrustumHelper(600, 600, 1000, true)
    const darkFrustum = createCameraFrustumHelper(600, 600, 1000, false)

    const lightMat = lightFrustum.material as any
    const darkMat = darkFrustum.material as any

    expect(lightMat.color.getHex()).toBe(0x2563eb) // Royal Blue for Light mode
    expect(darkMat.color.getHex()).toBe(0xffc24b) // Amber Gold for Dark mode
  })

  it('creates 4 clipping planes correctly bounding camera viewport and attaches to material', () => {
    const planes = createCameraClippingPlanes(600, 400)
    expect(planes).toHaveLength(4)
    expect(planes[0].constant).toBe(300) // halfW
    expect(planes[1].constant).toBe(300) // halfW
    expect(planes[2].constant).toBe(200) // halfH
    expect(planes[3].constant).toBe(200) // halfH

    const layer: AssembledLayerItem = {
      id: 'test-layer-clip',
      name: 'Layer Clip',
      x: 0,
      y: 0,
      z: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
    }
    const inst = createLayer3DInstance(layer, null, () => {})
    updateLayer3DInstance(inst, layer, 0, 1, false, 0, planes)

    expect(inst.material.clippingPlanes).toBe(planes)
  })
})
