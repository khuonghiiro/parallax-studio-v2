import { describe, expect, it } from 'vitest'
import type { LayerComposite } from './types'
import { splitBoneInHalf } from './workshopBoneSplit'

const mockComposite = (): LayerComposite => ({
  id: 'comp-test',
  name: 'Nhân vật test',
  category: 'character',
  width: 1000,
  height: 1000,
  layers: [
    {
      id: 'layer-leg-l',
      name: 'Chân Trái',
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      opacity: 1,
      locked: false,
      z: 0,
      motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' },
      boneId: 'bone-leg-l'
    }
  ],
  rig: {
    bones: [
      { id: 'bone-torso', name: 'Xương Thân', x: 0, y: 0, length: 100, angle: -90 },
      { id: 'bone-leg-l', name: 'Xương Chân Trái', parentId: 'bone-torso', x: -50, y: 50, length: 160, angle: 90 }
    ],
    tracks: {},
    duration: 2,
    loop: false
  }
})

describe('workshopBoneSplit', () => {
  it('chia đôi xương chân thành Đùi + Cẳng Chân với tỉ lệ 50/50', () => {
    const comp = mockComposite()
    const { composite, parentBone, childBone } = splitBoneInHalf(comp, 'bone-leg-l')

    // Xương cha được rút ngắn còn 80px và đổi tên thành Xương Đùi
    expect(parentBone.length).toBe(80)
    expect(parentBone.name).toContain('Đùi')

    // Xương con mới có chiều dài 80px, vị trí tại ngọn của Đùi (x = -50, y = 50 + 80 = 130)
    expect(childBone.length).toBe(80)
    expect(childBone.name).toContain('Cẳng Chân')
    expect(childBone.parentId).toBe('bone-leg-l')
    expect(childBone.x).toBe(-50)
    expect(childBone.y).toBe(130)

    // Khớp gối được gán giới hạn góc Moho
    expect(childBone.minAngle).toBe(0)
    expect(childBone.maxAngle).toBe(140)

    // Layer gắn với xương chân được cập nhật soft binding và có childBoneId trong extraBoneIds
    const legLayer = composite.layers.find((l) => l.id === 'layer-leg-l')!
    expect(legLayer.bindingMode).toBe('soft')
    expect(legLayer.extraBoneIds).toContain(childBone.id)
  })

  it('báo lỗi nếu xương quá ngắn (< 12px)', () => {
    const comp = mockComposite()
    comp.rig!.bones[1].length = 8
    expect(() => splitBoneInHalf(comp, 'bone-leg-l')).toThrow('Xương quá ngắn')
  })
})
