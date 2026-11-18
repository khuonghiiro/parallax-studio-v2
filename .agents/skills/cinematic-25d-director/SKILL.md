---
name: cinematic-25d-director
description: Direct authentic 2.5D Donghua / anime scenes in Parallax Studio V2 — analyze image perspective corridors and vanishing points (analyze_scene_depth), slice multi-plane Z depth cutouts, move rigged 2.5D characters/creatures along true 1/(Z+d) perspective alleys with grounded feet, stage snappy hitstop combat, and choreograph professional camera routes (choreograph_camera_route: track_subject, whip_pan, punch_zoom, match_cut, orbit_parallax).
---

# Đạo Diễn Điện Ảnh & Hành Lang Chiều Sâu 2.5D (`cinematic-25d-director`)

Kích hoạt kỹ năng này bất cứ khi nào dựng cảnh phim hoạt ảnh 2.5D (Donghua / Anime / Motion Comic), tạo dự án demo, tách lớp bối cảnh mỹ thuật theo chiều sâu, điều hướng nhân vật / linh thú / quái vật 2.5D đi trong ngõ/hành lang phối cảnh, dàn dựng chiến đấu hoặc thiết kế lộ trình Camera 3D chuyên nghiệp.

---

## 1. Hiểu Chiều Sâu Bức Ảnh & Hành Lang Phối Cảnh (`analyze_scene_depth`)

Tuyệt đối **CẤM** cho nhân vật trượt ngang 2D (`depthMode: 'flat_2d'`) cắt qua đèn đá, bậc thang hoặc hành lang có phối cảnh hội tụ từ rộng vào hẹp!

### Quy trình bắt buộc trước khi đặt nhân vật vào ảnh nền:
1. **Đọc trực tiếp ảnh nền** (`read_file`) kết hợp gọi MCP `analyze_scene_depth` (hoặc hàm `analyzeShotDepthCorridor` trong [`./src/renderer/src/project/sceneDepthCorridor.ts`](../../../src/renderer/src/project/sceneDepthCorridor.ts)) với `applyDepthPortal: true`.
2. **Xác định 3 thông số hình học của bức tranh:**
   - **Đường chân trời & Điểm tụ (`vanishingPointUV`, `vanishingPointWorld`):** Toạ độ `(vpX, vpY)` nơi hai mép ngõ / bậc thang / mái hiên hội tụ ở xa.
   - **Trục lối đi thực tế trên mặt đất (`corridorWaypoints: [screenX, screenY][]`):** Chuỗi điểm đặt bàn chân trên mặt đường vẽ trong tranh (từ họng ngõ hẹp ở xa `Z ≈ 850..1050` uốn theo bậc đá về tiền cảnh rộng `Z ≈ 110..180`).
   - **Tỷ lệ thu hẹp hành lang (`widthNarrowingRatio`):** Tỷ số bề rộng lối đi ở xa chia cho tiền cảnh, quyết định biên độ `startZ → endZ`.
3. **Bù phối cảnh nghịch đảo chuẩn xác 100% (`depthMode: 'depth_corridor'`):**
   - Trong `PerspectiveCamera` (khoảng cách tham chiếu `refDist ≈ 1156.45` với `1080p`, `FOV 48°`), kích thước biểu kiến của cụm layer ở độ sâu `Z` tự co giãn theo quy luật:
     $$\text{apparentScale}(Z) = \text{baseWorldScale} \times \frac{\text{refDist}}{Z + \text{refDist}}$$
   - Khi dùng `depthMode: 'depth_corridor'` trên Node `v2:action:bbox_target` (hoặc `evaluatePerspectiveCorridorAt` / `projectCorridorFootToWorld`), engine giữ nguyên `worldScale = baseWorldScale` (tránh nhân đôi thu phóng!) và tự giải ngược `(worldX, worldY, Z)` sao cho **đế giày nhân vật (`corridorFootOffsetY`) luôn bám khít lên từng bậc đá** của `corridorWaypoints` và bước chân tuân theo tiến độ phối cảnh hyperbolic `1 / (Z + refDist)` (bước nhỏ khi ở sâu trong ngõ, sải rộng dần khi ra gần ống kính).

---

## 2. Phân Tầng Đa Lớp Chiều Sâu Z (Multi-Plane 2.5D Slicing)

Một cảnh 2.5D chuyên nghiệp bắt buộc có **tối thiểu 4–5 tầng Z tách biệt** để khi camera xoay/lia tạo độ trượt thị sai (Parallax) thật:

| Tầng không gian | Dải toạ độ `Z` khuyến nghị | Vai trò mỹ thuật & Ánh sáng |
| :--- | :--- | :--- |
| **1. Hậu cảnh xa (`skyFarZ`)** | `2200 .. 2600` | Nền trời, núi xa, họng đèo sâu; bật `physics.depthPortal` (`fogTint`, `strength: 0.45..0.65`) tại điểm tụ để sương mù ôm lấy lối đi. |
| **2. Trung cảnh xa (`archMidZ`)** | `550 .. 750` | Mây sương bán trong suốt (`mid-valley-mist.png`), cổng tháp xa — nhân vật ở `Z = 950` đi xuyên từ **sau** lớp sương này ra **trước** (`Z < 550`)! |
| **3. Hành lang nhân vật (`walkZ`)** | `960 → 115` | Nhân vật, linh thú, quái vật 2.5D di chuyển thực sự trong chiều sâu `Z` và đi ngang qua các lớp đạo cụ trung cảnh. |
| **4. Đạo cụ kẹp sườn (`flankZ`)** | `200 .. 380` | Cành tùng treo đèn (`mid-pine-lantern.png`), thạch đăng (`mid-stone-lantern.png`) gắn `virtualLight` (`candle` / `magic_orb`) chiếu sáng động lên nhân vật khi đi ngang qua độ sâu `Z` đó. |
| **5. Tiền cảnh che khuất (`occluderFgZ`)** | `-180 .. -260` | Cột đá vỡ (`fg-ruin-pillar.png`), trụ phù văn (`fg-seal-obelisk.png`) lướt nhanh qua mép khung hình khi camera lia ngang (`whip_pan` / `orbit_parallax`). |

> **Quy tắc tách nền Atlas:** Khi sinh đạo cụ tách lớp trên nền `#00FF00`, luôn khử tràn sắc lục (color-unmixing despill) để giữ nguyên quầng sáng ấm của lồng đèn và độ mờ sương lam mà không còn viền xanh neon.

---

## 3. Sinh Học Chuyển Động & Chiến Đấu Hoạt Ảnh Donghua

Tham chiếu [`./src/renderer/src/ui/layerAssembly/workshopWalkCycle.ts`](../../../src/renderer/src/ui/layerAssembly/workshopWalkCycle.ts) và [`./src/renderer/src/ui/layerAssembly/workshopCombatAndCreaturePresets.ts`](../../../src/renderer/src/ui/layerAssembly/workshopCombatAndCreaturePresets.ts):

1. **Khớp góc nhìn xương (`rigViewAngle`) với hướng đi trong không gian:**
   - Nhân vật đi từ trong ngõ sâu ra ngoài hoặc bước chéo vào sân: bắt buộc đặt `rigViewAngle: 'diagonal'` (hoặc `'front'`).
   - Nhân vật lao ngang giao kiếm: đặt `rigViewAngle: 'side'`.
2. **Liên tục khớp gối $C^1$ & Quán tính phụ (`bone-cape` / đuôi / bờm):**
   - Cẳng chân (`shin-l`, `shin-r`) phải uốn mượt theo hàm cos nâng bậc ($C^1$ smooth) gồm pha nhún giảm chấn khi chạm đất (`stanceCushion`) và pha gập gối nhấc chân vung tới (`swingLift`), cấm dùng hàm bậc thang gây giật khớp.
   - Áo choàng (`bone-cape`), đuôi (`bone-tail`) và bờm luôn trễ pha `0.35..0.85 rad` để tạo sóng quán tính mềm mại.
3. **Nhịp chiến đấu phi tuyến Donghua (Anticipation → 3-Frame Snap → Hitstop → Recovery):**
   - **Tụ lực (`0.00..0.27d`):** Thu hông lùi, nén gối, rút kiếm/trảo lấy đà (`ease-in-out`).
   - **Bung đòn chớp nhoáng (`0.27..0.35d`):** Phóng người chém hết biên độ chỉ trong 2–4 frame (`ease-out`).
   - **Khựng lực Hitstop (`0.35..0.46d`):** Giữ nguyên tư thế va chạm (`|Δrot| <= 2°`) đúng thời điểm kiếm khí / trảo chạm mục tiêu.
   - **Phối hợp 4 lớp tại điểm va chạm:** Đòn đánh của chủ thể (`combat` / `dodge_counter` / `martial_kick`) + Phản ứng trúng đòn của đối thủ (`hit_recoil` trượt lùi) + Node va chạm vật lý (`v2:collision:elastic_bounce`) + VFX tia lửa Additive (`vfx-impact-burst.png`).

---

## 4. Ngôn Ngữ Lộ Trình Camera Điện Ảnh (`choreograph_camera_route`)

Sử dụng MCP tool `choreograph_camera_route` hoặc hàm `choreographCinematicCameraRoute` trong [`./src/renderer/src/animation/cinematicCameraRoute.ts`](../../../src/renderer/src/animation/cinematicCameraRoute.ts). Cấm đặt chỉ 2 keyframe đầu-cuối tuyến tính đơn điệu cho cả phân cảnh!

### 6 nhịp máy quay chuẩn bắt buộc phối hợp:
1. **`establish_corridor` (Mở cảnh chiều sâu):** Đẩy dolly dọc trục ngõ/đèo từ trung cảnh vào sâu hành lang kết hợp nghiêng nhẹ `orbitDeg` để bóc tách các tầng sương và đèn đá.
2. **`track_subject` (Lia bám đối tượng có khoảng thở):** Bám theo `subjectPrefix` (ví dụ `act-hero-1`) với khoảng mở hướng nhìn phía trước (`leadRoomX: 70..115`, `leadRoomY`) để nhân vật không bị dính cứng giữa tâm khung hình.
3. **`whip_pan` (Lia vút chuyển tiêu điểm):** Quét nhanh ống kính từ nhân vật sang quái vật hoặc theo đường bay kiếm khí với quỹ đạo chữ S (`easeInOut` sắc), làm các cột đá tiền cảnh (`Z = -220`) vút qua tạo tốc độ thật.
4. **`punch_zoom` (Phóng to / Thu nhỏ dồn lực va chạm):** Ngay khoảnh khắc giao kiếm hoặc quái thú gầm rống (`impactTime`), phóng gắt vào tâm va chạm (`impactScale: 0.62..0.72`, thu hẹp `fovImpact: 34..38°`), nghiêng góc máy **Dutch Roll** (`rollImpact: ±2.5°..3.5°`), giữ khựng **Hitstop** (`hitstopSec: 0.12..0.16s`) kèm rung chấn giảm dần (`impactShakePx: 16..24`), rồi kéo giãn (`endScale: 0.94..1.02`) mở rộng chiến trường.
5. **`match_cut` (Nhảy tiếp hướng xuyên cảnh):** Cuối Cảnh $N$ tăng tốc lia theo vector `(exitVelocityX, exitVelocityY)` và đầu Cảnh $N+1$ đón tiếp cùng chiều chuyển động đó trong `0.25..0.35s` đầu tiên để mạch phim liền lạc như một cú máy liên hoàn.
6. **`orbit_parallax` (Lượn vòng cung khoe chiều sâu 2.5D):** Dích `pos.x` ngược pha với `target.x` (`orbitDeg: 6°..12°`) khi nhân vật đứng thủ thế hoặc tung tuyệt kỹ để làm nổi bật độ dày không gian 3D giữa tiền cảnh, nhân vật và hậu cảnh.
