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
      rig: z.object({
        bones: z.array(z.object({ id: z.string(), name: z.string(), parentId: z.string().optional(),
          x: z.number(), y: z.number(), length: z.number(), angle: z.number() })),
        duration: z.number().min(0.1).max(120), loop: z.boolean(),
        tracks: z.record(z.array(z.object({ time: z.number(), x: z.number(), y: z.number(), rotation: z.number(),
          scaleX: z.number().optional(), scaleY: z.number().optional(), easing: z.enum(['smooth', 'linear', 'hold']) })))
      }).optional().describe(d('Complete skeleton and animation tracks to save with the cutout layers.', 'Toàn bộ khung xương và các track hoạt ảnh cần lưu cùng các mảnh layer.')),
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
            scaleX: z.number().optional(),
            scaleY: z.number().optional(),
            boneId: z.string().optional(),
            bindingMode: z.enum(['rigid', 'soft']).optional(),
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
    name: 'export_layer_composite_json',
    cat: 'layer_assembly',
    doc: L(
      'Export a 2.5D layer composite preset to JSON string with its depth stack, bone rig, and reusable asset aliases table.',
      'Xuất mẫu cụm layer 2.5D ra chuỗi JSON kèm phân tầng độ sâu, khung xương rig và bảng nhãn tài nguyên (asset aliases).'
    ),
    shape: (d) => ({
      id: z.string().optional().describe(d('Composite ID (defaults to active session composite).', 'ID cụm layer (mặc định: cụm của phiên đang mở).')),
      composite_id: z.string().optional().describe(d('Alias for id.', 'Bí danh của id.')),
      pretty: z.boolean().optional().describe(d('Format JSON with indentation (default true).', 'Định dạng JSON có thụt dòng (mặc định true).'))
    }),
    example: '{"id":"comp-bonsai-zen"}'
  },
  {
    name: 'import_layer_composite_json',
    cat: 'layer_assembly',
    doc: L(
      'Import a 2.5D layer composite preset from a JSON string or file with layered parts, bone armature, and asset aliases table.',
      'Nhập một mẫu cụm layer 2.5D từ chuỗi hoặc file JSON kèm các lớp xếp chồng, khung xương và bảng asset aliases.'
    ),
    shape: (d) => ({
      json: z.string().optional().describe(d('JSON string or object containing the composite definition.', 'Chuỗi hoặc đối tượng JSON định nghĩa cụm layer.')),
      file_path: z.string().optional().describe(d('Path to a .composite.json file on disk.', 'Đường dẫn file .composite.json trên ổ đĩa.'))
    }),
    example: '{"file_path":"assets/character_cutout_demo/character.composite.json"}'
  },
  {
    name: 'set_layer_composite_asset_alias',
    cat: 'layer_assembly',
    doc: L(
      'Define or update an asset alias in a 2.5D layer composite\'s asset table. All cutout layers using "@alias" will resolve to this image path.',
      'Định nghĩa hoặc cập nhật nhãn tài nguyên trong bảng asset của cụm layer 2.5D. Mọi layer dùng "@alias" sẽ dùng ảnh theo đường dẫn này.'
    ),
    shape: (d) => ({
      alias: z.string().describe(d('Asset alias key (e.g. "@head" or "head").', 'Tên nhãn alias của tài nguyên (vd: "@head" hoặc "head").')),
      path: z.string().describe(d('Relative asset image path.', 'Đường dẫn ảnh tương đối.')),
      composite_id: z.string().optional().describe(d('Target composite ID (defaults to active workshop composite).', 'ID cụm layer đích (mặc định: cụm của phiên đang mở).'))
    }),
    example: '{"composite_id":"comp-bonsai-zen","alias":"@leaf","path":"nature/bonsai_leaves.png"}'
  },
  {
    name: 'replace_layer_composite_asset_path',
    cat: 'layer_assembly',
    doc: L(
      'Batch replace an image path in a 2.5D layer composite\'s asset table and layers.',
      'Thay thế hàng loạt một đường dẫn ảnh trong bảng asset và các layer của cụm layer 2.5D.'
    ),
    shape: (d) => ({
      old_path: z.string().describe(d('Existing image path to replace.', 'Đường dẫn ảnh cũ cần thay thế.')),
      new_path: z.string().describe(d('New image path to apply.', 'Đường dẫn ảnh mới áp dụng.')),
      composite_id: z.string().optional().describe(d('Target composite ID (defaults to active workshop composite).', 'ID cụm layer đích (mặc định: cụm của phiên đang mở).'))
    }),
    example: '{"old_path":"arm_left_sketch.png","new_path":"arm_left_final.png"}'
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
      'Inspect the current state of the 2.5D Layer Assembly workshop modal (open status, active composite, selected layer, playback time, active tab, selected bone).',
      'Kiểm tra trạng thái hiện tại của modal Xưởng Lắp Ráp Layer 2.5D (đang mở hay không, chi tiết hiện tại, layer đang chọn, thời gian chạy thử, tab đang mở, xương đang chọn).'
    ),
    shape: () => ({}),
    example: '{}'
  },
  {
    name: 'layer_assembly_rig',
    cat: 'layer_assembly',
    doc: L(
      'Manage cutout skeleton bones and keyframe animations in the active layer assembly workshop. Supports adding/updating/deleting bones, binding layers, setting keyframes/poses (set-pose, mirror-pose), adjusting scaleX/scaleY, rich easings (smooth, linear, hold, ease-in, ease-out, ease-in-out), applying humanoid/chain templates, and generating procedural walk/idle/wave/sway motions.',
      'Quản lý hệ thống xương và animation trong xưởng lắp ráp layer. Hỗ trợ thêm/sửa/xóa xương, gắn layer vào xương, ghi keyframe/tạo dáng toàn thân (set-pose, mirror-pose), chỉnh scaleX/scaleY, 6 kiểu nội suy Moho (smooth, linear, hold, ease-in, ease-out, ease-in-out), áp dụng khung xương người/chuỗi uốn dựng sẵn và tự động sinh chuyển động đi bộ/đứng thở/vẫy tay/uốn lượn.'
    ),
    shape: (d) => ({
      action: z
        .enum([
          'add-bone',
          'update-bone',
          'delete-bone',
          'bind',
          'set-key',
          'delete-key',
          'set-pose',
          'mirror-pose',
          'settings',
          'apply-template',
          'apply-preset-animation',
          'clear-animation',
          'add-clip',
          'switch-clip',
          'rename-clip',
          'delete-clip',
          'duplicate-clip',
          'inherit-clip'
        ])
        .describe(d('Rigging or animation action to perform.', 'Hành động tạo xương hoặc animation cần thực hiện.')),
      bone_id: z.string().optional().describe(d('Target bone ID.', 'ID xương mục tiêu.')),
      name: z.string().optional().describe(d('Bone name or clip name.', 'Tên xương hoặc tên clip động tác.')),
      parent_id: z.string().optional().describe(d('Parent bone ID for hierarchical transforms.', 'ID xương cha.')),
      x: z.number().optional().describe(d('Head joint X coordinate in canvas units.', 'Tọa độ X khớp gốc.')),
      y: z.number().optional().describe(d('Head joint Y coordinate in canvas units.', 'Tọa độ Y khớp gốc.')),
      length: z.number().optional().describe(d('Bone length in pixels.', 'Chiều dài xương theo pixel.')),
      angle: z.number().optional().describe(d('Bone angle in degrees (clockwise).', 'Góc xương theo độ.')),
      binding_mode: z.enum(['rigid', 'soft']).optional().describe(d('Bind rigidly or deform the alpha mesh with the selected bone and its descendants.', 'Gắn cứng hoặc uốn mesh alpha theo xương đã chọn và các xương con.')),
      layer_ids: z.array(z.string()).optional().describe(d('Layer IDs to bind to the bone.', 'Danh sách ID layer cần gắn vào xương.')),
      time: z.number().optional().describe(d('Keyframe time in seconds.', 'Thời điểm keyframe tính bằng giây.')),
      rotation: z.number().optional().describe(d('Keyframe rotation angle in degrees.', 'Góc xoay keyframe.')),
      scale_x: z.number().optional().describe(d('Keyframe scale X factor (for squash/stretch or horizontal flip).', 'Tỷ lệ co giãn trục X (squash/stretch hoặc lật ngang).')),
      scale_y: z.number().optional().describe(d('Keyframe scale Y factor.', 'Tỷ lệ co giãn trục Y.')),
      easing: z.enum(['smooth', 'linear', 'hold', 'ease-in', 'ease-out', 'ease-in-out']).optional().describe(d('Keyframe interpolation.', 'Nội suy keyframe.')),
      poses: z
        .array(
          z.object({
            bone_id: z.string().optional(),
            boneId: z.string().optional(),
            x: z.number().optional(),
            y: z.number().optional(),
            rotation: z.number().optional(),
            scale_x: z.number().optional(),
            scaleX: z.number().optional(),
            scale_y: z.number().optional(),
            scaleY: z.number().optional(),
            easing: z.enum(['smooth', 'linear', 'hold', 'ease-in', 'ease-out', 'ease-in-out']).optional()
          })
        )
        .optional()
        .describe(d('List of bone transforms for set-pose action.', 'Danh sách chuyển đổi xương khi dùng hành động set-pose.')),
      duration: z.number().optional().describe(d('Rig animation duration in seconds (0.1–120s).', 'Thời lượng animation (0.1–120s).')),
      template: z
        .enum(['humanoid', 'humanoid-full', 'hand-detailed', 'foot-detailed', 'simple-chain'])
        .optional()
        .describe(d('Skeleton template to apply (humanoid, humanoid-full, hand-detailed, foot-detailed, simple-chain).', 'Mẫu khung xương áp dụng (humanoid, humanoid-full, hand-detailed, foot-detailed, simple-chain).')),
      preset: z
        .enum(['walk', 'idle', 'wave', 'bow', 'run', 'jump', 'action', 'sway', 'hand-clench', 'foot-roll'])
        .optional()
        .describe(d('Procedural motion preset to generate.', 'Chuyển động mẫu tự động sinh.')),
      clip_id: z.string().optional().describe(d('Animation clip ID to switch, duplicate, rename or delete.', 'ID clip động tác cần chuyển, nhân bản, đổi tên hoặc xóa.')),
      clip_name: z.string().optional().describe(d('New clip name when adding, duplicating or inheriting.', 'Tên clip mới khi thêm, nhân bản hoặc kế thừa.')),
      as_new_clip: z.boolean().optional().describe(d('Generate motion preset into a new clip.', 'Tạo chuyển động mẫu thành clip mới độc lập.')),
      source_composite_id: z.string().optional().describe(d('Source composite ID to inherit/retarget animation from.', 'ID mẫu layer nguồn để kế thừa động tác.')),
      source_clip_id: z.string().optional().describe(d('Source clip ID to inherit/retarget from.', 'ID clip nguồn cần kế thừa.'))
    }),
    example: '{"action":"set-pose","time":0.5,"poses":[{"boneId":"arm_l","rotation":45},{"boneId":"arm_r","rotation":-30}]}'
  },
  {
    name: 'set_layer_assembly_playback',
    cat: 'layer_assembly',
    doc: L(
      'Control playback and scrubber time inside the 2.5D Layer Assembly workshop.',
      'Điều khiển phát thử và tua mốc thời gian trong Xưởng Lắp Ráp Layer 2.5D.'
    ),
    shape: (d) => ({
      time: z.number().optional().describe(d('Playback time in seconds.', 'Thời điểm tua đến (giây).')),
      playing: z.boolean().optional().describe(d('Whether animation playback is playing.', 'Bật hoặc tạm dừng phát thử.'))
    }),
    example: '{"time":0.5,"playing":true}'
  },
  {
    name: 'set_layer_assembly_panel',
    cat: 'layer_assembly',
    doc: L(
      'Switch between the 3 inspector tabs (layers, bones, animation) and select active bone in the workshop.',
      'Chuyển đổi giữa 3 tab cột phải (layers, bones, animation) và chọn xương kích hoạt trong xưởng.'
    ),
    shape: (d) => ({
      tab: z.enum(['layers', 'bones', 'animation']).describe(d('Active right panel tab.', 'Tab cột phải cần mở.')),
      bone_id: z.string().optional().describe(d('Optional bone ID to select.', 'ID xương cần chọn.'))
    }),
    example: '{"tab":"animation"}'
  },
  {
    name: 'add_layer_assembly_layer',
    cat: 'layer_assembly',
    doc: L(
      'Add a new layer item into the active 2.5D Layer Assembly workshop.',
      'Thêm một layer mới vào Xưởng Lắp Ráp Layer 2.5D đang mở.'
    ),
    shape: (d) => ({
      patch: z.record(z.unknown()).optional().describe(d('Initial layer properties (name, assetPath, x, y, z, scale, rotation, motion).', 'Thuộc tính ban đầu của layer.'))
    }),
    example: '{"patch":{"name":"Cánh tay","x":-30,"y":-40}}'
  },
  {
    name: 'update_layer_assembly_layer',
    cat: 'layer_assembly',
    doc: L(
      'Update properties of an existing layer in the active 2.5D Layer Assembly workshop.',
      'Cập nhật thuộc tính của một layer đang có trong Xưởng Lắp Ráp Layer 2.5D đang mở.'
    ),
    shape: (d) => ({
      layer_id: z.string().describe(d('Target layer ID.', 'ID của layer cần sửa.')),
      patch: z.record(z.unknown()).describe(d('Layer patch properties.', 'Các thuộc tính cần cập nhật.'))
    }),
    example: '{"layer_id":"l1","patch":{"scale":1.2,"rotation":15}}'
  },
  {
    name: 'reorder_layer_assembly_layer',
    cat: 'layer_assembly',
    doc: L(
      'Move a layer up or down in the workshop stack order.',
      'Đổi thứ tự hiển thị của một layer lên hoặc xuống trong xưởng.'
    ),
    shape: (d) => ({
      layer_id: z.string().describe(d('Layer ID to move.', 'ID của layer cần đổi thứ tự.')),
      direction: z.enum(['up', 'down']).describe(d('Direction to move.', 'Hướng di chuyển (up hoặc down).'))
    }),
    example: '{"layer_id":"l1","direction":"up"}'
  },
  {
    name: 'update_layer_assembly',
    cat: 'layer_assembly',
    doc: L(
      'Update top-level composite properties (name, description, category, width, height, lighting) in the active workshop.',
      'Cập nhật thông tin chi tiết mẫu lắp ráp (tên, mô tả, danh mục, kích thước khung, ánh sáng) trong xưởng đang mở.'
    ),
    shape: (d) => ({
      patch: z.record(z.unknown()).describe(d('Composite patch properties.', 'Các thuộc tính cần cập nhật.'))
    }),
    example: '{"patch":{"name":"Nhân vật hiệp sĩ","width":700,"height":800}}'
  },
  {
    name: 'load_layer_assembly',
    cat: 'layer_assembly',
    doc: L(
      'Load a composite preset from storage into the active workshop, or start a new blank composite.',
      'Nạp một mẫu cụm layer từ kho lưu trữ vào xưởng, hoặc tạo mẫu mới.'
    ),
    shape: (d) => ({
      composite_id: z.string().optional().describe(d('Composite preset ID to load.', 'ID mẫu cần nạp.')),
      mode: z.enum(['replace', 'append', 'new']).optional().describe(d('Load mode: replace current, append layers, or start fresh new.', 'Chế độ nạp: thay thế, ghép thêm hoặc tạo mới.'))
    }),
    example: '{"composite_id":"comp-bonsai-zen","mode":"replace"}'
  },
  {
    name: 'list_layer_assembly_templates',
    cat: 'layer_assembly',
    doc: L(
      'List pre-configured 2.5D layer assembly templates (13-part 1:1 native scale anime cutout characters with faceless head, glasses and swappable expressions; modular canopy tree, modular mossy rock & crystals, and 5-layer zen bonsai) with layer slots, bone rigs, animation clips and AI generation prompts.',
      'Liệt kê các mẫu khung lắp ráp layer 2.5D dựng sẵn (nhân vật anime 2.5D bóc tách 13 mảnh tỉ lệ gốc 1:1 gồm đầu trơn kèm tóc, mắt kính rời và biểu cảm thay thế; cây đại thụ bóc tách, cụm đá rêu phong & tinh thể, cây bonsai cổ thụ đung đưa) kèm danh sách bộ phận, xương rig, hoạt ảnh và prompt tạo ảnh AI.'
    ),
    shape: (d) => ({
      category: z.enum(['all', 'character', 'animal', 'nature', 'prop', 'architecture']).optional().describe(d('Filter by category.', 'Lọc theo danh mục.')),
      search: z.string().optional().describe(d('Search query across template names and descriptions.', 'Từ khóa tìm kiếm theo tên hoặc mô tả mẫu.'))
    }),
    example: '{"category":"character"}'
  },
  {
    name: 'get_layer_assembly_template',
    cat: 'layer_assembly',
    doc: L(
      'Get full configuration of a layer assembly template by ID, including slot coordinates, bone armature, animation clips, and the complete AI generation prompt for sprite atlas cutouts (optionally customized with user appearance, costume and props descriptions).',
      'Lấy cấu hình chi tiết một mẫu lắp ráp layer theo ID, gồm danh sách slot bộ phận, khung xương rig, các hoạt ảnh chuyển động và toàn văn prompt tạo ảnh sprite atlas chuẩn AI (hỗ trợ gắn kèm mô tả tướng mạo, quần áo và phụ kiện tùy chỉnh).'
    ),
    shape: (d) => ({
      template_id: z.string().describe(d('Template ID from list_layer_assembly_templates (e.g. "tmpl-character-front", "tmpl-character-quarter", "tmpl-nature-modular-tree", "tmpl-nature-modular-rock", "tmpl-nature-bonsai").', 'ID mẫu từ list_layer_assembly_templates (vd "tmpl-character-front", "tmpl-character-quarter", "tmpl-nature-modular-tree", "tmpl-nature-modular-rock", "tmpl-nature-bonsai").')),
      appearance: z.string().optional().describe(d('Custom character appearance, facial expression, or hairstyle to inject into the AI prompt.', 'Mô tả tướng mạo, khuôn mặt, kiểu tóc hoặc biểu cảm nhân vật để gắn vào prompt AI.')),
      costume: z.string().optional().describe(d('Custom outfit, clothing, robe, armor, or footwear to inject into the AI prompt.', 'Mô tả quần áo, trang phục, đạo bào hoặc giày dép để gắn vào prompt AI.')),
      props: z.string().optional().describe(d('Custom accessories, headwear, glasses, beard, mask, or handheld weapon to inject into the AI prompt.', 'Mô tả phụ kiện hoá trang (mũ, kính, râu, mặt nạ) hoặc vũ khí cầm tay để gắn vào prompt AI.')),
      reference_mode: z.enum(['layout', 'disassemble', 'none']).optional().describe(d('Character templates only. Role of the attached image: "layout" (default) = layout reference only, create a completely NEW character without copying the reference; "disassemble" = the attached image IS the character to split into parts (2-step workflow); "none" = text-only prompt.', 'Chỉ cho mẫu nhân vật. Vai trò ảnh đính kèm: "layout" (mặc định) = ảnh chỉ tham khảo bố cục, tạo nhân vật MỚI không chép ảnh mẫu; "disassemble" = ảnh đính kèm CHÍNH LÀ nhân vật cần tách bộ phận (quy trình 2 bước); "none" = chỉ dùng prompt chữ.')),
      part_group: z.enum(['all', 'head', 'upper', 'lower']).optional().describe(d('Character templates only. Generate only one part group (head / upper body / lower body) per pass so occluded areas are drawn more completely. Default "all".', 'Chỉ cho mẫu nhân vật. Mỗi lần chỉ tạo một nhóm bộ phận (đầu / thân trên / thân dưới) để phần bị che được vẽ đầy đủ hơn. Mặc định "all".'))
    }),
    example: '{"template_id":"tmpl-character-front","reference_mode":"layout","appearance":"Gender: male. Hair: messy short ginger hair. Eyes: sharp amber eyes.","costume":"Dark green hooded jacket, black cargo pants, white sneakers"}'
  },
  {
    name: 'apply_layer_assembly_template',
    cat: 'layer_assembly',
    doc: L(
      'Apply a 2.5D layer assembly template into the workshop or save as a new composite preset, binding slot images automatically from provided asset paths.',
      'Áp dụng mẫu lắp ráp layer 2.5D vào xưởng hoặc lưu thành mẫu mới, tự động gắn ảnh các bộ phận theo đường dẫn cung cấp.'
    ),
    shape: (d) => ({
      template_id: z.string().describe(d('Template ID to instantiate.', 'ID mẫu lắp ráp cần áp dụng.')),
      name: z.string().optional().describe(d('Custom display name for the composite.', 'Tên tùy chỉnh cho cụm layer.')),
      images: z.record(z.string()).optional().describe(d('Map of slot ID, role, or cell index to image asset path or data URL.', 'Bản đồ ánh xạ ID bộ phận hoặc số ô atlas sang đường dẫn ảnh.')),
      open_workshop: z.boolean().optional().describe(d('Whether to open the layer workshop modal (default true).', 'Có mở giao diện xưởng lắp ráp layer hay không (mặc định true).')),
      save_to_library: z.boolean().optional().describe(d('Whether to persist into stored composites library (default false).', 'Có lưu vào danh sách mẫu của dự án hay không (mặc định false).'))
    }),
    example: '{"template_id":"tmpl-character-quarter","open_workshop":true}'
  }
]

