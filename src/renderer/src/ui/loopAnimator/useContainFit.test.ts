import { describe, expect, it } from 'vitest'
import { computeContainFit } from './useContainFit'

describe('computeContainFit (hiển thị ảnh nguồn không bóp méo)', () => {
  it('keeps the source aspect ratio inside a wide or tall box', () => {
    expect(computeContainFit(1024, 1024, 600, 392)).toEqual({ width: 392, height: 392 })
    expect(computeContainFit(2000, 1000, 600, 600)).toEqual({ width: 600, height: 300 })
    expect(computeContainFit(500, 1000, 800, 400)).toEqual({ width: 200, height: 400 })
  })

  it('returns zero size when the box is not measured yet', () => {
    expect(computeContainFit(1024, 1024, 0, 300)).toEqual({ width: 0, height: 0 })
  })
})
