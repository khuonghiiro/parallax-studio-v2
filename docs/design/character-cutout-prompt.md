# Prompt tách nhân vật thành bộ phận để rig 2D / 2.5D

Đính kèm ảnh nhân vật gốc, rồi dùng prompt bên dưới. Nếu nhân vật có bất đối xứng (sẹo, hoa tai, giáp một bên), trái/phải luôn tính theo **nhân vật**, không theo người xem. Ảnh chính diện: tay trái nhân vật ở bên phải người xem.

```text
Use the attached character image as the strict identity and design reference.
Create ONE high-resolution CHARACTER CUTOUT SPRITE ATLAS for 2D skeletal / 2.5D animation.

IDENTITY AND STYLE
Preserve the original character's face, apparent age, proportions, hairstyle, outfit, colors, material rendering and illustration style. Keep all asymmetrical details on the correct anatomical side. Do not redesign the character or add equipment.

VIEW AND REST POSE
Use a consistent FRONT ORTHOGRAPHIC view, without perspective or foreshortening. Neutral relaxed rest pose, torso upright, upper arms and forearms pointing downward, legs straight. Hands in a relaxed neutral pose; feet facing forward with matching perspective. Use identical light direction, edge treatment and detail density on every part. If the reference is posed or partly obscured, reconstruct the missing anatomy and clothing consistently.

OUTPUT
One square PNG atlas, ideally 4096 x 4096 if supported, with genuine RGBA transparency. Exactly 5 columns x 5 rows of equal cells. No visible grid, text, labels, watermark, background, checkerboard baked into the image, ground plane, or cast shadows outside each part. One isolated part per cell. Keep generous transparent gutters; no part may touch another part or cross a cell boundary.

COMMON SCALE — CRITICAL
All parts must use ONE COMMON PIXEL SCALE matching the reference character's body proportions. Do NOT enlarge hands, feet, eyes or accessories to fill their cells. A hand must remain the correct size relative to its forearm; a foot must remain the correct size relative to its lower leg. Fit the largest part first, then apply the same scale to all other parts. Keep paired limbs equal in anatomical length. Do not stretch parts independently. Preserve each part's intended orientation.

EXACT CELL LAYOUT, left to right, top to bottom:
Row 1:
1. Head / face, including ears and complete head silhouette; NO hair, hat or neck.
2. Neck, including concealed upper and lower joint overlap.
3. Back hair mass, complete silhouette behind the head; NO face or head skin.
4. Front hair / bangs, isolated; NO face skin.
5. Hat / helmet / headwear, isolated and complete; empty transparent cell if absent.

Row 2:
6. Torso / chest / clothing body, shoulder to waist; NO neck, head, arms or pelvis.
7. Pelvis / hip garment, waist to upper-leg attachment; NO legs.
8. Anatomical LEFT upper arm: shoulder to elbow, with its sleeve or armor.
9. Anatomical RIGHT upper arm: shoulder to elbow, with its sleeve or armor.
10. Separate collar / scarf / neck accessory if present; otherwise empty transparent cell.

Row 3:
11. LEFT forearm: elbow to wrist; NO hand.
12. RIGHT forearm: elbow to wrist; NO hand.
13. LEFT complete hand / glove with all five fingers and a short wrist overlap; NO forearm.
14. RIGHT complete hand / glove with all five fingers and a short wrist overlap; NO forearm.
15. Separate belt / waist accessory if present; otherwise empty transparent cell. Do not duplicate it on the pelvis.

Row 4:
16. LEFT thigh: hip to knee, with clothing / armor.
17. RIGHT thigh: hip to knee, with clothing / armor.
18. LEFT lower leg: knee to ankle; NO foot or shoe sole.
19. RIGHT lower leg: knee to ankle; NO foot or shoe sole.
20. Separate main accessory actually present in the reference; otherwise empty transparent cell.

Row 5:
21. LEFT foot / shoe: complete ankle-to-toe-and-heel part with short ankle overlap; NO lower leg.
22. RIGHT foot / shoe: complete ankle-to-toe-and-heel part with short ankle overlap; NO lower leg.
23. LEFT independently movable side hair lock / ponytail section if present; otherwise empty transparent cell.
24. RIGHT independently movable side hair lock / ponytail section if present; otherwise empty transparent cell.
25. Another separate accessory actually present, such as a bow, feather or cape; otherwise empty transparent cell.

JOINTS AND OCCLUDED SURFACES — CRITICAL FOR ANIMATION
Draw complete body parts, including surfaces hidden by neighboring parts in the assembled character. Extend shoulder, elbow, wrist, hip, knee, ankle and neck connections with rounded covered ends, approximately 10–15% of that segment's length. These ends must overlap under adjacent artwork when rigged. Never cut exactly at the visible seam or leave a hollow gap. No dark cut lines, black end caps, exposed cross sections or hard outlines across a joint. Keep outlines only where the finished assembled silhouette needs them.

Hands and feet MUST be independent sprites so wrists and ankles can rotate separately. Do not fuse a hand into a forearm or a shoe into a shin. Keep hair separate from face, and hat separate from hair. Where hair locks are separate, the base hair must still provide sufficient hidden overlap. Avoid duplicate visible details across overlapping parts.

CHECK BEFORE FINALIZING
Exactly one part in each specified occupied cell. Correct left/right anatomy and asymmetry. Consistent scale and front view. No missing fingers or duplicated limbs. No clipped part. Real transparent background. Clean anti-aliased edges, no white halo. No assembled character preview inside the atlas. The result must be usable as a practical cutout animation source, not just a decorative character breakdown poster.
```

## Khi muốn rig ngón tay hoặc biểu cảm

- Prompt trên tách **cả bàn tay** để xoay cổ tay, chưa tách từng đốt ngón. Để cử động ngón tay, tạo thêm atlas bàn tay lớn riêng với lòng bàn tay và từng đốt ngón; giữ đúng tỉ lệ giữa các đốt.
- Đầu/khuôn mặt ở ô 1 là một sprite. Nếu cần chớp mắt/nói chuyện, yêu cầu thêm atlas biểu cảm riêng: mặt nền, mắt trái/phải, lông mày trái/phải, các dáng miệng. Không ép tất cả vào 25 ô hiện tại.
- Tóc dài muốn uốn nhiều khớp có thể dùng một sprite tóc đầy đủ và skin mềm; tóc tách khúc cần các đầu chồng lấp.
- AI tạo ảnh có thể lệch ô hoặc tỉ lệ dù đã mô tả. Kiểm tra atlas thực tế rồi căn khớp khi nhập; prompt không tự sinh điểm pivot, xương hoặc trọng số skinning.

## Prompt sửa lỗi bố cục sau lượt đầu

```text
Correct the attached sprite atlas only. Preserve the character design, colors, style and all correctly drawn parts. Fix these specific issues: [LIST THE ISSUES]. Restore the specified 5x5 cell order, shared pixel scale, independent hands and feet, complete hidden joint overlaps and genuine alpha transparency. Do not add parts, merge cells, redraw unrelated correct parts or add any text.
```
