import type { Project } from '@shared/types'
import { useEditor } from '../../store/editor'
import { getStoredComposites, saveComposite } from '../layerAssembly/layerAssemblyStorage'
import type { LayerComposite } from '../layerAssembly/types'
import { deleteLoopTemplate } from './loopAnimatorStorage'

/** Layer trong cảnh (dự án) đang liên kết tới mẫu hoạt ảnh lặp */
export interface LoopSceneUsage {
  kind: 'scene'
  layerId: string
  layerName: string
  shotId: string
  shotName: string
}

/** Mảnh (layer) trong mẫu Xưởng Layer 2.5D đang dùng mẫu hoạt ảnh lặp */
export interface LoopCompositeUsage {
  kind: 'composite'
  compositeId: string
  compositeName: string
  layerId: string
  layerName: string
}

export type LoopTemplateUsage = LoopSceneUsage | LoopCompositeUsage

export function loopUsageKey(u: LoopTemplateUsage): string {
  return u.kind === 'scene' ? `scene:${u.layerId}` : `composite:${u.compositeId}:${u.layerId}`
}

function currentProject(): Project | null {
  try {
    return useEditor.getState().project
  } catch {
    return null
  }
}

function findSceneUsages(templateId: string, project: Project | null): LoopSceneUsage[] {
  if (!project) return []
  const shotNames = new Map((project.shots || []).map((s) => [s.id, s.name || `Cảnh ${s.id}`]))
  return (project.layers || [])
    .filter((l) => l.type === 'image' && l.props.loopTemplateId === templateId)
    .map((l) => ({
      kind: 'scene' as const,
      layerId: l.id,
      layerName: l.name || 'Layer không tên',
      shotId: l.shotId || '',
      shotName: shotNames.get(l.shotId || '') || 'Cảnh mặc định'
    }))
}

function findCompositeUsages(templateId: string, composites: LayerComposite[]): LoopCompositeUsage[] {
  const out: LoopCompositeUsage[] = []
  for (const comp of composites) {
    for (const l of comp.layers || []) {
      if (l.loopConfig?.templateId !== templateId) continue
      out.push({
        kind: 'composite',
        compositeId: comp.id,
        compositeName: comp.name || 'Mẫu 2.5D không tên',
        layerId: l.id,
        layerName: l.name || 'Mảnh không tên'
      })
    }
  }
  return out
}

/**
 * Quét toàn bộ nơi đang dùng mẫu hoạt ảnh lặp: layer trong cảnh của dự án hiện tại
 * và các mảnh trong kho mẫu Xưởng Layer 2.5D.
 */
export function findLoopTemplateUsages(
  templateId: string,
  project?: Project | null,
  composites?: LayerComposite[] | null
): LoopTemplateUsage[] {
  if (!templateId) return []
  const proj = project === undefined ? currentProject() : project
  return [
    ...findSceneUsages(templateId, proj),
    ...findCompositeUsages(templateId, composites ?? getStoredComposites())
  ]
}

function patchStoredComposite(compositeId: string, fn: (c: LayerComposite) => LayerComposite): boolean {
  const comp = getStoredComposites().find((c) => c.id === compositeId)
  if (!comp) return false
  saveComposite(fn(comp))
  return true
}

/**
 * Gỡ liên kết tới mẫu: layer/mảnh vẫn giữ nguyên các khung hình đã đóng gói,
 * chỉ không còn tham chiếu tới mẫu trong kho nữa.
 */
export function detachLoopTemplateUsage(usage: LoopTemplateUsage): boolean {
  if (usage.kind === 'scene') {
    const exists = currentProject()?.layers.some((l) => l.id === usage.layerId)
    if (!exists) return false
    useEditor.getState().update((d) => {
      const layer = d.layers.find((l) => l.id === usage.layerId)
      if (layer?.type === 'image') delete layer.props.loopTemplateId
    })
    return true
  }
  return patchStoredComposite(usage.compositeId, (c) => ({
    ...c,
    layers: c.layers.map((l) =>
      l.id === usage.layerId && l.loopConfig
        ? { ...l, loopConfig: { ...l.loopConfig, templateId: undefined } }
        : l
    )
  }))
}

/** Xoá hẳn layer trong cảnh đang dùng mẫu (hỗ trợ Ctrl+Z qua useEditor.update) */
export function removeLoopSceneLayer(usage: LoopSceneUsage): boolean {
  const editor = useEditor.getState()
  if (!editor.project.layers.some((l) => l.id === usage.layerId)) return false
  editor.update((d) => {
    d.layers = d.layers.filter((l) => l.id !== usage.layerId)
  })
  if (useEditor.getState().selectedLayerId === usage.layerId) {
    useEditor.getState().selectLayer(null)
  }
  return true
}

export interface LoopTemplateDeleteResult {
  deleted: boolean
  detached: number
}

/** Gỡ toàn bộ liên kết còn lại rồi xoá mẫu khỏi kho (không để lại tham chiếu treo) */
export function deleteLoopTemplateSafely(templateId: string): LoopTemplateDeleteResult {
  const usages = findLoopTemplateUsages(templateId)
  let detached = 0
  for (const u of usages) {
    if (detachLoopTemplateUsage(u)) detached++
  }
  return { deleted: deleteLoopTemplate(templateId), detached }
}
