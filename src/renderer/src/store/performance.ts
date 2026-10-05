import { create } from 'zustand'
import type { SystemHardwareInfo } from '@shared/ipc'
import { getLiveRenderer } from '../engine/liveRenderer'

export interface WebGLSpecs {
  renderer: string
  vendor: string
  maxTextureSize: number
  maxAnisotropy: number
}

export interface OptimalPlan {
  budgetMB: number
  maxAnisotropy: number
  maxTextureSize: number
  summary: string
  reason: string
}

export interface PerformanceState {
  hardware: SystemHardwareInfo | null
  webgl: WebGLSpecs | null
  mode: 'auto' | 'manual'
  budgetMB: number
  maxAnisotropy: number
  maxTextureSize: number
  optimal: OptimalPlan
  isLoaded: boolean

  init(): Promise<void>
  setMode(mode: 'auto' | 'manual'): void
  setBudget(mb: number): void
  setAnisotropy(val: number): void
  setMaxTextureSize(val: number): void
  apply(): void
  resetToAuto(): void
}

const STORAGE_KEY = 'pxs.performanceSettings.v1'

export function computeOptimal(
  hw: SystemHardwareInfo | null,
  webgl: WebGLSpecs | null
): OptimalPlan {
  const totalRamGB = hw ? Math.round(hw.totalRamMB / 1024) : 16
  const freeRamGB = hw ? Math.round((hw.freeRamMB / 1024) * 10) / 10 : 8
  const gpuName = hw?.gpuName || webgl?.renderer || 'GPU hệ thống'
  const vramGB = hw?.gpuVramMB ? Math.round(hw.gpuVramMB / 1024) : 0
  const isDedicated =
    vramGB >= 4 ||
    /nvidia|geforce|rtx|gtx|radeon|rx|arc/i.test(gpuName) ||
    /nvidia|radeon|geforce/i.test(webgl?.renderer || '')

  let budgetMB = 1024
  let maxAnisotropy = 4
  let maxTextureSize = 8192
  let summary = 'Cấu hình tiêu chuẩn (Balanced)'
  let reason = ''

  if (vramGB >= 10 || (isDedicated && totalRamGB >= 32)) {
    // High-end enthusiast (e.g. RTX 3060 12GB + 32GB RAM)
    budgetMB = 3072
    maxAnisotropy = 16
    maxTextureSize = 8192
    summary = 'Cực kỳ mạnh mẽ (Ultra Smooth)'
    reason = `Phát hiện ${gpuName} (${vramGB > 0 ? vramGB + 'GB VRAM' : 'GPU rời'}) + RAM ${totalRamGB}GB (trống ${freeRamGB}GB). Tự động cấp 3072 MB VRAM và 16x Anisotropic filtering để nạp toàn bộ layer 4K/8K mà không giật khựng.`
  } else if (vramGB >= 6 || (isDedicated && totalRamGB >= 16)) {
    // Mid-range (e.g. RTX 2060, RTX 3050, 16GB RAM)
    budgetMB = 2048
    maxAnisotropy = 8
    maxTextureSize = 8192
    summary = 'Hiệu năng cao (High Performance)'
    reason = `Phát hiện ${gpuName} + RAM ${totalRamGB}GB. Tự động cấp 2048 MB VRAM để chuyển cảnh và tua timeline tức thì.`
  } else if (isDedicated || vramGB >= 4) {
    // Entry discrete (e.g. GTX 1650, 4GB VRAM)
    budgetMB = 1536
    maxAnisotropy = 4
    maxTextureSize = 8192
    summary = 'Cân bằng tối ưu (Smooth Balanced)'
    reason = `Phát hiện GPU rời ${gpuName}. Cấp 1536 MB VRAM cân bằng hoàn hảo giữa độ mượt và an toàn.`
  } else if (totalRamGB >= 16) {
    // Integrated GPU on 16GB+ RAM
    budgetMB = 1024
    maxAnisotropy = 2
    maxTextureSize = 4096
    summary = 'Tiêu chuẩn iGPU (Standard)'
    reason = `Đồ họa tích hợp chia sẻ bộ nhớ từ RAM ${totalRamGB}GB. Cấp 1024 MB an toàn, tránh hao tốn RAM chung.`
  } else {
    // Low specs
    budgetMB = 768
    maxAnisotropy = 1
    maxTextureSize = 4096
    summary = 'Tiết kiệm tài nguyên (Power Saver)'
    reason = `Hệ thống RAM ${totalRamGB}GB. Cấp 768 MB để đảm bảo ổn định tối đa cho máy tính.`
  }

  // Cap by WebGL limits if available
  if (webgl?.maxTextureSize && maxTextureSize > webgl.maxTextureSize) {
    maxTextureSize = webgl.maxTextureSize
  }
  if (webgl?.maxAnisotropy && maxAnisotropy > webgl.maxAnisotropy) {
    maxAnisotropy = webgl.maxAnisotropy
  }

  return { budgetMB, maxAnisotropy, maxTextureSize, summary, reason }
}

function loadPersisted(): { mode: 'auto' | 'manual'; budgetMB?: number; maxAnisotropy?: number; maxTextureSize?: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { mode: 'auto' }
}

function savePersisted(state: { mode: 'auto' | 'manual'; budgetMB: number; maxAnisotropy: number; maxTextureSize: number }): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        budgetMB: state.budgetMB,
        maxAnisotropy: state.maxAnisotropy,
        maxTextureSize: state.maxTextureSize
      })
    )
  } catch {
    // ignore
  }
}

export const usePerformance = create<PerformanceState>((set, get) => {
  const initialOptimal = computeOptimal(null, null)
  const saved = loadPersisted()

  return {
    hardware: null,
    webgl: null,
    mode: saved.mode || 'auto',
    budgetMB: saved.budgetMB ?? initialOptimal.budgetMB,
    maxAnisotropy: saved.maxAnisotropy ?? initialOptimal.maxAnisotropy,
    maxTextureSize: saved.maxTextureSize ?? initialOptimal.maxTextureSize,
    optimal: initialOptimal,
    isLoaded: false,

    async init() {
      let hw: SystemHardwareInfo | null = null
      if (window.api?.getSystemInfo) {
        try {
          hw = await window.api.getSystemInfo()
        } catch (e) {
          console.warn('[Performance] Failed to query system info', e)
        }
      }

      // Query live WebGL specs from renderer if active
      let webgl: WebGLSpecs | null = null
      const live = getLiveRenderer()
      if (live) {
        const caps = live.webglCapabilities
        webgl = {
          renderer: hw?.gpuName || 'WebGL Renderer',
          vendor: '',
          maxTextureSize: caps.maxTextureSize,
          maxAnisotropy: caps.maxAnisotropy
        }
      }

      const optimal = computeOptimal(hw, webgl)
      const curMode = get().mode

      if (curMode === 'auto') {
        set({
          hardware: hw,
          webgl,
          optimal,
          budgetMB: optimal.budgetMB,
          maxAnisotropy: optimal.maxAnisotropy,
          maxTextureSize: optimal.maxTextureSize,
          isLoaded: true
        })
      } else {
        set({
          hardware: hw,
          webgl,
          optimal,
          isLoaded: true
        })
      }

      get().apply()
    },

    setMode(mode) {
      if (mode === 'auto') {
        const opt = get().optimal
        set({
          mode,
          budgetMB: opt.budgetMB,
          maxAnisotropy: opt.maxAnisotropy,
          maxTextureSize: opt.maxTextureSize
        })
      } else {
        set({ mode })
      }
      get().apply()
    },

    setBudget(budgetMB) {
      set({ budgetMB, mode: 'manual' })
      get().apply()
    },

    setAnisotropy(maxAnisotropy) {
      set({ maxAnisotropy, mode: 'manual' })
      get().apply()
    },

    setMaxTextureSize(maxTextureSize) {
      set({ maxTextureSize, mode: 'manual' })
      get().apply()
    },

    apply() {
      const s = get()
      savePersisted({
        mode: s.mode,
        budgetMB: s.budgetMB,
        maxAnisotropy: s.maxAnisotropy,
        maxTextureSize: s.maxTextureSize
      })

      const live = getLiveRenderer()
      if (live) {
        live.budgetMB = s.budgetMB
        live.maxAnisotropy = s.maxAnisotropy
        live.maxTextureSize = s.maxTextureSize
        live.onInvalidate()
      }
    },

    resetToAuto() {
      const opt = get().optimal
      set({
        mode: 'auto',
        budgetMB: opt.budgetMB,
        maxAnisotropy: opt.maxAnisotropy,
        maxTextureSize: opt.maxTextureSize
      })
      get().apply()
    }
  }
})
