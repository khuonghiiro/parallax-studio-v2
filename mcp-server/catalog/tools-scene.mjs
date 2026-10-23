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
      'Screenshot of the app window or a targeted UI element/region (e.g. left_panel, timeline, inspector, viewer, dialog). Use region or selector to capture only the relevant area and save tokens; omit to capture the whole window.',
      'Chụp ảnh cửa sổ app hoặc vùng/phần tử UI cụ thể (ví dụ left_panel, timeline, inspector, viewer, dialog). Dùng region hoặc selector để chỉ chụp đúng vùng cần thiết, tối ưu token; không truyền sẽ chụp toàn bộ.'
    ),
    shape: (d) => ({
      region: z.enum(['viewer_stage2d_tools', 'viewer_depth', 'viewer_stage2d', 'timeline_logic', 'timeline_logic_picker',
        'active',
        'left_panel', 'assets', 'asset_grid', 'asset_bar', 'music', 'shots', 'topview',
        'viewer', 'viewer_canvas', 'viewport', 'camera_frame', 'viewer_hud', 'viewer_tools', 'animate_camera_stage', 'animate_camera_toolbar', 'animate_camera_route', 'animate_camera_inspector',
        'inspector', 'inspector_tabs', 'inspector_body', 'inspector_composite', 'inspector_physics', 'inspector_virtual_light', 'composite_swap', 'effect_stack', 'effect_editor', 'timeline_effects', 'fx_presets', 'motion', 'motion_preview', 'motion_parameters', 'motion_timing',
        'timeline', 'timeline_toolbar', 'timeline_tabs', 'timeline_ruler', 'timeline_tracks',
        'timeline_workflow', 'workflow_toolbar', 'workflow_palette', 'workflow_canvas', 'workflow_canvas_hud', 'workflow_quick_connect', 'workflow_inspector', 'workflow_target_binder', 'workflow_action_builder', 'workflow_preview', 'workflow_json_panel', 'workflow_node_config', 'workflow_node_input', 'workflow_node_output', 'workflow_node_connections', 'workflow_node_operation', 'workflow_node_scope_picker', 'workflow_node_edit_context', 'workflow_node_advanced', 'workflow_node_preview_controls', 'workflow_node_preset_picker', 'workflow_node_rule_picker', 'workflow_node_camera_preview', 'workflow_node_settings',
        'toolbar', 'studio_menu', 'mcp_chip', 'responsive_dock',
        'dialog',
        'assembly_3d', 'assembly_sidebar', 'assembly_viewport', 'assembly_inspector', 'assembly_header', 'assembly_footer', 'assembly_hud',
        'layer_assembly', 'layer_assembly_sidebar', 'layer_assembly_workspace', 'layer_assembly_inspector', 'layer_assembly_tools', 'layer_assembly_header',
        'layer_assembly_toolbar', 'layer_assembly_viewport_2d', 'layer_assembly_viewport_3d', 'layer_assembly_layers', 'layer_assembly_parts',
        'layer_assembly_properties', 'layer_assembly_physics', 'layer_assembly_swap', 'layer_assembly_rig_panel', 'layer_assembly_mixamo_card', 'layer_assembly_mixamo_studio',
        'layer_assembly_mixamo_header', 'layer_assembly_mixamo_stage', 'layer_assembly_mixamo_toolbar', 'layer_assembly_mixamo_canvas', 'layer_assembly_mixamo_coords', 'layer_assembly_mixamo_guide',
        'layer_assembly_mixamo_sidebar', 'layer_assembly_mixamo_preview', 'layer_assembly_mixamo_angles', 'layer_assembly_mixamo_presets', 'layer_assembly_mixamo_settings', 'layer_assembly_mixamo_footer',
        'layer_assembly_animation_panel', 'layer_assembly_retarget', 'layer_assembly_create', 'layer_assembly_confirm',
        'layer_assembly_cutter', 'layer_assembly_source', 'layer_assembly_target', 'layer_assembly_motion_sketch',
        'layer_assembly_anim_tools', 'layer_assembly_anim_chips', 'layer_assembly_anim_assist', 'layer_assembly_anim_secondary',
        'layer_assembly_plant_motion', 'layer_assembly_plant_chips', 'layer_assembly_plant_panel', 'layer_assembly_pose_tools', 'layer_assembly_plant_graph',
        'audio_studio', 'audio_studio_sidebar', 'audio_studio_editor', 'audio_studio_waveform', 'audio_studio_tone', 'audio_studio_mixer', 'audio_studio_console',
        'perf_dialog', 'perf_hardware', 'perf_meter', 'perf_settings',
        'export', 'export_dialog', 'export_preview',
        'camera_sketch', 'camera_sketch_canvas', 'camera_sketch_sidebar', 'camera_sketch_waypoints',
        'camera_path', 'camera_path_presets', 'camera_path_steps',
        'mcp_dialog', 'mcp_status', 'mcp_config', 'mcp_guide',
        'ai_hud', 'window'
      ]).optional().describe(d('Predefined UI region to capture. Use "active" to capture the TOPMOST open dialog automatically (e.g. Studio Mixamo opened inside the Layer Workshop) instead of the whole window; "dialog" also picks the topmost dialog. Sub-regions (e.g. layer_assembly_mixamo_stage, layer_assembly_parts, audio_studio_waveform) crop a single control to save tokens. Any element with data-mcp-region="<name>" is matched automatically.', 'Vùng UI định sẵn cần chụp. Dùng "active" để tự chụp đúng dialog đang mở TRÊN CÙNG (VD Studio Mixamo mở bên trong Xưởng Layer) thay vì cả cửa sổ; "dialog" cũng chọn dialog trên cùng. Vùng con (VD layer_assembly_mixamo_stage, layer_assembly_parts, audio_studio_waveform) chỉ cắt đúng một control để tiết kiệm token. Mọi phần tử có data-mcp-region="<tên>" đều tự khớp.')),
      selector: z.string().optional().describe(d('CSS selector of a specific element to capture (e.g. ".music-panel-layout", "#music-tab-add-btn"). Falls back to whole window if not found.', 'CSS selector của phần tử cụ thể cần chụp. Tự động chụp toàn bộ app nếu không tìm thấy selector.')),
      padding: z.number().int().min(0).max(200).optional().describe(d('Padding in pixels around the targeted element/region (default: 8).', 'Khoảng cách viền đệm xung quanh vùng cần chụp (mặc định: 8px).')),
      width: z.number().int().min(64).max(3840).optional().describe(d('Downscale to this width (default: native).', 'Thu nhỏ về bề rộng này (mặc định: kích thước gốc).')),
      format: z.enum(['png', 'jpeg']).optional(),
      delay_ms: z.number().int().min(0).max(5000).optional().describe(d('Wait before capturing so UI transitions finish (default 150).', 'Chờ trước khi chụp để hiệu ứng UI chạy xong (mặc định 150).'))
    }),
    example: '{"region":"left_panel"}'
  },
  {
    name: 'get_ui_state', cat: 'inspect',
    doc: L(
      'Inspect current UI state: active dialog/modal, Audio Studio mode, left sidebar tab, right inspector tab, timeline/workflow tab, viewer split/mode, open workshops, and active theme (dark/light).',
      'Tra cứu trạng thái giao diện hiện tại: hộp thoại/modal đang mở, tab Phòng thu âm thanh, tab thanh bên trái, tab thanh tra bên phải, tab Timeline/Workflow, chế độ khung xem, các xưởng đang mở và giao diện sáng/tối.'
    ),
    shape: () => ({}),
    example: '{}'
  },
  {
    name: 'set_ui_dialog', cat: 'inspect',
    doc: L(
      'Open, switch, or close any UI dialog/workshop (Camera Path, Camera Sketch, Audio Studio, Performance, Export, MCP, 3D Assembly, 2.5D Layer Assembly), switch sidebar/inspector/timeline tabs, or toggle dark/light theme.',
      'Mở, chuyển đổi hoặc đóng bất kỳ hộp thoại/xưởng UI nào (Lộ trình Camera, Vẽ đường bay, Phòng thu Âm thanh, Hiệu năng, Xuất MP4, MCP, Xưởng 3D, Xưởng 2.5D), chuyển tab trái/phải/timeline-workflow hoặc đổi giao diện Tối/Sáng.'
    ),
    shape: (d) => ({
      dialog: z.enum([
        'none', 'path', 'sketch', 'performance', 'mcp', 'audio', 'export', 'assembly_3d', 'layer_assembly', 'layer_assembly_create'
      ]).optional().describe(d('Dialog or workshop to open, or "none" to close all modals.', 'Hộp thoại hoặc xưởng cần mở, hoặc "none" để đóng tất cả hộp thoại.')),
      audio_mode: z.enum(['waveform', 'levels', 'mixer']).optional().describe(d('Audio Studio tab mode when opening or switching Audio Studio.', 'Chế độ tab Phòng thu âm thanh khi mở hoặc chuyển tab (waveform, levels, mixer).')),
      track_id: z.string().optional().describe(d('Audio track ID to select in Audio Studio.', 'ID track âm thanh cần chọn trong Phòng thu.')),
      model_id: z.string().optional().describe(d('3D model ID when opening assembly_3d.', 'ID mô hình 3D khi mở xưởng assembly_3d.')),
      composite_id: z.string().optional().describe(d('2.5D composite ID when opening layer_assembly.', 'ID cụm 2.5D khi mở xưởng layer_assembly.')),
      left_tab: z.enum(['shots', 'assets', 'topview']).optional().describe(d('Switch Left Sidebar tab.', 'Chuyển tab thanh bên trái.')),
      timeline_tab: z.enum(['timeline', 'workflow']).optional().describe(d('Switch bottom panel between Timeline and Workflow Studio tab.', 'Chuyển tab khu vực dưới cùng giữa Timeline và Workflow Studio.')),
      inspector_tab: z.enum(['scene', 'layer', 'camera']).optional().describe(d('Switch Right Inspector tab.', 'Chuyển tab bảng thuộc tính bên phải.')),
      mobile_tab: z.enum(['timeline', 'left', 'right']).optional().describe(d('Switch active workspace dock tab on Tablet/Phone.', 'Chuyển tab vùng làm việc đang mở trên Máy tính bảng/Điện thoại.')),
      theme: z.enum(['dark', 'light']).optional().describe(d('Switch UI theme ("dark" or "light").', 'Đổi giao diện Sáng ("light") hoặc Tối ("dark").'))
    }),
    example: '{"dialog":"path"}'
  },
  {
    name: 'set_ai_lock', cat: 'inspect',
    doc: L(
      'Lock or unlock the UI while the AI is performing multi-step actions. When locked, a glowing neon border appears and user input is disabled to avoid interference.',
      'Khoá hoặc mở khoá UI khi AI đang thực hiện chuỗi thao tác. Khi khoá, viền sáng neon sẽ xuất hiện bao quanh app và vô hiệu hoá thao tác của người dùng để tránh xung đột.'
    ),
    shape: (d) => ({
      locked: z.boolean().describe(d('True to lock UI with neon border, false to unlock.', 'True để khoá UI và bật viền neon, false để mở khoá.')),
      reason: z.string().optional().describe(d('Optional reason or status message shown to user.', 'Lý do hoặc thông điệp trạng thái hiển thị cho người dùng.')),
      timeout_ms: z.number().int().min(500).max(60000).optional().describe(d('Auto-unlock safety timeout in milliseconds (default: 10000).', 'Thời gian tự động mở khoá an toàn tính bằng mili-giây (mặc định: 10000ms).'))
    }),
    example: '{"locked":true,"reason":"AI đang chỉnh sửa cấu hình âm thanh"}'
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
    doc: L(
      'Export the entire current project to a self-contained JSON string or human-friendly declarative scene JSON with asset aliases table.',
      'Xuất toàn bộ dự án hiện tại thành chuỗi JSON độc lập hoặc JSON mô tả cảnh khai báo với bảng nhãn tài nguyên (asset aliases).'
    ),
    shape: (d) => ({
      format: z.enum(['raw', 'declarative']).optional().describe(d('JSON format: "raw" (full internal structure) or "declarative" (clean readable spec with asset aliases table, default "raw").', 'Định dạng JSON: "raw" (cấu trúc nội bộ đầy đủ) hoặc "declarative" (mô tả cảnh gọn gàng kèm bảng nhãn asset, mặc định "raw").')),
      pretty: z.boolean().optional().describe(d('Format JSON with indentation (default true).', 'Định dạng JSON có thụt dòng (mặc định true).'))
    }),
    example: '{"format":"declarative"}'
  },
  {
    name: 'set_project_asset_alias', cat: 'project',
    doc: L(
      'Define or update an asset alias in the project asset table. Shots and layers referencing "@alias" or "alias" will resolve to this path. Updating here re-targets all uses instantly.',
      'Định nghĩa hoặc cập nhật một nhãn asset alias trong bảng tài nguyên của dự án. Các cảnh và layer tham chiếu "@alias" hoặc "alias" sẽ trỏ tới đường dẫn này. Đổi tại đây cập nhật tức thì mọi nơi sử dụng.'
    ),
    shape: (d) => ({
      alias: z.string().describe(d('Asset alias key (e.g. "@hero_head" or "hero_head").', 'Tên nhãn alias của tài nguyên (vd: "@hero_head" hoặc "hero_head").')),
      path: z.string().describe(d('Relative asset file path (e.g. "characters/hero/head.png").', 'Đường dẫn file tài nguyên tương đối (vd: "characters/hero/head.png").'))
    }),
    example: '{"alias":"@hero_head","path":"characters/hero/head_v2.png"}'
  },
  {
    name: 'replace_project_asset_path', cat: 'project',
    doc: L(
      'Batch replace an asset file path across project assets table and layers, updating old asset references to a new path.',
      'Thay thế hàng loạt một đường dẫn file tài nguyên trong bảng assets và các layer của dự án sang đường dẫn mới.'
    ),
    shape: (d) => ({
      old_path: z.string().describe(d('Existing asset path to replace.', 'Đường dẫn asset cũ cần thay thế.')),
      new_path: z.string().describe(d('New asset path to apply.', 'Đường dẫn asset mới áp dụng.'))
    }),
    example: '{"old_path":"tree_4k.png","new_path":"tree_optimized.png"}'
  },
  {
    name: 'get_project_asset_aliases', cat: 'project',
    doc: L(
      'List all defined asset aliases and their mapped paths in the current project.',
      'Liệt kê tất cả các nhãn alias tài nguyên và đường dẫn tương ứng trong dự án hiện tại.'
    ),
    shape: () => ({}),
    example: '{}'
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
      physics: z.record(z.string(), z.any()).optional().describe(d('2.5D material physics, strict Z-depth tolerance (zTolerance), sub-mesh UV region (meshRegion), ground surface (ground_surface), projectile stickOnHit, and cave depth portal (depthPortal).', 'Cấu hình vật lý chất liệu 2.5D, độ lệch Z tương tác (zTolerance), vùng Sub-Mesh UV (meshRegion), mặt đất đỡ (ground_surface), ghim tên (stickOnHit) và cổng độ sâu hang động (depthPortal).')),
      virtual_light: z.record(z.string(), z.any()).optional().describe(d('2.5D Virtual Light configuration (kind: candle, flashlight, bulb, campfire, cave_crystal, magic_orb; windPreset: none, gentle, strong, storm; color, intensity, radius, zReach).', 'Cấu hình công cụ ánh sáng ảo 2.5D (kind: candle, flashlight, bulb, campfire, cave_crystal, magic_orb; windPreset: none, gentle, strong, storm; color, intensity, radius, zReach).')),
      physics_action: z.enum(['punch_light', 'punch_heavy', 'jelly_press', 'wall_vault', 'arrow_shot']).optional().describe(d('Trigger an immediate 2.5D physics interaction or Z-crossing arrow shot at the playhead time.', 'Kích hoạt tương tác vật lý 2.5D hoặc bắn tên xuyên Z tại thời điểm hiện tại.')),
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
  },
  {
    name: 'get_motion_presets', cat: 'layers',
    doc: L(
      'List all After Effects style spatial motion presets (e.g. walk_into_depth, emerge_from_depth, jump_arc, trip_and_fall, cross_screen, floating_hover, dramatic_zoom_in) with descriptions, parameter guides and recommended character action clips.',
      'Liệt kê tất cả các mẫu chuyển động không gian kiểu After Effects (ví dụ: walk_into_depth, emerge_from_depth, jump_arc, trip_and_fall, cross_screen, floating_hover, dramatic_zoom_in) kèm mô tả, gợi ý thông số và clip hành động nhân vật tương thích.'
    ),
    shape: () => ({}),
    example: '{}'
  },
  {
    name: 'get_character_actions', cat: 'layer_assembly',
    doc: L(
      'Inspect available skeletal animation clips, durations, view angles, and suggested multi-step action choreographies for a character or composite prop before planning scene scripts.',
      'Tra cứu danh sách các clip hành động của khung xương, thời lượng, góc nhìn và gợi ý phối hợp kịch bản chuỗi hành động cho nhân vật hoặc cụm chi tiết trước khi lên kịch bản cảnh phim.'
    ),
    shape: (d) => ({
      target_id: z.string().describe(d('Target layer ID or composite instance ID of the character.', 'ID của layer hoặc ID của cụm composite nhân vật.'))
    }),
    example: '{"target_id":"layer-hero"}'
  },
  {
    name: 'apply_motion_preset', cat: 'layers',
    doc: L(
      'Apply an After Effects style spatial motion preset to a layer, 3D assembled model, or multi-layer character composite. For "walk_into_depth", the subject moves deep into 3D perspective space (Z increases), automatically shrinks scale, and fades opacity to 0 at the end to vanish into the deep forest or mist.',
      'Gắn mẫu chuyển động không gian kiểu After Effects cho layer, mô hình 3D hoặc cụm nhân vật. Với "walk_into_depth", đối tượng di chuyển sâu vào không gian phối cảnh 3D (Z tăng mạnh), tự động thu nhỏ scale và giảm dần opacity về 0 ở cuối để biến mất vào rừng sâu hoặc sương mù.'
    ),
    shape: (d) => ({
      target_id: z.string().describe(d('Layer ID, composite instance ID, or model3d instance ID to animate.', 'ID layer, ID cụm composite hoặc ID khối 3D cần tạo chuyển động.')),
      preset: z.enum([
        'walk_into_depth',
        'emerge_from_depth',
        'jump_arc',
        'trip_and_fall',
        'cross_screen',
        'floating_hover',
        'dramatic_zoom_in',
        'retreat_disappear'
      ]).describe(d('Motion preset ID.', 'Mã mẫu chuyển động.')),
      time: z.number().optional().describe(d('Start time in seconds (default: current playhead time).', 'Thời điểm bắt đầu tính bằng giây (mặc định: vị trí playhead).')),
      duration: z.number().positive().optional().describe(d('Duration of the motion in seconds.', 'Thời lượng chuyển động tính bằng giây.')),
      depth_z: z.number().optional().describe(d('Depth delta Z in 3D world units (default: preset guide, e.g. +2400 for deep forest).', 'Độ dời trục sâu Z theo đơn vị thế giới 3D (mặc định theo preset, vd: +2400 khi vào rừng sâu).')),
      delta_x: z.number().optional().describe(d('Horizontal displacement in pixels.', 'Độ dời ngang tính bằng pixel.')),
      delta_y: z.number().optional().describe(d('Vertical displacement in pixels.', 'Độ dời dọc tính bằng pixel.')),
      jump_height: z.number().optional().describe(d('Jump peak height in pixels (for jump_arc, default 180).', 'Độ cao đỉnh nhảy tính bằng pixel (cho jump_arc, mặc định 180).')),
      end_scale: z.number().positive().optional().describe(d('Target end scale multiplier (e.g. 0.08 to shrink into tiny distance).', 'Hệ số tỉ lệ thu nhỏ/phóng to ở đích đến (vd: 0.08 để thu nhỏ li ti về xa).')),
      fade_opacity: z.boolean().optional().describe(d('Whether to fade opacity to 0 when moving deep into distance (default true for walk_into_depth).', 'Có làm mờ dần opacity về 0 khi đi vào sâu hay không (mặc định true cho walk_into_depth).'))
    }),
    example: '{"target_id":"layer-hero","preset":"walk_into_depth","duration":3.5,"depth_z":2500}'
  },
  {
    name: 'choreograph_motion_sequence', cat: 'layers',
    doc: L(
      'Choreograph a multi-step timeline action script combining After Effects spatial motion trajectories with character skeletal clips (e.g. walk 3s deep into the forest -> jump over stream 1.4s -> trip & fall 1.8s -> fade out). Each step automatically connects seamlessly from the previous end position.',
      'Lên kịch bản chuỗi hành động phối hợp theo trục thời gian, kết hợp quỹ đạo không gian kiểu After Effects với các clip hành động khung xương của nhân vật (ví dụ: đi bộ 3s vào sâu trong rừng -> nhảy qua suối 1.4s -> vấp ngã 1.8s -> mờ biến mất). Mỗi bước tự động nối tiếp mượt mà từ vị trí kết thúc của bước trước.'
    ),
    shape: (d) => ({
      target_id: z.string().describe(d('Layer ID, composite instance ID, or model instance ID.', 'ID layer, ID cụm composite hoặc ID khối 3D.')),
      start_time: z.number().optional().describe(d('Start time of the sequence in seconds (default: current playhead time).', 'Thời điểm bắt đầu chuỗi hành động tính bằng giây (mặc định: vị trí playhead).')),
      steps: z.array(z.object({
        name: z.string().optional().describe(d('Step title or label.', 'Tên hoặc nhãn mô tả bước.')),
        duration: z.number().positive().describe(d('Duration of this action step in seconds.', 'Thời lượng bước hành động tính bằng giây.')),
        motion_preset: z.enum([
          'walk_into_depth',
          'emerge_from_depth',
          'jump_arc',
          'trip_and_fall',
          'cross_screen',
          'floating_hover',
          'dramatic_zoom_in',
          'retreat_disappear'
        ]).optional().describe(d('After Effects spatial motion trajectory preset.', 'Mẫu quỹ đạo chuyển động không gian After Effects.')),
        action_clip: z.string().optional().describe(d('Skeletal clip name from get_character_actions (e.g. "walk", "jump", "fall", "idle", "action").', 'Tên clip hành động xương từ get_character_actions (vd: "walk", "jump", "fall", "idle", "action").')),
        delta_x: z.number().optional().describe(d('Horizontal displacement in pixels.', 'Độ dời ngang tính bằng pixel.')),
        delta_y: z.number().optional().describe(d('Vertical displacement in pixels.', 'Độ dời dọc tính bằng pixel.')),
        depth_z: z.number().optional().describe(d('Depth delta Z in world units.', 'Độ dời độ sâu Z theo đơn vị thế giới.')),
        jump_height: z.number().optional().describe(d('Jump arc height in pixels.', 'Độ cao vồng nhảy tính bằng pixel.')),
        to_opacity: z.number().min(0).max(1).optional().describe(d('Target opacity at step end.', 'Độ mờ đục mục tiêu ở cuối bước.')),
        fade_opacity: z.boolean().optional().describe(d('Whether to fade out opacity to 0.', 'Có làm mờ dần opacity về 0 hay không.'))
      })).describe(d('Sequential action and motion steps list.', 'Danh sách các bước hành động và chuyển động nối tiếp nhau.'))
    }),
    example: '{"target_id":"layer-hero","steps":[{"motion_preset":"walk_into_depth","action_clip":"walk","duration":3.0,"depth_z":2000},{"motion_preset":"jump_arc","action_clip":"jump","duration":1.4,"jump_height":150},{"motion_preset":"trip_and_fall","action_clip":"fall","duration":1.8}]}'
  }
]
