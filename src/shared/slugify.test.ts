import { describe, expect, it } from 'vitest'
import { removeVietnameseTones, toUnaccentedSnakeCase } from './slugify'

describe('slugify utils', () => {
  it('removes Vietnamese accents correctly', () => {
    expect(removeVietnameseTones('Ánh Lửa Cháy')).toBe('Anh Lua Chay')
    expect(removeVietnameseTones('Đoàn kết và đổi mới')).toBe('Doan ket va doi moi')
    expect(removeVietnameseTones('Cầu năng lượng ma thuật')).toBe('Cau nang luong ma thuat')
  })

  it('generates clean snake_case folder name without accents', () => {
    expect(toUnaccentedSnakeCase('Ánh Lửa Cháy')).toBe('anh_lua_chay')
    expect(toUnaccentedSnakeCase('Ngọn Đuốc Thần 16F!')).toBe('ngon_duoc_than_16f')
    expect(toUnaccentedSnakeCase('  -- Bướm Vỗ Cánh Vàng __ ')).toBe('buom_vo_canh_vang')
  })

  it('falls back when string is empty or symbols only', () => {
    const res = toUnaccentedSnakeCase('   ', 'fallback')
    expect(res.startsWith('fallback_')).toBe(true)

    const res2 = toUnaccentedSnakeCase('!@#$%', 'test')
    expect(res2.startsWith('test_')).toBe(true)
  })
})
