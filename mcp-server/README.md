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
- `get_viewport_screenshot`: Chụp ảnh preview hiện tại (view: `"camera"` hoặc `"3d"`).
- `get_app_screenshot`: Chụp toàn bộ cửa sổ app đúng như người dùng thấy (dialog, panel, xưởng lắp ráp) – dùng để AI review giao diện (`pnpm pxs review --view app`).
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

### 4.5. Nhóm Camera & Đường Bay 3D (Camera Path & Flythrough)
- `set_camera`: Đặt vị trí camera (`position`), điểm ngắm (`target`), góc nhìn (`fov`).
- `apply_camera_preset`: Áp dụng chuyển động mẫu (`dollyIn`, `dollyOut`, `truckLeft`, `truckRight`, `craneUp`, `craneDown`, `orbitLeft`, `orbitRight`, `zoomIn`, `dollyZoom`, `reset`).
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
