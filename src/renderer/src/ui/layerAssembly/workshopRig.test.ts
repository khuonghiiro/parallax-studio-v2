import { describe, expect, it } from 'vitest'
import { applyRigAction, emptyRig, validateRig } from './workshopRig'
import type { LayerComposite } from './types'
import { evaluateRig, transformRigLayer } from '../../engine/layerRig'
import { bakeWorkshopRig } from './bakeWorkshopRig'
import { createImageLayer } from '../../project/factory'

describe('workshopRig & layerRig engine', () => {
  const baseComposite: LayerComposite = {
    id: 'test-comp',
    name: 'Test Rig Composite',
    category: 'character',
    width: 600,
    height: 600,
    layers: [
      {
        id: 'l-head',
        name: 'Đầu',
        x: 0,
        y: -50,
        z: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'l-body',
        name: 'Thân',
        x: 0,
        y: 20,
        z: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      }
    ]
  }

  it('adds and updates bones and prevents cycles', () => {
    let comp = applyRigAction(baseComposite, {
      action: 'add-bone',
      bone: { id: 'bone-root', name: 'Root', x: 0, y: 0, length: 60, angle: -90 }
    })
    expect(comp.rig?.bones.length).toBe(1)

    comp = applyRigAction(comp, {
      action: 'add-bone',
      bone: { id: 'bone-head', name: 'Head', parentId: 'bone-root', x: 0, y: -60, length: 50, angle: -90 }
    })
    expect(comp.rig?.bones.length).toBe(2)

    // Cannot create cycle
    expect(() => {
      const invalid = structuredClone(comp)
      invalid.rig!.bones[0].parentId = 'bone-head'
      validateRig(invalid)
    }).toThrow(/cycle/)
  })

  it('binds a soft branch without moving the rest pose and can unbind it', () => {
    const original = applyRigAction(baseComposite, { action: 'apply-template', template: 'simple-chain' })
    const bound = applyRigAction(original, { action: 'bind', boneId: original.rig!.bones[0].id,
      layerIds: ['l-head'], mode: 'soft' })
    expect(bound.layers[0].bindingMode).toBe('soft')
    expect(bound.layers[0].x).toBe(original.layers[0].x)
    expect(bound.layers[0].y).toBe(original.layers[0].y)
    expect(original.layers[0].boneId).toBeUndefined()
    const unbound = applyRigAction(bound, { action: 'bind', layerIds: ['l-head'] })
    expect(unbound.layers[0].boneId).toBeUndefined()
    expect(unbound.layers[0].bindingMode).toBeUndefined()
  })

  it('applies humanoid preset template and generates walk cycle keys', () => {
    let comp = applyRigAction(baseComposite, {
      action: 'apply-template',
      template: 'humanoid'
    })
    expect(comp.rig?.bones.length).toBe(11)

    comp = applyRigAction(comp, {
      action: 'apply-preset-animation',
      preset: 'walk'
    })
    expect(comp.rig?.duration).toBe(1.6)
    expect(Object.keys(comp.rig?.tracks ?? {}).length).toBeGreaterThan(5)

    // Evaluate transforms at time 0.4s
    const transforms = evaluateRig(comp.rig!, 0.4)
    expect(transforms.size).toBe(11)
    const pelvis = transforms.get('bone-pelvis')
    expect(pelvis).toBeDefined()
    expect(Number.isFinite(pelvis!.x)).toBe(true)
    expect(Number.isFinite(pelvis!.rotation)).toBe(true)
  })

  it('binds layers and transforms layer position and rotation based on bone pose', () => {
    let comp = applyRigAction(baseComposite, {
      action: 'add-bone',
      bone: { id: 'b-pivot', name: 'Pivot', x: 0, y: 0, length: 50, angle: 0 }
    })
    comp = applyRigAction(comp, {
      action: 'bind',
      boneId: 'b-pivot',
      layerIds: ['l-head']
    })
    expect(comp.layers[0].boneId).toBe('b-pivot')

    comp = applyRigAction(comp, {
      action: 'set-key',
      boneId: 'b-pivot',
      key: { time: 0, x: 0, y: 0, rotation: 90, easing: 'smooth' }
    })

    const transforms = evaluateRig(comp.rig!, 0)
    const posed = transformRigLayer(comp.layers[0], transforms)

    // Rotating (0, -50) 90 degrees clockwise around (0,0) yields (50, 0)
    expect(posed.x).toBeCloseTo(50, 1)
    expect(posed.y).toBeCloseTo(0, 1)
    expect(posed.rotation).toBeCloseTo(90, 1)
  })

  it('bakes workshop rig into native ImageLayer keyframes', () => {
    let comp = applyRigAction(baseComposite, {
      action: 'apply-template',
      template: 'humanoid'
    })
    comp = applyRigAction(comp, {
      action: 'bind',
      boneId: 'bone-pelvis',
      layerIds: ['l-body']
    })
    comp = applyRigAction(comp, {
      action: 'apply-preset-animation',
      preset: 'idle'
    })

    const compMeta = { name: 'Test Comp', background: '#000000', width: 1920, height: 1080, fps: 30, duration: 10 }
    const assetMeta = { id: 'asset-1', name: 'body.png', kind: 'image' as const, mime: 'image/png', width: 200, height: 200, path: 'assets/body.png', format: 'png' as const }
    const imageLayer = createImageLayer(assetMeta, compMeta, 0)
    bakeWorkshopRig(imageLayer, comp.layers[1], comp, 2.4, 30, 1.0, [0, 0, 0])

    expect(imageLayer.transform.position.keyframes.length).toBeGreaterThan(30)
    expect(imageLayer.transform.rotation.keyframes.length).toBeGreaterThan(30)
    expect(imageLayer.transform.position.value).toBeDefined()
  })
})
