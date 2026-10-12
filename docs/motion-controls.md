# Motion Effect Controls

Chọn layer → Inspector **Layer** → **Motion**. Chuyển động được cộng vào Transform/keyframe hiện có và dùng cùng bộ tính khi preview hoặc xuất MP4.

- **Loại:** Offset (trôi/cuộn texture), Wind, Sway, Float, Wiggle, Pulse. Đổi loại đặt lại thông số theo đúng đơn vị; Reset khôi phục mặc định của loại đang chọn.
- **Bật/tắt:** giữ nguyên thông số khi bypass. **Cường độ:** 0–100%, áp dụng cả vị trí, xoay, co giãn và UV.
- **Vận tốc:** đơn vị không gian/giây với Offset; **Tần số:** Hz với các loại khác. Giá trị 0 được giữ nguyên.
- **Biên độ:** X/Y theo đơn vị không gian, xoay Z theo độ. Pulse hiển thị phần trăm co giãn, lưu tỉ lệ (5% = 0.05). Float không xoay Z.
- **Offset:** hướng 0° phải, 90° lên; UV cuộn ảnh, Ping-pong qua lại, Continuous trôi một chiều. Dao động phụ vuông góc với hướng trôi.
- **Lệch pha:** radian; riêng Offset UV/Continuous là độ lệch theo đơn vị không gian, giữ tương thích dự án cũ.
- **Random seed:** Wiggle lặp lại chính xác khi tua hoặc xuất video; đổi seed để các layer có nhịp khác nhau.
- **Bắt đầu:** giây trên timeline. **Thời lượng:** 0 chạy đến hết layer; lớn hơn 0 thì trở về Transform gốc khi hết thời gian.
- **Ease In/Out:** thời gian tăng/giảm cường độ bằng smoothstep; Ease Out chỉ áp dụng khi có thời lượng. Đặt Ease Out > 0 để tránh chuyển đột ngột về Transform gốc.
- **Preview:** đồ thị X/Y chuẩn hóa từ bộ tính thật, không phải Graph Editor chỉnh keyframe. Đường liền là X, đường đứt là Y. Xem 4 giây khi không đặt thời lượng.

Đây là bảng chỉnh procedural motion lấy cảm hứng từ Effect Controls, không phải bản sao đầy đủ Graph Editor của After Effects. Các thao tác vẫn hỗ trợ Undo/Redo; mỗi lần kéo giá trị dùng một nhóm lịch sử.

## MCP / CLI

`set_layer_motion` và `get_layer_motion` dùng cùng logic với giao diện. Các tên tham số MCP dùng snake_case, trong file project dùng camelCase.

```sh
pnpm pxs call set_layer_motion '{"layer_id":"layer-1","type":"wiggle","speed":1.5,"amplitude":[15,15,2],"seed":42,"amount":0.7,"start_time":1,"duration":4,"fade_in":0.5,"fade_out":0.5}'
pnpm pxs call get_layer_motion '{"layer_id":"layer-1","time":2}'
pnpm pxs call set_layer_motion '{"layer_id":"layer-1","enabled":false}'
pnpm pxs call set_layer_motion '{"layer_id":"layer-1","reset":true}'
pnpm pxs review --view app --region motion --out motion.png
```

Đọc thêm `pnpm pxs help set_layer_motion`. Region mới: `motion`, `motion_preview`, `motion_parameters`, `motion_timing`. Tool đọc trả cấu hình và offset đã tính, không thay đổi playhead. Tool sửa cập nhật qua lịch sử editor, không tự tạo keyframe.

## Mã nguồn

- Bộ tính chung: [proceduralMotion.ts](../src/renderer/src/animation/proceduralMotion.ts).
- Giao diện: [MotionSection.tsx](../src/renderer/src/ui/inspector/sections/MotionSection.tsx).
- MCP: [proceduralMotionCommands.ts](../src/renderer/src/mcp/commands/proceduralMotionCommands.ts).
- Kiểm thử: [sampler](../src/renderer/src/animation/proceduralMotion.test.ts), [MCP](../src/renderer/src/mcp/commands/proceduralMotionCommands.test.ts).
