import type { LayerComposite } from './types'
import cutoutDemoData from '../../../../../assets/character_cutout_demo/character.composite.json'

/**
 * Composite nhân vật 18 lớp phân tách giải phẫu học chuẩn, khớp nối tay chân độc lập và 15 xương chuyển động.
 * Sử dụng bộ tài nguyên mới character_cutout_demo.
 */
export const CUTOUT_HERO_COMPOSITE: LayerComposite = cutoutDemoData as unknown as LayerComposite
