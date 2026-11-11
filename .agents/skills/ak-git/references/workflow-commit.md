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
6. Commit xong logic hiện tại mới bắt đầu logic kế tiếp, kể cả nhiều logic trong cùng một prompt. Code/test/tài liệu cùng logic đi chung commit. Không push giữa các logic; khi hoàn tất toàn bộ prompt mới push một lần theo `workflow-push.md`.
7. Giữ nhánh theo `branch-management.md`: xác minh session; chat mới yêu cầu xử lý tiếp vẫn dùng nhánh cũ.
