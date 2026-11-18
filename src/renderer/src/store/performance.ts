import { create } from 'zustand'
import type { SystemHardwareInfo } from '@shared/ipc'
import { getLiveRenderer } from '../engine/liveRenderer'

export type UiEffectsMode = 'auto' | 'ultra' | 'balanced' | 'lite'
export type UiEffectsTier = 'ultra' | 'balanced' | 'lite'

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
  uiEffectsTier: UiEffectsTier
  summary: string
  reason: string
}

export interface PerformanceState {
  hardware: SystemHardwareInfo | null
  webgl: WebGLSpecs | null
  mode: 'auto' | 'manual'
  uiEffectsMode: UiEffectsMode
  resolvedUiEffectsTier: UiEffectsTier
  budgetMB: number
  maxAnisotropy: number
  maxTextureSize: number
  optimal: OptimalPlan
  isLoaded: boolean

  init(): Promise<void>
  setMode(mode: 'auto' | 'manual'): void
  setUiEffectsMode(mode: UiEffectsMode): void
  setBudget(mb: number): void
  setAnisotropy(val: number): void
  setMaxTextureSize(val: number): void
  apply(): void
  resetToAuto(): void
}

const STORAGE_KEY = 'pxs.performanceSettings.v1'

export function resolveUiEffectsTier(
  uiEffectsMode: UiEffectsMode,
  budgetMB: number,
  prefersReducedMotion = false
): UiEffectsTier {
  if (uiEffectsMode !== 'auto') return uiEffectsMode
  if (prefersReducedMotion || budgetMB < 1024) return 'lite'
  if (budgetMB >= 2048) return 'ultra'
  return 'balanced'
}

function detectPrefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  } catch {
    return false
  }
}

export function applyUiEffectsDataset(tier: UiEffectsTier): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.uiFx = tier
  }
}

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
    budgetMB = 3072
    maxAnisotropy = 16
    maxTextureSize = 8192
    summary = 'Cực kỳ mạnh mẽ (Ultra Smooth)'
    reason = `Phát hiện ${gpuName} (${vramGB > 0 ? vramGB + 'GB VRAM' : 'GPU rời'}) + RAM ${totalRamGB}GB (trống ${freeRamGB}GB). Tự động cấp 3072 MB VRAM, 16x Anisotropic và bật trọn bộ hiệu ứng giao diện Ultra Kính Mờ & Hào Quang.`
  } else if (vramGB >= 6 || (isDedicated && totalRamGB >= 16)) {
    budgetMB = 2048
    maxAnisotropy = 8
    maxTextureSize = 8192
    summary = 'Hiệu năng cao (High Performance)'
    reason = `Phát hiện ${gpuName} + RAM ${totalRamGB}GB. Tự động cấp 2048 MB VRAM và bật hiệu ứng giao diện Ultra xịn sò mượt mà.`
  } else if (isDedicated || vramGB >= 4) {
    budgetMB = 1536
    maxAnisotropy = 4
    maxTextureSize = 8192
    summary = 'Cân bằng tối ưu (Smooth Balanced)'
    reason = `Phát hiện GPU rời ${gpuName}. Cấp 1536 MB VRAM và chế độ hiệu ứng giao diện Cân bằng (giảm blur nặng để giữ 60fps).`
  } else if (totalRamGB >= 16) {
    budgetMB = 1024
    maxAnisotropy = 2
    maxTextureSize = 4096
    summary = 'Tiêu chuẩn iGPU (Standard)'
    reason = `Đồ họa tích hợp chia sẻ bộ nhớ từ RAM ${totalRamGB}GB. Cấp 1024 MB an toàn và tối ưu hiệu ứng giao diện mức Cân bằng.`
  } else {
    budgetMB = 768
    maxAnisotropy = 1
    maxTextureSize = 4096
    summary = 'Tiết kiệm tài nguyên (Power Saver)'
    reason = `Hệ thống RAM ${totalRamGB}GB. Cấp 768 MB và tự động chuyển hiệu ứng giao diện sang mức Siêu nhẹ (Lite) để tránh nặng máy.`
  }

  if (webgl?.maxTextureSize && maxTextureSize > webgl.maxTextureSize) {
    maxTextureSize = webgl.maxTextureSize
  }
  if (webgl?.maxAnisotropy && maxAnisotropy > webgl.maxAnisotropy) {
    maxAnisotropy = webgl.maxAnisotropy
  }

  const uiEffectsTier = resolveUiEffectsTier('auto', budgetMB, detectPrefersReducedMotion())
  return { budgetMB, maxAnisotropy, maxTextureSize, uiEffectsTier, summary, reason }
}

interface PersistedPerf {
  mode: 'auto' | 'manual'
  uiEffectsMode?: UiEffectsMode
  budgetMB?: number
  maxAnisotropy?: number
  maxTextureSize?: number
}

function loadPersisted(): PersistedPerf {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { mode: 'auto', uiEffectsMode: 'auto' }
}

function savePersisted(state: {
  mode: 'auto' | 'manual'
  uiEffectsMode: UiEffectsMode
  budgetMB: number
  maxAnisotropy: number
  maxTextureSize: number
}): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        uiEffectsMode: state.uiEffectsMode,
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
  const initialUiMode: UiEffectsMode = saved.uiEffectsMode || 'auto'
  const initialBudget = saved.budgetMB ?? initialOptimal.budgetMB
  const initialTier = resolveUiEffectsTier(initialUiMode, initialBudget, detectPrefersReducedMotion())
  applyUiEffectsDataset(initialTier)

  return {
    hardware: null,
    webgl: null,
    mode: saved.mode || 'auto',
    uiEffectsMode: initialUiMode,
    resolvedUiEffectsTier: initialTier,
    budgetMB: initialBudget,
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
      const nextBudget = curMode === 'auto' ? optimal.budgetMB : get().budgetMB
      const resolvedUiEffectsTier = resolveUiEffectsTier(
        get().uiEffectsMode,
        nextBudget,
        detectPrefersReducedMotion()
      )

      if (curMode === 'auto') {
        set({
          hardware: hw,
          webgl,
          optimal,
          budgetMB: optimal.budgetMB,
          maxAnisotropy: optimal.maxAnisotropy,
          maxTextureSize: optimal.maxTextureSize,
          resolvedUiEffectsTier,
          isLoaded: true
        })
      } else {
        set({
          hardware: hw,
          webgl,
          optimal,
          resolvedUiEffectsTier,
          isLoaded: true
        })
      }

      get().apply()
    },

    setMode(mode) {
      const opt = get().optimal
      const nextBudget = mode === 'auto' ? opt.budgetMB : get().budgetMB
      const resolvedUiEffectsTier = resolveUiEffectsTier(
        get().uiEffectsMode,
        nextBudget,
        detectPrefersReducedMotion()
      )
      if (mode === 'auto') {
        set({
          mode,
          budgetMB: opt.budgetMB,
          maxAnisotropy: opt.maxAnisotropy,
          maxTextureSize: opt.maxTextureSize,
          resolvedUiEffectsTier
        })
      } else {
        set({ mode, resolvedUiEffectsTier })
      }
      get().apply()
    },

    setUiEffectsMode(uiEffectsMode) {
      const resolvedUiEffectsTier = resolveUiEffectsTier(
        uiEffectsMode,
        get().budgetMB,
        detectPrefersReducedMotion()
      )
      set({ uiEffectsMode, resolvedUiEffectsTier })
      get().apply()
    },

    setBudget(budgetMB) {
      const resolvedUiEffectsTier = resolveUiEffectsTier(
        get().uiEffectsMode,
        budgetMB,
        detectPrefersReducedMotion()
      )
      set({ budgetMB, mode: 'manual', resolvedUiEffectsTier })
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
      const tier = resolveUiEffectsTier(s.uiEffectsMode, s.budgetMB, detectPrefersReducedMotion())
      if (tier !== s.resolvedUiEffectsTier) {
        set({ resolvedUiEffectsTier: tier })
      }
      applyUiEffectsDataset(tier)
      savePersisted({
        mode: s.mode,
        uiEffectsMode: s.uiEffectsMode,
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
      const resolvedUiEffectsTier = resolveUiEffectsTier('auto', opt.budgetMB, detectPrefersReducedMotion())
      set({
        mode: 'auto',
        uiEffectsMode: 'auto',
        resolvedUiEffectsTier,
        budgetMB: opt.budgetMB,
        maxAnisotropy: opt.maxAnisotropy,
        maxTextureSize: opt.maxTextureSize
      })
      get().apply()
    }
  }
})
