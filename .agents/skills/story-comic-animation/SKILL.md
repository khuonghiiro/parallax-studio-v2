---
name: story-comic-animation
description: Turn any user story or plot script into a fast-paced 2D/2.5D Story-Driven Comic Animation video (YouTube Manhua / Shadiao / Xuyên Không style) in Parallax Studio V2 — sentence-beat pacing (2.2–3.5s/cut), dual world-vs-emotion backdrops (question_sky, speedlines_radial, spotlight_stage, anger_veins, comic_burst), System Quest Hologram UI, comedic/fear/rage acting presets (comic_shiver, system_pop_bounce, comedic_tumble_out, soul_escape_ascend, foreground_weapon_slam), 3-plane Z staging, and outlined narrator subtitles via stage_story_beat.
---

# Đạo Diễn Hoạt Ảnh Kể Chuyện & Hài Kịch 2.5D (`story-comic-animation`)

Kích hoạt kỹ năng này bất cứ khi nào người dùng đưa một **cốt truyện / kịch bản / ý tưởng truyện** (Xuyên không, Hệ thống, Tây Du, Tu tiên tấu hài, Manhua động / `动态漫` / `沙雕动画`) và yêu cầu tạo video hoạt ảnh kể chuyện sinh động kiểu YouTube.

---

## 1. Triết Lý Cốt Lõi: Nhịp Câu Thoại Quyết Định Nhịp Hình (Sentence-Beat Grammar)

Khác với video phong cảnh 2.5D lia máy chậm 5–8 giây, hoạt ảnh kể chuyện giữ chân người xem bằng **nhịp cắt theo từng câu dẫn truyện (`2.2s – 3.4s / nhịp`)**:

1. **Mỗi câu thoại = 1 Nhịp Hình Ảnh Độc Lập (`StoryComicBeatSpec`):** Trung bình 35 giây đầu phải có **9–11 nhịp cắt rõ ràng**. Mỗi khi câu dẫn truyện đổi cảm xúc (ngơ ngác → áp bức → tủi thân → nổi điên → ra đòn), khung hình phải đổi ngay lập tức.
2. **Luân phiên `55% Cảnh Thế Giới 3 Tầng Z` ⇄ `45% Nền Tâm Lý Truyện Tranh`:**
   - Khi diễn tả hành động vật lý (văng ra rừng, chỉ gậy quát mắng, bay lên mây, đập gậy): dùng **Bối cảnh Thế giới Cel-Shaded** có tối thiểu 3 tầng độ sâu (`Hậu cảnh núi/rừng Z = 1100..1500` + `Trung cảnh nhân vật Z = 120..280` + `Tiền cảnh bụi cỏ/binh khí Z = -80..-160`).
   - Khi nhấn mạnh tâm lý / tấu hài / sát khí: **tắt bối cảnh rừng/núi và bật ngay Nền Tâm Lý (`mood`)** của engine (`question_sky`, `speedlines_radial`, `spotlight_stage`, `anger_veins`, `comic_burst`) để cảm xúc đập thẳng vào mắt người xem mà không tốn thêm VRAM ảnh nền!
3. **Cắt cảnh dứt khoát (`transition_at_end: 'cut'`):** 90% điểm chuyển giữa các câu thoại dùng **Jump Cut (`cut`)** sắc gọn đúng nhịp ngắt câu; chỉ dùng `'flash_dissolve'` ở khoảnh khắc va chạm binh khí chí mạng.

---

## 2. Khuôn Vàng 10 Nhịp Cho 35 Giây Mở Màn (Golden 35s Storyboard Template)

Khi nhận cốt truyện từ người dùng, phân rã ngay mở màn thành chuỗi nhịp chuẩn sau (có thể co giãn 8–12 nhịp tuỳ độ dài cốt truyện):

| Nhịp | Thời lượng mẫu | Vai trò kể chuyện | `mood` (Bối cảnh) | `camera_grammar` & Diễn xuất Layer |
| :--- | :--- | :--- | :--- | :--- |
| **1. Hook Xuất Thế** | `0.0s – 2.8s` | Mở màn bất ngờ, nhân vật chính văng ra trong tình cảnh tréo ngoe. | `world` (Rừng/Động) | `cold_open_shock` + preset `comedic_tumble_out` trên nhân vật chính. |
| **2. Ngơ Ngác Nhận Thức** | `2.8s – 5.4s` | Chưa kịp hiểu chuyện gì, gãi đầu bối rối. | `world` + Cỏ mờ FG | `confused_push` + `emote_badge: "question_giant"` đặt ở lớp `Z` sau lưng nhân vật. |
| **3. Hệ Thống Giao Việc** | `5.4s – 8.6s` | Bảng Hệ Thống / Sứ giả hiện ra giao nhiệm vụ "tự sát". | `world` (Qua vai) | `over_shoulder_system` + `system_quest_title` / `system_quest_body` (`hologram_panel` bật nảy `system_pop_bounce`) + Linh vật bay `floating_hover`. |
| **4. Sốc Phản Hỏi** | `8.6s – 11.0s` | *"Ai cơ, tôi á?!"* — Cận cảnh ngơ ngác. | `question_sky` | `snap_reaction_zoom` phóng nhanh trong `0.2s` vào mặt nhân vật. |
| **5. Áp Bức Sát Khí** | `11.0s – 14.4s` | Tưởng tượng dàn Boss đối thủ khổng lồ nhìn xuống cười nham hiểm. | `speedlines_radial` | `low_angle_menace` + Boss ở trung cảnh gắn `emote_badge: "red_eye_flare"` + Nhân vật chính nhỏ xíu ôm đầu ở tiền cảnh dưới gắn `comic_shiver`. |
| **6. Spotlight Tủi Thân** | `14.4s – 17.2s` | Bi kịch hài: thân phận yếu ớt đáng thương dưới ánh đèn sân khấu tối. | `spotlight_stage` | `spotlight_pity_pull` kéo nhẹ góc cao + nhân vật quệt nước mắt. |
| **7. Boss Nổi Điên** | `17.2s – 20.0s` | Đối thủ tức giận phát điên vì bị trêu ngươi. | `anger_veins` | `rage_punch_shake` + rung chấn gắt + gân máu `💢` bốn góc. |
| **8. Đối Đầu Hiện Trường** | `20.0s – 24.4s` | Chạm mặt thật tại rừng/núi, đối thủ chĩa binh khí quát mắng. | `world` (Đồi thông) | `confrontation_push` đẩy từ trung cảnh vào cận cảnh theo mũi binh khí. |
| **9. Kinh Hoàng Phòng Thủ** | `24.4s – 27.4s` | Nạn nhân giơ tay chữ X che ngực, mặt tối sầm hoảng loạn. | `speedlines_radial` | `snap_reaction_zoom` + `emote_badge: "sweat_drop"` + `comic_shiver` (`18Hz`). |
| **10. Đào Thoát 3 Tầng Z & Đòn Tất Sát Tiền Cảnh** | `27.4s – 34.5s` | Nửa đầu: đại cảnh 3 tầng Z (Hậu cảnh giao chiến + Trung cảnh `soul_escape_ascend` bay lên mây + Tiền cảnh nhân vật chính hóng chuyện). Nửa sau: binh khí phóng chéo sát ống kính (`foreground_weapon_slam`). | `world` | `three_plane_escape` → cắt sang `foreground_weapon_slam` (`transition_at_end: "flash_dissolve"`). |

---

## 3. Quy Chuẩn Mỹ Thuật Tách Lớp Hoạt Ảnh Truyện Tranh (Cel-Shaded Cutout Standard)

1. **Phong cách nét vẽ & tô màu:**
   - Bắt buộc dùng **nét mực đen rõ ràng, liền lạc (`bold clean comic ink lineart`)** kết hợp tô mảng cel-shading tươi sáng 1–2 lớp bóng, dễ đọc ngay cả trên màn hình điện thoại nhỏ.
   - **Tương phản Thiết kế Nhân vật (Design Contrast Gag):** Nhân vật chính khi tấu hài/sợ hãi vẽ tỉ lệ **Chibi đơn giản biểu cảm cường điệu** (mắt đốm sáng xanh, miệng há rộng, tay xương gãi đầu); trong khi nhóm Đối thủ / Boss vẽ **tỉ lệ chi tiết hầm hố, đổ bóng hốc mắt sâu, nụ cười tà mị** để phóng đại sự chênh lệch sức mạnh.
2. **Tách nền `#00FF00` sạch tuyệt đối:**
   - Mọi nhân vật, linh vật Hệ Thống, đám mây và binh khí tiền cảnh sinh trên nền `#00FF00` phẳng tuyệt đối (không đổ bóng sàn, không dùng màu xanh lá chuối trên trang phục nhân vật — ưu tiên vàng kim, lam ngọc, tím sẫm, đỏ chu, trắng ngà), sau đó khử tràn sắc lục (chroma color-unmixing despill) ra PNG RGBA sắc nét.
3. **Bố cục 3 Tầng Chiều Sâu Z trong Cảnh Thế Giới:**
   - **Hậu cảnh (`Z = 1000..1400`):** Rừng cây, sườn đồi, dãy núi xa; có thể đặt chiến binh thu nhỏ ở `Z = 820..920` trong cảnh hỗn chiến.
   - **Trung cảnh (`Z = 140..280`):** Tuyến diễn xuất chính, bảng Hologram Hệ Thống (`Z = 190`), hồn phách bay lên mây (`Z = 240`).
   - **Tiền cảnh sát ống kính (`Z = -60..-160`):** Bụi cỏ mờ che góc, nhân vật chính thò đầu quan sát ở góc dưới phải (`[420, -240, -90]`), hoặc thanh binh khí khổng lồ bổ chéo từ góc trên trái xuống tâm dưới (`Z = -130`).

---

## 4. Công Cụ Engine & MCP Chuyên Dụng Trong Parallax Studio V2

Tham chiếu mã nguồn tại [`./src/renderer/src/animation/storyComicDirector.ts`](../../../src/renderer/src/animation/storyComicDirector.ts), [`./src/renderer/src/engine/comicMoodCanvases.ts`](../../../src/renderer/src/engine/comicMoodCanvases.ts) và [`./src/renderer/src/animation/comicMotionPresets.ts`](../../../src/renderer/src/animation/comicMotionPresets.ts):

1. **Dàn dựng nhanh từng nhịp cốt truyện (`stage_story_beat` / `stageStoryComicBeat`):**
   - Tự động chèn nền tâm lý (`question_sky`, `speedlines_radial`, `horror_bw_speedlines`, `spotlight_stage`, `anger_veins`, `comic_burst`), bảng Nhiệm Vụ Hệ Thống (`hologram_panel` hoặc màn hình minh hoạ nhiệm vụ bật nảy), huy hiệu biểu cảm (`question_giant` đặt sau lưng nhân vật lắc quả lắc, `anger_cross`, `sweat_drop`, `red_eye_flare`), **phụ đề dẫn truyện viền đôi phát sáng** (`strokeColor: '#0a3d6e'`, `strokeWidth: 6`, `glowColor: '#38bdf8'`) tự động neo ở mặt phẳng tiền cảnh `z = -320` (`autoScale: true`) để không bao giờ bị nhân vật hay vũ khí đè chữ.
   - Ví dụ CLI:
     ```powershell
     pnpm pxs call stage_story_beat '{"shot_id":"shot-2","start_time":11.6,"end_time":15.6,"narration":"Đi chặn đường đoàn đội Đường Tăng?","mood":"speedlines_radial","camera_grammar":"low_angle_menace","emote_badge":"red_eye_flare"}'
     ```
2. **Quy Chuẩn Camera 2D Mượt 1 Chiều & Cắt Nhịp Liền Mạch `0ms Gap` (`applyStoryComicCamera` — BẮT BUỘC):**
   - **Cấm xoay nghiêng 3D (`yaw = 0, pitch = 0, roll = 0` tuyệt đối):** Các lớp nhân vật truyện tranh 2D phải luôn song song với ống kính; tạo chiều sâu bằng dịch chuyển `X / Y / Scale` thay vì nghiêng góc 3D làm méo hình.
   - **Chuyển động 1 chiều đơn điệu trong mỗi nhịp:** Trong 1 câu thoại (`2.4s–3.4s`), camera chỉ đi **1 chiều duy nhất** (`Push-In` êm, `Pull-Out` chậm, `Pan` theo nhân vật, hoặc `Snap Zoom` trong `0.16s` rồi trượt giữ nhịp) — **TUYỆT ĐỐI CẤM zoom phóng vào rồi lại zoom lùi ra ngay trong cùng 1 câu thoại**.
   - **Không để khe hở thời gian giữa 2 nhịp (`0ms gap`):** Nhịp sau phải bắt đầu đúng bằng giây kết thúc của nhịp trước (`start_next === end_prev`, keyframe cuối nhịp đặt tại `end - 0.001` với `ease: 'hold'`) để không bao giờ bị chớp đen hay trượt máy quay giữa 2 cảnh.
3. **Chống Lộ Đường Cắt Nửa Nhân Vật & Chuẩn Hoá Tỷ Lệ Nhân Vật (`anchorBustLayerToFrameBottom` + `characterScaleNormalizer.ts` — BẮT BUỘC):**
   - **Chuẩn hoá kích thước nhân vật giữa mọi cảnh (`applyNormalizedCharacterStaging`):** Tuyệt đối KHÔNG gán `scale` tuỳ tiện làm cùng một nhân vật lúc phình to khổng lồ lúc teo nhỏ vô lý. Bắt buộc phân hạng cơ thể (`petite_chibi` `510px` cho Tiểu Khô Lâu/Robot, `standard_human` `650px` cho Bạch Cốt Tinh/Đường Tăng, `hero_warrior` `700px` cho Ngộ Không, `boss_imposing` `820px` cho Đoàn 4 Thầy Trò/Cự Thú, `distant_mini` `210px` cho nhóm toàn thân đồi xa) kết hợp cỡ cảnh điện ảnh (`WS = 0.82x`, `MS = 1.0x`, `MCU = 1.12x`, `CU = 1.22x`).
   - **Khoá mép đáy không làm méo tỷ lệ (`anchorBustLayerToFrameBottom`):** Chỉ dịch `pos[1]` xuống sát đáy khung hình `16:9` (`<= -580px`) để giấu đường cắt ngang bụng, tuyệt đối không tự ý phóng đại `scale` của nhân vật nhỏ.
4. **Hệ Thống Node / Timeline Vietsub Gắn Từng Đối Tượng & Đồng Bộ Thời Gian Hội Thoại (`subtitleAndDialogueSync.ts` — BẮT BUỘC):**
   - Mỗi câu thoại gắn trực tiếp vào nhân vật nói (`speakerLayerId = subjectId`), tự động sinh **Node `💬 Vietsub` (`logicCategory: 'subtitle'`)** nối vào nhân vật trên Workflow V2 và thanh phụ đề trên Timeline.
   - Hỗ trợ chỉnh `fontFamily`, `fontSize`, `fontWeight`, `color`, `strokeColor`, `strokeWidth`, `boxColor`, `boxOpacity`, `positionPreset` (`bottom_center`, `top_center`, `above_speaker`, `below_speaker`, `speech_left`, `speech_right`, `custom`), `enterEffect` (`fade`, `pop_bounce`, `slide_up`), `exitEffect` (`fade`, `slide_down`, `scale_out`).
   - **Áp dụng cho toàn bộ (`Apply to All`) & Bảo vệ Node Đặc Biệt (`preserveCustomSettings: true` 🔒):** Các câu thoại đặc biệt (`comic_shout` quát lớn, `inner_thought` độc thoại nội tâm, `system_hologram` bảng hệ thống) bật `preserveCustomSettings: true` để khi người dùng bấm **"Áp dụng cấu hình cho toàn bộ Vietsub"**, các node đặc biệt này giữ nguyên thiết kế riêng không bị ghi đè.
   - **Đồng bộ Thời lượng Thoại + Audio + Hình ảnh Nhân vật (`enforceSpeakerAndSceneContinuity` & `validateAndRepairDialogueContinuity`):** Thời gian hiển thị của nhân vật và mốc chuyển cảnh phải luôn bao trọn `[timeStart, timeEnd]` của cả Node Vietsub lẫn Node Audio Thoại — tuyệt đối không để nhân vật đang nói dở câu đã bị nhảy sang hình khác hoặc tắt hình sớm.
5. **13 Preset Xuất Hiện (Mờ → Đậm), Biến Mất (Đậm → Nhạt) & Diễn Đạt Cảm Xúc Điện Ảnh (`apply_motion_preset` / `generatePresetSpatialTracks`):**
   - `fade_materialize_in`: Nhân vật hiện hình mượt mà từ mờ sang đậm (`opacity: 0 → 1`) kèm nhịp thở sống động, và mờ dần từ đậm sang nhạt (`1 → 0`) khi rời cảnh.
   - `thought_vision_manifest`: Khi nhân vật suy nghĩ / tưởng tượng (VD: Tiểu Khô Lâu nghĩ tới 4 thầy trò Đường Tăng), hư ảnh hiện dần từ làn sương mờ sang đậm (`opacity: 0 → 0.88`), trôi lơ lửng phía trên rồi tan biến từ đậm sang nhạt (`0.88 → 0`).
   - `oppressive_tower_grow` ⇄ `oppressed_shrink_tremble` (**Cặp tương phản Áp Bức Tăng Dần**): Nhóm đối thủ áp đảo hiện từ mờ sang đậm, **dâng cao dần lên (`+75px`) và phình to dần (`0.88x → 1.28x`)**, trong khi nhân vật yếu thế ở tiền cảnh **co rúm nhỏ dần (`1.05x → 0.74x`), tụt thấp xuống và run cầm cập `16Hz`** dưới góc máy Low Angle (`oppressive_low_push`).
   - `comedic_tumble_out`: Văng xoay nhào từ làn khói / mông cự thú ra tiền cảnh rồi nảy nhẹ trên mặt đất (Nhịp Hook mở màn).
   - `pop_up_bottom`: Nhân vật bán thân trồi nảy đàn hồi từ dưới mép khung hình lên kèm fade-in mượt mà, giữ mép cắt hông luôn khuất dưới đáy màn hình.
   - `slide_in_side`: Linh vật Robot Hệ Thống hoặc nhân vật phụ lướt ngang từ cạnh màn hình vào với nhịp phanh đàn hồi rồi nhấp nhô nhẹ.
   - `pendulum_question`: Dấu hỏi `?` khổng lồ bật lên từ **phía sau lưng** nhân vật rồi nghiêng qua lại như quả lắc ngơ ngác.
   - `anger_vein_throb`: Nhịp đập co giãn dồn dập kèm rung nhẹ khi nhân vật tức giận vò đầu phát điên.
   - `system_pop_bounce`: Bật nảy đàn hồi `8% → 108% → 97% → 100%` cho bảng Hệ Thống và ký hiệu biểu cảm.
   - `comic_shiver`: Run cầm cập `18Hz` biên độ nhỏ kèm co rúm người khi khiếp sợ tột độ.
   - `soul_escape_ascend`: Giải thi thuật / Hồn phách bay vút từ biển mây trắng đáy màn hình lên chín tầng mây và mờ dần.
   - `foreground_weapon_slam`: Binh khí phóng đại phối cảnh bổ chéo vào tiền cảnh, giữ khựng lực **Hitstop (`hold`)** tại điểm va chạm rồi giật nhẹ.
6. **Đồng bộ Workflow V2 & Kiểm tra Trực quan:**
   - Gắn thêm các Node đơn trách nhiệm (`v2:subtitle:*`, `v2:audio:voice`, `v2:fx:pulse`, `v2:action:sway`, `v2:action:float`) cho từng đối tượng, chạy `validateAndRepairDialogueContinuity(project, true)` + `syncWorkflowV2Graph(project)` và chụp kiểm tra các nhịp bằng `get_viewport_screenshot` để đảm bảo: (a) kích thước nhân vật nhất quán giữa mọi cảnh, (b) không lộ mép cắt ngang người, (c) không nhảy hình khi nhân vật chưa nói xong Vietsub/Audio, (d) camera mượt và phụ đề rõ nét.
