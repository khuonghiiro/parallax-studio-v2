import { describe, expect, it } from 'vitest'
import { computeOptimal, usePerformance } from './performance'
import type { SystemHardwareInfo } from '@shared/ipc'

describe('Performance Engine - Auto Tuning', () => {
  it('recommends 3072 MB VRAM and 16x Anisotropy for enthusiast rigs (e.g. RTX 3060 12GB + 32GB RAM)', () => {
    const hw: SystemHardwareInfo = {
      totalRamMB: 32768,
      freeRamMB: 14000,
      cpuModel: 'Intel Core i5-13400F',
      gpuName: 'NVIDIA GeForce RTX 3060',
      gpuVramMB: 12288,
      platform: 'win32'
    }

    const optimal = computeOptimal(hw, null)
    expect(optimal.budgetMB).toBe(3072)
    expect(optimal.maxAnisotropy).toBe(16)
    expect(optimal.maxTextureSize).toBe(8192)
    expect(optimal.summary).toContain('Cực kỳ mạnh mẽ')
    expect(optimal.reason).toContain('RTX 3060')
  })

  it('recommends 2048 MB VRAM for mid-range GPU setups (e.g. 6GB VRAM + 16GB RAM)', () => {
    const hw: SystemHardwareInfo = {
      totalRamMB: 16384,
      freeRamMB: 6000,
      cpuModel: 'AMD Ryzen 5 3600',
      gpuName: 'NVIDIA GeForce RTX 2060',
      gpuVramMB: 6144,
      platform: 'win32'
    }

    const optimal = computeOptimal(hw, null)
    expect(optimal.budgetMB).toBe(2048)
    expect(optimal.maxAnisotropy).toBe(8)
  })

  it('recommends 1024 MB for integrated GPU setups with 16GB RAM', () => {
    const hw: SystemHardwareInfo = {
      totalRamMB: 16384,
      freeRamMB: 4000,
      cpuModel: 'Intel Core i5-1135G7',
      gpuName: 'Intel Iris Xe Graphics',
      platform: 'win32'
    }

    const optimal = computeOptimal(hw, null)
    expect(optimal.budgetMB).toBe(1024)
    expect(optimal.maxAnisotropy).toBe(2)
  })

  it('recommends 768 MB for low-RAM machines', () => {
    const hw: SystemHardwareInfo = {
      totalRamMB: 8192,
      freeRamMB: 1500,
      cpuModel: 'Intel Core i3',
      gpuName: 'Intel UHD Graphics',
      platform: 'win32'
    }

    const optimal = computeOptimal(hw, null)
    expect(optimal.budgetMB).toBe(768)
    expect(optimal.maxAnisotropy).toBe(1)
  })

  it('switches between auto and manual modes smoothly', () => {
    const state = usePerformance.getState()
    state.setMode('manual')
    expect(usePerformance.getState().mode).toBe('manual')

    state.setBudget(4096)
    expect(usePerformance.getState().budgetMB).toBe(4096)

    state.resetToAuto()
    expect(usePerformance.getState().mode).toBe('auto')
  })
})
