# Prompt tách nhân vật thành bộ phận để rig 2D / 2.5D

Đính kèm ảnh nhân vật gốc, rồi dùng prompt bên dưới. Nếu nhân vật có bất đối xứng (sẹo, hoa tai, giáp một bên), trái/phải luôn tính theo **nhân vật**, không theo người xem. Ảnh chính diện: tay trái nhân vật ở bên phải người xem.

Bản này dùng **phông màu phẳng để tách nền sau**, không yêu cầu AI xuất alpha sẵn. Đặt `[BACKGROUND_COLOR]` thành một màu ít trùng với nhân vật, ví dụ `#00FF00` (xanh lá), `#FF00FF` (hồng tím) hoặc `#00FFFF` (cyan). Nếu chưa chọn, thay bằng `AUTO — select the least-conflicting color from the reference`. Kiểm tra cả mắt, trang sức, hoạ tiết nhỏ và vùng bắt sáng trước khi chọn.

## Chọn đúng bộ phận và góc nhìn trước khi tạo

Để vẫy tay và bước đi có gập gối, cần **15 bộ phận chuyển động chính**: đầu, thân, hông; mỗi tay gồm bắp tay + cẳng tay + bàn tay; mỗi chân gồm đùi + cẳng chân + bàn chân. Cổ và hai lớp tóc bổ sung thành 18 ảnh trong atlas này. Không dùng mẫu **13 lớp** có chân liền để đánh giá gập gối: mẫu đó không có xương cẳng chân riêng.

- **Chính diện:** phù hợp vẫy tay, đứng thở và bước tại chỗ hướng về camera. Chuyển động trong mặt phẳng ảnh chỉ là cách diễn đạt 2D; không tái tạo đầy đủ chân đưa ra trước/sau trong chiều sâu.
- **Nghiêng:** nếu mục tiêu là nhân vật đi ngang, tạo một atlas nghiêng riêng, tất cả bộ phận cùng hướng. Giữ nguyên số ô nhưng thay đoạn VIEW AND REST POSE bằng biến thể dưới. Không trộn giày nghiêng với thân chính diện.
- **3/4:** cần atlas 3/4 riêng; thay preset góc nhìn không tự vẽ lại mặt khuất của nhân vật.

Ảnh nguồn phải là **tư thế nghỉ**, không phải ảnh đang bước. Chuyển động được tạo bằng xương sau khi ráp. Đồ bó vừa người và quần dài đơn giản dễ kiểm tra hơn váy dài, áo choàng hoặc giáp che kín đầu gối.

```text
SIDE-VIEW VARIANT — replace VIEW AND REST POSE only:
Use a consistent RIGHT-FACING SIDE ORTHOGRAPHIC view for EVERY part.
Draw complete near and far limbs separately, in a neutral straight rest pose,
not a walking pose. Shoes must show the full heel, sole and toe in profile.
Keep the same 5x5 cell assignments and anatomical left/right identity.
Reconstruct hidden surfaces; never omit the far arm or far leg.
```

## Prompt atlas chính diện

```text
Use the attached character image as the strict identity and design reference.
Create ONE high-resolution CHARACTER CUTOUT SPRITE ATLAS for 2D skeletal / 2.5D animation.

IDENTITY AND STYLE
Preserve the original character's face, apparent age, proportions, hairstyle, outfit, colors, material rendering and illustration style. Keep all asymmetrical details on the correct anatomical side. Do not redesign the character or add equipment.

VIEW AND REST POSE
Use a consistent FRONT ORTHOGRAPHIC view, without perspective or foreshortening. Neutral relaxed rest pose, torso upright, upper arms and forearms pointing downward, legs straight. Hands in a relaxed neutral pose; feet facing forward with matching perspective. Use identical light direction, edge treatment and detail density on every part. If the reference is posed or partly obscured, reconstruct the missing anatomy and clothing consistently.

OUTPUT
One square PNG atlas, ideally 4096 x 4096 if supported, on an OPAQUE, SOLID COLOR BACKGROUND for later chroma-key removal. Exactly 5 columns x 5 rows of equal cells. No visible grid, text, labels, watermark, checkerboard, ground plane, or cast shadows outside each part. One isolated part per cell. Keep generous background-colored gutters; no part may touch another part or cross a cell boundary.

CHROMA-KEY BACKGROUND — CRITICAL
Background color: [BACKGROUND_COLOR].
If set to AUTO, inspect the entire reference, including small details, eyes, jewelry, clothing patterns, highlights and edge colors. Choose ONE saturated key color that is absent from, and clearly separated in hue from, the character's colors. Consider pure green #00FF00, magenta #FF00FF or cyan #00FFFF; use another distinct color if all three conflict. Do not choose green automatically when the character contains green. Preserve the character's original colors; change the background choice instead of recoloring the character.

Use exactly the SAME flat background color across the entire atlas, all unused cells, gutters, and all genuinely empty openings between fingers, hair locks and accessories. No gradients, texture, noise, vignette, background lighting, shadows, reflections, glow or colored light spill onto the character. Background color must not appear as painted details inside an opaque body part. Do not simulate transparency with a checkerboard or remove the background in this generation.

EDGE TREATMENT
Preserve the original outline style. If the reference has black outlines, retain clean, consistent dark outlines along the exterior silhouettes. Do not add thick black borders, white sticker borders or outlines across joint overlaps. If the reference has no outlines, preserve its original edge treatment. Keep fine details clearly separated from the key color; avoid blurred edges, colored halos and semi-transparent glow. Preserve necessary hair detail without blending broad areas into the background.

COMMON SCALE — CRITICAL
All parts must use ONE COMMON PIXEL SCALE matching the reference character's body proportions. Do NOT enlarge hands, feet, eyes or accessories to fill their cells. A hand must remain the correct size relative to its forearm; a foot must remain the correct size relative to its lower leg. Fit the largest part first, then apply the same scale to all other parts. Keep paired limbs equal in anatomical length. Do not stretch parts independently. Preserve each part's intended orientation.

MODULAR FILM DISGUISE & ACTOR PROPS PRINCIPLE (CRITICAL):
1. BARE BASE HEAD (Cell 1): Must draw a completely clean, bare face (eyes, nose, mouth, ears, forehead). NEVER bake a beard, glasses, mask, or hat into the base face. The face acts as an unadorned actor base.
2. DISGUISE ACCESSORIES (Cells 5, 10, 15, 20):
   - Cell 5 (HAT / HELMET): Isolated headwear with hollow space matching the head crown.
   - Cell 10 (DETACHABLE BEARD / MUSTACHE): Isolated facial hair prop aligning precisely with the chin and upper lip of Cell 1.
   - Cell 15 (DISGUISE MASK / BANDANA / VISOR): Isolated face mask covering lower face or eyes.
   - Cell 20 (EYEWEAR / GLASSES): Isolated spectacles/sunglasses matching the interpupillary distance of Cell 1.
3. SEPARATED 3-SEGMENT LIMBS:
   - Forearms (Cells 11, 12) must NOT have hands. Extend wrist with 10-15% rounded joint overlap.
   - Hands (Cells 13, 14) are independent sprites with 5 fingers and rounded wrist caps for independent wrist rotation.
   - Shins / Lower Legs (Cells 18, 19) must NOT have feet or shoes. Extend ankle with 10-15% rounded joint overlap.
   - Feet / Boots / Shoes (Cells 21, 22) are independent sprites with rounded ankle caps for ankle pivoting.
4. MOVIE PROPS & CAPE (Cells 24, 25): Handheld sword/prop in Cell 24, flowing back cape in Cell 25.

EXACT CELL LAYOUT, left to right, top to bottom:
Row 1:
1. Head / face (bare clean face, ears, forehead; NO hair, hat, beard, glasses, mask or neck).
2. Neck, including concealed upper and lower joint overlap.
3. Back hair mass, complete silhouette behind the head; NO face or head skin.
4. Front hair / bangs / wig, isolated; NO face skin.
5. Hat / helmet / headwear prop, isolated and complete; empty cell filled only with background color if absent.

Row 2:
6. Torso / chest / cuirass / clothing body, shoulder to waist; NO neck, head, arms or pelvis.
7. Pelvis / hip garment / armored belt, waist to upper-leg attachment; NO legs.
8. Anatomical LEFT upper arm: shoulder to elbow, with its sleeve or armor.
9. Anatomical RIGHT upper arm: shoulder to elbow, with its sleeve or armor.
10. Detachable fake beard / mustache prop aligning with chin and mouth; empty cell if absent.

Row 3:
11. LEFT forearm: elbow to wrist; NO hand.
12. RIGHT forearm: elbow to wrist; NO hand.
13. LEFT complete hand / gauntlet / glove with all five fingers and rounded wrist overlap; NO forearm.
14. RIGHT complete hand / gauntlet / glove with all five fingers and rounded wrist overlap; NO forearm.
15. Costume disguise mask / face visor / bandana prop covering lower face or eyes; empty cell if absent.

Row 4:
16. LEFT thigh: hip to knee, with clothing / armor.
17. RIGHT thigh: hip to knee, with clothing / armor.
18. LEFT lower leg / shin / greave: knee to ankle; NO foot or shoe sole.
19. RIGHT lower leg / shin / greave: knee to ankle; NO foot or shoe sole.
20. Eyewear / glasses / sunglasses / spectacles prop matching eye placement; empty cell if absent.

Row 5:
21. LEFT foot / shoe / sabaton boot: complete ankle-to-toe-and-heel part with rounded ankle overlap; NO lower leg.
22. RIGHT foot / shoe / sabaton boot: complete ankle-to-toe-and-heel part with rounded ankle overlap; NO lower leg.
23. Shoulder armor pad / collar / cape attachment lock if present; otherwise empty cell.
24. Handheld movie prop / weapon (sword, briefcase, cane, blaster) matching hand grip; empty cell if absent.
25. Flowing back cape / cloak / coat tail if present; otherwise empty cell.

JOINTS AND OCCLUDED SURFACES — CRITICAL FOR ANIMATION
Draw complete body parts, including surfaces hidden by neighboring parts in the assembled character. Extend shoulder, elbow, wrist, hip, knee, ankle and neck connections with rounded covered ends, approximately 10–15% of that segment's length. These ends must overlap under adjacent artwork when rigged. Never cut exactly at the visible seam or leave a hollow gap. No dark cut lines, black end caps, exposed cross sections or hard outlines across a joint. Keep outlines only where the finished assembled silhouette needs them.

Hands and feet MUST be independent sprites so wrists and ankles can rotate separately. Do not fuse a hand into a forearm or a shoe into a shin. Keep hair separate from face, and hat separate from hair. Where hair locks are separate, the base hair must still provide sufficient hidden overlap. Avoid duplicate visible details across overlapping parts.

ARTICULATION READINESS
Each upper arm has a shoulder cap and an elbow cap; each forearm has an elbow cap and a wrist cap. Each thigh has a hip cap and a knee cap; each shin has a knee cap and an ankle cap. Center the intended joint inside the rounded overlap, not at its outermost cut edge. Keep joint clothing colors continuous across neighboring parts. Draw enough concealed material for an elbow or knee to bend without exposing the background. Keep cuffs, knee armor and shoe collars away from the rotating seam when possible. Hands rotate as whole hands; shoes rotate as whole feet. This atlas does not contain finger joints or separate toe/heel sprites. Do not bake motion blur, bent walking poses, contact shadows or perspective shortening into the source parts.

CHECK BEFORE FINALIZING
Exactly one part in each specified occupied cell. Correct left/right anatomy and asymmetry. Consistent scale and front view. No missing fingers or duplicated limbs. No clipped part. One uniform, opaque chroma-key background color, including unused cells and empty openings. No key-color spill, blurred fringe or white halo around the parts. No assembled character preview inside the atlas. The result must be usable as a practical cutout animation source, not just a decorative character breakdown poster.
```

## Lưu ý khi tách nền

- Viền đen không tự bảo đảm tách sạch: màu phông vẫn phải khác màu chi tiết. Không thêm viền đen ở mặt cắt khớp vì khi ráp có thể lộ đường nối.
- Cần tách cả vùng phông kín giữa các ngón tay, lọn tóc và phụ kiện, không chỉ vùng nối ra mép ảnh.
- Sau khi tách nền, kiểm tra trên cả nền sáng và tối, xử lý viền nhiễm màu phông nếu còn, rồi lưu PNG có alpha thật. Không xoá các chi tiết nhân vật chỉ vì chúng gần màu phông.
- Với tóc mảnh, vải xuyên thấu hoặc chi tiết gần màu phông, có thể cần chỉnh mask thủ công; prompt không bảo đảm tách nền sạch chỉ bằng một ngưỡng màu.

## Khi muốn rig ngón tay hoặc biểu cảm

- Prompt trên tách **cả bàn tay** để xoay cổ tay, chưa tách từng đốt ngón. Để cử động ngón tay, tạo thêm atlas bàn tay lớn riêng với lòng bàn tay và từng đốt ngón; giữ đúng tỉ lệ giữa các đốt.
- Đầu/khuôn mặt ở ô 1 là một sprite. Nếu cần chớp mắt/nói chuyện, yêu cầu thêm atlas biểu cảm riêng: mặt nền, mắt trái/phải, lông mày trái/phải, các dáng miệng. Không ép tất cả vào 25 ô hiện tại.
- Tóc dài muốn uốn nhiều khớp có thể dùng một sprite tóc đầy đủ và skin mềm; tóc tách khúc cần các đầu chồng lấp.
- AI tạo ảnh có thể lệch ô hoặc tỉ lệ dù đã mô tả. Kiểm tra atlas thực tế rồi căn khớp khi nhập; prompt không tự sinh điểm pivot, xương hoặc trọng số skinning.

## Quy chuẩn tách lớp hoá trang đóng phim (Modular Film Disguise & Costume Props)

### 1. Triết lý "Diễn viên cơ sở & Đạo cụ trường quay"
Trong kỹ thuật dựng hoạt ảnh 2.5D của Parallax Studio, nhân vật dạng người được tổ chức tương tự như một diễn viên điện ảnh thật:
- **Khuôn mặt mộc (`head`)**: Luôn được vẽ mộc, sạch sẽ, không nướng (bake) sẵn râu, kính mắt, mũ nón hay mặt nạ.
- **Đạo cụ hoá trang (Disguise Kit)**:
  - **Mặt nạ (`mask`)**: Mặt nạ che nửa mặt, visor kim loại, hoặc khăn bandana hoá trang.
  - **Kính mắt (`glasses`)**: Kính râm, kính cận gọng kim loại hoặc kính bảo hộ, đặt khớp đúng khoảng cách hai mắt.
  - **Râu giả (`beard`)**: Râu quai nón, râu mép, râu bạc dài, đặt khớp chính xác vị trí môi trên và cằm.
  - **Mũ nón (`hat`)**: Mũ phớt, mũ len, mũ cối hoặc mũ sắt hiệp sĩ với lòng mũ rỗng khớp với vòm đầu.
  - **Áo choàng (`cape`)**: Áo choàng sau lưng tạo chiều sâu z-index.
  - **Đạo cụ cầm tay (`prop-weapon` / `prop-hand`)**: Kiếm, súng, vali tài liệu, gậy ba toong, gắn trực tiếp vào xương bàn tay phải (`bone-hand-r`).

### 2. Ưu điểm vượt trội khi diễn hoạt & thay vai diễn
- **Tái sử dụng một khung xương rig duy nhất**: Cùng một diễn viên nam có thể hoá thân thành sát thủ đeo mặt nạ bí ẩn, quý ông lịch lãm đeo kính, cụ già râu tóc bạc phơ hoặc hiệp sĩ giáp sắt chỉ bằng cách bật/tắt (ẩn/hiện) layer tương ứng.
- **Tách rời 3 khúc tay & chân (Bàn tay & Bàn chân độc lập)**:
  - Bắp tay (`arm`) -> Cẳng tay (`forearm`) -> Bàn tay (`hand`): Cho phép xoay cổ tay độc lập (vung kiếm, bấm điện thoại, vẫy tay chào) mà không làm vặn méo cẳng tay.
  - Đùi (`thigh`) -> Cẳng chân (`shin`) -> Bàn chân (`foot` / giày / ủng): Cho phép xoay cổ chân độc lập khi bước đi, nhón chân hoặc tiếp đất vững chắc.
- **Chỉnh trong đúng phiên lắp ráp**: dùng `update_layer_assembly_layer` để thay ảnh/transform trong bản nháp và `layer_assembly_rig` để gắn xương, đặt key. `update_layer` dành cho layer của dự án sau khi chèn, không thay thế lệnh chỉnh bản nháp xưởng.

## Ráp ảnh và đặt xương trong Xưởng lắp ráp layer

1. Tách màu phông thành alpha thật rồi cắt từng ô; bỏ ô trống. Giữ bảng tên ảnh → số ô và kích thước/crop của từng ảnh. Không tự phóng mỗi ảnh cho đầy ô: việc này phá tỉ lệ chung. Nếu trim phần trong suốt, phải căn lại vị trí tâm ảnh khi ráp.
2. Tạo bản lắp ráp mới, đặt đầu–cổ–thân–hông trước, rồi hai tay và hai chân. Hai đế giày cùng cao độ ở tư thế nghỉ. Tóc sau ở sau đầu; tóc trước ở trước đầu; cổ nằm dưới đầu/thân. Trong xưởng, Z nhỏ hơn nằm phía trước.
3. Chọn khung `humanoid` có 15 xương hiện tại, kiểm tra có đủ `arm`, `forearm`, `hand`, `thigh`, `shin`, `foot` ở cả hai bên. Đặt **Edit Mode**, tắt phát và căn xương theo ảnh thực tế, không dùng nguyên tọa độ preset khi ảnh khác tỉ lệ.
4. Head của bắp tay ở vai, tail ở khuỷu; head cẳng tay trùng khuỷu, tail ở cổ tay; head bàn tay ở cổ tay. Tương tự: hông → gối → cổ chân → bàn chân. Các điểm nối nằm trong vùng chồng lấp. Tọa độ xưởng có X sang phải, Y xuống dưới; góc dương quay theo chiều kim đồng hồ.
5. Gắn từng ảnh vào đúng xương bằng `binding_mode: "rigid"`. Ảnh tóc đi theo đầu; hông là root; thân là con hông; đầu và hai bắp tay là con thân; hai đùi là con hông. Không gắn toàn bộ tay vào xương bắp tay nếu muốn gập khuỷu riêng.
6. Chuyển Pose Mode để thử khuỷu/gối trước, rồi cổ tay/cổ chân. Nếu hở khớp: sửa vị trí pivot, độ chồng ảnh hoặc ảnh nguồn. Không kéo dài xương theo từng frame để che lỗi. `soft` dành cho ảnh cần uốn liên tục như tóc/vải; không bắt buộc cho cutout tay chân rời.
7. Sau khi căn hoặc đổi chiều dài xương, sinh lại clip để chuyển động khớp rig mới. Lưu bản lắp ráp riêng, kiểm tra Undo/Redo và mở lại bản đã lưu trước khi chèn vào dự án.

### Ánh xạ trái/phải: không suy ra từ hậu tố tên

Prompt này dùng **trái/phải giải phẫu**. `templateBuilder.ts` và khung humanoid hiện tại dùng **trái/phải màn hình** (`bone-*-l` nằm ở X âm). Với atlas chính diện theo prompt này, ánh xạ như sau:

| Bộ phận | Ô bên trái cơ thể → xương bên phải màn hình | Ô bên phải cơ thể → xương bên trái màn hình |
|---|---|---|
| Bắp tay | 8 → `bone-arm-r` | 9 → `bone-arm-l` |
| Cẳng tay | 11 → `bone-forearm-r` | 12 → `bone-forearm-l` |
| Bàn tay | 13 → `bone-hand-r` | 14 → `bone-hand-l` |
| Đùi | 16 → `bone-thigh-r` | 17 → `bone-thigh-l` |
| Cẳng chân | 18 → `bone-shin-r` | 19 → `bone-shin-l` |
| Bàn chân | 21 → `bone-foot-r` | 22 → `bone-foot-l` |

`apply_layer_assembly_template.images` nhận **ảnh đã cắt riêng**, không tự cắt atlas hoặc xoá nền. Dùng ID slot tường minh khi phải đổi bên; `cell_8` chỉ là khóa ánh xạ ô của template. Đọc `get_layer_assembly_template` trước vì các mẫu không dùng chung toàn bộ sơ đồ 25 ô.

## Làm chuyển động tay mượt

- Vẫy tay: nâng bắp tay tới tư thế chào trước, gập khuỷu, sau đó lắc cẳng tay và cổ tay nhẹ. Thân và đầu phản ứng nhỏ; không xoay cả tay cứng như thanh gỗ.
- Tạo độ trễ nhỏ giữa vai → khuỷu → cổ tay; giảm tốc ở điểm đổi hướng. Thử khoảng 1,8 giây cho một chu kỳ rồi điều chỉnh theo nhân vật; đây là giá trị khởi đầu, không phải quy chuẩn cố định.
- Dùng clip `wave` riêng để kiểm tra; `walk` và `wave` là hai clip, không mặc nhiên được cộng chuyển động lên nhau. Muốn vừa đi vừa vẫy cần một clip chứa track chân của walk và track tay đã biên tập.
- Bàn tay trong atlas chỉ xoay nguyên khối. Preset `hand-clench` cần rig/ảnh ngón tay thích hợp; thêm xương ngón vào một ảnh bàn tay gắn cứng không tự tạo động tác nắm tay.

## Chân cử động thế nào để bước đi mượt?

Một chu kỳ gồm **hai bước**, hai chân lệch nhau nửa chu kỳ. Với thử nghiệm đi ngang 1,6 giây, dùng các mốc dưới như hướng dẫn dựng pose; không coi đây là cam kết preset hiện tại tự đạt tiếp đất chính xác.

| Pha | Thời điểm tham khảo | Chân và thân |
|---|---|---|
| Contact | 0,0 s | Gót chân trước vừa chạm đất, mũi chân sau còn đẩy; tay đối bên đưa trước. |
| Down | 0,2 s | Chân trước nhận trọng lượng, gối chùng nhẹ, bàn chân đặt phẳng; hông hạ một ít. |
| Passing | 0,4 s | Chân trụ đỡ người; chân lăng gập gối đi qua, mũi chân đủ cao để không quệt đất. |
| Up | 0,6 s | Hông nâng nhẹ; chân lăng mở gối chuẩn bị tiếp đất, chân trụ bắt đầu đẩy bằng mũi. |
| Contact đổi bên | 0,8 s | Hai chân và hai tay đổi vai; tiếp tục bốn pha tương tự đến 1,6 s. |

Ở pha trụ, điểm tiếp xúc chân phải đứng yên trong **tọa độ thế giới**. Nếu nhân vật tiến về trước, bàn chân cần lùi tương ứng trong tọa độ nhân vật; chỉ kéo cả cụm trên timeline trong khi chân vẫn dậm tại chỗ dễ gây trượt. Khớp cổ chân phải bù góc đùi + cẳng chân để đế giày không xoay xuyên sàn. Pha lăng cần gập gối, nhấc mũi, rồi duỗi trước tiếp đất; không chỉ xoay hai chân thẳng như con lắc.

Giữ chiều dài đùi/cẳng chân và liên kết khớp ổn định. Hông lên xuống nhẹ, tay đánh ngược pha chân cùng bên, thân phản hồi nhỏ. Key đầu/cuối phải trùng pose và hướng vận tốc để vòng lặp không khựng. Nội suy `smooth` giúp đổi hướng êm nhưng không tự khóa chân trụ; kiểm tra cả frame giữa key, không chỉ pose mốc. Các nguyên tắc tiếp đất và phối hợp bước dựa trên [Walk Analysis của Toon Boom](https://learn.toonboom.com/modules/walk-cycle-animation/topic/walk-analysis1) và [ghi chú Stride của Blender](https://archive.blender.org/wiki/2015/index.php/Doc%3A2.4/Manual/Animation/Techs/Armatures/Stride/).

**Giới hạn cần giữ rõ:** preset `walk` qua MCP hiện mặc định là bước tại chỗ chính diện. Mã sinh có các biến thể góc nhìn, nhưng không được suy ra rằng ảnh chính diện trở thành ảnh nghiêng hoặc mọi biến thể đều khóa chân hoàn hảo. Để đi ngang đẹp cần ảnh nghiêng, track tương ứng và kiểm tra tiếp đất cùng chuyển động toàn nhân vật. Một sprite giày liền xoay ở cổ chân chưa mô phỏng được uốn mũi/nhấc gót độc lập; dùng bộ bàn chân chi tiết nếu cần mức đó.

Ở phiên bản kiểm tra ngày 11/10/2026, nhánh `front` trong `workshopWalkCycle.ts` còn thay đổi translation và scale từng đoạn để giả lập chiều sâu. Vì vậy các tiêu chí giữ chiều dài/khóa chân ở trên là **mục tiêu nghiệm thu**, không phải mô tả bảo đảm của preset. Nếu ảnh rời bị trượt hoặc hở khi chạy preset, kiểm tra track này trước khi kết luận prompt ảnh sai.

## Checklist thử trực tiếp trong app

- Chụp tư thế nghỉ và các pha 0%, 25%, 50%, 75%, sát cuối vòng; chạy ít nhất hai vòng. Quan sát hở vai/khuỷu/gối/cổ chân, giày xuyên đất, chân trượt, đảo bên và giật ở điểm nối vòng.
- Thử `wave` riêng: bàn tay đi theo cẳng tay, cẳng tay theo bắp tay, tóc theo đầu; không có ảnh đứng yên hoặc phụ kiện thừa từ mẫu cũ.
- Kiểm tra ảnh trên nền sáng/tối: không còn hình chữ nhật phông, viền màu, mất ngón hoặc mất chi tiết. Màu phông phù hợp không thay cho kiểm tra alpha.
- Dùng `pnpm pxs review --view app --region dialog --out <path>` với app Electron đang chạy; không dùng trình duyệt thay app. `set_layer_assembly_playback` cho phép dừng ở thời điểm cần xem.
- Lưu ảnh nguồn, ảnh cắt, mapping/pivot, bản lắp ráp và ảnh chụp bằng chứng. Chỉ kết luận đã kiểm thử MP4 khi thực sự chèn và xuất video; xem preview trong xưởng chưa chứng minh đường xuất.

## Prompt sửa lỗi bố cục sau lượt đầu

```text
Correct the attached sprite atlas only. Preserve the character design, colors, style and all correctly drawn parts. Fix these specific issues: [LIST THE ISSUES]. Restore the specified 5x5 cell order, shared pixel scale, independent hands and feet, complete hidden joint overlaps and a single uniform opaque chroma-key background: [BACKGROUND_COLOR]. Choose a background color absent from the character; preserve the character colors. Fill unused cells and empty openings with that same background color. Remove background gradients, cast shadows, color spill and edge halos. Do not simulate transparency. Do not add parts, merge cells, redraw unrelated correct parts or add any text.
```
