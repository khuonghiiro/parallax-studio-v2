# Quy Trình Hợp Nhất Nhánh Vào Main (Workflow Merge to Main)

Mục tiêu: Đóng gói lịch sử của từng nhánh logic vào `main` (hoặc `master`) thông qua cờ `--no-ff` (No Fast-Forward). Nếu nhánh đó sau này phát sinh lỗi hoặc không dùng, có thể dễ dàng loại bỏ hoàn toàn sạch sẽ nhánh đó ra khỏi `main` (bằng `git revert -m 1 <merge-commit>`) mà không ảnh hưởng tới các nhánh logic khác.

## Quy Trình 4 Bước

### Bước 1: Chuẩn Bị Nhánh Chính
Chuyển về nhánh chính và đồng bộ với remote:
```bash
git checkout main
git pull origin main
```

### Bước 2: Hợp Nhất Nhánh Logic Với `--no-ff`
```bash
git merge {TEN_NHANH} --no-ff -m "[hợp nhất] nhánh '{TEN_NHANH}' vào main"
```
*Ghi chú: Luôn dùng `--no-ff` để Git tạo một commit merge rõ ràng, đóng vai trò ranh giới đóng gói logic.*

### Bước 3: Đẩy Lên Remote
```bash
git push origin main
git push origin {TEN_NHANH}
```

### Bước 4: Tạo Nhánh Cho Logic Mới
Từ `main` vừa hợp nhất sạch sẽ:
```bash
git checkout main
git checkout -b {LOAI_MOI}/{LOGIC_MOI}
```

## Thao Tác Huỷ Bỏ / Loại Bỏ Nhánh Bị Lỗi Khỏi Main (Rollback / Drop)
Nếu một nhánh sau khi đã merge vào `main` bị phát hiện lỗi nghiêm trọng hoặc không còn muốn dùng:
```bash
git checkout main
git pull origin main
git revert -m 1 {MERGE_COMMIT_HASH} -m "[hoàn tác] loại bỏ nhánh '{TEN_NHANH}' khỏi main"
git push origin main
```
Toàn bộ thay đổi của nhánh đó sẽ được loại bỏ hoàn toàn sạch sẽ khỏi `main`.
