# AGENTS.md — Quy Chuẩn Kỹ Thuật & Hướng Dẫn Phát Triển (Parallax Studio V2)

Tài liệu này là **nguồn quy chuẩn trung tâm** dành cho AI Agent (Antigravity, Claude Code, Codex...) khi tham gia phát triển dự án **Parallax Studio V2**.

---

## 1. Tổng Quan Dự Án (Project Overview)

- **Tên dự án:** Parallax Studio V2
- **Mục tiêu:** Ứng dụng Desktop dựng video hiệu ứng **Parallax 2.5D** (tương tự 3D Camera trong Adobe After Effects). Người dùng sắp xếp các layer ảnh theo chiều sâu, phân cảnh (shots), tạo đường bay camera trong không gian 3D và render ra video MP4.
- **Tech Stack:**
  - **Framework desktop:** Electron
  - **Bundler / Build tool:** Vite + electron-vite (`electron.vite.config.ts`)
  - **Ngôn ngữ:** TypeScript, React, HTML5, Vanilla CSS
  - **3D Graphics Engine:** Three.js (WebGL, Custom Shaders, PerspectiveCamera, OrbitControls)
  - **Testing:** Vitest (`vitest.config.ts`)
  - **MCP Integration:** Tích hợp Model Context Protocol server (`mcp-server/index.mjs`) cho phép AI trực tiếp điều khiển app qua TCP localhost:9877.

---

## 2. Kỷ Luật & Quy Chuẩn Lập Trình (Engineering Standards)

### 2.1. Code Modularization (Bắt Buộc)
Tuân thủ nghiêm ngặt kỹ năng `code-modularization`:
- **Độ dài File:**
  - **Hard limit:** Tối đa **1000 dòng**. Tuyệt đối không để file vượt quá 1000 dòng.
  - **Soft limit:** Khi file đạt **500 - 600 dòng**, chủ động refactor và tách module con vệ tinh.
- **Độ dài Hàm / Phương thức:** Tối đa **80 dòng**, khuyến nghị 40 - 50 dòng. Tách các sub-routines và helper functions có tên tường minh.
- **Phân tách trách nhiệm (Separation of Concerns):**
  - **`engine/`**: Chuyên trách Three.js, SceneRenderer, CameraPath, Texture LRU pool, Shaders, WebGL context. Không nhồi nhét React state hay DOM logic vào engine.
  - **`ui/`**: Các React components giao diện (Viewer, Toolbar, Shots, Timeline, Inspector). Giữ component gọn, logic tính toán đưa ra helpers/hooks.
  - **`styles/`**: CSS module hóa theo từng khu vực (`variables.css`, `layout.css`, `toolbar.css`, `viewer.css`, `shots.css`, `timeline.css`). Không gộp chung vào 1 file khổng lồ.

### 2.2. Quality Gates & Baseline Rules
- **Không mock giả tạo:** Triển khai code thật, xử lý thật. Không fake dữ liệu hay tạo shortcut tạm bợ.
- **Kiểm tra trước khi commit:**
  - Chạy `npm test` (vitest) hoặc kiểm tra type TypeScript `npm run build` / `tsc`.
  - Không che giấu hoặc bỏ qua lỗi build, lint, type error hay unhandled promise rejection.
  - Khi tạo hoặc chạy script/test Python, nếu thiếu thư viện (như `chardet`, `numpy`,...), chủ động kiểm tra và chạy `pip install <package>` bổ sung ngay lập tức để bảo đảm tiến trình thực thi thông suốt.
- **Bảo vệ Secrets & Quyền riêng tư:**
  - Tuyệt đối không commit file `.env`, tokens, API keys, private keys hay file dữ liệu nhạy cảm.
- **Git Commit & Push:**
  - Sử dụng chuẩn Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`, `chore:`).
  - Viết commit message bằng **tiếng Việt CÓ DẤU** đầy đủ, chuẩn xác để phân biệt rành mạch các từ tiếng Anh và tiếng Việt giao thoa (ví dụ: `fix(ui): thay thế combobox và color picker native bằng custom component 60fps, triệt tiêu độ trễ 2s`).
  - Không gắn watermark hoặc nhắc tên AI trong commit message.
  - **Bắt buộc kiểm tra sau mỗi lần sửa code (`pnpm verify`):** Ngay sau khi sửa bất kỳ file code nào, AI bắt buộc chạy `pnpm verify` (`node scripts/agent-guard.mjs verify` kiểm tra cú pháp `esbuild`/JSX toàn bộ dự án + `typecheck`), chạy unit test liên quan (`pnpm test`) và kiểm tra `pnpm pxs call ping '{}'` (`rendererReady: true`) nếu app đang mở. Tuyệt đối không chỉ chạy `tsc` đơn lẻ vì một số lỗi cú pháp Babel/esbuild (như trộn `&&` với `??` không có ngoặc đơn) chỉ bị bắt ở bước transform của Vite/esbuild.
  - **Kiểm tra trực quan toàn màn hình trước khi commit & push (Fullscreen Visual QA Gate - BẮT BUỘC):** Khi test xong và trước khi commit / push code, nếu app đang mở (`127.0.0.1:9877`), AI **BẮT BUỘC chụp lại ảnh toàn màn hình ứng dụng 1 lần nữa** (`pnpm pxs review --view app --out D:\_tmp\pre_commit_fullscreen.png` hoặc tool `get_app_screenshot` không truyền `region`), dùng công cụ xem ảnh phân tích để chắc chắn:
    - Không bị đen màn (black screen, trắng màn, sập canvas WebGL / Three.js).
    - Không có thông báo lỗi nổi lên (error toast, crash overlay, banner lỗi hoặc unhandled rejection dialog).
    - Toàn bộ giao diện render bình thường, đầy đủ các panel, viewer và timeline.
    - **Chỉ khi ảnh chụp toàn màn hình xác nhận an toàn tuyệt đối thì mới tiến hành commit và push code.**
  - **Không tự động `git push` khi chưa được yêu cầu:** Khi sửa code xong, chỉ kiểm tra kỹ bằng `pnpm verify` + test + ảnh chụp toàn màn hình và giữ ở local (hoặc chỉ commit/push khi người dùng yêu cầu rõ ràng) để tránh đẩy code chưa kiểm duyệt hoặc code lỗi lên Git.
- **Cưỡng chế cho mọi AI (không chỉ Antigravity):**
  - Cầu nối tự nạp quy chuẩn: `CLAUDE.md` (Claude Code, `@AGENTS.md`), `.cursor/rules/parallax-studio.mdc` (Cursor, `alwaysApply`), `.github/copilot-instructions.md` (Copilot), `.windsurfrules` (Windsurf), `.clinerules` (Cline). Codex/Gemini CLI đọc trực tiếp `AGENTS.md`/`GEMINI.md`. Khi đổi quy chuẩn, cập nhật đồng bộ các file này.
  - Git hooks `.githooks/` (bật qua `prepare` khi `pnpm install` hoặc `node scripts/agent-guard.mjs install`): `commit-msg` chặn message không phải Conventional Commits / thiếu dấu tiếng Việt / nhắc tên AI; `pre-commit` kiểm tra cú pháp `esbuild`/JSX của mọi file code staged, chặn file code > 1000 dòng và secret; `pre-push` tự động chạy `verify` (quét cú pháp `esbuild` toàn dự án + `typecheck`) để chặn tuyệt đối việc push code lỗi lên Git.
- **Dọn tài nguyên:** Sau khi xoá file trong `assets/`, chạy `assets/prune-manifest.bat` (hoặc `pnpm assets:prune [--dry-run]`) để xoá mục thừa trong `assets/manifest.json`.

### 2.3. Quy Chuẩn Đa Giao Diện (Dual-Theme Standard: Dark & Light)
- **Hỗ trợ 2 Theme song song:** Ứng dụng luôn vận hành trên 2 chế độ: Dark Theme (`[data-theme='dark']`) và Light Theme (`[data-theme='light']`).
- **Bắt buộc dùng Design Tokens:** Mọi thành phần UI khi viết mới hoặc sửa đổi CSS **BẮT BUỘC** sử dụng các biến CSS được định nghĩa tại `variables.css`:
  - Mặt phẳng & Nền: `var(--bg-0)`, `var(--bg-1)`, `var(--bg-2)`, `var(--bg-3)`, `var(--bg-4)`.
  - Văn bản: `var(--text)` (chính), `var(--text-dim)` (phụ), `var(--text-faint)` (mờ).
  - Đường viền: `var(--line)`, `var(--line-soft)`, `var(--line-focus)`.
  - Màu nhấn đặc trưng: `var(--accent)` (Royal Blue), `var(--accent-cyan)` (Electric Cyan), `var(--key)` (Gold).
- **Quy tắc tương phản khi Hover / Active / Selected (BẮT BUỘC):**
  - Tuyệt đối không hardcode mã màu cố định như `#ffffff`, `#000000`, `#141414` vào thuộc tính `color`, `background` hay `fill` của SVG mà không có selector phân định theme hoặc nền đậm tương ứng.
  - **Cấm dùng `color: var(--bg-0)` trên nền `--accent` / `--key`:** Trong Light Theme, `--bg-0` là xám sáng (`#f5f6f8`), làm chữ trên nền vàng `--key` bị mù màu. Bắt buộc dùng `color: var(--on-accent)` (`#ffffff`) trên nền `--accent` và `color: var(--on-key)` (`#0f172a`) trên nền `--key`.
  - **Cấm đặt chữ `#ffffff` trực tiếp lên nền màu nhấn động sáng (`--logic-accent`, `--badge-accent`, `--item-c` như vàng cam `#f59e0b` hoặc cyan `#38bdf8`) khi `:hover` / `.active`:** Bắt buộc làm đậm nền bằng `background: color-mix(in srgb, var(--logic-accent, var(--accent)) 78%, #0f172a); color: #ffffff;` để chữ trắng luôn nổi bật sắc nét trên cả 2 theme.
  - Các nút `.btn.ghost` / `.tl-action-btn` trên thanh công cụ phải có viền nhẹ `border-color: var(--line-soft)` và nền `:hover` pha `color-mix(in srgb, var(--accent) 10%, var(--bg-3))` để người dùng nhận diện rõ vùng bấm ở cả 2 theme.

### 2.4. Giao Thức Điều Khiển AI Qua MCP & CLI Controller (`pnpm pxs`)
- **Máy chủ MCP nội bộ:** Ứng dụng cung cấp MCP Server tại `mcp-server/index.mjs` kết nối qua TCP `127.0.0.1:9877` với hơn 50 công cụ chuyên biệt để AI thao tác trực tiếp (xem chi tiết tại `mcp-server/README.md`).
- **Bộ điều khiển CLI (`pnpm pxs`):** AI Agent có thể tra cứu toàn diện và điều khiển trực tiếp qua terminal:
  - `pnpm pxs --help` / `pnpm pxs help <tool>`: Đọc toàn bộ catalog 50+ tools và quy ước tọa độ 2.5D.
  - `pnpm pxs status` / `pnpm pxs inspect`: Kiểm tra trạng thái và xuất JSON toàn bộ dự án hiện tại.
  - `pnpm pxs review --view camera --out <path>`: Chụp ảnh viewport thực tế để AI dùng `view_file` xem và đánh giá bố cục cảnh bằng mắt.
  - `pnpm pxs review --view app [--region <name>] --out <path>` (tool `get_app_screenshot`): Chụp toàn bộ cửa sổ app hoặc cắt đúng vùng UI cần thiết (`region`: `active` (tự chọn dialog/modal nổi trên cùng — ưu tiên dùng ngay sau khi mở bất kỳ hộp thoại nào), `left_panel`, `assets`, `asset_grid`, `asset_bar`, `music`, `shots`, `topview`, `viewer`, `viewer_canvas`, `viewer_hud`, `viewer_tools`, `inspector`, `inspector_body`, `inspector_composite`, `inspector_physics`, `inspector_virtual_light`, `virtual_light_pad`, `composite_swap`, `timeline`, `timeline_toolbar`, `timeline_key_controls`, `timeline_tabs`, `timeline_tracks`, `timeline_workflow`, `workflow_toolbar`, `workflow_palette`, `workflow_canvas`, `workflow_canvas_hud`, `workflow_inspector`, `workflow_ruler`, `workflow_spawn_menu`, `workflow_legend`, `workflow_target_binder`, `workflow_action_builder`, `workflow_preview`, `workflow_json_panel`, `toolbar`, `studio_menu`, `dialog` (dialog nổi trên cùng), `assembly_3d`, `assembly_sidebar`, `assembly_viewport`, `assembly_inspector`, `layer_assembly`, `layer_assembly_sidebar`, `layer_assembly_workspace`, `layer_assembly_inspector`, `layer_assembly_toolbar`, `layer_assembly_viewport_2d`, `layer_assembly_viewport_3d`, `layer_assembly_layers`, `layer_assembly_parts`, `layer_assembly_properties`, `layer_assembly_physics`, `layer_assembly_swap`, `layer_assembly_rig_panel`, `layer_assembly_animation_panel`, `layer_assembly_mixamo_card`, `layer_assembly_mixamo_studio`, `layer_assembly_mixamo_header`, `layer_assembly_mixamo_stage`, `layer_assembly_mixamo_toolbar`, `layer_assembly_mixamo_canvas`, `layer_assembly_mixamo_coords`, `layer_assembly_mixamo_guide`, `layer_assembly_mixamo_sidebar`, `layer_assembly_mixamo_preview`, `layer_assembly_mixamo_angles`, `layer_assembly_mixamo_presets`, `layer_assembly_mixamo_settings`, `layer_assembly_mixamo_footer` (hỗ trợ alias ngắn `mixamo_*`), `layer_assembly_retarget`, `layer_assembly_create`, `layer_assembly_confirm`, `layer_assembly_anim_tools`, `layer_assembly_pose_tools`, `layer_assembly_plant_motion`, `layer_assembly_plant_graph`, `audio_studio`, `audio_studio_sidebar`, `audio_studio_editor`, `audio_studio_waveform`, `audio_studio_tone`, `audio_studio_mixer`, `audio_studio_console`, `perf_dialog`, `perf_hardware`, `perf_meter`, `export`, `export_preview`, `camera_sketch`, `camera_sketch_canvas`, `camera_sketch_sidebar`, `camera_sketch_waypoints`, `camera_path`, `camera_path_presets`, `mcp_dialog`, `mcp_status`, `mcp_config`, `mcp_guide`, `ai_hud` hoặc CSS `selector`), giúp AI chỉ đọc đúng phần UI đang làm việc và tiết kiệm token tối đa (70% - 95%). Kết hợp với `get_ui_state`, `set_ui_dialog`, `ui_click` / `ui_type` để thao tác UI thật. **Kiểm tra giao diện bằng cách này, không dùng trình duyệt** (trình duyệt không có preload/IPC nên hiển thị sai). Lưu ảnh ra ổ còn trống (ví dụ `D:\_tmp`) nếu ổ C: đầy.
  - `pnpm pxs call <tool> '<json>'` (PowerShell) / `pnpm pxs call <tool> "{\"k\":\"v\"}"` (CMD) / `pnpm pxs call <tool> --key value` (cờ đa nền tảng): Thực thi thêm/sửa layer, shot, audio, keyframe theo thời gian thực (realtime) như người dùng thao tác. Hỗ trợ đồng thời cả **PowerShell** (`powershell.exe` / `pwsh`, `./pxs.ps1`, JSON nháy đơn `'{"k":"v"}'`, Hashtable `'@{k=v}'`, tự động phục hồi dấu nháy bị PowerShell 5.1 lược bỏ) và **CMD** (`cmd.exe`, `pxs.cmd`, JSON nháy kép escape `"{\"k\":\"v\"}"`) để mỗi AI Agent tự lựa chọn cú pháp tối ưu nhất cho môi trường shell của mình.
  - **Phản hồi thị giác Neon & Khoá an toàn khi AI thao tác:**
    - Khi AI gửi lệnh qua MCP, app tự kích hoạt viền sáng Neon Cyberpunk chạy quanh app kèm badge HUD trạng thái để người dùng nhận biết ngay lập tức.
    - Lớp bảo vệ an toàn (safety lock barrier) tự động khoá tương tác chuột/bàn phím trong lúc AI thao tác, ngăn người dùng bấm nhầm làm mất trạng thái UI. Người dùng luôn có thể mở khoá khẩn cấp bằng phím `Escape` hoặc nút `[✕ Mở khoá]`. Tool `set_ai_lock` cho phép AI chủ động giữ khoá khi thực hiện chuỗi lệnh nhiều bước.
- **Quy tắc Kiểm Thử Trực Tiếp & Cấm Can Thiệp Tiến Trình Người Dùng (BẮT BUỘC):**
  - **Tuyệt đối KHÔNG tự ý kill/tắt tiến trình Electron của người dùng (`Stop-Process electron`, `kill`):** Người dùng đang trực tiếp mở và theo dõi ứng dụng trên terminal launcher của họ (`pnpm dev`). Việc tắt tiến trình sẽ làm sập cửa sổ người dùng đang làm việc.
  - **Tuyệt đối KHÔNG tự spawn thêm tiến trình dev ngầm trùng lặp (`electron-vite dev`):** Tránh gây xung đột cổng TCP 9877, chiếm dụng GPU/RAM và gây sai lệch trạng thái hiển thị.
  - **Bắt buộc sử dụng trực tiếp app đang chạy của người dùng:** AI kết nối thẳng vào cổng TCP `127.0.0.1:9877` có sẵn để kiểm tra, thao tác và review bằng mắt. Mọi thay đổi sẽ hiển thị realtime ngay trên màn hình trước mắt người dùng.
  - **Quy tắc Hot-Reload (Vite HMR):** Khi sửa code giao diện (`src/renderer/*`), Vite tự động hot-reload trong vài chục mili-giây mà không cần khởi động lại app. Khi sửa code tầng `src/main/*` (Electron Main Process) bắt buộc phải restart: AI **phải thông báo rõ ràng để người dùng chủ động khởi động lại từ terminal của họ**, tuyệt đối không tự ý cưỡng ép tắt tiến trình OS.
- **Bảo toàn tài nguyên:** Khi hoàn tất tác vụ tự động hóa, AI client hoặc người dùng cần ngắt kết nối (`disconnectAll`) hoặc tạm dừng server để tránh duy trì socket chạy ngầm gây hao tốn CPU/RAM máy tính.

### 2.5. Nguyên Tắc Đồng Bộ Tính Năng & AI MCP Controller (Feature & MCP Parity Principle - Bắt Buộc)
- **Đồng bộ song hành 100%:** Khi bổ sung hoặc sửa đổi bất kỳ logic nghiệp vụ, tính năng xử lý nào trong ứng dụng (ví dụ: quản lý âm thanh đa luồng `audioTracks`, hiệu ứng FX, layer, camera, shot, render...):
  1. **Renderer Commands (`src/renderer/src/mcp/commands/`):** Bắt buộc tạo/cập nhật handler tương ứng nhận lệnh và mutate state qua `useEditor.update()` để hỗ trợ hoàn tác Undo/Redo (Ctrl+Z) và hiển thị realtime trên UI.
  2. **MCP Catalog (`mcp-server/catalog/tools-*.mjs`):** Khai báo tool một lần với Zod schema, mô tả **song ngữ** cạnh nhau (`doc: L(en, vi)`, tham số `d(en, vi)`) và ví dụ mẫu `example` chuẩn; cập nhật `toolCount` trong `catalog/guide.json`. `mcp-server/index.mjs` tự đăng ký tool từ catalog.
  3. **CLI Controller & Quy Tắc Song Hành PowerShell + CMD (`mcp-server/cli.mjs` + `mcp-server/cliParams.mjs` - BẮT BUỘC):** Tự sinh catalog `pnpm pxs` từ cùng catalog và **bắt buộc hỗ trợ đồng thời cả PowerShell lẫn CMD** cho mọi MCP tool mới/cập nhật: `toolDualShellExamples(tool)` tự sinh đủ 3 cú pháp `[PowerShell]` (`'{"k":"v"}'`), `[CMD]` (`"{\"k\":\"v\"}"`) và `[Flags]` (`--key value`) trong `pnpm pxs help <tool>`; `parseCliCallParams` xử lý cả JSON nháy đơn PowerShell 7, token bị PowerShell 5.1 tách/bỏ nháy, Hashtable `@{k=v}`, JSON escape CMD và cờ `--key value` để mỗi AI Agent tự chọn shell tối ưu nhất.
  4. **Antigravity Tool Schemas (`~/.gemini/antigravity-ide/mcp/parallax-studio/*.json`):** Chạy `pnpm mcp:schemas` để sinh lại (kiểm tra bằng `--check`).
  5. **Tài liệu hướng dẫn:** Cập nhật ngay `mcp-server/README.md`, `README.md` và `AGENTS.md` (luôn ghi rõ cả cú pháp PowerShell và CMD khi minh họa lệnh MCP/CLI); nếu đổi quy trình thì sửa `catalog/guide.json` (EN và VI cùng số dòng). Tuyệt đối không để xảy ra tình trạng ứng dụng có logic nhưng AI/MCP bị mù hoặc thiếu công cụ thao tác (như tình trạng thiếu logic âm thanh trước đây).
  6. **Unit Tests:** Luôn viết test kiểm thử cho MCP commands mới trong `src/renderer/src/mcp/commands/*.test.ts`; `mcp-server/catalog/catalog.test.mjs` bắt buộc kiểm tra EN/VI khớp cấu trúc **và** kiểm thử tự động cả cú pháp PowerShell (5.1 & 7+), CMD, Hashtable lẫn Flags cho 100% tool trong catalog.
- **Nguyên Tắc Định Danh UI Control & Đồng Bộ MCP Crop (Targeted UI Inspection Principle - BẮT BUỘC):** Mọi bề mặt UI mới hoặc được sửa (dialog, modal, modal lồng trong xưởng, popover, panel, thân tab, card, toolbar, picker...) đều phải chụp được riêng qua MCP. Checklist bắt buộc (skill chi tiết: [`.agents/skills/mcp-ui-region/SKILL.md`](./.agents/skills/mcp-ui-region/SKILL.md)):
  1. **Định danh phần tử gốc:** gắn **cả** class ngữ nghĩa (ví dụ `.lw-mixamo-motion-modal`, `.timeline-toolbar`, `.export-modal`; cấm class chung chung vô nghĩa) **và** thuộc tính `data-mcp-region="<ten_vung_snake_case>"`. Dialog mở bên trong dialog/xưởng khác (modal lồng) gắn thêm `data-mcp-dialog` để được nhận diện là hộp thoại.
  2. **Đăng ký registry:** thêm vùng vào `UI_REGION_SELECTORS` trong [`uiRegions.ts`](./src/renderer/src/mcp/uiRegions.ts) (chứa cả `resolveTargetElement`, `findActiveDialog`; [`uiCommands.ts`](./src/renderer/src/mcp/commands/uiCommands.ts) chỉ re-export). Selector `[data-mcp-region="x"]` luôn được thử tự động làm phương án dự phòng.
  3. **Đăng ký catalog:** thêm cùng tên vùng vào `z.enum` `region` của `get_app_screenshot` trong [`tools-scene.mjs`](./mcp-server/catalog/tools-scene.mjs), rồi chạy `pnpm mcp:schemas` để sinh lại tool schema cho Antigravity.
  4. **Kiểm thử parity:** chạy `pnpm test`. Test [`uiRegions.test.ts`](./src/renderer/src/mcp/uiRegions.test.ts) quét mọi `src/renderer/src/**/*.tsx` tìm `data-mcp-region="..."` và **FAIL** nếu vùng thiếu trong `UI_REGION_SELECTORS` hoặc enum catalog (đồng thời kiểm tra key registry == enum) — quên đăng ký là vỡ test.
  5. **Visual QA cả 2 theme:** chụp bằng `get_app_screenshot(region: ...)` hoặc `pnpm pxs review --view app --region <ten_vung> --out D:\_tmp\x.png` trên **Dark và Light**, kiểm tra không cắt chữ/tiêu đề/ô nhập, không chồng lấn control, tương phản rõ.
  6. **Tài liệu:** cập nhật danh sách region ở mục 2.4 và `mcp-server/README.md`.
  - **Vùng đặc biệt `active`:** tự chụp dialog/modal **nổi trên cùng** đang hiển thị (ví dụ Studio Mixamo mở trên Xưởng Lắp Ráp Layer thì chỉ chụp Studio Mixamo, không chụp cả xưởng); vùng `dialog` cũng chọn dialog trên cùng thay vì phần tử khớp đầu tiên. AI nên dùng `region: "active"` ngay sau khi mở bất kỳ hộp thoại nào, rồi dùng sub-region chính xác (ví dụ `layer_assembly_mixamo_stage`) khi soi một control cụ thể.
  - **Mục đích & Quy trình AI quan sát qua MCP:**
    1. **Kiểm tra giao diện (Visual QA):** AI dùng `get_app_screenshot(region: ...)` để chụp đúng khu vực control vừa sửa thay vì chụp full app, giảm 70% – 95% token ảnh, tự đánh giá bố cục, màu sắc, font chữ và viền hiển thị đã chuẩn chưa.
    2. **Chẩn đoán & Sửa lỗi cùng người dùng:** Khi người dùng đang chỉnh sửa chỗ nào chưa ổn hoặc gặp lỗi giao diện, AI thông qua MCP chụp đúng vùng control đó, đọc ảnh phân tích và trực tiếp viết code tinh chỉnh giúp người dùng.
    3. **Thị phạm thao tác (Demonstration):** AI kết hợp `ui_click`, `ui_type` để trực tiếp điều khiển app (mở dialog, chuyển tab, kích hoạt tính năng), giúp người dùng quan sát trực quan cách làm ngay trên màn hình.
- **Tài liệu AI song ngữ (mặc định tiếng Anh):** Công tắc trong `McpDialog` (`ui/mcp/McpAiGuideCard.tsx`) lưu `docsLang` vào `mcp.json` qua IPC `mcp:setDocsLang`; MCP server theo dõi file và đổi mô tả tool trực tiếp (`tools/list_changed`). Ưu tiên: `PARALLAX_MCP_LANG` > `docsLang` > `en`.

### 2.5b. Một Logic Chung Timeline ⇄ Workflow V2 (BẮT BUỘC)
- **Nguồn sự thật là dữ liệu thật của Project** (Layer: `motion`, `virtualLight`/`glow`, `physics.depthPortal`, `physics.material`, xung lực `wf-col-*`; track âm thanh gắn layer). Đồ thị Workflow V2 được **suy ra** từ dữ liệu này bằng `syncWorkflowV2Graph` (`src/renderer/src/project/workflowV2Sync.ts`) và Timeline ghi lại qua `patchDerived` (không tạo bước Undo).
- **Thêm / sửa ở bên nào cũng phải đi qua cùng một đường:** gắn logic dùng `attachLogicNodeToLayerV2` + mẫu chung `WORKFLOW_V2_LOGIC_PRESETS` (`workflowV2LogicPresets.ts`, id `v2:<nhóm>:<tuỳ chọn>`); xoá dùng `detachWorkflowV2NodeFromProject` (gỡ hẳn hiệu ứng để Node không bị suy diễn hồi sinh); tắt Node chỉ tắt hiệu ứng, giữ cấu hình.
- **Không gian chung:** một đồ thị cho toàn dự án, mỗi Cảnh là một cụm (Root → Camera / Nhóm → Layer → Logic) theo thứ tự camera đi qua (`computeShotRoute`, cùng nguồn `shotAtTime` với dải "Cảnh đang quay"); Camera các cảnh nối nhau bằng dây chuyển cảnh (chỉ hiển thị, không nối tay).
- **Bố cục:** thẻ cố định 236×64, khoảng hở cột 120px; thẻ kéo tay được ghim (`params.pinned`) và tự né chỗ trống (`findFreeV2Spot`); "Sắp xếp" bỏ ghim. Khung vẽ chỉ render thẻ/dây trong tầm nhìn (culling) để nhiều cảnh không gây giật.
- **Kiến trúc Modular JSON (`main.json` + `shots/shot-N.json`):** mỗi Cảnh có một tài liệu JSON độc lập (`parallax-workflow-shot`, tạo bởi `buildShotWorkflowJson`, áp dụng qua `applyShotWorkflowJson`) chứa trọn vẹn Camera, Layer, Logic (`logic[]`) và đồ thị của riêng cảnh đó; `main.json` (`parallax-workflow-main`, tạo bởi `buildMainWorkflowJson`, áp dụng qua `applyMainWorkflowJson`) kết nối lộ trình Camera (`route`, `connections`) và danh sách các file cảnh. Khi đổi cảnh trên thanh công cụ / sơ đồ, bảng `JSON Cảnh & Main` (`workflow_json_panel`) tự chuyển sang JSON của cảnh đó.

### 2.6. Quy Chuẩn Thành Phần Giao Diện & Combobox (Custom UI Controls Standard - BẮT BUỘC)
- **Tuyệt đối KHÔNG dùng thẻ native `<select>` hay native OS color picker:**
  - Trong Electron desktop app (đặc biệt là môi trường modal dialog / overlay), thẻ `<select>` native kích hoạt popup window của OS rất dễ bị đứng hình, giật lag 1-2s, hoặc không mở được do xung đột với sự kiện pointer capture của modal.
  - Mọi trường lựa chọn giá trị, menu dropdown hoặc bộ chọn màu **BẮT BUỘC** sử dụng các component chuẩn 60fps trong `src/renderer/src/ui/controls/`:
    1. **`Menu` (`<Menu>` từ `ui/controls`):** Dành cho menu nút bấm xổ danh sách thao tác, chia nhóm, có icon và phím tắt (như menu "Thêm layer", "Tệp", "Khổ mẫu…", "Thao tác…"). Tích hợp sẵn click-outside trên `pointerdown`, tự đóng bằng `Escape`, mở tức thì 0ms.
    2. **`Select` (`<Select>` từ `ui/controls/CustomSelect.tsx`):** Dành cho form field chọn giá trị đơn trong Inspector, Bảng thuộc tính hay Panel cấu hình. Hỗ trợ prop `size="sm"` cho panel nhỏ hẹp, hỗ trợ tìm kiếm khi danh sách dài.
    3. **`ColorPickerCustom` (`ui/controls/ColorPickerCustom.tsx`):** Dành cho chọn màu sắc thay vì `<input type="color">`.
- **Quy tắc Z-Index & Portals cho Popups/Dropdowns:**
  - Các modal/workshop overlay lớn (như xưởng lắp ráp 2.5D, xưởng 3D) có `z-index: 10000` trở lên.
  - Mọi component render popup qua React Portal (như menu thả xuống của `CustomSelect`, Tooltips, Context Menus) **BẮT BUỘC** đặt `z-index >= 50000` (mặc định của `CustomSelect` là `50000`) để bảo đảm popup luôn nổi trên cùng, không bị chìm bên dưới modal.
- **Quy tắc Tránh Cắt Cụt Popup (Overflow Clipping):**
  - Tuyệt đối không đặt `overflow-x: auto` hoặc `overflow: hidden` trực tiếp lên thanh công cụ (Toolbar) có chiều cao cố định (`height: 36px`) chứa menu dropdown cục bộ (`position: absolute`). Theo CSS spec, `overflow-x: auto` sẽ tự động ép `overflow-y` thành `auto`, làm các menu con tuyệt đối bị cắt cụt bên trong chiều cao 36px.
  - Thanh công cụ chứa menu con phải luôn giữ `overflow: visible;` và định nghĩa `position: relative; z-index: 5000;`. Khi cần thanh cuộn ngang cho nội dung toolbar hẹp, phải bọc các nút không có menu trong container cuộn riêng biệt.
- **Cấm dùng Combobox trên Node Canvas có Zoom/Drag hoặc tập lựa chọn nhỏ (`<= 5` mục):**
  - Trên các thẻ Node có kéo thả / áp dụng CSS `zoom` (như Workflow Canvas), hoặc thanh công cụ / bảng cấu hình có ít lựa chọn (`2–5` preset/mẫu), **TUYỆT ĐỐI KHÔNG** dùng combobox (`<Select>` / `<CustomSelect>`), vì CSS `zoom` làm lệch toạ độ `getBoundingClientRect()` của Portal và xung đột sự kiện `pointerdown` kéo node khiến bấm chọn item không nhận.
  - Thay vào đó **BẮT BUỘC** sử dụng **1-Click Segmented Pills** (`.wf-preset-pill`), **Option Cards** (`.wf-preset-option-card`) hoặc **Icon Chip Grid** (`.wf-action-chip-grid`) để chọn trực tiếp bằng 1 cú nhấp chuột, hiển thị tường minh trạng thái đang chọn.
- **Quy Chuẩn Thiết Kế Bảng Thuộc Tính Gọn Gàng Trong Dock Thấp (Compact Dock Inspector & Vertical Icon HUD Standard):**
  - Với các cột cấu hình nằm trong dock dưới cùng có chiều cao hạn chế (`height: 240px – 350px`, như cột `Cấu hình Khối & 2.5D` của Workflow Studio), **TUYỆT ĐỐI KHÔNG** xếp chồng 5–6 khối nội dung dài làm xuất hiện thanh cuộn rối mắt, khó thao tác. **BẮT BUỘC** phân tách thành **Segmented Sub-Tabs** gọn gàng (ví dụ: `⚙️ Chế độ & Cổng` | `🎯 Layer & 2.5D` | `➕ Chuyển động`), dùng thẻ lựa chọn trực quan có radio/badge rõ nét.
  - Các cụm nút điều khiển nổi trên góc Canvas (như `.wf-canvas-hud`) **BẮT BUỘC** thiết kế dạng **dọc chỉ dùng Icon** (`.wf-canvas-hud.vertical`, có `title` tooltip rõ ràng) thay vì thanh ngang nhiều chữ chiếm diện tích khung vẽ.
- **Quy Chuẩn Kéo Thả 4 Hướng Tự Do & Lưu Cache Co Giãn Khung Làm Việc (`localStorage`):**
  - Mọi phần tử kéo thả trên canvas (Node, Waypoint) phải hỗ trợ kéo tự do đủ 4 hướng (`Left / Right / Top / Bottom`), không kẹp cứng `Math.max(8, ...)` sát mép trái/trên và không tự động reset vị trí khi người dùng kéo node sang trái hoặc lên trên. Kéo dây nối giữa các node phải hỗ trợ thả linh hoạt vào bất kỳ vị trí nào trên thân thẻ Node đích (magnetic card drop).
  - Mọi thanh kéo co giãn chiều cao khu vực làm việc (như `.splitter` của Timeline / Workflow dock) **BẮT BUỘC** lưu và khôi phục chiều cao qua `localStorage` (`pxs:timeline-dock-height`).
- **Quy Chuẩn Đồng Bộ Bo Góc Control & Chống Khuất UI/Text (Unified Control Geometry & Anti-Clipping Standard - BẮT BUỘC):**
  - **Đồng bộ bo góc (`border-radius`), cấm trộn lẫn nút vuông / tròn / viên thuốc trong cùng cụm:** Mọi button, chip thao tác, segmented control, badge đếm số trên tab (`.tab-count`, `.asset-subtab-badge`, `.tl-mode-tab-badge`), và mốc lộ trình (`.tl-cam-wp-node`, `.anim2d-callout-bubble`) trong cùng thanh công cụ hoặc cùng khu vực **BẮT BUỘC** dùng các token chữ nhật bo góc thống nhất (`var(--radius-sm)` `4px`, `var(--radius)` `5px`, `var(--radius-md)` `6px`). Tuyệt đối không trộn lẫn nút vuông (`0–2px`), nút bo góc (`4–6px`) và viên thuốc tròn (`999px`) cạnh nhau; phân biệt trạng thái đặc biệt (như mốc đầu cảnh `🚩#1`) bằng màu viền (`var(--key)`), biểu tượng cờ và nền nhấn thay vì đổi hình dáng.
  - **Chống khuất nút bên phải thanh công cụ (Flex Toolbar Anti-Overflow):** Trên các thanh công cụ ngang (như `WorkflowStudioToolbar`, `TimelineToolbar`), cụm trạng thái ở giữa phải đặt `flex: 1 1 auto; min-width: 0; overflow: hidden;` và cụm CTA chính bên phải cùng (`.deploy-ops`, `⚡ Áp dụng`) phải đặt `flex-shrink: 0; margin-left: auto;` (không chèn `<div style={{ flex: 1 }} />` thừa làm hẹp cụm giữa hoặc đẩy nút `⚡ Áp dụng` tràn khỏi màn hình).
  - **Chống cắt chữ/mốc tại biên `t = 0.0s` và mép Viewport:** Nhãn thời gian playhead (`.tl-playhead-cap-badge`) và mốc camera đầu tiên (`.tl-cam-wp-node:first-of-type`) tại `0.0s` không được dùng `translateX(-50%)` làm mất nửa trái chữ; phải căn lề trong (`left: 4px; transform: none;` hoặc `transform: translate(2px, -50%)`). Nhãn nổi trên khung nhìn 3D/2D (`.v-label`, `.anim2d-callout-bubble`) phải kẹp toạ độ (clamp) cách mép khung nhìn tối thiểu `28px–30px`; tiêu đề cảnh `.anim2d-shot-header` phải chừa góc phải (`max-width: calc(100% - 20px)`) để không đè lên núm xoay `.anim2d-rot-stem`.


### 2.7. Quy Chuẩn Tính Duy Nhất Của Biểu Tượng (Icon Uniqueness & Semantic Differentiation Standard - BẮT BUỘC)
- **Tuyệt đối KHÔNG sử dụng icon trùng lặp trong cùng một thanh tab (ngang hoặc dọc):**
  - Trong bất kỳ dải tab điều hướng nào (danh mục tài nguyên, thư viện mô hình 3D, xưởng lắp ráp layer, thanh công cụ, inspector...), mỗi tab hay nút danh mục **BẮT BUỘC** phải có biểu tượng icon riêng biệt, duy nhất và thể hiện đúng bản chất nội dung bên trong.
  - Tuyệt đối cấm tình trạng 2 hoặc nhiều tab liền kề/trong cùng một thanh dùng chung một icon (ví dụ: tab "Tất cả mô hình" và tab "Đạo cụ & Khối hộp" đều dùng chung icon Khối hộp `IconCube`; hoặc tab "Đạo cụ" trong xưởng layer 2D lại mượn icon khối hộp 3D thay vì icon chiếc đèn bão `IconPropLamp`).
- **Phân biệt giới tính và ngữ nghĩa nhân vật (Character Gender Differentiation):**
  - Khi danh mục hoặc tài nguyên liên quan đến nhân vật, phải đọc kỹ mô tả chức năng để chọn hoặc tạo icon phản ánh đúng ngữ nghĩa:
    1. **Nhân vật nam / Nam anh hùng (`character_hero`):** Sử dụng `IconUserMale` (vai vuông nam tính, áo sơ mi/cà vạt thanh lịch).
    2. **Nhân vật nữ / Nữ sinh anime (`character_anime`):** Sử dụng `IconUserFemale` (mái tóc dài buông xõa hai bên vai mềm mại).
    3. **Nhân vật chung chung / Sinh vật:** Sử dụng `IconUser`.
    - Tuyệt đối không được lười biếng dùng cùng một biểu tượng người `IconUser` cho cả danh mục nam và nữ, khiến người dùng khó phân biệt giới tính trên thanh tab dọc/ngang.
- **Phân biệt thể loại và phạm vi (Scope & Context Differentiation):**
  - Danh mục tổng quan / toàn cảnh 3D (`all`): Dùng khối không gian lưới 3D `IconGrid3D`, không mượn tạm `IconCube` của đạo cụ.
  - Nội thất & Căn phòng (`room`): Dùng ghế bành thư giãn `IconArmchair` để phân biệt rõ rệt với Kiến trúc & Nhà cửa (`IconHome`) và Khu đô thị phố xá (`IconCity`).
  - Đạo cụ & Trang trí 2D (`prop`): Dùng cây đèn bão / đèn decor `IconPropLamp`.
- **Nguyên tắc tạo mới khi thiếu icon:** Khi bổ sung tính năng hoặc danh mục mới chưa có icon phù hợp, lập trình viên/AI **bắt buộc phải chủ động tạo component SVG icon mới** trong `src/renderer/src/ui/icons.tsx` và ánh xạ trong `src/renderer/src/ui/assets/categoryIcons.tsx`, tuyệt đối không được gán bừa icon có sẵn gây trùng lặp.

### 2.8. Chế Độ Làm Việc Tự Động & Quyền Tự Chủ (Autonomous Working Mode - BẮT BUỘC)
AI làm việc với tinh thần tự chủ tối đa, hạn chế tối đa việc dừng lại hỏi người dùng:
1. **Không hỏi lại:**
   - Nếu yêu cầu còn mơ hồ, tự phân tích ngữ cảnh mã nguồn, tự chọn phương án hợp lý và phổ biến nhất rồi làm tiếp.
   - Ghi các giả định đã dùng vào cuối báo cáo (mục "Giả định"), không dừng giữa chừng để hỏi.
   - Chỉ dừng hỏi khi thực sự thiếu thông tin bắt buộc mà không thể suy luận được từ codebase (ví dụ: API key, thông tin đăng nhập bí mật, quyết định định hướng kinh doanh).
2. **Thực thi lệnh terminal an toàn:**
   - Với các lệnh an toàn (đọc file, liệt kê, build, test, typecheck, lint, cài package npm trong dự án, chạy dev server/script nội bộ), luôn tự chủ chạy và gộp nhiều bước liên quan vào ít lệnh nhất có thể để giảm số lần xác nhận.
   - **Tuyệt đối KHÔNG tự ý chạy các lệnh sau (phải dừng và xin phép người dùng):**
     - Xóa hàng loạt hoặc đệ quy (`rm -rf`, `del /s`, `Remove-Item -Recurse` trên thư mục ngoài dự án).
     - `git push --force`, `git reset --hard`, xóa branch hoặc làm mất commit history.
     - Lệnh tải script về rồi chạy ngay (`curl | sh`, `iwr | iex`).
     - Thao tác lên file/thư mục nằm ngoài workspace.
     - Thay đổi biến môi trường hệ thống, can thiệp Windows Registry, phân quyền OS.
     - Lệnh có đụng đến database production hoặc secrets bảo mật.
3. **Chỉnh sửa file tự động & bảo vệ Secrets:**
   - Tự động áp dụng thay đổi trong workspace, không chờ duyệt từng file.
   - Không sửa file `.env`, file chứa secrets, hoặc file cấu hình hệ thống.
4. **Tự sửa lỗi (Self-Healing):**
   - Khi gặp lỗi (build error, test failure, runtime error): tự đọc log, tự sửa và thử lại tối đa 3 lần trước khi báo người dùng.
   - Không hỏi "bạn có muốn tôi sửa lỗi không?", cứ chủ động sửa nếu nằm trong phạm vi nhiệm vụ.
5. **Báo cáo hoàn tất xúc tích:**
   - Làm xong toàn bộ rồi mới báo cáo một lần ngắn gọn gồm: đã làm gì, file nào đã đổi, giả định đã dùng (nếu có), việc nào cần người dùng quyết định tiếp theo.

### 2.9. Quy Chuẩn Đường Dẫn Tài Liệu Dự Án (Relative Path Standard - BẮT BUỘC)
- Mọi liên kết file, thư mục hoặc tài liệu tham chiếu trong các file markdown của kho mã nguồn (`README.md`, `AGENTS.md`, `docs/**/*.md`...) **BẮT BUỘC** sử dụng đường dẫn tương đối (relative path, ví dụ: `./src/...`, `../../scripts/...`).
- **Tuyệt đối KHÔNG hardcode đường dẫn file hệ thống cục bộ** (như `file:///D:/Codes/...` hay `C:\Users\<user>\...`) vào tài liệu, file code hoặc commit. Quy định này bảo đảm khi người dùng hoặc AI khác pull/clone repo về bất kỳ môi trường OS nào (Windows/macOS/Linux) đều điều hướng chuẩn xác 100%. Cú pháp `file:///` chỉ dùng riêng trong câu trả lời trực tiếp của AI để IDE render link tương tác.

---

## 3. Cấu Trúc Workspace & Thư Mục Tri Thức (.agents/)

Dự án đã được tích hợp đầy đủ hệ thống Customizations cho Antigravity tại thư mục `.agents/`:

```
parallax-studio-v2/
├── .agents/
│   ├── rules/                 ← Các quy tắc chi tiết theo từng domain
│   │   ├── development-rules.md
│   │   ├── primary-workflow.md
│   │   ├── orchestration-protocol.md
│   │   ├── documentation-management.md
│   │   └── review-audit-self-decision.md
│   ├── skills/                ← Hơn 200 kỹ năng on-demand được chuẩn hóa
│   └── mcp_config.json        ← Cấu hình MCP server nội bộ
├── AGENTS.md                  ← File quy chuẩn này (luôn được tự động load)
├── GEMINI.md                  ← Tự động nạp cùng AGENTS.md
├── src/
│   ├── main/                  ← Electron main process
│   ├── preload/               ← Electron preload scripts & IPC bridge
│   └── renderer/              ← React UI + Three.js Engine
│       └── src/
│           ├── engine/        ← Core 3D engine, renderer, camera
│           ├── ui/            ← React UI components
│           ├── styles/        ← CSS design tokens & stylesheets
│           └── types/         ← TypeScript definitions
└── mcp-server/                ← MCP Server điều khiển app qua AI
```

---

## 4. Các Skills Trọng Tâm Cần Kích Hoạt Khi Phát Triển

Khi thực hiện các nhiệm vụ chuyên biệt, AI cần tham chiếu các skill có sẵn trong `.agents/skills/`:
- **Đồ họa 3D & Three.js:** `ak:threejs`, `ak:shader`
- **React & Frontend Architecture:** `ak:react-best-practices`, `ak:frontend-development`, `ak:ui-styling`
- **Giao diện & UI/UX:** `ak:ui-ux-pro-max`, `ak:frontend-design`
- **Testing & Debugging:** `ak:debug`, `ak:test`, `ak:code-review`
- **Video & Media Processing:** `ak:media-processing`, `ak:remotion`
- **Refactoring & Code Quality:** `code-modularization`
- **Đăng ký vùng chụp UI cho MCP (bắt buộc khi tạo/sửa UI):** `mcp-ui-region`

### Layer gizmo implementation (Camera / 3D)
- Geometry/projection helpers: `engine/layerGizmo.ts`; UI: `ui/viewer/LayerGizmo.tsx`; gestures: `ui/viewer/gizmoDrag.ts`.
- Use evaluated world matrices for bounds and anchor projection; author position in shot/parent coordinates and scale before depth compensation.
- Keep one history entry per gesture, preserve current-time keyframe behavior, cancel safely on Escape, and exclude overlays from export.
- MCP parity uses existing `update_layer` position/rotation/scale parameters; regression tests: `mcp/commands/layerCommands.test.ts`.

### 3D Assembly Gizmo implementation (Xưởng Lắp Ráp 3D)
- UI: `ui/assets/models3d/AssemblyGizmo.tsx`; gestures: `ui/assets/models3d/assemblyGizmoDrag.ts`.
- Đồng bộ chuẩn After Effects: Trục tọa độ 3D XYZ (Move), Vòng xoay góc 3D XYZ (Rotate) và 8 điểm mút square trên Bounding Box (Scale/Stretch).
- Tự động cập nhật realtime theo góc xoay camera / OrbitControls; phím Shift giữ tỉ lệ / bước góc 15°; phím Escape hủy thao tác; unit tests tại `assemblyGizmoDrag.test.ts`.

### Xưởng Lắp Ráp 3D – kiến trúc (models3d/)
- **Mẫu mesh ảnh:** `imageMeshTemplates.ts` (6 mẫu lá/hoa/chậu/nhà cao tầng/lan can/cỏ), `imageMeshTypes.ts` (slot ảnh, prompt, biến thể), `imageMeshRecipe.ts` (hướng dẫn và gắn ảnh theo slot), `ImageMeshTemplateDetail.tsx` (chọn PNG/biến thể). MCP: `get_assembly_template`, `apply_assembly_template` nhận `variant_id` + `images`; `update_assembly_face` nhận mesh/grid/bend/depth. Xưởng dùng lịch sử bản nháp `useAssemblyHistory`, chèn model dùng lịch sử project. Tests: `imageMeshRecipe.test.ts`, `mcp/commands/assemblyImageMesh.test.ts`. Hướng dẫn: `docs/image-mesh-templates.md`.
- **Mesh ảnh & Bám pixel:** `silhouette.ts` (marching squares trên padded alpha mask, khử răng cưa với Douglas-Peucker) → `contourMesh.ts` (cắt cell trực tiếp theo polygon silhouette, CCW watertight, không dư cell margin) → `alphaMeshBuilder.ts` (indexed, hàn đỉnh). Editor 2D dùng cùng nguồn qua `mesh2dCells.ts`. Tests: `contourMesh.test.ts`, `alphaMeshBuilder.test.ts`, `silhouette.test.ts`.
- **Vật liệu & Khử bóng loá:** Chuyển sang `MeshLambertMaterial` (thuần Lambertian diffuse reflection, triệt tiêu hoàn toàn hiện tượng bóng chói/loá nhựa trên mặt phẳng ngửa lên). Texture được "alpha bleed" và upload dạng `DataTexture` straight-alpha (`textureResolver.ts`).
- **Ánh sáng & Nắng đổ bóng:** `assemblyLighting.ts` & `assemblySceneLighting.ts` (hướng nắng mặt trời, đổ bóng râm dịu với Three.js `PCFShadowMap` và mặt phẳng bắt bóng `ShadowMaterial`, tự động cân chỉnh tông màu ấm/lạnh theo độ cao mặt trời / thời gian trong ngày).
- **Ghép hít 2 mặt (Two-point join):** `assemblyJoin.ts` (chọn điểm start/end hoặc góc biên cạnh, tự động co giãn cạnh ngắn theo cạnh dài nhất 'longest' để khít cạnh, triệt tiêu hoàn toàn khe hở).
- **Cắt giao nhau (Intersection Clipping):** `assemblyClip.ts` & `assemblyMeshCache.ts` (tự động phát hiện 2 mặt đâm xuyên nhau như tường nhô qua mái dốc và gắn Three.js local clipping planes `material.clippingPlanes` để ẩn pixel thừa).
- **Khuôn mẫu (mô-đun):** kiểu & helper hình học `assemblyTemplateKit.ts` (bắt buộc nhãn `en` cho AI, `anchor` cho bộ phận); danh mục tổng `assemblyTemplateData.ts`; khung nhà chỉ tường + mái `assemblyTemplatesShells.ts` (`shell-*`); bộ phận trang trí rời `assemblyTemplatesDecor.ts` (`decor`: cửa sổ, cửa, ống khói, cột, ban công, bồn hoa, chậu cây…; quy ước `WALL_ANCHOR`: mặt lưng z = 0, nhô về z < 0). `assemblyTemplates.ts` (replace giữ ảnh/id/mesh, append đặt cạnh mô hình). Thao tác mặt thuần: `assemblyFaceOps.ts`, hình học: `assemblyGeometry.ts`. Tests: `assemblyTools.test.ts`, `assemblyTemplatesModular.test.ts`.
- **Ghép mô hình đã lưu:** `assemblyCompose.ts` (`appendModel` cạnh/tại điểm, `appendModelOnFace` gắn lên mặt theo UV bằng ma trận mặt chủ; tự khớp tỉ lệ, sinh id mới, ánh xạ `clipBy`), UI `ModelComposePanel.tsx` trong `FaceInspector`, CSS `assemblyCompose.css`. Tests: `assemblyCompose.test.ts`.
- **Lịch sử & phím tắt:** `useAssemblyHistory.ts` (gộp 450 ms, 1 bước/gesture, `{discrete}` cho thao tác cấu trúc), `useAssemblyShortcuts.ts` (capture-phase, chặn shortcut app chính khi modal mở).
- **Theme & Preview Sạch:** scene 3D đọc token CSS qua `assemblyTheme.ts`; khi lưu mô hình tự động chụp ảnh preview 3D sạch (tạm ẩn helpers, trục xyz, sàn bóng, viền mesh để thu được thumbnail PNG trong suốt chân thực vào `thumbnailDataUrl`).
- **MCP Parity cho Xưởng 3D:** Đồng bộ 100% qua `assemblyBridge.ts` kết nối phiên modal trực tiếp với MCP commands (`src/renderer/src/mcp/commands/assemblyCommands.ts`): `list_models3d`, `get_model3d`, `get_assembly_state`, `list_assembly_templates`, `append_assembly_model`, `save_assembly_model`, `insert_assembly_model`, `add_assembly_face`, `update_assembly_face`, `delete_assembly_face`, `join_assembly_faces`, `auto_assembly_clip`, `set_assembly_lighting`, `get_assembly_screenshot`, `set_assembly_camera`, `apply_assembly_template`, `open_assembly_workshop`, `close_assembly_workshop`, `set_assembly_face_image`. Hỗ trợ cả 2 chế độ: Realtime (mở UI cho user xem trực tiếp) và Headless (tạo ngầm tài nguyên trong nền). Tests: `mcp/commands/assemblyCommands.test.ts`.


### Xưởng Lắp Ráp Layer – thao tác hàng loạt & hệ thống xương Blender (Rigging & Animation)
- **Mesh alpha & uốn mềm 2D:** `layerAssemblyAlphaMesh.tsx` dùng silhouette chi tiết không dilation, giữ lỗ trong suốt và các đảo rời; `engine/layerSkinning.ts` tính trọng số theo đoạn xương trong nhánh đã chọn. UI có nút **Uốn mềm theo chuỗi xương**; MCP `layer_assembly_rig` action `bind`, `binding_mode: "soft"` (mặc định `rigid` để giữ tương thích). `SoftLayerImage.tsx` và preview Three.js dùng chung biến dạng; `exportWorkshopSkin.ts` lưu topology + rig vào `ImageMeshDefinition.skin`, `updateSkinGeometry.ts` cập nhật buffer cho timeline/MP4. Chỉnh vị trí xương ở Edit Mode trước khi gắn; xương không tự nhận diện ngữ nghĩa người/động vật từ ảnh.
- UI: `ui/layerAssembly/WorkshopHeader.tsx`, `WorkshopTools.tsx`, `WorkshopWorkspace.tsx`, `WorkshopRightPanel.tsx` (3 tab: Layer, Tạo xương, Animation), `WorkshopRigPanel.tsx`, `WorkshopAnimationPanel.tsx`, `WorkshopBoneOverlay.tsx` (xương bát diện Blender, tương tác kéo Head dời khớp, kéo Tail đổi góc/chiều dài, Pose Mode kéo xoay trực quan).
- Logic chung UI/MCP: `workshopActions.ts`, `workshopRig.ts`, `workshopRigPresets.ts` (mẫu khung xương người 2D 11 khớp, chuỗi uốn 3 khớp, bộ sinh chuyển động tự động walk cycle, idle breathe, wave hand, sway); bản nháp dùng `workshopHistory.ts` (100 bước, một gesture/một lệnh hàng loạt), không ghi lịch sử dự án trước khi chèn.
- Nướng chuyển động (Bake): `bakeWorkshopRig.ts` chuyển đổi toàn bộ chuyển động phân cấp FK của xương thành keyframe vị trí & góc xoay chuẩn của `ImageLayer` khi chèn vào shot/dự án để xuất video MP4.
- MCP: `select_layer_assembly_layers`, `layer_assembly_action`, `layer_assembly_history`, `layer_assembly_rig`, `set_layer_assembly_playback`, `set_layer_assembly_panel`, `layer_assembly_plant_spine`, `layer_assembly_motion_sketch`, `layer_assembly_ik_pose`, `layer_assembly_secondary_motion`, `add_layer_assembly_layer`, `update_layer_assembly_layer`, `reorder_layer_assembly_layer`, `update_layer_assembly`, `load_layer_assembly`.
- **Vẽ động tác (tab Animation):** logic thuần ở `workshopMotionSketch.ts` (chọn xương gần bút, xoay/dời theo đường đi ngọn xương, chuỗi IK nhiều xương, nhịp `live`/`hand`/`even`, lấy mẫu lại + làm mượt + rút gọn RDP, khứ hồi, nới clip, thay keyframe trong đoạn vẽ); UI `MotionSketchOverlay.tsx` (phím `D`, nhịp thời gian thật chạy đầu phát theo bút, xem trước trong một history gesture rồi ghi một bước hoàn tác), `WorkshopMotionSketchCard.tsx`, store `motionSketchStore.ts`; MCP `layerMotionSketchCommands.ts`. Tests: `workshopMotionSketch.test.ts`, `mcp/commands/layerMotionSketchCommands.test.ts`.
- **Công cụ hoạt hoạ chuyên nghiệp (tab Animation):** `workshopIk.ts` (bộ giải IK CCD, `solveIkPose`), `workshopBoneDrag.ts` (kéo ngọn = IK), `animAssistStore.ts` (IK / onion / quỹ đạo, lưu localStorage), `AnimAssistChips.tsx` (thanh nổi, phím `I` / `O` / `P`), `RigGhostOverlay.tsx` (onion skin + quỹ đạo ngọn), `workshopSecondaryMotion.ts` (vật lý thứ cấp Verlet + lò xo, nướng keyframe), `WorkshopAnimAssistCards.tsx`; CSS `styles/layerWorkshopAnimAssist.css`; MCP `layerAnimProCommands.ts` + catalog `mcp-server/catalog/tools-layer-anim.mjs`; vùng chụp `layer_assembly_anim_tools`. Tests: `workshopIk.test.ts`, `workshopSecondaryMotion.test.ts`, `mcp/commands/layerAnimProCommands.test.ts`.
- **Xương motion (tab Motion):** `engine/plantSpine.ts` (tư thế tĩnh, góc ngọn hướng tới điểm nắm), `engine/plantMotion.ts` (phát lại chuyển động vẽ tay Catmull-Rom tuần hoàn, kiểm tra hợp lệ), `plantSpineEdit.ts` (sửa điểm, dời, học biên độ/nghiêng/tốc độ từ cử chỉ lắc), `plantMotionRecord.ts` (ghi chuyển động vẽ tay: làm mượt, cắt đoạn chờ, nảy về, khép vòng, rút gọn mốc), `plantStrokeHitTest.ts` (tự nhận layer dưới nét qua `data-layer-id`), `PlantSpineShapes.tsx`, `PlantSpineOverlay.tsx` (nắm ngọn ghi/học gió, phím `R` vẽ quỹ đạo ngọn), `PlantMotionSection.tsx` (mục Chuyển động + thanh nổi), `PlantMotionGraph.tsx` (biểu đồ mốc kéo được), `usePlantLiveClock` (gió trực tiếp); MCP `layerPlantMotionParams.ts`; vùng chụp `layer_assembly_plant_motion`. Tests: `plantSpineEdit.test.ts`, `plantMotionRecord.test.ts`, `engine/plantSpine.test.ts`, `engine/plantMotion.test.ts`, `workshopPlantSpines.test.ts`.
- **Nhóm bộ phận & slot hoán đổi (Part groups & swap slots):** layer có thể thuộc một nhóm bộ phận (ví dụ `Đầu` gồm mặt/mắt/miệng/kính/tóc); khoá nhóm thì kéo một thành viên sẽ dời cả nhóm. Các layer chung `slot` (ví dụ `face`) là biến thể thay thế nhau (face-normal / face-happy / face-cry): kích hoạt một biến thể sẽ hiện nó, ẩn các biến thể còn lại và khớp đúng transform neo; thay ảnh bộ phận vẫn giữ vị trí. Trong inspector cảnh (mục `Cụm Layer Chồng`) người dùng đổi nhanh biểu cảm/bộ phận của nhân vật 2.5D đã đặt từ biến thể slot của mẫu hoặc tài nguyên liên quan cùng thư mục. MCP: `layer_assembly_parts` (`list`, `auto_detect`, `create_group`, `assign`, `lock_group`, `set_slot`, `activate_variant`, `replace_asset`) và tool cảnh `swap_composite_part` (`layer_id`, `variant_layer_id` hoặc `asset_path`). Vùng chụp: `layer_assembly_parts`, `layer_assembly_swap`, `inspector_composite`, `composite_swap`.
- Tests: `workshopActions.test.ts`, `workshopHistory.test.ts`, `workshopRig.test.ts`, `mcp/commands/layerAssemblyCommands.test.ts`. Hướng dẫn: `docs/layer-workshop-tools.md`, `mcp-server/README.md`.


### Layer workshop pixel editor
- Cọ tẩy chỉ hoạt động trong khung chỉnh pixel góc dưới trái; bố cục lớn dùng để xem và chọn layer. Thanh dọc gồm cọ mềm, tẩy nét cứng, bàn tay, vừa khung và khôi phục ảnh gốc. Cuộn để zoom quanh con trỏ; Space + kéo hoặc chuột giữa để dời ảnh. Escape hủy nét, mỗi nét hoàn tất là một bước hoàn tác.
- Hình ảnh và tọa độ cọ dùng chung `isolatedBrushGeometry.ts`; kiểm thử tại `isolatedBrushGeometry.test.ts`. MCP tiếp tục dùng `update_layer_assembly_layer` với `patch.imageUrl` qua lịch sử bản nháp, không thêm tool hay schema cho thay đổi bố trí UI.

### Xưởng Lắp Ráp Layer – Mẫu Lắp Ráp Sẵn (Templates) & Prompt AI Chuẩn Atlas
- **Độ phân giải atlas nhân vật:** Prompt dùng tỉ lệ 1:1, metadata `recommended_resolution: model-native`, không ép số pixel. `scripts/slice_puppet_atlas.py` tách 15 PNG theo kích thước thực tế và vùng liên thông, test tại `scripts/test_slice_puppet_atlas.py`; kiểm tra trực quan trước khi gắn qua MCP.
- **Búp bê 15 lớp:** `templates/puppetCharacter.ts` (`tmpl-character-puppet-15`) tách đủ tay/chân 3 đoạn và 15 xương. `templates/characterPrompt.ts` sinh prompt nhân vật từ slot thực tế, atlas vuông 5×5, không trộn bố cục reference 16:9. UI và MCP dùng chung catalog. Mẫu 13 lớp giữ tương thích; script `slice_atlas.py` chỉ dành cho atlas 16:9 cũ. [Quy chuẩn](docs/design/character-cutout-prompt.md).
- **Mẫu có sẵn:** 16 mẫu phong phú chia 4 danh mục: Nhân vật theo lứa tuổi (Nam anh hùng 5x5 atlas, Nữ anime váy xếp ly, Bé thiếu nhi chibi, Quý ông trung niên suit, Cụ già gậy gỗ), Động vật 4 chân & chim cá (Chó cưng, Trâu nước, Mèo mướp, Cá Koi uốn sóng, Gà trống), Cây cối & Thiên nhiên (Bonsai, Bụi hoa), Kiến trúc & Đạo cụ (Ban công, Cổng tàn tích).
- **Bộ xương & Chuyển động sinh tự động:** `creatureRigPresets.ts` sinh xương và keyframe FK tự nhiên cho từng loài (bước đi 4 chân đối xứng chéo `quadrupedWalk`, uốn vẫy đuôi `quadrupedWag`, cá bơi sóng sin `fishSinusoidalSwim`, gà mổ thóc `avianPeckWalk`, bé lon ton `childToddleWalk`, cụ già chống gậy `elderlyCaneWalk`).
- **Prompt AI chuẩn:** Mỗi mẫu tích hợp prompt tiếng Anh chuẩn tạo Sprite Sheet Atlas 5x5 ô trên phông xanh lá chroma-key (#00FF00), sơ đồ slot ô và hướng dẫn kỹ thuật nối khớp bo tròn (10-15% overlap) tại `TemplatePromptModal.tsx`.
- **UI:** `CreateLayerAssemblyModal.tsx` mở khi bấm "+ Tạo mẫu mới" trong xưởng hoặc "Tạo lắp ráp" ở tab tài nguyên, lọc danh mục, tìm kiếm và nút "+ Tự tạo lắp ráp trống".
- **MCP Parity:** `list_layer_assembly_templates`, `get_layer_assembly_template`, `apply_layer_assembly_template` tại `layerAssemblyTemplateCommands.ts` và `tools-layer-assembly.mjs`. Tests: `layerAssemblyTemplates.test.ts`, `creatureRigPresets.test.ts`, `layerAssemblyTemplateCommands.test.ts`.


### Motion Effect Controls
- Bộ tính procedural chung: `animation/proceduralMotion.ts`; viewport/export gọi qua `engine/evaluateScene.ts`, đồ thị UI lấy mẫu cùng bộ tính. Giữ quy ước pha cũ; giá trị 0 phải được tôn trọng.
- UI: `ui/inspector/sections/MotionSection.tsx`, `MotionParameters.tsx`, `MotionPreview.tsx`; CSS `styles/motion.css`. MCP: `set_layer_motion`, `get_layer_motion` qua `mcp/commands/proceduralMotionCommands.ts`, có Undo/Redo. Regions: `motion`, `motion_preview`, `motion_parameters`, `motion_timing`. [Hướng dẫn](./docs/motion-controls.md).

<!-- workflow-quick-connect -->
Workflow: `workflow_quick_connect` chụp riêng menu chọn chức năng khi kéo port; tìm kiếm giữ bộ lọc tương thích theo chiều kết nối, cuộn độc lập với canvas.

Workflow node configuration: `workflow_node_camera_preview` chụp preview camera trực tiếp; `workflow_node_settings` chụp bảng cấu hình. Dialog dùng bản nháp: preview tính ngay khi mở và gộp chỉnh liên tiếp sau 80ms; ghi chú không tính lại preview. Áp dụng ghi một bước Undo; Hủy/Escape/nút đóng bỏ bản nháp.

- Workflow: bung cảnh giữ cấu hình và các cảnh khác; cụm 2.5D có node gốc và node bộ phận. Tự nối dây giữ kết nối hợp lệ, không đổi mục tiêu khi tắt layer và không nối chéo cảnh. `connect_workflow_ports(action: "auto_wire")` dùng cùng logic với UI.

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

Giữ Shift khi chọn node/BBox khác; thao tác mặc định giữ node đang focus. Ctrl + click trên `+ Logic` của layer chọn/bỏ chọn khoảng thời gian, không mở picker. Nhãn Camera nằm trên toolbar, ngoài hình render. Motion BBox chia tab Đường đi, Đích, Thời gian, Chiều sâu, Va chạm.

MCP regions: `viewer_camera_status`, `workflow_motion_panel`, `workflow_motion_path`, `workflow_motion_target`, `workflow_motion_timing`, `workflow_motion_depth`, `workflow_motion_collision`.

PowerShell: `pnpm pxs call ui_click '{"selector":"[data-node-id]","shift":true}'`

CMD: `pnpm pxs call ui_click "{\"selector\":\"[data-node-id]\",\"shift\":true}"`

Flags: `pnpm pxs call ui_click --selector "[data-node-id]" --shift true`
