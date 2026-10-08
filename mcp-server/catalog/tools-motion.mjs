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
    name: 'apply_layer_fx', cat: 'fx',
    doc: L(
      'Apply an animation or neon glow FX preset at a specific time: "neonBreathe" (soft breathing neon edge glow), "neonBlink" (blinking neon outline), "neonFlicker" (flickering neon sign), "neonSolid" (constant neon outline), "blink" (opacity blink), "fadeIn", "fadeOut", "breathe", "shake", "popIn", "pulse".',
      'Áp preset hiệu ứng chuyển động hoặc viền neon tại một thời điểm: "neonBreathe" (viền neon thở nhẹ), "neonBlink" (viền neon nhấp nháy), "neonFlicker" (biển neon chập chờn), "neonSolid" (viền neon cố định), "blink" (nhấp nháy độ mờ), "fadeIn", "fadeOut", "breathe", "shake", "popIn", "pulse".'
    ),
    shape: (d) => ({
      layer_id: z.string(),
      preset: z
        .enum(['neonBreathe', 'neonBlink', 'neonFlicker', 'neonSolid', 'blink', 'fadeIn', 'fadeOut', 'breathe', 'shake', 'popIn', 'pulse'])
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
      ease: ease.optional().describe(d('Easing of the segment that starts at this key. hold = jump cut.', 'Easing của đoạn bắt đầu từ key này. hold = cắt nhảy.'))
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
    doc: L('Add an audio track from a file or existing project asset at a specific timeline offset.', 'Thêm track âm thanh từ file hoặc asset có sẵn tại một vị trí trên timeline.'),
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
      playback_rate: z.number().optional().describe(d('Speed factor (0.25 to 4.0).', 'Hệ số tốc độ (0.25 đến 4.0).'))
    }),
    example: '{"file_path":"D:/music/theme.mp3","offset":0,"fade_in":1.5}'
  },
  {
    name: 'update_audio_track', cat: 'look_audio',
    doc: L(
      'Update parameters of an audio track: volume, offset, mute, loop, speed, fade, duration, or gain.',
      'Cập nhật thông số track âm thanh: âm lượng, offset, tắt tiếng, lặp, tốc độ, fade, thời lượng hoặc gain.'
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
      gain_db: z.number().optional().describe(d('dB offset (-24 to +12).', 'Độ lệch dB (-24 đến +12).'))
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
    doc: L("Change the app's viewer for the user: camera view, 3D view or split; frame a shot.", 'Đổi khung xem của app: camera, 3D hoặc chia đôi; đóng khung một shot.'),
    shape: (d) => ({
      mode: z.enum(['camera', '3d', 'split']).optional(),
      focus: z.string().optional().describe(d('"all", "selection" or a shot id.', '"all", "selection" hoặc id shot.')),
      camera_only: z.boolean().optional().describe(d('3D view previews only what the camera loads.', 'View 3D chỉ hiển thị những gì camera nạp.')),
      show_path: z.boolean().optional()
    })
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
