# Quy Trình Hợp Nhất Nhánh Vào Master (Workflow Merge to Master)

Mục tiêu: Đóng gói toàn bộ lịch sử của từng nhánh session vào `master` thông qua cờ `--no-ff` (No Fast-Forward) khi đã xác nhận chuyển sang session mới và không có yêu cầu xử lý tiếp. Nếu session đó sau này phát sinh lỗi hoặc không dùng, có thể dễ dàng loại bỏ hoàn toàn sạch sẽ nhánh đó ra khỏi `master` (bằng `git revert -m 1 <merge-commit>`) mà không ảnh hưởng tới các session khác.

> [!IMPORTANT]
> Đọc `branch-management.md` để xác minh session và nhánh trước. Nếu user yêu cầu xử lý tiếp/continue, giữ nhánh cũ kể cả chat mới. Chỉ thực hiện merge nhánh khi đã xác nhận chuyển sang session cuộc hội thoại mới và không có yêu cầu tiếp tục (hoặc khi người dùng yêu cầu rõ ràng "merge nhánh vào master"). Không thực hiện merge sau mỗi logic đơn lẻ trong cùng 1 session!

## Quy Trình 4 Bước

### Bước 1: Chuẩn Bị Nhánh Chính
Chuyển về nhánh chính và đồng bộ với remote:
```bash
git checkout master
git pull --ff-only origin master
```

### Bước 2: Hợp Nhất Nhánh Session Với `--no-ff`
```bash
git merge {TEN_NHANH_SESSION} --no-ff -m "[hợp nhất] nhánh '{TEN_NHANH_SESSION}' vào master"
```
*Ghi chú: Luôn dùng `--no-ff` để Git tạo một commit merge rõ ràng, đóng vai trò ranh giới đóng gói session.*

### Bước 3: Kiểm tra quality gates theo AGENTS.md rồi đẩy lên remote
```bash
git push origin master
```

### Bước 4: Tạo Nhánh Cho Session Mới
Từ `master` vừa hợp nhất sạch sẽ:
```bash
git checkout master
git checkout -b {LOAI_MOI}/{CHUDE_SESSION_MOI}
```

## Thao Tác Huỷ Bỏ / Loại Bỏ Nhánh Bị Lỗi Khỏi Main (Rollback / Drop)
Nếu một session sau khi đã merge vào `master` bị phát hiện lỗi nghiêm trọng hoặc không còn muốn dùng:
```bash
git checkout master
git pull --ff-only origin master
git revert -m 1 {MERGE_COMMIT_HASH} -m "[hoàn tác] loại bỏ nhánh '{TEN_NHANH_SESSION}' khỏi master"
git push origin master
```
Toàn bộ thay đổi của session đó sẽ được loại bỏ hoàn toàn sạch sẽ khỏi `master`.
