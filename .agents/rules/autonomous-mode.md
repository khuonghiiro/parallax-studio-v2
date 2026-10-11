# Chế Độ Làm Việc Tự Động & Quyền Tự Chủ (Autonomous Working Mode)

Quy định này áp dụng cho mọi tác vụ phát triển trong Parallax Studio V2. AI làm việc với tinh thần tự chủ tối đa, hạn chế dừng lại hỏi người dùng.

## 1. Không hỏi lại những điều có thể tự suy luận
- Nếu yêu cầu còn mơ hồ, tự phân tích ngữ cảnh mã nguồn, kiểm tra kiểm thử và chủ động chọn phương án hợp lý, tối ưu và phổ biến nhất rồi làm tiếp.
- Ghi các giả định đã dùng vào cuối báo cáo (mục "Giả định"), tuyệt đối không dừng giữa chừng để hỏi.
- Chỉ dừng hỏi khi thực sự thiếu thông tin bắt buộc mà không thể suy luận được từ codebase (ví dụ: API key, thông tin đăng nhập bí mật, quyết định định hướng kinh doanh).

## 2. Thực thi lệnh terminal an toàn & gộp lệnh
- Với các lệnh an toàn (đọc file, tìm kiếm, liệt kê, build, test, typecheck, lint, cài package npm trong dự án, chạy dev server/script nội bộ), luôn tự chủ chạy và gộp nhiều bước liên quan vào ít lệnh nhất có thể để giảm số lần xác nhận.
- **Tuyệt đối KHÔNG tự ý chạy các lệnh sau (phải dừng và xin phép người dùng):**
  - Xóa hàng loạt hoặc đệ quy (`rm -rf`, `del /s`, `Remove-Item -Recurse` trên thư mục ngoài dự án).
  - `git push --force`, `git reset --hard`, xóa branch hoặc làm mất commit history.
  - Lệnh tải script về rồi chạy ngay (`curl | sh`, `iwr | iex`).
  - Thao tác lên file/thư mục nằm ngoài workspace.
  - Thay đổi biến môi trường hệ thống, can thiệp Windows Registry, phân quyền OS.
  - Lệnh có đụng đến database production hoặc secrets bảo mật.

## 3. Chỉnh sửa file tự động & bảo vệ Secrets
- Tự động áp dụng triệt để các thay đổi code/styles trong workspace, không chờ duyệt từng file.
- Tuyệt đối không sửa hoặc làm lộ file `.env`, file chứa secrets, tokens, hoặc file cấu hình hệ thống.

## 4. Tự sửa lỗi (Self-Healing & Auto-Recovery)
- Khi gặp lỗi (build error, test failure, runtime error): tự đọc log, phân tích nguyên nhân gốc rễ, tự sửa và thử lại tối đa 3 lần trước khi báo người dùng.
- Tuyệt đối không hỏi kiểu "bạn có muốn tôi sửa lỗi không?", cứ chủ động sửa nếu nằm trong phạm vi nhiệm vụ.

## 5. Báo cáo hoàn tất xúc tích
- Làm xong toàn bộ rồi mới báo cáo một lần ngắn gọn gồm: đã làm gì, file nào đã đổi, giả định đã dùng (nếu có), việc nào cần người dùng quyết định tiếp theo.
