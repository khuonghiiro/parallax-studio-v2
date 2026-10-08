/**
 * Tool specs — inspection, project, shots and layers (bilingual, see shared.mjs).
 */
import { L, atTime, ease, layerCommon, vec3, z } from './shared.mjs'

export const SCENE_TOOLS = [
  // ---- inspect
  {
    name: 'list_commands', cat: 'inspect',
    doc: L('List all available MCP command names in Parallax Studio.', 'Liệt kê tên tất cả lệnh MCP khả dụng trong Parallax Studio.'),
    shape: () => ({})
  },
  {
    name: 'get_project_info', cat: 'inspect',
    doc: L(
      'Overview of the open project: composition, shots (with framing camera), layers (summaries), camera, look, audio, assets, selection.',
      'Tổng quan dự án đang mở: composition, các shot (kèm camera khung hình), layer (tóm tắt), camera, look, âm thanh, asset, lựa chọn hiện tại.'
    ),
    shape: () => ({})
  },
  {
    name: 'get_shot_info', cat: 'inspect',
    doc: L('Details of one shot and its layers.', 'Chi tiết một shot và các layer của nó.'),
    shape: () => ({ shot_id: z.string(), time: z.number().optional() }),
    example: '{"shot_id":"shot-1"}'
  },
  {
    name: 'get_layer_info', cat: 'inspect',
    doc: L('Full JSON of one layer, including all keyframes and props.', 'JSON đầy đủ của một layer, gồm mọi keyframe và thuộc tính.'),
    shape: () => ({ layer_id: z.string() })
  },
  {
    name: 'get_camera_info', cat: 'inspect',
    doc: L(
      'Camera state evaluated at a time (default: current time) plus all camera keyframes and which shot it looks at.',
      'Trạng thái camera tại một thời điểm (mặc định: hiện tại) cùng mọi keyframe camera và shot mà camera đang nhìn.'
    ),
    shape: () => ({ time: z.number().optional() })
  },
  {
    name: 'get_memory_stats', cat: 'inspect',
    doc: L(
      'Texture residency (what the camera has loaded), GPU texture MB vs budget, JS heap and per-process RAM.',
      'Texture đang nạp (những gì camera thấy), MB texture GPU so với ngân sách, JS heap và RAM từng tiến trình.'
    ),
    shape: () => ({})
  },
  {
    name: 'get_viewport_screenshot', cat: 'inspect', format: 'image',
    doc: L(
      'Render a picture of the scene. view "camera" = final output frame at `time`; view "3d" = orbit overview of all shots, layers, camera and its path (like After Effects custom view).',
      'Render ảnh cảnh. view "camera" = khung hình xuất cuối tại `time`; view "3d" = góc nhìn bao quát mọi shot, layer, camera và đường bay (như custom view của After Effects).'
    ),
    shape: (d) => ({
      view: z.enum(['camera', '3d']).optional(),
      time: z.number().optional(),
      width: z.number().int().min(64).max(3840).optional().describe(d('Default 960.', 'Mặc định 960.')),
      format: z.enum(['png', 'jpeg']).optional(),
      shot_id: z.string().optional().describe(d('3d view only: frame just this shot.', 'Chỉ view 3d: chỉ đóng khung shot này.')),
      yaw: z.number().optional().describe(d('3d view only: orbit angle in degrees (default -35).', 'Chỉ view 3d: góc xoay quanh, độ (mặc định -35).')),
      pitch: z.number().optional().describe(d('3d view only: elevation in degrees (default 22).', 'Chỉ view 3d: góc ngẩng, độ (mặc định 22).'))
    }),
    example: '{"view":"camera","time":1.5}'
  },
  {
    name: 'get_app_screenshot', cat: 'inspect', format: 'image',
    doc: L(
      'Screenshot of the WHOLE app window exactly as the user sees it (menus, dialogs, inspector, 3D assembly workshop). Use it to review UI and dialogs; get_viewport_screenshot only renders the scene.',
      'Chụp TOÀN BỘ cửa sổ app đúng như người dùng đang thấy (menu, dialog, inspector, xưởng lắp ráp 3D). Dùng để review giao diện và dialog; get_viewport_screenshot chỉ render cảnh.'
    ),
    shape: (d) => ({
      width: z.number().int().min(64).max(3840).optional().describe(d('Downscale to this width (default: native).', 'Thu nhỏ về bề rộng này (mặc định: kích thước gốc).')),
      format: z.enum(['png', 'jpeg']).optional(),
      delay_ms: z.number().int().min(0).max(5000).optional().describe(d('Wait before capturing so UI transitions finish (default 150).', 'Chờ trước khi chụp để hiệu ứng UI chạy xong (mặc định 150).'))
    }),
    example: '{"width":1280}'
  },
  {
    name: 'ui_click', cat: 'inspect',
    doc: L(
      'Click a visible UI element like a user: by its text (buttons, tabs, menu items, cards) or by CSS selector. Combine with get_app_screenshot to open dialogs and check them.',
      'Bấm một phần tử UI đang hiển thị như người dùng: theo chữ (nút, tab, mục menu, thẻ) hoặc theo CSS selector. Kết hợp get_app_screenshot để mở dialog và kiểm tra.'
    ),
    shape: (d) => ({
      text: z.string().optional().describe(d('Visible text; exact match wins over partial (case-insensitive).', 'Chữ hiển thị; khớp chính xác được ưu tiên hơn khớp một phần (không phân biệt hoa thường).')),
      selector: z.string().optional().describe(d('CSS selector (alone, or to narrow the text search).', 'CSS selector (dùng riêng, hoặc để thu hẹp phạm vi tìm theo chữ).')),
      index: z.number().int().min(0).optional().describe(d('Which match to click when several match (default 0).', 'Chọn kết quả thứ mấy khi có nhiều phần tử khớp (mặc định 0).'))
    }),
    example: '{"text":"Thiên nhiên"}'
  },
  {
    name: 'ui_type', cat: 'inspect',
    doc: L('Type a value into an input/textarea found by CSS selector (fires input + change events).', 'Nhập giá trị vào ô input/textarea tìm theo CSS selector (phát sự kiện input + change).'),
    shape: (d) => ({
      selector: z.string().describe(d('CSS selector of the input.', 'CSS selector của ô nhập.')),
      value: z.string(),
      index: z.number().int().min(0).optional()
    }),
    example: '{"selector":".c3d-search input","value":"cây"}'
  },

  // ---- project
  {
    name: 'new_project', cat: 'project',
    doc: L('Start an empty project (discards unsaved changes without asking).', 'Tạo dự án trống (bỏ thay đổi chưa lưu mà không hỏi).'),
    shape: () => ({
      name: z.string().optional(),
      width: z.number().int().optional(),
      height: z.number().int().optional(),
      fps: z.number().optional(),
      duration: z.number().optional(),
      background: z.string().optional()
    })
  },
  {
    name: 'set_composition', cat: 'project',
    doc: L(
      'Change composition settings. Changing duration extends/trims layers that ran to the old end.',
      'Đổi thiết lập composition. Đổi thời lượng sẽ kéo dài/cắt các layer đang chạy tới điểm cuối cũ.'
    ),
    shape: () => ({
      name: z.string().optional(),
      width: z.number().int().optional(),
      height: z.number().int().optional(),
      fps: z.number().optional(),
      duration: z.number().optional(),
      background: z.string().optional()
    })
  },
  {
    name: 'save_project', cat: 'project',
    doc: L('Save the project as a .pxs file (images and audio embedded).', 'Lưu dự án thành file .pxs (nhúng sẵn ảnh và âm thanh).'),
    shape: (d) => ({
      path: z.string().optional().describe(d('Absolute path ending in .pxs. Omit to overwrite the current file.', 'Đường dẫn tuyệt đối kết thúc bằng .pxs. Bỏ trống = ghi đè file hiện tại.'))
    })
  },
  {
    name: 'open_project', cat: 'project',
    doc: L('Open a .pxs or .json project file.', 'Mở file dự án .pxs hoặc .json.'),
    shape: () => ({ file_path: z.string() })
  },
  {
    name: 'import_project_json', cat: 'project',
    doc: L(
      'Import a project from a JSON string or file. Supports both full Project JSON and human-friendly declarative scene JSON.',
      'Nhập dự án từ chuỗi hoặc file JSON. Hỗ trợ cả Project JSON đầy đủ lẫn JSON mô tả cảnh dạng khai báo dễ đọc.'
    ),
    shape: (d) => ({
      json: z.string().optional().describe(d('JSON string or object containing project or scene definition.', 'Chuỗi/đối tượng JSON chứa định nghĩa dự án hoặc cảnh.')),
      file_path: z.string().optional().describe(d('Path to a .json file on disk.', 'Đường dẫn tới file .json trên ổ đĩa.'))
    })
  },
  {
    name: 'export_project_json', cat: 'project',
    doc: L('Export the entire current project to a self-contained JSON string (with embedded assets).', 'Xuất toàn bộ dự án hiện tại thành chuỗi JSON độc lập (nhúng sẵn asset).'),
    shape: () => ({})
  },
  {
    name: 'import_shot_json', cat: 'project',
    doc: L('Import a shot and its layers from JSON into the current project.', 'Nhập một shot cùng các layer từ JSON vào dự án hiện tại.'),
    shape: (d) => ({
      json: z.string().optional().describe(d('JSON string of the shot definition.', 'Chuỗi JSON định nghĩa shot.')),
      file_path: z.string().optional().describe(d('Path to a .json file on disk.', 'Đường dẫn tới file .json trên ổ đĩa.'))
    })
  },
  {
    name: 'export_shot_json', cat: 'project',
    doc: L('Export a single shot and its layers to JSON.', 'Xuất một shot và các layer của nó ra JSON.'),
    shape: (d) => ({ shot: z.string().describe(d('Shot name or shot id.', 'Tên hoặc id của shot.')) })
  },
  { name: 'undo', cat: 'project', doc: L('Undo the last edit.', 'Hoàn tác thao tác gần nhất.'), shape: () => ({}) },
  { name: 'redo', cat: 'project', doc: L('Redo.', 'Làm lại thao tác vừa hoàn tác.'), shape: () => ({}) },

  // ---- shots
  {
    name: 'add_shot', cat: 'shots',
    doc: L('Create a new shot (scene). By default it is placed to the right of the existing shots.', 'Tạo shot (phân cảnh) mới. Mặc định đặt bên phải các shot hiện có.'),
    shape: (d) => ({
      name: z.string().optional(),
      direction: z.enum(['right', 'down', 'depth']).optional(),
      position: vec3.optional().describe(d('Explicit world position (overrides direction).', 'Vị trí world cụ thể (ghi đè direction).')),
      rotation: vec3.optional(),
      color: z.string().optional(),
      adopt_global_layers: z.boolean().optional().describe(d('Move all current global layers into this shot.', 'Chuyển mọi layer toàn cục hiện có vào shot này.'))
    }),
    example: '{"name":"Night rain"}'
  },
  {
    name: 'update_shot', cat: 'shots',
    doc: L('Rename / recolor / hide a shot or move it in world space.', 'Đổi tên / màu / ẩn một shot hoặc di chuyển nó trong không gian world.'),
    shape: (d) => ({
      shot_id: z.string(),
      name: z.string().optional(),
      color: z.string().optional(),
      visible: z.boolean().optional(),
      position: vec3.optional(),
      rotation: vec3.optional(),
      at_time: atTime(d),
      ease: ease.optional()
    })
  },
  {
    name: 'delete_shot', cat: 'shots',
    doc: L(
      'Delete a shot. Its layers are deleted too unless keep_layers is true (they become global).',
      'Xóa một shot. Layer của nó cũng bị xóa trừ khi keep_layers = true (khi đó chúng thành layer toàn cục).'
    ),
    shape: () => ({ shot_id: z.string(), keep_layers: z.boolean().optional() })
  },

  // ---- layers
  {
    name: 'add_image_layer', cat: 'layers',
    doc: L(
      'Add an image (PNG with transparency works best for parallax plates) as a layer. Provide file_path (absolute) or image_base64.',
      'Thêm ảnh làm layer (PNG có nền trong suốt hợp nhất cho các lớp parallax). Truyền file_path (tuyệt đối) hoặc image_base64.'
    ),
    shape: (d) => ({
      file_path: z.string().optional(),
      image_base64: z.string().optional().describe(d('Raw base64 or data: URL.', 'Base64 thô hoặc data: URL.')),
      file_name: z.string().optional(),
      fit: z
        .enum(['cover', 'contain', 'native'])
        .optional()
        .describe(d('Initial scale vs the composition. Default: cover for large images, native otherwise.', 'Tỉ lệ ban đầu so với composition. Mặc định: cover với ảnh lớn, còn lại native.')),
      repeat: z
        .array(z.number())
        .length(2)
        .optional()
        .describe(d('Texture repeat [repeatX, repeatY] for tiling ground/surface textures.', 'Lặp texture [repeatX, repeatY] để lát nền/bề mặt.')),
      ...layerCommon(d)
    }),
    example: '{"file_path":"D:/assets/sky.png","z":3000,"name":"Sky"}'
  },
  {
    name: 'add_text_layer', cat: 'layers',
    doc: L('Add a text layer (titles, captions).', 'Thêm layer chữ (tiêu đề, phụ đề).'),
    shape: (d) => ({
      text: z.string(),
      font_family: z.string().optional().describe(d('e.g. Montserrat, Inter, Playfair Display, Bebas Neue, JetBrains Mono', 'VD: Montserrat, Inter, Playfair Display, Bebas Neue, JetBrains Mono')),
      font_size: z.number().optional(),
      font_weight: z.number().optional(),
      color: z.string().optional(),
      letter_spacing: z.number().optional(),
      shadow: z.boolean().optional(),
      ...layerCommon(d)
    })
  },
  {
    name: 'add_solid_layer', cat: 'layers',
    doc: L(
      'Add a solid color or vertical gradient plane (backgrounds, color washes). Added at the bottom of the shot stack.',
      'Thêm mặt phẳng màu đặc hoặc gradient dọc (nền, phủ màu). Được thêm ở đáy chồng layer của shot.'
    ),
    shape: (d) => ({
      color: z.string().optional(),
      color2: z.string().optional(),
      gradient: z.boolean().optional(),
      pattern: z.enum(['none', 'grid', 'stripes', 'dots']).optional(),
      grid_size: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      ...layerCommon(d)
    })
  },
  {
    name: 'add_ground_layer', cat: 'layers',
    doc: L(
      'Add a horizontal 3D ground plane / floor (rotated -90deg on X, placed below the camera). Creates deep authentic perspective for dolly and pan shots.',
      'Thêm mặt sàn/mặt đất 3D nằm ngang (xoay -90° trục X, đặt dưới camera). Tạo phối cảnh sâu chân thực cho cú dolly và pan.'
    ),
    shape: (d) => ({
      color: z.string().optional().describe(d('Top color / gradient start.', 'Màu trên / điểm đầu gradient.')),
      color2: z.string().optional().describe(d('Bottom color / gradient end.', 'Màu dưới / điểm cuối gradient.')),
      gradient: z.boolean().optional(),
      pattern: z.enum(['none', 'grid', 'stripes', 'dots']).optional().describe(d('Pattern to show perspective (grid, stripes, dots).', 'Hoa văn thể hiện phối cảnh (lưới, sọc, chấm).')),
      grid_size: z.number().optional().describe(d('Size of grid squares in pixels (default 45).', 'Kích thước ô lưới tính bằng pixel (mặc định 45).')),
      width: z.number().optional(),
      height: z.number().optional(),
      ...layerCommon(d)
    })
  },
  {
    name: 'add_particles', cat: 'layers',
    doc: L('Add a particle field (fireflies, snow, dust, embers). Deterministic for a given seed.', 'Thêm trường hạt (đom đóm, tuyết, bụi, tàn lửa). Kết quả cố định với cùng seed.'),
    shape: (d) => ({
      count: z.number().int().optional(),
      seed: z.number().int().optional(),
      size: z.number().optional(),
      color: z.string().optional(),
      area: vec3.optional().describe(d('Emission box size in world units.', 'Kích thước hộp phát hạt theo đơn vị world.')),
      velocity: vec3.optional().describe(d('Units per second; snow ≈ [0, -40, 0].', 'Đơn vị/giây; tuyết ≈ [0, -40, 0].')),
      sway: z.number().optional(),
      twinkle: z.boolean().optional(),
      glow: z.boolean().optional(),
      ...layerCommon(d)
    })
  },
  {
    name: 'update_layer', cat: 'layers',
    doc: L(
      'Change a layer, matching viewport XYZ translation, rotation rings (degrees), and bounding-box scale handles (scalar or [x,y,z] multipliers). Transform values follow After Effects rules: animated properties get a keyframe at the current time (or at_time); static ones change value. props = raw prop overrides (text, color, fontSize…).',
      'Sửa một layer, tương ứng gizmo viewport: dịch XYZ, vòng xoay (độ), tay nắm co giãn (số hoặc hệ số [x,y,z]). Theo quy tắc After Effects: thuộc tính đã animate được thêm keyframe tại thời điểm hiện tại (hoặc at_time); thuộc tính tĩnh thì đổi giá trị. props = ghi đè thuộc tính thô (text, color, fontSize…).'
    ),
    shape: (d) => ({
      layer_id: z.string(),
      ...layerCommon(d),
      locked: z.boolean().optional(),
      props: z.record(z.string(), z.any()).optional(),
      text: z.string().optional(),
      color: z.string().optional(),
      font_size: z.number().optional(),
      at_time: atTime(d),
      ease: ease.optional()
    }),
    example: '{"layer_id":"layer-1","rotation":[0,0,30],"scale":[1.5,0.8,1]}'
  },
  { name: 'delete_layer', cat: 'layers', doc: L('Delete a layer.', 'Xóa một layer.'), shape: () => ({ layer_id: z.string() }) },
  {
    name: 'move_layer', cat: 'layers',
    doc: L('Move a layer up/down in its shot stack (affects draw order at equal depth).', 'Đưa layer lên/xuống trong chồng layer của shot (ảnh hưởng thứ tự vẽ khi cùng độ sâu).'),
    shape: () => ({ layer_id: z.string(), direction: z.enum(['up', 'down']) })
  },
  {
    name: 'split_layer', cat: 'layers',
    doc: L('Split a layer into two contiguous segments at a given time (default: current playhead time).', 'Cắt layer thành 2 đoạn liền nhau tại một thời điểm (mặc định: vị trí playhead).'),
    shape: (d) => ({
      layer_id: z.string(),
      time: z.number().optional().describe(d('Cut time in seconds (default: current playhead time).', 'Thời điểm cắt, giây (mặc định: vị trí playhead).'))
    }),
    example: '{"layer_id":"layer-1","time":2.5}'
  },
  {
    name: 'replace_layer_asset', cat: 'layers',
    doc: L(
      'Replace the source image asset of an image layer while preserving all 3D transforms, Z-depth, keyframes, in/out points, and effects.',
      'Thay ảnh nguồn của layer ảnh, giữ nguyên mọi biến đổi 3D, độ sâu Z, keyframe, điểm in/out và hiệu ứng.'
    ),
    shape: (d) => ({
      layer_id: z.string().describe(d('Layer ID to update.', 'Id layer cần cập nhật.')),
      asset_id: z.string().describe(d('New asset ID or asset name in project assets.', 'Id hoặc tên asset mới trong dự án.'))
    })
  }
]
