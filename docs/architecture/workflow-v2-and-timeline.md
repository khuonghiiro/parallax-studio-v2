# Kiến Trúc Đồng Bộ Timeline ⇄ Workflow V2, Nhóm Time Chung & Motion BBox

Tài liệu đặc tả kiến trúc kỹ thuật của hệ thống Một Logic Chung Timeline ⇄ Workflow V2, nhóm thời gian chung (`Shared Time Groups`), chuỗi Motion BBox, va chạm vật lý và bộ phận 2.5D theo mốc thời gian. Xem quy chuẩn tổng quan tại [AGENTS.md](../../AGENTS.md).

---

## 1. Một Logic Chung Timeline ⇄ Workflow V2 (`workflowV2Sync.ts`)

- **Nguồn sự thật duy nhất (`Single Source of Truth`):**
  - Dữ liệu thật nằm trên Project/Layer (`motion`, `virtualLight`/`glow`, `physics.depthPortal`, `physics.material`, xung lực `wf-col-*`, track âm thanh gắn layer).
  - Đồ thị Workflow V2 được **suy ra** từ dữ liệu này bằng `syncWorkflowV2Graph` ([`src/renderer/src/project/workflowV2Sync.ts`](../../src/renderer/src/project/workflowV2Sync.ts)) và Timeline ghi lại qua `patchDerived` (không tạo bước Undo thừa).
  - Trong `motion`, `motionMode` (`bbox`, `path`, `cycle`) là chế độ đang active và được ưu tiên hơn cấu hình lưu của tab khác; đổi tab giữ cấu hình để dùng lại, gỡ keyframe do chế độ cũ sinh ra và cập nhật logic dùng chung cho UI/MCP.

- **Đường đi thống nhất cho mọi thao tác thêm / sửa / xoá:**
  - Gắn logic: dùng `attachLogicNodeToLayerV2` + mẫu chung `WORKFLOW_V2_LOGIC_PRESETS` (`workflowV2LogicPresets.ts`, id `v2:<nhóm>:<tuỳ chọn>`).
  - Xoá logic: dùng `detachWorkflowV2NodeFromProject` (gỡ hẳn hiệu ứng để Node không bị suy diễn hồi sinh); tắt Node chỉ tắt hiệu ứng và giữ nguyên cấu hình.

- **Không gian đồ thị chung & Bố cục:**
  - Toàn bộ dự án dùng chung một đồ thị, mỗi Cảnh là một cụm (`Root → Camera / Nhóm → Layer → Logic`) sắp theo thứ tự camera đi qua (`computeShotRoute`, cùng nguồn `shotAtTime` với dải "Cảnh đang quay"); Camera các cảnh nối nhau bằng dây chuyển cảnh.
  - Thẻ cố định `236×64`, khoảng hở cột `120px`; thẻ kéo tay được ghim (`params.pinned`) và tự né chỗ trống (`findFreeV2Spot`); bấm "Sắp xếp" bỏ ghim. Khung vẽ chỉ render thẻ/dây trong tầm nhìn (`viewport culling`) để mượt 60fps với nhiều cảnh.

- **Nguyên tắc Node đơn trách nhiệm (`Single-Responsibility Node`):**
  - Mỗi Node trong Workflow V2 chỉ sở hữu và hiển thị đúng 1 trách nhiệm logic duy nhất:
    - `Node Animation Loop` (`loop_anim`): điều khiển chu kỳ lặp / tốc độ / số vòng của item Loop.
    - `Node Hiệu ứng` (`fx`): điều khiển hiện/ẩn mờ dần (`Fade In/Out`), nhịp đập (`Pulse/Beat`), rung chấn (`Shake`) và phát sáng (`Neon/Optical Glow`).
    - `Node Motion` (`action`): điều khiển quỹ đạo di chuyển không gian.
    - `Node Hành động Nhân vật` (`anim_fx`): điều khiển động tác nhân vật/cụm xương 2.5D.
    - `Node Time` (`time`): điều khiển khoảng thời gian dùng chung.
  - Tài nguyên có cơ chế vận hành riêng khi thêm vào cảnh tự động sinh và nối sẵn Node logic mặc định (`v2-loop_anim-<layerId>`, `cluster_lock`, `audio`).

- **Kiến trúc Modular JSON (`main.json` + `shots/shot-N.json`):**
  - Mỗi Cảnh xuất/nhập một tài liệu JSON độc lập (`parallax-workflow-shot` qua `buildShotWorkflowJson` / `applyShotWorkflowJson`) chứa trọn vẹn Camera, Layer, Logic (`logic[]`) và đồ thị của riêng cảnh đó.
  - `main.json` (`parallax-workflow-main` qua `buildMainWorkflowJson` / `applyMainWorkflowJson`) kết nối lộ trình Camera (`route`, `connections`) và danh sách các file cảnh.
  - Khi đổi cảnh trên thanh công cụ / sơ đồ, bảng `JSON Cảnh & Main` (`workflow_json_panel`) tự động chuyển sang JSON của cảnh đó.

---

## 2. Cấu Hình Node Workflow & Hộp Thoại (`Workflow Node Dialog`)

- **Menu nối nhanh (`workflow_quick_connect`):** Chụp riêng menu chọn chức năng khi kéo port; tìm kiếm giữ bộ lọc tương thích theo chiều kết nối, cuộn độc lập với canvas.
- **Bản nháp & Xem trước (`Draft & Copy-on-Write Preview`):**
  - Hộp thoại cấu hình node (`Đầu vào → Thông số → Đầu ra`) dùng bản nháp riêng: preview tính ngay khi mở và gộp chỉnh liên tiếp sau `80ms`; sửa ghi chú không tính lại preview.
  - Bấm **Áp dụng** ghi 1 bước Undo; bấm **Hủy / Escape / Đóng** bỏ bản nháp.
  - MCP: `set_workflow(node_id, node_params: JSON, apply_node: true)` áp dụng nguyên tử (atomic); giữ nguyên các lựa chọn `false`/rỗng tường minh. `connect_workflow_ports(action: "auto_wire")` dùng chung logic tự nối dây hợp lệ với UI (không nối chéo cảnh).
- **Vùng chụp MCP:** `workflow_node_config`, `workflow_node_input`, `workflow_node_operation`, `workflow_node_connections`, `workflow_node_output`, `workflow_node_camera_preview`, `workflow_node_settings`, `workflow_node_scope_picker`, `workflow_node_edit_context`, `workflow_node_advanced`, `workflow_node_preview_controls`, `workflow_node_preset_picker`, `workflow_node_rule_picker`. Chi tiết: [docs/workflow-node-semantics.md](../workflow-node-semantics.md).

---

## 3. Motion Effect Controls (`Procedural Motion`)

- **Bộ tính chung:** [`src/renderer/src/animation/proceduralMotion.ts`](../../src/renderer/src/animation/proceduralMotion.ts); viewport và luồng xuất video gọi qua `engine/evaluateScene.ts`, đồ thị UI lấy mẫu cùng bộ tính (giá trị `0` được tôn trọng).
- **Giao diện & MCP:** `ui/inspector/sections/MotionSection.tsx`, `MotionParameters.tsx`, `MotionPreview.tsx`, CSS `styles/motion.css`. MCP: `set_layer_motion`, `get_layer_motion` qua `mcp/commands/proceduralMotionCommands.ts`. Regions: `motion`, `motion_preview`, `motion_parameters`, `motion_timing`. Chi tiết: [docs/motion-controls.md](../motion-controls.md).

---

## 4. Logic Trên Timeline, Khung Nhìn Đa Tag & Keyframe Nâng Cao

- **Thêm logic từ Timeline:** Chọn layer/cảnh → **+ Thêm logic** → tìm thao tác → chỉnh thông số và Áp dụng. Dùng chung đồ thị với Workflow V2; MCP `set_workflow(logic_id, layer_id?, shot_id?)`. Vùng chụp: `timeline_logic`, `timeline_logic_picker`.
- **Khung nhìn đa Tag độc lập (`Independent Viewer Tags`):**
  - Bật độc lập các tag `Camera`, `3D`, `Cam 2D`, `Độ sâu 2.5D` (giữ tối thiểu 1 khung: 1 tag toàn vùng, 2 tag chia đôi, 3 tag chia 2 cột, 4 tag chia lưới 2×2).
  - MCP: `set_view(active_views: ["camera", "editor", "animate2d", "topview"])`. Regions: `viewer_stage2d`, `viewer_stage2d_tools`, `viewer_depth`, `viewer_depth_tools`.
- **Chỉnh trực tiếp thuộc tính & Keyframe trên Timeline:**
  - Mở rộng layer để scrub hoặc nhập số cho Vị trí XYZ, Xoay XYZ, Tỉ lệ XY và Độ mờ % (`Shift ×10`, `Alt ×0.1`), dùng chung `AnimRow` với Inspector (`timeline_properties`).
  - Phím tắt mốc: `K` thêm/chọn mốc tại đầu phát, `Shift+K` bắt đầu đoạn mới, `Alt+K` đặt cuối đoạn, `Alt+←/→` nhảy mốc trước/sau, `Delete` xóa mốc.
  - Menu kiểu nội suy (`timeline_motion_popup` / `timeline_key_menu`): Đi mượt (`easeInOut`), Đi đều (`linear`), Giữ rồi nhảy (`hold`), Nhịp đập (`pulse`), Nhấp nháy (`blink`). Thông số lưu tại `Keyframe.easeOptions` (`cycles`, `strength`, `holdUntil`, `duty`); MCP `set_keyframe` hỗ trợ `boundary: start | end`, `ease` và `ease_options`.

---

## 5. Thời Gian Dùng Chung & Nhóm Time Chung (`Shared Time Groups`)

- **Mã nguồn lõi:**
  - [`src/renderer/src/project/workflowTimeGroups.ts`](../../src/renderer/src/project/workflowTimeGroups.ts) (tạo / nối / tách / đổi khoảng / dời nhóm),
  - [`src/renderer/src/project/workflowTimeGroupSync.ts`](../../src/renderer/src/project/workflowTimeGroupSync.ts) (lan truyền khoảng tới mọi thành viên),
  - [`src/renderer/src/project/layerTimeShift.ts`](../../src/renderer/src/project/layerTimeShift.ts) (dời nguyên khối keyframe/hiệu ứng/âm thanh của Layer).
- **Cơ chế đồng bộ:**
  - Sửa Node Time 1 lần → mọi Layer, Logic và mốc lộ trình Camera nối vào đều cập nhật theo. Layer cùng độ dài với nhóm được dời nguyên khối; mốc lộ trình Camera dời kèm hiệu ứng gợn sóng (`ripple`) cho các mốc sau, không vượt qua nhau.
  - Trên Workflow: làn **Thời gian chung** dưới thước (`workflow_time_lanes`), chọn nhiều Node bằng `Ctrl/⌘ + nhấp` hoặc `Shift + kéo khung`, gom nhóm bằng `Ctrl/⌘ + G` (`workflow_selection_bar`, `workflow_time_group`).
  - Trên Timeline: kéo hoặc cắt `IN/OUT` một Layer trong nhóm là sửa cả nhóm; giữ `Alt + kéo` để tách riêng Layer đó. Hỗ trợ chọn nhiều đoạn bất kỳ (`Ctrl + click`) để dịch/căn cùng lúc (`timeline_batch_timing`, MCP `retime_layers`).
- **Lệnh MCP (`time_group` & `retime_layers`):**
  - PowerShell: `pnpm pxs call time_group '{"action":"create","layer_ids":["layer-1","layer-2"],"node_ids":["v2-cam-wp-shot-1-1"]}'`
  - CMD: `pnpm pxs call time_group "{\"action\":\"shift\",\"time_node_id\":\"time-abc\",\"delta\":1.5}"`
  - Flags: `pnpm pxs call time_group --action list`

---

## 6. Chuỗi Motion BBox, Nối Chặng & Va Chạm (`Workflow BBox & Collision`)

- **Phạm vi chỉnh & Focus Node:**
  - Khung Thuộc tính Node chỉ nhận thao tác trên BBox của layer/cụm được nối (giữ `Shift` khi muốn chọn node/BBox khác). Motion BBox chỉ hiển thị tab **Đích** và **Chiều sâu**; thời gian chỉnh thống nhất tại **Từ / Đến** (`workflow_motion_timing`).
  - Tab Vẽ Line và đường cong BBox dùng chung khung chỉnh BBox với thanh công cụ icon ngang bên dưới canvas (`workflow_motion_tools`, lớp nhận nét `workflow_motion_draw`).
- **Nối chặng liên tiếp (`#1 → #2 → #3`):**
  - Bấm **+ Chặng tiếp** hoặc kéo cổng `OUT` của Motion/Va chạm sang node kế tiếp để tạo chặng mới kế thừa vị trí và tỉ lệ cuối của chặng trước (`workflow_bbox_steps`).
  - MCP: `set_workflow` với `follow_up: true`, `node_id`, `step_duration` (mặc định 3s).
- **Va chạm vật lý (`Collision Node`):**
  - Đọc chuyển động thực của cả A và B tại cùng thời điểm (kích thước/pivot/rotation thật và BBox hợp nhất của cụm khoá), kiểm tra đoạn giữa các mẫu để chống xuyên vật nhanh.
  - Chế độ `Giao BBox 2D` bỏ qua Z; `Cùng độ sâu 2.5D` yêu cầu khoảng cách Z `<= 24`. Nếu có quỹ đạo nhưng không giao nhau thì không sinh va chạm giả. Vùng chụp: `workflow_collision_preview`.
  - Mã nguồn: `workflowMotionExecution.ts`, `workflowMotionStart.ts`, `workflowStepGraph.ts`, `workflowTimedSteps.ts`, `workflowBboxContact.ts`, `workflowCollisionResponse.ts`.

---

## 7. Bộ Phận 2.5D Theo Mốc Thời Gian (`2.5D Part Cues`)

- **Cơ chế Hub & Node con:**
  - Hub **Bộ phận: Cụm 2.5D** đóng vai trò điều phối (chọn bộ phận trong hình hoặc danh sách node con).
  - Khung chỉnh bộ phận chạy theo playhead thật (`evaluateScene`), có chế độ **Toàn cảnh** và **Cận cụm** (ẩn cảnh tham chiếu để bộ phận không bị che).
  - Chọn node con → tua Trước/Đầu/Giữa/Cuối/Sau → chỉnh biến thể, ảnh thay thế hoặc kéo bộ phận đổi tư thế X/Y; nút **+ Mốc riêng tại …s** tạo node con mới tại playhead.
- **Đánh giá thời gian chạy (`workflowPartTimeline.ts`):**
  - `patchPartCue` / `addPartCue` dùng chung cho UI và MCP. Mốc dùng khoảng `[Từ, Đến)` theo giây dự án; khi chồng lấn, mốc có `Từ` muộn hơn được ưu tiên; `hold_after_end` giữ biến thể/ảnh/hiển thị sau `Đến`.
- **MCP & Vùng chụp:**
  - Tools: `get_part_cues(node_id, time)`, `set_part_cue`.
  - Regions: `workflow_part_preview`, `workflow_part_stage`, `workflow_part_cues`, `workflow_part_hub`, `workflow_part_editor`.
  - PowerShell: `pnpm pxs call set_part_cue '{"node_id":"part-child-id","action":"add","at":3,"duration":1,"rotation":25,"wave":"hold"}'`
  - CMD: `pnpm pxs call set_part_cue "{\"node_id\":\"part-child-id\",\"action\":\"add\",\"at\":3,\"duration\":1,\"rotation\":25,\"wave\":\"hold\"}"`
  - Flags: `pnpm pxs call set_part_cue --node_id part-child-id --mode part_variant --variant_id variant-layer-id --start 3 --end 4`
