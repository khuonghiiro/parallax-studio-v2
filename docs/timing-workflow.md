

### Shared timing and multi-row timeline
- Demo ba cảnh giữ đủ 15 giây: giữ khung rồi lia ở 4–5s và 9–10s; cảnh đến hiện từ đầu đoạn lia. Timeline không tự rút thời lượng khi render.
- Workflow: **+ Time** tạo nguồn khoảng thời gian; kéo cổng ra tới Layer, Motion, Animation, FX, va chạm hoặc Audio. Một node nhận tối đa một nguồn Time. Ngắt/xoá/tắt nguồn trả về khoảng riêng; Camera và cấu trúc cảnh giữ lộ trình riêng.
- Timeline: tích ô chọn các dòng rồi kéo một dòng để dời cả nhóm; **Căn dòng** căn các điểm đầu tới đầu phát, giữ thời lượng và dời keyframe/hiệu ứng/âm thanh gắn layer. Layer khoá được bỏ qua. Kéo thủ công node đã nối Time chuyển node đó về thời gian riêng.
- MCP: `set_workflow(create_time: true)`, `set_workflow(node_id, node_params)` với `timeStart/timeEnd`, `connect_workflow_ports(port: "time_range")`, `retime_layers(layer_ids, mode: "shift" | "align", seconds)`. Có Undo/Redo; main.json giữ nguồn và dây thời gian dùng chung.
- Region mới: `timeline_batch_timing`; Workflow tiếp tục dùng `workflow_toolbar`, `workflow_canvas`, `workflow_inspector`.
- PowerShell: `pnpm pxs call retime_layers '{"layer_ids":["layer-1","layer-2"],"mode":"align","seconds":2}'`.
- CMD: `pnpm pxs call retime_layers "{\"layer_ids\":[\"layer-1\",\"layer-2\"],\"mode\":\"align\",\"seconds\":2}"`.
