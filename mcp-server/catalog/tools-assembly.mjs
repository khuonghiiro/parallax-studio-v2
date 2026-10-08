/**
 * Tool specs — 3D Assembly workshop (Xưởng Lắp Ráp 3D) & saved 3D models (bilingual, see shared.mjs).
 */
import { L, vec3, z } from './shared.mjs'

const modelId = (d) =>
  z.string().optional().describe(d('Target model ID (defaults to the model open in the workshop).', 'ID mô hình đích (mặc định: mô hình đang mở trong xưởng).'))

const edge = z.enum(['top', 'bottom', 'left', 'right'])

export const MODEL_CATEGORIES = ['architecture', 'decor', 'props', 'nature', 'stage', 'street', 'room', 'custom']

export const ASSEMBLY_TOOLS = [
  {
    name: 'get_assembly_template', cat: 'assembly',
    doc: L('Get a template image-mesh recipe: per-slot render prompts, canvas ratios, recommended pixels, repeated face mappings, geometry, mesh settings and variants. Generate separate PNGs or adapt existing images before binding by slot ID.',
      'Lấy công thức mesh ảnh: prompt từng bộ phận, tỷ lệ canvas, kích thước ảnh, ánh xạ mặt lặp, hình học, thiết lập mesh và biến thể. Tạo PNG riêng hoặc chuẩn bị ảnh có sẵn rồi gắn theo ID bộ phận.'),
    shape: (d) => ({
      template_id: z.string().describe(d('Template ID from list_assembly_templates (e.g. mesh-leaf).', 'ID mẫu từ list_assembly_templates (vd mesh-leaf).')),
      variant_id: z.string().optional().describe(d('Optional recipe variant ID.', 'ID biến thể của công thức, tùy chọn.'))
    }),
    example: '{"template_id":"mesh-flower"}'
  },
  {
    name: 'list_models3d', cat: 'assembly',
    doc: L(
      'List all saved 3D assembly models (disk catalog + local presets) with id, name and category. Decor parts (category "decor") are meant to be merged onto building shells.',
      'Liệt kê mọi mô hình lắp ráp 3D đã lưu (catalog trên đĩa + preset cục bộ) kèm id, tên, danh mục. Bộ phận trang trí (danh mục "decor") dùng để ghép lên khung nhà.'
    ),
    shape: () => ({})
  },
  {
    name: 'get_model3d', cat: 'assembly',
    doc: L('Get full geometry, faces and lighting of a 3D assembly model by ID or active session.', 'Lấy đầy đủ hình học, các mặt và ánh sáng của mô hình 3D theo ID hoặc phiên đang mở.'),
    shape: (d) => ({
      id: z.string().optional().describe(d('Model ID (e.g. "model-tudor-cottage"). If omitted, returns active session model.', 'ID mô hình (vd "model-tudor-cottage"). Bỏ trống = mô hình của phiên đang mở.')),
      model_id: z.string().optional().describe(d('Alias for id.', 'Bí danh của id.'))
    })
  },
  {
    name: 'get_assembly_state', cat: 'assembly',
    doc: L('Inspect current state of the 3D Assembly workshop modal (open status, model, selected face).', 'Xem trạng thái xưởng lắp ráp 3D (đang mở hay không, mô hình, mặt đang chọn).'),
    shape: () => ({})
  },
  {
    name: 'list_assembly_templates', cat: 'assembly',
    doc: L(
      'List geometry-only templates (no textures) with EN/VI labels, hints, face counts and, for decor parts, the mounting anchor. Categories: architecture (house SHELLS: walls + roof only), decor (separate parts: windows, doors, chimney, columns, balcony, flower box, pot, lamp, sign, awning, fence), props, nature, stage.',
      'Liệt kê khuôn mẫu chỉ có hình học (không texture) kèm nhãn Anh/Việt, gợi ý, số mặt và — với bộ phận trang trí — điểm neo khi gắn. Danh mục: architecture (KHUNG nhà: chỉ tường + mái), decor (bộ phận rời: cửa sổ, cửa ra vào, ống khói, cột, ban công, bồn hoa, chậu cây, đèn, biển, mái hiên, hàng rào), props, nature, stage.'
    ),
    shape: (d) => ({
      category: z.enum(['architecture', 'decor', 'props', 'nature', 'stage']).optional().describe(d('Only this category.', 'Chỉ lấy danh mục này.'))
    }),
    example: '{"category":"decor"}'
  },
  {
    name: 'apply_assembly_template', cat: 'assembly',
    doc: L(
      'Apply a pre-folded template to a model, preserving user textures. "replace" re-folds existing faces into the template slots; "append" adds the template beside the model. Get ids from list_assembly_templates.',
      'Áp khuôn mẫu gấp sẵn lên mô hình, giữ nguyên ảnh người dùng. "replace" gấp lại các mặt hiện có theo khuôn; "append" thêm khuôn cạnh mô hình. Lấy id từ list_assembly_templates.'
    ),
    shape: (d) => ({
      template_id: z.string().describe(d('Template ID (e.g. "shell-walls", "shell-two-storey", "window-shuttered", "chimney", "box", "tent", "tower-8").', 'ID khuôn mẫu (vd "shell-walls", "shell-two-storey", "window-shuttered", "chimney", "box", "tent", "tower-8").')),
      model_id: modelId(d),
      variant_id: z.string().optional().describe(d('Image-mesh variant from get_assembly_template.', 'Biến thể mesh ảnh từ get_assembly_template.')),
      images: z.record(z.string(), z.string().min(1)).optional().describe(d('Map image slot IDs to asset paths or image data URLs. Repeated slots share one image. Omitted slots preserve existing images.', 'Ánh xạ ID bộ phận ảnh sang đường dẫn asset hoặc data URL. Bộ phận lặp dùng chung ảnh. Bỏ qua bộ phận để giữ ảnh hiện có.')),
      mode: z.enum(['replace', 'append']).optional().describe(d('Replace folds or append beside model (default "replace").', 'Gấp lại theo khuôn hoặc thêm cạnh mô hình (mặc định "replace").'))
    }),
    example: '{"template_id":"shell-two-storey","mode":"replace"}'
  },
  {
    name: 'save_assembly_model', cat: 'assembly',
    doc: L(
      'Save or create a 3D assembly model in local storage and disk catalog. Save each decor part (window, door, chimney…) as its own model with category "decor" so it can be merged later.',
      'Lưu hoặc tạo mô hình lắp ráp 3D vào bộ nhớ cục bộ và catalog trên đĩa. Lưu từng bộ phận trang trí (cửa sổ, cửa, ống khói…) thành mô hình riêng với danh mục "decor" để ghép sau.'
    ),
    shape: (d) => ({
      id: z.string().optional().describe(d('Model ID.', 'ID mô hình.')),
      name: z.string().optional().describe(d('Human-friendly model name.', 'Tên mô hình dễ đọc.')),
      category: z.enum(MODEL_CATEGORIES).optional(),
      scale: z.number().optional(),
      description: z.string().optional(),
      faces: z.array(z.any()).optional().describe(d('List of 3D faces.', 'Danh sách các mặt 3D.')),
      lighting: z.any().optional().describe(d('Lighting parameters.', 'Thông số ánh sáng.'))
    })
  },
  {
    name: 'delete_model3d', cat: 'assembly',
    doc: L(
      'Delete a saved 3D assembly model by ID from both disk catalog and local storage.',
      'Xóa mô hình lắp ráp 3D đã lưu theo ID khỏi cả catalog trên đĩa và bộ nhớ cục bộ.'
    ),
    shape: (d) => ({
      id: z.string().optional().describe(d('Model ID to delete (e.g. "model-tudor-cottage").', 'ID mô hình cần xóa (vd "model-tudor-cottage").')),
      model_id: z.string().optional().describe(d('Alias for id.', 'Bí danh của id.'))
    }),
    example: '{"id":"model-tudor-cottage"}'
  },
  {
    name: 'append_assembly_model', cat: 'assembly',
    doc: L(
      'Merge a SAVED model (typically a decor part) into the target model. With face_id it is mounted on that face (front wall, side wall, roof slope…) at uv, facing outward; with `at` its origin lands on that point; otherwise it is placed beside the model. Scale is matched automatically, ids are regenerated and clip references remapped. Run auto_assembly_clip afterwards when parts sink into roofs.',
      'Ghép một mô hình ĐÃ LƯU (thường là bộ phận trang trí) vào mô hình đích. Có face_id thì gắn lên mặt đó (tường trước, tường hông, mái dốc…) tại uv, hướng ra ngoài; có `at` thì gốc bộ phận đặt tại điểm đó; nếu không thì đặt cạnh mô hình. Tự khớp tỉ lệ, sinh id mới và ánh xạ lại tham chiếu cắt. Chạy auto_assembly_clip sau khi bộ phận cắm vào mái.'
    ),
    shape: (d) => ({
      source_model_id: z.string().describe(d('ID of the saved part to merge (from list_models3d).', 'ID bộ phận đã lưu cần ghép (lấy từ list_models3d).')),
      model_id: modelId(d),
      face_id: z.string().optional().describe(d('Host face to mount on.', 'Mặt chủ để gắn lên.')),
      uv: z
        .tuple([z.number(), z.number()])
        .optional()
        .describe(d('Point on the host face, 0..1 each, v up (default [0.5, 0.5]).', 'Điểm trên mặt chủ, mỗi trục 0..1, v hướng lên (mặc định [0.5, 0.5]).')),
      at: vec3.optional().describe(d('Model-space point for the part origin when no face_id is given.', 'Điểm trong không gian mô hình cho gốc bộ phận khi không có face_id.')),
      scale: z.number().optional().describe(d('Extra uniform scale on top of automatic matching (default 1).', 'Tỉ lệ cộng thêm ngoài tỉ lệ tự khớp (mặc định 1).')),
      target_coverage: z
        .number()
        .optional()
        .describe(
          d(
            'Target coverage fraction relative to host face dimensions (0..1, e.g. 0.35 = scale part to span 35% of host height/width).',
            'Tỉ lệ bao phủ mục tiêu so với kích thước mặt chủ (0..1, vd 0.35 = co giãn bộ phận chiếm 35% chiều cao/rộng mặt chủ).'
          )
        ),
      prefix_names: z.boolean().optional().describe(d('Prefix merged face names with the part name (default true).', 'Thêm tên bộ phận vào trước tên mặt (mặc định true).'))
    }),
    example: '{"source_model_id":"model-window-1","face_id":"face-front","uv":[0.25,0.55]}'
  },
  {
    name: 'insert_assembly_model', cat: 'assembly',
    doc: L('Insert a 3D assembly model as layered 2.5D planes into the active scene/shot.', 'Chèn mô hình lắp ráp 3D vào cảnh/shot hiện tại dưới dạng các mặt phẳng 2.5D.'),
    shape: (d) => ({
      model_id: z.string().optional().describe(d('Model ID to insert (defaults to active session model).', 'ID mô hình cần chèn (mặc định: mô hình của phiên đang mở).')),
      global_scale: z.number().optional().describe(d('Overall scale multiplier (default 1.0).', 'Hệ số tỉ lệ tổng (mặc định 1.0).')),
      position_offset: vec3.optional().describe(d('Offset in world space [x, y, z].', 'Độ dời trong không gian thế giới [x, y, z].')),
      target_shot_id: z.string().optional().describe(d('Shot ID to insert into (defaults to active shot).', 'ID shot để chèn vào (mặc định: shot đang chọn).'))
    })
  },
  {
    name: 'add_assembly_face', cat: 'assembly',
    doc: L('Add a new face plane to the active 3D assembly model.', 'Thêm một mặt phẳng mới vào mô hình lắp ráp 3D.'),
    shape: (d) => ({
      model_id: z.string().optional(),
      name: z.string().optional(),
      asset_path: z.string().optional().describe(d('Image asset path for texture.', 'Đường dẫn ảnh làm texture.')),
      width: z.number().optional(),
      height: z.number().optional(),
      position: vec3.optional(),
      rotation: vec3.optional(),
      color: z.string().optional()
    })
  },
  {
    name: 'update_assembly_face', cat: 'assembly',
    doc: L(
      'Update a face transform, image, alpha mesh grid, bend, depth profile, visibility or clip rules. Use mesh_mode auto for transparent PNG contours.',
      'Cập nhật biến đổi, ảnh, lưới mesh alpha, uốn, độ nổi, hiển thị hoặc quy tắc cắt. Dùng mesh_mode auto để bám viền PNG trong suốt.'
    ),
    shape: (d) => ({
      face_id: z.string().describe(d('ID of face to update.', 'ID mặt cần cập nhật.')),
      mesh_mode: z.enum(['auto', 'manual']).optional().describe(d('Alpha contour or manual grid.', 'Bám viền alpha hoặc lưới thủ công.')),
      grid_res: z.number().int().min(4).max(128).optional().describe(d('Mesh grid resolution.', 'Độ phân giải lưới mesh.')),
      bend_x: z.number().min(-100).max(100).optional().describe(d('Horizontal bend.', 'Độ uốn ngang.')),
      bend_y: z.number().min(-100).max(100).optional().describe(d('Vertical bend.', 'Độ uốn dọc.')),
      depth_profile: z.enum(['none', 'luminance', 'sphere', 'cylinder', 'slope', 'ridge']).optional().describe(d('Depth shape for the image mesh.', 'Dạng độ nổi cho mesh ảnh.')),
      depth_intensity: z.number().min(-200).max(200).optional().describe(d('Depth intensity percent.', 'Cường độ độ nổi phần trăm.')),
      model_id: z.string().optional(),
      name: z.string().optional(),
      asset_path: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      position: vec3.optional(),
      rotation: vec3.optional(),
      color: z.string().optional(),
      hidden: z.boolean().optional(),
      locked: z.boolean().optional(),
      clip_by: z.array(z.string()).optional().describe(d('IDs of cutting planes.', 'ID các mặt cắt.')),
      join_points: z.array(z.tuple([z.number(), z.number()])).optional()
    })
  },
  {
    name: 'delete_assembly_face', cat: 'assembly',
    doc: L('Delete a face plane from the 3D assembly model.', 'Xóa một mặt khỏi mô hình lắp ráp 3D.'),
    shape: (d) => ({ face_id: z.string().describe(d('Face ID to remove.', 'ID mặt cần xóa.')), model_id: z.string().optional() })
  },
  {
    name: 'join_assembly_faces', cat: 'assembly',
    doc: L(
      'Seamlessly align and join two faces edge-to-edge (auto-scales shorter edge to longest to eliminate gaps).',
      'Căn và ghép khít hai mặt theo cạnh (tự co giãn cạnh ngắn theo cạnh dài nhất để không hở).'
    ),
    shape: (d) => ({
      target_id: z.string().describe(d('ID of reference face that remains stationary.', 'ID mặt tham chiếu, đứng yên.')),
      source_id: z.string().describe(d('ID of face being aligned and moved to the edge.', 'ID mặt được di chuyển tới cạnh.')),
      target_edge: edge.describe(d('Edge of target face.', 'Cạnh của mặt tham chiếu.')),
      source_edge: edge.describe(d('Edge of source face.', 'Cạnh của mặt được ghép.')),
      angle: z.number().optional().describe(d('Hinge angle between faces in degrees (default 90).', 'Góc bản lề giữa hai mặt, độ (mặc định 90).')),
      scale_mode: z.enum(['longest', 'source', 'target', 'none']).optional().describe(d('Edge matching mode (default "longest").', 'Cách khớp cạnh (mặc định "longest").')),
      flip: z.boolean().optional().describe(d('Invert hinge direction.', 'Đảo chiều bản lề.')),
      model_id: z.string().optional()
    }),
    example: '{"target_id":"face-a","source_id":"face-b","target_edge":"right","source_edge":"left","angle":90}'
  },
  {
    name: 'auto_assembly_clip', cat: 'assembly',
    doc: L(
      'Detect intersecting faces (e.g. wall poking through sloped roof, chimney sunk into a roof) and automatically apply clipping planes to hide overlapping pixels.',
      'Phát hiện các mặt đâm xuyên nhau (vd tường nhô qua mái dốc, ống khói cắm vào mái) và tự gắn mặt cắt để ẩn pixel thừa.'
    ),
    shape: () => ({ model_id: z.string().optional() })
  },
  {
    name: 'set_assembly_lighting', cat: 'assembly',
    doc: L(
      'Configure directional sunlight, soft shadow casting, and time-of-day color tinting for the 3D model.',
      'Cấu hình nắng định hướng, đổ bóng mềm và tông màu theo thời điểm trong ngày cho mô hình 3D.'
    ),
    shape: (d) => ({
      model_id: z.string().optional(),
      sun: z.boolean().optional().describe(d('Enable directional sunlight.', 'Bật nắng định hướng.')),
      shadows: z.boolean().optional().describe(d('Cast soft shadow onto floor and faces.', 'Đổ bóng mềm lên sàn và các mặt.')),
      preset: z.enum(['auto', 'morning', 'noon', 'sunset', 'overcast', 'night']).optional(),
      azimuth: z.number().optional().describe(d('Sun compass direction 0-360 degrees.', 'Hướng mặt trời theo la bàn 0-360 độ.')),
      elevation: z.number().optional().describe(d('Sun altitude 0-90 degrees.', 'Độ cao mặt trời 0-90 độ.')),
      intensity: z.number().optional(),
      shadow_darkness: z.number().optional()
    }),
    example: '{"preset":"sunset","shadows":true}'
  },
  {
    name: 'get_assembly_screenshot', cat: 'assembly', format: 'image',
    doc: L(
      'Capture a screenshot of the currently active 3D Assembly workshop viewport (PNG). Supports presets ("iso", "front", "left", etc.) and auto_fit framing.',
      'Chụp ảnh khung nhìn xưởng lắp ráp 3D đang mở (PNG). Hỗ trợ các góc nhìn ("iso", "front", "left"...) và tự động căn khung auto_fit.'
    ),
    shape: (d) => ({
      preset: z.enum(['front', 'back', 'left', 'right', 'top', 'bottom', 'iso', 'custom']).optional().describe(d('Camera angle preset.', 'Góc nhìn camera đặt sẵn.')),
      frame_face_id: z.string().optional().describe(d('Zoom camera to frame a specific face.', 'Căn khung camera cận cảnh một mặt cụ thể.')),
      auto_fit: z.boolean().optional().describe(d('Auto-fit all active faces into the isometric camera view.', 'Tự động tính góc nhìn 3/4 bao quát toàn bộ mô hình.')),
      transparent: z.boolean().optional().describe(d('Render with transparent background (default true).', 'Xuất ảnh nền trong suốt (mặc định true).'))
    }),
    example: '{"preset":"iso","auto_fit":true}'
  },
  {
    name: 'set_assembly_camera', cat: 'assembly',
    doc: L(
      'Adjust the 3D Assembly workshop camera angle, distance, target position, or frame specific parts.',
      'Điều chỉnh góc xoay, khoảng cách, tâm nhìn của camera trong xưởng lắp ráp 3D hoặc căn khung theo bộ phận.'
    ),
    shape: (d) => ({
      preset: z.enum(['front', 'back', 'left', 'right', 'top', 'bottom', 'iso', 'custom']).optional().describe(d('Camera preset angle.', 'Góc nhìn đặt sẵn.')),
      azimuth: z.number().optional().describe(d('Horizontal orbit angle in degrees (-180 to 180).', 'Góc xoay ngang theo độ (-180 đến 180).')),
      elevation: z.number().optional().describe(d('Vertical tilt angle in degrees (-85 to 85).', 'Góc nghiêng dọc theo độ (-85 đến 85).')),
      radius: z.number().positive().optional().describe(d('Camera distance from target in units.', 'Khoảng cách từ camera đến tâm nhìn.')),
      target: z.array(z.number()).length(3).optional().describe(d('Target position [x, y, z] to look at.', 'Tọa độ tâm nhìn [x, y, z].')),
      frame_face_id: z.string().optional().describe(d('Focus and zoom onto a specific face ID.', 'Tập trung và zoom vào một mặt phẳng cụ thể.')),
      frame_model: z.boolean().optional().describe(d('Frame the entire model nicely in view.', 'Căn khung toàn bộ mô hình trong tầm nhìn.'))
    }),
    example: '{"preset":"iso","frame_model":true}'
  },
  {
    name: 'open_assembly_workshop', cat: 'assembly',
    doc: L(
      'Open the 3D Assembly Workshop modal in the app UI for realtime editing. The user will see all modifications live on screen.',
      'Mở cửa sổ Xưởng Lắp Ráp 3D trên giao diện ứng dụng để chỉnh sửa theo thời gian thực. Người dùng sẽ thấy mọi thao tác trực tiếp trên màn hình.'
    ),
    shape: (d) => ({
      model_id: z.string().optional().describe(d('ID of an existing saved 3D model to edit.', 'ID mô hình 3D đã lưu cần chỉnh sửa.')),
      template_id: z.string().optional().describe(d('ID of a template to initialize (e.g. "tree-cross", "bush-3", "cottage").', 'ID khuôn mẫu để khởi tạo (VD: "tree-cross", "bush-3", "cottage").')),
      name: z.string().optional().describe(d('Name for the model when opened.', 'Tên hiển thị của mô hình khi mở.'))
    }),
    example: '{"template_id":"tree-cross","name":"Cây 3D Mới"}'
  },
  {
    name: 'close_assembly_workshop', cat: 'assembly',
    doc: L(
      'Close the 3D Assembly Workshop modal. Can optionally save the model and capture a clean preview thumbnail.',
      'Đóng cửa sổ Xưởng Lắp Ráp 3D. Tùy chọn lưu mô hình và tự động chụp ảnh preview sạch.'
    ),
    shape: (d) => ({
      save: z.boolean().optional().describe(d('Whether to save changes and clean thumbnail before closing (default true).', 'Có lưu thay đổi và chụp thumbnail sạch trước khi đóng không (mặc định true).'))
    }),
    example: '{"save":true}'
  },
  {
    name: 'set_assembly_face_image', cat: 'assembly',
    doc: L(
      'Assign an image texture (relative path or base64 data URL) to a 3D assembly face and optionally update its dimensions.',
      'Gán ảnh chất liệu texture (đường dẫn tương đối hoặc data URL base64) cho một mặt phẳng 3D và tùy chọn cập nhật kích thước theo ảnh.'
    ),
    shape: (d) => ({
      face_id: z.string().optional().describe(d('Target face ID. Defaults to currently selected face in workshop or the first face.', 'ID mặt cần gán. Mặc định là mặt đang chọn trong xưởng hoặc mặt đầu tiên.')),
      model_id: z.string().optional().describe(d('Target model ID if workshop modal is not open.', 'ID mô hình cần sửa nếu xưởng chưa mở trên màn hình.')),
      asset_path: z.string().optional().describe(d('Relative asset path (e.g. "house/origami_front.png").', 'Đường dẫn tài nguyên tương đối (VD: "house/origami_front.png").')),
      image_data_url: z.string().optional().describe(d('Base64 data URL of the image (e.g. "data:image/png;base64,...").', 'Chuỗi data URL base64 của ảnh (VD: "data:image/png;base64,...").')),
      width: z.number().positive().optional().describe(d('New width of the face in units.', 'Chiều rộng mới của mặt theo đơn vị.')),
      height: z.number().positive().optional().describe(d('New height of the face in units.', 'Chiều cao mới của mặt theo đơn vị.'))
    }),
    example: '{"face_id":"face-1","asset_path":"nature/tree_canopy.png","width":520,"height":600}'
  },

  // ---- local (answered by the MCP server itself, no app round-trip)
  {
    name: 'get_ai_guide', cat: 'inspect', local: true,
    doc: L(
      'Read the AI guide for Parallax Studio in the configured docs language: coordinate conventions, scene workflow and the modular 3D assembly workflow (shell → decor parts → merge → clip → insert). Call this first when unsure.',
      'Đọc hướng dẫn AI cho Parallax Studio theo ngôn ngữ tài liệu đã cấu hình: quy ước tọa độ, quy trình dựng cảnh và quy trình lắp ráp 3D dạng mô-đun (khung → bộ phận trang trí → ghép → cắt → chèn). Gọi đầu tiên khi chưa rõ.'
    ),
    shape: (d) => ({
      topic: z.enum(['all', 'overview', 'coordinates', 'workflow', 'assembly', 'tips']).optional().describe(d('Section to read (default "all").', 'Phần cần đọc (mặc định "all").'))
    }),
    example: '{"topic":"assembly"}'
  }
]
