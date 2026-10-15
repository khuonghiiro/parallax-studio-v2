import { useSyncExternalStore } from 'react'

/**
 * Công cụ hỗ trợ hoạt họa (tab Animation) — giống các phần mềm hoạt hình chuyên nghiệp:
 * IK kéo ngọn xương, Onion skin (bóng mờ các khung trước/sau) và Quỹ đạo chuyển động của xương đang chọn.
 */
export interface AnimAssistState {
  /** Kéo ngọn xương thì cả chuỗi xương cha xoay theo (IK). */
  ik: boolean
  /** Số xương trong chuỗi IK (2 = cánh tay/cẳng tay, 3 = thêm vai…). */
  ikChain: number
  /** Bóng mờ khung xương ở các thời điểm trước/sau. */
  onion: boolean
  /** Số bóng mỗi phía. */
  onionCount: number
  /** Khoảng cách giữa các bóng (giây). */
  onionStep: number
  /** Đường quỹ đạo ngọn xương đang chọn trong cả clip. */
  path: boolean
}

const STORAGE_KEY = 'pxs.layerWorkshop.animAssist'
const DEFAULTS: AnimAssistState = { ik: true, ikChain: 2, onion: false, onionCount: 2, onionStep: 0.1, path: true }

function load(): AnimAssistState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AnimAssistState>) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

let state: AnimAssistState = load()
const listeners = new Set<() => void>()

export function getAnimAssist(): AnimAssistState {
  return state
}

export function setAnimAssist(patch: Partial<AnimAssistState>): void {
  state = { ...state, ...patch }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* bộ nhớ trình duyệt không khả dụng */ }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAnimAssist(): AnimAssistState {
  return useSyncExternalStore(subscribe, getAnimAssist, getAnimAssist)
}
