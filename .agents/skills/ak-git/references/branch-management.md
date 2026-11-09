# Quản Lý Nhánh Git Theo Phiên Hội Thoại (Session-Driven Branch Management)

## 1. Nguyên Tắc Cốt Lõi: Nhánh Theo Session Hội Thoại
- Vòng đời tạo nhánh và hợp nhất nhánh **gắn liền với từng Session cuộc hội thoại (hoặc phiên làm việc)**.
- **TUYỆT ĐỐI TRÁNH:** Vừa xử lý xong 1 logic con/tác vụ nhỏ đã vội vàng tạo nhánh mới rồi hợp nhất ngay vào `main`, gây rối loạn và rác lịch sử git bằng hàng loạt nhánh và merge commit vụn vặt không cần thiết trong cùng một phiên trao đổi.
- **Trong 1 session cuộc hội thoại:** Mọi xử lý code, sửa lỗi, thêm tính năng đều làm việc trên **duy nhất 1 nhánh của session đó**. Trong quá trình trao đổi khi có xử lý gì đó, các commit đã được phân loại rõ ràng qua định dạng tiếng Việt chuẩn (`[tính năng]`, `[sửa lỗi]`, `[chỉnh sửa]`, `[giao diện]`, `[tái cấu trúc]`, `[hiệu năng]`, `[kiểm thử]`, `[dọn dẹp]`...).
- **CHỈ KHI chuyển sang session cuộc hội thoại mới:** AI mới tiến hành hợp nhất nhánh của session trước đó vào `main` (hoặc `master`) bằng cờ `--no-ff`, kéo code mới nhất, và tạo một nhánh mới từ `main` cho session mới đó.

## 2. Quy Tắc Đặt Tên Nhánh Theo Chủ Đề Session
Mỗi nhánh mới bắt buộc thể hiện rõ loại hành động và chủ đề chính của session:

**Định dạng:** `<hành-động>/<tên-chủ-đề-session-kebab-case>`

| Tiền tố hành động | Mục đích | Ví dụ |
|-------------------|----------|-------|
| `fix/` | Session tập trung sửa lỗi, khắc phục bug | `fix/photo-studio-import-css`, `fix/timeline-audio-sync` |
| `add/` (hoặc `feat/`) | Session tập trung thêm tính năng, công cụ, module mới | `feat/mixamo-dopesheet`, `add/loop-animator-presets` |
| `edit/` (hoặc `refactor/`) | Session chỉnh sửa, điều chỉnh, tái cấu trúc logic | `edit/responsive-workflow`, `edit/ai-ui`, `refactor/layer-assembly-rig` |
| `remove/` (hoặc `delete/`) | Session dọn dẹp, xoá bỏ code rác, file thừa | `remove/unused-assets` |
| `perf/` | Session tối ưu hóa hiệu năng, 60fps, bộ nhớ | `perf/viewer-canvas-60fps` |

## 3. Vòng Đời Nhánh & Chu Trình Hợp Nhất (Session Lifecycle & Clean Merge)

Mục đích: Đóng gói toàn bộ thành quả của từng session hội thoại vào một merge commit `--no-ff` duy nhất trên `main`. Nếu toàn bộ session đó sau này phát sinh lỗi hoặc không dùng, người dùng hoặc AI có thể dễ dàng loại bỏ hoàn toàn sạch sẽ session đó ra khỏi `main` (bằng `git revert -m 1 <merge-commit>`) mà không ảnh hưởng tới các session khác.

### Bước 1: Khởi Tạo Nhánh Khi Bắt Đầu Session Mới
Khi người dùng mở một phiên làm việc mới:
1. Kiểm tra trạng thái git hiện tại: Nếu đang ở nhánh session cũ và có commit chưa hợp nhất:
   - Chuyển về `main` (`git checkout main`)
   - Kéo mới nhất (`git pull origin main`)
   - Hợp nhất nhánh session cũ: `git merge <nhánh-session-cũ> --no-ff -m "[hợp nhất] nhánh '<nhánh-session-cũ>' vào main"`
   - Đẩy lên remote: `git push origin main`
2. Tạo nhánh mới cho session hiện tại từ `main` sạch sẽ:
```bash
git checkout main
git pull origin main
git checkout -b <hành-động>/<tên-chủ-đề-session>
# Ví dụ: git checkout -b edit/responsive-workflow
```

### Bước 2: Phát Triển & Commit Trong Suốt Session (Quality Gates)
Mọi trao đổi, yêu cầu sửa đổi, thêm tính năng TRONG CÙNG SESSION đều được thực hiện trên nhánh session này.
Sau mỗi lần giải quyết xong một yêu cầu / logic nhỏ:
- Chạy `pnpm verify` (esbuild + typecheck).
- Chạy unit test liên quan (`pnpm test`).
- Chụp ảnh toàn màn hình Visual QA (`pnpm pxs review --view app`) nếu app đang mở.
- Commit trực tiếp trên nhánh session bằng format tiếng Việt:
```bash
git commit -m "[loại] (phạm vi): mô tả chi tiết bằng tiếng Việt có dấu"
# Ví dụ: git commit -m "[tính năng] (ui): thêm nút chia nhỏ timeline"
```
- Có thể đẩy nhánh session lên remote (`git push origin <tên-nhánh>`) để lưu vết an toàn.
- **CẤM:** Không tự ý merge vào `main` hay nhảy sang nhánh mới sau mỗi logic đơn lẻ khi vẫn đang trong cùng một session!

### Bước 3: Hợp Nhất Vào Main Khi Chuyển Sang Session Mới
Chỉ khi người dùng chuyển sang session cuộc hội thoại mới (hoặc có yêu cầu rõ ràng "merge nhánh vào main"):
```bash
# 1. Chuyển về main
git checkout main
git pull origin main

# 2. Hợp nhất nhánh session với merge commit tường minh (--no-ff)
git merge <hành-động>/<tên-chủ-đề-session> --no-ff -m "[hợp nhất] nhánh '<hành-động>/<tên-chủ-đề-session>' vào main"

# 3. Đẩy nhánh main lên remote
git push origin main

# 4. Đẩy nhánh session lên remote (nếu cần lưu vết)
git push origin <hành-động>/<tên-chủ-đề-session>
```

### Bước 4: Tạo Nhánh Mới Cho Session Tiếp Theo
Từ `main` vừa hợp nhất và sạch sẽ, tạo nhánh mới cho session tiếp theo:
```bash
git checkout main
git checkout -b <hành-động-mới>/<chủ-đề-session-mới>
```

## 4. Cách Loại Bỏ Session Bị Lỗi Ra Khỏi Main (Rollback / Drop Session)
Nhờ có merge commit `--no-ff`, nếu toàn bộ session bị lỗi hoặc không dùng nữa:
```bash
# Hoàn tác toàn bộ session chỉ bằng 1 lệnh revert merge commit:
git revert -m 1 <merge-commit-hash> -m "[hoàn tác] loại bỏ nhánh <tên-nhánh> khỏi main"
git push origin main
```
Toàn bộ code của session đó sẽ được loại bỏ sạch sẽ khỏi `main` mà không làm hỏng lịch sử của các session khác!

## 5. Các Lệnh Tiện Ích
| Tác vụ | Lệnh Git |
|--------|----------|
| Xem tất cả nhánh | `git branch -a` |
| Nhánh hiện tại | `git rev-parse --abbrev-ref HEAD` |
| Chuyển nhánh | `git checkout <branch>` |
| Tạo và chuyển nhánh | `git checkout -b <branch>` |
| Xoá nhánh local | `git branch -d <branch>` |
| Xoá nhánh remote | `git push origin --delete <branch>` |
