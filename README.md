# Parallax Studio

> Motion: `motionMode` (`bbox`, `path`, `cycle`) là chế độ đang active và được ưu tiên hơn cấu hình còn lưu của tab khác. Đổi tab giữ cấu hình để dùng lại, gỡ keyframe do chế độ cũ sinh ra và cập nhật logic dùng chung cho UI/MCP; đường vẽ rỗng không kích hoạt động tác nhanh.

Mẫu **Búp bê 15 lớp** trong Xưởng Lắp Ráp Layer tách riêng bắp tay, cẳng tay, bàn tay và đùi, cẳng chân, bàn chân. Prompt atlas vuông 5×5 mô tả ranh giới từng bộ phận, đệm khớp và viền sạch; dùng chung trên UI/MCP. Xem [quy chuẩn prompt nhân vật](docs/design/character-cutout-prompt.md).

Atlas nhân vật chỉ yêu cầu tỉ lệ 1:1, độ phân giải tùy model AI. [Bộ tách PNG](scripts/slice_puppet_atlas.py) đọc kích thước thực tế và lấy trọn mảnh lấn nhẹ biên ô; cần kiểm tra viền, scale và khớp sau khi nhập.

Xưởng Lắp Ráp Layer hỗ trợ mesh bám alpha (giữ lỗ và chi tiết rời) và **Uốn mềm theo chuỗi xương** cho tóc, đuôi, tay chân. Đặt khớp trong tab Tạo xương, chọn ảnh và xương gốc của nhánh, bấm Uốn mềm; tạo keyframe trong Animation. Mesh và rig được giữ khi chèn vào timeline, lưu dự án và xuất MP4. Xem [hướng dẫn xưởng](docs/layer-workshop-tools.md).

**Xương motion (tab Motion):** kéo chuột trên Bố cục 2D từ gốc lên ngọn cây để tạo một đường xương cong; mặc định **Tự nhận** gắn vào các layer nằm dưới nét vẽ (bỏ qua nền phủ kín khung), có thể đổi sang layer đang chọn hoặc toàn bộ layer. Xương đang chọn hiện điểm vuông để kéo sửa trực tiếp (nhấp đúp lên thân để chèn điểm, nhấp đúp điểm để xoá, kéo thân để dời cả xương) và **vòng nắm ngọn**. **Ghi chuyển động vẽ tay** (mặc định): nắm vòng ngọn kéo theo nhịp bạn muốn — hoặc bấm `R` rồi nhấn giữ vẽ quỹ đạo ngọn ở bất kỳ đâu — app ghi đúng từng cử động theo thời gian thật (nhãn `● REC`), tự làm mượt, cắt đoạn chờ, khép vòng lặp liền mạch (hoặc **Thả là nảy về** như lò xo) rồi phát lặp lại. Mục **Chuyển động** trong thẻ xương có biểu đồ góc ngọn theo thời gian (kéo chấm mốc lên/xuống để sửa), tốc độ phát, ngọn trễ nhịp (đánh roi), trộn gió, lật chiều, mạnh/nhẹ hơn và về gió tự nhiên. Đổi tay nắm sang **Học nhịp gió** để app chỉ học biên độ / nghiêng / tốc độ cho gió tự động. Vùng lắc tối đa hiện bóng mờ hai bên, bật **Gió trực tiếp** để xem cây đung đưa ngay khi chỉnh. Chuyển động đồng bộ ở 2D, 3D và được mang theo khi thêm vào cảnh / xuất video. AI điều khiển qua tool MCP `layer_assembly_plant_spine` (`motion_samples`, `motion_keys`, `motion_end`, `motion_speed`, `motion_lag`, `motion_wind_mix`, `clear_motion`).

**Vẽ động tác (tab Animation):** bấm `D` (hoặc nút "Vẽ động tác") rồi kéo bút từ gần ngọn một xương theo đường bạn muốn ngọn xương đi qua. Nhịp **Thời gian thật** (mặc định) chạy đầu phát theo bút như ghi hình — dừng tay là giữ dáng, vẽ nhanh/chậm thế nào động tác nhanh/chậm thế ấy; chuỗi **IK 2–3 xương** cho các xương cha xoay theo ngọn (tay, chân, đuôi). Giữ `Ctrl` lúc bắt đầu để chỉ xoay 1 xương, `Shift` để đổi Xoay/Dời khớp, `Alt` kéo khung nhìn, `Esc` huỷ; keyframe cũ trong đoạn vẽ được thay, clip tự nới, hoàn tác bằng Ctrl+Z. **Công cụ tạo dáng chuyên nghiệp** (thanh nổi trên khung + thẻ trong bảng): **IK kéo ngọn** (`I`, chọn chuỗi 2/3/4 xương; kéo ngọn xương là cả tay đi theo, `Ctrl` khi kéo = FK), **Onion skin** (`O`, bóng vàng = trước, xanh = sau), **Quỹ đạo** (`P`, đường đi ngọn xương kèm hình thoi keyframe) và **Chuyển động thứ cấp (vật lý)**: chọn xương gốc nhánh tóc/đuôi/vải, chọn mẫu Tóc / Đuôi / Vải / Tai nảy rồi bấm nướng — nhánh tự trễ nhịp và nảy theo quán tính, ghi thành keyframe (một bước hoàn tác). AI dùng tool MCP `layer_assembly_motion_sketch` (`chain_length`, `timing: live`), `layer_assembly_ik_pose`, `layer_assembly_secondary_motion`.

App desktop (Electron + Three.js) dùng để dựng video **parallax 2.5D** giống After Effects. Bạn xếp các layer ảnh theo chiều sâu, chia thành nhiều **cảnh (shot)** đặt trong không gian 3D, cho camera bay qua từng cảnh rồi xuất MP4. App có **MCP server** để AI (Antigravity, Claude, Cursor…) điều khiển trực tiếp, giống blender-mcp.

## Chạy nhanh (Windows 1-click)

- **`start.bat`**: Bấm đúp để mở ứng dụng ngay. Nếu máy chưa cài thư viện, file sẽ tự động tải và cài đặt toàn bộ trước khi mở.
- **`setup.bat`**: Chỉ cài đặt/cập nhật toàn bộ thư viện (cả app chính lẫn MCP server).
- **`build.bat`**: Đóng gói phiên bản production vào thư mục `out/`.

## Hoặc chạy bằng lệnh terminal

```powershell
npm install
npm run mcp:install      # cài phụ thuộc cho MCP server (lần đầu)
npm run dev              # mở app (dev)
npm run build            # build production vào out/
npm test                 # unit test (vitest)
```

> Trên Windows, nếu PowerShell chặn `npm`, hãy dùng `npm.cmd` hoặc bấm đúp vào `start.bat`.

## Khái niệm chính

| Khái niệm | Ý nghĩa |
| --- | --- |
| Đơn vị | 1 đơn vị = 1 pixel của composition. x → phải, y → lên, **z → chiều sâu** (dương = xa camera) |
| Shot (cảnh) | Một nhóm layer đặt ở một vị trí trong world. Toạ độ của layer là **local** trong shot |
| Layer chung | Layer có `shotId = null`, nhìn thấy được từ mọi cảnh |
| Mặt đất 3D & Dáng layer | Layer có thể đặt đứng (0°), **nằm ngang làm mặt đất/sàn** (-90°), **nghiêng dốc** (-75°) hoặc **làm trần** (+90°). Giúp tạo sàn di chuyển, mặt hồ, sa mạc với chiều sâu 3D thực thụ khi camera lia qua |
| Lưới & Lặp texture | Layer Solid hỗ trợ hoạ tiết lưới phối cảnh 3D (grid, stripes, dots). Layer Image hỗ trợ lặp texture (Repeat X/Y) trải dài vô tận |
| Camera framing | Mỗi shot có camera chuẩn đặt ở local `(0, 0, -referenceDistance)` nhìn về gốc toạ độ, nên layer ở z = 0, scale 1 hiển thị đúng kích thước pixel gốc |
| Camera path | Camera dừng ở từng cảnh rồi chuyển sang cảnh tiếp theo bằng một trong các kiểu: bay thẳng, bay vòng cung, cắt cảnh, fade đen |
| 3D view | Chế độ xoay quanh (orbit) để xem các layer xếp chồng, khung camera và đường bay, giống Custom View của AE. Có chế độ chia đôi màn hình Camera \| 3D |

### Chỉ render những gì camera nhìn thấy (không tràn RAM)

- Ảnh chỉ được giữ ở dạng **file nén (Blob)**, không giữ pixel trong RAM.
- Mỗi frame, renderer cắt bỏ (cull) những layer và cảnh nằm ngoài tầm nhìn của camera.
- Chỉ những layer camera đang thấy mới được giải mã, ở **độ phân giải vừa đủ** (mipmap LOD theo kích thước thực hiển thị trên màn hình).
- Texture nằm trong một pool LRU có ngân sách VRAM. Cảnh camera đã rời đi sẽ bị giải phóng.
- App tải trước các cảnh camera sắp tới (khoảng 0,4–1,5 giây phía trước).
- Khi xuất video, mỗi frame đều đợi `prepare()` cho đủ texture ở chất lượng cao nhất, nên video luôn sắc nét và cho kết quả giống nhau mỗi lần xuất.
- Chip `VRAM … · cảnh x/y` trong viewer cho biết bộ nhớ đang dùng. Bật nút "chỉ hiện thứ camera tải" trong 3D view để xem trực quan phần đang được tải.

## Điều khiển bằng AI qua MCP

**Mẫu mesh ảnh 2D → 3D:** dialog tạo mô hình có mẫu lá, bông hoa, chậu cây, nhà cao tầng, lan can và cỏ. Mỗi mẫu có yêu cầu ảnh từng bộ phận, prompt render, gắn PNG và ba biến thể. AI tra cứu bằng `get_assembly_template`, gắn ảnh theo slot bằng `apply_assembly_template`, tinh chỉnh mesh qua `update_assembly_face`. Xem [hướng dẫn và ví dụ](docs/image-mesh-templates.md).

Kiến trúc:

```
AI client ──stdio/MCP──> mcp-server/index.mjs ──TCP 127.0.0.1 + token──> Parallax Studio (đang mở)
```

- App chỉ lắng nghe trên `127.0.0.1` (mặc định cổng `9877`, đổi bằng biến `PARALLAX_MCP_PORT`, tắt bằng `PARALLAX_MCP=0`).
- Mỗi lệnh phải kèm token lưu trong `%APPDATA%\parallax-studio\mcp.json`. Chỉ tài khoản Windows của bạn đọc được file này.
- Mọi thao tác của AI đều là edit bình thường: hiện ngay trên UI và **Ctrl+Z để hoàn tác**.
- Chip **MCP** trên toolbar cho biết trạng thái (vàng = sẵn sàng, xanh = AI đã kết nối) và nháy mỗi khi AI gửi lệnh.
- **Tài liệu AI song ngữ:** trong dialog cấu hình MCP có công tắc "Tài liệu AI bằng tiếng Anh (khuyến nghị)" — mặc định bật (tiếng Anh), tắt để AI đọc bản tiếng Việt. Hai bản sinh từ cùng một catalog (`mcp-server/catalog/`) nên luôn khớp nhau; client đang kết nối được cập nhật trực tiếp. Chi tiết: [mcp-server/README.md](mcp-server/README.md).

### Cấu hình cho Antigravity

Thêm vào `mcp_config.json` của Antigravity (Settings → MCP), sửa đường dẫn cho đúng máy bạn:

```json
{
  "mcpServers": {
    "parallax-studio": {
      "command": "node",
      "args": ["D:/Codes/parallax-studio/mcp-server/index.mjs"]
    }
  }
}
```

## Cách 1: Sửa file bằng tay
1. Mở file `mcp_config.json` (tại `~/.gemini/config/mcp_config.json` hoặc `%USERPROFILE%\.gemini\config\mcp_config.json`).
2. Thêm `parallax-studio` vào cạnh `blender`. Nhớ đặt dấu phẩy sau dấu `}` của blender. File sau khi sửa sẽ như sau:

```json
{
  "mcpServers": {
    "blender": {
      "command": "uvx",
      "args": [
        "blender-mcp"
      ]
    },
    "parallax-studio": {
      "command": "node",
      "args": [
        "D:/Codes/parallax-studio/mcp-server/index.mjs"
      ]
    }
  }
}
```

Claude Desktop, Cursor và các client MCP khác dùng cùng cấu hình `command` / `args` như trên. **Hãy mở app trước**, rồi mới để AI gọi tool.

### Các tool (129)

| Nhóm | Tool |
| --- | --- |
| Xem | `get_project_info`, `get_shot_info`, `get_layer_info`, `get_camera_info`, `get_memory_stats`, `get_viewport_screenshot` (view `camera` hoặc `3d`), `get_app_screenshot` (toàn cửa sổ hoặc theo `region`; `active` = dialog nổi trên cùng), `get_ui_state`, `set_ui_dialog`, `ui_click`, `ui_type`, `get_ai_guide`, `list_commands` |
| Dự án | `new_project`, `set_composition`, `save_project`, `open_project`, `import_project_json`, `export_project_json`, `import_shot_json`, `export_shot_json`, `undo`, `redo` |
| Cảnh | `add_shot`, `update_shot`, `delete_shot` |
| Layer | `add_image_layer` (file_path / base64 / repeat), `add_text_layer`, `add_solid_layer`, `add_ground_layer` (sàn 3D), `add_particles`, `update_layer`, `delete_layer`, `move_layer`, `split_layer`, `apply_layer_fx`, `toggle_layer_fx`, `remove_layer_fx`, `set_layer_glow`, `replace_layer_asset` |
| Âm thanh | `set_audio`, `get_audio_info`, `add_audio_track`, `update_audio_track`, `delete_audio_track`, `duplicate_audio_track`, `split_audio_track`, `merge_audio_tracks` |
| Xưởng 3D | `list_models3d`, `get_model3d`, `get_assembly_state`, `list_assembly_templates`, `apply_assembly_template`, `append_assembly_model`, `save_assembly_model`, `insert_assembly_model`, `add_assembly_face`, `update_assembly_face`, `delete_assembly_face`, `join_assembly_faces`, `auto_assembly_clip`, `set_assembly_lighting`, `get_assembly_screenshot`, `set_assembly_camera` |
| Keyframe | `set_keyframe`, `remove_keyframe`, `clear_keyframes` |
| Camera | `set_camera`, `apply_camera_preset`, `camera_fly_to_shot`, `build_camera_path` |
| Khác | `set_look`, `set_time`, `set_playing`, `select`, `set_view`, `export_video`, `execute_script` |

Ví dụ prompt cho AI: *"Tạo 3 cảnh: rừng đêm, biển lúc bình minh, thành phố neon. Mỗi cảnh có 4–5 layer ở các độ sâu khác nhau và một tiêu đề. Camera bay vòng cung giữa các cảnh, mỗi cảnh dừng 3 giây. Chụp 3D view cho tôi xem, rồi xuất MP4 1080p ra D:/Videos/demo.mp4."*

**Lắp ráp 3D dạng mô-đun:** khung nhà (`shell-*`, chỉ tường + mái) và các bộ phận trang trí (`decor`: cửa sổ, cửa ra vào, ống khói, cột, ban công, bồn hoa, chậu cây, đèn, biển, mái hiên, hàng rào) được dựng riêng, lưu thành asset 3D, rồi ghép lên khung bằng panel "Ghép mô hình đã lưu" trong xưởng hoặc tool `append_assembly_model`.

### Kiểm thử

```powershell
npm run build
node scripts/e2e-export.mjs out/e2e         # UI: chọn layer, 3D view, lưu/mở, xuất MP4
node mcp-server/smoke-test.mjs out/mcp      # MCP: dựng cảnh bằng tool, chụp ảnh, xuất video
node mcp-server/stress-test.mjs out/stress  # RAM: 30 cảnh × 6 ảnh 4K
```

## Dùng thương mại

- Mã nguồn của app thuộc về bạn. Three.js, React, zustand, immer, JSZip và MCP SDK đều dùng giấy phép MIT hoặc Apache, nên dùng thương mại thoải mái.
- **FFmpeg:** gói `ffmpeg-static` đi kèm bản build **GPL** (có libx264). Nếu phát hành app đóng nguồn, hãy chọn một trong hai cách:
  1. Đóng gói bản FFmpeg **LGPL** (không có x264). Khi đó dùng encoder `h264_mf`/`h264_nvenc`/`libopenh264` và chỉ cần sửa `src/main/ffmpeg.ts`.
  2. Để người dùng tự cài FFmpeg rồi chỉ đường dẫn tới nó.

  Ngoài ra, codec H.264 có thể phải trả phí bản quyền bằng sáng chế (MPEG LA / Via LA) tuỳ thị trường.
- Font Inter, Montserrat, Playfair Display, Bebas Neue và JetBrains Mono đều dùng giấy phép SIL OFL, nên nhúng vào sản phẩm thương mại được.

### Viewport layer transform controls

Selecting an unlocked, visible layer in Camera (2D preview), 3D, orthographic or split view shows XYZ translation axes, eight bounding-box scale handles and XYZ rotation rings. Drag an axis to move in shot/parent coordinates; when an axis points into the screen, drag vertically. Drag a square to resize about the layer anchor; Shift preserves aspect ratio. Drag a rotation ring to rotate about the anchor; Shift snaps to 15 degrees (translation: 10 units). Edge-on rings use horizontal dragging. Coordinates and rotation angles are shown beside the pivot. Escape or pointer cancellation restores the pre-drag state. A completed gesture is one Undo/Redo step and follows the current playhead's animation rules. Controls are hidden during playback and do not appear in exports.

AI parity: `update_layer` edits the same `position`, `rotation` (degrees), and `scale` (scalar or `[x,y,z]` multipliers); `at_time` creates a keyframe explicitly. Example: `pnpm pxs call update_layer '{"layer_id":"layer-1","rotation":[0,0,30],"scale":[1.5,0.8,1]}'`.

**Xưởng Lắp Ráp Layer:** thanh công cụ chọn nhiều lớp (Ctrl/Shift + bấm), kéo nhóm trong 2D, căn tâm/chia đều X–Y, tách Z theo bước tùy chỉnh, khóa/ẩn/nhân bản/xóa và so le pha. Undo/Redo riêng cho bản nháp, một bước mỗi gesture hoặc lệnh hàng loạt. MCP: `select_layer_assembly_layers`, `layer_assembly_action`, `layer_assembly_history`. [Hướng dẫn](docs/layer-workshop-tools.md).

**Nhóm bộ phận & slot hoán đổi:** gom layer thành nhóm (ví dụ `Đầu` gồm mặt/mắt/miệng/kính/tóc), khoá nhóm để kéo một thành viên là dời cả nhóm; các layer chung `slot` (ví dụ `face`) là biến thể biểu cảm thay thế nhau, kích hoạt biến thể sẽ hiện nó, ẩn biến thể khác và khớp đúng vị trí neo. Trong inspector cảnh (mục `Cụm Layer Chồng`) đổi nhanh biểu cảm/bộ phận của nhân vật 2.5D đã đặt. MCP: `layer_assembly_parts`, `swap_composite_part`.

### Layer workshop pixel editor
- Cọ tẩy chỉ hoạt động trong khung chỉnh pixel góc dưới trái; bố cục lớn dùng để xem và chọn layer. Thanh dọc gồm cọ mềm, tẩy nét cứng, bàn tay, vừa khung và khôi phục ảnh gốc. Cuộn để zoom quanh con trỏ; Space + kéo hoặc chuột giữa để dời ảnh. Escape hủy nét, mỗi nét hoàn tất là một bước hoàn tác.
- Hình ảnh và tọa độ cọ dùng chung `isolatedBrushGeometry.ts`; kiểm thử tại `isolatedBrushGeometry.test.ts`. MCP tiếp tục dùng `update_layer_assembly_layer` với `patch.imageUrl` qua lịch sử bản nháp, không thêm tool hay schema cho thay đổi bố trí UI.

### Motion Effect Controls
Bảng Motion hỗ trợ bypass, reset, cường độ, seed Wiggle, thời gian và Ease In/Out; preview/viewport/MP4 dùng chung bộ tính. MCP: `set_layer_motion`, `get_layer_motion`. [Hướng dẫn](./docs/motion-controls.md).

<!-- workflow-quick-connect -->
Workflow: `workflow_quick_connect` chụp riêng menu chọn chức năng khi kéo port; tìm kiếm giữ bộ lọc tương thích theo chiều kết nối, cuộn độc lập với canvas.

Workflow node configuration: `workflow_node_camera_preview` chụp preview camera trực tiếp; `workflow_node_settings` chụp bảng cấu hình. Dialog dùng bản nháp: preview tính ngay khi mở và gộp chỉnh liên tiếp sau 80ms; ghi chú không tính lại preview. Áp dụng ghi một bước Undo; Hủy/Escape/nút đóng bỏ bản nháp.

- Workflow: bung cảnh giữ cấu hình và các cảnh khác; cụm 2.5D có node gốc và node bộ phận. Tự nối dây giữ kết nối hợp lệ, không đổi mục tiêu khi tắt layer và không nối chéo cảnh. `connect_workflow_ports(action: "auto_wire")` dùng cùng logic với UI.

- Dialog node: preview camera dựng sau khi giao diện hiện, tối đa 720px/20fps, tái sử dụng WebGL khi đổi node và giải phóng sau 15 giây đóng dialog. Viewport phía sau tạm ngừng dựng khi preview mở; các tab có vùng cuộn riêng và chữ tự xuống dòng theo theme.

- Node configuration uses a private draft and shared preview/apply evaluator. MCP: `set_workflow(node_id, node_params: JSON, apply_node: true)` commits atomically; explicit false/empty selections are preserved.
- Cấu hình node dùng bản nháp riêng; Áp dụng và preview dùng chung bộ xử lý. MCP `set_workflow` nhận `node_params` và `apply_node`; không ghi ngược trạng thái cảnh đè lên lựa chọn đã lưu.


- Workflow node dialog: Đầu vào → Thông số → Đầu ra; xử lý riêng theo dây layer, rule không chạy chồng preset. MCP `get_workflow.node_io` phản ánh cổng và phạm vi, `list_workflow_presets.logic_nodes[].operations` cung cấp thông số thao tác. Vùng chụp: `workflow_node_config`, `workflow_node_input`, `workflow_node_operation`, `workflow_node_connections`, `workflow_node_output`, `workflow_node_camera_preview`, `workflow_node_settings`. Xem [logic node và dialog](./docs/workflow-node-semantics.md).

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


### Đồng bộ khung ánh sáng 2.5D và lựa chọn khung xem
Khung chỉnh ánh sáng dùng cùng vật liệu bề mặt, chùm sáng và bộ đánh giá đèn theo playhead với Camera; không tự tăng bán kính hoặc phủ thêm quầng sáng riêng. Khung này hiển thị layer/cụm đang chỉnh trên nền trong suốt, không thay thế toàn bộ phối cảnh và hậu kỳ của Camera.
Focus layer/cảnh từ Timeline, Workflow hoặc MCP `set_view` giữ nguyên các khung xem đã bật/tắt. Muốn đổi khung xem, dùng các nút trên Viewer hoặc `active_views`/`mode` của `set_view`.
Vùng chụp riêng: `virtual_light_pad`.

```powershell
pnpm pxs call set_view --focus selection
pnpm pxs review --view app --region virtual_light_pad --out D:\_tmp\light-pad.png
```
```cmd
pnpm pxs call set_view --focus selection
pnpm pxs review --view app --region virtual_light_pad --out D:\_tmp\light-pad.png
```


### Shared timing and multi-row timeline
- Demo ba cảnh giữ đủ 15 giây: giữ khung rồi lia ở 4–5s và 9–10s; cảnh đến hiện từ đầu đoạn lia. Timeline không tự rút thời lượng khi render.
- Workflow: **+ Time** tạo nguồn khoảng thời gian; kéo cổng ra tới Layer, Motion, Animation, FX, va chạm hoặc Audio. Một node nhận tối đa một nguồn Time. Ngắt/xoá/tắt nguồn trả về khoảng riêng; Camera và cấu trúc cảnh giữ lộ trình riêng.
- Timeline: bỏ checkbox. **Ctrl + click** thêm/bỏ chọn từng khoảng thời gian (thanh layer, đoạn giữa hai keyframe trong dòng thuộc tính, hoặc thanh hiệu ứng). Mở cây layer để chọn các đoạn thuộc tính riêng; chọn nhiều đoạn cùng dòng hoặc khác dòng. Kéo đoạn/mốc đã chọn để dời cả nhóm; **Đặt IN/OUT** (phím `[` / `]`) đặt biên các đoạn tại đầu phát; **Căn đầu** giữ thời lượng. Click vùng trống hoặc Escape bỏ chọn. Nền xanh, viền kép và vạch nhấn phân biệt vùng chọn ở cả hai theme. Mỗi lần kéo có một bước Undo; Escape hủy kéo. Bỏ qua layer khóa; từ chối đảo/chồng mốc hoặc xung đột mốc chung.
- MCP: `set_workflow(create_time: true)`, `set_workflow(node_id, node_params)` với `timeStart/timeEnd`, `connect_workflow_ports(port: "time_range")`, `retime_layers(layer_ids, mode: "shift" | "align", seconds)`. Có Undo/Redo; main.json giữ nguồn và dây thời gian dùng chung.
- Region mới: `timeline_batch_timing`; Workflow tiếp tục dùng `workflow_toolbar`, `workflow_canvas`, `workflow_inspector`.
- PowerShell: `pnpm pxs call retime_layers '{"layer_ids":["layer-1","layer-2"],"mode":"align","seconds":2}'`.
- CMD: `pnpm pxs call retime_layers "{\"layer_ids\":[\"layer-1\",\"layer-2\"],\"mode\":\"align\",\"seconds\":2}"`.

- MCP `retime_layers(intervals, mode, seconds)` dùng cùng logic; `kind: layer | keys | effect`. `keys` nhận `prop/startId/endId`, `effect` nhận `effectId`, tất cả nhận `layerId`. `mode: shift | align | in | out`. `ui_click(ctrl: true)` hỗ trợ chọn nhiều đoạn. Không thêm region: dùng `timeline`, `timeline_properties`, `timeline_batch_timing`.
- PowerShell: `pnpm pxs call retime_layers '{"intervals":[{"kind":"keys","layerId":"layer-1","prop":"opacity","startId":"key-a","endId":"key-b"}],"mode":"shift","seconds":1}'`.
- CMD: `pnpm pxs call retime_layers "{\"intervals\":[{\"kind\":\"keys\",\"layerId\":\"layer-1\",\"prop\":\"opacity\",\"startId\":\"key-a\",\"endId\":\"key-b\"}],\"mode\":\"shift\",\"seconds\":1}"`.


### Workflow BBox: phạm vi chỉnh, chuỗi Motion và va chạm
- Khung Thuộc tính Node chỉ nhận thao tác trên BBox của layer/cụm được nối. Layer khác chỉ làm nền tham chiếu; nhấn vào đó không đổi node hay lựa chọn layer. Motion chỉ hiện nhãn Đầu/Đích, không hiện điểm va chạm. Khi dừng, khung chỉnh giữ tư thế đầu; kéo hoặc thả BBox đích không tua playhead. Preview mới phát chuyển động.
- **+ Chặng tiếp** trên Motion/Va chạm tạo một node mới có dây nối từ chặng trước. Motion kế thừa vị trí và tỉ lệ cuối chặng trước; chỉnh đích của chặng mới để đi tiếp. Điểm đầu chặng nối được giữ theo chặng trước. Tạo chặng có Undo/Redo và tự mở rộng thời lượng dự án khi cần.
- Node Va chạm đọc cả chuyển động A và B ở cùng thời điểm, dùng kích thước/pivot/rotation thật của layer và BBox hợp nhất của cụm khoá. Kiểm tra đoạn giữa các mẫu để tránh xuyên qua vật nhanh. Chế độ Giao BBox 2D bỏ qua Z; Cùng độ sâu 2.5D yêu cầu khoảng Z không quá 24. Ưu tiên tiếp xúc từ quỹ đạo Motion/BBox đã có của cả A và B. Nếu cả hai chưa có quỹ đạo, giữ hành vi va chạm cũ: A tiến tới B rồi phản ứng theo chế độ đã chọn. Nếu đã có quỹ đạo nhưng không giao nhau thì không tạo va chạm giả. Phản ứng dùng hệ thống physics/mesh hiện có.
- Preview va chạm hiển thị A1/A2, B1/B2 và thời điểm tiếp xúc; `workflow_collision_preview` chụp riêng phần này. Chỉnh quỹ đạo ở node Motion của từng layer.
- Logic dùng chung UI/MCP: `workflowMotionExecution.ts`, `workflowMotionStart.ts`, `workflowStepGraph.ts`, `workflowTimedSteps.ts`, `workflowBboxContact.ts`, `workflowCollisionResponse.ts`. `set_workflow` hỗ trợ `follow_up: true`, `node_id`, `step_duration` (mặc định 3s); số công cụ vẫn là 144.
- PowerShell: `pnpm pxs call set_workflow '{"node_id":"motion-id","follow_up":true,"step_duration":3}'`.
- CMD: `pnpm pxs call set_workflow "{\"node_id\":\"motion-id\",\"follow_up\":true,\"step_duration\":3}"`.
- Flags (PowerShell/CMD): `pnpm pxs call set_workflow --node_id motion-id --follow_up true --step_duration 3`.

### Nối chặng BBox và chọn chặng
Motion/va chạm có cổng OUT: kéo sang node kế tiếp hoặc thả ra khoảng trống để tạo chặng mới. Motion BBox nối #1→#2→#3 kế thừa đích chặng trước làm điểm đầu; sửa đích chặng trước cập nhật các chặng sau. Dải tag BBox trong Thuộc tính Node liệt kê các chặng của layer/cụm theo thời gian, bấm tag để chỉnh từng chặng. Vùng MCP `workflow_bbox_steps` chụp riêng dải tag; `set_workflow` với `follow_up: true` dùng cùng logic tạo chặng như UI.


### Focus node và Motion BBox

Giữ Shift khi chọn node/BBox khác; thao tác mặc định giữ node đang focus. Ctrl + click trên `+ Logic` của layer chọn/bỏ chọn khoảng thời gian, không mở picker. Nhãn Camera nằm trên toolbar, ngoài hình render. Motion BBox chỉ có tab Đích và Chiều sâu; thời gian chỉnh một nơi tại Từ/Đến.

MCP regions: `viewer_camera_status`, `workflow_motion_panel`, `workflow_motion_ghost`, `workflow_motion_path`, `workflow_motion_target`, `workflow_motion_timing`, `workflow_motion_depth`, `workflow_motion_tools`, `workflow_motion_draw`.

PowerShell: `pnpm pxs call ui_click '{"selector":".wf-v2-card","shift":true}'`

CMD: `pnpm pxs call ui_click "{\"selector\":\"[data-node-id]\",\"shift\":true}"`

Flags: `pnpm pxs call ui_click --selector ".wf-v2-card" --shift true`

### Chỉnh đường đi Motion trên khung BBox
- Motion chỉ hiển thị Đích và Chiều sâu; vùng `workflow_motion_timing` trỏ tới Từ/Đến dùng chung, không có tab thời gian trùng lặp; cấu hình Va chạm thuộc node Va chạm riêng. Dữ liệu va chạm cũ được giữ để tương thích dự án đã lưu.
- Tab Vẽ Line và đường cong BBox dùng chung khung chỉnh BBox, không dùng bảng vẽ nhỏ trong phần thông số. Thanh icon ngang nằm riêng bên dưới canvas: chọn/kéo, đường thẳng, vẽ đường cong, xóa, xem thử. Bảng Motion không chứa thanh chọn logic khác hay nút chỉnh Layer/Camera. Esc hủy nét vẽ; các thay đổi hỗ trợ Undo/Redo.
- MCP/CLI dùng `set_workflow` với `node_params` và `apply_node: true`; path vẽ trên stage dùng `customMotionPath` dạng độ lệch tọa độ thế giới, `intensity: 1`. BBox dùng `bboxPathType: shortest | custom_curve` và đường cong chuẩn hóa.
- Chụp riêng thanh công cụ: PowerShell `pnpm pxs call get_app_screenshot '{"region":"workflow_motion_tools"}'`; CMD `pnpm pxs call get_app_screenshot "{\"region\":\"workflow_motion_tools\"}"`. Lớp nhận nét vẽ khi bật bút: `workflow_motion_draw`.


### Bộ phận 2.5D theo mốc — preview và MCP
- Hub **Bộ phận: Cụm 2.5D** chỉ điều phối: chọn bộ phận trong hình hoặc danh sách node con. Không đổi biểu cảm toàn cụm qua Hub.
- Hub và node con có **Khung chỉnh bộ phận** theo playhead thật, cùng `evaluateScene` với renderer/export. **Toàn cảnh** xem vị trí theo Motion BBox; **Cận cụm** phóng cụm và ẩn cảnh tham chiếu để bộ phận không bị che. Dải Motion cho tua Đầu / Giữa / Đích mà không đổi node đang chỉnh.
- Chọn node con → tua Trước/Đầu/Giữa/Cuối/Sau → chỉnh biến thể, tìm ảnh thay thế hoặc cử động. Kéo bộ phận đang chọn trong mốc để đổi X/Y tư thế (nhịp Giữ); không sửa vị trí gốc hay đường Motion. Nút **+ Mốc riêng tại …s** tạo node con mới tại playhead, không sửa mốc trước. Từ/Đến vẫn là nơi chỉnh khoảng thời gian duy nhất; Hub không có bộ chỉnh khoảng riêng.
- `patchPartCue` / `addPartCue` là logic dùng chung UI/MCP. Khi chỉnh lần đầu, các node bộ phận cùng cụm chuyển sang `partTimeline: true`: chỉ gỡ key `-partpose-` / `-partswap-` của chúng, giữ nguyên key Motion/rig. `workflowPartTimeline` đánh giá biến thể/ảnh/ẩn hiện và cộng tư thế vào chuyển động tại thời gian render, không ghi đè keyframe Motion. Ảnh gốc được giữ nguyên cho các mốc mới; không thể khôi phục ảnh gốc đã bị thay vĩnh viễn trong dữ liệu cũ.
- Mốc dùng giây dự án và khoảng `[Từ, Đến)`. Khi chồng lấn cùng bộ phận/thuộc tính, mốc có Từ muộn hơn ưu tiên; cùng Từ sắp theo ID ổn định. Hết mốc trở về trạng thái nền hoặc mốc còn hiệu lực; `hold_after_end` giữ biến thể/ảnh/hiển thị sau Đến, không kéo dài tư thế. Tắt Hub tắt hiệu lực các mốc con. Time chung phải chỉnh tại node Time.
- AI: `get_workflow` lấy ID → `get_part_cues(node_id, time)` đọc ID node con, layer/biến thể, các chặng Motion và vị trí/hiển thị tại thời điểm → `set_part_cue` sửa hoặc thêm mốc → chụp preview để kiểm tra. Mỗi lệnh sửa là một bước Undo/Redo; tool từ chối Hub, biến thể/mảnh ngoài bộ phận và khoảng thời gian sai.
- MCP regions: `workflow_part_preview`, `workflow_part_stage`, `workflow_part_cues`, `workflow_part_hub`, `workflow_part_editor`. Tổng catalog: **146 tools**. Cập nhật schema bằng `pnpm mcp:schemas`.

PowerShell:
```powershell
pnpm pxs call get_part_cues '{"node_id":"part-child-id","time":3}'
pnpm pxs call set_part_cue '{"node_id":"part-child-id","action":"add","at":3,"duration":1,"rotation":25,"wave":"hold"}'
pnpm pxs review --view app --region workflow_part_preview --out D:\_tmp\part-preview.png
```
CMD:
```cmd
pnpm pxs call get_part_cues "{\"node_id\":\"part-child-id\",\"time\":3}"
pnpm pxs call set_part_cue "{\"node_id\":\"part-child-id\",\"action\":\"add\",\"at\":3,\"duration\":1,\"rotation\":25,\"wave\":\"hold\"}"
```
Flags (PowerShell/CMD):
```text
pnpm pxs call set_part_cue --node_id part-child-id --mode part_variant --variant_id variant-layer-id --start 3 --end 4
```
