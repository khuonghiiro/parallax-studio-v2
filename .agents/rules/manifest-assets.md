# Quy Chuẩn Điều Phối Manifest Tài Nguyên Động & Kho Tạm Khôi Phục (`manifest-assets`)

1. **Kiến trúc Điều phối Modular (`./assets/manifest.json` + `./assets/manifests/*.json`):**
   - `./assets/manifest.json` là tệp điều phối trung tâm (`version: "2.0"`), định tuyến 5 phân hệ JSON độc lập trong `./assets/manifests/`:
     - `./assets/manifests/builtin.json`: Kho công cộng 2D (`characters`, `animals`, `nature`, `plants`, `architecture`, `interiors`, `props`, `weather`, `effects`).
     - `./assets/manifests/layer-25d.json`: Chủ đề Xưởng Lắp Ráp Layer 2.5D (`layer-assemblies/*`) + chủ đề cột trái (`sidebarTopics`).
     - `./assets/manifests/loop-animator.json`: Chủ đề Xưởng Tách Hoạt Ảnh Loop (`loop-animations/*`).
     - `./assets/manifests/model-3d.json`: Chủ đề Xưởng Mô Hình 3D (`models-3d/*`) + chủ đề cột trái (`sidebarTopics`).
     - `./assets/manifests/audio.json`: Chủ đề Kho Âm Thanh & Nhạc Nền (`audio/*`).
   - Khi cần thêm/sửa/ẩn chủ đề hoặc đổi tên/thư mục/icon của bất kỳ xưởng nào, chỉ cần sửa đúng file JSON phân hệ đó (hoặc dùng hộp thoại `#manifest-assets-btn` / MCP `update_assets_manifest`), tuyệt đối không hardcode danh sách nhóm cố định trong component React.

2. **Cơ chế Xoá Tạm (`./assets/_temp_deleted/`) & Dọn Sạch Vĩnh Viễn (`./assets/prune-manifest.bat`):**
   - Khi xoá tạm một tài nguyên, file vật lý được di chuyển vào `./assets/_temp_deleted/<relativePath>` và ghi `"status": "deleted"`, `"tempPath": "_temp_deleted/<relativePath>"` trong JSON để người dùng hoặc AI có thể khôi phục nguyên trạng qua `restore_deleted_asset`.
   - Khi xoá hẳn file vật lý trong thư mục rồi chạy `./assets/prune-manifest.bat` (hoặc `pnpm assets:prune` / MCP `prune_assets_manifest`), hệ thống tự động dò cả `./assets/` lẫn `./assets/_temp_deleted/` để loại bỏ các mục mồ côi khỏi `./assets/manifest.json` và `./assets/manifests/*.json`.

3. **Quy tắc Fallback Icon Chủ đề (`iconUrl` → `icon` → `iconText` → `IconBrokenIconFallback`):**
   - Mọi chủ đề trong JSON hỗ trợ `iconUrl` (link ảnh/SVG trong `./assets/icons/`), `icon` (mã SVG dựng sẵn), hoặc `iconText` (chữ viết tắt 1–3 ký tự dạng icon).
   - Nếu `iconUrl` được khai báo nhưng file hoặc thư mục `./assets/icons/` bị xoá nhầm, `renderCategoryIcon` trong `./src/renderer/src/ui/assets/categoryIcons.tsx` bắt buộc hiển thị icon cảnh báo `IconBrokenIconFallback` (`data-icon-fallback="broken"`) kèm chú thích rõ ràng cho người dùng.

4. **Tốc độ Nạp & Đồng bộ Trực tiếp (Fast Cache & Live Reload):**
   - Tầng Main Process (`./src/main/builtInAssets.ts` và `./src/main/manifestCoordinator.ts`) lưu cache preview Base64 theo `mtimeMs + size` và theo dõi thay đổi thư mục qua `fs.watch` (`builtinAssets:updated`) để mọi chỉnh sửa JSON phản ánh ngay lập tức lên giao diện mà không cần khởi động lại ứng dụng.
