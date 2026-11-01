import type { LayerComposite } from './types'

export const ACTIVE_SESSION_STORAGE_KEY = 'pxs:layer-assembly:active-session'

export interface LayerAssemblyActiveSession {
  isOpen: boolean
  compositeId: string
  draftComposite: LayerComposite
  tab?: 'layers' | 'bones' | 'animation' | 'plant'
  primaryMode?: 'assembly' | 'cutter'
  selectedBoneId?: string | null
  time?: number
  timestamp: number
}

function isValidComposite(obj: unknown): obj is LayerComposite {
  if (!obj || typeof obj !== 'object') return false
  const c = obj as Partial<LayerComposite>
  return typeof c.id === 'string' && typeof c.name === 'string' && Array.isArray(c.layers)
}

/**
 * Tải phiên làm việc đang mở gần nhất từ localStorage để tự động khôi phục
 * khi Vite hot-reload, tải lại trang (F5) hoặc mở lại xưởng.
 */
export function loadActiveWorkshopSession(): LayerAssemblyActiveSession | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LayerAssemblyActiveSession
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.isOpen || !parsed.compositeId || !isValidComposite(parsed.draftComposite)) {
      return null
    }
    return parsed
  } catch (err) {
    console.warn('[LayerAssemblySession] Failed to load active session:', err)
    return null
  }
}

/**
 * Lưu phiên làm việc và bản nháp composite đang chỉnh sửa vào localStorage.
 */
export function saveActiveWorkshopSession(session: LayerAssemblyActiveSession): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (!isValidComposite(session.draftComposite)) return
    localStorage.setItem(
      ACTIVE_SESSION_STORAGE_KEY,
      JSON.stringify({
        ...session,
        timestamp: Date.now()
      })
    )
  } catch (err) {
    console.warn('[LayerAssemblySession] Failed to save active session:', err)
  }
}

/**
 * Cập nhật nhanh bản nháp composite và trạng thái giao diện của xưởng đang mở.
 */
export function updateActiveWorkshopDraft(
  composite: LayerComposite,
  extra?: Partial<Omit<LayerAssemblyActiveSession, 'compositeId' | 'draftComposite'>>
): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (!isValidComposite(composite)) return
    const prev = loadActiveWorkshopSession()
    const nextSession: LayerAssemblyActiveSession = {
      isOpen: true,
      compositeId: composite.id,
      draftComposite: composite,
      tab: extra?.tab ?? prev?.tab ?? 'layers',
      primaryMode: extra?.primaryMode ?? prev?.primaryMode ?? 'assembly',
      selectedBoneId: extra?.selectedBoneId !== undefined ? extra.selectedBoneId : (prev?.selectedBoneId ?? null),
      time: extra?.time !== undefined ? extra.time : (prev?.time ?? 0),
      timestamp: Date.now()
    }
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(nextSession))
  } catch (err) {
    console.warn('[LayerAssemblySession] Failed to update draft:', err)
  }
}

/**
 * Xóa sạch phiên làm việc khi người dùng chủ động đóng xưởng lắp ráp hoặc hoàn tất lưu.
 */
export function clearActiveWorkshopSession(): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
  } catch {
    // ignore
  }
}
