# Kiến Trúc Xưởng Lắp Ráp Layer 2.5D, Hệ Thống Xương Blender & Hoạt Hoạ

Tài liệu đặc tả kiến trúc kỹ thuật của Xưởng Lắp Ráp Layer (`ui/layerAssembly/`), hệ thống khung xương Blender 2D/2.5D, uốn mềm skinning, JSON động tác AI, cọ chỉnh pixel và khuôn mẫu Atlas. Xem quy chuẩn tổng quan tại [AGENTS.md](../../AGENTS.md).

---

## 1. Xưởng Lắp Ráp Layer – Thao Tác Hàng Loạt & Hệ Thống Xương Blender (Rigging & Animation)

- **Mesh alpha & Uốn mềm 2D (`Soft Skinning`):**
  - `layerAssemblyAlphaMesh.tsx` dùng silhouette chi tiết không dilation, giữ lỗ trong suốt và các đảo rời.
  - `engine/layerSkinning.ts` tính trọng số theo đoạn xương trong nhánh đã chọn.
  - Giao diện có nút **Uốn mềm theo chuỗi xương**; MCP `layer_assembly_rig` hỗ trợ `action: "bind"`, `binding_mode: "soft"` (mặc định `rigid` để giữ tương thích).
  - `SoftLayerImage.tsx` và preview Three.js dùng chung biến dạng; `exportWorkshopSkin.ts` lưu topology + rig vào `ImageMeshDefinition.skin`, `updateSkinGeometry.ts` cập nhật buffer cho timeline/MP4.
  - Lưu ý: Chỉnh vị trí xương ở Edit Mode trước khi gắn; xương không tự nhận diện ngữ nghĩa người/động vật từ ảnh.

- **Giao diện & Bố cục Xưởng (`ui/layerAssembly/`):**
  - Các thành phần: `WorkshopHeader.tsx`, `WorkshopTools.tsx`, `WorkshopWorkspace.tsx`, `WorkshopRightPanel.tsx` (3 tab: Layer, Tạo xương, Animation), `WorkshopRigPanel.tsx`, `WorkshopAnimationPanel.tsx`, `WorkshopBoneOverlay.tsx` (xương bát diện chuẩn Blender: kéo Head dời khớp, kéo Tail đổi góc/chiều dài, Pose Mode kéo xoay trực quan).
  - Logic chung UI/MCP: `workshopActions.ts`, `workshopRig.ts`, `workshopRigPresets.ts` (mẫu khung xương người 2D 11 khớp, chuỗi uốn 3 khớp, bộ sinh chuyển động tự động `walk cycle`, `idle breathe`, `wave hand`, `sway`).
  - Lịch sử bản nháp: `workshopHistory.ts` (100 bước, 1 gesture / 1 lệnh hàng loạt), không ghi lịch sử dự án trước khi chèn.
  - Nướng chuyển động (`Bake`): `bakeWorkshopRig.ts` chuyển đổi toàn bộ chuyển động phân cấp FK của xương thành keyframe vị trí & góc xoay chuẩn của `ImageLayer` khi chèn vào shot/dự án để xuất video MP4.

- **Vẽ động tác (`Motion Sketch` – tab Animation):**
  - Logic thuần: `workshopMotionSketch.ts` (chọn xương gần bút, xoay/dời theo đường đi ngọn xương, chuỗi IK nhiều xương, nhịp `live`/`hand`/`even`, lấy mẫu lại + làm mượt + rút gọn RDP, khứ hồi, nới clip, thay keyframe trong đoạn vẽ).
  - Giao diện & Store: `MotionSketchOverlay.tsx` (phím `D`, nhịp thời gian thật chạy đầu phát theo bút, xem trước trong 1 history gesture rồi ghi 1 bước hoàn tác), `WorkshopMotionSketchCard.tsx`, store `motionSketchStore.ts`.
  - MCP & Kiểm thử: `layerMotionSketchCommands.ts`, `workshopMotionSketch.test.ts`, `mcp/commands/layerMotionSketchCommands.test.ts`.

- **Công cụ hoạt hoạ chuyên nghiệp (`IK / Onion Skin / Secondary Motion` – tab Animation):**
  - Mã nguồn: `workshopIk.ts` (bộ giải IK CCD, `solveIkPose`), `workshopBoneDrag.ts` (kéo ngọn = IK), `animAssistStore.ts` (IK / onion / quỹ đạo, lưu `localStorage`), `AnimAssistChips.tsx` (thanh nổi, phím `I` / `O` / `P`), `RigGhostOverlay.tsx` (onion skin + quỹ đạo ngọn), `workshopSecondaryMotion.ts` (vật lý thứ cấp Verlet + lò xo, nướng keyframe), `WorkshopAnimAssistCards.tsx`, CSS `styles/layerWorkshopAnimAssist.css`.
  - MCP & Vùng chụp: `layerAnimProCommands.ts` + catalog `mcp-server/catalog/tools-layer-anim.mjs`; vùng chụp `layer_assembly_anim_tools`.
  - Kiểm thử: `workshopIk.test.ts`, `workshopSecondaryMotion.test.ts`, `mcp/commands/layerAnimProCommands.test.ts`.

- **Xương Motion thực vật (`Plant Spine & Motion` – tab Motion):**
  - Engine & Logic: `engine/plantSpine.ts` (tư thế tĩnh, góc ngọn hướng tới điểm nắm), `engine/plantMotion.ts` (phát lại chuyển động vẽ tay Catmull-Rom tuần hoàn, kiểm tra hợp lệ), `plantSpineEdit.ts` (sửa điểm, dời, học biên độ/nghiêng/tốc độ từ cử chỉ lắc), `plantMotionRecord.ts` (ghi chuyển động vẽ tay: làm mượt, cắt đoạn chờ, nảy về, khép vòng, rút gọn mốc), `plantStrokeHitTest.ts` (tự nhận layer dưới nét qua `data-layer-id`).
  - Giao diện: `PlantSpineShapes.tsx`, `PlantSpineOverlay.tsx` (nắm ngọn ghi/học gió, phím `R` vẽ quỹ đạo ngọn), `PlantMotionSection.tsx` (mục Chuyển động + thanh nổi), `PlantMotionGraph.tsx` (biểu đồ mốc kéo được), `usePlantLiveClock` (gió trực tiếp).
  - MCP & Kiểm thử: `layerPlantMotionParams.ts`, vùng chụp `layer_assembly_plant_motion`; tests tại `plantSpineEdit.test.ts`, `plantMotionRecord.test.ts`, `engine/plantSpine.test.ts`, `engine/plantMotion.test.ts`, `workshopPlantSpines.test.ts`.

- **Nhóm bộ phận & Slot hoán đổi (`Part Groups & Swap Slots`):**
  - Một layer có thể thuộc nhóm bộ phận (ví dụ `Đầu` gồm mặt/mắt/miệng/kính/tóc); khi khoá nhóm thì kéo một thành viên sẽ dời cả nhóm.
  - Các layer chung `slot` (ví dụ `face`) là biến thể thay thế nhau (`face-normal` / `face-happy` / `face-cry`): kích hoạt một biến thể sẽ hiện nó, ẩn các biến thể còn lại và khớp đúng transform neo; thay ảnh bộ phận vẫn giữ nguyên vị trí.
  - Trong Inspector cảnh (mục `Cụm Layer Chồng`), người dùng đổi nhanh biểu cảm/bộ phận của nhân vật 2.5D đã đặt từ biến thể slot của mẫu hoặc tài nguyên liên quan cùng thư mục.
  - MCP & Vùng chụp: `layer_assembly_parts` (`list`, `auto_detect`, `create_group`, `assign`, `lock_group`, `set_slot`, `activate_variant`, `replace_asset`) và tool cảnh `swap_composite_part` (`layer_id`, `variant_layer_id` hoặc `asset_path`). Vùng chụp: `layer_assembly_parts`, `layer_assembly_swap`, `inspector_composite`, `composite_swap`.
  - Tài liệu & Kiểm thử: [docs/layer-workshop-tools.md](../layer-workshop-tools.md), `workshopActions.test.ts`, `workshopHistory.test.ts`, `workshopRig.test.ts`, `mcp/commands/layerAssemblyCommands.test.ts`.

---

## 2. JSON Động Tác Cho AI (Tab `Anim` › `Hành động` › Nút `JSON`)

- **Xuất JSON chuẩn `parallax-motion-v1`:**
  - Hàm `exportAnimationClipToJson` ([`src/renderer/src/ui/layerAssembly/workshopClipJson.ts`](../../src/renderer/src/ui/layerAssembly/workshopClipJson.ts)) xuất định dạng `parallax-motion-v1` kèm khối **`aiAuthoringGuide`** (đứng trước `tracks`, tắt bằng `includeAiGuide: false` / MCP `include_ai_guide`):
    - `outputContract` (trường bắt buộc, `allowedBoneIds`),
    - `keyframeSchema` (đơn vị & ý nghĩa `x`/`y`/`rotation`/`scale`/`zOrder`/`easing`/`bezier`),
    - `evaluationModel` (Hermite theo giây, FK cộng dồn cha → con, quy tắc loop),
    - `boneHierarchy` (cây xương lồng nhau + `suggestedPhaseDelaySec`, `typicalRotationDeg`, `rotationLimitDeg`),
    - `smoothMotionRules`, `qualityChecklist` và `starterExample` sinh từ id xương thật.
  - Logic nằm tại [`workshopClipAiGuide.ts`](../../src/renderer/src/ui/layerAssembly/workshopClipAiGuide.ts) và [`workshopClipAiStarter.ts`](../../src/renderer/src/ui/layerAssembly/workshopClipAiStarter.ts).

- **Nhập ngược & Làm mượt (`Import & Smoothing`):**
  - Hàm `parseAnimationClipFromJson` đi qua [`workshopClipSmoothing.ts`](../../src/renderer/src/ui/layerAssembly/workshopClipSmoothing.ts): đọc `bezier`, kẹp thời lượng, gộp key trùng, khép kín vòng lặp và cảnh báo cú giật vận tốc.
  - Lưu ý bảo trì: Khi thay đổi mô hình nội suy (`engine/boneInterpolation.ts`) hoặc FK (`engine/layerRig.ts`), bắt buộc cập nhật `evaluationModel` tương ứng.

---

## 3. Trình Chỉnh Sửa Pixel Trong Xưởng (`Layer Workshop Pixel Editor`)

- **Cơ chế hoạt động:**
  - Cọ tẩy chỉ hoạt động trong khung chỉnh pixel góc dưới trái; bố cục lớn dùng để xem và chọn layer.
  - Thanh công cụ dọc gồm: cọ mềm, tẩy nét cứng, bàn tay, vừa khung và khôi phục ảnh gốc.
  - Tương tác: Cuộn chuột để zoom quanh con trỏ; `Space + kéo` hoặc chuột giữa để dời ảnh; `Escape` hủy nét đang vẽ; mỗi nét hoàn tất là 1 bước hoàn tác Undo.
- **Hình học & MCP:**
  - Hình ảnh và tọa độ cọ dùng chung `isolatedBrushGeometry.ts`; kiểm thử tại `isolatedBrushGeometry.test.ts`.
  - MCP tiếp tục dùng `update_layer_assembly_layer` với `patch.imageUrl` qua lịch sử bản nháp.

---

## 4. Mẫu Lắp Ráp Sẵn (`Templates`) & Prompt AI Chuẩn Atlas

- **Độ phân giải & Cắt mảnh Atlas nhân vật:**
  - Prompt dùng tỉ lệ `1:1`, metadata `recommended_resolution: model-native`, không ép số pixel cứng.
  - Script [`scripts/slice_puppet_atlas.py`](../../scripts/slice_puppet_atlas.py) tách 15 PNG theo kích thước thực tế và vùng liên thông (kiểm thử tại [`scripts/test_slice_puppet_atlas.py`](../../scripts/test_slice_puppet_atlas.py)).
  - Mẫu búp bê 15 lớp: `templates/puppetCharacter.ts` (`tmpl-character-puppet-15`) tách đủ tay/chân 3 đoạn và 15 xương. `templates/characterPrompt.ts` sinh prompt nhân vật từ slot thực tế trên atlas vuông 5×5 (không trộn bố cục 16:9 cũ). Xem [docs/design/character-cutout-prompt.md](../design/character-cutout-prompt.md).

- **Kho 16 mẫu có sẵn (4 danh mục):**
  - *Nhân vật theo lứa tuổi:* Nam anh hùng 5×5 atlas, Nữ anime váy xếp ly, Bé thiếu nhi chibi, Quý ông trung niên suit, Cụ già gậy gỗ.
  - *Động vật 4 chân & chim cá:* Chó cưng, Trâu nước, Mèo mướp, Cá Koi uốn sóng, Gà trống.
  - *Cây cối & Thiên nhiên:* Bonsai, Bụi hoa.
  - *Kiến trúc & Đạo cụ:* Ban công, Cổng tàn tích.

- **Bộ xương & Chuyển động sinh tự động (`creatureRigPresets.ts`):**
  - Sinh xương và keyframe FK tự nhiên cho từng loài: bước đi 4 chân đối xứng chéo (`quadrupedWalk`), uốn vẫy đuôi (`quadrupedWag`), cá bơi sóng sin (`fishSinusoidalSwim`), gà mổ thóc (`avianPeckWalk`), bé lon ton (`childToddleWalk`), cụ già chống gậy (`elderlyCaneWalk`).

- **Prompt AI & Giao diện:**
  - Mỗi mẫu tích hợp prompt tiếng Anh chuẩn tạo Sprite Sheet Atlas 5×5 ô trên phông xanh lá chroma-key (`#00FF00`), sơ đồ slot ô và hướng dẫn kỹ thuật nối khớp bo tròn (10–15% overlap) tại `TemplatePromptModal.tsx`.
  - Giao diện `CreateLayerAssemblyModal.tsx` mở khi bấm `+ Tạo mẫu mới` trong xưởng hoặc `Tạo lắp ráp` ở tab tài nguyên.

- **MCP Parity & Kiểm thử:**
  - Tools: `list_layer_assembly_templates`, `get_layer_assembly_template`, `apply_layer_assembly_template` tại `layerAssemblyTemplateCommands.ts` và `tools-layer-assembly.mjs`.
  - Tests: `layerAssemblyTemplates.test.ts`, `creatureRigPresets.test.ts`, `layerAssemblyTemplateCommands.test.ts`.
