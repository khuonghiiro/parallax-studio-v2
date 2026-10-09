# Công cụ Xưởng Lắp Ráp Layer

Thanh trên cùng dành cho tên cụm, bố cục 2D/3D, lưu mẫu và chèn vào cảnh. Thanh công cụ bên dưới thao tác trên **các lớp đã chọn**; khung dựng có kích thước riêng W/H và khổ ngang/dọc/vuông. Các nút +100/−100 thay nhanh kích thước. “Ước lượng khung” (`estimate-frame`) dùng giới hạn ảnh 380px, scale và góc Z của lớp đang hiện, kể cả lớp khóa; chưa tính chuyển động hoặc phối cảnh. Trạng thái dưới cùng hiển thị số lớp, vùng chọn và lớp khóa.

## Chọn và sắp xếp

- Ctrl/Shift + bấm để thêm/bỏ một lớp khỏi vùng chọn; chọn tất cả bằng Ctrl+A. Kéo một lớp đã chọn trong 2D để di chuyển cả nhóm không khóa.
- Tâm X/Y đưa tâm từng lớp về trục giữa khung. Đều X/Y chia đều tâm giữa hai lớp ngoài cùng; cần ít nhất ba lớp không khóa.
- Tách lớp / Đảo Z dùng bước từ 1–2000 px, theo thứ tự danh sách và đối xứng quanh Z=0. Z dương ở sau, Z âm ở trước. Cần ít nhất hai lớp không khóa.
- Nút tách Z trên đầu danh sách tác động toàn bộ cụm; thanh công cụ và bảng thuộc tính nhiều lớp chỉ tác động vùng chọn.
- Mũi tên lên/xuống chỉ đổi thứ tự danh sách, không tự đổi Z.
- Menu Thao tác có nhân bản, xóa, khóa/mở khóa, ẩn/hiện, gom Z=0, đặt lại biến đổi, so le pha và tắt chuyển động. Các lớp khóa được bỏ qua, trừ khóa/mở khóa.
- So le pha đặt độ lệch 0 / 0,35 / 0,7… giây cho chuyển động sẵn có. Nó không bật chuyển động cho lớp tĩnh.

## Lịch sử và xem trước

Ctrl+Z hoàn tác; Ctrl+Shift+Z hoặc Ctrl+Y làm lại; Ctrl+D nhân bản; Delete xóa. Một lần kéo hoặc một lệnh hàng loạt là một bước lịch sử. Lịch sử bản nháp giữ tối đa 100 bước và tách biệt lịch sử dự án; chèn vào cảnh vẫn dùng cơ chế Undo của editor.

Space bật/tắt xem chuyển động. Xưởng mở ở trạng thái dừng; lớp mới mặc định tĩnh. Khi nhập tên hoặc số, các phím nhập liệu giữ hành vi native. Escape bỏ vùng chọn trước khi đóng xưởng; trong gesture, viewport/gizmo xử lý hủy thao tác.

Lỗi lưu/chèn được hiển thị trong xưởng; thao tác chèn không tự thử lại để tránh tạo lớp trùng.

## MCP / CLI

1. `open_layer_assembly`, rồi `get_layer_assembly_state` để lấy ID các lớp.
2. `select_layer_assembly_layers {"layer_ids":["id-a","id-b"]}`.
3. `layer_assembly_action {"action":"depth-forward","spacing":120}`.
4. `layer_assembly_history {"action":"undo"}` hoặc `{"action":"redo"}`.

`layer_assembly_action` nhận tùy chọn `layer_ids`; bỏ qua dùng vùng chọn hiện tại, `[]` không đổi gì. Các lệnh chỉ áp dụng phiên xưởng đang mở, trả lỗi nếu ID không tồn tại. `get_layer_assembly_state` trả thêm `selectedLayerIds`, `canUndo`, `canRedo`.

English: UI and MCP share immutable batch actions and the same workshop draft history. Explicit selections, lock protection and atomic validation apply equally to both entry points. No scene mutation occurs until insertion.
