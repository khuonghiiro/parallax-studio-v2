import { toast } from '../../actions'
import type { LoopAnimationTemplate } from '../loopAnimator/types'
import { buildWorkshopLoopConfigFromTemplate } from './WorkshopLoopLogicPanel'
import type { AssembledLayerItem } from './types'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import type { WorkshopTab } from './WorkshopRightPanel'

export interface WorkshopLoopActions {
  /** Thêm mẫu Loop thành 1 mảnh mới trong cụm 2.5D, chọn mảnh và mở tab cấu hình Loop */
  addLoopTemplateLayer: (tpl: LoopAnimationTemplate) => void
  /** Gán mẫu Loop vào mảnh đang chọn (thay ảnh + cấu hình phát lặp) */
  bindLoopTemplate: (tpl: LoopAnimationTemplate) => void
}

export function buildLoopTemplateLayer(tpl: LoopAnimationTemplate): AssembledLayerItem {
  return {
    id: `layer_loop_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name: tpl.name,
    imageUrl: tpl.thumbUrl || tpl.imageUrl,
    x: 0,
    y: 0,
    z: -10,
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
  const addLoopTemplateLayer = (tpl: LoopAnimationTemplate): void => {
    const item = buildLoopTemplateLayer(tpl)
    state.setComposite((c) => ({ ...c, layers: [...c.layers, item] }))
    state.select(item.id)
    setTab('loop')
    playback.setIsPlaying(true)
    toast(`✨ Đã thêm mảnh hoạt ảnh lặp "${tpl.name}" vào cụm 2.5D`)
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

  return { addLoopTemplateLayer, bindLoopTemplate }
}
