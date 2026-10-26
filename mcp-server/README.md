# Parallax Studio V2 — Model Context Protocol (MCP) Server

### Layer workshop: alpha mesh and soft bones / Mesh alpha và xương mềm

`layer_assembly_rig` with `action: "bind", bone_id, layer_ids, binding_mode: "soft"` deforms visible image triangles with the selected bone branch. Position bones along the image details first, then use `set-key` and `set_layer_assembly_playback`. Transparent holes and separate islands remain cut out. Omit `binding_mode` or use `"rigid"` for legacy whole-layer binding; omit `bone_id` to unbind. Draft history and project insertion retain the binding; saved project meshes animate in MP4 export.

`layer_assembly_rig` với `action: "bind", bone_id, layer_ids, binding_mode: "soft"` uốn các tam giác vùng ảnh hiện hữu theo nhánh xương đã chọn. Đặt khớp dọc chi tiết ảnh trước, rồi dùng `set-key` và `set_layer_assembly_playback`. Giữ nguyên lỗ trong suốt và chi tiết rời. Bỏ `binding_mode` hoặc dùng `"rigid"` để gắn cứng cả layer; bỏ `bone_id` để tháo gắn. Lịch sử bản nháp và thao tác chèn dự án giữ liên kết; mesh đã lưu tiếp tục chuyển động khi xuất MP4.

Tài liệu này cung cấp **đặc tả kỹ thuật toàn diện** và **hướng dẫn tích hợp** dành cho mọi AI Agent (Antigravity, Claude Desktop, Cursor, Cline, Windsurf, RooCode, Copilot...) khi kết nối và điều khiển trực tiếp ứng dụng **Parallax Studio V2**.

---

## 1. Kiến Trúc Hoạt Động (Architecture)

### Image mesh recipes / Công thức mesh ảnh

`list_assembly_templates` exposes `imageMesh` and image slot IDs. `get_assembly_template` returns render prompts, canvas ratios, face mappings, geometry, mesh settings and variants. Bind images with `apply_assembly_template {template_id, variant_id, images:{slot_id:asset_path}}`; tune existing images with `update_assembly_face` mesh/grid/bend/depth parameters. Repeated slots share an image; append never changes existing faces. See [workflow and examples](../docs/image-mesh-templates.md).

`list_assembly_templates` trả cờ `imageMesh` và ID bộ phận ảnh. `get_assembly_template` trả prompt render, tỷ lệ canvas, ánh xạ mặt, hình học, thiết lập mesh và biến thể. Gắn ảnh bằng `apply_assembly_template {template_id, variant_id, images:{slot_id:asset_path}}`; tinh chỉnh ảnh có sẵn bằng tham số mesh/grid/bend/depth của `update_assembly_face`. Bộ phận lặp dùng chung ảnh; append giữ nguyên các mặt cũ. Xem [quy trình và ví dụ](../docs/image-mesh-templates.md).

```
[ AI Agent / LLM Client ]
          │ (stdio - JSON-RPC 2.0)
          ▼
[ mcp-server/index.mjs ]
          │ (TCP localhost:9877 - JSON Lines + Bearer Token)
          ▼
[ Electron Main Process (McpBridge) ]
          │ (Electron IPC)
          ▼
[ Renderer Process (Three.js Engine & Zustand State) ]
```

- **Tiêu chuẩn:** Model Context Protocol (MCP) do Anthropic chuẩn hóa.
- **Giao tiếp ngoài:** Client khởi chạy `node mcp-server/index.mjs` qua `stdio`.
- **Giao tiếp nội bộ:** Server chuyển tiếp lệnh qua socket TCP nội bộ `127.0.0.1:9877` tới Electron app.
- **Bảo mật (Token):** Token xác thực được lưu tự động trong file `<userData>/parallax-studio/mcp.json`. Chỉ tiến trình cùng tài khoản người dùng trên hệ điều hành mới có thể đọc token này.

---

## 2. Cấu Hình Kết Nối (Client Configurations)

### 2.1. Cấu hình cho Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "parallax-studio": {
      "command": "node",
      "args": [
        "d:/_DuAn/App_Desktop/parallax-studio-v2/mcp-server/index.mjs"
      ]
    }
  }
}
```

### 2.2. Cấu hình cho Cursor (`.cursor/mcp.json` hoặc User Settings)
```json
{
  "mcpServers": {
    "parallax-studio": {
      "command": "node",
      "args": [
        "d:/_DuAn/App_Desktop/parallax-studio-v2/mcp-server/index.mjs"
      ]
    }
  }
}
```

### 2.3. Cấu hình cho Cline / Roo Code / Antigravity (`mcp_config.json`)
```json
{
  "mcpServers": {
    "parallax-studio": {
      "command": "node",
      "args": ["mcp-server/index.mjs"]
    }
  }
}
```

---

## 3. Hệ Tọa Độ & Nguyên Lý Không Gian 2.5D (Spatial Rules)

Khi sắp xếp layer hoặc camera trong Parallax Studio, AI cần nắm rõ quy ước không gian:
- **Đơn vị thế giới (World Units):** Trực tiếp tương ứng pixel của Composition (mặc định 1920×1080).
- **Trục X:** Chiều ngang. Sang phải là giá trị dương (`+X`), sang trái là giá trị âm (`-X`).
- **Trục Y:** Chiều đứng. Đi lên trên là giá trị dương (`+Y`), đi xuống dưới là giá trị âm (`-Y`).
- **Trục Z (Độ sâu Parallax):** Càng ra xa camera, giá trị Z càng lớn:
  - **Tiền cảnh (Foreground):** `Z = -300` đến `0` (vật thể trôi gần ống kính nhất, tốc độ di chuyển nhanh nhất).
  - **Mặt phẳng tiêu điểm gốc (Focus Plane):** `Z = 0` (layer giữ nguyên tỷ lệ scale pixel 1:1).
  - **Trung cảnh (Midground):** `Z = 300` đến `800` (nhân vật, cây cối, địa hình chính).
  - **Hậu cảnh (Background):** `Z = 1000` đến `2500` (núi non xa xăm, cảnh quan nền).
  - **Bầu trời / Vòm thiên cầu (Sky Plane):** `Z = 3000` trở lên (gần như đứng yên khi camera di chuyển).

---

## 3b. Tài Liệu AI Song Ngữ Anh / Việt (Bilingual Docs)

- **Nguồn duy nhất:** `mcp-server/catalog/` — mỗi tool khai báo cả hai ngôn ngữ cạnh nhau (`doc: L(en, vi)`, tham số `d(en, vi)`), hướng dẫn AI nằm ở `catalog/guide.json`. MCP server, CLI `pnpm pxs`, schema Antigravity và dialog MCP trong app đều đọc từ đây nên không thể lệch nhau.
- **Công tắc trong app:** Dialog **Cấu hình MCP** → "Tài liệu AI bằng tiếng Anh (khuyến nghị)". **Mặc định BẬT = tiếng Anh** (AI gọi tool chính xác nhất); TẮT = tiếng Việt. Lựa chọn lưu vào `mcp.json` (`docsLang`).
- **Áp dụng trực tiếp:** MCP server theo dõi `mcp.json`; khi đổi ngôn ngữ, mô tả tool và tham số được đăng ký lại và client nhận `notifications/tools/list_changed` (client cũ chỉ cần kết nối lại). Tool `get_ai_guide {topic}` luôn trả về hướng dẫn theo ngôn ngữ hiện tại.
- **Ưu tiên:** biến môi trường `PARALLAX_MCP_LANG=en|vi` > `docsLang` trong `mcp.json` > `en`. CLI có thêm cờ `--lang en|vi`.
- **Đồng bộ bắt buộc:** `catalog/catalog.test.mjs` kiểm tra hai bản có cùng tool, cùng schema tham số, cùng số dòng hướng dẫn và `toolCount` khớp. Khi thêm/sửa tool: sửa spec trong `catalog/tools-*.mjs` (cả 2 ngôn ngữ), chạy `pnpm test`, rồi `pnpm mcp:schemas` để sinh lại schema Antigravity.

---

## 3c. Quy Tắc Kiểm Thử Trực Tiếp & Cấm Can Thiệp Tiến Trình App Đang Chạy

Khi kiểm tra và tương tác với Parallax Studio, AI Agent **BẮT BUỘC** tuân thủ các nguyên tắc sau:
1. **Tuyệt đối KHÔNG tự ý kill/tắt tiến trình Electron của người dùng (`Stop-Process electron`, `kill`):** Người dùng đang trực tiếp mở và theo dõi ứng dụng trên terminal launcher của họ (`pnpm dev`). Việc tắt tiến trình sẽ làm sập cửa sổ người dùng đang làm việc.
2. **Tuyệt đối KHÔNG tự spawn thêm tiến trình dev ngầm trùng lặp (`electron-vite dev`):** Tránh gây xung đột cổng TCP 9877, chiếm dụng GPU/RAM và gây sai lệch trạng thái hiển thị.
3. **Bắt buộc sử dụng trực tiếp app đang chạy của người dùng:** Ứng dụng luôn mở sẵn cổng TCP `127.0.0.1:9877`. AI kết nối thẳng vào cổng này (`pnpm pxs status`, `pnpm pxs review --view app`, `pnpm pxs call ...`) để kiểm tra, thao tác và review bằng mắt. Mọi thay đổi sẽ hiển thị realtime ngay trên màn hình trước mắt người dùng.
4. **Quy tắc Hot-Reload (Vite HMR):** Khi sửa code giao diện (`src/renderer/*`), Vite tự động hot-reload trong vài chục mili-giây mà không cần khởi động lại app. Khi sửa code tầng `src/main/*` (Electron Main Process) bắt buộc phải restart: AI **phải thông báo rõ ràng để người dùng chủ động khởi động lại từ terminal của họ**, tuyệt đối không tự ý cưỡng ép tắt tiến trình OS.

---

## 4. Danh Sách 78 Công Cụ MCP (Core Tool Reference)

> Danh mục đầy đủ, chính xác từng tham số: `pnpm pxs --help` và `pnpm pxs help <tool>` (sinh từ catalog). Phần dưới đây là tóm tắt.

### 4.1. Nhóm Truy Vấn & Thống Kê (Inspection)
- `get_project_info`: Lấy thông tin tổng thể dự án (composition, danh sách shots, layer, camera, look, asset).
- `get_shot_info`: Xem chi tiết 1 cảnh và tất cả layer thuộc cảnh đó.
- `get_layer_info`: Đọc toàn bộ thuộc tính, keyframes và transform của 1 layer.
- `get_camera_info`: Đọc trạng thái vị trí, mục tiêu, FOV của camera tại thời điểm `time`.
- `get_memory_stats`: Kiểm tra dung lượng VRAM GPU, texture pool và RAM tiến trình.
- `get_app_screenshot`: Chụp toàn bộ cửa sổ app hoặc chụp theo vùng UI chuyên biệt giúp AI tiết kiệm 70% – 95% token so với chụp toàn màn hình:
  - Cột trái & tài nguyên: `left_panel`, `assets`, `asset_grid` (lưới card tài nguyên), `asset_bar` (thanh icon danh mục), `music` (bảng quản lý audio), `shots` (danh sách cảnh), `topview` (sơ đồ độ sâu 2.5D).
  - Khung nhìn trung tâm: `viewer`, `viewer_canvas` / `viewport`, `camera_frame` (khung viền render), `viewer_hud` (thông số FPS/VRAM), `viewer_tools` (chế độ camera/3D).
  - Thuộc tính bên phải: `inspector`, `inspector_tabs`, `inspector_body` (form chỉnh sửa chi tiết), `inspector_composite` (mục `Cụm Layer Chồng`), `inspector_physics` (mục `Vật lý Chất liệu & Tương tác 2.5D`), `inspector_virtual_light` (mục `Lối Vào Hang Động & Công Cụ Ánh Sáng Ảo 2.5D`), `composite_swap` (bộ đổi nhanh biểu cảm/bộ phận).
  - Dòng thời gian & Workflow Studio: `timeline`, `timeline_toolbar` (cụm nút phát/timecode), `timeline_tabs` (công tắc 2 tab Timeline / Workflow), `timeline_ruler` (thước đo), `timeline_tracks` (các hàng track layer & keyframe), `timeline_workflow` (toàn bộ tab Workflow), `workflow_toolbar` (thanh mẫu quy trình 1-click, phạm vi Phân cảnh & nút Áp dụng Workflow), `workflow_palette` (cột trái thư viện Node Logic kèm preview trực quan), `workflow_canvas` (bàn kết nối cổng Node-Port kéo 4 hướng), `workflow_canvas_hud` (thanh công cụ dọc dạng icon Kéo cả cụm / Căn gọn / Khớp khung / Zoom), `workflow_inspector` (cột cấu hình khối & 2.5D chia 3 sub-tab gọn gàng), `workflow_ruler` (thước thời gian Workflow V2: kim phát + khoảng mốc của Node đang chọn), `workflow_spawn_menu` (menu gắn nhanh Node Logic khi thả dây từ Layer ra khoảng trống), `workflow_legend` (chú giải loại dây: cấu trúc / logic / chất liệu → va chạm / camera chuyển cảnh / đang chạy), `workflow_target_binder` (bảng gán Layer 2.5D & bộ phận con), `workflow_action_builder` (bảng chip icon thêm nhanh chuyển động & ánh sáng 2.5D), `workflow_preview` (ô mô phỏng chức năng trực quan), `workflow_json_panel` (trình biên tập JSON Workflow & AI Blueprint).
  - Thanh tiêu đề: `toolbar`, `studio_menu` (menu Studio & Đạo diễn), `mcp_chip` (chỉ báo AI), `remote_chip` (nút QR Remote điều khiển qua điện thoại), `ai_hud` (badge viền neon).
  - Hộp thoại: `active` (tự chọn dialog/modal **nổi trên cùng** đang hiển thị — ví dụ Studio Mixamo mở trên Xưởng Lắp Ráp Layer thì chỉ chụp Studio Mixamo; nên dùng ngay sau khi mở bất kỳ hộp thoại nào), `dialog` (cũng chọn dialog trên cùng thay vì phần tử khớp đầu tiên).
  - Xưởng 3D & từng cột: `assembly_3d` (toàn bộ), `assembly_sidebar` (cột trái tài nguyên/mặt), `assembly_viewport` (cột giữa 3D/2D), `assembly_inspector` (cột phải thuộc tính), `assembly_header`, `assembly_footer`, `assembly_hud`.
  - Xưởng Layer 2.5D & từng cột: `layer_assembly` (toàn bộ), `layer_assembly_sidebar` (cột trái kho mẫu/layer), `layer_assembly_workspace` (cột giữa canvas), `layer_assembly_inspector` (cột phải rig/xương/motion), `layer_assembly_tools`, `layer_assembly_header`, `layer_assembly_toolbar`, `layer_assembly_viewport_2d`, `layer_assembly_viewport_3d`, `layer_assembly_layers`, `layer_assembly_parts` (nhóm bộ phận), `layer_assembly_properties`, `layer_assembly_physics` (nhãn vật lý, sub-mesh, cửa hang & ánh sáng ảo), `layer_assembly_swap` (slot hoán đổi), `layer_assembly_rig_panel`, `layer_assembly_animation_panel`, `layer_assembly_retarget`, `layer_assembly_create`, `layer_assembly_confirm`, `layer_assembly_cutter`, `layer_assembly_source`, `layer_assembly_target`, `layer_assembly_motion_sketch`, `layer_assembly_anim_tools`, `layer_assembly_pose_tools`, `layer_assembly_anim_chips`, `layer_assembly_anim_assist`, `layer_assembly_anim_secondary`, `layer_assembly_plant_motion`, `layer_assembly_plant_graph`, `layer_assembly_plant_chips`, `layer_assembly_plant_panel`.
  - Studio Mixamo (modal lồng trong Xưởng Layer): `layer_assembly_mixamo_card`, `layer_assembly_mixamo_studio`, `layer_assembly_mixamo_stage`, `layer_assembly_mixamo_sidebar`.
  - Audio Studio & từng cột: `audio_studio` (toàn bộ), `audio_studio_sidebar` (cột trái danh sách luồng âm), `audio_studio_editor` (cột phải trình biên tập), `audio_studio_waveform` (biểu đồ sóng âm), `audio_studio_tone` (âm điệu & EQ), `audio_studio_mixer` (bộ trộn âm lượng), `audio_studio_console` (bàn trộn đa luồng).
  - Hiệu năng & bộ nhớ: `perf_dialog` (toàn bộ), `perf_hardware` (khối CPU/GPU/RAM), `perf_meter` (thước đo VRAM thời gian thực), `perf_settings` (cấu hình VRAM).
  - Xuất video MP4: `export` / `export_dialog`, `export_preview` (khung hình render).
  - Lộ trình & đường vẽ Camera: `camera_path`, `camera_path_presets`, `camera_path_steps`, `camera_sketch`, `camera_sketch_canvas`, `camera_sketch_sidebar`, `camera_sketch_waypoints`.
  - Bảng điều khiển MCP & QR Remote Wi-Fi LAN: `mcp_dialog`, `mcp_status`, `mcp_config`, `mcp_guide`, `remote_dialog` (hộp thoại điều khiển qua điện thoại), `remote_qr_card` (cột mã QR & IPv4 LAN), `remote_touchpad_card` (cột Touchpad 3D Camera & Layer).
  - Hỗ trợ `selector` CSS tuỳ chỉnh và `padding` đệm viền. Dùng CLI: `pnpm pxs review --view app --region <name>`. Quy trình gợi ý: `active` ngay sau khi mở dialog → sub-region chính xác khi soi một control.
  - **Đăng ký vùng mới (bắt buộc):** phần tử gốc gắn class ngữ nghĩa + `data-mcp-region="<ten>"` (modal lồng thêm `data-mcp-dialog`); thêm vào `UI_REGION_SELECTORS` trong [`uiRegions.ts`](../src/renderer/src/mcp/uiRegions.ts) và enum `region` ở [`catalog/tools-scene.mjs`](./catalog/tools-scene.mjs); chạy `pnpm mcp:schemas` và `pnpm test` (test parity [`uiRegions.test.ts`](../src/renderer/src/mcp/uiRegions.test.ts) FAIL nếu thiếu). Chi tiết: [skill `mcp-ui-region`](../.agents/skills/mcp-ui-region/SKILL.md).
- `get_ui_state`: Tra cứu trạng thái giao diện hiện tại (`theme`, `dialog`, `audio_dialog_mode`, `left_tab`, `timeline_tab`, `primary_view`, `split_view`, `top_view_mode`, `assembly_workshop_open`, `layer_assembly_open`, `ai_active`, `ai_locked`).
- `set_ui_dialog`: Mở, chuyển đổi hoặc đóng bất kỳ hộp thoại/xưởng UI nào (`dialog`: `'none' | 'path' | 'sketch' | 'performance' | 'mcp' | 'remote' | 'audio' | 'export' | 'layer_assembly' | 'layer_assembly_create'`), chuyển chế độ Audio Studio (`audio_mode`: `'waveform' | 'levels' | 'mixer'`), chuyển tab cột trái (`left_tab`: `'shots' | 'assets' | 'topview'`), chuyển tab dưới cùng (`timeline_tab`: `'timeline' | 'workflow'`), hoặc đổi giao diện Sáng/Tối (`theme`: `'dark' | 'light'`).
- `get_remote_state` / `remote_control_action`: Đọc trạng thái rút gọn và thực thi thao tác điều khiển từ xa qua điện thoại / mạng Wi-Fi LAN (`http://<LAN-IP>:9878/?t=<token>`), bao gồm Touchpad 3D Camera (`pan`, `dolly`, `orbit`), dịch chuyển/xoay/scale Layer 2.5D (`nudge_layer`, `set_layer_transform`), chọn cảnh, phát/dừng Timeline, tạo Keyframe và Undo/Redo.
- `set_ai_lock`: Bật/tắt trạng thái khoá tương tác an toàn (`locked: boolean`, `reason`, `timeout_ms`) ngăn người dùng vô tình bấm làm lệch UI khi AI đang tự động thao tác. App sẽ hiển thị viền neon cyberpunk xung quanh và badge HUD kèm nút mở khoá khẩn cấp (`Esc`).
- `ui_click` / `ui_type`: Bấm phần tử UI theo chữ hoặc CSS selector, nhập ô input – để AI tự mở dialog, chuyển tab rồi chụp kiểm tra.
- `get_ai_guide`: Đọc hướng dẫn AI theo ngôn ngữ tài liệu đang chọn (`topic`: overview, coordinates, workflow, assembly, tips). Trả lời tại chỗ, không cần app.

### 4.2. Nhóm Dự Án & Phân Cảnh (Project & Shots)
- `new_project`: Khởi tạo dự án mới trống.
- `set_composition`: Thay đổi độ phân giải (width, height, fps, duration).
- `save_project` / `open_project`: Lưu hoặc mở file `.pxs`.
- `import_project_json` / `export_project_json`: Xuất / nhập dự án dạng JSON phi cấu trúc.
- `add_shot`: Thêm một phân cảnh mới (cung cấp `name`, `duration`, `position`).
- `update_shot`: Đổi tên, thời lượng, màu sắc, vị trí của shot.
- `delete_shot`: Xóa shot khỏi dự án.

### 4.3. Nhóm Thêm & Chỉnh Sửa Layer (Layers & Parallax Depth)
- `add_image_layer`: Đặt ảnh vào không gian 3D. Nhận `file_path`, `z`, `position` `[x, y, z]`, `scale`, `opacity`.
- `add_text_layer`: Thêm layer chữ (hỗ trợ font Google Fonts, size, color, tracking).
- `add_solid_layer`: Thêm màu nền hoặc dải gradient 3D.
- `add_ground_layer`: Tạo mặt sàn / nền đất nằm ngang 3D (`orientation: "ground"`).
- `add_particles`: Thêm hiệu ứng hạt tự động (bụi lấp lánh, đom đóm, tuyết rơi).
- `update_layer`: Cập nhật vị trí, góc xoay, độ trong suốt, chế độ hòa trộn (`blend_mode`).
- `delete_layer`: Xóa layer.
- `move_layer`: Đưa layer lên/xuống trong chồng layer của shot (`direction`: `up` | `down`).
- `split_layer`: Cắt layer thành 2 đoạn tại `time`.
- `replace_layer_asset`: Thay ảnh nguồn, giữ nguyên transform, keyframe, hiệu ứng.
- `apply_layer_fx` / `toggle_layer_fx` / `remove_layer_fx` / `set_layer_glow`: Preset hiệu ứng (fadeIn, shake, neon…) và viền neon theo alpha.

### 4.4. Nhóm Hoạt Ảnh & Keyframes (Animation)
- `set_keyframe`: Đặt keyframe hoạt ảnh tại giây `time` với curve easing (`linear`, `easeInOut`, `hold`...).
- `remove_keyframe` / `clear_keyframes`: Xóa keyframe hoặc làm sạch toàn bộ timeline của thuộc tính.

### 4.5. Nhóm Camera, Đường Bay 3D & Quy Trình Tạo Video (Camera Path & Workflow Studio)
- `set_camera`: Đặt vị trí camera (`position`), điểm ngắm (`target`), góc nhìn (`fov`).
- `apply_camera_preset`: Áp dụng chuyển động mẫu (`dollyIn`, `dollyOut`, `truckLeft`, `truckRight`, `craneUp`, `craneDown`, `orbitLeft`, `orbitRight`, `zoomIn`, `dollyZoom`, `reset`).
- `camera_fly_to_shot`: Hướng camera bay trực tiếp tới bao quát phân cảnh chỉ định.
- `build_camera_path`: Tự động sinh đường bay Bezier mượt mà kết nối liên tục tất cả các shot.
- `list_workflow_presets`: Liệt kê 5 mẫu quy trình tạo video chuyên nghiệp, 7 khối tác nhân chức năng và 6 cổng kết nối.
- `get_workflow`: Lấy sơ đồ Workflow JSON hiện tại kèm bản thiết kế tác nhân logic AI (`aiBlueprint`) mô tả vai trò từng tác nhân (`SceneLayoutAgent`, `AssemblyRigAgent`, `MotionChoreographyAgent`, `PhysicsLightFxAgent`, `CameraDirectorAgent`, `AudioLipSyncAgent`, `ColorGradingRenderAgent`), các cổng kết nối và chuỗi lệnh MCP tương ứng.
- `set_workflow`: Cấu hình quy trình từ mẫu (`preset_id`), từ chuỗi/đối tượng JSON (`workflow`), hoặc cập nhật preset từng khối chức năng.
- `connect_workflow_ports`: Kết nối, ngắt kết nối hoặc tự động nối dây toàn tuyến (`auto_wire`) các cổng dữ liệu giữa các khối chức năng.
- `apply_workflow`: Thực thi ngay quy trình tạo video đã kết nối lên dự án hiện tại (tự động dàn chiều sâu Z, lắp ráp 2.5D/3D, gán chuyển động, vật lý/ánh sáng ảo, tạo đường bay camera, gắn lip-sync âm thanh và chỉnh màu hậu kỳ trong một bước).

### 4.6. Nhóm Xử Lý & Dàn Dựng Âm Thanh Đa Luồng (Audio Tracks)
- `set_audio`: Đặt hoặc xóa nhạc nền chính (`file_path`, `offset`, `volume`, `remove`).
- `get_audio_info`: Lấy thông tin chi tiết toàn bộ các tracks âm thanh trên timeline (thời lượng, offset, volume, speed, fade...).
- `add_audio_track`: Thêm đoạn âm thanh từ file (`file_path`) hoặc asset có sẵn (`asset_id`) tại mốc thời gian `offset`.
- `update_audio_track`: Cập nhật thuộc tính của track (`volume`, `offset`, `playback_rate`, `fade_in`, `fade_out`, `gain_db`, `muted`...).
- `delete_audio_track`: Xóa một track âm thanh khỏi timeline theo ID.
- `duplicate_audio_track`: Nhân bản một đoạn âm thanh lùi sau một khoảng thời gian `offset_delta` (mặc định 0.5s).
- `split_audio_track`: Cắt đôi một đoạn âm thanh tại mốc thời gian `split_time` (mặc định tại con trỏ playhead).
- `merge_audio_tracks`: Hòa âm và gộp nhiều tracks (hoặc tất cả các tracks) thành 1 file WAV tổng hợp trong dự án.

### 4.7. Nhóm Xưởng Lắp Ráp 3D & Mô Hình Origami (3D Assembly Workshop)
- `list_models3d`: Liệt kê tất cả các mô hình 3D origami có trong thư viện và đĩa lưu trữ.
- `get_model3d`: Lấy chi tiết toàn bộ các mặt phẳng, toạ độ, hình học và ánh sáng của một mô hình 3D.
- `get_assembly_state`: Đọc trạng thái thời gian thực của cửa sổ Xưởng Lắp Ráp 3D (mô hình đang sửa, mặt đang chọn).
- `save_assembly_model`: Lưu hoặc cập nhật mô hình 3D vào bộ nhớ lưu trữ và tệp catalog.
- `insert_assembly_model`: Chèn mô hình 3D vào cảnh hiện tại thành các layer 2.5D trong không gian.
- `add_assembly_face`: Thêm một mặt phẳng 3D mới vào mô hình đang mở.
- `update_assembly_face`: Cập nhật thuộc tính của một mặt phẳng (vị trí, xoay, kích thước, ảnh texture, mặt cắt clip_by).
- `delete_assembly_face`: Xoá một mặt phẳng khỏi mô hình 3D.
- `join_assembly_faces`: Ghép hít 2 mặt phẳng tại cạnh (tự động giãn cạnh ngắn khớp với cạnh dài nhất để triệt tiêu khe hở).
- `auto_assembly_clip`: Tự động tính toán các mặt phẳng cắt giao nhau (ẩn phần tường/mái vượt qua nhau).
- `set_assembly_lighting`: Thiết lập hướng nắng mặt trời, đổ bóng râm dịu và tông màu ánh sáng theo giờ.
- `list_assembly_templates`: Liệt kê khuôn mẫu (nhãn Anh/Việt, số mặt, điểm neo của bộ phận trang trí), lọc theo `category`: `architecture` (khung nhà chỉ tường + mái), `decor` (cửa sổ, cửa ra vào, ống khói, cột, ban công, bồn hoa, chậu cây, đèn, biển, mái hiên, hàng rào), `props`, `nature`, `stage`.
- `apply_assembly_template`: Áp dụng khuôn mẫu hình học dựng sẵn (khung nhà, bộ phận trang trí, hộp, lều, tháp…) mà vẫn bảo toàn ảnh texture của người dùng.
- `append_assembly_model`: Ghép một mô hình **đã lưu** (thường là bộ phận `decor`) vào mô hình đang lắp: gắn lên mặt `face_id` tại `uv`, đặt tại điểm `at`, hoặc đặt cạnh mô hình. Tự khớp tỉ lệ, sinh id mới, ánh xạ lại `clipBy`.
- `get_assembly_screenshot`: Chụp ảnh khung nhìn xưởng lắp ráp 3D đang mở (hỗ trợ các preset góc nhìn `iso`, `front`, `left`, `right`, `top`, `frame_face_id`, `auto_fit`).
- `set_assembly_camera`: Điều khiển camera xưởng 3D (preset góc nhìn, xoay azimuth/elevation, khoảng cách radius, tâm nhìn target, căn khung theo mặt hoặc toàn bộ mô hình).
- `open_assembly_workshop`: Mở modal Xưởng Lắp Ráp 3D trên màn hình ứng dụng để chỉnh sửa thời gian thực (realtime) cho người dùng quan sát (`model_id`, `template_id`, `name`).
- `close_assembly_workshop`: Đóng cửa sổ Xưởng Lắp Ráp 3D (tùy chọn tự chụp ảnh preview sạch và lưu lại nếu `save: true`).
- `set_assembly_face_image`: Gán ảnh chất liệu texture (`asset_path` tương đối hoặc `image_data_url` base64) cho một mặt phẳng 3D và tùy chọn cập nhật kích thước theo ảnh.

**Hai chế độ làm việc cho AI (Realtime vs Headless/Ngầm):**
- **Chế độ Realtime trực quan (Interactive on-screen):** Khi người dùng muốn xem AI thao tác lắp ráp trực tiếp, AI gọi `open_assembly_workshop` để mở dialog trên màn hình app → thao tác từng bước thêm mặt (`add_assembly_face`), gán ảnh đã tách nền (`set_assembly_face_image`), ghép cửa sổ/ống khói/cây cối (`append_assembly_model`) → người dùng thấy cảnh 3D biến đổi theo thời gian thực → `close_assembly_workshop {save: true}` tự chụp thumbnail sạch không mesh/trục và lưu lại.
- **Chế độ Tạo ngầm (Headless background):** Khi người dùng ở màn hình chính yêu cầu tạo tài nguyên dạng ẩn, AI không cần mở dialog UI mà gọi trực tiếp `save_assembly_model` (lưu ngầm vào thư viện), hoặc gọi `insert_assembly_model` / `add_image_layer` / `add_particles` / `set_keyframe` để tạo cây cỏ, hoạt ảnh chuyển động và chèn thẳng vào cảnh phân cảnh hiện tại.

### 4.8. Nhóm Điều Khiển Timeline & Xuất Video (Playback & Export)
- `set_time`: Di chuyển con trỏ thời gian (playhead) tới giây `time`.
- `set_playing`: Phát hoặc tạm dừng phát hoạt ảnh.
- `export_video`: Xuất toàn bộ hoặc 1 shot ra file video MP4 hoàn chỉnh bằng FFmpeg.
- `execute_script`: Thực thi khối lệnh kịch bản hàng loạt.

---

## 5. Quy Trình Mẫu Cho AI Tự Động Dựng Video (Agent Workflow Example)

Khi người dùng yêu cầu: *"Dựng cho tôi một cảnh thành phố đêm mưa có chiều sâu 2.5D và camera bay từ từ tới trước"*, AI thực hiện theo 6 bước:

```ts
// Bước 1: Khởi tạo phân cảnh
await add_shot({ name: "Cyber City Night", duration: 8 });

// Bước 2: Thêm lớp nền Bầu Trời (xa nhất, di chuyển cực chậm)
await add_image_layer({
  file_path: "assets/city/sky_night.png",
  z: 3200,
  name: "Night Sky"
});

// Bước 3: Thêm các tòa nhà cao tầng Hậu Cảnh
await add_image_layer({
  file_path: "assets/city/skyscrapers_far.png",
  z: 1400,
  name: "Far Towers"
});

// Bước 4: Thêm đường phố và xe cộ Trung Cảnh
await add_image_layer({
  file_path: "assets/city/street_mid.png",
  z: 450,
  name: "City Street"
});

// Bước 5: Thêm lan can và hạt mưa Tiền Cảnh (gần mắt nhất)
await add_image_layer({
  file_path: "assets/city/balcony_fg.png",
  z: -180,
  name: "Balcony Foreground"
});
await add_particles({ preset: "rain", density: 150 });

// Bước 6: Đặt chuyển động Camera đẩy tới trước (Dolly In)
await set_keyframe({ prop: "camera.position", time: 0, value: [0, 0, -1800] });
await set_keyframe({ prop: "camera.position", time: 8, value: [0, 20, -1100], easing: "easeInOut" });

// Bước 7: Chụp ảnh preview kiểm tra kết quả
const preview = await get_viewport_screenshot({ view: "camera", time: 4 });
```

---

## 6. Tiết Kiệm Tài Nguyên Khi Không Dùng (Resource Management)

- **Ngắt kết nối client:** Khi AI Agent đã hoàn tất việc dựng cảnh, client nên đóng socket hoặc người dùng có thể bấm nút **"Ngắt kết nối"** ngay trên giao diện để giải phóng RAM/CPU.
- **Tạm dừng server:** Người dùng có thể bật/tắt lắng nghe MCP bằng cách bấm vào chip **MCP** ở góc phải thanh công cụ.

---

## 7. CLI Controller Cho AI & Terminal (`pnpm pxs`)

Bên cạnh giao thức MCP stdio tiêu chuẩn, Parallax Studio V2 cung cấp bộ điều khiển dòng lệnh **CLI Controller** cực kỳ tiện lợi tại `mcp-server/cli.mjs` hoặc qua lệnh rút gọn `pnpm pxs`:

### 7.1. Lệnh Trợ Giúp & Tra Cứu Toàn Diện (`--help` / `help`)
```bash
# Xem quy ước tọa độ 2.5D, danh mục 75 công cụ, quy trình dựng cảnh và lắp ráp 3D:
pnpm pxs --help
pnpm pxs --help --lang vi        # bản tiếng Việt (mặc định theo công tắc trong dialog MCP)

# Tra cứu tham số (kiểu, bắt buộc/tùy chọn, mô tả) và ví dụ gọi của 1 công cụ:
pnpm pxs help add_image_layer
pnpm pxs help append_assembly_model

# Đọc hướng dẫn AI (all | overview | coordinates | workflow | assembly | tips):
pnpm pxs guide assembly

# Sinh lại schema tool cho Antigravity (~/.gemini/antigravity-ide/mcp/parallax-studio):
pnpm mcp:schemas
```

`pnpm pxs call` kiểm tra tham số theo schema thật của tool trước khi gửi lệnh tới app.

### 7.2. Kiểm Tra Trạng Thái Ứng Dụng Realtime (`status`)
```bash
pnpm pxs status
```
*In ra: Trạng thái kết nối, tên composition, tỷ lệ khung hình, FPS, số shot, số layer, và GPU VRAM.*

### 7.3. Trích Xuất Dữ Liệu Dự Án Hiện Tại (`inspect`)
```bash
pnpm pxs inspect
```
*In ra toàn bộ JSON của project đang mở (shots, layers, cameras, keyframes) để AI nắm bắt ngữ cảnh hiện tại.*

### 7.4. AI Xem Review Cảnh Trực Quan Mắt Thấy Tai Nghe (`review`)
```bash
# Chụp ảnh góc nhìn Camera tại thời điểm hiện tại:
pnpm pxs review --view camera --out artifacts/preview.png

# Chụp ảnh góc nhìn không gian 3D tại giây thứ 3.5:
pnpm pxs review --view 3d --time 3.5 --out artifacts/preview_3d.png
```
*Sau khi chạy, AI Agent có thể gọi ngay công cụ `view_file` trên file ảnh `artifacts/preview.png` để phân tích bố cục hình ảnh trực tiếp.*

### 7.5. Thực Thi Lệnh Tạo / Sửa Cảnh Realtime (`call`)
AI Agent hoặc lập trình viên có thể bắn trực tiếp các thao tác tạo/sửa layer, shot, keyframe theo thời gian thực như người dùng thao tác trên giao diện:
```bash
# Thêm layer ảnh vào hậu cảnh Z = 1500
pnpm pxs call add_image_layer '{"file_path": "D:/images/sky.png", "z": 1500, "name": "Sky"}'

# Di chuyển layer sang tọa độ mới
pnpm pxs call update_layer '{"layer_id": "layer-1", "position": [100, 50, 800]}'

# Thêm tuyết rơi
pnpm pxs call add_particles '{"count": 400, "velocity": [0, -40, 0], "twinkle": true}'

# Gắn cửa sổ đã lưu lên tường trước của khung nhà đang mở trong xưởng
pnpm pxs call append_assembly_model '{"source_model_id": "model-window-1", "face_id": "face-front", "uv": [0.25, 0.55]}'

# Chạy timeline xem thử
pnpm pxs call set_playing '{"playing": true}'
```

> Trên Windows PowerShell 5, dấu nháy kép trong JSON có thể bị bỏ khi truyền cho chương trình ngoài — dùng file: `pnpm pxs call add_shot @params.json`.


### Layer transform gizmos

Camera/3D/split view now exposes XYZ position axes, anchor-centered bbox scaling and XYZ rotation rings. These author existing transform properties, available through `update_layer`: `position: [x,y,z]`, `rotation: [rx,ry,rz]` in degrees, `scale: number | [sx,sy,sz]` as multipliers. Static properties update directly; animated properties key at the playhead; `at_time` explicitly inserts a key. Changes support undo/redo.

Example: `pnpm pxs call update_layer '{"layer_id":"layer-1","position":[120,80,400],"rotation":[15,30,45],"scale":[1.5,0.8,1]}'`.

### Layer workshop batch editing

Open `open_layer_assembly`, inspect `get_layer_assembly_state`, then select IDs with `select_layer_assembly_layers`. Use `layer_assembly_action` for alignment, center distribution, depth spacing, duplicate/delete, lock/unlock, hide/show, motion stagger/stop; use `layer_assembly_history` with `undo` or `redo` for draft history. Locked layers are skipped except lock/unlock. An empty selection changes nothing. UI and MCP share the same action implementation.

Mở xưởng, lấy ID lớp, chọn nhiều lớp rồi thao tác hàng loạt qua cùng logic UI. Các lệnh này thay bản nháp và có hoàn tác riêng; chèn vào cảnh vẫn dùng lịch sử dự án. Xem [hướng dẫn](../docs/layer-workshop-tools.md).

### Layer workshop rigging & animation / Xương & chuyển động xưởng layer

Right panel features 3 tabs: Layer (`layers`), Bone Rigging (`bones`), Animation (`animation`). Octahedral bones follow Blender conventions (Head joint pivot, Tail joint tip, faceted shaded 3D-like body, child-parent hierarchy). Edit mode allows dragging Head (position), Tail (length/angle). Pose mode allows interactive rotation on 2D canvas. Procedural animations auto-generate smooth walk cycles, idle breathing, waving, and swaying. When inserted into scenes, skeleton motion bakes into native keyframe tracks.

Cột phải gồm 3 tab: Layer (`layers`), Tạo xương (`bones`), Animation (`animation`). Xương bát diện trực quan theo chuẩn Blender (khớp gốc Head, khớp đuôi Tail, thân khối 3D đổ bóng, phân cấp cha-con). Tab Tạo xương cho phép kéo Head dời vị trí, kéo Tail đổi góc xoay và chiều dài. Tab Animation hỗ trợ kéo xoay xương trực quan trên màn hình 2D (Pose Mode) và tự động sinh chuyển động đi bộ (walk cycle), đứng thở (idle breathe), vẫy tay (wave), uốn lượn (sway). Khi chèn vào phân cảnh, toàn bộ chuyển động xương được bake thành keyframe chuẩn của dự án.
MCP: `layer_assembly_rig`, `set_layer_assembly_playback`, `set_layer_assembly_panel`, `add_layer_assembly_layer`, `update_layer_assembly_layer`, `reorder_layer_assembly_layer`, `update_layer_assembly`, `load_layer_assembly`.

### Part groups & swap slots / Nhóm bộ phận & bộ biến thể đa mảnh

Layers can belong to a part group (e.g. `Đầu` = face, eyes, mouth, glasses, hair, or animal anatomy like `Đuôi`, `Cánh`, `Vây`, `Mõm`, `Sừng`); a locked group moves as one when any member is dragged. Variant sets (`slot`) support both single-layer and multi-layer variants (e.g. an expression variant containing separate `eyes` + `mouth` + `brow` layers): activating one shows all layers of that variant, hides the others and snaps each member to its matching role anchor; replacing a part image keeps its position. Supports drag-and-drop linking of layers or assets onto a group's `Neo` anchor.

Layer có thể thuộc nhóm bộ phận (nhân vật hoặc động vật: Đầu, Đuôi, Cánh, Vây, Mõm, Sừng...); khoá nhóm thì kéo một thành viên sẽ dời cả nhóm, kéo thả tài nguyên vào nhóm sẽ đặt khớp tại `Neo`. Bộ biến thể (`slot`) hỗ trợ biến thể đơn hoặc đa mảnh (ví dụ bộ biểu cảm gồm rời mắt + miệng + lông mày cùng `variant`); kích hoạt biến thể sẽ hiện trọn cụm mảnh của biến thể đó, ẩn biến thể khác và khớp neo từng mảnh theo vai trò. Trong inspector cảnh (mục `Cụm Layer Chồng`) có thể đổi nhanh biểu cảm/bộ phận của nhân vật 2.5D đã đặt.

- `layer_assembly_parts`: `action` = `list` | `auto_detect` | `create_group` | `rename_group` | `delete_group` | `assign` | `set_anchor` | `add_asset_to_group` | `lock_group` | `create_variant_set` | `rename_slot` | `rename_variant` | `dissolve_slot` | `add_to_variant` | `remove_from_slot` | `set_slot` | `activate_variant` | `replace_asset` (có hoàn tác trong lịch sử bản nháp xưởng).
- `swap_composite_part {layer_id, variant_layer_id | asset_path}`: đổi bộ phận/biểu cảm của cụm layer đã đặt trong cảnh (Undo/Redo dự án).
- Vùng chụp: `layer_assembly_parts`, `layer_assembly_swap`, `inspector_composite`, `composite_swap`.


### Layer workshop pixel editor
- Cọ tẩy chỉ hoạt động trong khung chỉnh pixel góc dưới trái; bố cục lớn dùng để xem và chọn layer. Thanh dọc gồm cọ mềm, tẩy nét cứng, bàn tay, vừa khung và khôi phục ảnh gốc. Cuộn để zoom quanh con trỏ; Space + kéo hoặc chuột giữa để dời ảnh. Escape hủy nét, mỗi nét hoàn tất là một bước hoàn tác.
- Hình ảnh và tọa độ cọ dùng chung `isolatedBrushGeometry.ts`; kiểm thử tại `isolatedBrushGeometry.test.ts`. MCP tiếp tục dùng `update_layer_assembly_layer` với `patch.imageUrl` qua lịch sử bản nháp, không thêm tool hay schema cho thay đổi bố trí UI.

### Layer assembly templates / Mẫu lắp ráp layer & Prompt AI
- Character prompts specify aspect ratio 1:1 and `recommended_resolution: model-native`; callers must use the returned image's actual dimensions. / Prompt nhân vật chỉ định tỉ lệ 1:1, không ép kích thước pixel; bộ tách phải đọc kích thước ảnh thực tế. Use [the 15-part atlas extractor / bộ tách 15 mảnh](../scripts/slice_puppet_atlas.py), then bind PNGs with existing template tools.
- `tmpl-character-puppet-15`: 15 separate illustrated parts and bones, including independent knees, wrists and ankles. Get its square 5×5 atlas prompt with `get_layer_assembly_template`; apply images by slot ID or `cell_N` using `apply_layer_assembly_template`. / Mẫu búp bê 15 lớp tách đủ khớp tay chân; lấy prompt và gán ảnh qua các tool hiện có. [Prompt & extraction guide / Hướng dẫn](../docs/design/character-cutout-prompt.md). The legacy `slice_atlas.py` supports only the old 16:9, 13-part layout / Script cũ không hỗ trợ atlas vuông mới.
- 16 mẫu lắp ráp layer 2.5D có sẵn chia theo 4 danh mục: Nhân vật theo lứa tuổi (Nam anh hùng, Nữ anime, Bé thiếu nhi, Quý ông trung niên, Cụ già gậy gỗ), Động vật (Chó cưng, Trâu nước, Mèo mướp, Cá Koi uốn sóng, Gà trống), Cây cối & Thiên nhiên (Bonsai, Bụi hoa), Kiến trúc (Ban công, Cổng tàn tích).
- Mỗi mẫu tích hợp sẵn bộ khung xương (armature), hoạt ảnh chuyển động (walk, idle, swim, peck...), cấu trúc layer Z-depth và Prompt AI tiếng Anh chuyên dụng tạo sprite sheet atlas (5x5 ô) đồng bộ góc nhìn.
- MCP tools: `list_layer_assembly_templates`, `get_layer_assembly_template` (lấy prompt AI và sơ đồ slot), `apply_layer_assembly_template` (áp dụng trực tiếp mẫu vào xưởng hoặc lưu thư viện).
- Character prompts / Prompt nhân vật: `get_layer_assembly_template` accepts `reference_mode` (`layout` default = attached image is a layout reference only, create a NEW character; `disassemble` = split the exact character in the attached image, step 2 of the 2-step workflow; `none` = text only) `part_group` (`all` | `head` | `upper` | `lower`, one part group per pass) and `sheet_style` (`template` = 13 slot parts, `granular` = ~45-piece Live2D / Spine sheet), and returns `prompt_guide.negative_prompt`. / `reference_mode` chống việc AI "sửa ảnh mẫu" thay vì tạo nhân vật mới; `part_group` tạo từng nhóm bộ phận để phần bị che được vẽ đầy đủ.
- Plant spines / Xương motion: `layer_assembly_plant_spine` (`list` | `add` | `update` | `delete` | `clear` | `stagger` | `copy_motion`) draws a curve from ROOT to TIP in composite coordinates (`points: [[x,y],...]`, X right, Y down) that bends bound plant layers in the wind; `apply_to: selected | all`, `preset: grass | sapling | branch | canopy | flower | seaweed`, tunables `amplitude`, `speed`, `stiffness`, `flexibility`, `turbulence`, `lean`, `phase_offset`, `reach`. Recorded hand-drawn motion (replaces procedural wind, loops seamlessly): `motion_samples: [[t, tipAngle],...]` + `motion_end: loop | spring` or `motion_keys: [[t, tipAngle],...]` + `motion_duration`; 2D Graph Editor actions (`insert_key_at`, `remove_key_index`, `move_key`, `simplify_motion`, `smooth_motion`, `balance_motion`) and multi-spine coordination (`stagger` golden-ratio phase, `copy_motion` with `lag_step`); tweak with `motion_speed` (0.1–4), `motion_lag` (0–1 s), `motion_wind_mix` (0–1), `scale_motion` (>0), `mirror_motion` (boolean); `clear_motion: true` returns to wind. `set_layer_assembly_panel` accepts `tab`, `bone_id`, `spine_id`, `plant_grab_mode` (`record` | `learn`), `plant_record_end` (`loop` | `spring`), `plant_path_record`, `plant_live`, `anim_ik`, `anim_ik_chain`, `anim_onion`, `anim_path`. Vùng chụp: `layer_assembly_plant_motion`, `layer_assembly_plant_graph`, `layer_assembly_plant_chips`, `layer_assembly_plant_panel`.
- Motion sketch / Vẽ động tác: `layer_assembly_motion_sketch {bone_id, points}` turns the path a bone TIP travels (`[[x,y],...]` or timed `[[x,y,t],...]`, composite coordinates) into smooth keyframes starting at `start_time` (default = playhead). `mode: rotate | move`, `chain_length` (1 = FK, 2–4 = IK chain, parents follow the tip), `timing: live | hand | even` (live = exact seconds of t), `duration` (0.1–20 s), `loop_back`, `play`. Old keys inside the range are replaced, the clip is extended when needed; undoable. In the UI press `D` on the Animation tab and drag from a bone tip. / Biến đường đi của ngọn xương thành chuỗi keyframe mượt; trong app bấm `D` ở tab Animation rồi kéo từ ngọn xương. Vùng chụp: `layer_assembly_motion_sketch`.
- IK pose / Tạo dáng IK: `layer_assembly_ik_pose {bone_id, target:[x,y], chain_length?, time?}` pulls the tip of `bone_id` to `target` and rotates the parent bones of the chain (CCD), keying every chain bone at `time` (default = playhead). / Kéo ngọn xương tới đích, xương cha tự xoay — giống kéo ngọn khi bật IK (phím `I`).
- Secondary motion / Vật lý thứ cấp: `layer_assembly_secondary_motion {bone_id, preset?: hair | tail | cloth | antenna, stiffness?, damping?, strength?, max_angle?, include_root?, play?}` simulates inertia on a bone branch after the main motion and bakes rotation keys (replaces that branch's old keys). / Nướng tóc, đuôi, vải trễ nhịp và nảy theo quán tính. Vùng chụp công cụ hoạt hoạ: `layer_assembly_anim_tools`, `layer_assembly_pose_tools`, `layer_assembly_anim_chips`, `layer_assembly_anim_assist`, `layer_assembly_anim_secondary`.
- Pose-to-pose & timing tools / Công cụ pose-to-pose & nhịp: `layer_assembly_pose_tools {action: breakdown | close_loop | overlap | retime | reverse | shift_time, weight?, time?, bone_id?, delay?, factor?, delta?, after_time?, play?}` inserts breakdown keys (Tween Machine ¼/½/¾), closes loop at clip end, offsets child bone phases hierarchically, scales clip timing, reverses keyframe order, or inserts/removes time holds. Vùng chụp: `layer_assembly_pose_tools`.

### Procedural Motion Effect Controls
`set_layer_motion` chỉnh Motion của layer qua Undo/Redo; `get_layer_motion` đọc cấu hình và offset tại thời gian yêu cầu. Hỗ trợ type, enabled, reset, speed, amplitude, amount, phase, seed, start_time, duration, fade_in, fade_out, direction, loop_mode, loop_width. Vùng chụp: `motion`, `motion_preview`, `motion_parameters`, `motion_timing`. [Thông số và ví dụ](../docs/motion-controls.md).

<!-- workflow-quick-connect -->
Workflow: `workflow_quick_connect` chụp riêng menu chọn chức năng khi kéo port; tìm kiếm giữ bộ lọc tương thích theo chiều kết nối, cuộn độc lập với canvas.

Workflow node configuration: `workflow_node_camera_preview` chụp preview camera trực tiếp; `workflow_node_settings` chụp bảng cấu hình. Dialog dùng bản nháp: preview tính ngay khi mở và gộp chỉnh liên tiếp sau 80ms; ghi chú không tính lại preview. Áp dụng ghi một bước Undo; Hủy/Escape/nút đóng bỏ bản nháp.

- Workflow: bung cảnh giữ cấu hình và các cảnh khác; cụm 2.5D có node gốc và node bộ phận. Tự nối dây giữ kết nối hợp lệ, không đổi mục tiêu khi tắt layer và không nối chéo cảnh. `connect_workflow_ports(action: "auto_wire")` dùng cùng logic với UI.

- Dialog node: preview camera dựng sau khi giao diện hiện, tối đa 720px/20fps, tái sử dụng WebGL khi đổi node và giải phóng sau 15 giây đóng dialog. Viewport phía sau tạm ngừng dựng khi preview mở; các tab có vùng cuộn riêng và chữ tự xuống dòng theo theme.

- Node configuration uses a private draft and shared preview/apply evaluator. MCP: `set_workflow(node_id, node_params: JSON, apply_node: true)` commits atomically; explicit false/empty selections are preserved.
- Cấu hình node dùng bản nháp riêng; Áp dụng và preview dùng chung bộ xử lý. MCP `set_workflow` nhận `node_params` và `apply_node`; không ghi ngược trạng thái cảnh đè lên lựa chọn đã lưu.


- Workflow node dialog: Đầu vào → Thông số → Đầu ra; xử lý riêng theo dây layer, rule không chạy chồng preset. MCP `get_workflow.node_io` phản ánh cổng và phạm vi, `list_workflow_presets.logic_nodes[].operations` cung cấp thông số thao tác. Vùng chụp: `workflow_node_config`, `workflow_node_input`, `workflow_node_operation`, `workflow_node_connections`, `workflow_node_output`, `workflow_node_camera_preview`, `workflow_node_settings`. Xem [logic node và dialog](../docs/workflow-node-semantics.md).

- Node dialog: một màn hình chỉnh liên tục, luôn hiện thao tác và scope; dây nối/ghi chú nằm trong mục thu gọn. Preview copy-on-write, hỗ trợ tắt Tự cập nhật rồi Xem thử theo yêu cầu. Vùng chụp thêm: `workflow_node_scope_picker`, `workflow_node_edit_context`, `workflow_node_advanced`, `workflow_node_preview_controls`, `workflow_node_preset_picker`, `workflow_node_rule_picker`.


### Timeline logic & independent viewer tags

- Timeline: chọn layer/cảnh → **+ Thêm logic** → tìm thao tác → chỉnh thông số và Áp dụng. Logic dùng chung graph với Workflow; node và kết nối được tạo tự động, chỉnh sửa có Undo/Redo. Các node đã tạo trong Workflow cũng hiện theo phạm vi layer/cảnh trên timeline.
- Bật độc lập các tag Camera, 3D, Cam 2D, Độ sâu 2.5D; giữ ít nhất một khung. Một tag chiếm toàn vùng; hai tag chia đôi (Cam 2D + Độ sâu chia trên/dưới); ba tag chia hai cột; bốn tag chia lưới 2×2, Độ sâu dưới Cam 2D. Khung hẹp xếp dọc để giữ đủ tag. Lựa chọn lưu trong view preferences.
- MCP `set_view(active_views: ["camera", "editor", "animate2d", "topview"])`; các giá trị `mode` cũ vẫn tương thích.
- MCP `set_workflow(logic_id, layer_id?, shot_id?)` thêm logic từ `list_workflow_presets.logic_nodes`, tự nối nguồn và chỉ áp dụng node mới trong một bước Undo. Chỉnh node bằng `set_workflow(node_id, node_params, apply_node: true)`.
- Vùng chụp: `timeline_logic`, `timeline_logic_picker`, `viewer_stage2d`, `viewer_stage2d_tools`, `viewer_depth`; dùng `active` cho hộp cấu hình đang mở.

- Timeline mở rộng layer: chỉnh trực tiếp Vị trí XYZ, Xoay XYZ, Tỉ lệ XY (khóa tỉ lệ) và Độ mờ %. Kéo số để scrub (Shift ×10, Alt ×0.1), nhập số và Enter; đồng hồ bật/tắt animation, nút kim cương thêm/xóa keyframe, mũi tên nhảy keyframe. Dùng chung `AnimRow` với Inspector; MCP tương ứng `update_layer`, `set_keyframe` và các công cụ keyframe hiện có. Layer khóa không nhận chỉnh sửa.
- Thanh công cụ Cam 2D dùng icon một hàng; sơ đồ Độ sâu tách thanh hướng nhìn Trên/Bên khỏi canvas, màu hover theo theme. Region bổ sung: `viewer_depth_tools`, `timeline_properties`. Tên layer/cảnh chỉ hiện ở cây bên trái và tooltip, không lặp trên thanh thời gian.


Timeline keyframe: chọn thuộc tính hoặc mốc trên track; `K` thêm/chọn mốc tại đầu phát (không xóa mốc cũ), `Shift+K` bắt đầu đoạn mới, `Alt+K` đặt cuối đoạn, `Alt+←/→` đi tới mốc trước/sau, `Delete` xóa mốc đã chọn. Bỏ focus ô nhập số trước khi dùng phím tắt. Sửa số khi chưa có mốc đổi giá trị tĩnh; khi đã có animation, tự tạo/cập nhật mốc và kế thừa nội suy. Mỗi thuộc tính nằm trên một hàng với cụm ‹ ◇ › để chuyển/thêm mốc; tại mốc hiện nút ⋯ mở menu kiểu chuyển động: Đi mượt (`easeInOut`), Đi đều (`linear`), Giữ rồi nhảy (`hold`: giữ đầu đến cuối rồi đổi ngay), Nhịp đập (`pulse`: ba lần tới đích, hai lần quay lại, kết thúc tại đích; không đồng bộ âm thanh) chỉnh đoạn bắt đầu ở mốc hiện tại; mốc cuối chỉnh đoạn đi vào. Đầu đoạn mới giữ nguyên quá khứ. MCP `set_keyframe` hỗ trợ `boundary: start | end` và `ease` cùng lúc; `timelineBoundary` lưu vai trò độc lập với easing. Region `timeline_properties` và `timeline_key_controls` hỗ trợ chụp riêng; thao tác có Undo/Redo.


Timeline: mỗi thuộc tính có một hàng cố định gồm tên, giá trị và điều hướng mốc. Chọn dòng chỉ đổi thuộc tính active, không đổi đầu phát; ↑/↓ chuyển dòng, K đặt mốc, Alt+←/→ chuyển mốc. Menu ⋯ chứa đầu/cuối đoạn và kiểu nội suy, chụp riêng qua `timeline_key_menu`. Màu chọn thuộc tính tách khỏi layer và mốc đang chọn; thao tác dữ liệu tiếp tục dùng `set_keyframe` (tham số `ease`) qua MCP.

Timeline motion popup: chuột phải vào dòng thuộc tính hoặc mốc mở `timeline_motion_popup` (alias cũ `timeline_key_menu`). Các nút nhanh ○ mượt, △ đều, □ giữ, ★ nhịp đập, ⚡ nhấp nháy có hình riêng; ◆ chỉ dùng cho mốc. Popup cho chọn hướng/độ mượt, số nhịp 1–30, thời điểm nhảy 1–100%, tỉ lệ nháy 5–95%, có đường xem trước và Áp dụng/Undo. Thông số lưu tại `Keyframe.easeOptions`; MCP `set_keyframe` nhận `ease_options` (`cycles`, `strength`, `holdUntil`, `duty`) và `ease: blink`. Thông số thuộc đoạn đi ra từ mốc đầu; popup ở mốc cuối chỉnh đoạn đi vào. Nhấp nháy nội suy giữa hai giá trị đã đặt, không tự thay đổi giá trị đầu/cuối hoặc đồng bộ âm thanh.
