/**
 * Professional animation tools for the 2.5D Layer Assembly workshop (Animation tab):
 * IK posing and baked secondary motion (bone dynamics) — like Spine / Moho / Cartoon Animator.
 */
import { L, z } from './shared.mjs'

export const LAYER_ANIM_TOOLS = [
  {
    name: 'layer_assembly_ik_pose',
    cat: 'layer_assembly',
    doc: L(
      'IK posing in the open 2.5D Layer Assembly workshop: pull the TIP of a bone to a target point and let the parent bones of the chain rotate automatically (CCD solver, like dragging a hand and the forearm + upper arm follow). Writes rotation keys for every bone of the chain at `time` (default = playhead). Same as dragging a bone tip with IK on (key I) in the Animation tab. Undo with Ctrl+Z.',
      'Tạo dáng IK trong Xưởng Lắp Ráp Layer 2.5D đang mở: kéo NGỌN một xương tới điểm target, các xương cha trong chuỗi tự xoay theo (bộ giải CCD, như kéo bàn tay thì cẳng tay + bắp tay đi theo). Ghi key xoay cho mọi xương trong chuỗi tại `time` (mặc định = đầu phát). Giống kéo ngọn xương khi bật IK (phím I) ở tab Animation. Hoàn tác bằng Ctrl+Z.'
    ),
    shape: (d) => ({
      bone_id: z.string().describe(d('End bone of the chain (its tip goes to target), e.g. the hand or forearm.', 'Xương cuối chuỗi (ngọn của nó đi tới target), ví dụ bàn tay hoặc cẳng tay.')),
      target: z.array(z.number()).length(2).describe(d('Target point [x, y] in composite coordinates (X right, Y down, origin at frame center).', 'Điểm đích [x, y] theo toạ độ cụm (X sang phải, Y xuống, gốc ở tâm khung).')),
      chain_length: z.number().int().min(1).max(4).optional().describe(d('Bones in the chain counting up from bone_id (default 2 = forearm + upper arm).', 'Số xương trong chuỗi tính ngược lên từ bone_id (mặc định 2 = cẳng tay + bắp tay).')),
      time: z.number().optional().describe(d('Clip time (s) to key; defaults to the playhead.', 'Thời điểm (giây) ghi key; mặc định là đầu phát.'))
    }),
    example: '{"bone_id":"bone-forearm-l","target":[-180,-60],"chain_length":2}'
  },
  {
    name: 'layer_assembly_secondary_motion',
    cat: 'layer_assembly',
    doc: L(
      'Secondary motion / bone dynamics in the open 2.5D Layer Assembly workshop: simulate inertia for a bone branch (hair, tail, cloth, ears/antennae) so it lags and bounces after the main motion, then BAKE the result into rotation keyframes (replaces the old keys of that branch; visible everywhere incl. video export). Animate the main body first, then call this on the root bone of the branch. Undo with Ctrl+Z.',
      'Chuyển động thứ cấp / vật lý xương trong Xưởng Lắp Ráp Layer 2.5D đang mở: mô phỏng quán tính cho một nhánh xương (tóc, đuôi, vải, tai/ăng-ten) để nhánh trễ nhịp và nảy theo sau động tác chính, rồi NƯỚNG thành keyframe xoay (thay key cũ của nhánh; hiển thị ở mọi nơi kể cả xuất video). Hãy tạo động tác thân chính trước rồi gọi tool này cho xương gốc của nhánh. Hoàn tác bằng Ctrl+Z.'
    ),
    shape: (d) => ({
      bone_id: z.string().describe(d('Root bone of the branch to simulate.', 'Xương gốc của nhánh cần mô phỏng.')),
      preset: z.enum(['hair', 'tail', 'cloth', 'antenna']).optional().describe(d('Starting settings: hair, tail, cloth (cape), antenna (springy ears).', 'Thông số khởi điểm: hair = tóc, tail = đuôi, cloth = vải/áo choàng, antenna = tai/ăng-ten nảy.')),
      stiffness: z.number().min(0).max(1).optional().describe(d('0..1 — higher snaps back faster with less lag.', '0..1 — càng cao càng bật về nhanh, ít trễ.')),
      damping: z.number().min(0).max(1).optional().describe(d('0..1 — higher = fewer bounces.', '0..1 — càng cao càng ít nảy qua lại.')),
      strength: z.number().min(0).max(2).optional().describe(d('0..2 — multiplies the inertia offset (1 = natural).', '0..2 — nhân độ lệch quán tính (1 = tự nhiên).')),
      max_angle: z.number().min(5).max(120).optional().describe(d('Max offset angle in degrees.', 'Góc lệch tối đa (độ).')),
      include_root: z.boolean().optional().describe(d('Also simulate bone_id itself (default true); false = only its children.', 'Mô phỏng cả bone_id (mặc định true); false = chỉ các xương con.')),
      play: z.boolean().optional().describe(d('Play the clip from 0 afterwards (default true).', 'Phát thử clip từ 0 sau khi nướng (mặc định true).'))
    }),
    example: '{"bone_id":"bone-hair-1","preset":"hair"}'
  },
  {
    name: 'layer_assembly_pose_tools',
    cat: 'layer_assembly',
    doc: L(
      'Pose-to-pose timing tools of the Animation tab (same as the "Pose-to-pose & Timing" card). op: next_key / prev_key (move the playhead to the neighbouring keyframe, optionally of bone_id only), breakdown (insert an in-between pose at `time` for every bone sitting between two keys; favor 0 = previous key, 1 = next key — Tween Machine), close_loop (last frame = first pose, loop on), overlap (children of bone_id lag `delay` s per level → follow-through for arms/hair/tails), retime (scale all key times by `factor`), reverse, shift_time (insert (+) or remove (−) `delta` seconds at `time`). Undoable (Ctrl+Z).',
      'Công cụ nhịp pose-to-pose của tab Animation (giống thẻ "Pose-to-pose & Nhịp"). op: next_key / prev_key (đưa đầu phát tới keyframe kế bên, tuỳ chọn chỉ của bone_id), breakdown (chèn dáng trung gian tại `time` cho mọi xương nằm giữa 2 key; favor 0 = key trước, 1 = key sau — Tween Machine), close_loop (khung cuối = dáng đầu, bật lặp), overlap (xương con của bone_id trễ `delay` giây mỗi cấp → follow-through cho tay/tóc/đuôi), retime (nhân thời điểm mọi key với `factor`), reverse (đảo ngược), shift_time (chèn (+) hoặc bớt (−) `delta` giây tại `time`). Hỗ trợ hoàn tác (Ctrl+Z).'
    ),
    shape: (d) => ({
      op: z.enum(['next_key', 'prev_key', 'breakdown', 'close_loop', 'overlap', 'retime', 'reverse', 'shift_time']).describe(d('Tool to run.', 'Công cụ cần chạy.')),
      time: z.number().optional().describe(d('Clip time in seconds (breakdown / shift_time / navigation start); defaults to the playhead.', 'Thời điểm trong clip (giây) cho breakdown / shift_time / điểm bắt đầu điều hướng; mặc định = đầu phát.')),
      favor: z.number().min(-0.5).max(1.5).optional().describe(d('breakdown: 0 = previous key, 0.5 = middle (default), 1 = next key.', 'breakdown: 0 = key trước, 0.5 = chính giữa (mặc định), 1 = key sau.')),
      bone_id: z.string().optional().describe(d('overlap: root bone of the branch (required) · next_key/prev_key: only this bone\'s keys.', 'overlap: xương gốc của nhánh (bắt buộc) · next_key/prev_key: chỉ xét key của xương này.')),
      delay: z.number().min(-1).max(1).optional().describe(d('overlap: lag per child level in seconds (default 0.08).', 'overlap: độ trễ mỗi cấp xương con (giây, mặc định 0.08).')),
      factor: z.number().min(0.05).max(20).optional().describe(d('retime: >1 slower, <1 faster (duration is scaled too).', 'retime: >1 chậm hơn, <1 nhanh hơn (thời lượng co giãn theo).')),
      delta: z.number().optional().describe(d('shift_time: seconds to insert (positive) or remove (negative) right after `time`.', 'shift_time: số giây chèn (dương) hoặc bớt (âm) ngay sau `time`.'))
    }),
    example: '{"op":"breakdown","time":0.5,"favor":0.33}'
  }
]
