/**
 * Tool specs — FX, keyframes, camera, look/audio, timeline and export (bilingual, see shared.mjs).
 */
import { L, atTime, ease, vec3, z } from './shared.mjs'

const fxId = (d) => z.string().describe(d('ID of the applied effect (e.g. "fx-abc123").', 'ID hiệu ứng đã áp (vd "fx-abc123").'))

const keyTarget = (d) => ({
  target: z.enum(['layer', 'camera', 'shot']),
  id: z.string().optional().describe(d('Layer id or shot id (not needed for camera).', 'Id layer hoặc id shot (camera thì không cần).')),
  property: z
    .string()
    .describe(
      d(
        'layer: position|rotation|scale|opacity · camera: position|target|fov|focus_distance|aperture|fade · shot: position|rotation',
        'layer: position|rotation|scale|opacity · camera: position|target|fov|focus_distance|aperture|fade · shot: position|rotation'
      )
    )
})

const audioTrackId = (d, en, vi) => z.string().describe(d(en, vi))

export const FX_TOOLS = [
  {
    name: 'set_layer_motion', cat: 'fx',
    doc: L(
      'Compatibility tool: edit the first Motion effect (creates one if absent); use apply_layer_fx and update_layer_fx for multiple effects. Configure procedural Motion Effect Controls on one layer, additive to existing transform keyframes. Type changes reset defaults; patches preserve other settings. Supports undo/redo. Does not create keyframes.',
      'Tool tương thích: chỉnh Motion đầu tiên (tạo nếu chưa có); dùng apply_layer_fx và update_layer_fx cho nhiều hiệu ứng. Chỉnh Motion Effect Controls trên một layer, cộng vào keyframe Transform hiện có. Đổi loại đặt lại mặc định; sửa từng tham số giữ các mục khác. Hỗ trợ undo/redo. Không tạo keyframe.'
    ),
    shape: (d) => ({
      layer_id: z.string(),
      type: z.enum(['none', 'drift', 'wind', 'sway', 'float', 'wiggle', 'pulse']).optional().describe(d('Motion type.', 'Loại chuyển động.')),
      enabled: z.boolean().optional().describe(d('Bypass without losing settings.', 'Bật/tắt mà vẫn giữ thông số.')),
      reset: z.boolean().optional().describe(d('Reset current/selected type before applying parameters.', 'Đặt lại loại hiện tại/được chọn trước khi áp tham số.')),
      speed: z.number().min(0).optional().describe(d('World units/sec for drift, Hz otherwise.', 'Đơn vị không gian/giây với drift, Hz với các loại khác.')),
      amplitude: vec3.optional().describe(d('[X,Y,Z rotation degrees]; pulse X/Y are scale fractions; drift Y is perpendicular sway, X fallback span; float ignores Z.', '[X,Y,góc xoay Z độ]; pulse X/Y là tỉ lệ co giãn; drift Y là dao động vuông góc, X dự phòng quãng đường; float bỏ qua Z.')),
      amount: z.number().min(0).max(1).optional().describe(d('Overall strength 0..1.', 'Cường độ tổng 0..1.')),
      phase: z.number().optional().describe(d('Radians; drift UV/continuous uses world units.', 'Radian; drift UV/continuous dùng đơn vị không gian.')),
      seed: z.number().int().min(0).max(999999).optional().describe(d('Deterministic Wiggle seed.', 'Seed cố định của Wiggle.')),
      start_time: z.number().min(0).optional().describe(d('Composition start time in seconds.', 'Thời điểm bắt đầu trên timeline, giây.')),
      duration: z.number().min(0).optional().describe(d('Seconds; 0 unlimited, returns to base transform at end.', 'Giây; 0 vô hạn, trở về Transform gốc khi kết thúc.')),
      fade_in: z.number().min(0).optional().describe(d('Smooth strength entrance in seconds.', 'Tăng cường độ mềm, giây.')),
      fade_out: z.number().min(0).optional().describe(d('Smooth strength exit, requires duration > 0.', 'Giảm cường độ mềm, cần duration > 0.')),
      direction: z.union([z.number(), z.enum(['right','up-right','up','up-left','left','down-left','down','down-right'])]).optional().describe(d('Drift angle: 0 right, 90 up, or named direction.', 'Góc trôi: 0 phải, 90 lên, hoặc tên hướng.')),
      loop_mode: z.enum(['uv', 'wrap', 'ping-pong', 'continuous']).optional().describe(d('Drift loop mode; wrap aliases uv.', 'Kiểu lặp drift; wrap tương đương uv.')),
      loop_width: z.number().min(0.01).optional().describe(d('Ping-pong full span in world units.', 'Toàn bộ quãng đường ping-pong, đơn vị không gian.'))
    }),
    example: '{"layer_id":"layer-1","type":"wiggle","speed":1.5,"amplitude":[15,15,2],"seed":42,"duration":4,"fade_in":0.5,"fade_out":0.5}'
  },
  {
    name: 'get_layer_motion', cat: 'fx',
    doc: L('Read Motion settings and evaluated offsets at a timeline time.', 'Đọc thông số Motion và độ dịch chuyển đã tính tại một thời điểm timeline.'),
    shape: (d) => ({ layer_id: z.string(), time: z.number().optional().describe(d('Seconds; defaults to playhead.', 'Giây; mặc định theo playhead.')) }),
    example: '{"layer_id":"layer-1","time":1}'
  },
  {
    name: 'apply_layer_fx', cat: 'fx',
    doc: L(
      'Add an effect instance and return fx_id. Motion presets: motionDrift, motionWind, motionSway, motionFloat, motionWiggle, motionPulse (edit with update_layer_fx). Animation or neon presets: "neonBreathe" (soft breathing neon edge glow), "neonBlink" (blinking neon outline), "neonFlicker" (flickering neon sign), "neonSolid" (constant neon outline), "blink" (opacity blink), "fadeIn", "fadeOut", "breathe", "shake", "popIn", "pulse".',
      'Thêm hiệu ứng và trả fx_id. Preset Motion: motionDrift, motionWind, motionSway, motionFloat, motionWiggle, motionPulse (chỉnh qua update_layer_fx). Preset hoạt ảnh hoặc neon: "neonBreathe" (viền neon thở nhẹ), "neonBlink" (viền neon nhấp nháy), "neonFlicker" (biển neon chập chờn), "neonSolid" (viền neon cố định), "blink" (nhấp nháy độ mờ), "fadeIn", "fadeOut", "breathe", "shake", "popIn", "pulse".'
    ),
    shape: (d) => ({
      layer_id: z.string(),
      preset: z
        .enum(['neonBreathe', 'neonBlink', 'neonFlicker', 'neonSolid', 'blink', 'fadeIn', 'fadeOut', 'breathe', 'shake', 'popIn', 'pulse', 'motionDrift', 'motionWind', 'motionSway', 'motionFloat', 'motionWiggle', 'motionPulse'])
        .describe(d('Animation / Glow FX preset name.', 'Tên preset hiệu ứng chuyển động / phát sáng.')),
      time: z.number().optional().describe(d('Start time in seconds (default: current playhead time).', 'Thời điểm bắt đầu, giây (mặc định: vị trí playhead).')),
      duration: z.number().optional().describe(d('Effect duration in seconds (default depends on preset, e.g. 1.0s).', 'Thời lượng hiệu ứng, giây (mặc định tùy preset, vd 1.0s).')),
      blinks: z.number().int().optional().describe(d('For "blink" / "neonBlink": number of flash cycles (default: 4).', 'Với "blink" / "neonBlink": số chu kỳ nháy (mặc định 4).')),
      intensity: z.number().optional().describe(d('For "shake" or neon intensity multiplier.', 'Cho "shake" hoặc hệ số cường độ neon.'))
    }),
    example: '{"layer_id":"layer-1","preset":"fadeIn","time":0,"duration":1}'
  },
  {
    name: 'toggle_layer_fx', cat: 'fx',
    doc: L('Toggle an applied effect on/off by fx_id.', 'Bật/tắt một hiệu ứng đã áp theo fx_id.'),
    shape: (d) => ({
      layer_id: z.string(),
      fx_id: fxId(d),
      enabled: z.boolean().describe(d('true to enable, false to disable.', 'true để bật, false để tắt.'))
    })
  },
  {
    name: 'remove_layer_fx', cat: 'fx',
    doc: L(
      'Delete an applied effect permanently from a layer and clean up its keyframes or glow.',
      'Xóa hẳn một hiệu ứng khỏi layer và dọn keyframe hoặc glow liên quan.'
    ),
    shape: (d) => ({ layer_id: z.string(), fx_id: fxId(d) })
  },
  {
    name: 'set_layer_glow', cat: 'fx',
    doc: L(
      'Configure neon edge glow (outline glow) following the alpha silhouette of a layer. Supports outer, inner, or both sides with optional breathing, blinking, or flickering animation.',
      'Cấu hình viền neon (outline glow) bám theo đường viền alpha của layer. Hỗ trợ phía ngoài, trong hoặc cả hai, kèm hiệu ứng thở, nhấp nháy hoặc chập chờn.'
    ),
    shape: (d) => ({
      layer_id: z.string(),
      enabled: z.boolean().optional().describe(d('Enable or disable edge glow (default true).', 'Bật hoặc tắt viền phát sáng (mặc định true).')),
      start_time: z.number().optional().describe(d('Start time in seconds for glow (default: current playhead time or 0).', 'Thời điểm bắt đầu glow, giây (mặc định: playhead hoặc 0).')),
      duration: z.number().optional().describe(d('Duration in seconds (0 = active until end of layer).', 'Thời lượng, giây (0 = kéo dài tới hết layer).')),
      side: z.enum(['outer', 'inner', 'both']).optional().describe(d('Glow placement relative to alpha silhouette (default: outer).', 'Vị trí glow so với viền alpha (mặc định: outer).')),
      color: z.string().optional().describe(d('Hex color for the neon edge glow (default: "#3dd6f5").', 'Màu hex của viền neon (mặc định "#3dd6f5").')),
      thickness: z.number().optional().describe(d('Edge glow thickness/radius in pixels (1-40, default: 8).', 'Độ dày/bán kính viền, pixel (1-40, mặc định 8).')),
      intensity: z.number().optional().describe(d('Neon brightness/intensity multiplier (0.1-3.0, default: 1.2).', 'Hệ số độ sáng neon (0.1-3.0, mặc định 1.2).')),
      animated: z.enum(['none', 'blink', 'breathe', 'flicker']).optional().describe(d('Dynamic animation mode (default: none).', 'Chế độ chuyển động (mặc định: none).')),
      speed: z.number().optional().describe(d('Animation frequency/speed in Hz (default: 2.0).', 'Tần số/tốc độ chuyển động, Hz (mặc định 2.0).')),
      min_intensity: z.number().optional().describe(d('Minimum brightness during blink/breathe (0.0-1.0, default: 0.15).', 'Độ sáng tối thiểu khi nháy/thở (0.0-1.0, mặc định 0.15).'))
    }),
    example: '{"layer_id":"layer-1","color":"#ff3df0","animated":"breathe"}'
  },

  // ---- keyframes
  {
    name: 'set_keyframe', cat: 'keyframes',
    doc: L(
      'Add or replace a keyframe. value is a number (opacity, fov, focus_distance, aperture, fade) or [x, y, z].',
      'Thêm hoặc thay keyframe. value là số (opacity, fov, focus_distance, aperture, fade) hoặc [x, y, z].'
    ),
    shape: (d) => ({
      ...keyTarget(d),
      time: z.number().optional().describe(d('Seconds; default current time.', 'Giây; mặc định thời điểm hiện tại.')),
      value: z.union([z.number(), vec3]),
      ease_options: z.object({
        cycles: z.number().int().min(1).max(30).optional().describe(d('Pulse or blink count per segment.', 'Số nhịp đập hoặc nháy trong đoạn.')),
        strength: z.number().min(0).max(1).optional().describe(d('Smooth easing strength, 0–1.', 'Độ mượt, 0–1.')),
        holdUntil: z.number().min(.01).max(1).optional().describe(d('Fraction of segment held before jumping.', 'Tỉ lệ đoạn giữ nguyên trước khi nhảy.')),
        duty: z.number().min(.05).max(.95).optional().describe(d('Fraction of each blink spent at the start value.', 'Tỉ lệ mỗi nhịp nháy ở giá trị đầu.'))
      }).optional().describe(d('Outgoing segment parameters, persisted with this key.', 'Thông số đoạn đi ra, lưu cùng mốc này.')),
      boundary: z.enum(['start', 'end']).optional().describe(d('Timeline interval boundary; start preserves the preceding pose, end must follow start.', 'Biên đoạn timeline; start giữ trạng thái trước đó, end phải sau start.')),
      ease: ease.optional().describe(d('Outgoing interpolation, including boundary:start. linear = constant speed; easeInOut = smooth; hold = keep start until the next key then jump; pulse = three arrivals at the destination, ending there (not audio-synced).', 'Nội suy đi ra, kể cả boundary:start. linear = đều; easeInOut = mượt; hold = giữ đầu đến mốc sau rồi nhảy; pulse = ba lần tới đích, kết thúc tại đích (không đồng bộ âm thanh).'))
    }),
    example: '{"target":"layer","id":"layer-1","property":"position","time":2,"value":[0,0,300],"ease":"easeInOut"}'
  },
  {
    name: 'remove_keyframe', cat: 'keyframes',
    doc: L('Remove one keyframe by key_id or time.', 'Xóa một keyframe theo key_id hoặc time.'),
    shape: (d) => ({ ...keyTarget(d), key_id: z.string().optional(), time: z.number().optional() })
  },
  {
    name: 'clear_keyframes', cat: 'keyframes',
    doc: L(
      'Remove all keyframes of a property (or of every property of the target if property is omitted). The value at the current time is kept.',
      'Xóa mọi keyframe của một thuộc tính (hoặc mọi thuộc tính của đối tượng nếu bỏ trống property). Giá trị tại thời điểm hiện tại được giữ lại.'
    ),
    shape: () => ({ target: z.enum(['layer', 'camera', 'shot']), id: z.string().optional(), property: z.string().optional() })
  },

  // ---- camera
  {
    name: 'set_camera', cat: 'camera',
    doc: L(
      'Set camera properties (world space). Animated properties get a key at the current time (or at_time).',
      'Đặt thuộc tính camera (không gian thế giới). Thuộc tính đã có animation sẽ được ghi key tại thời điểm hiện tại (hoặc at_time).'
    ),
    shape: (d) => ({
      position: vec3.optional(),
      target: vec3.optional().describe(d('Point the camera looks at.', 'Điểm camera nhìn vào.')),
      fov: z.number().optional(),
      focus_distance: z.number().optional(),
      aperture: z.number().optional().describe(d('Depth-of-field blur strength (0–1).', 'Độ nhòe trường ảnh (0–1).')),
      fade: z.number().min(0).max(1).optional().describe(d('Fade to black.', 'Mờ dần sang đen.')),
      dof_enabled: z.boolean().optional(),
      shake_amount: z.number().optional(),
      shake_speed: z.number().optional(),
      at_time: atTime(d),
      ease: ease.optional()
    })
  },
  {
    name: 'apply_camera_preset', cat: 'camera',
    doc: L('Replace the camera move with a classic preset, framed on a shot.', 'Thay chuyển động camera bằng một preset kinh điển, đóng khung vào một shot.'),
    shape: (d) => ({
      preset: z.enum(['dollyIn', 'dollyOut', 'truckLeft', 'truckRight', 'craneUp', 'craneDown', 'orbitLeft', 'orbitRight', 'zoomIn', 'dollyZoom', 'reset']),
      shot_id: z.string().optional(),
      start: z.number().optional(),
      end: z.number().optional(),
      intensity: z.number().optional().describe(d('1 = default amount.', '1 = mức mặc định.'))
    }),
    example: '{"preset":"dollyIn","shot_id":"shot-1","start":0,"end":4}'
  },
  {
    name: 'camera_fly_to_shot', cat: 'camera',
    doc: L(
      'Key the camera to frame a shot at `time` (After Effects style "fly here"). With duration, the move starts duration seconds earlier.',
      'Ghi key để camera đóng khung một shot tại `time` (kiểu "fly here" của After Effects). Có duration thì chuyển động bắt đầu sớm hơn duration giây.'
    ),
    shape: () => ({ shot_id: z.string(), time: z.number().optional(), duration: z.number().optional(), ease: ease.optional() })
  },
  {
    name: 'build_camera_path', cat: 'camera',
    doc: L(
      'Replace the camera animation with a tour through shots: hold on each shot (slow push-in), then transition to the next. Sets the comp duration to fit by default.',
      'Thay animation camera bằng hành trình qua các shot: dừng ở mỗi shot (đẩy vào chậm) rồi chuyển sang shot kế. Mặc định tự đặt thời lượng composition cho vừa.'
    ),
    shape: (d) => ({
      steps: z
        .array(
          z.object({
            shot_id: z.string(),
            hold: z.number().optional().describe(d('Seconds on this shot (default 3).', 'Số giây dừng ở shot này (mặc định 3).')),
            transition: z.enum(['fly', 'arc', 'cut', 'fade']).optional().describe(d('Transition INTO the next step.', 'Kiểu chuyển SANG bước kế tiếp.')),
            transition_duration: z.number().optional()
          })
        )
        .min(1),
      push_in: z.number().min(0).max(0.5).optional(),
      start_at: z.number().optional(),
      fit_duration: z.boolean().optional()
    }),
    example: '{"steps":[{"shot_id":"shot-1","hold":3,"transition":"fly"},{"shot_id":"shot-2","hold":3}]}'
  },

  // ---- look & audio
  {
    name: 'set_look', cat: 'look_audio',
    doc: L('Global grading & atmosphere.', 'Chỉnh màu tổng thể & không khí (sương mù, vignette, grain).'),
    shape: () => ({
      fog_enabled: z.boolean().optional(),
      fog_color: z.string().optional(),
      fog_near: z.number().optional(),
      fog_far: z.number().optional(),
      vignette: z.number().optional(),
      grain: z.number().optional(),
      exposure: z.number().optional(),
      contrast: z.number().optional(),
      saturation: z.number().optional()
    })
  },
  {
    name: 'set_audio', cat: 'look_audio',
    doc: L('Set the soundtrack from an audio file, adjust offset/volume, or remove it.', 'Đặt nhạc nền từ file âm thanh, chỉnh offset/âm lượng, hoặc gỡ bỏ.'),
    shape: (d) => ({
      file_path: z.string().optional(),
      offset: z.number().optional().describe(d('Seconds; positive delays the audio.', 'Giây; dương = âm thanh vào trễ hơn.')),
      volume: z.number().min(0).max(1).optional(),
      remove: z.boolean().optional()
    })
  },
  {
    name: 'get_audio_info', cat: 'look_audio',
    doc: L(
      'Get overview of all audio tracks in the project timeline, including duration, offset, volume, and playback parameters.',
      'Tổng quan mọi track âm thanh trên timeline: thời lượng, offset, âm lượng và thông số phát.'
    ),
    shape: () => ({})
  },
  {
    name: 'add_audio_track', cat: 'look_audio',
    doc: L('Add an audio track from a file or existing project asset at a specific timeline offset, optionally bound to a character, 3D model, or layer.', 'Thêm track âm thanh từ file hoặc asset có sẵn tại một vị trí trên timeline, có thể gắn cho nhân vật, 3D hoặc layer.'),
    shape: (d) => ({
      file_path: z.string().optional().describe(d('Path to an audio file on disk (mp3, wav, aac, ogg).', 'Đường dẫn file âm thanh (mp3, wav, aac, ogg).')),
      asset_id: z.string().optional().describe(d('ID of an existing audio asset already in the project.', 'ID asset âm thanh đã có trong dự án.')),
      name: z.string().optional(),
      offset: z.number().optional().describe(d('Timeline start time in seconds (defaults to current playhead).', 'Thời điểm bắt đầu trên timeline, giây (mặc định: playhead).')),
      volume: z.number().min(0).max(1).optional().describe(d('Volume (0 to 1, default 1).', 'Âm lượng (0 đến 1, mặc định 1).')),
      muted: z.boolean().optional(),
      loop: z.boolean().optional(),
      fade_in: z.number().optional().describe(d('Fade-in duration in seconds.', 'Thời lượng fade-in, giây.')),
      fade_out: z.number().optional().describe(d('Fade-out duration in seconds.', 'Thời lượng fade-out, giây.')),
      playback_rate: z.number().optional().describe(d('Speed factor (0.25 to 4.0).', 'Hệ số tốc độ (0.25 đến 4.0).')),
      target_type: z.enum(['character', 'layer', 'model3d', 'ambient']).optional().describe(d('Target category: character, model3d, layer, or ambient.', 'Loại mục tiêu: nhân vật, mô hình 3D, layer, hoặc âm thanh chung.')),
      target_id: z.string().optional().describe(d('ID of the target entity (instanceId for character/3D model, or layer ID).', 'ID của thực thể mục tiêu (instanceId của nhân vật/khối 3D, hoặc layer ID).')),
      target_name: z.string().optional().describe(d('Display name of the target entity.', 'Tên hiển thị của thực thể mục tiêu.')),
      target_shot_id: z.string().optional().describe(d('Shot containing the target entity.', 'ID phân cảnh chứa đối tượng mục tiêu.')),
      character_role: z.enum(['voice', 'sfx', 'footstep', 'foley', 'bgm']).optional().describe(d('Audio role: voice dialogue, sound effects, footsteps, foley, or theme music.', 'Vai trò âm thanh: thoại/lồng tiếng, hiệu ứng, bước chân, foley hoặc nhạc chủ đề.')),
      lip_sync: z.boolean().optional().describe(d('Enable audio-driven mouth animation (lip-sync).', 'Bật cử động hé mở khẩu hình miệng theo âm thanh.')),
      lip_sync_intensity: z.number().min(0.1).max(3.0).optional().describe(d('Mouth opening intensity multiplier (default 1.0).', 'Hệ số độ mở miệng (mặc định 1.0).'))
    }),
    example: '{"file_path":"D:/music/voice.mp3","target_type":"character","character_role":"voice","lip_sync":true}'
  },
  {
    name: 'update_audio_track', cat: 'look_audio',
    doc: L(
      'Update parameters of an audio track: volume, offset, mute, loop, speed, fade, duration, target binding, or lip-sync.',
      'Cập nhật thông số track âm thanh: âm lượng, offset, tắt tiếng, lặp, tốc độ, fade, thời lượng, liên kết mục tiêu hoặc khẩu hình miệng.'
    ),
    shape: (d) => ({
      track_id: audioTrackId(d, 'Track ID or "main" for the primary audio track.', 'ID track hoặc "main" cho track chính.'),
      name: z.string().optional(),
      offset: z.number().optional().describe(d('Start time on timeline (seconds).', 'Thời điểm bắt đầu trên timeline (giây).')),
      volume: z.number().min(0).max(1).optional(),
      muted: z.boolean().optional(),
      loop: z.boolean().optional(),
      playback_rate: z.number().optional(),
      fade_in: z.number().optional(),
      fade_out: z.number().optional(),
      trim_in: z.number().optional(),
      duration: z.number().optional(),
      gain_db: z.number().optional().describe(d('dB offset (-24 to +12).', 'Độ lệch dB (-24 đến +12).')),
      target_type: z.enum(['character', 'layer', 'model3d', 'ambient']).optional(),
      target_id: z.string().optional(),
      target_name: z.string().optional(),
      character_role: z.enum(['voice', 'sfx', 'footstep', 'foley', 'bgm']).optional(),
      lip_sync: z.boolean().optional(),
      lip_sync_intensity: z.number().min(0.1).max(3.0).optional()
    })
  },
  {
    name: 'delete_audio_track', cat: 'look_audio',
    doc: L('Remove an audio track from the project by its ID.', 'Xóa một track âm thanh khỏi dự án theo ID.'),
    shape: (d) => ({ track_id: audioTrackId(d, 'Track ID to remove (or "main").', 'ID track cần xóa (hoặc "main").') })
  },
  {
    name: 'duplicate_audio_track', cat: 'look_audio',
    doc: L('Duplicate an audio track in the project at an optional timeline delta.', 'Nhân bản track âm thanh, có thể dời theo một khoảng thời gian.'),
    shape: (d) => ({
      track_id: audioTrackId(d, 'Track ID to duplicate.', 'ID track cần nhân bản.'),
      offset_delta: z.number().optional().describe(d('Seconds to shift the duplicate track (default 0.5s).', 'Số giây dời bản sao (mặc định 0.5s).'))
    })
  },
  {
    name: 'split_audio_track', cat: 'look_audio',
    doc: L('Split an audio track into two separate tracks at a given timeline time.', 'Cắt một track âm thanh thành hai track tại một thời điểm.'),
    shape: (d) => ({
      track_id: audioTrackId(d, 'Track ID to split.', 'ID track cần cắt.'),
      split_time: z.number().optional().describe(d('Time in seconds to split at (default: current playhead).', 'Thời điểm cắt, giây (mặc định: playhead).'))
    })
  },
  {
    name: 'merge_audio_tracks', cat: 'look_audio',
    doc: L(
      'Mix and merge multiple audio tracks (or all tracks) into a single master WAV audio track.',
      'Trộn và gộp nhiều track (hoặc tất cả) thành một track WAV tổng.'
    ),
    shape: (d) => ({
      track_ids: z.array(z.string()).optional().describe(d('List of track IDs to merge. If omitted, merges all audio tracks.', 'Danh sách ID track cần gộp. Bỏ trống = gộp tất cả.'))
    })
  },
  {
    name: 'get_audio_targets', cat: 'look_audio',
    doc: L(
      'List all entities that can be bound to audio: characters created in layer workshop, 3D models, and layers.',
      'Liệt kê tất cả các thực thể có thể gắn âm thanh: nhân vật từ xưởng lắp ráp layer, mô hình 3D và các layer.'
    ),
    shape: (d) => ({
      shot_id: z.string().optional().describe(d('Filter targets by shot ID.', 'Lọc các mục tiêu theo ID phân cảnh.'))
    })
  },
  {
    name: 'attach_audio_to_target', cat: 'look_audio',
    doc: L(
      'Bind an audio track to a character, 3D model, or layer, specifying its audio role and enabling mouth lip-sync.',
      'Gắn track âm thanh vào nhân vật, mô hình 3D hoặc layer, chọn vai trò âm thanh và bật khẩu hình miệng lip-sync.'
    ),
    shape: (d) => ({
      track_id: audioTrackId(d, 'Track ID to bind.', 'ID track cần gắn.'),
      target_type: z.enum(['character', 'layer', 'model3d', 'ambient']).describe(d('Target category.', 'Loại mục tiêu.')),
      target_id: z.string().optional().describe(d('Target instance ID or layer ID.', 'ID thực thể mục tiêu (instanceId hoặc layerId).')),
      target_name: z.string().optional().describe(d('Target display name.', 'Tên hiển thị mục tiêu.')),
      character_role: z.enum(['voice', 'sfx', 'footstep', 'foley', 'bgm']).optional().describe(d('Audio role for this character.', 'Vai trò âm thanh của nhân vật.')),
      lip_sync: z.boolean().optional().describe(d('Enable mouth animation driven by this audio track.', 'Kích hoạt khẩu hình miệng đồng bộ theo track âm thanh này.')),
      lip_sync_intensity: z.number().min(0.1).max(3.0).optional().describe(d('Mouth opening intensity multiplier.', 'Hệ số độ mở miệng.'))
    }),
    example: '{"track_id":"audio-1","target_type":"character","target_id":"comp-inst-hero","character_role":"voice","lip_sync":true}'
  },
  {
    name: 'replace_character_audio', cat: 'look_audio',
    doc: L(
      'Quickly replace the audio file of a specific character (e.g. voice dialogue or SFX) while preserving timeline timing and binding.',
      'Thay thế nhanh file âm thanh cho một nhân vật cụ thể trong cảnh (như thoại hoặc SFX), bảo lưu toàn bộ timing và liên kết.'
    ),
    shape: (d) => ({
      character_instance_id: z.string().describe(d('Character instance ID in the shot.', 'ID nhân vật trong phân cảnh.')),
      asset_id: z.string().describe(d('ID of the new audio asset.', 'ID tài nguyên âm thanh mới.')),
      character_role: z.enum(['voice', 'sfx', 'footstep', 'foley', 'bgm']).optional().describe(d('Filter character audio by role.', 'Lọc track âm thanh theo vai trò.')),
      name: z.string().optional().describe(d('Optional new display name for the track.', 'Tên hiển thị mới tùy chọn.'))
    }),
    example: '{"character_instance_id":"comp-inst-hero","asset_id":"asset-sound-voice-new","character_role":"voice"}'
  },
  {
    name: 'bake_character_lipsync', cat: 'look_audio',
    doc: L(
      'Bake voice audio peaks into keyframes on the character mouth layer timeline for visual inspection and export fidelity.',
      'Nướng sóng âm giọng nói thành keyframe hé mở miệng trực tiếp lên Timeline của layer miệng nhân vật.'
    ),
    shape: (d) => ({
      track_id: audioTrackId(d, 'Track ID containing voice audio.', 'ID track âm thanh chứa giọng nói.'),
      intensity: z.number().min(0.1).max(3.0).optional().describe(d('Mouth opening intensity (default 1.0).', 'Độ nhạy hé mở miệng (mặc định 1.0).')),
      fps: z.number().optional().describe(d('Sampling rate in frames per second (defaults to project FPS).', 'Tần số lấy mẫu khung hình/giây (mặc định: FPS dự án).'))
    }),
    example: '{"track_id":"audio-voice-1","intensity":1.2}'
  },

  // ---- timeline & view
  {
    name: 'set_time', cat: 'timeline',
    doc: L('Move the playhead (the user sees it in the app).', 'Di chuyển playhead (người dùng thấy ngay trong app).'),
    shape: () => ({ time: z.number() }),
    example: '{"time":2.5}'
  },
  {
    name: 'set_playing', cat: 'timeline',
    doc: L('Start/stop playback in the app.', 'Bắt đầu/dừng phát trong app.'),
    shape: () => ({ playing: z.boolean() })
  },
  {
    name: 'select', cat: 'timeline',
    doc: L('Select a layer or shot in the app UI (omit both to clear).', 'Chọn layer hoặc shot trên giao diện (bỏ trống cả hai để bỏ chọn).'),
    shape: () => ({ layer_id: z.string().optional(), shot_id: z.string().optional() })
  },
  {
    name: 'set_view', cat: 'timeline',
    doc: L("Change the app's viewer for the user: camera view, 3D view, 2.5D topview, Adobe Animate 2D & 3D camera stage, or split; frame a shot.", 'Đổi khung xem của app: camera, 3D, sơ đồ 2.5D, bàn dựng khung camera 2D & 3D (Adobe Animate) hoặc chia đôi; đóng khung một shot.'),
    shape: (d) => ({
      active_views: z.array(z.enum(['camera', 'editor', 'animate2d', 'topview'])).min(1).max(4).optional().describe(d('Independent active viewer tags; overrides mode.', 'Các tag khung xem bật độc lập; ưu tiên hơn mode.')),
      mode: z.enum(['camera', '3d', 'topview', 'animate2d', '2d_3d', '2d_only', 'split']).optional(),
      focus: z.string().optional().describe(d('"all", "selection" or a shot id.', '"all", "selection" hoặc id shot.')),
      camera_only: z.boolean().optional().describe(d('3D view previews only what the camera loads.', 'View 3D chỉ hiển thị những gì camera nạp.')),
      show_path: z.boolean().optional()
    })
  },
  {
    name: 'list_workflow_presets', cat: 'timeline',
    doc: L(
      'List all built-in professional video production workflow templates, functional node types, and typed data ports.',
      'Liệt kê toàn bộ mẫu quy trình tạo video chuyên nghiệp (Workflow Templates), các khối chức năng (Nodes) và cổng kết nối (Ports).'
    ),
    shape: () => ({}),
    example: '{}'
  },
  {
    name: 'get_workflow', cat: 'timeline',
    doc: L(
      'Get per-node input/output ports, executable status and routed layer/shot IDs (`node_io`), and the current project Workflow graph JSON along with the compiled AI Logical Agent Blueprint (`aiBlueprint`) describing each connected functional agent, data flow ports, and MCP tool execution plan.',
      'Lấy cổng vào/ra, trạng thái thực thi và ID layer/cảnh theo dây của từng node (`node_io`), cùng sơ đồ Workflow JSON hiện tại của dự án kèm Bản thiết kế Tác nhân Logic AI (`aiBlueprint`) mô tả rõ vai trò từng tác nhân, luồng kết nối cổng và kế hoạch công cụ MCP.'
    ),
    shape: () => ({}),
    example: '{}'
  },
  {
    name: 'set_workflow', cat: 'timeline',
    doc: L(
      'Configure the project video production workflow from a preset template (`preset_id`), a JSON workflow graph (`workflow`), or update a specific functional node preset/enabled state.',
      'Cấu hình quy trình tạo video cho dự án từ mẫu có sẵn (`preset_id`), từ chuỗi/đối tượng JSON (`workflow`), hoặc cập nhật preset/trạng thái bật tắt của một khối chức năng.'
    ),
    shape: (d) => ({
      logic_id: z.string().optional().describe(d('Add a logic node to layer_id (shared Timeline ⇄ Workflow V2 logic). Use a V2 preset id `v2:<category>:<option>` (e.g. v2:action:sway, v2:light:candle, v2:material:stone_wall, v2:collision:elastic_bounce, v2:cave:arch, v2:fx:bloom, v2:audio:voice); legacy catalog ids are mapped. layer_id is required in Workflow V2.', 'Gắn Node logic vào layer_id (logic chung Timeline ⇄ Workflow V2). Dùng mã mẫu V2 `v2:<nhóm>:<tuỳ chọn>` (ví dụ v2:action:sway, v2:light:candle, v2:material:stone_wall, v2:collision:elastic_bounce, v2:cave:arch, v2:fx:bloom, v2:audio:voice); mã kho cũ được tự ánh xạ. Workflow V2 bắt buộc có layer_id.')),
      layer_id: z.string().optional().describe(d('Target layer for timeline logic.', 'Layer đích của logic timeline.')),
      shot_id: z.string().optional().describe(d('Target shot for timeline logic; all for the project.', 'Cảnh đích của logic timeline; all là toàn dự án.')),
      preset_id: z.string().optional().describe(d('Built-in workflow template ID (e.g. "cinematic_parallax_intro", "character_action_physics", "cave_virtual_light_explore", "story_dialogue_lipsync", "arch3d_flythrough").', 'ID mẫu workflow có sẵn (VD: "cinematic_parallax_intro", "character_action_physics", "cave_virtual_light_explore", "story_dialogue_lipsync", "arch3d_flythrough").')),
      workflow: z.string().optional().describe(d('JSON string of a WorkflowGraph object.', 'Chuỗi JSON của đối tượng WorkflowGraph.')),
      node_id: z.string().optional().describe(d('Target node ID (or node type) to update.', 'ID khối node (hoặc loại node) cần cập nhật.')),
      node_params: z.string().optional().describe(d('JSON object of node parameters: customRules (speed/amount/enabled), duration, camAperture, camFocusDistance, camShakeAmount/Speed. Auto targets follow layer wires; requireLayerConnection prevents fallback after disconnect. False and empty target arrays remain explicit.', 'JSON thông số node: customRules (speed/amount/enabled), duration, camAperture, camFocusDistance, camShakeAmount/Speed. Đích tự động theo dây layer; requireLayerConnection chặn mở rộng phạm vi khi ngắt dây. Giữ nguyên false và danh sách rỗng.')),
      apply_node: z.boolean().optional().describe(d('Apply this node configuration atomically in one Undo step, using the same evaluator as the dialog preview.', 'Áp dụng cấu hình node trong một bước Undo, dùng cùng bộ xử lý với preview dialog.')),
      node_preset: z.string().optional().describe(d('Preset ID to assign to the target node.', 'Mã preset cần gán cho khối node.')),
      enabled: z.boolean().optional().describe(d('Enable or bypass the target node.', 'Bật hoặc bỏ qua khối node mục tiêu.')),
      auto_wire: z.boolean().optional().describe(d('Preserve valid wires and complete unambiguous connections within each shot and assembly hierarchy.', 'Giữ dây hợp lệ và bổ sung kết nối rõ mục tiêu trong từng cảnh và cây cụm layer.')),
      switch_to_tab: z.boolean().optional().describe(d('Switch the bottom Timeline area to the Workflow tab so the user sees the graph.', 'Chuyển vùng Timeline sang tab Workflow để hiển thị sơ đồ trực quan.'))
    }),
    example: '{"preset_id":"character_action_physics","switch_to_tab":true}'
  },
  {
    name: 'connect_workflow_ports', cat: 'timeline',
    doc: L(
      'Connect or disconnect functional ports between two workflow nodes (e.g. `scene_ctx`, `actors_rig`, `motion_stream`, `vfx_stage`, `camera_cut`, `audio_mix`), or auto-wire the entire pipeline.',
      'Kết nối hoặc ngắt kết nối cổng chức năng giữa 2 khối workflow (`scene_ctx`, `actors_rig`, `motion_stream`, `vfx_stage`, `camera_cut`, `audio_mix`), hoặc tự động nối dây toàn tuyến.'
    ),
    shape: (d) => ({
      action: z.enum(['connect', 'disconnect', 'auto_wire']).optional().describe(d('Action: "connect" (default), "disconnect", or "auto_wire".', 'Thao tác: "connect" (mặc định), "disconnect", hoặc "auto_wire".')),
      from_node: z.string().optional().describe(d('Source node ID or node type (e.g. "node-assembly" or "layer_assembly").', 'ID hoặc loại khối nguồn (VD: "node-assembly" hoặc "layer_assembly").')),
      to_node: z.string().optional().describe(d('Target node ID or node type (e.g. "node-motion" or "motion_choreography").', 'ID hoặc loại khối đích (VD: "node-motion" hoặc "motion_choreography").')),
      port: z.enum(['scene_ctx', 'actors_rig', 'motion_stream', 'vfx_stage', 'camera_cut', 'audio_mix']).optional().describe(d('Port type to connect (auto-detected if omitted).', 'Loại cổng cần nối (bỏ trống sẽ tự động nhận diện cổng tương thích).')),
      edge_id: z.string().optional().describe(d('Edge ID to remove when action="disconnect".', 'ID dây nối cần gỡ khi action="disconnect".'))
    }),
    example: '{"action":"connect","from_node":"node-assembly","to_node":"node-motion","port":"actors_rig"}'
  },
  {
    name: 'apply_workflow', cat: 'timeline',
    doc: L(
      'Execute the connected video production workflow onto the current project (or a specific shot): configures depth layout, 2.5D/3D assembly rigs, motion choreography, physics/virtual lighting FX, camera flight path, audio lip-sync, and atmospheric color grading in one step.',
      'Thực thi ngay quy trình tạo video đã kết nối lên dự án hiện tại (hoặc một phân cảnh): tự động thiết lập bố cục chiều sâu, lắp ráp 2.5D/3D, nhịp chuyển động, vật lý/ánh sáng ảo, đường bay camera, âm thanh lip-sync và chỉnh màu hậu kỳ trong một bước.'
    ),
    shape: (d) => ({
      preset_id: z.string().optional().describe(d('Optional workflow template ID to load and apply immediately.', 'ID mẫu workflow tùy chọn để nạp và áp dụng ngay.')),
      workflow: z.string().optional().describe(d('Optional custom WorkflowGraph JSON string to apply.', 'Chuỗi JSON WorkflowGraph tùy chỉnh cần áp dụng.')),
      shot_id: z.string().optional().describe(d('Target shot ID (defaults to selected or first shot).', 'ID phân cảnh mục tiêu (mặc định: cảnh đang chọn hoặc cảnh đầu tiên).')),
      switch_to_tab: z.boolean().optional().describe(d('Switch bottom panel to the Workflow tab to show the applied pipeline.', 'Chuyển khu vực dưới sang tab Workflow để hiển thị quy trình vừa áp dụng.'))
    }),
    example: '{"preset_id":"cinematic_parallax_intro"}'
  },

  // ---- export & scripting
  {
    name: 'export_video', cat: 'export',
    doc: L('Render the composition to an H.264 MP4 (blocks until finished).', 'Render composition ra MP4 H.264 (chờ tới khi xong).'),
    shape: (d) => ({
      out_path: z.string().describe(d('Absolute path ending in .mp4', 'Đường dẫn tuyệt đối kết thúc bằng .mp4')),
      height: z.number().int().optional().describe(d('Output height (width follows aspect). Default: comp height.', 'Chiều cao xuất (chiều rộng theo tỉ lệ). Mặc định: chiều cao composition.')),
      fps: z.number().optional(),
      crf: z.number().optional().describe(d('Quality, lower = better (default 18).', 'Chất lượng, càng thấp càng đẹp (mặc định 18).')),
      preset: z.enum(['ultrafast', 'veryfast', 'medium', 'slow']).optional(),
      with_audio: z.boolean().optional(),
      start: z.number().optional(),
      end: z.number().optional()
    }),
    example: '{"out_path":"D:/out/video.mp4","height":1080}'
  },
  {
    name: 'execute_script', cat: 'export',
    doc: L(
      'Run JavaScript inside the app (async). Available: api.project, api.time, api.update(draft => {...}) for undoable edits, await api.run(method, params) to call any tool, api.factory, api.keyframes, api.THREE, log(...). Return a JSON-serializable value.',
      'Chạy JavaScript bên trong app (async). Có sẵn: api.project, api.time, api.update(draft => {...}) cho chỉnh sửa hoàn tác được, await api.run(method, params) để gọi mọi tool, api.factory, api.keyframes, api.THREE, log(...). Trả về giá trị tuần tự hóa JSON được.'
    ),
    shape: () => ({ code: z.string() }),
    example: '{"code":"return api.project.layers.length"}'
  }
]

const motionShape = FX_TOOLS.find((tool) => tool.name === 'set_layer_motion').shape
FX_TOOLS.push(
  {
    name: 'list_layer_fx', cat: 'fx',
    doc: L('List all effect instances, including legacy Motion, with ids, timing and parameters.', 'Liệt kê mọi hiệu ứng, gồm Motion cũ, với ID, thời gian và tham số.'),
    shape: () => ({ layer_id: z.string() }), example: '{"layer_id":"layer-1"}'
  },
  {
    name: 'update_layer_fx', cat: 'fx',
    doc: L('Edit one effect by fx_id. Timing edits retime owned keyframes. Motion parameters affect only this instance. Undoable; locked layers are rejected.',
      'Chỉnh một hiệu ứng theo fx_id. Sửa thời gian co giãn keyframe thuộc hiệu ứng. Tham số Motion chỉ ảnh hưởng hiệu ứng này. Có Undo; từ chối layer khóa.'),
    shape: (d) => ({ ...motionShape(d), fx_id: z.string(), name: z.string().optional().describe(d('Display name.', 'Tên hiển thị.')) }),
    example: '{"layer_id":"layer-1","fx_id":"fx-1","start_time":1,"duration":3,"speed":2,"amount":0.5}'
  }
)
