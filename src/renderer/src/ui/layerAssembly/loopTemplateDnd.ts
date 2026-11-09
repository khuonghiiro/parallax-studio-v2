/** Kiểu dữ liệu kéo thả mẫu Loop từ tab Loop của sidebar vào Sân khấu 2D / 3D (payload `application/json`). */
export const LOOP_TEMPLATE_DRAG_TYPE = 'loop-template'

export interface LoopTemplateDragPayload {
  type: typeof LOOP_TEMPLATE_DRAG_TYPE
  templateId: string
  name: string
}
