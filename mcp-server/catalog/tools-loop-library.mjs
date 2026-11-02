import { L, z } from './shared.mjs'

/** Quản lý kho Loop Animate: liệt kê, kiểm tra ràng buộc, gỡ liên kết và xoá mẫu an toàn */
export const LOOP_LIBRARY_TOOLS = [
  {
    name: 'list_loop_templates',
    cat: 'loop',
    doc: L(
      'List every loop animation template in the Loop Animate library (built-in + user saved) with frame count, FPS, loop mode and how many places use it.',
      'Liệt kê toàn bộ mẫu hoạt ảnh lặp trong kho Loop Animate (có sẵn + tự lưu) kèm số frame, FPS, kiểu lặp và số nơi đang dùng.'
    ),
    shape: () => ({}),
    example: '{}'
  },
  {
    name: 'get_loop_template_usages',
    cat: 'loop',
    doc: L(
      'Find every dependency of a loop template before deleting it: image layers in project shots (kind=scene) and pieces inside saved 2.5D Layer Workshop composites (kind=composite).',
      'Tìm mọi ràng buộc của mẫu Loop trước khi xoá: layer ảnh trong các cảnh dự án (kind=scene) và mảnh trong mẫu Xưởng Layer 2.5D đã lưu (kind=composite).'
    ),
    shape: (d) => ({
      template_id: z.string().describe(d('Loop template ID (from list_loop_templates).', 'ID mẫu Loop (lấy từ list_loop_templates).'))
    }),
    example: '{"template_id":"loop_preset_campfire"}'
  },
  {
    name: 'detach_loop_template_usage',
    cat: 'loop',
    doc: L(
      'Detach one dependency from a loop template (the layer keeps its baked frames), or remove the scene layer entirely with remove_layer=true (undoable with Ctrl+Z).',
      'Gỡ liên kết 1 ràng buộc khỏi mẫu Loop (layer vẫn giữ khung hình đã đóng gói), hoặc xoá hẳn layer trong cảnh với remove_layer=true (Ctrl+Z để hoàn tác).'
    ),
    shape: (d) => ({
      template_id: z.string().describe(d('Loop template ID.', 'ID mẫu Loop.')),
      layer_id: z.string().describe(d('Layer / piece ID returned by get_loop_template_usages.', 'ID layer / mảnh lấy từ get_loop_template_usages.')),
      composite_id: z.string().optional().describe(d('Composite ID when the usage is a 2.5D Workshop piece.', 'ID mẫu Xưởng 2.5D khi ràng buộc là 1 mảnh trong xưởng.')),
      remove_layer: z.boolean().optional().describe(d('Delete the scene layer instead of only unlinking it (scene usages only).', 'Xoá hẳn layer trong cảnh thay vì chỉ gỡ liên kết (chỉ áp dụng cho kind=scene).'))
    }),
    example: '{"template_id":"loop_preset_campfire","layer_id":"layer_abc123"}'
  },
  {
    name: 'delete_loop_template',
    cat: 'loop',
    doc: L(
      'Delete a loop template from the library. If it is still used, returns requires_force with the usage list; pass force=true to auto-unlink the remaining usages and delete. Built-in templates are hidden from the library.',
      'Xoá mẫu Loop khỏi kho. Nếu mẫu còn được dùng sẽ trả về requires_force kèm danh sách ràng buộc; truyền force=true để tự gỡ liên kết còn lại rồi xoá. Mẫu có sẵn sẽ được ẩn khỏi kho.'
    ),
    shape: (d) => ({
      template_id: z.string().describe(d('Loop template ID to delete.', 'ID mẫu Loop cần xoá.')),
      force: z.boolean().optional().describe(d('Auto-unlink every remaining usage before deleting (default false).', 'Tự gỡ toàn bộ liên kết còn lại trước khi xoá (mặc định false).'))
    }),
    example: '{"template_id":"loop_custom_x1","force":false}'
  }
]
