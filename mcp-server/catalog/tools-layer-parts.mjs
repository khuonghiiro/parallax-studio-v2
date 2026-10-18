/**
 * Catalog: Nhóm bộ phận & khe biến thể (Part groups & swap slots) — Xưởng Lắp Ráp Layer + nhân vật trong cảnh.
 */
import { L, z } from './shared.mjs'

export const LAYER_PARTS_TOOLS = [
  {
    name: 'layer_assembly_parts',
    cat: 'layer_assembly',
    doc: L(
      'Part groups & swap slots in the open Layer Assembly Workshop. Part groups (e.g. "Head" = face/eyes/mouth/glasses/hair) can be LOCKED so moving one member moves the whole group; layers sharing a slot (e.g. "face": face-normal / face-happy / face-cry) are interchangeable variants — activating one shows it, hides the others and snaps it to the same anchor transform. Actions: list, auto_detect (groups + slots from layer names), create_group, assign, lock_group, rename_group, delete_group, set_slot, activate_variant, move (linked X/Y), replace_asset (swap image keeping position; mode "variant" keeps the old image as a hidden variant). Undoable (Ctrl+Z).',
      'Nhóm bộ phận & khe biến thể trong Xưởng Lắp Ráp Layer đang mở. Nhóm bộ phận (VD "Đầu" = mặt/mắt/miệng/kính/tóc) có thể KHOÁ LIÊN KẾT để kéo một bộ phận thì cả nhóm di chuyển theo; các layer cùng khe (VD "face": face-normal / face-happy / face-cry) là biến thể thay thế nhau — kích hoạt một biến thể sẽ hiện nó, ẩn các biến thể khác và căn trùng vị trí neo. Hành động: list, auto_detect (tự nhận nhóm + khe từ tên layer), create_group, assign, lock_group, rename_group, delete_group, set_slot, activate_variant, move (dời X/Y theo liên kết), replace_asset (thay ảnh giữ nguyên vị trí; mode "variant" giữ ảnh cũ thành biến thể ẩn). Hỗ trợ hoàn tác (Ctrl+Z).'
    ),
    shape: (d) => ({
      action: z.enum(['list', 'auto_detect', 'create_group', 'assign', 'lock_group', 'rename_group', 'delete_group', 'set_slot', 'activate_variant', 'move', 'replace_asset'])
        .describe(d('Operation to perform.', 'Thao tác cần thực hiện.')),
      layer_ids: z.array(z.string()).optional().describe(d('Layer IDs (create_group / assign).', 'Danh sách ID layer (create_group / assign).')),
      layer_id: z.string().optional().describe(d('Target layer ID (set_slot / activate_variant / move / replace_asset).', 'ID layer đích (set_slot / activate_variant / move / replace_asset).')),
      group_id: z.string().nullable().optional().describe(d('Part group ID (assign: null removes from group; lock_group / rename_group / delete_group).', 'ID nhóm bộ phận (assign: null = gỡ khỏi nhóm; lock_group / rename_group / delete_group).')),
      name: z.string().optional().describe(d('Group name (create_group / rename_group) or display name of the new image (replace_asset).', 'Tên nhóm (create_group / rename_group) hoặc tên hiển thị ảnh mới (replace_asset).')),
      kind: z.enum(['head', 'torso', 'arm', 'leg', 'accessory', 'custom']).optional().describe(d('Group kind (create_group), drives its colour.', 'Loại nhóm (create_group), quyết định màu hiển thị.')),
      locked: z.boolean().optional().describe(d('lock_group: true = linked (move together), false = parts move independently.', 'lock_group: true = liên kết (di chuyển cùng nhau), false = tách rời.')),
      slot: z.string().optional().describe(d('set_slot: slot name (e.g. "face"); empty clears.', 'set_slot: tên khe (VD "face"); để trống để xoá.')),
      variant: z.string().optional().describe(d('set_slot: variant name (e.g. "cry").', 'set_slot: tên biến thể (VD "cry").')),
      snap: z.boolean().optional().describe(d('activate_variant: snap to the anchor transform of the variant currently shown (default true).', 'activate_variant: căn trùng vị trí neo của biến thể đang hiển thị (mặc định true).')),
      x: z.number().optional().describe(d('move: new X (linked group members follow).', 'move: X mới (thành viên nhóm liên kết đi theo).')),
      y: z.number().optional().describe(d('move: new Y (linked group members follow).', 'move: Y mới (thành viên nhóm liên kết đi theo).')),
      asset_path: z.string().optional().describe(d('replace_asset: image path (e.g. "character_cutout_demo/face-cry.png").', 'replace_asset: đường dẫn ảnh (VD "character_cutout_demo/face-cry.png").')),
      mode: z.enum(['replace', 'variant']).optional().describe(d('replace_asset: "replace" swaps in place (default) · "variant" adds a new slot variant and keeps the old one hidden.', 'replace_asset: "replace" thay tại chỗ (mặc định) · "variant" thêm biến thể mới vào khe, giữ ảnh cũ ở dạng ẩn.'))
    }),
    example: '{"action":"activate_variant","layer_id":"demo-face-normal"}'
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
