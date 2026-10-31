/**
 * Tool specs — Layer Assembly workshop (Xưởng Lắp Ráp Layer 2.5D) & multi-layer composites (bilingual, see shared.mjs).
 */
import { L, z } from './shared.mjs'

export const LAYER_COMPOSITE_CATEGORIES = ['nature', 'prop', 'character', 'architecture', 'scene', 'custom']

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
        .enum(['nature', 'prop', 'character', 'architecture', 'scene', 'custom'])
        .optional()
        .describe(d('Category of the composite.', 'Danh mục của chi tiết.')),
      description: z.string().optional().describe(d('Short description of the composite.', 'Mô tả ngắn về chi tiết.')),
      rig: z.object({
        bones: z.array(z.object({
          id: z.string(), name: z.string(), parentId: z.string().optional(),
          x: z.number(), y: z.number(), length: z.number(), angle: z.number()
        })),
        duration: z.number().min(0.1).max(120), loop: z.boolean(),
        tracks: z.record(z.array(z.object({
          time: z.number(), x: z.number(), y: z.number(), rotation: z.number(),
          scaleX: z.number().optional(), scaleY: z.number().optional(), zOrder: z.number().optional(),
          easing: z.enum(['smooth', 'linear', 'hold', 'ease-in', 'ease-out', 'ease-in-out', 'bezier'])
        })))
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
      'Manage cutout skeleton bones and keyframe animations in the active layer assembly workshop. Supports adding/updating/deleting/welding bones (snap-joints), binding layers, setting keyframes/poses (set-pose, mirror-pose, hold-frames F5), animated hierarchical bone Z-Index / layer order (z_order / set-bone-z-order where parent Z-Index changes automatically cascade to all child bones, e.g. arm behind back vs waving in front of chest/face), Moho/Adobe Animate FPS & proportional keyframe retiming (fps, scale_keys), rich easings, applying humanoid/chain templates, and generating view-angle-aware procedural motions (front 0°, diagonal 45°, side 90°).',
      'Quản lý hệ thống xương và animation trong xưởng lắp ráp layer. Hỗ trợ thêm/sửa/xóa/hàn khít khớp xương (snap-joints), gắn layer vào xương, ghi keyframe/tạo dáng/chèn giữ khung F5 (set-pose, mirror-pose, hold-frames), diễn hoạt thứ tự lớp Z-Index phân cấp cha-con (z_order / set-bone-z-order: xương cha tăng/giảm Z-Index thì toàn bộ xương con tự ăn theo, VD để tay sau lưng hay khua tay phía trước ngực/mặt), chỉnh FPS & co giãn key tỷ lệ chuẩn Moho/Adobe Animate (fps, scale_keys), 6 kiểu nội suy, áp dụng khung xương mẫu và tự động sinh chuyển động theo góc nhìn nhân vật (front 0°, diagonal 45°, side 90°).'
    ),
    shape: (d) => ({
      action: z
        .enum([
          'add-bone',
          'update-bone',
          'delete-bone',
          'mirror-bone',
          'bind',
          'set-key',
          'delete-key',
          'delete-keys',
          'move-key',
          'move-keys',
          'set-pose',
          'set-bone-z-order',
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
          'inherit-clip',
          'snap-joints',
          'hold-frames'
        ])
        .describe(d('Rigging or animation action to perform.', 'Hành động tạo xương hoặc animation cần thực hiện.')),
      bone_id: z.string().optional().describe(d('Target bone ID.', 'ID xương mục tiêu.')),
      name: z.string().optional().describe(d('Bone name or clip name.', 'Tên xương hoặc tên clip động tác.')),
      parent_id: z.string().optional().describe(d('Parent bone ID for hierarchical transforms.', 'ID xương cha.')),
      x: z.number().optional().describe(d('Head joint X coordinate in canvas units.', 'Tọa độ X khớp gốc.')),
      y: z.number().optional().describe(d('Head joint Y coordinate in canvas units.', 'Tọa độ Y khớp gốc.')),
      length: z.number().optional().describe(d('Bone length in pixels.', 'Chiều dài xương theo pixel.')),
      angle: z.number().optional().describe(d('Bone angle in degrees (clockwise).', 'Góc xương theo độ.')),
      strength: z.number().min(0.1).max(4).optional().describe(d('Moho Bone Strength / Influence Envelope multiplier (0.1–4.0, default 1.0) controlling Flexi-Bind soft-mesh falloff radius.', 'Hệ số Vùng ảnh hưởng xương chuẩn Moho (0.1–4.0, mặc định 1.0) điều khiển bán kính uốn mềm Flexi-Bind Mesh.')),
      pin: z.boolean().optional().describe(d('Whether this bone is a Moho Pin Bone point anchor (single joint point).', 'Đánh dấu xương là Chốt Pin Bone chuẩn Moho (điểm khớp đơn).')),
      binding_mode: z.enum(['rigid', 'soft']).optional().describe(d('Bind rigidly or deform the alpha mesh with the selected bone and its descendants.', 'Gắn cứng hoặc uốn mesh alpha theo xương đã chọn và các xương con.')),
      layer_ids: z.array(z.string()).optional().describe(d('Layer IDs to bind to the bone.', 'Danh sách ID layer cần gắn vào xương.')),
      time: z.number().optional().describe(d('Keyframe time in seconds.', 'Thời điểm keyframe tính bằng giây.')),
      target_time: z.number().optional().describe(d('move-key: destination keyframe time in seconds.', 'move-key: thời điểm giây đích cần dời keyframe tới.')),
      overwrite: z.boolean().optional().describe(d('move-keys: replace existing non-selected keys at destination timestamps (default false).', 'move-keys: ghi đè lên các key không chọn nằm trùng tại thời điểm đích (mặc định false).')),
      keys: z
        .array(
          z.object({
            bone_id: z.string().optional(),
            boneId: z.string().optional(),
            time: z.number()
          })
        )
        .optional()
        .describe(d('delete-keys: batch list of { bone_id, time } keyframes to remove at once.', 'delete-keys: danh sách hàng loạt các keyframe { bone_id, time } cần xóa cùng lúc.')),
      moves: z
        .array(
          z.object({
            bone_id: z.string().optional(),
            boneId: z.string().optional(),
            time: z.number(),
            target_time: z.number()
          })
        )
        .optional()
        .describe(d('move-keys: batch list of { bone_id, time, target_time } keyframe shifts (e.g. retiming 1.0s to 0.5s while keeping later keys unchanged).', 'move-keys: danh sách dời thời gian hàng loạt { bone_id, time, target_time } (vd kéo mốc 1.0s về 0.5s mà vẫn giữ nguyên các mốc sau).')),
      rotation: z.number().optional().describe(d('Keyframe rotation angle in degrees.', 'Góc xoay keyframe.')),
      scale_x: z.number().optional().describe(d('Keyframe scale X factor (for squash/stretch or horizontal flip).', 'Tỷ lệ co giãn trục X (squash/stretch hoặc lật ngang).')),
      scale_y: z.number().optional().describe(d('Keyframe scale Y factor.', 'Tỷ lệ co giãn trục Y.')),
      z_order: z.number().min(-500).max(500).optional().describe(d('Animated hierarchical Z-Index / layer depth offset at this keyframe (+ brings limb forward in front of torso/face, - pushes limb behind back; all descendant child bones automatically inherit parent z_order).', 'Độ lệch thứ tự lớp Z-Index phân cấp tại keyframe này (số dương + đưa chi nổi lên trước thân/mặt, số âm - lùi chi ra sau lưng; toàn bộ xương con tự động kế thừa cộng dồn từ xương cha).')),
      delta_z_order: z.number().min(-500).max(500).optional().describe(d('set-bone-z-order: relative Z-Index step (+10/-10 like keyboard +/- keys).', 'set-bone-z-order: bước tăng/giảm Z-Index tương đối (+10/-10 tương đương phím +/-).')),
      z_preset: z.enum(['behind-back', 'default', 'front-torso', 'front-face']).optional().describe(d('set-bone-z-order: anatomical Z-Index zone preset (behind-back, default, front-torso, front-face).', 'set-bone-z-order: mức Z-Index nhanh theo vùng giải phẫu (behind-back: sau lưng, default: mặc định, front-torso: trước thân, front-face: trước mặt).')),
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
            z_order: z.number().optional(),
            zOrder: z.number().optional(),
            easing: z.enum(['smooth', 'linear', 'hold', 'ease-in', 'ease-out', 'ease-in-out']).optional()
          })
        )
        .optional()
        .describe(d('List of bone transforms for set-pose action.', 'Danh sách chuyển đổi xương khi dùng hành động set-pose.')),
      duration: z.number().optional().describe(d('Rig animation duration in seconds (0.1–120s).', 'Thời lượng animation (0.1–120s).')),
      fps: z.number().int().min(4).max(120).optional().describe(d('Clip frame rate in frames per second (12, 24, 30, 60; default 30).', 'Tốc độ khung hình của clip (12, 24, 30, 60 fps; mặc định 30).')),
      scale_keys: z.boolean().optional().describe(d('settings: when true, changing duration proportionally stretches/compresses existing keyframe times instead of clamping.', 'settings: khi bật true, đổi thời lượng sẽ co giãn tỷ lệ các keyframe hiện có thay vì cắt biên.')),
      hold_frames: z.number().min(1).max(300).optional().describe(d('hold-frames (Adobe Animate F5): number of frames to insert/hold at time, shifting subsequent keys forward.', 'hold-frames (Adobe Animate F5): số khung giữ dáng chèn thêm tại time, tự đẩy các keyframe phía sau lùi lại.')),
      hold_seconds: z.number().min(0.01).max(30).optional().describe(d('hold-frames: hold duration in seconds (alternative to hold_frames).', 'hold-frames: thời gian giữ dáng tính bằng giây (thay cho hold_frames).')),
      template: z
        .enum(['humanoid', 'humanoid-full', 'hand-detailed', 'foot-detailed', 'simple-chain'])
        .optional()
        .describe(d('Skeleton template to apply (humanoid, humanoid-full, hand-detailed, foot-detailed, simple-chain).', 'Mẫu khung xương áp dụng (humanoid, humanoid-full, hand-detailed, foot-detailed, simple-chain).')),
      preset: z
        .enum(['walk', 'idle', 'wave', 'bow', 'run', 'jump', 'fall', 'land', 'action', 'sway', 'hand-clench', 'foot-roll'])
        .optional()
        .describe(d('Procedural motion preset to generate.', 'Chuyển động mẫu tự động sinh.')),
      view_angle: z.enum(['front', 'diagonal', 'side', 'back']).optional().describe(d('Character facing view angle for procedural motion presets ("front" = 0° front-facing default, "diagonal" = 45° 3/4 view, "side" = 90° profile).', 'Góc nhìn nhân vật khi sinh chuyển động mẫu ("front" = 0° chính diện mặc định, "diagonal" = 45° chéo 3/4, "side" = 90° ngang).')),
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
      'Switch between the 4 inspector tabs (layers, bones, animation, plant) and select active bone in the workshop.',
      'Chuyển đổi giữa 4 tab cột phải (layers, bones, animation, plant) và chọn xương kích hoạt trong xưởng.'
    ),
    shape: (d) => ({
      tab: z.enum(['layers', 'bones', 'animation', 'plant']).optional().describe(d('Active right panel tab ("plant" = draw plant spines for wind sway).', 'Tab cột phải cần mở ("plant" = vẽ xương motion đung đưa theo gió).')),
      bone_id: z.string().optional().describe(d('Optional bone ID to select.', 'ID xương cần chọn.')),
      spine_id: z.string().optional().describe(d('Optional plant spine ID to select.', 'ID xương motion cần chọn.')),
      plant_grab_mode: z.enum(['record', 'learn']).optional().describe(d('Plant grab circle behavior: "record" = records custom hand-drawn sway · "learn" = infers procedural wind amplitude/lean/period.', 'Hành vi vòng tròn ở ngọn: "record" = ghi chuyển động vẽ tay · "learn" = học biên độ/độ nghiêng/nhịp gió tự động.')),
      plant_record_end: z.enum(['loop', 'spring']).optional().describe(d('Release behavior after grabbing: "loop" = seamless loop · "spring" = damped spring back to rest.', 'Khi thả tay: "loop" = lặp đúng cử chỉ · "spring" = nảy tắt dần về nghỉ.')),
      plant_path_record: z.boolean().optional().describe(d('Toggle "Record Tip Path" (key R): dragging anywhere on the canvas draws the tip path and records motion.', 'Bật/tắt "Vẽ quỹ đạo ngọn" (phím R): kéo chuột bất kỳ đâu trên khung để vẽ đường đi ngọn.')),
      plant_live: z.boolean().optional().describe(d('Live wind sway preview in the workshop.', 'Bật/tắt gió trực tiếp trong xưởng.')),
      anim_ik: z.boolean().optional().describe(d('Enable IK when dragging bone tips (I hotkey).', 'Bật IK khi kéo ngọn xương (phím I).')),
      anim_ik_chain: z.number().int().min(2).max(4).optional().describe(d('Number of bones in the IK chain (2–4).', 'Số xương trong chuỗi IK (2–4).')),
      anim_onion: z.boolean().optional().describe(d('Enable onion skin ghosting of previous/next poses (O hotkey).', 'Bật bóng mờ Onion skin các dáng trước/sau (phím O).')),
      anim_onion_count: z.number().int().min(1).max(5).optional().describe(d('Number of ghosts on each side.', 'Số bóng mỗi bên.')),
      anim_onion_step: z.number().min(0.03).max(0.5).optional().describe(d('Time spacing between ghosts in seconds.', 'Khoảng thời gian giữa các bóng (giây).')),
      anim_path: z.boolean().optional().describe(d('Show motion path of the active bone tip (P hotkey).', 'Hiện quỹ đạo chuyển động của ngọn xương đang chọn (phím P).')),
      anim_auto_key: z.boolean().optional().describe(d('Toggle Moho / Adobe Animate Auto-Key recording when dragging bones.', 'Bật/tắt chế độ Auto-Key tự ghi Keyframe khi kéo xương.')),
      anim_dope_filter: z.enum(['all', 'keyed', 'selected']).optional().describe(d('Filter bone tracks shown in the Dope Sheet timeline ("all", "keyed", "selected").', 'Lọc hàng xương hiển thị trên Dope Sheet ("all", "keyed", "selected").')),
      rig_tool: z.enum(['select', 'add', 'strength', 'manipulate']).optional().describe(d('Active Moho Rigging tool on the Bones tab: "select" (S), "add" (A draw bone / Pin Bone), "strength" (T Bone Strength capsule), "manipulate" (Z live Frame-0 IK/FK test).', 'Công cụ Tạo xương chuẩn Moho ở tab Tạo xương: "select" (S), "add" (A vẽ xương / Pin Bone), "strength" (T vỏ vùng uốn), "manipulate" (Z thử bẻ khớp IK/FK tại Frame 0).')),
      rig_influence: z.boolean().optional().describe(d('Show or hide Moho Bone Strength / Influence capsules on the 2D stage.', 'Hiện/ẩn lớp vỏ viên nang Vùng ảnh hưởng xương trên sân khấu 2D.')),
      rig_mirror_draw: z.boolean().optional().describe(d('Enable symmetrical Left ⇄ Right bone drawing across X = 0 when using the Add Bone (A) tool.', 'Bật/tắt chế độ Vẽ xương đối xứng Trái ⇄ Phải qua trục X = 0 khi dùng công cụ Vẽ xương (A).'))
    }),
    example: '{"tab":"animation","anim_ik":true}'
  },
  {
    name: 'layer_assembly_plant_spine',
    cat: 'layer_assembly',
    doc: L(
      'Manage plant wind spines in the open 2.5D Layer Assembly workshop: a curve from ROOT to TIP that makes bound layers (grass, trees, branches, flowers, hair, capes, ribbons) bend and sway in the wind. Actions: list, add (auto-generates 4-point spine along direction up/horizontal/down if points omitted), update, delete, clear, phase (stagger/sync phase offsets), copy_motion, apply_weather (1-click Beaufort wind presets breeze/moderate/strong/storm + wind lean direction; auto-creates first spine if none exists). Also supports recorded hand-drawn tip motions (motion_keys / motion_samples). Supports undo (Ctrl+Z) and exports with the composite.',
      'Quản lý Trục xương gió trong Xưởng Lắp Ráp Layer 2.5D đang mở: đường cong từ GỐC tới NGỌN giúp các layer (cỏ, cây, cành, hoa, mái tóc, áo choàng, dải lụa) uốn cong đung đưa theo gió. Hành động: list, add (tự sinh trục 4 điểm theo direction up/horizontal/down nếu không truyền points), update, delete, clear, phase (so le/đồng bộ lệch pha), copy_motion, apply_weather (áp nhanh cấp độ gió Beaufort breeze/moderate/strong/storm + hướng gió tạt lean; tự tạo trục đầu tiên nếu chưa có). Hỗ trợ chuyển động vẽ tay (motion_keys / motion_samples), hoàn tác (Ctrl+Z) và xuất kèm cụm layer.'
    ),
    shape: (d) => ({
      action: z.enum(['list', 'add', 'update', 'delete', 'clear', 'phase', 'copy_motion', 'apply_weather']).describe(d('Operation to perform. "phase" staggers (mode stagger) or syncs (mode sync) phase offsets; "copy_motion" copies motion/wind params of spine_id to other spines; "apply_weather" applies Beaufort weather preset and/or wind lean across spines (auto-creating a spine if none exists).', 'Thao tác cần thực hiện. "phase" so le (mode stagger) hoặc đồng bộ (mode sync) độ lệch pha; "copy_motion" sao chép nhịp/thông số gió sang xương khác; "apply_weather" áp cấp độ gió Beaufort và/hoặc hướng gió tạt (tự tạo trục đầu tiên nếu chưa có).')),
      mode: z.enum(['stagger', 'sync']).optional().describe(d('phase: "stagger" = golden-ratio phase offsets within spread seconds (default) · "sync" = all 0.', 'phase: "stagger" = lệch pha theo tỉ lệ vàng trong khoảng spread giây (mặc định) · "sync" = tất cả về 0.')),
      spread: z.number().min(0).max(3).optional().describe(d('phase stagger: max phase offset in seconds (default 1.2).', 'phase stagger: độ lệch pha tối đa (giây, mặc định 1.2).')),
      target_spine_ids: z.array(z.string()).optional().describe(d('copy_motion: spines receiving the motion (default = every other spine).', 'copy_motion: các xương nhận nhịp (mặc định = mọi xương khác).')),
      stagger: z.number().min(0).max(3).optional().describe(d('copy_motion: extra phase offset per target spine in seconds.', 'copy_motion: lệch pha thêm cho mỗi xương đích (giây).')),
      simplify_motion: z.number().int().min(2).max(600).optional().describe(d('Reduce a dense recorded motion to at most N keys keeping its shape (graph "Simplify").', 'Rút chuyển động ghi tay dày đặc còn tối đa N mốc, giữ dáng đường cong (nút "Làm gọn").')),
      smooth_motion: z.boolean().optional().describe(d('Smooth the motion keys (1-2-1 cyclic filter) to remove hand jitter.', 'Làm mượt các mốc (lọc 1-2-1 tuần hoàn) để khử rung tay.')),
      balance_motion: z.boolean().optional().describe(d('Balance left/right: second half of the cycle mirrors the first half.', 'Cân đối trái – phải: nửa sau chu kỳ là ảnh gương nửa đầu.')),
      spine_id: z.string().optional().describe(d('Target spine ID (update/delete).', 'ID xương cần sửa/xoá (update/delete).')),
      points: z.array(z.array(z.number()).length(2)).optional().describe(d('Spine points [[x,y],...] in composite coordinates (X right, Y down, origin at frame center), ordered from ROOT (fixed) to TIP (bends most). At least 2 points.', 'Các điểm xương [[x,y],...] theo toạ độ cụm (X sang phải, Y xuống, gốc ở tâm khung), xếp từ GỐC (đứng yên) tới NGỌN (uốn nhiều nhất). Tối thiểu 2 điểm.')),
      layer_ids: z.array(z.string()).optional().describe(d('Layer IDs that bend with this spine.', 'Danh sách ID layer uốn theo xương.')),
      apply_to: z.enum(['selected', 'all']).optional().describe(d('When layer_ids is omitted on add: bind to the selected layers or all visible layers. Default "selected".', 'Khi không truyền layer_ids lúc add: gắn vào layer đang chọn hoặc toàn bộ layer đang hiện. Mặc định "selected".')),
      preset: z.enum(['grass', 'sapling', 'branch', 'canopy', 'flower', 'seaweed']).optional().describe(d('Plant motion preset (grass, sapling, branch, canopy = big tree, flower, seaweed/vine).', 'Kiểu cây mẫu (grass = cỏ lau, sapling = cây non, branch = cành, canopy = đại thụ, flower = hoa, seaweed = rong biển/dây leo).')),
      direction: z.enum(['up', 'horizontal', 'down']).optional().describe(d('Auto-generated spine growth direction when points is omitted on add/apply_weather: "up" (bottom root to top tip), "horizontal" (left root to right tip), "down" (top root hanging down for vines/hair/capes).', 'Hướng mọc tự động khi không truyền points lúc add/apply_weather: "up" (gốc dưới mọc lên), "horizontal" (vươn ngang trái sang phải), "down" (gốc trên rủ xuống cho dây leo/tóc/áo choàng).')),
      weather: z.enum(['breeze', 'moderate', 'strong', 'storm']).optional().describe(d('apply_weather: Beaufort wind level preset ("breeze" = gentle ±6°, "moderate" = ±13°, "strong" = gusty ±22°, "storm" = gale ±32°).', 'apply_weather: cấp độ gió Beaufort mẫu ("breeze" = hiu hiu ±6°, "moderate" = gió vừa ±13°, "strong" = gió mạnh ±22°, "storm" = gió lốc ±32°).')),
      stagger_phase: z.boolean().optional().describe(d('apply_weather: automatically stagger golden-ratio phase offsets across multiple spines (default true).', 'apply_weather: tự động rải lệch pha tỉ lệ vàng khi có nhiều trục gió (mặc định true).')),
      name: z.string().optional().describe(d('Spine display name.', 'Tên hiển thị của xương.')),
      amplitude: z.number().optional().describe(d('Max bend at the tip in degrees.', 'Góc uốn tối đa tại ngọn (độ).')),
      speed: z.number().optional().describe(d('Sway cycles per second.', 'Số nhịp đung đưa mỗi giây.')),
      stiffness: z.number().optional().describe(d('0 = whole stem bends · 1 = only the tip bends.', '0 = cả thân cong · 1 = chỉ ngọn cong.')),
      flexibility: z.number().optional().describe(d('0..1 extra tip flutter.', '0..1 độ rung phụ ở ngọn.')),
      turbulence: z.number().optional().describe(d('0..1 gusty wind.', '0..1 gió giật thất thường.')),
      lean: z.number().optional().describe(d('Constant wind lean in degrees (positive = right).', 'Độ nghiêng cố định theo gió (độ, dương = sang phải).')),
      phase_offset: z.number().optional().describe(d('Phase offset in seconds so several plants sway out of sync.', 'Lệch pha (giây) để nhiều cây đung đưa so le.')),
      reach: z.number().optional().describe(d('Influence radius in px around the spine; 0 = the whole layer follows.', 'Bán kính ảnh hưởng quanh xương (px); 0 = cả layer uốn theo.')),
      vertical_bob: z.number().min(0).max(1).optional().describe(d('0..1 vertical stretch / bobbing amplitude along the stem (squash & stretch).', '0..1 biên độ nhún co dãn lên xuống theo chiều dọc thân cây (squash & stretch).')),
      enabled: z.boolean().optional().describe(d('Enable or disable this spine.', 'Bật/tắt xương này.')),
      motion_keys: z.array(z.array(z.number()).min(2).max(3)).min(2).optional().describe(d('Recorded motion keys [[t, tipAngle, stretch?],...]: t in seconds, tip angle (±120), optional vertical stretch factor.', 'Mốc chuyển động vẽ tay [[t, gócNgọn, stretch?],...]: t tính bằng giây, góc uốn ngọn (±120), hệ số nhún dọc tuỳ chọn.')),
      motion_duration: z.number().min(0.2).max(30).optional().describe(d('Loop length in seconds for motion_keys (must exceed the last key time; default = last key + one key spacing).', 'Chu kỳ lặp (giây) cho motion_keys (phải lớn hơn thời điểm mốc cuối; mặc định = mốc cuối + một khoảng mốc).')),
      motion_samples: z.array(z.array(z.number()).min(2).max(3)).min(2).optional().describe(d('Raw grab samples [[t, tipAngle, stretch?],...] as if the user dragged the tip in real time; the app smooths, trims idle start, closes the loop and reduces keys.', 'Mẫu nắm ngọn thô [[t, gócNgọn, stretch?],...] như khi người dùng kéo ngọn theo thời gian thật; app tự làm mượt, cắt đoạn chờ đầu, khép vòng và rút gọn mốc.')),
      motion_end: z.enum(['loop', 'spring']).optional().describe(d('For motion_samples: "loop" repeats the gesture (default) · "spring" adds a damped spring-back after release.', 'Với motion_samples: "loop" lặp đúng cử chỉ (mặc định) · "spring" thêm đoạn nảy tắt dần về nghỉ sau khi thả.')),
      motion_speed: z.number().min(0.1).max(4).optional().describe(d('Playback speed multiplier of the recorded motion (1 = as recorded).', 'Hệ số tốc độ phát lại chuyển động vẽ tay (1 = đúng nhịp đã ghi).')),
      motion_lag: z.number().min(0).max(1).optional().describe(d('Tip delay behind the root in seconds (whip-like follow-through). Default 0.08 for recordings.', 'Độ trễ của ngọn so với gốc (giây), tạo cảm giác đánh roi. Mặc định 0.08 khi ghi.')),
      motion_wind_mix: z.number().min(0).max(1).optional().describe(d('0..1 procedural wind layered on top of the recorded motion.', '0..1 trộn thêm gió tự động chồng lên chuyển động vẽ tay.')),
      motion_vertical_bob: z.number().min(0).max(1).optional().describe(d('0..1 vertical stretch / bobbing amplitude for the custom motion.', '0..1 biên độ nhún co dãn lên xuống cho chuyển động riêng.')),
      scale_motion: z.number().min(0.05).max(10).optional().describe(d('Scale the bend angle of an existing or new motion (e.g. 1.25 for +25% or 0.8 for -20%).', 'Nhân tỷ lệ góc uốn của chuyển động hiện có hoặc mới (ví dụ 1.25 = mạnh hơn 25%, 0.8 = nhẹ hơn 20%).')),
      mirror_motion: z.boolean().optional().describe(d('Mirror the bend angles of the motion (swaps left and right sways).', 'Đảo chiều góc uốn của chuyển động (đổi qua lại giữa lắc trái và lắc phải).')),
      clear_motion: z.boolean().optional().describe(d('Remove the recorded motion and return to procedural wind.', 'Xoá chuyển động vẽ tay, quay về gió tự động.'))
    }),
    example: '{"action":"add","points":[[0,180],[4,90],[-6,0],[2,-90]],"apply_to":"all","preset":"sapling"}'
  },
  {
    name: 'layer_assembly_motion_sketch',
    cat: 'layer_assembly',
    doc: L(
      'Motion Sketch in the open 2.5D Layer Assembly workshop: turn a drawn path (where the bone TIP travels) into smooth keyframes. mode "rotate" aims the bone at each point (FK swing) or, with chain_length 2–4, solves IK so the parent bones follow the tip (arm, leg, tail); mode "move" drags the bone joint along the path. Timing "live"/"hand" keep the speed of [x,y,t] samples (live = exact seconds, hand = scaled to duration), "even" spreads them over duration. Replaces old keys inside the sketched range, extends the clip if needed and supports undo (Ctrl+Z).',
      'Vẽ động tác trong Xưởng Lắp Ráp Layer 2.5D đang mở: biến một đường vẽ (đường đi của NGỌN xương) thành chuỗi keyframe mượt. mode "rotate" xoay xương hướng theo từng điểm (vung tay kiểu FK) hoặc, với chain_length 2–4, giải IK để các xương cha xoay theo ngọn (tay, chân, đuôi); mode "move" dời khớp xương chạy theo đường vẽ. Nhịp "live"/"hand" giữ tốc độ theo mẫu [x,y,t] (live = đúng số giây, hand = co giãn vào duration), "even" rải đều trong duration. Thay keyframe cũ trong đoạn vẽ, tự nới thời lượng clip khi cần và hỗ trợ hoàn tác (Ctrl+Z).'
    ),
    shape: (d) => ({
      bone_id: z.string().describe(d('Bone to animate.', 'ID xương cần tạo động tác.')),
      points: z.array(z.array(z.number()).min(2).max(3)).min(2).describe(d('Path samples [[x,y],...] or [[x,y,t],...] in composite coordinates (X right, Y down, origin at frame center); t = seconds since the stroke started (non-decreasing). The first point is where the bone currently is.', 'Các mẫu đường vẽ [[x,y],...] hoặc [[x,y,t],...] theo toạ độ cụm (X sang phải, Y xuống, gốc ở tâm khung); t = số giây kể từ lúc bắt đầu nét (không giảm). Điểm đầu là vị trí hiện tại của xương.')),
      mode: z.enum(['rotate', 'move']).optional().describe(d('"rotate" (default) aims the bone at the path · "move" translates the bone joint.', '"rotate" (mặc định) xoay xương theo đường vẽ · "move" dời khớp xương.')),
      timing: z.enum(['live', 'hand', 'even']).optional().describe(d('"live" uses the exact seconds of t (motion length = stroke length) · "hand" follows t scaled into duration (default when t is given) · "even" spreads motion evenly.', '"live" dùng đúng số giây của t (thời lượng = thời gian vẽ) · "hand" theo t co giãn vào duration (mặc định khi có t) · "even" rải đều động tác.')),
      chain_length: z.number().int().min(1).max(4).optional().describe(d('rotate mode: 1 = only this bone (default) · 2–4 = IK chain, the parent bones rotate so the tip follows the path.', 'Chế độ rotate: 1 = chỉ xương này (mặc định) · 2–4 = chuỗi IK, các xương cha xoay để ngọn bám theo đường vẽ.')),
      duration: z.number().min(0.1).max(20).optional().describe(d('Motion length in seconds (default 1).', 'Thời lượng động tác (giây, mặc định 1).')),
      start_time: z.number().optional().describe(d('Clip time where the motion starts; defaults to the playhead.', 'Thời điểm bắt đầu trong clip; mặc định là vị trí đầu phát.')),
      loop_back: z.boolean().optional().describe(d('Mirror the motion back to the start pose (doubles length).', 'Đi rồi quay về tư thế ban đầu (gấp đôi thời lượng).')),
      play: z.boolean().optional().describe(d('Play the clip from start_time afterwards.', 'Phát thử từ start_time sau khi tạo.'))
    }),
    example: '{"bone_id":"arm-left","points":[[100,0,0],[70,70,0.3],[0,100,0.6]],"duration":1,"play":true}'
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
      part_group: z.enum(['all', 'head', 'upper', 'lower']).optional().describe(d('Character templates only. Generate only one part group (head / upper body / lower body) per pass so occluded areas are drawn more completely. Default "all".', 'Chỉ cho mẫu nhân vật. Mỗi lần chỉ tạo một nhóm bộ phận (đầu / thân trên / thân dưới) để phần bị che được vẽ đầy đủ hơn. Mặc định "all".')),
      sheet_style: z.enum(['template', 'granular']).optional().describe(d('Character templates only. "template" (default) = 13 parts matching this template\'s slots for direct import; "granular" = highly granular Live2D / Spine sheet (~45 pieces: layered hair, blank head, separate eyes/brows/mouth, bare torso + layered clothing, individual left/right arm and leg segments).', 'Chỉ cho mẫu nhân vật. "template" (mặc định) = 13 mảnh khớp slot của mẫu để nhập thẳng; "granular" = sheet bóc tách chi tiết Live2D / Spine (~45 mảnh: tóc nhiều lớp, đầu trơn, mắt/lông mày/miệng rời, thân trần + quần áo từng lớp, tay chân trái phải riêng).'))
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

