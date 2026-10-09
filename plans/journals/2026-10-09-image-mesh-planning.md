# Lập kế hoạch mesh hữu cơ từ ảnh — 2026-10-09

Người dùng yêu cầu kế hoạch sửa prompt và mesh hoa/cỏ 360°, thêm công cụ uốn và chỉnh lồi/lõm/kéo mềm. Đã xác nhận hai loại hoa riêng: loa kèn sáu cánh và calla một cánh cuộn.

Khảo sát baseline a8e9c3b ghi nhận bend/curl/arc và alpha rules đã có. Vấn đề quan trọng là biến dạng mesh chưa được mang vào scene layer/export, điểm neo chưa thành contract, cell bend có nguy cơ tách biên và prompt chưa phản ánh toàn bộ hình học.

Kế hoạch 5 phase tại `../261009-image-mesh-deformation/plan.md`. Ba review độc lập được tổng hợp vào review.md; bổ sung restUV, master alpha mặt trước/sau, constraints sau motion, atomic asset lifecycle, async revision guard và ngân sách tổng.

Chỉ viết tài liệu kế hoạch; không thay code hoặc model/ảnh người dùng. CLI ak không khả dụng, ghi nhật ký file cục bộ thay vì CLI. Không publish AgentWiki. Lượt test trước đó bị ENOSPC ở một suite; cần xử lý môi trường trước triển khai. Bước tiếp theo: phase 1, baseline ảnh và contract slot/anchor.
