# Quản Lý Nhánh Git Theo Logic (Logic-Driven Branch Management)

## 1. Quy Tắc Đặt Tên Nhánh Theo Phân Loại Hành Động
Mỗi nhánh mới bắt buộc thể hiện rõ loại hành động và logic cụ thể cần thực hiện:

**Định dạng:** `<hành-động>/<tên-logic-kebab-case>`

| Tiền tố hành động | Mục đích | Ví dụ |
|-------------------|----------|-------|
| `sua/` (hoặc `fix/`) | Sửa lỗi, khắc phục bug | `sua/photo-studio-import-css` |
| `them/` (hoặc `feat/`) | Thêm mới tính năng, công cụ, module | `them/loop-animator-presets` |
| `chinh/` (hoặc `refactor/`) | Chỉnh sửa, điều chỉnh, tái cấu trúc logic | `chinh/layer-assembly-rig` |
| `xoa/` (hoặc `remove/`) | Xoá bỏ code rác, file thừa, tài nguyên cũ | `xoa/unused-assets` |
| `toi-uu/` (hoặc `perf/`) | Tối ưu hóa hiệu năng, FPS, bộ nhớ | `toi-uu/viewer-canvas-60fps` |

## 2. Vòng Đời Nhánh & Chu Trình Hợp Nhất Vào Main (Branch Lifecycle & Clean Merge)

Mục đích: Phân loại rành mạch từng logic công việc. Khi nhánh hoàn tất sẽ merge vào `main` bằng `--no-ff`. Nếu nhánh đó sau này phát sinh lỗi hoặc không dùng, người dùng hoặc AI có thể dễ dàng loại bỏ hoàn toàn sạch sẽ nhánh đó ra khỏi `main` (bằng `git revert -m 1 <merge-commit>`) mà không ảnh hưởng tới các nhánh logic khác.

### Bước 1: Khởi Tạo Nhánh Từ Main Sạch Sẽ
Luôn bắt đầu từ nhánh chính (`main` hoặc `master`) đã cập nhật mới nhất:
```bash
git checkout main
git pull origin main
git checkout -b <hành-động>/<tên-logic>
# Ví dụ: git checkout -b sua/photo-studio-import-css
```

### Bước 2: Phát Triển & Kiểm Tra Chất Lượng (Quality Gates)
Chỉ thực hiện các thay đổi thuộc đúng logic của nhánh đó. Sau khi sửa:
- Chạy `pnpm verify` (esbuild + typecheck).
- Chạy unit test liên quan (`pnpm test`).
- Chụp ảnh toàn màn hình Visual QA (`pnpm pxs review --view app`).
- Commit trên nhánh logic bằng format tiếng Việt:
```bash
git commit -m "[sửa lỗi] (layer): sửa lỗi vị trí @import trong photoStudio.css"
```

### Bước 3: Hợp Nhất Vào Main Bằng `--no-ff` (No Fast-Forward)
Khi hoàn tất logic đó (hoặc chuẩn bị chuyển sang một logic khác):
```bash
# 1. Chuyển về main
git checkout main
git pull origin main

# 2. Hợp nhất nhánh logic với merge commit tường minh (--no-ff)
git merge <hành-động>/<tên-logic> --no-ff -m "[hợp nhất] nhánh '<hành-động>/<tên-logic>' vào main"

# 3. Đẩy nhánh main lên remote
git push origin main

# 4. Đẩy nhánh logic lên remote (nếu cần lưu vết)
git push origin <hành-động>/<tên-logic>
```

### Bước 4: Tạo Nhánh Mới Cho Logic Tiếp Theo
Từ `main` vừa hợp nhất và sạch sẽ, tạo nhánh mới cho logic mới:
```bash
git checkout main
git checkout -b <hành-động-mới>/<logic-mới>
```

## 3. Cách Loại Bỏ Nhánh Bị Lỗi Ra Khỏi Main (Rollback / Drop Branch)
Nhờ có merge commit `--no-ff`, nếu nhánh logic bị lỗi hoặc không dùng nữa:
```bash
# Hoàn tác toàn bộ nhánh chỉ bằng 1 lệnh revert merge commit:
git revert -m 1 <merge-commit-hash> -m "[hoàn tác] loại bỏ nhánh <tên-nhánh> khỏi main"
git push origin main
```
Toàn bộ code của nhánh đó sẽ được loại bỏ sạch sẽ khỏi `main` mà không làm hỏng lịch sử của các logic khác!

## 4. Các Lệnh Tiện Ích
| Tác vụ | Lệnh Git |
|--------|----------|
| Xem tất cả nhánh | `git branch -a` |
| Nhánh hiện tại | `git rev-parse --abbrev-ref HEAD` |
| Chuyển nhánh | `git checkout <branch>` |
| Tạo và chuyển nhánh | `git checkout -b <branch>` |
| Xoá nhánh local | `git branch -d <branch>` |
| Xoá nhánh remote | `git push origin --delete <branch>` |
