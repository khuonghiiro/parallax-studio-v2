import type { LoopAnimationTemplate } from './types'

const STORAGE_KEY = 'pxs:loop-animations:v1'

export function getStoredLoopTemplates(): LoopAnimationTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('[loopAnimatorStorage] Failed to read stored templates:', err)
    return []
  }
}

export function saveLoopTemplate(template: LoopAnimationTemplate): void {
  if (typeof window === 'undefined') return
  try {
    const list = getStoredLoopTemplates()
    const idx = list.findIndex((item) => item.id === template.id)
    if (idx >= 0) {
      list[idx] = { ...template, updatedAt: Date.now() }
    } else {
      list.unshift({ ...template, createdAt: Date.now(), updatedAt: Date.now() })
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    window.dispatchEvent(new CustomEvent('loopAnimations:changed'))
  } catch (err) {
    console.error('[loopAnimatorStorage] Failed to save template:', err)
  }
}

export function deleteLoopTemplate(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const list = getStoredLoopTemplates().filter((item) => item.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    window.dispatchEvent(new CustomEvent('loopAnimations:changed'))
  } catch (err) {
    console.error('[loopAnimatorStorage] Failed to delete template:', err)
  }
}
