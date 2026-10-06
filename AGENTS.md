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
- **Git Commit:**
  - Sử dụng chuẩn Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`, `chore:`).
  - Không gắn watermark hoặc nhắc tên AI trong commit message.

### 2.3. Quy Chuẩn Đa Giao Diện (Dual-Theme Standard: Dark & Light)
- **Hỗ trợ 2 Theme song song:** Ứng dụng luôn vận hành trên 2 chế độ: Dark Theme (`[data-theme='dark']`) và Light Theme (`[data-theme='light']`).
- **Bắt buộc dùng Design Tokens:** Mọi thành phần UI khi viết mới hoặc sửa đổi CSS **BẮT BUỘC** sử dụng các biến CSS được định nghĩa tại `variables.css`:
  - Mặt phẳng & Nền: `var(--bg-0)`, `var(--bg-1)`, `var(--bg-2)`, `var(--bg-3)`, `var(--bg-4)`.
  - Văn bản: `var(--text)` (chính), `var(--text-dim)` (phụ), `var(--text-faint)` (mờ).
  - Đường viền: `var(--line)`, `var(--line-soft)`, `var(--line-focus)`.
  - Màu nhấn đặc trưng: `var(--accent)` (Royal Blue), `var(--accent-cyan)` (Electric Cyan), `var(--key)` (Gold).
- **Quy tắc tương phản:** Tuyệt đối không hardcode mã màu cố định như `#ffffff`, `#000000`, `#141414` vào thuộc tính `color`, `background` hay `fill` của SVG mà không có selector phân định theme. Khi bổ sung UI mới, phải kiểm tra độ tương phản rõ nét trên cả hai theme.

### 2.4. Giao Thức Điều Khiển AI Qua MCP & CLI Controller (`pnpm pxs`)
- **Máy chủ MCP nội bộ:** Ứng dụng cung cấp MCP Server tại `mcp-server/index.mjs` kết nối qua TCP `127.0.0.1:9877` với 42 công cụ chuyên biệt để AI thao tác trực tiếp (xem chi tiết tại `mcp-server/README.md`).
- **Bộ điều khiển CLI (`pnpm pxs`):** AI Agent có thể tra cứu toàn diện và điều khiển trực tiếp qua terminal:
  - `pnpm pxs --help` / `pnpm pxs help <tool>`: Đọc toàn bộ catalog 42 tools và quy ước tọa độ 2.5D.
  - `pnpm pxs status` / `pnpm pxs inspect`: Kiểm tra trạng thái và xuất JSON toàn bộ dự án hiện tại.
  - `pnpm pxs review --view camera --out <path>`: Chụp ảnh viewport thực tế để AI dùng `view_file` xem và đánh giá bố cục cảnh bằng mắt.
  - `pnpm pxs call <tool> '<json>'`: Thực thi thêm/sửa layer, shot, keyframe theo thời gian thực (realtime) như người dùng thao tác.
- **Bảo toàn tài nguyên:** Khi hoàn tất tác vụ tự động hóa, AI client hoặc người dùng cần ngắt kết nối (`disconnectAll`) hoặc tạm dừng server để tránh duy trì socket chạy ngầm gây hao tốn CPU/RAM máy tính.

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
