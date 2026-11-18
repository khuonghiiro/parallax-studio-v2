import { describe, expect, it } from 'vitest'
import { computeOptimal, resolveUiEffectsTier } from './performance'

describe('performance — Hardware-Adaptive UI Effects Tier', () => {
  it('tự động bật Ultra khi máy có GPU rời mạnh (>= 2048 MB VRAM budget)', () => {
    const plan = computeOptimal(
      {
        cpuModel: 'AMD Ryzen 7',
        platform: 'win32',
        totalRamMB: 32768,
        freeRamMB: 18000,
        gpuName: 'NVIDIA GeForce RTX 3060',
        gpuVramMB: 12288
      },
      null
    )
    expect(plan.budgetMB).toBe(3072)
    expect(plan.uiEffectsTier).toBe('ultra')
    expect(resolveUiEffectsTier('auto', 2048, false)).toBe('ultra')
  })

  it('tự động chọn Balanced cho máy tầm trung / iGPU 16GB và Lite cho máy yếu (< 1024 MB hoặc reduced motion)', () => {
    expect(resolveUiEffectsTier('auto', 1536, false)).toBe('balanced')
    expect(resolveUiEffectsTier('auto', 1024, false)).toBe('balanced')
    expect(resolveUiEffectsTier('auto', 768, false)).toBe('lite')
    expect(resolveUiEffectsTier('auto', 3072, true)).toBe('lite')
  })

  it('cho phép người dùng ép cứng mức Ultra / Balanced / Lite độc lập với auto', () => {
    expect(resolveUiEffectsTier('ultra', 768, false)).toBe('ultra')
    expect(resolveUiEffectsTier('lite', 4096, false)).toBe('lite')
    expect(resolveUiEffectsTier('balanced', 3072, false)).toBe('balanced')
  })
})
