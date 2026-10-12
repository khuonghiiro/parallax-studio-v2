## Sửa prompt nhân vật cutout

- Nguyên nhân: prompt mẫu 13 lớp giữ bố cục 16:9 rồi bị nối thêm lưới 5×5; chân liền không có khớp gối; chỉ dẫn chung thiếu giới hạn giải phẫu và yêu cầu viền sạch.
- Thay đổi: sinh prompt nhân vật từ slot, bổ sung mẫu búp bê 15 lớp và giữ các mẫu cũ tương thích. Đồng bộ tài liệu, nêu rõ script atlas 16:9 cũ không dùng cho atlas vuông mới.
- Kiểm chứng: 19 tests template/MCP và 7 tests catalog đạt; typecheck đạt; schemas sinh và check trong workspace đạt. Ban đầu gọi catalog bằng node --test sai runner, đã chạy lại bằng Vitest thành công.
- Giới hạn: TCP 9877 ECONNREFUSED nên chưa visual QA; không tạo ảnh AI mới. Bộ schema Antigravity ngoài workspace thiếu/cũ, không sửa cấu hình ngoài phạm vi. Không thay đổi schema tool.
- Nhật ký ghi trực tiếp vì CLI ak chưa cài. AgentWiki publish skipped.
