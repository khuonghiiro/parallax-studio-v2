# Tiêu Chuẩn Thông Điệp Commit (Commit Message Standards)

## Định Dạng Chuẩn Tiếng Việt (Vietnamese Commit Format)
```
[loại] (phạm vi): mô tả chi tiết bằng tiếng Việt có dấu
```
*Ghi chú: Phạm vi `(scope)` có thể không bắt buộc nhưng khuyến nghị nên có để phân định module.*

## Bảng Phân Loại Hành Động (Action Types)
- `[sửa lỗi]` (hoặc `[sửa]`): Khắc phục lỗi, bug logic, CSS, crash (thay thế `fix`)
- `[tính năng]` (hoặc `[thêm]`): Bổ sung tính năng mới, công cụ mới, module mới (thay thế `feat`)
- `[chỉnh sửa]` (hoặc `[chỉnh]`): Điều chỉnh, cập nhật logic hoặc giao diện hiện có
- `[xoá]` (hoặc `[loại bỏ]`): Loại bỏ code rác, file thừa, logic hoặc tài nguyên cũ không dùng
- `[tái cấu trúc]`: Refactor mã nguồn, phân tách module vệ tinh, giữ nguyên hành vi (thay thế `refactor`)
- `[hiệu năng]` (hoặc `[tối ưu]`): Tối ưu tốc độ, FPS, bộ nhớ RAM, thuật toán (thay thế `perf`)
- `[dọn dẹp]` (hoặc `[bảo trì]`): Cấu hình dự án, dependencies, gitignore, dọn dẹp cache (thay thế `chore`)
- `[giao diện]`: Tinh chỉnh CSS, màu sắc, bố cục giao diện, theme (thay thế `style`)
- `[tài liệu]`: Cập nhật tài liệu, hướng dẫn, README, AGENTS.md (thay thế `docs`)
- `[kiểm thử]`: Bổ sung hoặc sửa unit tests, E2E tests (thay thế `test`)
- `[hợp nhất]`: Merge commit từ nhánh logic vào main

## Quy Tắc Bắt Buộc
- **Viết bằng tiếng Việt CÓ DẤU** rõ ràng, chuẩn xác.
- **Tập trung vào CÁI GÌ (WHAT) và TẠI SAO (WHY)**, không liệt kê lan man HOW.
- **Không có dấu chấm ở cuối tiêu đề**.

## TUYỆT ĐỐI KHÔNG Nhắc Tên AI Trong Commit
- ❌ "Generated with Claude"
- ❌ "Co-Authored-By: Claude" / "Gemini" / "Antigravity"
- ❌ Không emoji robot 🤖 hay watermark AI.

## Ví Dụ Đúng Chuẩn
- `[sửa lỗi] (layer): sửa lỗi vị trí @import trong photoStudio.css`
- `[tính năng] (photoStudio): thêm thanh công cụ rail Photoshop và popup chọn cọ vẽ`
- `[chỉnh sửa] (timeline): điều chỉnh thanh trượt mượt mà 60fps`
- `[xoá] (assets): loại bỏ các mô hình 3D rác không sử dụng`
- `[tái cấu trúc] (engine): tách module SceneRenderer khỏi viewer chính`
- `[hiệu năng] (viewer): tối ưu texture LRU pool và khử giật lag canvas`
- `[dọn dẹp]: cập nhật gitignore và cấu hình agent-guard`
- `[hợp nhất] nhánh 'sua/photo-studio-import' vào main`

## Ví Dụ Không Đúng Chuẩn
- ❌ `Updated files` (không đúng định dạng và không mô tả rõ)
- ❌ `fix(ui): sửa lỗi combobox` (tiền tố cũ, cần dùng `[sửa lỗi] (ui): ...`)
- ❌ `[sửa lỗi] sua loi combobox` (thiếu dấu tiếng Việt)
- ❌ `[sửa lỗi] (photo): sửa lỗi` (quá ngắn, không cụ thể)
