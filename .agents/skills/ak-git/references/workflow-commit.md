# Commit Workflow

Thực hiện commit trực tiếp trên nhánh session hiện tại:

1. Kiểm tra trạng thái: `git status --short`, kiểm tra các file đã thay đổi thuộc phiên làm việc hiện tại.
2. Quét bảo mật: Đảm bảo không có secret, key, token, `.env`.
3. Stage các file đã thay đổi: `git add -- <paths>`, kiểm tra `git diff --cached --stat`.
4. Chạy các bước kiểm tra chất lượng (Quality Gates):
   - Chạy `pnpm verify` (esbuild + typecheck toàn bộ dự án).
   - Chạy unit tests liên quan (`pnpm test`).
   - Nếu app Electron đang chạy (`127.0.0.1:9877`), chụp ảnh toàn màn hình Visual QA (`pnpm pxs review --view app`) để đảm bảo không đen màn, không lỗi toast/banner.
5. Commit bằng định dạng tiếng Việt:
   `git commit -m "[loại] (phạm vi): mô tả chi tiết bằng tiếng Việt có dấu"`
   (Ví dụ: `git commit -m "[sửa lỗi] (layer): sửa lỗi vị trí @import trong photoStudio.css"`, `[tính năng] (photoStudio): thêm thanh công cụ rail Photoshop`).
6. Tiếp tục làm việc trên nhánh session này cho các yêu cầu tiếp theo trong session. TUYỆT ĐỐI KHÔNG tự động chuyển về `main` và merge sau mỗi logic đơn lẻ. Chỉ khi chuyển sang session mới (hoặc có yêu cầu từ user) mới hợp nhất nhánh vào `main` bằng `--no-ff`.
