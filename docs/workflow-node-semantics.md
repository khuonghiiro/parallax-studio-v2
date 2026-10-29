# Cấu hình và thực thi node Workflow

Chuột phải, bấm đúp hoặc bấm bánh răng trên node để mở dialog. Dialog có một vùng chỉnh sửa liên tục bên trái và hình xem thử bên phải; không chia thao tác sang các tab. Mỗi node thư viện giữ chức năng của nó; ghi chú chỉ là mô tả, không được thực thi như mã lệnh.

- **Đang chỉnh:** tên thao tác và đối tượng nhận luôn cố định ở đầu dialog. Khi có nhiều rule, chọn rule trực tiếp trong danh sách; mỗi lần chỉ sửa thông số của rule đang chọn.
- **Phạm vi toàn node:** hiện các layer nhận tác động; mở “Đổi đối tượng” để đổi scope mà vẫn giữ thao tác đang chỉnh.
- **Thông số:** thao tác riêng của node, tốc độ/độ mạnh của rule, thời lượng chuyển động, DOF hoặc rung camera. BGM xử lý track nhạc; SFX xử lý track âm thanh có sẵn; lip-sync xử lý thoại.
- **Dây nối:** mở mục thu gọn, chọn Đầu vào hoặc Đầu ra, tìm node tương thích, nối hoặc ngắt dây. Cổng phân cấp và transform vẫn giữ quy tắc riêng của Parallax Studio.
- **Xem thử toàn node:** mọi thao tác đang bật cùng được tính; đây không phải chế độ solo rule đang chọn. Bỏ “Tự cập nhật” để chỉnh nhiều giá trị rồi bấm “Xem thử” một lần. Badge báo rõ kết quả còn cũ hay đã cập nhật. Preview không phát âm thanh.
- **Tùy chọn phụ:** thêm thao tác, dây nối, kênh tác động và ghi chú nằm trong các mục thu gọn; mở/đóng không bỏ lựa chọn đang nhập. Các rule phản chiếu từ Inspector không hiện thành rule chỉnh được vì chúng không được engine thực thi độc lập.
- **Áp dụng toàn node:** ghi bản nháp trong một bước Undo. Hủy, Escape hoặc nút đóng bỏ bản nháp. Nối modifier từ dialog layer cũng tính lại modifier nguồn.

## Hiệu năng preview

Preview dùng copy-on-write qua Immer, giữ chung assets, dữ liệu mesh và các layer không thay đổi với project gốc. Chuỗi chỉnh liên tiếp được gộp sau 80ms ngừng nhập; ghi chú, tên và vị trí trên canvas không làm preview chạy lại. Kết quả chỉ so sánh các nhánh dữ liệu thay đổi, không serialize toàn bộ layer mỗi lần UI render. Khi project chưa đổi từ lúc mở dialog, Áp dụng tái sử dụng kết quả preview mới nhất; khi project bên ngoài đã thay đổi, engine tính lại từ dữ liệu mới để tránh ghi đè.

## Phạm vi và thứ tự xử lý

`scene_shot` là điểm bắt đầu. Node xử lý đứng lẻ, dây sai cổng và chu trình giữa các processor không được thực thi. Dây modifier trả hiệu ứng về layer không tạo thêm phụ thuộc dữ liệu, nên hỗ trợ được cả Layer → Modifier và Modifier → Layer.

Ở chế độ tự động, layer được truyền từ node thực thể, qua các node xử lý kế tiếp; dây hiệu ứng đến layer cũng xác định đích nhận. Khi chỉ có ngữ cảnh phân cảnh, xử lý trong cảnh đó. Chế độ thủ công ghi đè danh sách đích. Khi ngắt dây layer cuối cùng, `requireLayerConnection` giữ phạm vi rỗng thay vì tự chuyển sang toàn cảnh; nối lại dây khôi phục phạm vi theo dây.

Node thư viện có `customRules` chạy duy nhất các thao tác đó; không chạy thêm preset tổng quát hoặc nhánh gán hiệu ứng lần hai. Rule chỉ tác động trong phạm vi node, kể cả khi rule chứa ID layer cụ thể. Cleanup của node ngắt kết nối chạy trước các node hoạt động để không tắt kết quả của node khác còn nối.

## MCP và CLI

- `get_workflow`: thêm `node_io`, gồm cổng vào/ra, `executable` và `routing` theo node.
- `list_workflow_presets`: `logic_nodes[].operations` mô tả action, speed và amount.
- `set_workflow(node_id, node_params, apply_node: true)`: dùng cùng evaluator với dialog, hỗ trợ các thông số riêng và một bước Undo.
- `connect_workflow_ports`: dùng cùng quy tắc nối/ngắt của UI.
- Vùng chụp: `workflow_node_config`, `workflow_node_input`, `workflow_node_operation`, `workflow_node_connections`, `workflow_node_output`, `workflow_node_camera_preview`, `workflow_node_settings`, `workflow_node_scope_picker`, `workflow_node_edit_context`, `workflow_node_advanced`, `workflow_node_preview_controls`, `workflow_node_preset_picker`, `workflow_node_rule_picker`.

Triển khai tại [routing](../src/renderer/src/project/workflowRouting.ts), [thứ tự thực thi](../src/renderer/src/project/workflowExecutionOrder.ts), [evaluator bản nháp](../src/renderer/src/project/workflowNodeDraft.ts) và [dialog](../src/renderer/src/ui/workflow/WorkflowNodeConfigDialog.tsx).

## Tham chiếu thiết kế

Áp dụng mô hình đầu vào, thao tác chuyên biệt và đầu ra từ tài liệu chính thức [Work with nodes](https://docs.n8n.io/build/understand-workflows/workflow-components/work-with-nodes.md), [Connect nodes together](https://docs.n8n.io/build/understand-workflows/workflow-components/connect-nodes-together.md) và [Work with data](https://docs.n8n.io/build/work-with-data.md). Workflow vẫn thực thi trên project video Parallax Studio; không phụ thuộc máy chủ n8n.


### Workflow BBox: phạm vi chỉnh, chuỗi Motion và va chạm
- Khung Thuộc tính Node chỉ nhận thao tác trên BBox của layer/cụm được nối. Layer khác chỉ làm nền tham chiếu; nhấn vào đó không đổi node hay lựa chọn layer. Motion chỉ hiện nhãn Đầu/Đích, không hiện điểm va chạm. Khi dừng, khung chỉnh giữ tư thế đầu; kéo hoặc thả BBox đích không tua playhead. Preview mới phát chuyển động.
- **+ Chặng tiếp** trên Motion/Va chạm tạo một node mới có dây nối từ chặng trước. Motion kế thừa vị trí và tỉ lệ cuối chặng trước; chỉnh đích của chặng mới để đi tiếp. Điểm đầu chặng nối được giữ theo chặng trước. Tạo chặng có Undo/Redo và tự mở rộng thời lượng dự án khi cần.
- Node Va chạm đọc cả chuyển động A và B ở cùng thời điểm, dùng kích thước/pivot/rotation thật của layer và BBox hợp nhất của cụm khoá. Kiểm tra đoạn giữa các mẫu để tránh xuyên qua vật nhanh. Chế độ Giao BBox 2D bỏ qua Z; Cùng độ sâu 2.5D yêu cầu khoảng Z không quá 24. Ưu tiên tiếp xúc từ quỹ đạo Motion/BBox đã có của cả A và B. Nếu cả hai chưa có quỹ đạo, giữ hành vi va chạm cũ: A tiến tới B rồi phản ứng theo chế độ đã chọn. Nếu đã có quỹ đạo nhưng không giao nhau thì không tạo va chạm giả. Phản ứng dùng hệ thống physics/mesh hiện có.
- Preview va chạm hiển thị A1/A2, B1/B2 và thời điểm tiếp xúc; `workflow_collision_preview` chụp riêng phần này. Chỉnh quỹ đạo ở node Motion của từng layer.
- Logic dùng chung UI/MCP: `workflowMotionExecution.ts`, `workflowMotionStart.ts`, `workflowStepGraph.ts`, `workflowTimedSteps.ts`, `workflowBboxContact.ts`, `workflowCollisionResponse.ts`. `set_workflow` hỗ trợ `follow_up: true`, `node_id`, `step_duration` (mặc định 3s); số công cụ vẫn là 144.
- PowerShell: `pnpm pxs call set_workflow '{"node_id":"motion-id","follow_up":true,"step_duration":3}'`.
- CMD: `pnpm pxs call set_workflow "{\"node_id\":\"motion-id\",\"follow_up\":true,\"step_duration\":3}"`.
- Flags (PowerShell/CMD): `pnpm pxs call set_workflow --node_id motion-id --follow_up true --step_duration 3`.

### Nối chặng BBox và chọn chặng
Motion/va chạm có cổng OUT: kéo sang node kế tiếp hoặc thả ra khoảng trống để tạo chặng mới. Motion BBox nối #1→#2→#3 kế thừa đích chặng trước làm điểm đầu; sửa đích chặng trước cập nhật các chặng sau. Dải tag BBox trong Thuộc tính Node liệt kê các chặng của layer/cụm theo thời gian, bấm tag để chỉnh từng chặng. Vùng MCP `workflow_bbox_steps` chụp riêng dải tag; `set_workflow` với `follow_up: true` dùng cùng logic tạo chặng như UI.
