/**
 * Catalog: Nhóm bộ phận & khe biến thể (Part groups & swap slots) — Xưởng Lắp Ráp Layer + nhân vật trong cảnh.
 */
import { L, z } from './shared.mjs'

export const LAYER_PARTS_TOOLS = [
  {
    name: 'get_part_cues', cat: 'timeline',
    doc: L('Inspect a 2.5D part hub or child: child cue IDs, legal variant layer IDs, related Motion intervals and evaluated positions/visibility at time. Read this before set_part_cue. Preview regions: workflow_part_preview, workflow_part_stage, workflow_part_cues.', 'Đọc Hub hoặc node con bộ phận 2.5D: ID mốc con, ID biến thể hợp lệ, khoảng Motion liên quan và vị trí/hiển thị thật tại thời điểm. Đọc trước set_part_cue. Vùng preview: workflow_part_preview, workflow_part_stage, workflow_part_cues.'),
    shape: d => ({ node_id: z.string().describe(d('Part hub or child node ID from get_workflow.', 'ID Hub hoặc node con Bộ phận từ get_workflow.')), time: z.number().min(0).optional().describe(d('Project seconds; defaults to playhead, does not seek.', 'Giây dự án; mặc định playhead, không tua.')) }),
    example: '{"node_id":"part-child-id","time":2}'
  },
  {
    name: 'set_part_cue', cat: 'timeline',
    doc: L('Edit a child part cue, or add an independent cue at a time. Uses the same logic as the visual part editor, one Undo step. Never edits the hub or Motion path. Times are project seconds, intervals [start,end). Latest start wins overlaps. Pose adds to Motion; variants/assets revert at end unless hold_after_end. Shared Time must be edited at its source.', 'Sửa mốc bộ phận con hoặc thêm mốc độc lập tại một thời điểm. Cùng logic với khung chỉnh trực quan, một bước Undo. Không sửa Hub hay đường Motion. Thời gian là giây dự án, khoảng [Từ,Đến). Mốc bắt đầu sau ưu tiên khi chồng lấn. Tư thế cộng vào Motion; biến thể/ảnh trả về khi hết mốc trừ hold_after_end. Time chung phải chỉnh tại nguồn.'),
    shape: d => ({
      node_id: z.string().describe(d('Child node ID from get_part_cues.', 'ID node con từ get_part_cues.')),
      action: z.enum(['update','add']).optional().describe(d('update (default) or add a separate cue.', 'update (mặc định) hoặc add mốc riêng.')),
      at: z.number().min(0).optional().describe(d('Required for add: project time.', 'Bắt buộc khi add: thời điểm dự án.')),
      duration: z.number().min(.5).optional().describe(d('New cue duration, default 1s.', 'Thời lượng mốc mới, mặc định 1s.')),
      start: z.number().min(0).optional().describe(d('Interval start.', 'Bắt đầu khoảng.')),
      end: z.number().min(0).optional().describe(d('Interval end.', 'Kết thúc khoảng.')),
      mode: z.enum(['expression','part_variant','replace_asset','toggle_part']).optional().describe(d('Part operation.', 'Thao tác bộ phận.')),
      variant_id: z.string().optional().describe(d('Variant layer ID within this child targets.', 'ID layer biến thể thuộc mục tiêu node con.')),
      layer_id: z.string().optional().describe(d('Target part layer for image or visibility.', 'Layer bộ phận đích để đổi ảnh hoặc hiển thị.')),
      asset_id: z.string().optional().describe(d('Existing image asset ID; use mode replace_asset.', 'ID tài nguyên ảnh có sẵn; dùng mode replace_asset.')),
      visible: z.boolean().optional().describe(d('Visibility during toggle_part cue.', 'Hiển thị trong mốc toggle_part.')),
      hold_after_end: z.boolean().optional().describe(d('Keep variant/image/visibility after end; pose still ends.', 'Giữ biến thể/ảnh/hiển thị sau Đến; tư thế vẫn kết thúc.')),
      x: z.number().optional().describe(d('Additive horizontal offset in scene units.', 'Độ lệch ngang cộng thêm theo đơn vị cảnh.')),
      y: z.number().optional().describe(d('Additive vertical offset, positive up.', 'Độ lệch dọc cộng thêm, dương hướng lên.')),
      rotation: z.number().optional().describe(d('Additive rotation in degrees.', 'Góc xoay cộng thêm, độ.')),
      scale: z.number().min(20).max(300).optional().describe(d('Part scale percent, 100 neutral.', 'Tỉ lệ phần trăm bộ phận, 100 trung tính.')),
      wave: z.enum(['smooth','hold','oscillate']).optional().describe(d('Pose envelope within the interval.', 'Nhịp tư thế trong khoảng.'))
    }),
    example: '{"node_id":"part-child-id","action":"add","at":2,"duration":1,"rotation":25,"wave":"hold"}'
  },

  {
    name: 'layer_assembly_parts',
    cat: 'layer_assembly',
    doc: L(
      'Part groups & multi-layer variant sets in the open Layer Assembly Workshop (works for humans, animals and any creature — names are user-defined, nothing assumes a single "face" image). Part groups can be LOCKED so moving one member moves the whole group; add members with assign, or drop a new image at the group anchor with add_asset_to_group. A variant set (slot) holds interchangeable variants and EACH variant may contain several layers (e.g. set "Expression" → variant "cry" = eyes-cry + mouth-cry + tears); activating a variant shows all its layers, hides the other variants and snaps each layer to the anchor of the same role. Actions: list, auto_detect (suggest groups/sets from layer names incl. tail/wing/fin/horn and shared name prefixes), create_group, assign, lock_group, rename_group, set_anchor, delete_group, move, add_asset_to_group, set_slot, create_variant_set, rename_slot, rename_variant, add_to_variant, remove_from_slot, dissolve_slot, activate_variant, add_asset_to_variant, replace_asset. Undoable (Ctrl+Z).',
      'Nhóm bộ phận & bộ biến thể nhiều lớp trong Xưởng Lắp Ráp Layer đang mở (dùng cho người, động vật, sinh vật bất kỳ — tên do người dùng đặt, không giả định khuôn mặt là 1 ảnh "face"). Nhóm có thể KHOÁ LIÊN KẾT để kéo một bộ phận thì cả nhóm đi theo; thêm thành viên bằng assign, hoặc thả ảnh mới đúng vị trí neo bằng add_asset_to_group. Bộ biến thể (slot) chứa các phương án thay thế nhau và MỖI biến thể có thể gồm nhiều layer (VD bộ "Biểu cảm" → biến thể "khóc" = mắt-khóc + miệng-khóc + nước mắt); kích hoạt biến thể sẽ hiện mọi layer của nó, ẩn biến thể khác và căn neo theo đúng vai trò. Hành động: list, auto_detect (gợi ý nhóm/bộ theo tên layer, gồm cả đuôi/cánh/vây/sừng và tiền tố tên chung), create_group, assign, lock_group, rename_group, set_anchor, delete_group, move, add_asset_to_group, set_slot, create_variant_set, rename_slot, rename_variant, add_to_variant, remove_from_slot, dissolve_slot, activate_variant, add_asset_to_variant, replace_asset. Hỗ trợ hoàn tác (Ctrl+Z).'
    ),
    shape: (d) => ({
      action: z.enum([
        'list', 'auto_detect', 'create_group', 'assign', 'lock_group', 'rename_group', 'set_anchor', 'delete_group', 'move', 'add_asset_to_group',
        'set_slot', 'create_variant_set', 'rename_slot', 'rename_variant', 'add_to_variant', 'remove_from_slot', 'dissolve_slot',
        'activate_variant', 'add_asset_to_variant', 'replace_asset'
      ]).describe(d('Operation to perform.', 'Thao tác cần thực hiện.')),
      layer_ids: z.array(z.string()).optional().describe(d('Layer IDs (create_group / assign / create_variant_set / add_to_variant).', 'Danh sách ID layer (create_group / assign / create_variant_set / add_to_variant).')),
      layer_id: z.string().optional().describe(d('Target layer ID (set_slot / set_anchor / remove_from_slot / activate_variant / move / replace_asset).', 'ID layer đích (set_slot / set_anchor / remove_from_slot / activate_variant / move / replace_asset).')),
      group_id: z.string().nullable().optional().describe(d('Part group ID (assign: null removes from group; lock_group / rename_group / set_anchor / delete_group / add_asset_to_group).', 'ID nhóm bộ phận (assign: null = gỡ khỏi nhóm; lock_group / rename_group / set_anchor / delete_group / add_asset_to_group).')),
      name: z.string().optional().describe(d('New name (create_group / rename_group / create_variant_set / rename_slot / rename_variant) or display name of the new image (add_asset_* / replace_asset).', 'Tên mới (create_group / rename_group / create_variant_set / rename_slot / rename_variant) hoặc tên hiển thị ảnh mới (add_asset_* / replace_asset).')),
      kind: z.enum(['head', 'torso', 'arm', 'leg', 'accessory', 'custom']).optional().describe(d('Group kind (create_group), drives its colour only.', 'Loại nhóm (create_group), chỉ quyết định màu hiển thị.')),
      locked: z.boolean().optional().describe(d('lock_group: true = linked (move together), false = parts move independently.', 'lock_group: true = liên kết (di chuyển cùng nhau), false = tách rời.')),
      slot: z.string().optional().describe(d('Variant set name (set_slot / rename_slot / rename_variant / add_to_variant / dissolve_slot / add_asset_to_variant); empty in set_slot clears.', 'Tên bộ biến thể (set_slot / rename_slot / rename_variant / add_to_variant / dissolve_slot / add_asset_to_variant); để trống ở set_slot để xoá.')),
      variant: z.string().optional().describe(d('Variant name (set_slot / rename_variant / add_to_variant — omit to make each layer its own variant / add_asset_to_variant).', 'Tên biến thể (set_slot / rename_variant / add_to_variant — bỏ trống để mỗi layer là biến thể riêng / add_asset_to_variant).')),
      snap: z.boolean().optional().describe(d('activate_variant: snap each layer to the anchor of the same-role layer currently shown (default true).', 'activate_variant: căn trùng neo của layer cùng vai trò đang hiển thị (mặc định true).')),
      x: z.number().optional().describe(d('move: new X (linked group members follow).', 'move: X mới (thành viên nhóm liên kết đi theo).')),
      y: z.number().optional().describe(d('move: new Y (linked group members follow).', 'move: Y mới (thành viên nhóm liên kết đi theo).')),
      asset_path: z.string().optional().describe(d('Image path (add_asset_to_group / add_asset_to_variant / replace_asset), e.g. "character_cutout_demo/face-cry.png".', 'Đường dẫn ảnh (add_asset_to_group / add_asset_to_variant / replace_asset), VD "character_cutout_demo/face-cry.png".')),
      mode: z.enum(['replace', 'variant']).optional().describe(d('replace_asset: "replace" swaps in place (default) · "variant" adds a new variant and keeps the old one hidden.', 'replace_asset: "replace" thay tại chỗ (mặc định) · "variant" thêm biến thể mới, giữ ảnh cũ ở dạng ẩn.'))
    }),
    example: '{"action":"add_to_variant","layer_ids":["eyes-cry","mouth-cry"],"slot":"Biểu cảm","variant":"khóc"}'
  },
  {
    name: 'swap_composite_part',
    cat: 'layer_assembly',
    doc: L(
      'Quickly swap a part / expression of a 2.5D character ALREADY placed in the scene (layer created by inserting a layer composite). Only the image changes; position, keyframes, motion and group link are kept, so the new face lines up exactly with the old one. Omit variant_layer_id and asset_path to list the template variants of the layer\'s slot. Undoable.',
      'Đổi nhanh bộ phận / biểu cảm của nhân vật 2.5D ĐÃ đặt trong cảnh (layer tạo từ việc chèn cụm layer). Chỉ thay ảnh; giữ nguyên vị trí, keyframe, motion và liên kết cụm nên khuôn mặt mới trùng khớp khuôn mặt cũ. Không truyền variant_layer_id và asset_path để liệt kê các biến thể trong khe của layer. Hỗ trợ hoàn tác.'
    ),
    shape: (d) => ({
      layer_id: z.string().describe(d('Scene image layer ID (part of a placed composite).', 'ID layer ảnh trong cảnh (thuộc cụm đã chèn).')),
      variant_layer_id: z.string().optional().describe(d('Template layer ID of the variant to show (from the listed variants).', 'ID layer biến thể trong mẫu gốc cần hiển thị (lấy từ danh sách biến thể).')),
      asset_path: z.string().optional().describe(d('Any image path to use instead (e.g. a related image in the same character folder).', 'Đường dẫn ảnh bất kỳ dùng thay (VD ảnh liên quan cùng thư mục nhân vật).')),
      name: z.string().optional().describe(d('Display name for asset_path.', 'Tên hiển thị cho asset_path.'))
    }),
    example: '{"layer_id":"layer-abc123","variant_layer_id":"demo-face-normal"}'
  }
]
