# Đồng bộ ánh sáng khung chỉnh và giữ lựa chọn Viewer

- Nguyên nhân: shader riêng của pad có lõi sáng rộng, opacity cao, tăng radius theo intensity; requestFocus tự thêm editor vào activeViews.
- Sửa: dùng makeLayerMaterial và makeVolumetricLightMaterial của Camera, evaluateVirtualLightAtTime theo playhead và scale/rotation layer; giải phóng GPU khi unmount. Focus chỉ cập nhật yêu cầu căn khung, không đổi lựa chọn Viewer.
- Đăng ký region virtual_light_pad, cập nhật hướng dẫn và schemas MCP.
- Xác minh: pnpm verify đạt; 73 test liên quan đạt; schemas --check không lệch; ping rendererReady=true. Kiểm tra nến cảnh 2, đèn pin cảnh 3 trên Dark/Light; workflow focus giữ nguyên camera-only/editor-only/animate2d-only/camera+animate2d; ảnh toàn màn hình cuối không có lỗi.
- Toàn bộ suite: 1006 đạt, 1 lỗi workflowV2ModularJson.test.ts:181 (dollyIn thay vì orbitRight). Đã tái hiện cùng lỗi trên source HEAD trong D:/_tmp/parallax-light-baseline, không liên quan bản sửa.
- App trả về Timeline, nến cảnh 2 tại 5s, theme dark, Camera + Cam 2D. Không commit/push.
- CLI ak không có trong PATH; ghi nhật ký local trực tiếp. AgentWiki publish skipped.
