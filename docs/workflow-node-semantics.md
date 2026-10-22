# Cấu hình và thực thi node Workflow

Chuột phải, bấm đúp hoặc bấm bánh răng trên node để mở dialog. Bố cục theo chiều **Đầu vào → Thông số → Đầu ra xem thử**. Mỗi node thư viện giữ chức năng của nó; ghi chú chỉ là mô tả, không được thực thi như mã lệnh.

- **Đầu vào:** hiển thị dây nguồn, trạng thái thực thi và đối tượng trong phạm vi xử lý.
- **Thông số:** thao tác riêng của node, tốc độ/độ mạnh của rule, thời lượng chuyển động, DOF hoặc rung camera. BGM xử lý track nhạc; SFX xử lý track âm thanh có sẵn; lip-sync xử lý thoại.
- **Kết nối:** chọn Đầu vào hoặc Đầu ra, tìm node tương thích, nối hoặc ngắt dây. Cổng phân cấp và transform vẫn giữ quy tắc riêng của Parallax Studio.
- **Đầu ra:** camera preview và danh sách thay đổi thực tế so với dự án trước khi mở dialog. Preview không phát âm thanh.
- **Áp dụng:** ghi bản nháp trong một bước Undo. Hủy, Escape hoặc nút đóng bỏ bản nháp. Nối modifier từ dialog layer cũng tính lại modifier nguồn.

## Phạm vi và thứ tự xử lý

`scene_shot` là điểm bắt đầu. Node xử lý đứng lẻ, dây sai cổng và chu trình giữa các processor không được thực thi. Dây modifier trả hiệu ứng về layer không tạo thêm phụ thuộc dữ liệu, nên hỗ trợ được cả Layer → Modifier và Modifier → Layer.

Ở chế độ tự động, layer được truyền từ node thực thể, qua các node xử lý kế tiếp; dây hiệu ứng đến layer cũng xác định đích nhận. Khi chỉ có ngữ cảnh phân cảnh, xử lý trong cảnh đó. Chế độ thủ công ghi đè danh sách đích. Khi ngắt dây layer cuối cùng, `requireLayerConnection` giữ phạm vi rỗng thay vì tự chuyển sang toàn cảnh; nối lại dây khôi phục phạm vi theo dây.

Node thư viện có `customRules` chạy duy nhất các thao tác đó; không chạy thêm preset tổng quát hoặc nhánh gán hiệu ứng lần hai. Rule chỉ tác động trong phạm vi node, kể cả khi rule chứa ID layer cụ thể. Cleanup của node ngắt kết nối chạy trước các node hoạt động để không tắt kết quả của node khác còn nối.

## MCP và CLI

- `get_workflow`: thêm `node_io`, gồm cổng vào/ra, `executable` và `routing` theo node.
- `list_workflow_presets`: `logic_nodes[].operations` mô tả action, speed và amount.
- `set_workflow(node_id, node_params, apply_node: true)`: dùng cùng evaluator với dialog, hỗ trợ các thông số riêng và một bước Undo.
- `connect_workflow_ports`: dùng cùng quy tắc nối/ngắt của UI.
- Vùng chụp: `workflow_node_config`, `workflow_node_input`, `workflow_node_operation`, `workflow_node_connections`, `workflow_node_output`, `workflow_node_camera_preview`, `workflow_node_settings`.

Triển khai tại [routing](../src/renderer/src/project/workflowRouting.ts), [thứ tự thực thi](../src/renderer/src/project/workflowExecutionOrder.ts), [evaluator bản nháp](../src/renderer/src/project/workflowNodeDraft.ts) và [dialog](../src/renderer/src/ui/workflow/WorkflowNodeConfigDialog.tsx).

## Tham chiếu thiết kế

Áp dụng mô hình đầu vào, thao tác chuyên biệt và đầu ra từ tài liệu chính thức [Work with nodes](https://docs.n8n.io/build/understand-workflows/workflow-components/work-with-nodes.md), [Connect nodes together](https://docs.n8n.io/build/understand-workflows/workflow-components/connect-nodes-together.md) và [Work with data](https://docs.n8n.io/build/work-with-data.md). Workflow vẫn thực thi trên project video Parallax Studio; không phụ thuộc máy chủ n8n.
