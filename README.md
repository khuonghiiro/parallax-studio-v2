# Parallax Studio

App desktop (Electron + Three.js) dùng để dựng video **parallax 2.5D** giống After Effects. Bạn xếp các layer ảnh theo chiều sâu, chia thành nhiều **cảnh (shot)** đặt trong không gian 3D, cho camera bay qua từng cảnh rồi xuất MP4. App có **MCP server** để AI (Antigravity, Claude, Cursor…) điều khiển trực tiếp, giống blender-mcp.

## Chạy

```powershell
npm install
npm run mcp:install      # cài phụ thuộc cho MCP server (lần đầu)
npm run dev              # mở app (dev)
npm run build            # build production vào out/
npm test                 # unit test (vitest)
```

> Trên Windows, nếu PowerShell chặn `npm`, hãy dùng `npm.cmd`.

## Khái niệm chính

| Khái niệm | Ý nghĩa |
| --- | --- |
| Đơn vị | 1 đơn vị = 1 pixel của composition. x → phải, y → lên, **z → chiều sâu** (dương = xa camera) |
| Shot (cảnh) | Một nhóm layer đặt ở một vị trí trong world. Toạ độ của layer là **local** trong shot |
| Layer chung | Layer có `shotId = null`, nhìn thấy được từ mọi cảnh |
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

Kiến trúc:

```
AI client ──stdio/MCP──> mcp-server/index.mjs ──TCP 127.0.0.1 + token──> Parallax Studio (đang mở)
```

- App chỉ lắng nghe trên `127.0.0.1` (mặc định cổng `9877`, đổi bằng biến `PARALLAX_MCP_PORT`, tắt bằng `PARALLAX_MCP=0`).
- Mỗi lệnh phải kèm token lưu trong `%APPDATA%\parallax-studio\mcp.json`. Chỉ tài khoản Windows của bạn đọc được file này.
- Mọi thao tác của AI đều là edit bình thường: hiện ngay trên UI và **Ctrl+Z để hoàn tác**.
- Chip **MCP** trên toolbar cho biết trạng thái (vàng = sẵn sàng, xanh = AI đã kết nối) và nháy mỗi khi AI gửi lệnh.

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

Claude Desktop, Cursor và các client MCP khác dùng cùng cấu hình `command` / `args` như trên. **Hãy mở app trước**, rồi mới để AI gọi tool.

### Các tool (37)

| Nhóm | Tool |
| --- | --- |
| Xem | `get_project_info`, `get_shot_info`, `get_layer_info`, `get_camera_info`, `get_memory_stats`, `get_viewport_screenshot` (view `camera` hoặc `3d`) |
| Dự án | `new_project`, `set_composition`, `save_project`, `open_project`, `undo`, `redo` |
| Cảnh | `add_shot`, `update_shot`, `delete_shot` |
| Layer | `add_image_layer` (file_path / base64), `add_text_layer`, `add_solid_layer`, `add_particles`, `update_layer`, `delete_layer`, `move_layer` |
| Keyframe | `set_keyframe`, `remove_keyframe`, `clear_keyframes` |
| Camera | `set_camera`, `apply_camera_preset`, `camera_fly_to_shot`, `build_camera_path` |
| Khác | `set_look`, `set_audio`, `set_time`, `set_playing`, `select`, `set_view`, `export_video`, `execute_script` |

Ví dụ prompt cho AI: *"Tạo 3 cảnh: rừng đêm, biển lúc bình minh, thành phố neon. Mỗi cảnh có 4–5 layer ở các độ sâu khác nhau và một tiêu đề. Camera bay vòng cung giữa các cảnh, mỗi cảnh dừng 3 giây. Chụp 3D view cho tôi xem, rồi xuất MP4 1080p ra D:/Videos/demo.mp4."*

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
