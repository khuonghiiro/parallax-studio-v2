import { useSyncExternalStore } from 'react'

/**
 * Liên kết phát trong Xưởng Layer:
 * - `loopRigAction`: ở tab Loop, bật = khung xương VÀ các layer gắn xương cùng diễn hành động của clip đang chọn
 *   (đồng bộ như tab Anim & Gió); tắt = chỉ chạy hoạt ảnh Loop, nhân vật đứng yên ở tư thế gốc.
 */
export interface WorkshopPlayLinkState {
  loopRigAction: boolean
}

const STORAGE_KEY = 'pxs.layerWorkshop.playLink'
const DEFAULTS: WorkshopPlayLinkState = { loopRigAction: true }

function load(): WorkshopPlayLinkState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<WorkshopPlayLinkState>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

let state: WorkshopPlayLinkState = load()
const listeners = new Set<() => void>()

export function setWorkshopPlayLink(patch: Partial<WorkshopPlayLinkState>): void {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* localStorage không khả dụng: giữ trạng thái trong bộ nhớ */
  }
  listeners.forEach((l) => l())
}

export function getWorkshopPlayLink(): WorkshopPlayLinkState {
  return state
}

export function useWorkshopPlayLink(): WorkshopPlayLinkState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => state
  )
}
