import { SAMPLE_LOOP_PRESETS } from './sampleLoops'
import type { LoopAnimationTemplate } from './types'

const STORAGE_KEY = 'parallax_loop_animations_v1'
/** Danh sách id mẫu tích hợp sẵn mà người dùng đã xoá (ẩn khỏi kho) */
const HIDDEN_BUILTIN_KEY = 'parallax_loop_animations_hidden_builtins_v1'
export const LOOP_STORAGE_UPDATED_EVENT = 'parallax:loop-animations-updated'

function notifyUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOOP_STORAGE_UPDATED_EVENT))
  }
}

export function isBuiltinLoopTemplateId(id: string): boolean {
  return SAMPLE_LOOP_PRESETS.some((p) => p.id === id)
}

export function getHiddenBuiltinLoopIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_BUILTIN_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

function saveHiddenBuiltinLoopIds(ids: Set<string>): void {
  try {
    localStorage.setItem(HIDDEN_BUILTIN_KEY, JSON.stringify([...ids]))
  } catch (err) {
    console.error('[loopAnimatorStorage] Failed to save hidden builtin ids:', err)
  }
}

export function getBuiltinLoopTemplates(): LoopAnimationTemplate[] {
  return SAMPLE_LOOP_PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    badge: p.badge,
    description: p.description,
    imageUrl: p.imageUrl,
    slicerMode: 'grid',
    gridConfig: { ...p.defaultGrid },
    chromaKey: { ...p.defaultChroma },
    fps: p.defaultFps,
    speed: p.defaultSpeed ?? 1,
    loopMode: p.defaultLoopMode ?? 'loop',
    rhythm: {
      rhythmMode: p.defaultRhythm?.rhythmMode ?? 'none',
      rhythmRateHz: p.defaultRhythm?.rhythmRateHz ?? 2.2,
      rhythmIntensity: p.defaultRhythm?.rhythmIntensity ?? 0.35,
      minOpacity: p.defaultRhythm?.minOpacity ?? 0.5,
      scaleBeatPct: p.defaultRhythm?.scaleBeatPct ?? 12
    },
    frameCount: p.defaultGrid.cols * p.defaultGrid.rows,
    isBuiltin: true
  }))
}

export function getStoredLoopTemplates(): LoopAnimationTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('[loopAnimatorStorage] Failed to read stored loop templates:', err)
    return []
  }
}

/** Toàn bộ mẫu hiển thị trong kho: mẫu tự lưu + mẫu tích hợp sẵn (trừ mẫu đã bị ẩn) */
export function getAllLoopTemplates(): LoopAnimationTemplate[] {
  const hidden = getHiddenBuiltinLoopIds()
  const builtins = getBuiltinLoopTemplates().filter((b) => !hidden.has(b.id))
  const stored = getStoredLoopTemplates()
  const storedMap = new Map(stored.map((item) => [item.id, item]))
  const mergedBuiltins = builtins.map((b) =>
    storedMap.has(b.id) ? { ...b, ...storedMap.get(b.id)!, isBuiltin: true } : b
  )
  const customOnly = stored.filter((s) => !isBuiltinLoopTemplateId(s.id))
  return [...customOnly, ...mergedBuiltins]
}

export function saveLoopTemplate(template: LoopAnimationTemplate): LoopAnimationTemplate {
  const stored = getStoredLoopTemplates()
  const now = Date.now()
  const nextItem: LoopAnimationTemplate = {
    ...template,
    updatedAt: now,
    createdAt: template.createdAt ?? now
  }
  const idx = stored.findIndex((item) => item.id === nextItem.id)
  if (idx >= 0) {
    stored[idx] = nextItem
  } else {
    stored.unshift(nextItem)
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch (err) {
    console.error('[loopAnimatorStorage] Failed to save loop template:', err)
  }
  if (isBuiltinLoopTemplateId(nextItem.id)) {
    // Lưu đè lên mẫu có sẵn đã bị ẩn trước đó → hiện lại trong kho
    const hidden = getHiddenBuiltinLoopIds()
    if (hidden.delete(nextItem.id)) saveHiddenBuiltinLoopIds(hidden)
  }
  notifyUpdated()
  return nextItem
}

/**
 * Xoá mẫu hoạt ảnh lặp khỏi kho. Mẫu tự lưu bị xoá hẳn; mẫu tích hợp sẵn
 * được đưa vào danh sách ẩn (đồng thời xoá bản ghi đè cấu hình nếu có).
 */
export function deleteLoopTemplate(id: string): boolean {
  const stored = getStoredLoopTemplates()
  const next = stored.filter((item) => item.id !== id)
  const removedStored = next.length !== stored.length
  const isBuiltin = isBuiltinLoopTemplateId(id)
  if (!removedStored && !isBuiltin) return false
  try {
    if (removedStored) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.error('[loopAnimatorStorage] Failed to delete loop template:', err)
  }
  if (isBuiltin) {
    const hidden = getHiddenBuiltinLoopIds()
    hidden.add(id)
    saveHiddenBuiltinLoopIds(hidden)
  }
  notifyUpdated()
  return true
}
