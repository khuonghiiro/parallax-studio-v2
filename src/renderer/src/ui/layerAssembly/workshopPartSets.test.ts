import { describe, expect, it } from 'vitest'
import type { AssembledLayerItem, LayerComposite } from './types'
import { activateVariant, autoDetectParts } from './workshopParts'
import {
  addAssetToGroup,
  addLayersToVariant,
  createVariantSet,
  dissolveSlot,
  renameSlot,
  renameVariant,
  slotNames,
  slotVariantGroups
} from './workshopPartSets'

const layer = (id: string, name: string, extra: Partial<AssembledLayerItem> = {}): AssembledLayerItem => ({
  id, name, x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1,
  motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }, ...extra
})

const comp = (layers: AssembledLayerItem[], extra: Partial<LayerComposite> = {}): LayerComposite => ({
  id: 'c', name: 'C', category: 'character', width: 400, height: 400, layers, ...extra
})

describe('bộ biến thể nhiều lớp', () => {
  it('tạo bộ từ layer chọn, tên do người dùng đặt; đổi tên bộ / biến thể; giải tán', () => {
    let c = comp([layer('a', 'mặt thường'), layer('b', 'mặt khóc')])
    const res = createVariantSet(c, ['a', 'b'], 'Biểu cảm')
    c = res.composite
    expect(res.slot).toBe('Biểu cảm')
    expect(c.layers.find((l) => l.id === 'b')!.hidden).toBe(true)
    c = renameSlot(c, 'Biểu cảm', 'Cảm xúc')
    expect(slotNames(c)).toEqual(['Cảm xúc'])
    expect(slotVariantGroups(c, 'Cảm xúc').map((g) => g.variant)).toEqual(['thường', 'khóc'])
    c = renameVariant(c, 'Cảm xúc', 'khóc', 'buồn')
    expect(slotVariantGroups(c, 'Cảm xúc').map((g) => g.variant)).toEqual(['thường', 'buồn'])
    c = dissolveSlot(c, 'Cảm xúc')
    expect(slotNames(c)).toEqual([])
  })

  it('biến thể gồm nhiều mảnh rời (mắt + miệng) đổi cùng nhau và căn neo theo vai trò', () => {
    let c = comp([
      layer('en', 'eyes-normal', { x: 10, y: 5 }), layer('mn', 'mouth-normal', { x: 0, y: 40 }),
      layer('ec', 'eyes-cry', { x: 99, y: 99 }), layer('mc', 'mouth-cry', { x: 77, y: 77 })
    ])
    c = createVariantSet(c, ['en', 'ec'], 'Biểu cảm').composite
    c = addLayersToVariant(c, ['mn'], 'Biểu cảm', 'normal')
    c = addLayersToVariant(c, ['mc'], 'Biểu cảm', 'cry')
    expect(c.layers.find((l) => l.id === 'mn')!.hidden).toBe(false)
    expect(c.layers.find((l) => l.id === 'mc')!.hidden).toBe(true)
    const groups = slotVariantGroups(c, 'Biểu cảm')
    expect(groups.map((g) => [g.variant, g.layers.length])).toEqual([['normal', 2], ['cry', 2]])
    c = activateVariant(c, 'ec')
    const get = (id: string) => c.layers.find((l) => l.id === id)!
    expect(get('ec').hidden).toBe(false)
    expect(get('mc').hidden).toBe(false)
    expect(get('en').hidden).toBe(true)
    expect(get('mn').hidden).toBe(true)
    expect([get('ec').x, get('ec').y]).toEqual([10, 5])
    expect([get('mc').x, get('mc').y]).toEqual([0, 40])
  })
})

describe('thả ảnh vào neo của nhóm', () => {
  it('tạo layer mới tại vị trí neo, gắn vào nhóm, không đụng layer khác', () => {
    const c = comp(
      [layer('h', 'head', { x: 5, y: -200, z: 10, partGroupId: 'g' }), layer('t', 'torso')],
      { partGroups: [{ id: 'g', name: 'Đầu', kind: 'head', locked: true, anchorLayerId: 'h' }] }
    )
    const res = addAssetToGroup(c, 'g', { path: 'hero/scar.png', name: 'scar.png' })
    const added = res.composite.layers.find((l) => l.id === res.layerId)!
    expect([added.x, added.y, added.partGroupId, added.hidden]).toEqual([5, -200, 'g', false])
    expect(added.z).toBe(9)
    expect(added.name).toBe('scar')
    expect(res.composite.layers.find((l) => l.id === 'h')).toEqual(c.layers[0])
  })
})

describe('tự nhận diện cho động vật và tên tự do', () => {
  it('nhận đuôi / cánh trái phải, gom theo tiền tố tên và gộp bộ biểu cảm rời', () => {
    const c = autoDetectParts(comp([
      layer('t1', 'tail_1'), layer('t2', 'tail_2'), layer('wl', 'wing-left'), layer('wr', 'wing-right'),
      layer('s1', 'scale-a1'), layer('s2', 'scale-b2'),
      layer('h', 'head'), layer('en', 'eyes-normal'), layer('ec', 'eyes-cry'), layer('mn', 'mouth-normal'), layer('mc', 'mouth-cry')
    ]))
    const names = (c.partGroups ?? []).map((g) => g.name).sort()
    expect(names).toEqual(['Cánh phải', 'Cánh trái', 'Scale', 'Đuôi', 'Đầu'].sort())
    expect(slotNames(c)).toEqual(['Biểu cảm Đầu'])
    expect(slotVariantGroups(c, 'Biểu cảm Đầu').map((g) => [g.variant, g.layers.length])).toEqual([['normal', 2], ['cry', 2]])
  })
})
