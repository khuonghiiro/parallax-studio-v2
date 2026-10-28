# Đồng bộ thời gian demo, Workflow và Timeline

Timeline từng tự rút composition về camera key cuối khi render; đã bỏ hiệu ứng này. Demo có đoạn giữ và lia riêng, cảnh đến xuất hiện trong đoạn lia.

Node Time chia sẻ khoảng xử lý, giữ khoảng riêng để khôi phục khi ngắt dây. Timeline có chọn nhiều dòng, kéo nhóm và căn đầu dòng cùng mốc. Dời kèm animation, glow, va chạm và audio gắn layer.

Kiểm tra: verify, test toàn dự án và test hồi quy thời gian, catalog song ngữ và cú pháp CLI; visual QA hai theme. CLI ak không có trong PATH nên ghi journal trực tiếp.

Tiếp theo theo yêu cầu người dùng: sau commit/push phần này, sửa lỗi React hooks khi xoá/ngắt liên kết và phân biệt xoá node với tắt node.
