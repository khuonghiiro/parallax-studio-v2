# AGENTS.md — Quy Chuẩn Kỹ Thuật & Hướng Dẫn Phát Triển (Parallax Studio V2)

Tài liệu này là **nguồn quy chuẩn trung tâm (Single Source of Truth)** dành cho mọi AI Agent (Antigravity, Claude Code, Cursor, Codex, Copilot, Windsurf, Cline) khi phát triển dự án **Parallax Studio V2**. Giữ file này dưới **22 KB** để hệ thống AI luôn nạp trọn vẹn 100% vào System Prompt mà không bị cắt cụt (truncate).

---

## 1. Tổng Quan Dự Án (Project Overview)

- **Mục tiêu:** Ứng dụng Desktop dựng video hiệu ứng **Parallax 2.5D** (tương tự 3D Camera trong After Effects): sắp xếp layer ảnh theo chiều sâu, phân cảnh (shots), tạo đường bay camera 3D, gắn xương 2.5D / mô hình 3D / Workflow V2 và xuất video MP4 (CPU/GPU YUV420p).
- **Tech Stack:** Electron + Vite (`electron-vite`), TypeScript, React 19, Vanilla CSS + Design Tokens (`variables.css`), Three.js (WebGL, Custom Shaders), Rust/WASM (`crates/pxs_core_accel`), Vitest, MCP Server nội bộ (`mcp-server/index.mjs`, TCP `127.0.0.1:9877`).

---

## 2. Kỷ Luật & Quy Chuẩn Lập Trình (Engineering Standards)

### 2.1. Code Modularization & Phân Tách Tầng (BẮT BUỘC)
Tuân thủ kỹ năng `code-modularization`:
- **Độ dài File:** Hard limit **≤ 1000 dòng** (bị chặn bởi `.githooks/pre-commit`). Chủ động tách module con vệ tinh khi đạt **500–600 dòng**.
- **Độ dài Hàm:** Tối đa **80 dòng** (khuyến nghị 40–50 dòng).
- **Ranh giới kiến trúc:**
  - `src/renderer/src/engine/`: Three.js, SceneRenderer, CameraPath, Texture pool, Shaders, Rig/Skinning. Cấm nhét React state/DOM vào engine.
  - `src/renderer/src/ui/`: React components. Tách logic tính toán sang hooks/helpers.
  - `src/renderer/src/styles/`: CSS module hóa theo từng khu vực (`variables.css`, `layout.css`, `toolbar.css`...).
  - `mcp-server/`: MCP tools, catalog song ngữ (`catalog/tools-*.mjs`) và CLI (`cli.mjs`).

### 2.2. Quality Gates, Chuẩn Commit Tiếng Việt & Quy Trình Git Theo Session (BẮT BUỘC)
- **Không mock giả tạo:** Triển khai logic thật, xử lý thật; cấm fake dữ liệu để vượt bài kiểm tra.
- **Bảo vệ Secrets:** Tuyệt đối không commit `.env`, API keys, tokens, private keys hay dữ liệu nhạy cảm.
- **Kiểm tra bắt buộc sau mỗi lần sửa code (`pnpm verify`):**
  1. Chạy `pnpm verify` (`node scripts/agent-guard.mjs verify` kiểm tra cú pháp `esbuild`/JSX toàn dự án + `typecheck`). Không chỉ chạy `tsc` đơn lẻ.
  2. Chạy unit test liên quan (`pnpm test`). Nếu thiếu thư viện Python khi chạy script/test Python, chủ động `pip install <package>`.
  3. Nếu app đang mở (`127.0.0.1:9877`), kiểm tra `pnpm pxs call ping '{}'` trả `rendererReady: true`.
- **Kiểm tra trực quan toàn màn hình trước khi commit & push (Fullscreen Visual QA Gate - BẮT BUỘC):**
  - Khi test xong và trước khi commit/push, nếu app đang mở, **BẮT BUỘC chụp lại ảnh toàn màn hình 1 lần nữa** (`pnpm pxs review --view app --out D:\_tmp\pre_commit_fullscreen.png` hoặc `get_app_screenshot` không truyền `region`) và đọc ảnh xác nhận: không đen/trắng màn, không sập WebGL canvas, không có error toast/banner lỗi, các panel render đầy đủ.
- **Chuẩn Commit Tiếng Việt CÓ DẤU (BẮT BUỘC):**
  - Định dạng: `[loại] (phạm vi): mô tả bằng tiếng Việt CÓ DẤU` (cấm tiền tố tiếng Anh `fix/feat`, cấm gắn watermark hay nhắc tên AI).
  - Các loại hợp lệ: `[sửa lỗi]` / `[sửa]`, `[tính năng]` / `[thêm]`, `[chỉnh sửa]` / `[chỉnh]`, `[xoá]` / `[loại bỏ]`, `[tái cấu trúc]`, `[hiệu năng]` / `[tối ưu]`, `[dọn dẹp]` / `[bảo trì]`, `[giao diện]`, `[tài liệu]`, `[kiểm thử]`, `[hợp nhất]`.
- **Quy Trình Git Theo Session Và Từng Logic (BẮT BUỘC — xem [branch-management.md](./.agents/skills/ak-git/references/branch-management.md)):**
  - **Nhận diện session:** Dùng ID cuộc hội thoại hoặc lịch sử hội thoại để xác định session. Prompt mới, đổi ngày hay nén ngữ cảnh trong cùng chat KHÔNG phải session mới. Nếu chưa xác định được nhánh thuộc session nào hoặc có thay đổi chưa rõ chủ sở hữu, giữ nguyên trạng thái.
  - **Ngoại lệ xử lý tiếp:** Khi người dùng nói “xử lý tiếp / làm tiếp / continue”, dùng lại đúng nhánh cũ.
  - **Một session, một nhánh:** Chat mới (không yêu cầu xử lý tiếp): kiểm tra working tree sạch, `git pull --ff-only origin master`, merge nhánh session cũ vào `master` bằng `--no-ff` với message tiếng Việt, kiểm tra chất lượng, push `master`, rồi tạo nhánh `<action>/<session-topic>`.
  - **Commit ngay theo từng logic:** Chia yêu cầu dài thành các logic hoàn chỉnh. Xong logic nào phải kiểm tra và commit riêng ngay trước khi làm logic kế tiếp; chỉ stage file/hunk thuộc logic hiện tại, bảo toàn thay đổi khác.
  - **Push một lần cuối prompt:** Hoàn tất mọi logic trong prompt mới push nhánh session một lần (`git push -u origin HEAD`).
- **Cưỡng chế tự động:** Git hooks `.githooks/` (`commit-msg`, `pre-commit`, `pre-push`) qua `scripts/agent-guard.mjs`. Cầu nối AI: `GEMINI.md`, `CLAUDE.md`, `.cursor/rules/parallax-studio.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`, `.clinerules`.

### 2.3. Quy Chuẩn 2 Theme (Dark & Light), Độ Tương Phản & Hình Học Control (BẮT BUỘC)
- **Bắt buộc dùng Design Tokens (`src/renderer/src/styles/variables.css`):**
  - Nền: `var(--bg-0)`..`var(--bg-4)` | Chữ: `var(--text)`, `var(--text-dim)`, `var(--text-faint)` | Viền: `var(--line)`, `var(--line-soft)`, `var(--line-focus)` | Nhấn: `var(--accent)`, `var(--accent-cyan)`, `var(--key)`.
- **Quy tắc tương phản Hover / Active / Selected:**
  - Tuyệt đối KHÔNG dùng class Tailwind CSS (dự án dùng Vanilla CSS + Tokens) và KHÔNG hardcode `#ffffff`, `#000000`, `#141414` không có ngữ cảnh theme.
  - **Cấm dùng `color: var(--bg-0)` trên nền `--accent` / `--key`:** Bắt buộc dùng `color: var(--on-accent)` (`#ffffff`) trên `--accent` và `color: var(--on-key)` (`#0f172a`) trên `--key`.
  - **Cấm đặt chữ `#ffffff` trực tiếp lên màu nhấn động sáng (`--logic-accent`, `--badge-accent`, `--item-c`) khi `:hover` / `.active`:** Phải làm đậm nền bằng `background: color-mix(in srgb, var(--logic-accent, var(--accent)) 78%, #0f172a); color: #ffffff;`.
  - Nút `.btn.ghost` / `.tl-action-btn` phải có viền nhẹ `border-color: var(--line-soft)` và `:hover` pha `color-mix(in srgb, var(--accent) 10%, var(--bg-3))`.
- **Đồng bộ bo góc & Chống cắt chữ (Unified Geometry & Anti-Clipping):**
  - Mọi button, chip, segmented control, badge đếm số (`.tab-count`, `.asset-subtab-badge`, `.tl-mode-tab-badge`), mốc lộ trình trong cùng cụm dùng bo góc chữ nhật thống nhất (`var(--radius-sm)` `4px` / `var(--radius)` `5px` / `var(--radius-md)` `6px`); cấm trộn nút vuông (`0–2px`), bo góc và viên thuốc tròn (`999px`) cạnh nhau.
  - Trên thanh công cụ ngang, cụm giữa đặt `flex: 1 1 auto; min-width: 0; overflow: hidden;` và cụm CTA bên phải đặt `flex-shrink: 0; margin-left: auto;`. Nhãn tại `t = 0.0s` và sát mép viewport phải kẹp toạ độ (clamp), không dùng `translateX(-50%)` làm mất nửa chữ đầu.

### 2.3b. Quy Chuẩn Responsive 4 Breakpoints & Chống "Sa Mạc Trống Trải" (BẮT BUỘC)
Chi tiết tại [responsive-standard.md](./.agents/rules/responsive-standard.md):
- **4 Breakpoints:** **Phone** (`<= 768px`, 1 cột `1fr`, drawer trượt, nút `>= 36–44px`) | **Tablet** (`769–1120px`, lưới 2 cột `minmax(280px, 1fr)`) | **Laptop** (`1121–1366px`, lưới 2–3 cột) | **Desktop** (`> 1366px`, lưới 3–4 cột, `max-width: 1400px–1680px`).
- **Triệt tiêu "Sa Mạc Trống Trải" (Anti-Empty Desert):** Cấm trải dài 1 dòng đơn lẻ 100% trên màn hình rộng 1920px làm nhãn bên trái và nút bên phải cách nhau hàng nghìn pixel. Bắt buộc dùng lưới Card đa cột tự co giãn (`display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 8px–10px;`).
- **Typography & Vùng bấm:** Badges/Tags `10–11px`; Labels phụ `11–12px`; Controls/Buttons/Inputs `12–14px`; Tiêu đề thẻ `14–16px`; Tiêu đề dialog `16–18px` (tối đa `20px`). **CẤM `font-size > 20px` cho controls/cards** hoặc gán pixel width cố định lớn (`width: 800px`, `100vw`). Vùng bấm tối thiểu `36px × 36px`, `gap >= 6px–8px`.

### 2.4. Giao Thức MCP, CLI (`pnpm pxs`) & Cấm Can Thiệp Tiến Trình Người Dùng (BẮT BUỘC)
- **Điều khiển trực tiếp qua TCP `127.0.0.1:9877` (146 tools — xem [mcp-server/README.md](./mcp-server/README.md)):**
  - Tra cứu & trạng thái: `pnpm pxs --help`, `pnpm pxs help <tool>`, `pnpm pxs status`, `pnpm pxs inspect`.
  - Chụp ảnh đánh giá bằng mắt (không dùng trình duyệt ngoài):
    - `pnpm pxs review --view camera --out <path>` (chụp viewport 3D).
    - `pnpm pxs review --view app [--region <name>] --out <path>` (tool `get_app_screenshot`): dùng `region: "active"` ngay sau khi mở dialog để chụp đúng modal nổi trên cùng, sau đó dùng sub-region cụ thể (`toolbar`, `viewer`, `inspector`, `timeline`, `workflow_canvas`, `layer_assembly`, `assembly_3d`, `loop_animator`, `audio_studio`, `manifest_dialog`...; danh sách đầy đủ trong [`src/renderer/src/mcp/uiRegions.ts`](./src/renderer/src/mcp/uiRegions.ts)) để tiết kiệm 70%–95% token ảnh. Lưu ảnh tạm vào `D:\_tmp`.
  - Thực thi lệnh Dual-Shell:
    - **PowerShell:** `pnpm pxs call <tool> '<json>'` hoặc `'@{k=v}'`
    - **CMD:** `pnpm pxs call <tool> "{\"k\":\"v\"}"`
    - **Flags (mọi shell):** `pnpm pxs call <tool> --key value`
  - **Khoá an toàn & Viền Neon:** Tự động bật khi AI thao tác (người dùng mở khoá khẩn cấp bằng `Escape`).
- **Cấm Can Thiệp Tiến Trình (BẮT BUỘC):**
  - **TUYỆT ĐỐI KHÔNG kill tiến trình Electron của người dùng (`Stop-Process electron`, `kill`)** và **KHÔNG tự spawn thêm `electron-vite dev` trùng lặp**. Luôn kết nối thẳng vào cổng `9877` đang mở.
  - Sửa `src/renderer/*` được Vite HMR tự cập nhật tức thì; sửa `src/main/*` cần restart thì thông báo để người dùng chủ động khởi động lại.

### 2.4b. AI UI Inspector (`Win + Alt`) & AI UI Code Handoff (`Win + Ctrl`) (BẮT BUỘC)
Chi tiết tại skill [ai-ui-inspector](./.agents/skills/ai-ui-inspector/SKILL.md):
- **Khi người dùng dán báo cáo `AI UI INSPECTOR` (`Win + Alt`):**
  - Mở thẳng `file:dòng` trong bảng **⚡ Mở ngay (Jump-to-code)** (`JSX render` từ `data-ai-src`, `Component / Call-site`, `CSS`). Không grep dò luồng toàn dự án.
  - Ưu tiên sửa đúng phần tử có nhãn `🎯 [FOCUS]` hoặc `⭐ [ACTIVE]`.
- **Khi tạo / sửa UI:**
  - Không tự gõ `data-ai-src` (Babel plugin dev [`scripts/vite/aiSourceLocatorBabel.mjs`](./scripts/vite/aiSourceLocatorBabel.mjs) tự gắn).
  - Dialog/modal/popup/menu gắn `role="dialog|menu|listbox"` + `data-ai-surface="dialog|popup"` + `data-ai-surface-label="<tên>"` (modal lồng thêm `data-mcp-dialog`). Nút chỉ có icon bắt buộc có `title` + `aria-label` tiếng Việt; phần tử bấm không phải `<button>` dùng `role="button"` hoặc `data-ai-id`. Lớp phủ toàn màn hình mới đăng ký vào `INSPECTOR_OVERLAY_SELECTOR` ([`aiUiInspectorSurfaces.ts`](./src/renderer/src/ui/inspector/aiUiInspectorSurfaces.ts)).
- **AI UI Code Handoff (`Win + Ctrl`, hộp thoại `ai_code_handoff`, MCP `export_ui_code` / `import_ui_code`):**
  - Xuất gói UI gọn (rule CSS + ~21 dòng JSX quanh call-site + SHA-256). AI trả JSON `{version:2,bundleId,files:[{path,baseHash,edits:[{id,content}]}]}` chỉ chứa đoạn sửa (không số dòng, không trả cả file).
  - **Cấm sửa bằng inline style (`style={{...}}`) để lách thiếu CSS:** Nếu thiếu rule CSS/file, trả `{version:2,bundleId,needMore:{classes:[...],files:[...],reason:"..."}}`.

### 2.5. Đồng Bộ Tính Năng, MCP Dual-Shell & Đăng Ký Vùng Chụp UI (BẮT BUỘC)
- **Feature & Dual-Shell MCP Parity:** Khi thêm/sửa bất kỳ logic nghiệp vụ nào (layer, shot, camera, audio, fx, rig, workflow, export...):
  1. Cập nhật handler trong `src/renderer/src/mcp/commands/` qua `useEditor.update()` (có Undo/Redo) + viết unit test `*.test.ts`.
  2. Khai báo tool trong `mcp-server/catalog/tools-*.mjs` với mô tả song ngữ `L(en, vi)` và `example` chuẩn; cập nhật `toolCount` trong `mcp-server/catalog/guide.json`.
  3. Đảm bảo `mcp-server/cliParams.mjs` sinh và parse đủ cả **PowerShell**, **CMD** và **Flags** (vượt qua test `mcp-server/catalog/catalog.test.mjs`).
  4. Chạy `pnpm mcp:schemas` để đồng bộ schema và cập nhật `mcp-server/README.md`.
  5. **Xuất video YUV trên GPU:** `export_video` hỗ trợ `pixel_format: auto | rgba | yuv420p` (kiểm tra bằng `node scripts/check-yuv-gpu.mjs`).
- **Đăng Ký Vùng Chụp MCP (`mcp-ui-region` — xem [SKILL.md](./.agents/skills/mcp-ui-region/SKILL.md)):** Mọi bề mặt UI mới/sửa bắt buộc:
  1. Gắn class ngữ nghĩa + `data-mcp-region="<snake_case>"` lên phần tử gốc (modal lồng thêm `data-mcp-dialog`).
  2. Đăng ký vào `UI_REGION_SELECTORS` trong [`src/renderer/src/mcp/uiRegions.ts`](./src/renderer/src/mcp/uiRegions.ts) và enum `region` của `get_app_screenshot` trong [`mcp-server/catalog/tools-scene.mjs`](./mcp-server/catalog/tools-scene.mjs).
  3. Chạy `pnpm mcp:schemas` và `pnpm test` (bài test [`uiRegions.test.ts`](./src/renderer/src/mcp/uiRegions.test.ts) sẽ FAIL nếu thiếu).
  4. Chụp kiểm tra trên cả Dark & Light theme bằng `get_app_screenshot(region: "active")` và sub-region vừa tạo.

### 2.5b. Một Logic Chung Timeline ⇄ Workflow V2 & Node Đơn Trách Nhiệm (BẮT BUỘC)
Chi tiết kiến trúc tại [docs/architecture/workflow-v2-and-timeline.md](./docs/architecture/workflow-v2-and-timeline.md):
- **Nguồn sự thật duy nhất:** Dữ liệu thật nằm trên Project/Layer; đồ thị Workflow V2 được suy ra bằng `syncWorkflowV2Graph` (`workflowV2Sync.ts`) và Timeline ghi qua `patchDerived`. Thêm/sửa/xoá logic ở bất kỳ đâu đều đi qua `attachLogicNodeToLayerV2` (`WORKFLOW_V2_LOGIC_PRESETS` `v2:<nhóm>:<tuỳ chọn>`) và `detachWorkflowV2NodeFromProject`.
- **Nguyên tắc Node Đơn Trách Nhiệm (Single-Responsibility Node):** Mỗi Node chỉ sở hữu 1 miền logic duy nhất (`loop_anim` cho chu kỳ lặp; `fx` cho Fade/Pulse/Shake/Glow; `action` cho quỹ đạo Motion; `anim_fx` cho hành động xương 2.5D; `time` cho nhóm thời gian chung `workflowTimeGroups.ts` / MCP `time_group`). Tuyệt đối không gộp logic của Node khác vào chung một Node; phối hợp nhiều hiệu ứng bằng cách nối nhiều Node vào cùng `Node Layer 2.5D`. Tài nguyên có cơ chế riêng khi thêm vào cảnh tự động sinh Node mặc định nối sẵn.
- **Modular JSON:** Xuất/nhập tách biệt `main.json` (`buildMainWorkflowJson`) và từng cảnh `shots/shot-N.json` (`buildShotWorkflowJson` / `applyShotWorkflowJson`).

### 2.6. Quy Chuẩn Custom UI Controls, Chống Combobox Trên Canvas & Dock Gọn Gàng (BẮT BUỘC)
- **Tuyệt đối CẤM dùng thẻ native `<select>` hay `<input type="color">`:** Bắt buộc dùng bộ điều khiển 60fps trong `src/renderer/src/ui/controls/`: `<Menu>` (menu thao tác), `<Select>` (`CustomSelect.tsx`, portal `z-index: 50000`, hỗ trợ `size="sm"`), `<ColorPickerCustom>`. Thanh công cụ chứa menu con phải giữ `overflow: visible; position: relative; z-index: 5000;`.
- **Cấm dùng Combobox trên Canvas có Zoom/Drag hoặc tập chọn nhỏ (`<= 5` mục):** Trên thẻ Node kéo thả / có CSS `zoom` (như Workflow Canvas) hoặc bảng có `2–5` lựa chọn, **CẤM dùng `<Select>`** (do lệch toạ độ dưới `zoom` và xung đột `pointerdown`); bắt buộc dùng **1-Click Segmented Pills**, **Option Cards** hoặc **Icon Chip Grid**.
- **Dock Inspector gọn gàng & Kéo thả 4 hướng:** Các cột cấu hình trong dock thấp (`height: 240px–350px`) phải chia thành **Segmented Sub-Tabs** thay vì xếp chồng dài; cụm HUD trên canvas dùng dạng dọc chỉ gồm Icon (`.wf-canvas-hud.vertical`); node kéo tự do 4 hướng (`Left/Right/Top/Bottom`); chiều cao thanh kéo `.splitter` lưu vào `localStorage` (`pxs:timeline-dock-height`).

### 2.7. Quy Chuẩn Tính Duy Nhất Của Biểu Tượng (Icon Uniqueness Standard - BẮT BUỘC)
- Trong cùng một dải tab ngang hoặc dọc, mỗi mục bắt buộc có icon SVG riêng biệt, đúng ngữ nghĩa; cấm dùng trùng lặp icon:
  - Nhân vật nam: `IconUserMale` | Nhân vật nữ: `IconUserFemale` | Chung: `IconUser`.
  - Tổng quan 3D: `IconGrid3D` | Đạo cụ 3D: `IconCube` | Nội thất phòng: `IconArmchair` | Nhà cửa: `IconHome` | Đô thị: `IconCity` | Đạo cụ 2D: `IconPropLamp`.
- Khi thiếu icon phù hợp, bắt buộc tạo mới trong [`src/renderer/src/ui/icons.tsx`](./src/renderer/src/ui/icons.tsx) và ánh xạ tại [`src/renderer/src/ui/assets/categoryIcons.tsx`](./src/renderer/src/ui/assets/categoryIcons.tsx).

### 2.8. Điều Phối Manifest Tài Nguyên Động & Kho Tạm Khôi Phục (`manifest-assets` - BẮT BUỘC)
Chi tiết tại skill [manifest-assets](./.agents/skills/manifest-assets/SKILL.md):
- [`./assets/manifest.json`](./assets/manifest.json) (v2.0) điều phối 5 phân hệ trong `./assets/manifests/*.json` (`builtin.json`, `layer-25d.json`, `loop-animator.json`, `model-3d.json`, `audio.json`).
- Hỗ trợ chuỗi fallback icon: `iconUrl` (`./assets/icons/`) → `icon` (SVG) → `iconText` → `IconBrokenIconFallback` (`data-icon-fallback="broken"`).
- Xoá tạm chuyển file vào `./assets/_temp_deleted/` (`status: "deleted"`), khôi phục qua `#manifest-assets-btn` hoặc MCP `restore_deleted_asset`; dọn vĩnh viễn qua `pnpm assets:prune` (`./assets/prune-manifest.bat`) hoặc MCP `prune_assets_manifest`.

### 2.9. Chế Độ Làm Việc Tự Động (Autonomous Mode) & Đường Dẫn Tương Đối (BẮT BUỘC)
- **Tự chủ tối đa:** Hạn chế dừng hỏi; nếu yêu cầu mơ hồ, tự chọn phương án chuẩn nhất và ghi rõ vào mục **"Giả định"** cuối báo cáo. Tự đọc log và sửa lỗi tối đa 3 lần. Cấm chạy lệnh phá huỷ (`rm -rf` ngoài dự án, `git push --force`, `git reset --hard`, `curl | sh`, sửa `.env`). Làm xong toàn bộ mới báo cáo một lần súc tích.
- **Đường dẫn tương đối (Relative Path Standard):** Mọi liên kết trong tài liệu kho mã nguồn (`README.md`, `AGENTS.md`, `docs/**/*.md`...) **BẮT BUỘC** dùng đường dẫn tương đối (`./src/...`, `../../scripts/...`); tuyệt đối không hardcode đường dẫn tuyệt đối OS (`C:\Users\...` hay `file:///`).

---

## 3. Cấu Trúc Workspace & Chỉ Mục Tài Liệu Kiến Trúc (`docs/`)

Khi làm việc sâu với từng phân hệ, AI **chủ động đọc tài liệu kiến trúc chuyên biệt** dưới đây bằng công cụ đọc file:

- **Gizmo 3D & Xưởng Lắp Ráp Mô Hình 3D (`models3d/`):** [docs/architecture/gizmo-and-assembly-3d.md](./docs/architecture/gizmo-and-assembly-3d.md) & [docs/image-mesh-templates.md](./docs/image-mesh-templates.md)
- **Xưởng Lắp Ráp Layer 2.5D, Hệ Thống Xương Blender, Uốn Mềm & Atlas Nhân Vật:** [docs/architecture/layer-assembly-and-rigging.md](./docs/architecture/layer-assembly-and-rigging.md), [docs/layer-workshop-tools.md](./docs/layer-workshop-tools.md) & [docs/design/character-cutout-prompt.md](./docs/design/character-cutout-prompt.md)
- **Đồng Bộ Timeline ⇄ Workflow V2, Nhóm Time Chung, Chuỗi Motion BBox, Va Chạm & Bộ Phận 2.5D:** [docs/architecture/workflow-v2-and-timeline.md](./docs/architecture/workflow-v2-and-timeline.md), [docs/workflow-node-semantics.md](./docs/workflow-node-semantics.md), [docs/motion-controls.md](./docs/motion-controls.md) & [docs/timing-workflow.md](./docs/timing-workflow.md)
- **Danh mục 146 MCP Tools & CLI `pnpm pxs`:** [mcp-server/README.md](./mcp-server/README.md)

---

## 4. Danh Mục Skills Trọng Tâm (`.agents/skills/`)

Kích hoạt và đọc `SKILL.md` tương ứng khi thực hiện tác vụ chuyên biệt:
- **Quét & Định vị giao diện tức thì (`Win + Alt` / `Win + Ctrl`):** `ai-ui-inspector` ([SKILL.md](./.agents/skills/ai-ui-inspector/SKILL.md))
- **Đăng ký vùng chụp MCP cho UI mới/sửa:** `mcp-ui-region` ([SKILL.md](./.agents/skills/mcp-ui-region/SKILL.md))
- **Quản lý Manifest tài nguyên & khôi phục xoá tạm:** `manifest-assets` ([SKILL.md](./.agents/skills/manifest-assets/SKILL.md))
- **Quy trình Git theo Session & Commit tiếng Việt:** `ak:git` ([SKILL.md](./.agents/skills/ak-git/SKILL.md))
- **Đồ họa 3D, WebGL & Shaders:** `ak:threejs`, `ak:shader`
- **React 19, Frontend & Tối ưu hiệu năng:** `ak:frontend-development`, `ak:react-best-practices`, `code-modularization`
- **Thiết kế Giao diện, CSS Tokens & Audit UI/UX:** `ak:ui-styling`, `ak:frontend-design`, `ak:ui-ux-pro-max`
- **Kiểm thử, Debug, Sửa lỗi & Xử lý Media (FFmpeg):** `ak:test`, `ak:debug`, `ak:fix`, `ak:code-review`, `ak:media-processing`
