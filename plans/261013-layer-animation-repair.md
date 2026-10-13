# Sửa Animate trong Xưởng Lắp Ráp Layer

Mục tiêu: sửa pipeline tạo dáng có sẵn, bổ sung timeline từng xương có kéo key và nội suy chỉnh được; UI/MCP dùng chung logic, giữ Undo/Redo và dữ liệu cũ. Không phụ thuộc Moho hay thay đổi tài nguyên đang làm của người dùng.

## Bằng chứng

- Timeline hiện làm tròn thời gian về 2 chữ số, gộp mọi xương vào một hàng, không kéo key được.
- MCP set-key/set-pose đặt thuộc tính bỏ trống về 0/1; set-pose bỏ qua ID sai.
- Ghi pose ở cuối clip dùng lấy mẫu lặp, trả về đầu clip.
- Kéo khớp trong Pose Mode bỏ qua pose ban đầu và phép xoay của cha; Escape chỉ dừng, không khôi phục.

## Thực hiện

- [ ] Test hồi quy cho partial pose, endpoint, batch atomic, retime và nội suy.
- [ ] Logic animation chung; MCP time/frame, batch, move-key, set-interpolation, Bezier.
- [ ] Timeline từng xương bên dưới viewport; chọn/kéo/sửa/xóa key và hủy an toàn.
- [ ] Sửa gesture tạo dáng và đồng bộ preview khi dừng ở cuối clip.
- [ ] Catalog song ngữ, vùng crop, tài liệu, schemas.
- [ ] Test/typecheck, review, QA trên app thật cả hai theme, commit/push.

Tiêu chí đạt: partial update giữ nguyên kênh khác; batch lỗi không đổi trạng thái; một Undo cho một thao tác; kéo key không làm mất key đích; Escape giữ bản gốc; UI/preview/MCP thống nhất.
