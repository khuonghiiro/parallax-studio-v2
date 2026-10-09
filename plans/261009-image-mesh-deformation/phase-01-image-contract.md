# Phase 1 — Contract ảnh, prompt và điểm neo

Status: completed · Priority: P1 · Depends on: none · Estimate: 6–10h.

## Mục tiêu

AI có thể render hoặc chuẩn bị một bộ ảnh đúng cấu trúc; ảnh được gắn đúng vị trí với mọi biến thể hợp lệ. Chi tiết phase 1 đã khảo sát; đọc lại code trước khi sửa vì baseline có thể thay đổi.

## File chịu trách nhiệm

Hiện có: `ui/assets/models3d/imageMeshTypes.ts`, `imageMeshSlotRules.ts`, `imageMeshRecipe.ts`, `imageMeshTemplates.ts`, `ImageMeshTemplateDetail.tsx`, `assemblyTemplateKit.ts`, `assemblyTemplateCommands.ts`. Đường dẫn đầu nằm dưới `src/renderer/src/`; commands nằm trong `mcp/commands/`.

Mới dự kiến: `engine/imageMesh/imageContract.ts`, `imageContractValidation.ts`, `ui/assets/models3d/ImageAlignmentEditor.tsx`; tests đặt cạnh module.

## Các bước

- [x] Chụp mẫu hiện tại từ app bằng `pnpm pxs review --view app` và `get_assembly_screenshot`, ghi ảnh trước khi sửa; không mở thêm dev instance hoặc sửa model người dùng để thử nghiệm.
- [x] Thêm schema version cho recipe/slot. Trường cấu trúc: `aspect`, `alphaMode`, `imageOrigin: top-left`, `anchorUV`, `tipUV`, `attachmentBand`, `contentBounds`, `silhouettePolicy`, `front/back`, `reusePolicy`, `materialGroup`.
- [x] Quy định rõ ảnh y hướng xuống; mesh UV v hướng lên; một hàm chuyển đổi duy nhất. Điểm gắn được tính trên mặt **sau** deformation, trước transform toàn model.
- [x] Các slot sát cạnh (gốc cỏ/cuống cánh) có alpha chạm vùng nối; không áp chung padding 4% cho cả bốn cạnh. Lá đứng riêng được padding, lá chậu có anchor riêng được căn xuống đất.
- [x] Tạo prompt EN/VI từ cấu trúc: một bộ phận phẳng nhìn vuông góc, không phối cảnh/bóng đổ; tỷ lệ chính xác; hình dáng còn chưa uốn; hướng cuống/ngọn; mask, alpha và màu thống nhất; biến thể texture không được đổi anchor.
- [x] Xuất ảnh/mask hướng dẫn SVG hoặc PNG với vạch gốc, tâm, tip, vùng mép nối. Tệp có nhãn chỉ làm reference; PNG thành phẩm không được có nhãn/vạch. Xuất cả image metadata và URL/data qua MCP với giới hạn dung lượng.
- [x] Validator đọc ảnh thật: decode, tỷ lệ, kích thước, alpha hợp lệ, bounds alpha và coverage vùng gốc. Mặt kín kiểm tra mép kín; cutout kiểm tra background thật. Không coi PNG extension là bằng chứng có alpha.
- [x] Validator là cổng chung của UI import, apply template, set face image, update mesh, project/model import và command gọi qua execute_script; tool validate chỉ là preview của cùng logic. Legacy asset thiếu metadata được đánh dấu unvalidated và giữ hình cũ, không bị xóa/chặn mở toàn dự án.
- [x] Front/back dùng một master silhouette/rest-domain. Hai ảnh phải đăng ký vào cùng anchor và biên, quy định mirror theo hướng nhìn mặt sau; không tự suy luận mirror. Slot chuỗi cũ migrate thành front binding + explicit back fallback, giữ tương thích lời gọi cũ. Alpha phía sau không tự thay topology.
- [x] Decode/căn ảnh có generation ID + session/model/project revision guard. Chọn ảnh mới, undo hoặc đóng/đổi xưởng hủy kết quả cũ; dispose bitmap/object URL. Validate cả batch rồi commit nếu target vẫn đúng; không overwrite snapshot cũ sau await.
- [x] Với ảnh có sẵn: preview fit/pad/crop, chọn điểm cuống/ngọn, xoay/lật có chủ đích; hiển thị phép biến đổi ảnh. Không tự crop/stretch hoặc đoán mặt khuất.
- [x] `get_assembly_template` xuất đầy đủ cấu hình deformation/silhouette và anchor của phiên bản đã resolve. Test giữa UI contract, prompt và MCP result cùng một dữ liệu.

## Ma trận ảnh mục tiêu

| Mẫu | Ảnh lõi | Ảnh bổ sung cho chất lượng 360° |
|---|---|---|
| Hoa thường | cánh trước, nhụy, vỏ thân, đài | cánh sau; lá riêng nếu mẫu có lá |
| Loa kèn sáu cánh | cánh trải phẳng mặt trong, nhị, vỏ thân, đài | cánh mặt ngoài; có thể dùng lại có chủ đích |
| Calla | một cánh mo trải phẳng, nhụy trụ, vỏ thân | mặt ngoài cánh mo, lá nếu chọn |
| Cỏ 360° | một phiến thẳng hoặc 2–4 phiến nguồn | mặt sau tùy chọn; thay đổi dáng bằng geometry |

Giữ ID slot cũ để migration; slot mới là mở rộng có default rõ. Tỷ lệ hoa/cỏ có thể đổi theo generator, phải sinh ảnh hướng dẫn theo cấu hình cuối, không cố định prompt trái với hình học.

## Gate

- Unit tests: image y-down ↔ UV v-up; bounds/padding; alpha gốc; tỷ lệ số nguyên; slot lặp; payload lỗi; giữ nguyên ảnh gốc khi cancel.
- Anchor mới không lệch quá 0.5 đơn vị model ở tư thế nghỉ; trường hợp không đủ coverage phải báo, không coi là hợp lệ.
- Test đọc PNG sai tỷ lệ, PNG đục, PNG có nền caro, ảnh lỗi decode. Nền caro chỉ có thể cảnh báo heuristic, không tuyên bố phân loại tuyệt đối.
- Test ảnh trước/sau bất đối xứng, khác padding/kích thước; hai decode hoàn thành ngược thứ tự; đổi phiên/undo khi đang decode; mọi đường mutate phải giữ nguyên model khi reject.
- Chạy `pnpm typecheck`, test mục tiêu và catalog tests; `pnpm mcp:schemas --check` sau đồng bộ.
- Kết quả bàn giao: contract + prompt từng mẫu + report baseline/validator, chưa tuyên bố mẫu 360° đẹp nếu phase 3 chưa hoàn thành.
