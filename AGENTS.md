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
