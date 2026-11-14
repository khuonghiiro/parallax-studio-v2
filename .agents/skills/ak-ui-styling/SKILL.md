---
name: ak:ui-styling
description: Style UIs in Parallax Studio V2 using Vanilla CSS Modules, Design Tokens (variables.css), Dual-Theme (Dark/Light) contrast rules, 60fps Custom Controls (<Menu>, <Select>, Segmented Pills), Unified Geometry, and 4-Breakpoint Responsive Card Grids.
user-invocable: true
when_to_use: "Invoke when writing or editing CSS, styling components, fixing Dark/Light theme contrast, replacing native selects, or aligning control geometry in Parallax Studio V2."
category: frontend
keywords: [css, tokens, variables.css, dark-mode, light-mode, custom-controls, responsive, parallax-studio]
license: MIT
argument-hint: "[component or stylesheet]"
metadata:
  author: parallax-studio
  version: "2.0.0"
---

# UI Styling Skill (Parallax Studio V2 Standard)

Chuyên trách viết và chỉnh sửa CSS, Design Tokens, độ tương phản 2 Theme (Dark & Light), bộ điều khiển 60fps và lưới Responsive đa thiết bị trong **Parallax Studio V2**.

> **Phân định vai trò giữa 3 Skill UI/UX trong dự án:**
> - **`ak:ui-styling` (Skill này):** Thực thi code CSS/JSX trực tiếp theo chuẩn `variables.css`, tương phản Dark/Light, Custom Controls (`<Menu>`, `<Select>`, Segmented Pills), đồng bộ bo góc và chống cắt chữ.
> - **`ak:frontend-design`:** Định hướng bố cục thị giác (art direction), phân cấp thông tin khi thiết kế màn hình/xưởng mới.
> - **`ak:ui-ux-pro-max`:** Kiểm toán (audit) UI/UX, công thái học vùng bấm và kiểm tra tương thích đa thiết bị.

---

## 1. Quy Tắc Cốt Lõi (BẮT BUỘC)

1. **TUYỆT ĐỐI KHÔNG dùng Tailwind CSS hay shadcn/ui:** Dự án sử dụng **Vanilla CSS module hóa** trong `src/renderer/src/styles/*.css` kết hợp biến CSS tại [`src/renderer/src/styles/variables.css`](../../../src/renderer/src/styles/variables.css). Không chèn class utility kiểu `flex items-center p-4 bg-slate-900` vào JSX.
2. **TUYỆT ĐỐI KHÔNG sửa bằng inline style (`style={{...}}`)** để lách việc thiếu rule CSS (đặc biệt trong luồng AI UI Code Handoff `Win + Ctrl`). Chỉ dùng inline style cho toạ độ động tính theo frame/con trỏ (`left`, `top`, `transform`).
3. **Giới hạn độ dài file CSS:** Tối đa **≤ 1000 dòng** (chủ động tách file con `@import` khi đạt 500–600 dòng).

---

## 2. Hệ Thống Design Tokens (`variables.css`) & Chuẩn 2 Theme (Dark / Light)

Ứng dụng luôn chạy song song trên `[data-theme='dark']` và `[data-theme='light']`:

- **Mặt phẳng & Nền:** `var(--bg-0)` (nền sâu nhất), `var(--bg-1)` (panel), `var(--bg-2)` (card/input), `var(--bg-3)` (button/chip), `var(--bg-4)` (hover/elevated).
- **Văn bản:** `var(--text)` (chính), `var(--text-dim)` (phụ), `var(--text-faint)` (mờ/placeholder).
- **Đường viền:** `var(--line)`, `var(--line-soft)`, `var(--line-focus)`.
- **Màu nhấn:** `var(--accent)` (Royal Blue), `var(--accent-cyan)` (Electric Cyan), `var(--key)` (Gold).

### Quy tắc tương phản khi `:hover` / `.active` / `.selected` (BẮT BUỘC)
- **Cấm hardcode** `#ffffff`, `#000000`, `#141414` cho `color`, `background`, `fill` mà không có ngữ cảnh nền đậm cố định.
- **Cấm dùng `color: var(--bg-0)` trên nền `--accent` hoặc `--key`:** Trong Light Theme, `--bg-0` là xám sáng (`#f5f6f8`) khiến chữ trên nền vàng `--key` bị mù màu. Bắt buộc dùng:
  - `color: var(--on-accent)` (`#ffffff`) trên nền `var(--accent)`
  - `color: var(--on-key)` (`#0f172a`) trên nền `var(--key)`
- **Cấm đặt chữ `#ffffff` trực tiếp lên nền màu nhấn động sáng (`--logic-accent`, `--badge-accent`, `--item-c` như vàng cam `#f59e0b` hoặc cyan `#38bdf8`):** Bắt buộc làm đậm nền trước:
  ```css
  background: color-mix(in srgb, var(--logic-accent, var(--accent)) 78%, #0f172a);
  color: #ffffff;
  ```
- **Nút `.btn.ghost` / `.tl-action-btn`:** Phải có viền nhẹ `border-color: var(--line-soft)` và nền `:hover` pha `color-mix(in srgb, var(--accent) 10%, var(--bg-3))` để nhận diện rõ ở cả 2 theme.

---

## 3. Đồng Bộ Bo Góc, Typography & Chống Cắt Khuất (Unified Geometry & Anti-Clipping)

- **Bo góc chữ nhật thống nhất:** Mọi button, chip, segmented control, badge đếm số (`.tab-count`, `.asset-subtab-badge`, `.tl-mode-tab-badge`), mốc lộ trình trong cùng cụm bắt buộc dùng `var(--radius-sm)` (`4px`), `var(--radius)` (`5px`) hoặc `var(--radius-md)` (`6px`). **Cấm trộn lẫn** nút vuông (`0–2px`), nút bo góc (`4–6px`) và viên thuốc tròn (`999px`) cạnh nhau.
- **Typography an toàn:**
  - Badges / Pills / Tags: `10–11px` (`line-height: 1.2–1.3`)
  - Labels phụ / Subtext: `11–12px`
  - Controls / Inputs / Buttons / Body: `12–14px` (`line-height: 1.4–1.5`)
  - Tiêu đề mục / Thẻ: `14–16px` (`font-weight: 600`)
  - Tiêu đề hộp thoại: `16–18px` (tối đa `20px`)
  - **TUYỆT ĐỐI CẤM `font-size > 20px`** cho controls/cards.
- **Chống khuất nút bên phải thanh công cụ ngang:**
  - Cụm giữa đặt `flex: 1 1 auto; min-width: 0; overflow: hidden;`
  - Cụm CTA bên phải (`.deploy-ops`, `⚡ Áp dụng`) đặt `flex-shrink: 0; margin-left: auto;`
- **Chống cắt popup menu trên Toolbar:** Thanh công cụ chứa menu con phải giữ `overflow: visible; position: relative; z-index: 5000;` (không đặt `overflow-x: auto` trực tiếp lên toolbar vì CSS spec sẽ ép `overflow-y: auto` làm cắt cụt menu con).

---

## 4. Bộ Điều Khiển 60fps & Cấm Combobox Trên Canvas

- **Cấm dùng `<select>` native và `<input type="color">`:** Bắt buộc dùng:
  - `<Menu>` (`src/renderer/src/ui/controls/Menu.tsx`) cho menu thao tác.
  - `<Select>` (`src/renderer/src/ui/controls/CustomSelect.tsx`, portal `z-index: 50000`, prop `size="sm"`) cho bảng thuộc tính.
  - `<ColorPickerCustom>` (`src/renderer/src/ui/controls/ColorPickerCustom.tsx`) cho bộ chọn màu.
- **Cấm dùng Combobox (`<Select>`) trên Canvas có CSS `zoom` / kéo thả hoặc tập lựa chọn nhỏ (`<= 5` mục):** Bắt buộc dùng **1-Click Segmented Pills** (`.wf-preset-pill`), **Option Cards** hoặc **Icon Chip Grid**.
- **Dock Inspector thấp (`240px–350px`):** Chia theo **Segmented Sub-Tabs** gọn gàng thay vì xếp chồng dài.

---

## 5. Responsive 4 Breakpoints & Chống "Sa Mạc Trống Trải"

Chi tiết tại [`.agents/rules/responsive-standard.md`](../../rules/responsive-standard.md):
- **4 Breakpoints:** Phone (`<= 768px`, 1 cột), Tablet (`769–1120px`, 2 cột), Laptop (`1121–1366px`, 2–3 cột), Desktop (`> 1366px`, 3–4 cột, `max-width: 1400px–1680px`).
- **Lưới Card đa cột:** Cấm để danh sách dòng đơn trải dài 100% trên màn hình rộng 1920px; bắt buộc dùng `display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 8px–10px;`.
- **Đăng ký vùng chụp MCP & AI Inspector:** Mọi bề mặt UI mới/sửa phải gắn class ngữ nghĩa + `data-mcp-region` (theo skill [`mcp-ui-region`](../mcp-ui-region/SKILL.md)) và thuộc tính `data-ai-surface` / `aria-label` (theo skill [`ai-ui-inspector`](../ai-ui-inspector/SKILL.md)), sau đó chụp kiểm tra trên cả Dark & Light theme.
