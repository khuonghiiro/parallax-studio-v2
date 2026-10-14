import type { LayerComposite } from './types'
import cutoutDemoData from '../../../../../assets/character_cutout_demo/character.composite.json'
import { CUTOUT_FRONT_BONES, FRONT_CLIPS } from './templates/humanoidTemplates'

const baseComposite = cutoutDemoData as unknown as LayerComposite

/**
 * Composite nhân vật anime 2.5D tách ghép 13 mảnh giữ nguyên tỉ lệ pixel gốc 1:1 từ ảnh minh hoạ,
 * kết hợp 15 xương chuyển động và 5 clip hoạt ảnh dựng sẵn.
 */
export const CUTOUT_HERO_COMPOSITE: LayerComposite = {
  ...baseComposite,
  rig: {
    bones: structuredClone(CUTOUT_FRONT_BONES),
    duration: FRONT_CLIPS[0].duration,
    loop: FRONT_CLIPS[0].loop,
    tracks: structuredClone(FRONT_CLIPS[0].tracks),
    clips: structuredClone(FRONT_CLIPS),
    activeClipId: FRONT_CLIPS[0].id
  }
}
