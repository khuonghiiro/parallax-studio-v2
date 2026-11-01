import { describe, expect, it } from 'vitest'
import type { LayerBone } from '@shared/layerRig'
import { boneAncestorIds, buildBoneTreeRows } from './workshopBoneTree'

const b = (id: string, parentId?: string, name = id): LayerBone => ({ id, name, parentId, x: 0, y: 0, length: 10, angle: 0 })

// Thứ tự mảng cố ý xáo trộn (như khung xương sinh vật phản chiếu thêm bên phải ở cuối mảng).
const bones = [b('root'), b('leg-l', 'root', 'Chân Trái'), b('tail', 'root', 'Đuôi'), b('foot-l', 'leg-l', 'Bàn chân Trái'), b('leg-r', 'root', 'Chân Phải'), b('foot-r', 'leg-r', 'Bàn chân Phải')]

describe('Cây xương duyệt sâu (Moho Bone List)', () => {
  it('xếp con ngay dưới cha kèm độ sâu và số con', () => {
    const rows = buildBoneTreeRows(bones, new Set())
    expect(rows.map((r) => r.bone.id)).toEqual(['root', 'leg-l', 'foot-l', 'tail', 'leg-r', 'foot-r'])
    expect(rows.find((r) => r.bone.id === 'foot-r')!.depth).toBe(2)
    expect(rows[0].childCount).toBe(3)
  })

  it('thu gọn nhánh ẩn hậu duệ, lọc tên giữ chuỗi xương cha', () => {
    expect(buildBoneTreeRows(bones, new Set(['leg-l'])).map((r) => r.bone.id)).toEqual(['root', 'leg-l', 'tail', 'leg-r', 'foot-r'])
    expect(buildBoneTreeRows(bones, new Set(['root']), 'bàn chân phải').map((r) => r.bone.id)).toEqual(['root', 'leg-r', 'foot-r'])
    expect(boneAncestorIds(bones, 'foot-l')).toEqual(['leg-l', 'root'])
  })

  it('vẫn hiện xương lỗi chu trình để người dùng sửa', () => {
    const broken = [b('a', 'b'), b('b', 'a')]
    expect(buildBoneTreeRows(broken, new Set())).toHaveLength(2)
  })
})
