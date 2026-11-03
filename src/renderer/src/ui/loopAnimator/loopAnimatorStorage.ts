import { useAssetManifestStore } from '../../store/assetManifest'
import { invalidateCachedLoopTemplateSheet } from './loopFrameExtractor'
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

if (typeof window !== 'undefined') {
  window.addEventListener('parallax:asset-restored', ((e: Event) => {
    const detail = (e as CustomEvent<{ relPath?: string }>).detail
    const rel = detail?.relPath || ''
    if (!rel) return
    const hidden = getHiddenBuiltinLoopIds()
    let changed = false
    for (const p of SAMPLE_LOOP_PRESETS) {
      const pRel = p.imageUrl.replace(/^assets\//, '')
      if (rel === pRel || rel.endsWith(`/${p.id}.png`) || rel === `loop_animations/${p.id}`) {
        if (hidden.delete(p.id)) changed = true
      }
    }
    if (changed) saveHiddenBuiltinLoopIds(hidden)
    notifyUpdated()
  }) as EventListener)
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
  const loopModule = useAssetManifestStore.getState().modules?.loop_animator
  const manifestAssets = loopModule?.assets || {}

  return SAMPLE_LOOP_PRESETS.flatMap((p) => {
    const relKey = p.imageUrl.replace(/^assets\//, '')
    const meta = manifestAssets[p.id] || manifestAssets[relKey] || manifestAssets[p.imageUrl]
    if (meta && (meta.status === 'deleted' || meta.status === 'hidden')) {
      return []
    }
    const cols = typeof meta?.cols === 'number' && meta.cols > 0 ? meta.cols : p.defaultGrid.cols
    const rows = typeof meta?.rows === 'number' && meta.rows > 0 ? meta.rows : p.defaultGrid.rows
    const fps = typeof meta?.fps === 'number' && meta.fps > 0 ? meta.fps : p.defaultFps

    return [
      {
        id: p.id,
        name: meta?.name?.trim() || p.name,
        category: meta?.category?.trim() || p.category,
        badge: p.badge,
        description: meta?.description?.trim() || p.description,
        imageUrl: p.imageUrl,
        slicerMode: 'grid' as const,
        gridConfig: { ...p.defaultGrid, cols, rows },
        chromaKey: { ...p.defaultChroma },
        fps,
        speed: p.defaultSpeed ?? 1,
        loopMode: p.defaultLoopMode ?? 'loop',
        rhythm: {
          rhythmMode: p.defaultRhythm?.rhythmMode ?? 'none',
          rhythmRateHz: p.defaultRhythm?.rhythmRateHz ?? 2.2,
          rhythmIntensity: p.defaultRhythm?.rhythmIntensity ?? 0.35,
          minOpacity: p.defaultRhythm?.minOpacity ?? 0.5,
          scaleBeatPct: p.defaultRhythm?.scaleBeatPct ?? 12
        },
        frameCount: cols * rows,
        isBuiltin: true
      }
    ]
  })
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

/** Toàn bộ mẫu hiển thị trong kho: mẫu tự lưu + mẫu tích hợp sẵn (trừ mẫu đã bị ẩn hoặc xoá tạm trong manifest) */
export function getAllLoopTemplates(): LoopAnimationTemplate[] {
  const hidden = getHiddenBuiltinLoopIds()
  const builtins = getBuiltinLoopTemplates().filter((b) => !hidden.has(b.id))
  const stored = getStoredLoopTemplates()
  const storedMap = new Map(stored.map((item) => [item.id, item]))
  const mergedBuiltins = builtins.map((b) =>
    storedMap.has(b.id) ? { ...b, ...storedMap.get(b.id)!, isBuiltin: true } : b
  )
  // 3. Khám phá các gói hoạt ảnh lặp từ manifest loop_animator
  const loopModule = useAssetManifestStore.getState().modules?.loop_animator
  const manifestAssets = loopModule?.assets || {}
  const deletedSlugs = new Set<string>()
  const fromManifest: LoopAnimationTemplate[] = []
  for (const [key, meta] of Object.entries(manifestAssets)) {
    if (key.startsWith('loop_animations/') && meta && typeof meta === 'object') {
      const slug = key.split('/')[1]
      const m = meta as Record<string, any>
      if (m.status === 'deleted' || m.status === 'hidden') {
        if (slug) deletedSlugs.add(slug)
        continue
      }
      if (slug && !storedMap.has(slug)) {
        const fCount = typeof m.frameCount === 'number' && m.frameCount > 0 ? m.frameCount : 16
        const gridRows = fCount >= 3 ? 3 : 1
        const gridCols = fCount >= 3 ? Math.ceil(fCount / 3) : Math.max(1, fCount)
        fromManifest.push({
          id: slug,
          name: typeof m.name === 'string' ? m.name : slug,
          category: (m.category as any) || 'custom',
          badge: `🎞 ${fCount}F`,
          description: typeof m.description === 'string' && m.description ? m.description : `Gói hoạt ảnh lặp ${slug}`,
          imageUrl: `assets/${key.replace('animation.json', 'thumbnail.png')}`,
          loopJsonPath: key.endsWith('.json') ? key : `loop_animations/${slug}/animation.json`,
          packageFolder: `loop_animations/${slug}`,
          slicerMode: 'grid',
          gridConfig: { cols: gridCols, rows: gridRows, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0, borderPadding: 0 },
          chromaKey: { enabled: false, keyColor: '#000000', similarity: 0.28, smoothness: 0.1, spill: 0.35 },
          fps: typeof m.fps === 'number' ? m.fps : 14,
          speed: 1,
          loopMode: (m.loopMode as any) || 'loop',
          frameCount: fCount,
          isBuiltin: false
        })
      }
    }
  }

  const customOnly = stored
    .filter((s) => !isBuiltinLoopTemplateId(s.id) && !deletedSlugs.has(s.id))
    .map((s) => {
      const pkgMatch = (s.loopJsonPath || s.packageFolder || s.imageUrl || '').replace(/\\/g, '/').match(/loop_animations\/([^/]+)/)
      if (pkgMatch && pkgMatch[1]) {
        const slug = pkgMatch[1]
        return {
          ...s,
          loopJsonPath: s.loopJsonPath || `loop_animations/${slug}/animation.json`,
          packageFolder: s.packageFolder || `loop_animations/${slug}`,
          chromaKey: { ...s.chromaKey, enabled: false }
        }
      }
      return s
    })
  return [...customOnly, ...fromManifest, ...mergedBuiltins]
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
    const hidden = getHiddenBuiltinLoopIds()
    if (hidden.delete(nextItem.id)) saveHiddenBuiltinLoopIds(hidden)
  }
  notifyUpdated()
  return nextItem
}

/**
 * Xoá mẫu hoạt ảnh lặp khỏi kho. Mọi mẫu bị xoá đều được chuyển vào thư mục Xoá tạm (`assets/_temp_deleted/`)
 * và đánh dấu `status: "deleted"` trong manifest để có thể khôi phục lại bất kỳ lúc nào.
 */
export function deleteLoopTemplate(id: string): boolean {
  const all = getAllLoopTemplates()
  const targetTpl = all.find((t) => t.id === id)
  const stored = getStoredLoopTemplates()
  const next = stored.filter((item) => item.id !== id)
  const removedStored = next.length !== stored.length
  const isBuiltin = isBuiltinLoopTemplateId(id)
  if (!removedStored && !isBuiltin && !targetTpl) return false

  try {
    if (removedStored) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.error('[loopAnimatorStorage] Failed to delete loop template:', err)
  }

  invalidateCachedLoopTemplateSheet(id)

  const pkgSource = (targetTpl?.loopJsonPath || targetTpl?.packageFolder || targetTpl?.imageUrl || '').replace(/\\/g, '/')
  const pkgMatch = pkgSource.match(/loop_animations\/([^/]+)/)

  if (pkgMatch && pkgMatch[1]) {
    const slug = pkgMatch[1]
    void useAssetManifestStore.getState().softDeleteAsset(`loop_animations/${slug}`, false, {
      name: targetTpl?.name || slug,
      category: targetTpl?.category || 'custom',
      folder: 'loop_animations',
      previewDataUrl: targetTpl?.thumbUrl
    })
  } else if (isBuiltin) {
    const hidden = getHiddenBuiltinLoopIds()
    hidden.add(id)
    saveHiddenBuiltinLoopIds(hidden)
    const preset = SAMPLE_LOOP_PRESETS.find((p) => p.id === id)
    if (preset && preset.imageUrl.startsWith('assets/')) {
      const rel = preset.imageUrl.replace(/^assets\//, '')
      void useAssetManifestStore.getState().softDeleteAsset(rel, false, {
        name: preset.name,
        category: preset.category,
        folder: 'demo_transparent'
      })
    } else if (preset) {
      // Mẫu procedural (data:image/...) → ghi ảnh đại diện vào _temp_deleted để khôi phục được
      const previewUrl = targetTpl?.thumbUrl || (preset.imageUrl.startsWith('data:image/') ? preset.imageUrl : undefined)
      void useAssetManifestStore.getState().softDeleteAsset(`loop_animations/${id}.png`, false, {
        name: preset.name,
        category: preset.category,
        folder: 'loop_animations',
        previewDataUrl: previewUrl,
        fileName: `${id}.png`
      })
    }
  } else if (targetTpl) {
    const previewUrl = targetTpl.thumbUrl || (targetTpl.imageUrl.startsWith('data:image/') ? targetTpl.imageUrl : undefined)
    void useAssetManifestStore.getState().softDeleteAsset(`loop_animations/${id}.png`, false, {
      name: targetTpl.name,
      category: targetTpl.category,
      folder: 'loop_animations',
      previewDataUrl: previewUrl,
      fileName: `${id}.png`
    })
  }

  notifyUpdated()
  return true
}
