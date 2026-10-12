# Nhân vật cutout: tách bộ phận như búp bê để lắp ráp và diễn hoạt

## 1. Chọn đúng mẫu

Trong **Xưởng Lắp Ráp Layer → Mẫu lắp ráp → Nhân vật**, chọn **Búp bê 15 lớp — Tách đủ khớp tay & chân** (`tmpl-character-puppet-15`). Mẫu có sẵn ảnh vector minh họa, 15 xương và chuyển động đứng thở, bước đi gập gối, vẫy tay.

Cấu trúc tối thiểu để gập đủ khớp:

- Đầu (kèm tóc), thân (kèm đoạn nối cổ), hông: 3 lớp.
- Mỗi tay: bắp tay → cẳng tay → bàn tay: 6 lớp cho hai bên.
- Mỗi chân: đùi → cẳng chân → bàn chân/giày: 6 lớp cho hai bên.

Tổng cộng **15 lớp**. Bàn tay giữ nguyên năm ngón trong một ảnh; mẫu này không tách từng đốt ngón. Cổ nằm trong thân, không có slot cổ riêng. Quần áo được chia theo đoạn cơ thể, không dính xuyên qua khớp cần xoay.

Mẫu **13 lớp** vẫn được giữ cho tài nguyên cũ: chân liền, không có khớp gối độc lập. Các mẫu cũ khác có thể gộp bàn tay, giày hoặc phụ kiện theo slot; muốn tách đủ tay chân hãy dùng mẫu 15 lớp. Mẫu nam hiệp sĩ có 23 slot bao gồm các lớp hóa trang riêng.

## 2. Atlas chuẩn trong app: vuông 5×5

- Một PNG tỉ lệ **1:1**, độ phân giải theo khả năng model AI, lưới **5 cột × 5 hàng**.
- Chỉ cố định tỉ lệ và bố cục; không yêu cầu một số pixel cụ thể. Nếu chọn tỉ lệ khác như 16:9, phải thiết kế lại bố cục và bộ cắt tương ứng, không dùng trực tiếp sơ đồ ô của mẫu này.
- Số ô tính từ trái sang phải, trên xuống dưới. Không vẽ chữ, số hay đường kẻ lên ảnh.
- Mỗi ô chứa đúng một bộ phận. Không vẽ thêm nhân vật hoàn chỉnh trong atlas; ảnh tham chiếu gửi riêng.
- Phông xanh lá phẳng `#00FF00` cho mẫu búp bê; các mẫu khác dùng màu nền được chỉ định trong prompt.
- Dùng chung tỉ lệ pixel giữa mọi mảnh; chọn tỉ lệ theo mảnh lớn nhất, chừa lề sạch ít nhất 8% chiều rộng/cao ô ở mỗi cạnh. Không phóng to bàn tay để lấp đầy ô.

### Ánh xạ mẫu búp bê 15 lớp

Trái/phải luôn là **phía màn hình khi nhân vật đã lắp**, không phải trái/phải giải phẫu.

| Ô | Slot | Nội dung chính xác |
|---|---|---|
| 1 | `head` | Đầu, tai, mặt và tóc; không có thân |
| 2 | `torso` | Ngực, bụng, áo thân và đoạn nối cổ; không đầu, tay, hông |
| 3 | `pelvis` | Khối hông và thắt lưng; không đùi hoặc thân |
| 4 | `arm-l` | Bắp tay trái từ vai đến khuỷu, gồm tay áo |
| 5 | `forearm-l` | Cẳng tay trái từ khuỷu đến cổ tay, không bàn tay |
| 6 | `hand-l` | Bàn tay trái đủ năm ngón, chỉ thêm đệm cổ tay ngắn |
| 7 | `arm-r` | Bắp tay phải từ vai đến khuỷu, gồm tay áo |
| 8 | `forearm-r` | Cẳng tay phải từ khuỷu đến cổ tay, không bàn tay |
| 9 | `hand-r` | Bàn tay phải đủ năm ngón, không đạo cụ |
| 10 | `thigh-l` | Đùi trái từ hông đến gối, không cẳng chân |
| 11 | `shin-l` | Cẳng chân trái từ gối đến cổ chân, không giày |
| 12 | `foot-l` | Bàn chân và giày trái, đủ gót/mũi, đệm cổ chân ngắn |
| 13 | `thigh-r` | Đùi phải từ hông đến gối |
| 14 | `shin-r` | Cẳng chân phải từ gối đến cổ chân, không bàn chân |
| 15 | `foot-r` | Bàn chân và giày phải, không cẳng chân |
| 16–25 | — | Để trống, chỉ màu nền |

Ánh xạ này chỉ dành cho `tmpl-character-puppet-15`. Với mẫu khác, dùng danh sách ô của chính mẫu đó. Prompt trong app và MCP được sinh từ cùng danh sách slot tại [characterPrompt.ts](../../src/renderer/src/ui/layerAssembly/templates/characterPrompt.ts), tránh chỉ dẫn ô thừa hoặc hai bố cục mâu thuẫn.

## 3. Prompt dùng ngay cho mẫu búp bê 15 lớp

Prompt đầy đủ cập nhật theo mẫu nằm ở nút **Sao chép Prompt** hoặc MCP `get_layer_assembly_template`. Bản dưới đây dành riêng cho mẫu 15 lớp; có thể đổi dòng IDENTITY nhưng giữ nguyên bố cục và giới hạn từng bộ phận.

```text
Create ONE square (1:1 aspect ratio) PNG CHARACTER CUTOUT SPRITE ATLAS: a disassembled
flat 2D animation character, separated into paper-puppet layers. NOT a physical doll, toy or mannequin.
Use the image model's native output resolution; preserve the 1:1 aspect ratio.
IDENTITY: Adult hand-drawn cartoon, blue shirt, dark trousers, dark shoes,
belt, short hair. Clean outlines and flat cel shading.
If a reference is attached, preserve its identity, costume and proportions.
FRONT ORTHOGRAPHIC view. Every arm and leg segment is vertically upright: proximal joint centered at top, distal joint centered at bottom. No tilted, diagonal or bent limbs.
Flat OPAQUE green #00FF00 background. No perspective or foreshortening.

LAYOUT: exactly 5 columns x 5 rows. Cells numbered 1–25 left-to-right,
top-to-bottom for instructions only. Do not draw numbers, labels or grid lines.
Exactly 15 isolated parts. NO assembled reference character in the atlas.

CELL ASSIGNMENTS (left/right mean assembled SCREEN positions):
1. Head with hair and ears; NO torso.
2. Sleeveless shirt torso from chest to waist, short neck connector; NO sleeve stubs, shoulder caps, arms, head or hips. Shoulder edges stop at the armholes.
3. Pelvis and belt; NO torso, thighs or legs.
4. Screen-left upper arm, shoulder to elbow including sleeve; NO forearm or hand.
5. Screen-left forearm, elbow to wrist ONLY; NO upper arm, hand or fingers.
6. Screen-left complete hand, five fingers and short wrist tab; NO forearm or prop.
7. Screen-right upper arm, shoulder to elbow including sleeve; NO forearm or hand.
8. Screen-right forearm, elbow to wrist ONLY; NO hand or fingers.
9. Screen-right complete hand, five fingers and short wrist tab; NO forearm or prop.
10. Screen-left thigh, hip to knee ONLY; NO pelvis, shin or foot.
11. Screen-left shin, knee to ankle ONLY; NO thigh, foot, shoe or sole.
12. Screen-left foot inside its shoe, complete heel and toe, short ankle tab; NO shin.
13. Screen-right thigh, hip to knee ONLY; NO pelvis, shin or foot.
14. Screen-right shin, knee to ankle ONLY; NO foot, shoe or sole.
15. Screen-right foot inside its shoe, complete heel and toe, short ankle tab; NO shin.
16–25. EMPTY, background color only.

CONSTRUCTION:
Use ONE shared pixel scale. Choose it so the largest part INCLUDING joint tabs
fits with at least 8% of cell width/height as clear padding on every side.
Never enlarge small parts to fill cells. Parts must never touch cell boundaries
or each other. Keep full silhouettes, reconstruct areas hidden in the reference.
At shoulder, elbow, wrist, waist, neck, hip, knee and ankle joins, extend rounded
hidden caps by 10–15% of the shorter adjoining segment's length around the pivot.
The joint overlap is a flat rounded extension of the SAME material as the segment, not a separate peg. Pants must remain dark fabric through knees and ankles; shirt fabric through shoulders and waist. Never add skin-colored cylindrical connectors to clothed parts. Skin is allowed only where anatomically visible (head/neck, exposed forearm, hand). No socket holes,
exposed ball joints, pins, pivot markers or black transverse lines on hidden caps.
Clothing belongs to its own segment. No duplicated sleeves, cuffs, hands or shoes.
Joint caps overlap only AFTER assembly, never between atlas cells.

CLEAN EXTRACTION:
One complete isolated silhouette per assigned cell, natural holes allowed.
No neighboring fragments, detached specks, extra parts or duplicate views.
Crisp antialiased edges, no blur, glow, fringe, matte border or cast/contact shadow.
Background stays flat and uniform, including gaps between fingers.
No chroma-key green in the character, outlines, highlights or reflections. The entire canvas, including empty rows 4 and 5, must have opaque green background, not transparent or black.
Check all 15 cells for correct anatomy, complete hidden ends, consistent scale,
clear padding and clean separation. Redraw merged or contaminated parts.
```

## 4. Tách sạch và lắp đúng

1. Kiểm tra atlas trước khi cắt: đúng số mảnh, đúng ô, không dính tay vào thân hoặc giày vào cẳng chân. Nếu AI vẽ sai, yêu cầu vẽ lại ô lỗi; không trông chờ tách nền sẽ tự chia được các phần đã dính nhau.
2. Cắt theo lưới 5×5 của ảnh thực tế W×H: biên cột i = round(i×W/5), biên hàng j = round(j×H/5). Không giả định một kích thước pixel cố định hoặc kích thước chia hết cho 5. Loại nền chroma-key rồi xuất từng mảnh PNG RGBA. Giữ lỗ giữa các ngón; không xóa chi tiết thật vì nhầm là nhiễu.
3. Khử ám nền có kiểm soát ở viền. Kiểm tra trên cả nền sáng và tối: không viền xanh/hồng/trắng, không răng cưa lớn, không mất ngón tay hoặc tóc. Không dùng bộ khử xanh cho atlas nền hồng.
4. Gán đúng slot trong xưởng. Sau khi crop sát ảnh, giữ cùng tỉ lệ vật thể khi lắp; kích thước canvas PNG khác nhau không có nghĩa là phải scale mọi mảnh về cùng kích thước.
5. Đặt pivot tại tâm khớp trong phần chồng lấp, căn theo hình thực tế. Các transform/xương mẫu là điểm khởi đầu, không phải tọa độ đúng tuyệt đối cho mọi ảnh AI.
6. Kiểm tra thứ tự trước/sau ở vai, hông, tóc và phụ kiện. Xoay thử khớp ở 0°, ±30°, ±45° và phạm vi chuyển động dự kiến; chỉnh pivot, độ chồng hoặc vẽ bù nếu hở. Đệm 10–15% không bảo đảm kín ở mọi góc.

Muốn sửa riêng một ô: gửi ảnh tham chiếu và yêu cầu chỉ vẽ bộ phận của slot đó, cùng hướng nhìn, tỉ lệ, màu và đầu nối; không yêu cầu lại cả nhân vật. Kết quả AI vẫn cần kiểm tra bằng mắt.

## 5. MCP và CLI

Các tool hiện có dùng chung catalog với giao diện, không cần tool mới:

```bash
pnpm pxs call get_layer_assembly_template '{"template_id":"tmpl-character-puppet-15"}'
pnpm pxs call apply_layer_assembly_template '{"template_id":"tmpl-character-puppet-15","images":{"shin-l":"path/to/shin-l.png","foot-r":"path/to/foot-r.png"},"open_workshop":true}'
```

Có thể truyền khóa slot như `shin-l` hoặc khóa ô như `cell_11`. `apply_layer_assembly_template` gắn ảnh, xương và clips theo mẫu; không tự suy luận giải phẫu hoặc sửa viền PNG. Đường dẫn ảnh phải tồn tại trên máy chạy app. Lấy danh sách tham số bằng `pnpm pxs help apply_layer_assembly_template`.

## 6. Script 16:9 cũ không dùng cho atlas mới

[scripts/slice_atlas.py](../../scripts/slice_atlas.py) hiện chỉ phục vụ bố cục **16:9 cũ**, nhân vật tham chiếu bên trái và lưới **5×3 chứa 13 mảnh** bên phải, phông xanh. Script chưa hỗ trợ atlas vuông 5×5 hoặc mẫu búp bê 15 lớp; không chạy script này với prompt mới.

Với ảnh cũ đúng bố cục, script vẫn có thể tách và nạp mẫu `tmpl-character-articulated-13` bằng `--apply`. Phân đoạn connected components dựa vào số lượng/vị trí mảnh có thể nhận sai tóc rời, ngón tay rời hoặc mảnh dính nhau. Không có bảo đảm “sạch 100%”, “không bao giờ chạm mép” hoặc tự căn pivot chính xác. Luôn kiểm tra kết quả trước khi dùng.

## 7. Tách atlas 1:1 và bài thử thực tế

Dùng [scripts/slice_puppet_atlas.py](../../scripts/slice_puppet_atlas.py) cho đúng mẫu búp bê 15 lớp:

```bash
python -m pip install Pillow numpy
python scripts/slice_puppet_atlas.py path/to/atlas.png --out artifacts/puppet-test/parts
python scripts/test_slice_puppet_atlas.py
```

Script đọc kích thước thực tế, khử nền xanh và ám viền, giữ alpha nếu ảnh đã trong suốt, tìm các vùng liên thông rồi ánh xạ tâm vùng vào lưới 5×5. Nhờ vậy mảnh lấn nhẹ qua biên ô vẫn được lấy trọn. Nếu một ô có nhiều vùng lớn hoặc thiếu mảnh, script dừng để kiểm tra; không đoán giải phẫu. Chi tiết rời rất nhỏ có thể bị bỏ qua, vì vậy vẫn phải xem ảnh đối chiếu trước khi nhập.

Đầu ra gồm 15 PNG đặt theo slot, `manifest.json` ghi kích thước/vị trí nguồn và cảnh báo, cùng `contact-sheet.png` để kiểm tra trên nền sáng/tối. Script không tự mở app hoặc căn xương; gán ảnh và điều chỉnh bằng UI/MCP ở mục 5.

Bài thử ngày 12/10/2026 dùng công cụ tạo ảnh tích hợp, sau đó thao tác trực tiếp qua MCP trên app:

- Lượt đầu vẫn có tay áo dính thân, chi nghiêng; bổ sung yêu cầu thân dừng ở nách và chi thẳng trục dọc.
- Lượt tiếp theo đủ 15 mảnh nhưng có chốt da kiểu búp bê vật lý; sửa prompt và chỉnh ảnh AI để phần nối áo/quần tiếp tục bằng vải cùng màu.
- Ba mảnh lấn nhẹ biên ô được lấy trọn bằng vùng liên thông. Sau tách nền, kiểm tra từng PNG trên cả nền sáng và tối.
- Gắn đủ 15 PNG vào `tmpl-character-puppet-15`, chỉnh scale từng mảnh do AI chưa giữ đúng tỉ lệ chung, căn chồng ở eo/gối/cổ chân và lật ngang giày trái cho hướng mũi giày phù hợp. Các PNG gốc và atlas được giữ lại để đối chiếu.
- Kiểm tra bố cục 2D/3D và hai pha bước đi trong app; lưu mẫu **Búp bê AI — Kiểm thử atlas theo tỉ lệ** vào thư viện. Các file thử được lưu cục bộ trong `artifacts/puppet-test/` (không commit media thử nghiệm).

Kết quả cho thấy cần vòng lặp **tạo → kiểm tra → sửa ảnh/prompt → tách → căn khớp → thử chuyển động**. Prompt không bảo đảm chỉ một lượt tạo là có nhân vật hoàn chỉnh; không coi việc đủ 15 file là bằng chứng khớp đã kín ở mọi động tác.
