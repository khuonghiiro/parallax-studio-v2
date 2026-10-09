# Phase 4 — Công cụ tạo hình mềm trong Xưởng 3D

Status: pending · Priority: P1 · Depends on: 2; dùng mẫu phase 3 để nghiệm thu · Estimate: 22–36h.

## Luồng người dùng

Chọn mặt/cánh → **Chỉnh mesh** → chọn công cụ → click đặt tâm/vùng tác động → kéo tay nắm hoặc quét cọ → xem kết quả realtime → Enter/nhả chuột chốt, Escape hủy → Ctrl+Z hoàn tác một gesture. Chế độ chọn model, mặt và sửa mesh phải phân biệt rõ.

## Bố cục đề xuất

- Thanh công cụ: Chọn · Uốn · Xoắn · Loe/Thắt · Kéo mềm · Lồi/Lõm · Làm mượt · Gấp nếp · Khung.
- Inspector: trục local/world; điểm tựa; angle/strength; radius; falloff; vùng từ–đến; ghim gốc; đối xứng tùy chọn. Ẩn tham số không liên quan công cụ đang chọn.
- Overlay: vòng bán kính cọ, gradient vùng ảnh hưởng, điểm ghim, trục uốn, đường cong và handle; đọc token theme. Không có overlay trong thumbnail/export.
- Stack: danh sách modifier có tên và enabled; đổi thứ tự có preview; reset một bước hoặc toàn bộ; giữ ảnh và hình học gốc. Nếu reorder không hợp lệ với dữ liệu stroke hiện có, báo rõ và cung cấp bake/reproject có preview.

## Công cụ cần triển khai

- [ ] Bend quanh pivot + axis, cho góc âm/dương, clamp vùng và pin; Twist quay dần dọc trục; Taper loe/thuôn; Stretch/Squash giữ gốc. Không đồng nhất tất cả với thanh trượt “độ sâu”.
- [ ] Curve editor 3–5 điểm, tangent handles, preset C/S/rủ/cuộn ngược. Xác định orientation frame để đường cong không xoắn bất ngờ.
- [ ] Grab/Proportional: kéo vertex/vùng với smooth/linear/sharp falloff. Đổi radius khi kéo, khóa trục, front-facing-only; không kéo cả mặt bên kia do raycast xuyên.
- [ ] Inflate/Deflate: cọ lồi/lõm theo normal, intensity có dấu; Smooth với boundary-preserving; Crease nếp gấp có radius/strength. Mask và root pin áp dụng đồng nhất cho mọi brush.
- [ ] Lattice 4×4 mặc định, XYZ displacement cho control points; chế độ riêng từng mặt trước, mở rộng group qua rest-space chung nếu đã có test. Ghim hàng gốc; tăng resolution không làm mất hình hiện có.
- [ ] Pin/unpin chọn vùng; mask feather; reset và đảo mask. “Độ mềm” là falloff/radius, tránh gọi là vật lý nếu không có solver.
- [ ] Gesture history, pointer capture, pointercancel/window blur; không ghi history mỗi pixel; không ghi disk mỗi pointermove. Preview cập nhật tối đa một lần mỗi animation frame.

## Các module

Tách `MeshCurvatureEditor.tsx` thành `ui/assets/models3d/meshEditor/{MeshEditorPanel,ModifierStack,BrushControls,CurveControls,LatticeControls}.tsx`; hooks `useMeshGesture`, `useMeshSelection`; math nằm ở `engine/imageMesh/`. Nối vào `Mesh2DTextureEditor.tsx`, `AssemblyViewport.tsx`, raycast/gizmo và `useAssemblyHistory.ts`. CSS module riêng dùng tokens Dark/Light.

## Gate

- Gesture update/commit/cancel/undo/redo giữ đúng snapshots; 100 thao tác liên tiếp không tăng GPU buffers mãi. Hủy trên Escape hoặc mất focus không để gesture bị khóa.
- Đổi mesh density/texture có preview và chính sách tái chiếu UV; không map cọ theo index vertex cũ. Mask/pins giữ semantic vị trí.
- Raycast chọn đúng mặt đang deform, cả mô hình đã xoay/scale; không xuyên alpha hole; zoom/OrbitControls không xung đột với brush.
- Đo model 50k tam giác, một face active: mục tiêu preview p95<=33ms/frame, pointer feedback<100ms, final evaluation<250ms trên máy kiểm tra; ghi cấu hình máy, không dùng unit test thời gian dễ flake để giả chứng minh.
- Kiểm tra UI thật bằng pxs trong app có preload/IPC, cả hai theme; không dùng browser giả thay app. Không khởi động lại Electron của người dùng.
