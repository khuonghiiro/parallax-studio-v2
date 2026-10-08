# Parallax Studio

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
1. Mở file [mcp_config.json](file:///C:/Users/Admin/.gemini/config/mcp_config.json) (đường dẫn `C:\Users\Admin\.gemini\config\mcp_config.json`).
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

### Các tool (75)

| Nhóm | Tool |
| --- | --- |
| Xem | `get_project_info`, `get_shot_info`, `get_layer_info`, `get_camera_info`, `get_memory_stats`, `get_viewport_screenshot` (view `camera` hoặc `3d`), `get_app_screenshot` (toàn cửa sổ app), `ui_click`, `ui_type`, `get_ai_guide`, `list_commands` |
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
