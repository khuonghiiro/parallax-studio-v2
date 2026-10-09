# Phase 2 — Lõi biến dạng và đồng bộ tới cảnh/video

Status: pending · Priority: P1 · Depends on: 1 · Estimate: 16–24h. Scout lại toàn luồng trước code.

## Hướng thiết kế

- [ ] Kiểu serializable `ImageMeshDefinition` có version, base surface, UV, topology recipe, anchor/mask, ordered modifiers và vật liệu trước/sau. Đặt tại `src/shared/`; không lưu THREE objects hoặc function trong project.
- [ ] Tách engine khỏi UI: `engine/imageMesh/buildBaseMesh.ts`, `evaluateDeformation.ts`, `modifierTypes.ts`, `deformPrimitives.ts`, `deformCurve.ts`, `deformLattice.ts`, `deformBrush.ts`. Mỗi module một trách nhiệm, tuân thủ giới hạn file/hàm.
- [ ] Giữ legacy evaluator cho dữ liệu cũ để không đổi hình âm thầm. Migration explicit, idempotent và có test golden. Giữ các bend/depth/arc hiện hành qua adapter; không áp lặp hai lần.
- [ ] Pipeline cố định: base rest-domain + registered alpha → topology → ordered static modifiers → timeline motion → seam/root constraints → optional thickness → face/model transform. Recompute normals/bounds cho cả preview lẫn motion/export. Chỉ cho reorder hợp lệ, cùng input/time luôn ra cùng output.
- [ ] Tách `restUV` dùng cho pin/stroke/lattice với `textureUV` và phép căn ảnh để lấy màu. Xoay/lật/crop texture không đổi rest-domain; không dùng UV đã clamp làm phép nghịch đảo. Đổi topology/density phải remap theo rest-domain, báo phần edit rơi ngoài alpha mới. Test căn ảnh xoay 45°, lật, crop và đổi density giữ điểm ghim/cọ.
- [ ] Chuẩn hóa root pin: toàn bộ modifier dùng cùng weight mask. Bend/Twist đổi vị trí XYZ, không chỉ cộng Z. Curve deform dùng frame dọc đường cong có kiểm soát twist; hạn chế tình huống tangent bằng 0.
- [ ] Lồi/lõm theo normal cục bộ hoặc trục người dùng chọn; cho cả dấu âm/dương, bán kính và falloff. Smooth dựa adjacency, giữ biên/UV seam/root pins. Crease không làm đổi UV hoặc topology ngoài chủ đích.
- [ ] Stroke lưu UV samples/pressure/radius/world-vs-local direction/seed; replay từ base có thứ tự xác định. Không lưu index vertex không ổn định làm khóa lâu dài. Lattice dùng tọa độ rest-space, không kéo giãn texture UV.
- [ ] Recompute normals/bounds sau thay đổi; shared seam vertices không nứt; riêng UV seam giữ bản sao UV nhưng vị trí khớp. Kiểm tra triangle area và hữu hạn; tránh singularity khi arc gần 360°/radius 0.
- [ ] Thay cơ chế local cell dịch Z bằng influence field liên tục; không dùng extraZ trong khóa topology để nhân đôi biên cọ. Chứng minh vertices ngoài bán kính không đổi, pins bất động và biên vùng tác động không nứt. Legacy cell edit giữ qua adapter, không tự diễn giải lại khác hình.

## Lưu, chèn và render (bắt buộc cùng phase)

- [ ] `types.ts`, `models3dStorage.ts`, main `asset3ds.ts`, `src/shared/types.ts`, project JSON parse/serialize/validate đều giữ cấu hình. Tách hình học khỏi ảnh; ảnh mới dùng asset ID nội bộ thay data URL lớn lặp trên từng face.
- [ ] `insertModel3D.ts` chuyển mesh definition, scale, opacity, material/alpha và cấu hình motion; dùng một transaction lịch sử cho cả model. Nếu thiếu ảnh thì báo và rollback hoặc trả failure rõ, không âm thầm biến thành mặt Solid thành công.
- [ ] Engine layer mesh tạo đúng geometry dùng chung với xưởng; camera view và export dùng cùng evaluator/time. Texture resolving nhất quán cho built-in, asset-3ds, project assets, ảnh nhập/data URL.
- [ ] Rà cụ thể `engine/layerNodes.ts` (UNIT_PLANE), `engine/renderTypes.ts`, `export/runExport.ts`, `LayerModel3DRef` trong shared types và layer cache/signature. Model library JSON hiện đã giữ full face fields; không viết lại persistence đang hoạt động nếu chưa có lý do.
- [ ] Bổ sung cache key gồm topology/UV/ảnh alpha/modifier version; texture đổi làm rebuild topology có kiểm soát. Hủy GPU buffers cũ; không rebuild toàn model mỗi pointermove nếu chỉ một mặt đổi.
- [ ] Insert theo prepare assets → validate project/shot/revision → commit một lần. Blob runtime nằm ngoài undo state: định nghĩa ownership/refcount riêng, thu hồi đúng blob mới chưa dùng khi thất bại, giữ bytes cần cho redo và asset dùng chung. Test lỗi ảnh thứ N, đổi project/xóa shot khi await, undo/redo sau thành công.
- [ ] Thiết lập ngân sách tổng ngay trong lõi: triangles/face/model/scene, decoded texture bytes, stroke samples × affected vertices, snapshot history và decode queue. Prototype đo rồi chốt con số trước merge phase 2. Payload từng trường hợp lệ nhưng tổng chi phí vượt budget phải reject hoặc đề nghị giảm chất lượng có chủ đích trước mutate.
- [ ] Time của motion là scene-time xác định, không lấy thời gian mở viewport. Model-local constraints group nối shared boundary samples giữa các face; root pins và seam giữ cả sau motion. Giữ normal smoothing/winding theo material trước/sau và cạnh thickness.

## Gate

Fixture: cánh cong + xoắn, mặt lõm, calla wrap thí điểm, lá có lỗ alpha, scale không đều, model legacy. So sánh mesh positions/UV/indices trong xưởng và engine ở cùng scale/time; sai số vị trí <=1e-4 đơn vị local trước lượng tử hóa JSON. Anchor <=0.5 đơn vị model; legacy goldens không đổi.

Save/reopen → insert → serialize/reload → render PNG/MP4 vẫn giữ hình. Kiểm tra ảnh không bị thay bằng solid, normal hai phía, opacity và crop. Undo chèn xóa đủ layer và asset reference liên quan. Missing/corrupt assets trả lỗi có thể xử lý, không partial success không rõ.

Motion gate tại t=0, giữa và cuối chu kỳ; scrub lùi, export frame đảo thứ tự, đóng/mở xưởng cùng scene-time phải khớp geometry/normals/bounds. Budget gate gồm nhiều model, 100 gesture undo/redo, ảnh thay liên tiếp; RAM/GPU trở về mức ổn định sau khi đóng xưởng.

Chạy `pnpm typecheck`, tests engine/serialization/insertion/MCP và `pnpm build`. Nếu sửa main/preload, báo người dùng tự restart; không kill app hoặc spawn dev instance mới.
