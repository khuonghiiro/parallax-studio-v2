import { SAMPLE_LOOP_PRESETS } from './sampleLoops'
import type { LoopAnimationTemplate } from './types'

const STORAGE_KEY = 'parallax_loop_animations_v1'
export const LOOP_STORAGE_UPDATED_EVENT = 'parallax:loop-animations-updated'

function notifyUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOOP_STORAGE_UPDATED_EVENT))
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

export function getAllLoopTemplates(): LoopAnimationTemplate[] {
  const builtins = getBuiltinLoopTemplates()
  const stored = getStoredLoopTemplates()
  const storedMap = new Map(stored.map((item) => [item.id, item]))
  const mergedBuiltins = builtins.map((b) =>
    storedMap.has(b.id) ? { ...b, ...storedMap.get(b.id)!, isBuiltin: true } : b
  )
  const customOnly = stored.filter((s) => !builtins.some((b) => b.id === s.id))
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
  notifyUpdated()
  return nextItem
}

export function deleteLoopTemplate(id: string): boolean {
  const stored = getStoredLoopTemplates()
  const next = stored.filter((item) => item.id !== id)
  if (next.length === stored.length) return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.error('[loopAnimatorStorage] Failed to delete loop template:', err)
  }
  notifyUpdated()
  return true
}
