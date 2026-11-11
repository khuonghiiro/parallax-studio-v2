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


### AI UI Code Handoff — Win + Ctrl

- **Win + Ctrl** xuất gói sửa UI gọn: rule CSS khớp class vùng quét (kèm hover/active, theme/media tìm được), khoảng 21 dòng JSX/JS hai phía vị trí render/call-site, số dòng và hướng dẫn UI rút gọn. **Win + Shift** giữ báo cáo ngữ cảnh cũ.
- Không lần theo import JS/store/engine, không gửi toàn bộ file hoặc toàn bộ AGENTS/skill. Chỉ dò CSS @import để tìm rule gốc; CSS ngoài vùng không được đưa vào gói. Giới hạn 200.000 ký tự nguồn, 100 file (tối đa 70 CSS), 300.000 ký tự Markdown (ngân sách gói xuất, không phải giới hạn ngữ cảnh của model). Gói ghi rõ số đoạn bỏ qua; quét nhỏ hơn khi thiếu. Ước lượng token là ký tự/3, không phải bộ đếm tokenizer chính xác.
- AI trả JSON `{version:2,bundleId,files:[{path,baseHash,edits:[{id,content}]}]}`. `content` chỉ là toàn bộ ĐOẠN đã sửa, không có số dòng. Giữ ID đoạn; không trả cả file, không bọc lại điều kiện CSS được ghi là ngữ cảnh ngoài đoạn.
- Trong hộp thoại `ai_code_handoff`, dán/chọn JSON → **Kiểm tra bản sửa** → **Áp dụng bản sửa**. App ghép đoạn vào bản gốc, giữ nguyên phần ngoài đoạn, kiểm tra SHA-256 toàn file và cú pháp file sau ghép, lưu backup trước ghi. Bản gốc ở `ai-code-handoffs/backup-*` trong userData; phục hồi từ backup, không dùng Undo editor. Vẫn đọc được gói toàn file version 1 đã xuất trước đây, nhưng không cho dùng version 1 để ghi đè gói đoạn version 2.
- Chỉ dùng trên bản phát triển có repository; sửa main/preload cần người dùng mở lại app. Sau nhập chạy `pnpm verify`, test liên quan và QA Dark/Light. Không tự chạy lệnh shell hoặc commit bản nhập. JSX có thể cắt giữa hàm; phụ thuộc ngoài đoạn không được bao phủ.
- MCP: `export_ui_code` (left/top/width/height, show tùy chọn), `import_ui_code` (reply chuỗi JSON, apply mặc định false). Cú pháp xuất:
  - PowerShell: `pnpm pxs call export_ui_code '{"left":0,"top":0,"width":320,"height":150}'`
  - CMD: `pnpm pxs call export_ui_code "{\"left\":0,\"top\":0,\"width\":320,\"height\":150}"`
  - Flags cả hai shell: `pnpm pxs call export_ui_code --left 0 --top 0 --width 320 --height 150`

### Phân biệt chế độ quét

- `Win + Shift`: cyan, nhãn “Ngữ cảnh UI · Vị trí code”, báo cáo vị trí giao diện.
- `Win + Ctrl`: cam, tâm ngắm hình thoi, khung nét liền, nhãn “Gói sửa UI · CSS/JSX/JS”; xuất đoạn mã và quy tắc UI đã nhúng trong Markdown để gửi AI kể cả khi AI không truy cập repo. Chỉ trích quy tắc liên quan, không gửi toàn bộ skill/AGENTS.md.

Sau Win + Ctrl, giữ khung mục tiêu và nhãn file:dòng màu cam trên UI; gói mã được tạo/copy nền. Nút “Mở gói / Import” mở hộp thoại; đóng hộp thoại quay lại nhãn quét. MCP export_ui_code với show=true hiển thị cùng kết quả quét.
