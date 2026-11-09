import { toast } from '../../actions'
import { getAllLoopTemplates } from '../loopAnimator/loopAnimatorStorage'
import type { LoopAnimationTemplate } from '../loopAnimator/types'
import { buildWorkshopLoopConfigFromTemplate } from './WorkshopLoopLogicPanel'
import type { AssembledLayerItem } from './types'
import { computeFrontLayerZ, type useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import type { WorkshopTab } from './WorkshopRightPanel'

export interface WorkshopLoopActions {
  /** Thêm mẫu Loop thành 1 mảnh mới trong cụm 2.5D (tại vị trí thả nếu có), chọn mảnh và mở tab cấu hình Loop */
  addLoopTemplateLayer: (tpl: LoopAnimationTemplate, pos?: { x: number; y: number }) => void
  /** Thêm mẫu Loop theo id (dùng khi kéo thả từ sidebar vào sân khấu) */
  addLoopTemplateById: (templateId: string, pos?: { x: number; y: number }) => void
  /** Gán mẫu Loop vào mảnh đang chọn (thay ảnh + cấu hình phát lặp) */
  bindLoopTemplate: (tpl: LoopAnimationTemplate) => void
}

/**
 * Tạo mảnh Loop mới. Mặc định đặt ở Z trước nhất (`computeFrontLayerZ`) để mảnh không bị
 * các layer nhân vật che khuất mất trên sân khấu, và đặt đúng toạ độ thả chuột nếu có.
 */
export function buildLoopTemplateLayer(
  tpl: LoopAnimationTemplate,
  options: { pos?: { x: number; y: number }; z?: number } = {}
): AssembledLayerItem {
  return {
    id: `layer_loop_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name: tpl.name,
    imageUrl: tpl.thumbUrl || tpl.imageUrl,
    x: Math.round(options.pos?.x ?? 0),
    y: Math.round(options.pos?.y ?? 0),
    z: options.z ?? 10,
    scale: 1,
    rotation: 0,
    opacity: 1,
    motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' },
    loopConfig: buildWorkshopLoopConfigFromTemplate(tpl)
  }
}

export function useWorkshopLoopActions(
  state: ReturnType<typeof useLayerWorkshop>,
  playback: ReturnType<typeof useWorkshopPlayback>,
  setTab: (tab: WorkshopTab) => void
): WorkshopLoopActions {
  const addLoopTemplateLayer = (tpl: LoopAnimationTemplate, pos?: { x: number; y: number }): void => {
    const item = buildLoopTemplateLayer(tpl, { pos, z: computeFrontLayerZ(state.composite.layers) })
    state.setComposite((c) => ({ ...c, layers: [...c.layers, item] }))
    state.select(item.id)
    setTab('loop')
    playback.setIsPlaying(true)
    toast(`✨ Đã thêm mảnh hoạt ảnh lặp "${tpl.name}" vào cụm 2.5D`)
  }

  const addLoopTemplateById = (templateId: string, pos?: { x: number; y: number }): void => {
    const tpl = getAllLoopTemplates().find((t) => t.id === templateId)
    if (!tpl) {
      toast(`⚠️ Không tìm thấy mẫu Loop "${templateId}" trong kho`)
      return
    }
    addLoopTemplateLayer(tpl, pos)
  }

  const bindLoopTemplate = (tpl: LoopAnimationTemplate): void => {
    const target = state.composite.layers.find((l) => l.id === state.selectedLayerId)
    if (!target) {
      addLoopTemplateLayer(tpl)
      return
    }
    state.update(target.id, {
      imageUrl: tpl.thumbUrl || tpl.imageUrl,
      loopConfig: buildWorkshopLoopConfigFromTemplate(tpl)
    })
    setTab('loop')
    playback.setIsPlaying(true)
    toast(`🔁 Đã gắn hoạt ảnh "${tpl.name}" vào mảnh "${target.name}"`)
  }

  return { addLoopTemplateLayer, addLoopTemplateById, bindLoopTemplate }
}
