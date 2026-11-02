import { getAllLoopTemplates } from '../../ui/loopAnimator/loopAnimatorStorage'
import {
  deleteLoopTemplateSafely,
  detachLoopTemplateUsage,
  findLoopTemplateUsages,
  removeLoopSceneLayer,
  type LoopTemplateUsage
} from '../../ui/loopAnimator/loopTemplateUsage'
import { bool, str } from '../params'
import type { Handler, Params } from '../types'

function usageToJson(u: LoopTemplateUsage): Record<string, string> {
  return u.kind === 'scene'
    ? { kind: 'scene', layer_id: u.layerId, layer_name: u.layerName, shot_id: u.shotId, shot_name: u.shotName }
    : { kind: 'composite', layer_id: u.layerId, layer_name: u.layerName, composite_id: u.compositeId, composite_name: u.compositeName }
}

function requireTemplateId(p: Params): string {
  const id = str(p, 'template_id', true)
  if (!getAllLoopTemplates().some((t) => t.id === id)) throw new Error(`Không tìm thấy mẫu hoạt ảnh Loop "${id}"`)
  return id
}

/**
 * Lệnh MCP quản lý kho Loop Animate: liệt kê mẫu, xem nơi đang dùng (ràng buộc),
 * gỡ liên kết / xoá layer phụ thuộc và xoá mẫu an toàn — đồng bộ 100% với giao diện.
 */
export const loopLibraryCommands: Record<string, Handler> = {
  list_loop_templates: async () => {
    const templates = getAllLoopTemplates()
    return {
      ok: true,
      count: templates.length,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        frame_count: t.frameCount,
        fps: t.fps,
        speed: t.speed ?? 1,
        loop_mode: t.loopMode,
        is_builtin: Boolean(t.isBuiltin),
        usages_count: findLoopTemplateUsages(t.id).length
      }))
    }
  },

  get_loop_template_usages: async (p: Params) => {
    const id = requireTemplateId(p)
    const usages = findLoopTemplateUsages(id)
    return { ok: true, template_id: id, total: usages.length, usages: usages.map(usageToJson) }
  },

  detach_loop_template_usage: async (p: Params) => {
    const id = requireTemplateId(p)
    const layerId = str(p, 'layer_id', true)
    const compositeId = str(p, 'composite_id')
    const removeLayer = bool(p, 'remove_layer') ?? false
    const usage = findLoopTemplateUsages(id).find(
      (u) => u.layerId === layerId && (compositeId ? u.kind === 'composite' && u.compositeId === compositeId : true)
    )
    if (!usage) throw new Error(`Layer "${layerId}" không dùng mẫu "${id}"`)
    if (removeLayer && usage.kind !== 'scene') throw new Error('remove_layer chỉ áp dụng cho layer trong cảnh (kind = scene)')
    const done = removeLayer && usage.kind === 'scene' ? removeLoopSceneLayer(usage) : detachLoopTemplateUsage(usage)
    return { ok: done, action: removeLayer ? 'removed_layer' : 'detached', usage: usageToJson(usage), remaining: findLoopTemplateUsages(id).length }
  },

  delete_loop_template: async (p: Params) => {
    const id = requireTemplateId(p)
    const force = bool(p, 'force') ?? false
    const usages = findLoopTemplateUsages(id)
    if (usages.length > 0 && !force) {
      return {
        ok: false,
        requires_force: true,
        message: 'Mẫu đang được dùng. Gỡ từng mục bằng detach_loop_template_usage hoặc gọi lại với force=true để tự gỡ liên kết rồi xoá.',
        usages: usages.map(usageToJson)
      }
    }
    const res = deleteLoopTemplateSafely(id)
    return { ok: res.deleted, template_id: id, detached: res.detached }
  }
}
