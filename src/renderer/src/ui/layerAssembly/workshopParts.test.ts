import { describe, expect, it } from 'vitest'
import type { AssembledLayerItem, LayerComposite } from './types'
import {
  activateVariant,
  autoDetectParts,
  expandLinkedSelection,
  inferSlot,
  moveLinked,
  relatedCandidates,
  replacePartAsset,
  updatePartGroup
} from './workshopParts'

const layer = (id: string, name: string, extra: Partial<AssembledLayerItem> = {}): AssembledLayerItem => ({
  id, name, x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1,
  motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, ...extra
})

const hero = (): LayerComposite => ({
  id: 'c', name: 'Hero', category: 'character', width: 600, height: 900,
  assets: { head: 'hero/head.png', face_normal: 'hero/face-normal.png', face_happy: 'hero/face-happy.png' },
  layers: [
    layer('head', 'head', { x: 0, y: -300, asset: '@head', assetPath: 'hero/head.png' }),
    layer('fn', 'face-normal', { x: -8, y: -277, z: -30, hidden: true, asset: '@face_normal', assetPath: 'hero/face-normal.png' }),
    layer('fh', 'face-happy', { x: -8, y: -276, z: -32, asset: '@face_happy', assetPath: 'hero/face-happy.png' }),
    layer('gl', 'glasses', { x: -15, y: -272 }),
    layer('al', 'arm-left', { x: -100 }),
    layer('fl', 'forearm-left', { x: -110 }),
    layer('ar', 'arm-right', { x: 100 }),
    layer('t', 'torso')
  ]
})

describe('inferSlot', () => {
  it('detects expression variants but not body sides', () => {
    expect(inferSlot('face-happy')).toEqual({ slot: 'face', variant: 'happy' })
    expect(inferSlot('mouth_O')).toEqual({ slot: 'mouth', variant: 'o' })
    expect(inferSlot('mắt nhắm')).toEqual({ slot: 'mắt', variant: 'nhắm' })
    expect(inferSlot('arm-left')).toBeNull()
    expect(inferSlot('head')).toBeNull()
  })
})

describe('autoDetectParts', () => {
  it('groups head parts, splits limbs by side and assigns face slots', () => {
    const c = autoDetectParts(hero())
    const byId = Object.fromEntries(c.layers.map((l) => [l.id, l]))
    expect(byId.fh.partGroupId).toBe('part-head')
    expect(byId.gl.partGroupId).toBe('part-head')
    expect(byId.al.partGroupId).toBe('part-arm-left')
    expect(byId.fl.partGroupId).toBe('part-arm-left')
    expect(byId.ar.partGroupId).toBe('part-arm-right')
    expect(byId.fn.slot).toBe('face')
    expect(byId.fh.variant).toBe('happy')
    const head = c.partGroups!.find((g) => g.id === 'part-head')!
    expect(head).toMatchObject({ name: 'Đầu', locked: true, anchorLayerId: 'head' })
  })

  it('keeps user assignments', () => {
    const base = hero()
    base.layers[3] = { ...base.layers[3], partGroupId: 'part-x' }
    base.partGroups = [{ id: 'part-x', name: 'Kính', kind: 'accessory', locked: false }]
    const c = autoDetectParts(base)
    expect(c.layers.find((l) => l.id === 'gl')!.partGroupId).toBe('part-x')
    expect(c.partGroups!.some((g) => g.id === 'part-x')).toBe(true)
  })
})

describe('linked movement', () => {
  it('moves every member of a locked group and nothing when unlocked', () => {
    let c = autoDetectParts(hero())
    expect(new Set(expandLinkedSelection(c, ['gl']))).toEqual(new Set(['head', 'fn', 'fh', 'gl']))
    c = moveLinked(c, 'gl', -5, -262)
    expect(c.layers.find((l) => l.id === 'head')!.y).toBe(-290)
    expect(c.layers.find((l) => l.id === 'fh')!.x).toBe(2)
    c = updatePartGroup(c, 'part-head', { locked: false })
    expect(expandLinkedSelection(c, ['gl'])).toEqual(['gl'])
  })
})

describe('variants & replacement', () => {
  it('activates a variant at the same anchor and hides the others', () => {
    const c = activateVariant(autoDetectParts(hero()), 'fn')
    const fn = c.layers.find((l) => l.id === 'fn')!
    expect(fn.hidden).toBe(false)
    expect(fn).toMatchObject({ x: -8, y: -276, z: -32 })
    expect(c.layers.find((l) => l.id === 'fh')!.hidden).toBe(true)
  })

  it('replaces an image in place and registers an alias', () => {
    const { composite } = replacePartAsset(hero(), 'gl', { path: 'hero/glasses-round.png', name: 'glasses-round.png' })
    const gl = composite.layers.find((l) => l.id === 'gl')!
    expect(gl).toMatchObject({ x: -15, y: -272, asset: '@glasses_round', assetPath: 'hero/glasses-round.png', name: 'glasses-round' })
    expect(composite.assets!.glasses_round).toBe('hero/glasses-round.png')
  })

  it('adds a new variant to the slot, keeping the old one hidden', () => {
    const base = autoDetectParts(hero())
    const res = replacePartAsset(base, 'fh', { path: 'hero/face-cry.png', name: 'face-cry.png' }, 'variant')
    const added = res.composite.layers.find((l) => l.id === res.layerId)!
    expect(added).toMatchObject({ slot: 'face', variant: 'cry', x: -8, y: -276, hidden: false, partGroupId: 'part-head' })
    expect(res.composite.layers.filter((l) => l.slot === 'face' && !l.hidden)).toHaveLength(1)
  })

  it('ranks related assets from the same character folder, same slot prefix first', () => {
    const list = relatedCandidates('hero/face-happy.png', 'face', [
      { path: 'other/face-sad.png', name: 'face-sad' },
      { path: 'hero/arm-left.png', name: 'arm-left' },
      { path: 'hero/face-cry.png', name: 'face-cry' },
      { path: 'hero/face-happy.png', name: 'face-happy' }
    ])
    expect(list.map((c) => c.path)).toEqual(['hero/face-cry.png', 'hero/arm-left.png'])
  })
})
