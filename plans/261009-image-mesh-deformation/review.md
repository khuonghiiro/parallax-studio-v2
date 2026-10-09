# Review và quyết định thiết kế — 2026-10-09

Ba lượt review độc lập, chỉ đọc: giả định hình học, failure modes dữ liệu/render, input và vòng đời. Các chỉnh sửa dưới đây đã đưa vào plan; chưa sửa implementation.

| Phát hiện | Bằng chứng code tại thời điểm review | Quyết định |
|---|---|---|
| Insert làm phẳng mesh | `insertModel3D.ts`, `engine/layerNodes.ts:52`, `engine/renderTypes.ts:74`, `export/runExport.ts:70` | Gate P1 ở phase 2 trước bộ cọ |
| RestUV và textureUV không được dùng chung khóa | `alphaMeshBuilder.ts:290`, `contourMesh.ts:39` | Rest-domain ổn định, alignment chỉ đổi texture mapping |
| Họng kín ở tư thế nghỉ vẫn có thể nứt khi uốn/gió | `alphaMeshBuilder.ts:284`, `assemblyMeshCache.ts:57`, `assemblyMotion.ts:28` | Group seam constraints sau motion; test timeline random-access |
| Alpha mặt trước/sau không cùng topology | `alphaMeshBuilder.ts:267`, `assemblyMeshFactory.ts:131` | Một master mask + registration/mirror rõ |
| Validator riêng không bảo vệ mọi command | `imageMeshRecipe.ts:21`, `assemblyCommands.ts:423`, `assemblyMeshParams.ts:36` | Gate chung mọi mutation; finite/range/polygon/size checks |
| Decode muộn ghi đè trạng thái mới | `assemblyTemplateCommands.ts:22`, `assemblyCommands.ts:434` | Generation + session/project/model revision guard, batch commit |
| Insert transaction chưa bao phủ blob ngoài history | `insertModel3D.ts:23`, `project/assets.ts:40` | Prepare/validate/commit; ownership cho rollback và redo |
| Budget mỗi field không chặn chi phí tổng | `project/assets.ts:238` và workflow brush mới | Gate tổng ở phase 2, đo trước chốt giới hạn |
| Cell bend có biên bị tách | `alphaMeshBuilder.ts:285`, `alphaMeshBuilder.ts:309` | Continuous weight deformation, adapter legacy giữ hình cũ |

Các file models3d trong bảng nằm dưới `src/renderer/src/ui/assets/models3d`; commands dưới `src/renderer/src/mcp/commands`; engine/project/export dưới `src/renderer/src`. Line numbers là snapshot, cần xác minh lại khi bắt đầu code vì repository đang được sửa đồng thời.

## Kiểm tra tính nhất quán của plan

- 5 phase tuần tự, không có dependency cycle; modifier/serialization/API có chủ sở hữu và gate rõ.
- Hai mẫu loa kèn/calla đã xác nhận; không gộp thành một generator sáu cánh.
- Không tuyên bố physics/Blender parity toàn bộ; soft editing nằm trong phạm vi.
- Dùng alpha thật khi có ảnh, preset polygon chỉ là preview; không quay lại ép mọi ảnh theo polygon định sẵn.
- Phần legacy library save hiện giữ full face; trọng tâm persistence mới là shared project geometry, không viết lại toàn bộ storage.
- Mục tiêu hiệu năng và thời gian là ước lượng cần đo; review visual và export parity không được thay bằng unit test pass.

## Giới hạn xác minh

Đã khảo sát code, tham khảo tài liệu Blender chính thức và kiểm tra cấu trúc tài liệu. Chưa dựng mẫu/render turntable mới, chưa triển khai cọ hoặc pipeline mới. Test trước tác vụ plan gặp ENOSPC; ghi tại plan.md. CLI `ak` không được cài trong môi trường nên không hydrate vào registry/journal CLI; trạng thái nằm trong checklist Markdown và nhật ký cục bộ.
