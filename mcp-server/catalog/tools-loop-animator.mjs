import { L, z } from './shared.mjs'

export const LOOP_ANIMATOR_TOOLS = [
  {
    name: 'open_loop_animator',
    cat: 'loop',
    doc: L(
      'Open the Loop Sprite Animator dialog, optionally loading an image URL, built-in preset (campfire_transparent, campfire_chroma), grid rows/cols, or chroma key settings.',
      'Mở Xưởng Tách Hoạt Ảnh Lặp, tùy chọn nạp URL ảnh, mẫu tích hợp sẵn (campfire_transparent, campfire_chroma), số hàng/cột lưới hoặc khử nền chroma.'
    ),
    shape: (d) => ({
      preset_id: z.string().optional().describe(d('Built-in preset ID (e.g. "campfire_transparent", "campfire_chroma").', 'ID mẫu có sẵn (VD "campfire_transparent", "campfire_chroma").')),
      image_url: z.string().optional().describe(d('Direct image path, asset path, or data URL to open in the animator.', 'Đường dẫn ảnh, tệp tài nguyên hoặc data URL cần mở trong xưởng.')),
      rows: z.number().int().min(1).max(32).optional().describe(d('Grid rows count (default 4).', 'Số hàng lưới (mặc định 4).')),
      cols: z.number().int().min(1).max(32).optional().describe(d('Grid cols count (default 4).', 'Số cột lưới (mặc định 4).')),
      chroma: z.boolean().optional().describe(d('Whether to enable background removal (Chroma Key).', 'Có bật tách màu nền trong suốt hay không.')),
      key_color: z.enum(['chroma_magenta', 'chroma_green', 'chroma_blue', 'white', 'black', 'custom']).optional().describe(d('Background color to remove (magenta, green, blue, white, black, custom).', 'Màu nền cần khử (magenta, green, blue, white, black, custom).'))
    }),
    example: '{"preset_id":"campfire_transparent"}'
  },
  {
    name: 'close_loop_animator',
    cat: 'loop',
    doc: L(
      'Close the Loop Sprite Animator dialog.',
      'Đóng Xưởng Tách Hoạt Ảnh Lặp.'
    ),
    shape: () => ({}),
    example: '{}'
  },
  {
    name: 'get_loop_animator_state',
    cat: 'loop',
    doc: L(
      'Get the complete real-time state of the Loop Sprite Animator: loaded image, grid/contour slicing settings, chroma key parameters, detected frames list, and 60fps playback controls.',
      'Lấy toàn bộ trạng thái thời gian thực của Xưởng Tách Hoạt Ảnh Lặp: ảnh đang mở, cấu hình lưới/chi tiết, thông số tách nền chroma, danh sách frame và điều khiển phát 60fps.'
    ),
    shape: () => ({}),
    example: '{}'
  },
  {
    name: 'configure_loop_chroma',
    cat: 'loop',
    doc: L(
      'Configure background chroma key removal for the Loop Animator: toggle enabled, key color (magenta, green, blue, white, black, custom hex), tolerance, smoothness, and despill.',
      'Cấu hình khử màu nền Chroma Key trong Xưởng Hoạt Ảnh Lặp: bật/tắt, màu nền (magenta, xanh lá, xanh dương, trắng, đen, mã màu hex), độ lệch, độ mịn biên và khử ám màu.'
    ),
    shape: (d) => ({
      enabled: z.boolean().optional().describe(d('Enable or disable chroma keying.', 'Bật hoặc tắt tách nền chroma key.')),
      key_color_type: z.enum(['chroma_magenta', 'chroma_green', 'chroma_blue', 'white', 'black', 'custom']).optional().describe(d('Color preset to remove.', 'Màu nền cần khử.')),
      custom_hex: z.string().optional().describe(d('Custom hex color when key_color_type is "custom" (e.g. "#ff00ff").', 'Mã màu hex tự chọn khi dùng "custom" (VD "#ff00ff").')),
      tolerance: z.number().int().min(1).max(100).optional().describe(d('Color distance tolerance 1-100 (default 36).', 'Độ lệch màu 1-100 (mặc định 36).')),
      smoothness: z.number().int().min(0).max(50).optional().describe(d('Edge softness 0-50 (default 12).', 'Độ mịn biên 0-50 (mặc định 12).')),
      despill: z.number().int().min(0).max(100).optional().describe(d('Color despill suppression 0-100 (default 25).', 'Khử ám màu viền 0-100 (mặc định 25).'))
    }),
    example: '{"enabled":true,"key_color_type":"chroma_magenta","tolerance":38}'
  },
  {
    name: 'split_loop_frames',
    cat: 'loop',
    doc: L(
      'Split the loop animation source image into frames using grid slicing (rows, cols, padding, order) or contour detection, with optional auto-trimming of transparent borders.',
      'Phân tách ảnh nguồn thành các khung hình hoạt ảnh lặp theo lưới (hàng, cột, lùi biên, thứ tự) hoặc tự động phát hiện chi tiết, hỗ trợ tự thu hẹp viền trong suốt.'
    ),
    shape: (d) => ({
      mode: z.enum(['grid', 'contour']).optional().describe(d('Slicing mode: "grid" for regular NxM cells, "contour" for opaque islands.', 'Chế độ phân tách: "grid" cho lưới đều NxM, "contour" cho các đảo pixel có biên.')),
      rows: z.number().int().min(1).max(32).optional().describe(d('Grid rows count.', 'Số hàng lưới.')),
      cols: z.number().int().min(1).max(32).optional().describe(d('Grid columns count.', 'Số cột lưới.')),
      padding: z.number().int().min(0).max(40).optional().describe(d('Padding inset inside each cell in pixels.', 'Lùi viền đệm bên trong từng ô (pixel).')),
      order: z.enum(['row_first', 'col_first']).optional().describe(d('Frame order: "row_first" (left-to-right, top-to-bottom) or "col_first" (top-to-bottom, left-to-right).', 'Thứ tự khung hình: "row_first" (trái qua phải, trên xuống dưới) hoặc "col_first" (trên xuống dưới, trái qua phải).')),
      auto_trim: z.boolean().optional().describe(d('Automatically trim transparent margins around each frame.', 'Tự động thu hẹp viền trong suốt xung quanh từng frame.'))
    }),
    example: '{"mode":"grid","rows":4,"cols":4,"order":"row_first"}'
  },
  {
    name: 'reorder_loop_frames',
    cat: 'loop',
    doc: L(
      'Reorder, reverse, ping-pong expand, duplicate, or delete frames in the loop animation sequence.',
      'Sắp xếp lại thứ tự, đảo chiều, mở rộng ping-pong chu kỳ, nhân bản hoặc xóa khung hình trong chuỗi hoạt ảnh lặp.'
    ),
    shape: (d) => ({
      action: z.enum(['reverse', 'ping_pong', 'move', 'duplicate', 'delete']).describe(d('Action to perform on frames order/list.', 'Thao tác cần thực hiện trên danh sách frame.')),
      from_index: z.number().int().min(0).optional().describe(d('Source frame index when action is "move".', 'Vị trí frame nguồn khi di chuyển.')),
      to_index: z.number().int().min(0).optional().describe(d('Target frame index when action is "move".', 'Vị trí frame đích khi di chuyển.')),
      target_index: z.number().int().min(0).optional().describe(d('Target frame index when action is "duplicate" or "delete".', 'Vị trí frame cần nhân bản hoặc xóa.'))
    }),
    example: '{"action":"reverse"}'
  },
  {
    name: 'update_loop_frame',
    cat: 'loop',
    doc: L(
      'Update individual loop animation frame properties: toggle enabled, hold duration multiplier (1x, 2x, 3x), and positional nudge offsets (X, Y).',
      'Cập nhật thuộc tính của từng khung hình hoạt ảnh lặp: bật/tắt, hệ số giữ thời lượng (1x, 2x, 3x) và độ dời toạ độ (X, Y).'
    ),
    shape: (d) => ({
      frame_index: z.number().int().min(0).describe(d('Zero-based index of the frame to update.', 'Vị trí khung hình cần cập nhật (bắt đầu từ 0).')),
      enabled: z.boolean().optional().describe(d('Whether this frame is active in the animation sequence.', 'Bật hoặc tắt frame này trong chuỗi phát.')),
      duration_multiplier: z.number().min(0.1).max(10).optional().describe(d('Hold duration multiplier for this frame (default 1).', 'Hệ số giữ thời lượng của frame này (mặc định 1).')),
      offset_x: z.number().optional().describe(d('Horizontal offset in pixels.', 'Độ dời ngang (pixel).')),
      offset_y: z.number().optional().describe(d('Vertical offset in pixels.', 'Độ dời dọc (pixel).'))
    }),
    example: '{"frame_index":0,"duration_multiplier":2}'
  },
  {
    name: 'set_loop_playback',
    cat: 'loop',
    doc: L(
      'Configure the real-time animation playback: speed in FPS (1-60), loop mode (loop, ping-pong, once), play/pause state, active scrubbed frame, and onion skinning ghost preview.',
      'Cấu hình trình phát hoạt ảnh thời gian thực: tốc độ FPS (1-60), kiểu lặp (loop, ping-pong, once), trạng thái phát/dừng, frame đang tua và bóng mờ onion skinning.'
    ),
    shape: (d) => ({
      fps: z.number().int().min(1).max(60).optional().describe(d('Animation playback speed in frames per second (1-60, default 12).', 'Tốc độ diễn hoạt theo khung hình/giây (1-60, mặc định 12).')),
      loop_mode: z.enum(['loop', 'ping-pong', 'once']).optional().describe(d('Loop cycle behavior: continuous loop, back-and-forth ping-pong, or play once.', 'Quy luật phát lặp: lặp tuần hoàn (loop), đảo chiều liên tục (ping-pong), hoặc 1 lần (once).')),
      is_playing: z.boolean().optional().describe(d('Play or pause the real-time preview animation.', 'Phát hoặc dừng xem trước thời gian thực.')),
      current_frame: z.number().int().min(0).optional().describe(d('Seek playhead to a specific frame index.', 'Tua playhead tới khung hình cụ thể.')),
      onion_skin: z.boolean().optional().describe(d('Toggle onion skinning ghost overlay of previous frame.', 'Bật/tắt bóng mờ khung hình trước đó.'))
    }),
    example: '{"fps":12,"loop_mode":"loop","is_playing":true}'
  },
  {
    name: 'apply_loop_animation',
    cat: 'loop',
    doc: L(
      'Bake and insert the extracted loop animation directly into the current Parallax Studio project as a live animated 2.5D ImageLayer at the current timeline playhead.',
      'Xuất và đưa trực tiếp hoạt ảnh lặp vừa tách vào dự án Parallax Studio thành một ImageLayer động 2.5D tại mốc thời gian hiện tại.'
    ),
    shape: (d) => ({
      name: z.string().optional().describe(d('Name of the created animated layer (default: "Hoạt ảnh lặp").', 'Tên của layer hoạt ảnh tạo ra (mặc định: "Hoạt ảnh lặp").')),
      shot_id: z.string().optional().describe(d('Target shot ID to attach the layer to (default: active shot).', 'ID shot đích để gắn layer vào (mặc định: shot đang chọn).')),
      speed: z.number().min(0.01).max(10).optional().describe(d('Playback speed multiplier (default 1).', 'Hệ số tốc độ phát (mặc định 1).')),
      position: z.tuple([z.number(), z.number(), z.number()]).optional().describe(d('Initial 3D position [x, y, z].', 'Toạ độ 3D ban đầu [x, y, z].'))
    }),
    example: '{"name":"Lua_Trai_Loop","speed":1}'
  }
]
