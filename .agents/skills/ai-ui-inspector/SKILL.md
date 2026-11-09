---
name: ai-ui-inspector
description: Make every new or edited UI in Parallax Studio precisely scannable by the AI UI Inspector (Win + Shift + drag) so pasted reports point AI straight to file:line without grepping — data-ai-src source locator, data-ai-surface / data-mcp-dialog for dialogs and popups, data-ai-id / role / aria-label for controls, surface & overlay registries, and how to consume an AI-UI report. Use whenever creating or modifying UI, dialogs, popups, menus or overlays, and whenever the user pastes an "AI UI INSPECTOR" report.
---

# AI UI Inspector — viết UI để AI quét chính xác & sửa nhanh

Người dùng giữ **Win + Shift** (hoặc nút `#ai-ui-inspector-btn` trên toolbar), kéo khung quanh vùng lỗi → app copy báo cáo
Markdown `### 🎯 NGỮ CẢNH GIAO DIỆN (AI UI INSPECTOR)` vào Clipboard → dán cho AI. Mục tiêu: AI **mở thẳng `file:dòng`**,
không đọc dò luồng xử lý tốn token. Quy chuẩn gốc: [`AGENTS.md` mục 2.4b](../../../AGENTS.md).

## A. Khi người dùng dán báo cáo AI-UI (cách đọc nhanh, tiết kiệm token)

1. Đọc bảng **⚡ Mở ngay (Jump-to-code)** trước: cột `JSX render` là dòng **chính xác** đã vẽ phần tử (thuộc tính
   `data-ai-src` do Babel plugin dev chèn). Mở bằng `read_file` với `StartLine/EndLine` quanh dòng đó (±30 dòng).
2. `Component / Call-site` = component nghiệp vụ sở hữu control (đã vượt qua primitive `ui/controls/*`). Sửa logic ở đây.
3. Cột `CSS` = file + dòng định nghĩa class → sửa giao diện tại đó (giữ quy chuẩn Dual-Theme).
4. `🪟 Bề mặt` cho biết phần tử nằm trong Dialog / Popup nào (chuỗi lồng nhau + file JSX gốc của dialog).
5. Chỉ khi cột JSX là `≈` (ước lượng từ React Fiber, app chạy bản build) mới cần grep theo `DOM path` / class.
6. Không cần đọc lại toàn bộ file 500+ dòng; không grep tên component nếu đã có `file:dòng`.

## B. Checklist bắt buộc khi tạo / sửa UI

### 1. Không tự viết `data-ai-src` — để Babel plugin lo

- [`scripts/vite/aiSourceLocatorBabel.mjs`](../../../scripts/vite/aiSourceLocatorBabel.mjs) gắn `data-ai-src="src/renderer/src/...tsx:dòng:cột"`
  vào mọi JSX (host element → DOM attr; component → `fiber.memoizedProps`) **chỉ khi `pnpm dev`**, không vào bản build.
- Component primitive nhận `...rest` và trải xuống DOM là OK (thẻ host tự gắn sau `...rest` nên vẫn giữ dòng của chính nó).
- Không lọc / xoá prop `data-*` trong component dùng chung; không đổi tên file mà quên cập nhật import (đường dẫn sẽ sai).
- Tắt tạm khi cần đo hiệu năng: `PXS_AI_SRC=0 pnpm dev`.

### 2. Mọi Dialog / Modal / Popup / Menu phải nhận diện được là "bề mặt"

Gắn trên **phần tử gốc thực sự hiển thị** (không phải backdrop toàn màn hình):

```tsx
// Dialog / modal (kể cả modal lồng trong xưởng)
<div className="lw-clip-json-modal" role="dialog" aria-modal="true"
     data-mcp-region="layer_assembly_clip_json" data-mcp-dialog
     data-ai-surface="dialog" data-ai-surface-label="JSON hành động 2.5D">…</div>

// Popup / menu / dropdown / flyout / popover
<div className="tl-logic-picker" role="menu" data-ai-surface="popup" data-ai-surface-label="Chọn logic Timeline">…</div>
```

- `data-ai-surface="dialog|popup"` + `data-ai-surface-label` là cách **tổng quát** — scanner tự nhận, không cần sửa code inspector.
- Nếu không gắn được, thêm class vào `POPUP_CONTAINER_SELECTORS` / `NESTED_MODAL_SELECTORS` trong
  [`aiUiInspectorSurfaces.ts`](../../../src/renderer/src/ui/inspector/aiUiInspectorSurfaces.ts).
- Popup render qua portal (`document.body`) vẫn phải có các thuộc tính trên ở gốc portal.

### 3. Control phải "đọc được tên"

- Nút chỉ có icon: bắt buộc `title` **và** `aria-label` tiếng Việt mô tả hành động (`aria-label="Xuất JSON hành động"`).
- Phần tử bấm được không phải `<button>` (card, chip, row kéo thả): `role="button"` hoặc `data-ai-id="<ten-ngu-nghia>"`.
- Thực thể nghiệp vụ: `data-layer-id`, `data-bone-id`, `data-scene-layer-id`, `data-waypoint-node-id` để báo cáo kèm dữ liệu thật.
- Class đầu tiên của phần tử là class ngữ nghĩa (ví dụ `lw-json-export-btn`), class trạng thái (`active`, `is-*`, `open`) đặt sau.
- Không lồng `data-mcp-region` vào phần tử 0px/ẩn.

### 4. Overlay / lớp phủ mới

- Lớp phủ toàn màn hình mới (HUD, safety barrier, neon frame…) phải thêm selector vào `INSPECTOR_OVERLAY_SELECTOR`
  (`aiUiInspectorSurfaces.ts`) để hit-test xuyên qua, nếu không phần tử bên dưới bị coi là "bị che khuất".
- Toàn bộ lớp hiệu ứng của inspector dùng `pointer-events: none`.

### 5. Kiểm thử

```powershell
pnpm verify
pnpm test -- src/renderer/src/ui/inspector scripts/vite
pnpm pxs call ping '{}'
```

App đang mở → giữ Win + Shift, kéo khung quanh UI vừa làm, `Ctrl+V` báo cáo vào chat: bảng **Mở ngay** phải có
`JSX render` đúng file:dòng, `🪟 Bề mặt` đúng dialog/popup, nhãn hiển thị tên dễ hiểu (không phải `<div>`).
Chụp vùng hiệu ứng: `get_app_screenshot({ region: "ai_inspector_scan_fx" })`, toast: `ai_inspector_toast`.

## C. Kiến trúc

| Module | Vai trò |
| --- | --- |
| [`AiUiInspectorOverlay.tsx`](../../../src/renderer/src/ui/AiUiInspectorOverlay.tsx) | Điều phối: chụp snapshot, copy Clipboard, hiển thị HUD/hiệu ứng/toast/xem trước |
| [`useAiInspectorCapture.ts`](../../../src/renderer/src/ui/inspector/useAiInspectorCapture.ts) | Sự kiện Win+Shift / kéo khung / Esc (pha capture) |
| [`aiUiInspectorElementFinder.ts`](../../../src/renderer/src/ui/inspector/aiUiInspectorElementFinder.ts) | Tìm phần tử: phạm vi popup → modal → dialog, lấy mẫu lưới hit-test, loại phần tử bị che |
| [`aiUiInspectorSurfaces.ts`](../../../src/renderer/src/ui/inspector/aiUiInspectorSurfaces.ts) | Nhận diện Dialog/Popup, hit-test xuyên lớp phủ |
| [`aiUiInspectorElementContext.ts`](../../../src/renderer/src/ui/inspector/aiUiInspectorElementContext.ts) | Ngữ cảnh từng phần tử (Fiber, JSX, CSS, 2.5D, Workflow) |
| [`aiUiInspectorSourceLocator.ts`](../../../src/renderer/src/ui/inspector/aiUiInspectorSourceLocator.ts) | `data-ai-src`, CSS từ `<style data-vite-dev-id>`, DOM path |
| [`aiUiInspectorMarkdown.ts`](../../../src/renderer/src/ui/inspector/aiUiInspectorMarkdown.ts) + `…Sections.ts` | Báo cáo gửi AI (bảng Mở ngay đứng đầu) |
| [`aiUiCalloutLayout.ts`](../../../src/renderer/src/ui/inspector/aiUiCalloutLayout.ts) + `AiUiScanCallouts.tsx` | Nhãn xếp cột ngoài vùng quét + đường nét đứt vuông góc, không đè nhau |
