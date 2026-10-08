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
- **Bảo vệ Secrets & Quyền riêng tư:**
  - Tuyệt đối không commit file `.env`, tokens, API keys, private keys hay file dữ liệu nhạy cảm.
- **Git Commit & Push:**
  - Sử dụng chuẩn Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`, `chore:`).
  - Viết commit message bằng **tiếng Việt CÓ DẤU** đầy đủ, chuẩn xác để phân biệt rành mạch các từ tiếng Anh và tiếng Việt giao thoa (ví dụ: `fix(ui): thay thế combobox và color picker native bằng custom component 60fps, triệt tiêu độ trễ 2s`).
  - Không gắn watermark hoặc nhắc tên AI trong commit message.
  - Ngay khi sửa xong một lỗi hoặc hoàn thành nâng cấp một logic/chức năng, chủ động commit tiếng Việt có dấu và push code lên Git ngay lập tức.

### 2.3. Quy Chuẩn Đa Giao Diện (Dual-Theme Standard: Dark & Light)
- **Hỗ trợ 2 Theme song song:** Ứng dụng luôn vận hành trên 2 chế độ: Dark Theme (`[data-theme='dark']`) và Light Theme (`[data-theme='light']`).
- **Bắt buộc dùng Design Tokens:** Mọi thành phần UI khi viết mới hoặc sửa đổi CSS **BẮT BUỘC** sử dụng các biến CSS được định nghĩa tại `variables.css`:
  - Mặt phẳng & Nền: `var(--bg-0)`, `var(--bg-1)`, `var(--bg-2)`, `var(--bg-3)`, `var(--bg-4)`.
  - Văn bản: `var(--text)` (chính), `var(--text-dim)` (phụ), `var(--text-faint)` (mờ).
  - Đường viền: `var(--line)`, `var(--line-soft)`, `var(--line-focus)`.
  - Màu nhấn đặc trưng: `var(--accent)` (Royal Blue), `var(--accent-cyan)` (Electric Cyan), `var(--key)` (Gold).
- **Quy tắc tương phản:** Tuyệt đối không hardcode mã màu cố định như `#ffffff`, `#000000`, `#141414` vào thuộc tính `color`, `background` hay `fill` của SVG mà không có selector phân định theme. Khi bổ sung UI mới, phải kiểm tra độ tương phản rõ nét trên cả hai theme.

### 2.4. Giao Thức Điều Khiển AI Qua MCP & CLI Controller (`pnpm pxs`)
- **Máy chủ MCP nội bộ:** Ứng dụng cung cấp MCP Server tại `mcp-server/index.mjs` kết nối qua TCP `127.0.0.1:9877` với hơn 50 công cụ chuyên biệt để AI thao tác trực tiếp (xem chi tiết tại `mcp-server/README.md`).
- **Bộ điều khiển CLI (`pnpm pxs`):** AI Agent có thể tra cứu toàn diện và điều khiển trực tiếp qua terminal:
  - `pnpm pxs --help` / `pnpm pxs help <tool>`: Đọc toàn bộ catalog 50+ tools và quy ước tọa độ 2.5D.
  - `pnpm pxs status` / `pnpm pxs inspect`: Kiểm tra trạng thái và xuất JSON toàn bộ dự án hiện tại.
  - `pnpm pxs review --view camera --out <path>`: Chụp ảnh viewport thực tế để AI dùng `view_file` xem và đánh giá bố cục cảnh bằng mắt.
  - `pnpm pxs call <tool> '<json>'`: Thực thi thêm/sửa layer, shot, audio, keyframe theo thời gian thực (realtime) như người dùng thao tác.
- **Bảo toàn tài nguyên:** Khi hoàn tất tác vụ tự động hóa, AI client hoặc người dùng cần ngắt kết nối (`disconnectAll`) hoặc tạm dừng server để tránh duy trì socket chạy ngầm gây hao tốn CPU/RAM máy tính.

### 2.5. Nguyên Tắc Đồng Bộ Tính Năng & AI MCP Controller (Feature & MCP Parity Principle - Bắt Buộc)
- **Đồng bộ song hành 100%:** Khi bổ sung hoặc sửa đổi bất kỳ logic nghiệp vụ, tính năng xử lý nào trong ứng dụng (ví dụ: quản lý âm thanh đa luồng `audioTracks`, hiệu ứng FX, layer, camera, shot, render...):
  1. **Renderer Commands (`src/renderer/src/mcp/commands/`):** Bắt buộc tạo/cập nhật handler tương ứng nhận lệnh và mutate state qua `useEditor.update()` để hỗ trợ hoàn tác Undo/Redo (Ctrl+Z) và hiển thị realtime trên UI.
  2. **MCP Catalog (`mcp-server/catalog/tools-*.mjs`):** Khai báo tool một lần với Zod schema và mô tả **song ngữ** cạnh nhau (`doc: L(en, vi)`, tham số `d(en, vi)`); cập nhật `toolCount` trong `catalog/guide.json`. `mcp-server/index.mjs` tự đăng ký tool từ catalog.
  3. **CLI Controller (`mcp-server/cli.mjs`):** Tự sinh catalog `pnpm pxs` (danh mục, tham số, ví dụ `example`) từ cùng catalog — không khai báo tay.
  4. **Antigravity Tool Schemas (`~/.gemini/antigravity-ide/mcp/parallax-studio/*.json`):** Chạy `pnpm mcp:schemas` để sinh lại (kiểm tra bằng `--check`).
  5. **Tài liệu hướng dẫn:** Cập nhật ngay `mcp-server/README.md`, `README.md` và `AGENTS.md`; nếu đổi quy trình thì sửa `catalog/guide.json` (EN và VI cùng số dòng). Tuyệt đối không để xảy ra tình trạng ứng dụng có logic nhưng AI/MCP bị mù hoặc thiếu công cụ thao tác (như tình trạng thiếu logic âm thanh trước đây).
  6. **Unit Tests:** Luôn viết test kiểm thử cho MCP commands mới trong `src/renderer/src/mcp/commands/*.test.ts`; `mcp-server/catalog/catalog.test.mjs` bắt buộc EN/VI khớp cấu trúc.
- **Tài liệu AI song ngữ (mặc định tiếng Anh):** Công tắc trong `McpDialog` (`ui/mcp/McpAiGuideCard.tsx`) lưu `docsLang` vào `mcp.json` qua IPC `mcp:setDocsLang`; MCP server theo dõi file và đổi mô tả tool trực tiếp (`tools/list_changed`). Ưu tiên: `PARALLAX_MCP_LANG` > `docsLang` > `en`.

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
- **Mesh ảnh & Bám pixel:** `silhouette.ts` (marching squares trên padded alpha mask, khử răng cưa với Douglas-Peucker) → `contourMesh.ts` (cắt cell trực tiếp theo polygon silhouette, CCW watertight, không dư cell margin) → `alphaMeshBuilder.ts` (indexed, hàn đỉnh). Editor 2D dùng cùng nguồn qua `mesh2dCells.ts`. Tests: `contourMesh.test.ts`, `alphaMeshBuilder.test.ts`, `silhouette.test.ts`.
- **Vật liệu & Khử bóng loá:** Chuyển sang `MeshLambertMaterial` (thuần Lambertian diffuse reflection, triệt tiêu hoàn toàn hiện tượng bóng chói/loá nhựa trên mặt phẳng ngửa lên). Texture được "alpha bleed" và upload dạng `DataTexture` straight-alpha (`textureResolver.ts`).
- **Ánh sáng & Nắng đổ bóng:** `assemblyLighting.ts` & `assemblySceneLighting.ts` (hướng nắng mặt trời, đổ bóng râm dịu với Three.js `PCFShadowMap` và mặt phẳng bắt bóng `ShadowMaterial`, tự động cân chỉnh tông màu ấm/lạnh theo độ cao mặt trời / thời gian trong ngày).
- **Ghép hít 2 mặt (Two-point join):** `assemblyJoin.ts` (chọn điểm start/end hoặc góc biên cạnh, tự động co giãn cạnh ngắn theo cạnh dài nhất 'longest' để khít cạnh, triệt tiêu hoàn toàn khe hở).
- **Cắt giao nhau (Intersection Clipping):** `assemblyClip.ts` & `assemblyMeshCache.ts` (tự động phát hiện 2 mặt đâm xuyên nhau như tường nhô qua mái dốc và gắn Three.js local clipping planes `material.clippingPlanes` để ẩn pixel thừa).
- **Khuôn mẫu (mô-đun):** kiểu & helper hình học `assemblyTemplateKit.ts` (bắt buộc nhãn `en` cho AI, `anchor` cho bộ phận); danh mục tổng `assemblyTemplateData.ts`; khung nhà chỉ tường + mái `assemblyTemplatesShells.ts` (`shell-*`); bộ phận trang trí rời `assemblyTemplatesDecor.ts` (`decor`: cửa sổ, cửa, ống khói, cột, ban công, bồn hoa, chậu cây…; quy ước `WALL_ANCHOR`: mặt lưng z = 0, nhô về z < 0). `assemblyTemplates.ts` (replace giữ ảnh/id/mesh, append đặt cạnh mô hình). Thao tác mặt thuần: `assemblyFaceOps.ts`, hình học: `assemblyGeometry.ts`. Tests: `assemblyTools.test.ts`, `assemblyTemplatesModular.test.ts`.
- **Ghép mô hình đã lưu:** `assemblyCompose.ts` (`appendModel` cạnh/tại điểm, `appendModelOnFace` gắn lên mặt theo UV bằng ma trận mặt chủ; tự khớp tỉ lệ, sinh id mới, ánh xạ `clipBy`), UI `ModelComposePanel.tsx` trong `FaceInspector`, CSS `assemblyCompose.css`. Tests: `assemblyCompose.test.ts`.
- **Lịch sử & phím tắt:** `useAssemblyHistory.ts` (gộp 450 ms, 1 bước/gesture, `{discrete}` cho thao tác cấu trúc), `useAssemblyShortcuts.ts` (capture-phase, chặn shortcut app chính khi modal mở).
- **Theme:** scene 3D đọc token CSS qua `assemblyTheme.ts`; CSS xưởng chỉ dùng token (`--on-accent`, `--on-key`, `--on-cyan`, `--backdrop`, `--checker-a/b` bổ sung trong `variables.css`).
- **MCP Parity cho Xưởng 3D:** Đồng bộ 100% qua `assemblyBridge.ts` kết nối phiên modal trực tiếp với MCP commands (`src/renderer/src/mcp/commands/assemblyCommands.ts`): `list_models3d`, `get_model3d`, `get_assembly_state`, `list_assembly_templates`, `append_assembly_model`, `save_assembly_model`, `insert_assembly_model`, `add_assembly_face`, `update_assembly_face`, `delete_assembly_face`, `join_assembly_faces`, `auto_assembly_clip`, `set_assembly_lighting`, `apply_assembly_template`. Tests: `mcp/commands/assemblyCommands.test.ts`.

