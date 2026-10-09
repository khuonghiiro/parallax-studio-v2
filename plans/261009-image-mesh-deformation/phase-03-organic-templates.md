# Phase 3 — Hoa, loa kèn, calla và cỏ 360°

Status: pending · Priority: P1 · Depends on: 1, 2 · Estimate: 12–20h. Scout generator hiện hành trước khi thay.

## Tổ chức

Tách catalogue `imageMeshTemplates.ts` đang lớn thành `templates/imageMeshFlowers.ts`, `imageMeshLilies.ts`, `imageMeshGrass.ts`, `imageMeshPlantParts.ts`, cùng geometry generators trong `engine/imageMesh/`. Giữ template ID cũ; thêm `mesh-calla-lily`. Lưu `recipeVersion` vào model; không rebuild model đã lưu chỉ vì catalogue thay đổi.

## Hoa thường

- [ ] Tham số petal count/layers/open angle/cup depth/edge curl/twist/length/width. Đài và tâm thật, thân tròn hoặc ống textured; không chỉ một tấm thân khi nhìn ngang.
- [ ] Petal là surface có centerline và width profile; phần cuống có vùng pin. Cánh xếp lớp có phase offset, không z-fighting, không trùng lặp texture pattern cứng; có seed cố định cho biến thiên nhẹ.
- [ ] Mặt sau cánh có material rule, có thể chọn texture riêng. Đài che nối gốc nhưng không dùng để che một lỗi anchor lớn.

## Loa kèn sáu cánh

- [ ] Dựng từ trục trung tâm + tiết diện radius theo chiều dài, 6 sector cánh, họng hẹp nối thân, miệng mở và đầu cánh recurved. Ống họng hình học thật, có lòng trong; độ cong không chỉ là sáu panel nghiêng.
- [ ] Phân biệt vùng fused throat và vùng cánh rời; seam thân họng khớp theo góc và cao độ. Curve ở đầu cánh giữ điểm gốc. Thêm nhị tỏa 3D có cuống/đầu nhị thay cho chỉ một silhouette chùm phẳng ở chế độ chất lượng cao.
- [ ] Quyết định nối: các sector họng có shared boundary samples trong một deformation group, xử lý constraints ở model-local space sau static edit và motion; bảo đảm C0 và smooth normals tại vùng fused. Gốc cánh nối cùng vành throat; phần cánh rời không bị ép weld với nhau. Group cần được serialize và chuyển nguyên vẹn khi insert.
- [ ] Tham số: throat radius, length, mouth radius, axis tilt, opening angle, tip curl, asymmetry nhỏ. Biến thể regenerate cấu trúc và anchor, không scale width/height độc lập rồi giữ normal cũ.

## Rum / Calla — mẫu riêng đã được người dùng chọn

- [ ] Một cánh mo bất đối xứng trải phẳng → wrap quanh trục theo v; vùng gốc cuộn nhiều, mép trên mở rộng và một đầu nhọn cao. Đường chồng mép có điều khiển, không nhân sáu cánh.
- [ ] Dùng centerline + cross-section/wrap profile để tạo mặt cong liên tục; xác định seam và vùng overlap, tránh mặt đồng phẳng/z-fighting. UV theo ảnh phẳng từ phase 1.
- [ ] Nhụy spadix dạng trụ thuôn với texture riêng và thân thể tích. Các biến thể: mở nhẹ, cuộn chặt, miệng xòe, nghiêng; tất cả cùng root anchor.

## Bụi cỏ 360°

- [ ] Đơn vị là blade gốc tương đối thẳng; mọi dáng rủ/S/xoắn được tạo bằng curve/modifier. Polygon preview và alpha ảnh không được thay đổi quy luật dáng.
- [ ] Phân bố quanh tâm với seed cố định, mật độ, bán kính gốc, 2–3 tầng chiều cao, lean hướng ra ngoài. Test dấu vector radial để tránh mọi phiến nghiêng vào tâm ngoài chủ đích.
- [ ] Root vùng thấp ghim; curve tip mềm; tham số curl/twist/width taper và biến thiên màu nhỏ. Cho dùng nhiều ảnh blade nhưng mỗi ảnh có tỷ lệ/anchor riêng.
- [ ] Giữ `mesh-grass` dạng billboard cũ, ghi nhãn rõ; `mesh-grass-radial` phải có leaf volumes/surfaces phân bố 3D thực. Số blade không dùng để hứa che hết mọi góc nếu cấu trúc vẫn phẳng.

## Gate hình học và hình ảnh

- Bộ fixture ảnh phẳng có đánh dấu UV dùng trong test; ít nhất một bộ ảnh alpha thật, giữ ghi chú quyền sử dụng.
- Render contact sheet 8 phương vị (45°/bước) × 3 góc cao (0°,30°,60°), thêm góc dưới cho hoa; test từng variant và ít nhất hai bộ texture/mẫu.
- Gốc cánh/blade cách anchor <=0.5 đơn vị; fused throat không có khe >0.5 đơn vị trong miền tham số hỗ trợ. Không yêu cầu cánh hoa rời phải welded với nhau ở đầu.
- Test nở/cụp cực trị, bend âm/dương, width/height cực trị, seed deterministic, seam UV, không NaN, không tam giác suy biến ngoài ngưỡng.
- Test khe seam và root ở nhiều thời điểm gió, sau cọ trên một sector và sau đổi thứ tự modifier; không chỉ kiểm tra tư thế nghỉ.
- Kiểm tra hình mẫu đúng khi chưa gắn ảnh và sau khi gắn ảnh; model cũ không đổi. Xem lại xưởng/camera/export cho cùng fixture.
- Chưa đạt review hình ảnh thì không đánh dấu xong dù unit tests đã qua.
