import { describe, expect, it } from 'vitest'
import { applyWorkshopAction, type WorkshopAction } from './workshopActions'
import type { LayerComposite, AssembledLayerItem } from './types'

function createSampleComposite(): LayerComposite {
  const layers: AssembledLayerItem[] = [
    {
      id: 'l1',
      name: 'Layer 1',
      x: -50,
      y: -20,
      z: 100,
      scale: 1,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      motion: { type: 'sway', speed: 1, amplitude: 10, anchor: 'bottom' }
    },
    {
      id: 'l2',
      name: 'Layer 2',
      x: 0,
      y: 0,
      z: 50,
      scale: 1,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      motion: { type: 'sway', speed: 1, amplitude: 10, anchor: 'bottom' }
    },
    {
      id: 'l3',
      name: 'Layer 3',
      x: 80,
      y: 40,
      z: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      motion: { type: 'sway', speed: 1, amplitude: 10, anchor: 'bottom' }
    }
  ]
  return {
    id: 'test-comp',
    name: 'Sample',
    category: 'nature',
    width: 600,
    height: 600,
    layers
  }
}

describe('workshopActions', () => {
  it('estimates a conservative frame without moving locked layers and ignores hidden layers', () => {
    const comp = createSampleComposite()
    comp.layers[0] = { ...comp.layers[0], x: 600, rotation: 45, locked: true }
    comp.layers[1] = { ...comp.layers[1], x: 10000, hidden: true }
    const fitted = applyWorkshopAction(comp, 'estimate-frame', ['l1', 'l2'])
    expect(fitted.width).toBe(1800)
    expect(fitted.height).toBe(650)
    expect(fitted.layers).toBe(comp.layers)
    expect(applyWorkshopAction(comp, 'estimate-frame', [])).toBe(comp)
  })
  it('centers layers on X and Y axes', () => {
    const comp = createSampleComposite()
    const cx = applyWorkshopAction(comp, 'center-x', ['l1', 'l3'])
    expect(cx.layers.find((l) => l.id === 'l1')?.x).toBe(0)
    expect(cx.layers.find((l) => l.id === 'l3')?.x).toBe(0)
    expect(cx.layers.find((l) => l.id === 'l2')?.x).toBe(0)

    const cy = applyWorkshopAction(comp, 'center-y', ['l1'])
    expect(cy.layers.find((l) => l.id === 'l1')?.y).toBe(0)
    expect(cy.layers.find((l) => l.id === 'l3')?.y).toBe(40)
  })

  it('distributes layers evenly along X and Y axes', () => {
    const comp = createSampleComposite()
    const dist = applyWorkshopAction(comp, 'distribute-x', ['l1', 'l2', 'l3'])
    const l1 = dist.layers.find((l) => l.id === 'l1')!
    const l2 = dist.layers.find((l) => l.id === 'l2')!
    const l3 = dist.layers.find((l) => l.id === 'l3')!
    expect(l1.x).toBe(-50)
    expect(l2.x).toBe(15) // midpoint between -50 and 80
    expect(l3.x).toBe(80)
  })

  it('distributes depth (Z) with custom spacing and flattens', () => {
    const comp = createSampleComposite()
    const forward = applyWorkshopAction(comp, 'depth-forward', ['l1', 'l2', 'l3'], 100)
    expect(forward.layers[0].z).toBe(100)
    expect(forward.layers[1].z).toBe(0)
    expect(forward.layers[2].z).toBe(-100)

    const reversed = applyWorkshopAction(comp, 'depth-reverse', ['l1', 'l2', 'l3'], 100)
    expect(reversed.layers[0].z).toBe(-100)
    expect(reversed.layers[1].z).toBe(0)
    expect(reversed.layers[2].z).toBe(100)

    const flat = applyWorkshopAction(forward, 'flatten', ['l1', 'l2', 'l3'])
    expect(flat.layers.every((l) => l.z === 0)).toBe(true)
  })

  it('duplicates and deletes selected layers', () => {
    const comp = createSampleComposite()
    const dup = applyWorkshopAction(comp, 'duplicate', ['l1'])
    expect(dup.layers.length).toBe(4)
    const copy = dup.layers.find((l) => l.name.includes('(Bản sao)'))
    expect(copy).toBeDefined()
    expect(copy?.x).toBe(-35)

    const del = applyWorkshopAction(comp, 'delete', ['l1', 'l2'])
    expect(del.layers.length).toBe(1)
    expect(del.layers[0].id).toBe('l3')
  })

  it('locks, unlocks, hides and shows layers', () => {
    const comp = createSampleComposite()
    const locked = applyWorkshopAction(comp, 'lock', ['l1'])
    expect(locked.layers.find((l) => l.id === 'l1')?.locked).toBe(true)

    // Locked layer should NOT be deleted or moved
    const cantDelete = applyWorkshopAction(locked, 'delete', ['l1'])
    expect(cantDelete.layers.some((l) => l.id === 'l1')).toBe(true)

    const unlocked = applyWorkshopAction(locked, 'unlock', ['l1'])
    expect(unlocked.layers.find((l) => l.id === 'l1')?.locked).toBe(false)

    const hidden = applyWorkshopAction(comp, 'hide', ['l2'])
    expect(hidden.layers.find((l) => l.id === 'l2')?.hidden).toBe(true)

    const shown = applyWorkshopAction(hidden, 'show', ['l2'])
    expect(shown.layers.find((l) => l.id === 'l2')?.hidden).toBe(false)
  })

  it('staggers and stops motion', () => {
    const comp = createSampleComposite()
    const staggered = applyWorkshopAction(comp, 'stagger', ['l1', 'l2', 'l3'])
    expect(staggered.layers[0].motion.phaseOffset).toBe(0)
    expect(staggered.layers[1].motion.phaseOffset).toBe(0.35)
    expect(staggered.layers[2].motion.phaseOffset).toBe(0.7)

    const stopped = applyWorkshopAction(staggered, 'stop-motion', ['l1', 'l2'])
    expect(stopped.layers[0].motion.type).toBe('none')
    expect(stopped.layers[1].motion.type).toBe('none')
    expect(stopped.layers[2].motion.type).toBe('sway')
  })

  it('validates unknown actions and spacing boundaries', () => {
    const comp = createSampleComposite()
    expect(() => applyWorkshopAction(comp, 'unknown' as WorkshopAction, ['l1'])).toThrow()
    expect(() => applyWorkshopAction(comp, 'depth-forward', ['l1', 'l2'], 0)).toThrow()
    expect(() => applyWorkshopAction(comp, 'depth-forward', ['l1', 'l2'], 3000)).toThrow()
    expect(() => applyWorkshopAction(comp, 'center-x', ['invalid-id'])).toThrow()
  })
})
