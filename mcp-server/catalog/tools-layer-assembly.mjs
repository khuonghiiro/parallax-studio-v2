/**
 * Tool specs — Layer Assembly workshop (Xưởng Lắp Ráp Layer 2.5D) & multi-layer composites (bilingual, see shared.mjs).
 */
import { L, z } from './shared.mjs'

export const LAYER_COMPOSITE_CATEGORIES = ['nature', 'prop', 'character', 'architecture', 'custom']

export const LAYER_ASSEMBLY_TOOLS = [
  {
    name: 'layer_assembly_action', cat: 'layer_assembly',
    doc: L('Apply one undoable batch action to layers in the open workshop. Omitted layer_ids uses the selection; an empty list changes nothing. Locked layers are skipped except lock/unlock. Distribute X/Y spaces centers between the endpoints (3+ layers). Depth uses list order, centered around Z=0 (2+ layers); positive Z is behind. Stagger offsets existing motions by 0.35 seconds.',
      'Thao tác hàng loạt một bước hoàn tác trong xưởng đang mở. Bỏ layer_ids dùng các lớp đã chọn; danh sách rỗng không đổi gì. Bỏ qua lớp khóa trừ khóa/mở khóa. Đều X/Y chia tâm giữa hai đầu (ít nhất 3 lớp). Tách Z theo thứ tự danh sách quanh Z=0 (ít nhất 2 lớp); Z dương ở sau. So le lệch pha hoạt ảnh sẵn có 0,35 giây.'),
    shape: (d) => ({
      action: z.enum(['center-x', 'center-y', 'distribute-x', 'distribute-y', 'depth-forward', 'depth-reverse', 'flatten', 'reset-transform', 'duplicate', 'delete', 'hide', 'show', 'lock', 'unlock', 'stagger', 'stop-motion', 'estimate-frame']).describe(d('Batch operation. estimate-frame conservatively estimates 2D frame dimensions for selected visible layers including locked layers, using a 380px image bound, scale and Z rotation; excludes motion and perspective.', 'Thao tác hàng loạt. estimate-frame ước lượng khung 2D cho lớp được chọn đang hiện, kể cả lớp khóa, theo ảnh tối đa 380px, scale và góc Z; chưa tính chuyển động/phối cảnh.')),
      layer_ids: z.array(z.string()).optional().describe(d('Existing workshop layer IDs; defaults to selection.', 'ID lớp trong xưởng; mặc định dùng vùng chọn.')),
      spacing: z.number().min(1).max(2000).optional().describe(d('Depth spacing in pixels, default 80.', 'Bước chiều sâu pixel, mặc định 80.'))
    }), example: '{"action":"depth-forward","spacing":80}'
  },
  {
    name: 'select_layer_assembly_layers', cat: 'layer_assembly',
    doc: L('Select multiple layers in the open workshop. Pass an empty array to clear selection.', 'Chọn nhiều lớp trong xưởng đang mở. Truyền mảng rỗng để bỏ chọn.'),
    shape: (d) => ({ layer_ids: z.array(z.string()).describe(d('Existing layer IDs from get_layer_assembly_state.', 'ID lớp từ get_layer_assembly_state.')) }),
    example: '{"layer_ids":[]}'
  },
  {
    name: 'layer_assembly_history', cat: 'layer_assembly',
    doc: L('Undo or redo one workshop draft edit, without changing the main project history.', 'Hoàn tác hoặc làm lại một bước bản nháp xưởng, độc lập lịch sử dự án chính.'),
    shape: (d) => ({ action: z.enum(['undo', 'redo']).describe(d('History direction.', 'Hướng lịch sử.')) }), example: '{"action":"undo"}'
  },
  {
    name: 'list_layer_composites',
    cat: 'layer_assembly',
    doc: L(
      'List all saved and built-in 2.5D layer composites (multi-layer stacked items with depth and gentle motion presets such as bonsai, bushes, vines) with id, name, category, layer count and motion type.',
      'Liệt kê mọi chi tiết cụm layer 2.5D đã lưu và dựng sẵn (các vật thể xếp chồng nhiều lớp kèm chiều sâu và hoạt ảnh đung đưa như cây bonsai, bụi hoa, dây leo) kèm id, tên, danh mục, số lớp và dạng hoạt ảnh.'
    ),
    shape: () => ({}),
    example: '{}'
  },
  {
    name: 'get_layer_composite',
    cat: 'layer_assembly',
    doc: L(
      'Get full depth configuration, layer stack, coordinates, anchor points and motion physics of a 2.5D layer composite by ID or from the currently active workshop session.',
      'Lấy cấu hình chiều sâu, danh sách layer xếp chồng, tọa độ, điểm neo và chuyển động hoạt ảnh của một cụm layer 2.5D theo ID hoặc từ phiên đang mở trong xưởng layer.'
    ),
    shape: (d) => ({
      id: z
        .string()
        .optional()
        .describe(
          d(
            'Composite ID (e.g. "comp-bonsai-zen"). If omitted, uses active workshop composite.',
            'ID chi tiết (vd "comp-bonsai-zen"). Bỏ trống sẽ lấy chi tiết của phiên đang mở.'
          )
        ),
      composite_id: z.string().optional().describe(d('Alias for id.', 'Bí danh của id.'))
    }),
    example: '{"id":"comp-bonsai-zen"}'
  },
  {
    name: 'save_layer_composite',
    cat: 'layer_assembly',
    doc: L(
      'Save or update a 2.5D layer composite preset into local storage. Automatically generates a clean 2D preview thumbnail if none is provided.',
      'Lưu hoặc cập nhật một mẫu chi tiết cụm layer 2.5D vào kho lưu trữ. Tự động kết xuất ảnh xem trước 2D (thumbnail) nếu chưa có.'
    ),
    shape: (d) => ({
      id: z.string().optional().describe(d('Unique ID for the composite.', 'ID duy nhất của chi tiết.')),
      name: z.string().describe(d('Descriptive name of the composite.', 'Tên mô tả của chi tiết lắp ráp.')),
      category: z
        .enum(['nature', 'prop', 'character', 'architecture', 'custom'])
        .optional()
        .describe(d('Category of the composite.', 'Danh mục của chi tiết.')),
      description: z.string().optional().describe(d('Short description of the composite.', 'Mô tả ngắn về chi tiết.')),
      width: z.number().optional().describe(d('Reference bounding width in pixels.', 'Chiều rộng khung tham chiếu (pixel).')),
      height: z.number().optional().describe(d('Reference bounding height in pixels.', 'Chiều cao khung tham chiếu (pixel).')),
      layers: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            assetPath: z.string().optional(),
            imageUrl: z.string().optional(),
            x: z.number(),
            y: z.number(),
            z: z.number(),
            scale: z.number(),
            rotation: z.number(),
            rotationX: z.number().optional(),
            rotationY: z.number().optional(),
            opacity: z.number(),
            locked: z.boolean().optional(),
            hidden: z.boolean().optional(),
            motion: z.object({
              type: z.enum(['none', 'sway', 'breathe', 'float', 'wave', 'rocking']),
              speed: z.number(),
              amplitude: z.number(),
              anchor: z.enum(['bottom', 'center', 'top', 'left', 'right']),
              phaseOffset: z.number().optional()
            })
          })
        )
        .describe(d('Stacked layers list ordered by depth.', 'Danh sách các layer xếp chồng theo chiều sâu.'))
    }),
    example:
      '{"name":"Cây Tùng Mini","category":"nature","width":500,"height":550,"layers":[{"id":"l1","name":"Chậu","x":0,"y":100,"z":-5,"scale":1,"rotation":0,"opacity":1,"motion":{"type":"none","speed":1,"amplitude":0,"anchor":"bottom"}}]}'
  },
  {
    name: 'delete_layer_composite',
    cat: 'layer_assembly',
    doc: L(
      'Delete a saved 2.5D layer composite from storage by ID.',
      'Xóa một chi tiết cụm layer 2.5D đã lưu khỏi kho lưu trữ theo ID.'
    ),
    shape: (d) => ({
      id: z.string().describe(d('ID of the composite to delete.', 'ID của chi tiết cần xóa.')),
      composite_id: z.string().optional().describe(d('Alias for id.', 'Bí danh của id.'))
    }),
    example: '{"id":"comp-my-custom"}'
  },
  {
    name: 'insert_layer_composite',
    cat: 'layer_assembly',
    doc: L(
      'Insert all layers from a 2.5D composite into the active shot or scene with their full depth hierarchy and organic gentle motion physics.',
      'Chèn toàn bộ các tầng layer của cụm 2.5D vào phân cảnh hiện tại với đầy đủ phân tầng độ sâu và chuyển động vật lý êm ái.'
    ),
    shape: (d) => ({
      id: z
        .string()
        .optional()
        .describe(
          d(
            'Composite ID to insert (defaults to active workshop composite).',
            'ID chi tiết cần chèn (mặc định lấy chi tiết của phiên đang mở).'
          )
        ),
      composite_id: z.string().optional().describe(d('Alias for id.', 'Bí danh của id.')),
      shot_id: z
        .string()
        .optional()
        .describe(d('Target shot ID (defaults to active shot).', 'ID phân cảnh đích (mặc định: phân cảnh đang mở).')),
      x: z.number().optional().describe(d('Horizontal placement offset in scene.', 'Độ dời ngang trong cảnh.')),
      y: z.number().optional().describe(d('Vertical placement offset in scene.', 'Độ dời dọc trong cảnh.')),
      scale: z.number().optional().describe(d('Scale multiplier (defaults to 1.0).', 'Hệ số phóng to thu nhỏ (mặc định: 1.0).'))
    }),
    example: '{"id":"comp-bonsai-zen","scale":1.0}'
  },
  {
    name: 'open_layer_assembly',
    cat: 'layer_assembly',
    doc: L(
      'Open the 2.5D Layer Assembly workshop dialog in the app UI for interactive visual assembly and real-time editing.',
      'Mở hộp thoại Xưởng Lắp Ráp Layer 2.5D trên giao diện ứng dụng để tương tác và tinh chỉnh trực quan theo thời gian thực.'
    ),
    shape: (d) => ({
      composite_id: z
        .string()
        .optional()
        .describe(
          d(
            'Optional composite ID to load (e.g. "comp-bonsai-zen"). If omitted, opens blank new composite.',
            'ID chi tiết tùy chọn để nạp (vd "comp-bonsai-zen"). Nếu bỏ trống, mở mẫu mới.'
          )
        )
    }),
    example: '{"composite_id":"comp-bonsai-zen"}'
  },
  {
    name: 'close_layer_assembly',
    cat: 'layer_assembly',
    doc: L(
      'Close the 2.5D Layer Assembly workshop dialog in the app UI.',
      'Đóng hộp thoại Xưởng Lắp Ráp Layer 2.5D trên giao diện ứng dụng.'
    ),
    shape: () => ({}),
    example: '{}'
  },
  {
    name: 'get_layer_assembly_state',
    cat: 'layer_assembly',
    doc: L(
      'Inspect the current state of the 2.5D Layer Assembly workshop modal (open status, active composite, selected layer, playback time).',
      'Kiểm tra trạng thái hiện tại của modal Xưởng Lắp Ráp Layer 2.5D (đang mở hay không, chi tiết hiện tại, layer đang chọn, thời gian chạy thử).'
    ),
    shape: () => ({}),
    example: '{}'
  }
]
