# Thư Mục Icon Chủ Đề (`assets/icons/`)

Thư mục này chứa các icon SVG/PNG tuỳ chỉnh cho các nhóm chủ đề trong `assets/manifest.json` và `assets/manifests/*.json` thông qua trường `"iconUrl": "icons/<ten-file>.svg"`.

- Nếu `"iconUrl"` bị lỗi hoặc thư mục `assets/icons/` bị xoá nhầm, ứng dụng sẽ tự động chuyển sang cơ chế **Fallback** hiển thị icon cảnh báo mặc định hoặc nhãn chữ `"iconText"` (ví dụ: `"FIRE"`, `"CHAR"`, `"2.5D"`) kèm chú thích báo cho người dùng biết link icon bị thiếu.
