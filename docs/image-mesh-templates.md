# Mẫu mesh ảnh 2D → 3D

Trong **Tạo Mô Hình 3D Mới**, chọn thẻ **Mesh ảnh** để xem ảnh cần chuẩn bị, chọn PNG cho từng bộ phận, chọn biến thể rồi **Tạo mesh**. Nút **Sao chép hướng dẫn AI** cung cấp prompt, tỷ lệ canvas và sơ đồ gắn ảnh. Có thể tạo khung trước và gắn ảnh sau trong Xưởng Lắp Ráp. Mỗi mẫu có ba biến thể kích thước/độ cong; thay bộ ảnh để tạo loài cây, vật liệu hoặc phong cách khác.

| ID | Ảnh nguồn | Kết quả |
|---|---|---|
| `mesh-leaf` | `leaf` 1:2 | Lá bám viền alpha, gân nổi và uốn dọc |
| `mesh-flower` | `petal` 2:3, `center` 1:1, `stem` 1:10 | Sáu cánh cong, nhụy nổi, thân |
| `mesh-planter` | `pot` 13:12, `bottom` 1:1, `soil` 1:1, `leaf` 1:2 | Chậu vuông kín đáy, đất và bốn lá |
| `mesh-highrise` | `front` 1:3, `side` 1:4, `roof` 4:3 | Bốn mặt đứng và mái bằng |
| `mesh-railing` | `panel` 3:1, `rail` 15:1 | Song lan can khoét alpha và tay vịn |
| `mesh-grass` | `grass` 1:1 | Ba tấm cỏ giao nhau |

## Chuẩn ảnh

Render riêng từng phần, nhìn vuông góc, không phối cảnh hoặc bóng đổ. Dùng PNG có alpha thật (không nền caro vẽ sẵn), cùng vật liệu/ánh sáng giữa các phần. Giữ nguyên tỷ lệ và vị trí trên canvas: không tự cắt sát alpha. Prompt của từng slot quy định hướng đầu/cuống lá, gốc cánh hoa, cao độ tầng và cạnh mái. Slot lặp dùng chung một ảnh; muốn từng mặt khác nhau, gắn riêng bằng `set_assembly_face_image` sau khi áp mẫu.

Ảnh chỉ có một góc nhìn không thể tái dựng chính xác các mặt khuất. Với ảnh có sẵn: tách nền, chỉnh về chính diện, chuẩn bị các phần thiếu, gắn vào slot phù hợp rồi tinh chỉnh lưới/độ nổi/uốn. Đây là mô hình dựng từ bề mặt ảnh và alpha mesh; chưa phải tự động tái dựng khối kín hoặc sculpt như Blender.

## MCP / CLI

1. `list_assembly_templates`: chọn mục có `imageMesh: true`.
2. `get_assembly_template {template_id}`: trả `slots`, prompt tiếng Anh, hướng dẫn tiếng Việt, `recommendedPixels`, `faceIndices` (đếm từ 0), hình học và `variants`.
3. AI dùng công cụ tạo ảnh của mình để render PNG theo prompt hoặc chuẩn bị ảnh có sẵn. App không tự gọi dịch vụ tạo ảnh.
4. `open_assembly_workshop {template_id}` tạo bản nháp realtime. Với chế độ headless, tạo model rỗng bằng `save_assembly_model {id, name, faces: []}` trước rồi truyền `model_id` vào bước tiếp theo.
5. `apply_assembly_template` gắn ảnh theo tên bộ phận:

```json
{
  "template_id": "mesh-flower",
  "variant_id": "standard",
  "mode": "replace",
  "images": {
    "petal": "flowers/petal.png",
    "center": "flowers/center.png",
    "stem": "flowers/stem.png"
  }
}
```

Đường dẫn tuân theo resolver asset của app; cũng nhận image data URL. Slot sai hoặc giá trị trống bị từ chối trước khi mutate. `append` chỉ gắn ảnh cho những mặt vừa thêm, giữ nguyên model hiện có. `replace` giữ ID và ảnh hiện có nếu không truyền ảnh thay thế; các mặt thừa được giữ lại.

6. Dùng ID mặt trong kết quả hoặc `get_assembly_state` để tinh chỉnh:

```json
{
  "face_id": "ID trả về từ app",
  "mesh_mode": "auto",
  "grid_res": 48,
  "bend_x": 10,
  "bend_y": 25,
  "depth_profile": "ridge",
  "depth_intensity": 12
}
```

`grid_res`: số nguyên 4–128; `bend_x`/`bend_y`: -100–100; `depth_intensity`: -200–200; `depth_profile`: none/luminance/sphere/cylinder/slope/ridge. Luminance dựa vào độ sáng ảnh, không phải suy luận chiều sâu bằng AI.

7. Xem `get_assembly_screenshot` ở góc front/iso/top, lưu và chèn khi đạt yêu cầu. Ctrl+Z trong xưởng hoàn tác bản nháp qua `useAssemblyHistory`; chèn vào cảnh đi qua lịch sử project.

Nguồn chung UI/MCP: `imageMeshTemplates.ts`, `imageMeshRecipe.ts`, `imageMeshTypes.ts`. Mẫu dùng mesh thật qua pipeline silhouette → contour → alpha mesh hiện có, không có texture giả hoặc dữ liệu mẫu thay cho ảnh người dùng.
