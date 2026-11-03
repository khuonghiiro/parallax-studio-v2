# Thư Mục Tạm Lưu Tài Nguyên Đã Xoá (`assets/_temp_deleted/`)

Khi người dùng hoặc AI xoá tạm một tài nguyên từ giao diện ứng dụng hoặc qua MCP:
1. Tệp vật lý sẽ được di chuyển tự động từ `assets/<folder>/<file>` vào `assets/_temp_deleted/<folder>/<file>`.
2. Trong file `assets/manifest.json` và `assets/manifests/<module>.json`, trạng thái của mục đó được đổi sang `"status": "deleted"`.
3. Người dùng có thể **Khôi phục (Restore)** bất kỳ lúc nào trong hộp thoại **Quản lý Manifest Tài Nguyên** hoặc xoá vĩnh viễn.
4. Nếu bạn xoá thẳng tệp trong thư mục và chạy `assets/prune-manifest.bat` (hoặc `pnpm assets:prune`), hệ thống sẽ tự động dọn sạch các mục không còn tệp khỏi mọi file JSON.
