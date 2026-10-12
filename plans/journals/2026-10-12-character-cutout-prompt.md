## Sửa prompt nhân vật cutout

- Nguyên nhân: prompt mẫu 13 lớp giữ bố cục 16:9 rồi bị nối thêm lưới 5×5; chân liền không có khớp gối; chỉ dẫn chung thiếu giới hạn giải phẫu và yêu cầu viền sạch.
- Thay đổi: sinh prompt nhân vật từ slot, bổ sung mẫu búp bê 15 lớp và giữ các mẫu cũ tương thích. Đồng bộ tài liệu, nêu rõ script atlas 16:9 cũ không dùng cho atlas vuông mới.
- Kiểm chứng: 19 tests template/MCP và 7 tests catalog đạt; typecheck đạt; schemas sinh và check trong workspace đạt. Ban đầu gọi catalog bằng node --test sai runner, đã chạy lại bằng Vitest thành công.
- Giới hạn: TCP 9877 ECONNREFUSED nên chưa visual QA; không tạo ảnh AI mới. Bộ schema Antigravity ngoài workspace thiếu/cũ, không sửa cấu hình ngoài phạm vi. Không thay đổi schema tool.
- Nhật ký ghi trực tiếp vì CLI ak chưa cài. AgentWiki publish skipped.

## Kiểm thử atlas trực tiếp qua MCP

- Đổi prompt nhân vật sang tỉ lệ 1:1 và metadata model-native, bỏ yêu cầu pixel cố định. Native resolution do model quyết định.
- Dùng công cụ imagegen tích hợp tạo 2 lượt và chỉnh 1 lượt. Lỗi quan sát được: tay áo dính thân, chi nghiêng, chốt da kiểu búp bê. Đã cập nhật prompt và ảnh sửa.
- Thêm bộ tách atlas 5×5 theo kích thước thực tế, vùng liên thông và chroma-key. Thu được 15 PNG, phục hồi nguyên vẹn 3 mảnh lấn biên ô, đối chiếu trên nền sáng/tối.
- Gắn đủ 15 ảnh/15 xương qua MCP; căn scale, overlap eo/gối/cổ chân, lật giày trái. Quan sát 2 pha walk trong app 2D/3D, lưu mẫu Búp bê AI — Kiểm thử atlas theo tỉ lệ. Media và bản composite sao lưu trong artifacts/puppet-test (không commit).
- 19 tests Vitest, 3 tests Python và TypeScript đạt. Không thay đổi project đang dựng; thao tác trong bản nháp xưởng và thư viện mẫu mới. Mỗi kết nối MCP tự đóng sau response.
- Giới hạn: AI vẫn cần sửa ảnh và cân tỉ lệ; kiểm tra hai pha bước đi không bảo đảm mọi pose đều kín khớp.
