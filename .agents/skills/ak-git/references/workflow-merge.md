# Quy Trình Hợp Nhất Nhánh Vào Main (Workflow Merge to Main)

Mục tiêu: Đóng gói toàn bộ lịch sử của từng nhánh session vào `main` (hoặc `master`) thông qua cờ `--no-ff` (No Fast-Forward) khi kết thúc session hoặc khi chuyển sang session mới. Nếu session đó sau này phát sinh lỗi hoặc không dùng, có thể dễ dàng loại bỏ hoàn toàn sạch sẽ nhánh đó ra khỏi `main` (bằng `git revert -m 1 <merge-commit>`) mà không ảnh hưởng tới các session khác.

> [!IMPORTANT]
> Chỉ thực hiện merge nhánh khi chuyển sang session cuộc hội thoại mới (hoặc khi người dùng yêu cầu rõ ràng "merge nhánh vào main"). Không thực hiện merge sau mỗi logic đơn lẻ trong cùng 1 session!

## Quy Trình 4 Bước

### Bước 1: Chuẩn Bị Nhánh Chính
Chuyển về nhánh chính và đồng bộ với remote:
```bash
git checkout main
git pull origin main
```

### Bước 2: Hợp Nhất Nhánh Session Với `--no-ff`
```bash
git merge {TEN_NHANH_SESSION} --no-ff -m "[hợp nhất] nhánh '{TEN_NHANH_SESSION}' vào main"
```
*Ghi chú: Luôn dùng `--no-ff` để Git tạo một commit merge rõ ràng, đóng vai trò ranh giới đóng gói session.*

### Bước 3: Đẩy Lên Remote
```bash
git push origin main
git push origin {TEN_NHANH_SESSION}
```

### Bước 4: Tạo Nhánh Cho Session Mới
Từ `main` vừa hợp nhất sạch sẽ:
```bash
git checkout main
git checkout -b {LOAI_MOI}/{CHUDE_SESSION_MOI}
```

## Thao Tác Huỷ Bỏ / Loại Bỏ Nhánh Bị Lỗi Khỏi Main (Rollback / Drop)
Nếu một session sau khi đã merge vào `main` bị phát hiện lỗi nghiêm trọng hoặc không còn muốn dùng:
```bash
git checkout main
git pull origin main
git revert -m 1 {MERGE_COMMIT_HASH} -m "[hoàn tác] loại bỏ nhánh '{TEN_NHANH_SESSION}' khỏi main"
git push origin main
```
Toàn bộ thay đổi của session đó sẽ được loại bỏ hoàn toàn sạch sẽ khỏi `main`.
