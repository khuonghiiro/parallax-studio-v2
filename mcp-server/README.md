# Parallax Studio V2 — Model Context Protocol (MCP) Server

Tài liệu này cung cấp **đặc tả kỹ thuật toàn diện** và **hướng dẫn tích hợp** dành cho mọi AI Agent (Antigravity, Claude Desktop, Cursor, Cline, Windsurf, RooCode, Copilot...) khi kết nối và điều khiển trực tiếp ứng dụng **Parallax Studio V2**.

---

## 1. Kiến Trúc Hoạt Động (Architecture)

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

## 4. Danh Sách 42 Công Cụ MCP (Core Tool Reference)

### 4.1. Nhóm Truy Vấn & Thống Kê (Inspection)
- `get_project_info`: Lấy thông tin tổng thể dự án (composition, danh sách shots, layer, camera, look, asset).
- `get_shot_info`: Xem chi tiết 1 cảnh và tất cả layer thuộc cảnh đó.
- `get_layer_info`: Đọc toàn bộ thuộc tính, keyframes và transform của 1 layer.
- `get_camera_info`: Đọc trạng thái vị trí, mục tiêu, FOV của camera tại thời điểm `time`.
- `get_memory_stats`: Kiểm tra dung lượng VRAM GPU, texture pool và RAM tiến trình.
- `get_viewport_screenshot`: Chụp ảnh preview hiện tại (view: `"camera"` hoặc `"3d"`).

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
- `move_layer`: Thay đổi thứ tự z-index xếp chồng layer.

### 4.4. Nhóm Hoạt Ảnh & Keyframes (Animation)
- `set_keyframe`: Đặt keyframe hoạt ảnh tại giây `time` với curve easing (`linear`, `easeInOut`, `hold`...).
- `remove_keyframe` / `clear_keyframes`: Xóa keyframe hoặc làm sạch toàn bộ timeline của thuộc tính.

### 4.5. Nhóm Camera & Đường Bay 3D (Camera Path & Flythrough)
- `set_camera`: Đặt vị trí camera (`position`), điểm ngắm (`target`), góc nhìn (`fov`).
- `apply_camera_preset`: Áp dụng chuyển động mẫu (`slow_push`, `pan_left`, `orbit_subtle`, `crane_up`).
- `camera_fly_to_shot`: Hướng camera bay trực tiếp tới bao quát phân cảnh chỉ định.
- `build_camera_path`: Tự động sinh đường bay Bezier mượt mà kết nối liên tục tất cả các shot.

### 4.6. Nhóm Xử Lý & Dàn Dựng Âm Thanh Đa Luồng (Audio Tracks)
- `set_audio`: Đặt hoặc xóa nhạc nền chính (`file_path`, `offset`, `volume`, `remove`).
- `get_audio_info`: Lấy thông tin chi tiết toàn bộ các tracks âm thanh trên timeline (thời lượng, offset, volume, speed, fade...).
- `add_audio_track`: Thêm đoạn âm thanh từ file (`file_path`) hoặc asset có sẵn (`asset_id`) tại mốc thời gian `offset`.
- `update_audio_track`: Cập nhật thuộc tính của track (`volume`, `offset`, `playback_rate`, `fade_in`, `fade_out`, `gain_db`, `muted`...).
- `delete_audio_track`: Xóa một track âm thanh khỏi timeline theo ID.
- `duplicate_audio_track`: Nhân bản một đoạn âm thanh lùi sau một khoảng thời gian `offset_delta` (mặc định 0.5s).
- `split_audio_track`: Cắt đôi một đoạn âm thanh tại mốc thời gian `split_time` (mặc định tại con trỏ playhead).
- `merge_audio_tracks`: Hòa âm và gộp nhiều tracks (hoặc tất cả các tracks) thành 1 file WAV tổng hợp trong dự án.

### 4.7. Nhóm Điều Khiển Timeline & Xuất Video (Playback & Export)
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
# Xem toàn bộ hướng dẫn quy ước tọa độ 2.5D, danh mục 42 công cụ và workflow mẫu:
pnpm pxs --help

# Tra cứu nhanh tham số và ví dụ gọi của 1 công cụ cụ thể:
pnpm pxs help add_image_layer
pnpm pxs help set_keyframe
pnpm pxs help export_video
```

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
pnpm pxs call add_image_layer '{"file_path": "assets/city/sky.png", "z": 1500, "name": "Sky"}'

# Di chuyển layer sang tọa độ mới
pnpm pxs call move_layer '{"layer_id": "layer-1", "x": 100, "y": 50, "z": 800}'

# Bật hiệu ứng hạt mưa
pnpm pxs call add_particles '{"preset": "rain", "density": 100}'

# Chạy timeline xem thử
pnpm pxs call set_playing '{"playing": true}'
```


### Layer transform gizmos

Camera/3D/split view now exposes XYZ position axes, anchor-centered bbox scaling and XYZ rotation rings. These author existing transform properties, available through `update_layer`: `position: [x,y,z]`, `rotation: [rx,ry,rz]` in degrees, `scale: number | [sx,sy,sz]` as multipliers. Static properties update directly; animated properties key at the playhead; `at_time` explicitly inserts a key. Changes support undo/redo.

Example: `pnpm pxs call update_layer '{"layer_id":"layer-1","position":[120,80,400],"rotation":[15,30,45],"scale":[1.5,0.8,1]}'`.
