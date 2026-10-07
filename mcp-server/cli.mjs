#!/usr/bin/env node
/**
 * Parallax Studio V2 — Real-time AI & Developer CLI Controller
 *
 * Cho phép AI Agent (Antigravity, Claude, Cursor...) hoặc lập trình viên:
 * 1. Tra cứu toàn bộ 42 công cụ MCP, nguyên lý không gian 2.5D, cách dùng.
 * 2. Xem review cảnh (chụp viewport camera / 3D thành file ảnh tức thì).
 * 3. Thao tác và chỉnh sửa dự án theo thời gian thực (add shot, add layer, build camera, render).
 * 4. Quản lý trạng thái và giải phóng tài nguyên kết nối.
 *
 * Cách chạy:
 *   node mcp-server/cli.mjs --help
 *   node mcp-server/cli.mjs status
 *   node mcp-server/cli.mjs review --view camera --time 2.5 --out preview.png
 *   node mcp-server/cli.mjs call add_shot '{"name": "Cảnh 1", "duration": 6}'
 */

import { createConnection } from 'node:net'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, isAbsolute } from 'node:path'

// ------------------------------------------------------------------ Config & Connection
function getMcpConfigPath() {
  if (process.env.PARALLAX_MCP_CONFIG) return process.env.PARALLAX_MCP_CONFIG
  const appName = 'parallax-studio'
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), appName, 'mcp.json')
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', appName, 'mcp.json')
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), appName, 'mcp.json')
}

function readConfig() {
  const p = getMcpConfigPath()
  if (!existsSync(p)) {
    throw new Error(
      `[PXS CLI] Parallax Studio chưa được bật (hoặc chưa bao giờ khởi chạy): không tìm thấy file cấu hình tại:\n  ${p}\n👉 Hãy mở ứng dụng hoặc chạy "npm run dev" trước.`
    )
  }
  const raw = readFileSync(p, 'utf8')
  const cfg = JSON.parse(raw)
  return {
    host: '127.0.0.1',
    port: Number(process.env.PARALLAX_MCP_PORT) || cfg.port || 9877,
    token: process.env.PARALLAX_MCP_TOKEN || cfg.token
  }
}

async function sendCommand(method, params = {}) {
  const cfg = readConfig()
  return new Promise((resolvePromise, rejectPromise) => {
    const sock = createConnection({ host: cfg.host, port: cfg.port })
    sock.setEncoding('utf8')
    let buffer = ''
    const reqId = Date.now()

    const timeout = setTimeout(() => {
      sock.destroy()
      rejectPromise(new Error(`[PXS CLI] Quá thời gian chờ phản hồi từ app cho lệnh "${method}" (Timeout 15s).`))
    }, 15000)

    sock.once('connect', () => {
      const msg = JSON.stringify({ id: reqId, token: cfg.token, method, params }) + '\n'
      sock.write(msg)
    })

    sock.on('data', (chunk) => {
      buffer += chunk
      let idx
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        if (!line) continue
        try {
          const res = JSON.parse(line)
          if (res.id === reqId || res.id === null) {
            clearTimeout(timeout)
            sock.destroy()
            if (res.ok) {
              resolvePromise(res.result)
            } else {
              rejectPromise(new Error(res.error || 'Lỗi không xác định từ Parallax Studio.'))
            }
            return
          }
        } catch {
          /* ignore incomplete line */
        }
      }
    })

    sock.on('error', (err) => {
      clearTimeout(timeout)
      rejectPromise(new Error(`[PXS CLI] Không thể kết nối tới Parallax Studio tại 127.0.0.1:${cfg.port}: ${err.message}`))
    })
  })
}

// ------------------------------------------------------------------ Tool Documentation Registry
const TOOLS_CATALOG = {
  // Nhóm Tra Cứu
  get_project_info: {
    category: '1. Truy vấn & Thông tin',
    desc: 'Lấy toàn bộ thông tin tổng quan dự án: composition, danh sách shots, layers, camera, look, audio, assets.',
    params: '{}',
    example: 'node mcp-server/cli.mjs call get_project_info'
  },
  get_shot_info: {
    category: '1. Truy vấn & Thông tin',
    desc: 'Xem chi tiết 1 cảnh và tất cả layer thuộc cảnh đó.',
    params: '{ "shot_id": string, "time"?: number }',
    example: 'node mcp-server/cli.mjs call get_shot_info \'{"shot_id": "shot-1"}\''
  },
  get_layer_info: {
    category: '1. Truy vấn & Thông tin',
    desc: 'Đọc toàn bộ thuộc tính, keyframes, transforms của 1 layer cụ thể.',
    params: '{ "layer_id": string }',
    example: 'node mcp-server/cli.mjs call get_layer_info \'{"layer_id": "layer-1"}\''
  },
  get_camera_info: {
    category: '1. Truy vấn & Thông tin',
    desc: 'Đọc trạng thái vị trí, mục tiêu, FOV của camera tại thời điểm time.',
    params: '{ "time"?: number }',
    example: 'node mcp-server/cli.mjs call get_camera_info \'{"time": 2.0}\''
  },
  get_memory_stats: {
    category: '1. Truy vấn & Thông tin',
    desc: 'Kiểm tra dung lượng VRAM GPU, texture residency và RAM tiến trình.',
    params: '{}',
    example: 'node mcp-server/cli.mjs call get_memory_stats'
  },
  get_viewport_screenshot: {
    category: '1. Truy vấn & Thông tin (Review Visual)',
    desc: 'Chụp hình ảnh viewport thực tế từ Three.js (dạng ảnh camera hoặc 3D orbit) để AI review bố cục.',
    params: '{ "view"?: "camera"|"3d", "time"?: number, "width"?: number, "format"?: "png"|"jpeg" }',
    example: 'node mcp-server/cli.mjs review --view camera --time 1.5 --out preview.png'
  },

  // Nhóm Dự án & Cảnh
  new_project: {
    category: '2. Dự án & Cảnh (Shots)',
    desc: 'Khởi tạo dự án mới hoàn toàn trống.',
    params: '{ "width"?: number, "height"?: number, "fps"?: number, "duration"?: number }'
  },
  set_composition: {
    category: '2. Dự án & Cảnh (Shots)',
    desc: 'Thay đổi độ phân giải, khung hình hoặc thời lượng composition.',
    params: '{ "name"?: string, "width"?: number, "height"?: number, "fps"?: number, "duration"?: number }'
  },
  save_project: {
    category: '2. Dự án & Cảnh (Shots)',
    desc: 'Lưu dự án hiện tại ra file .pxs.',
    params: '{ "file_path"?: string }'
  },
  open_project: {
    category: '2. Dự án & Cảnh (Shots)',
    desc: 'Mở file dự án .pxs từ ổ đĩa.',
    params: '{ "file_path": string }'
  },
  add_shot: {
    category: '2. Dự án & Cảnh (Shots)',
    desc: 'Thêm một phân cảnh 3D mới.',
    params: '{ "name": string, "duration"?: number, "position"?: [x, y, z], "color"?: string }',
    example: 'node mcp-server/cli.mjs call add_shot \'{"name": "Đêm Mưa", "duration": 6}\''
  },
  update_shot: {
    category: '2. Dự án & Cảnh (Shots)',
    desc: 'Cập nhật tên, thời lượng, vị trí phân cảnh.',
    params: '{ "shot_id": string, "name"?: string, "duration"?: number, "position"?: [x, y, z] }'
  },
  delete_shot: {
    category: '2. Dự án & Cảnh (Shots)',
    desc: 'Xóa một phân cảnh khỏi dự án.',
    params: '{ "shot_id": string }'
  },

  // Nhóm Layers & Không gian 2.5D
  add_image_layer: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Thêm layer ảnh vào không gian 3D tại độ sâu Z chỉ định (Foreground: -300..0, Mid: 300..800, Far: 1000..3000).',
    params: '{ "file_path": string, "shot_id"?: string, "z"?: number, "position"?: [x, y, z], "scale"?: number|[x,y,z], "opacity"?: number, "name"?: string }',
    example: 'node mcp-server/cli.mjs call add_image_layer \'{"file_path": "assets/city/sky.png", "z": 3000, "name": "Bầu trời"}\''
  },
  add_text_layer: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Thêm layer chữ trong không gian 3D (hỗ trợ font Google Fonts, size, color, tracking).',
    params: '{ "text": string, "shot_id"?: string, "z"?: number, "position"?: [x, y, z], "font_family"?: string, "font_size"?: number, "color"?: string }'
  },
  add_solid_layer: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Thêm layer màu đặc hoặc dải chuyển sắc gradient nền 3D.',
    params: '{ "color": string, "shot_id"?: string, "z"?: number }'
  },
  add_ground_layer: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Tạo mặt sàn / mặt đất 3D nằm ngang (Ground Plane).',
    params: '{ "color"?: string, "shot_id"?: string, "z"?: number, "size"?: [w, h] }'
  },
  add_particles: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Thêm hiệu ứng hạt tự động (mưa, bụi lấp lánh, đom đóm, tuyết).',
    params: '{ "preset": "dust"|"fireflies"|"snow"|"rain", "density"?: number, "shot_id"?: string }'
  },
  update_layer: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Cập nhật vị trí, xoay, tỷ lệ, độ trong suốt hoặc hòa trộn của layer.',
    params: '{ "layer_id": string, "position"?: [x, y, z], "rotation"?: [x, y, z], "scale"?: number, "opacity"?: number }'
  },
  delete_layer: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Xóa layer.',
    params: '{ "layer_id": string }'
  },
  move_layer: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Di chuyển thứ tự hiển thị z-index xếp chồng của layer trong cảnh.',
    params: '{ "layer_id": string, "delta": number }'
  },
  split_layer: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Tách / cắt layer thành 2 đoạn liền mạch tại thời điểm time (giây).',
    params: '{ "layer_id": string, "time"?: number }',
    example: 'node mcp-server/cli.mjs call split_layer \'{"layer_id": "layer-1", "time": 2.5}\''
  },
  replace_layer_asset: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Thay thế tài nguyên ảnh cho layer ảnh, giữ nguyên 100% tọa độ 3D, Z-depth, keyframes và hiệu ứng.',
    params: '{ "layer_id": string, "asset_id": string }',
    example: 'node mcp-server/cli.mjs call replace_layer_asset \'{"layer_id": "layer-1", "asset_id": "asset-2"}\''
  },
  set_layer_glow: {
    category: '3. Layer & Độ sâu 2.5D',
    desc: 'Bật/tắt và tinh chỉnh viền phát sáng Neon bám sát đường nét alpha thực tế (thời điểm bắt đầu, thời lượng, outer/inner/both, màu sắc, độ dày, độ rực, nhịp thở/nhấp nháy).',
    params: '{ "layer_id": string, "enabled"?: boolean, "start_time"?: number, "duration"?: number, "side"?: "outer"|"inner"|"both", "color"?: string, "thickness"?: number, "intensity"?: number, "animated"?: "none"|"blink"|"breathe"|"flicker", "speed"?: number, "min_intensity"?: number }',
    example: 'node mcp-server/cli.mjs call set_layer_glow \'{"layer_id": "layer-1", "enabled": true, "start_time": 2.5, "duration": 1.5, "side": "outer", "color": "#3dd6f5", "thickness": 10, "intensity": 1.5, "animated": "breathe"}\''
  },

  // Nhóm Keyframe & Animation
  apply_layer_fx: {
    category: '4. Keyframes & Hoạt ảnh',
    desc: 'Áp dụng hiệu ứng hoạt ảnh hoặc viền phát sáng Neon: neonBreathe (thở mờ ảo), neonBlink (chớp tắt viền), neonFlicker (chập chờn neon), neonSolid (viền sáng tĩnh), blink, fadeIn, fadeOut, breathe, shake, popIn, pulse.',
    params: '{ "layer_id": string, "preset": "neonBreathe"|"neonBlink"|"neonFlicker"|"neonSolid"|"blink"|"fadeIn"|"fadeOut"|"breathe"|"shake"|"popIn"|"pulse", "time"?: number, "duration"?: number, "blinks"?: number, "intensity"?: number }',
    example: 'node mcp-server/cli.mjs call apply_layer_fx \'{"layer_id": "layer-1", "preset": "neonBreathe", "time": 2.5, "duration": 1.5}\''
  },
  toggle_layer_fx: {
    category: '4. Keyframes & Hoạt ảnh',
    desc: 'Bật hoặc tắt công tắc một hiệu ứng cụ thể trên layer theo fx_id.',
    params: '{ "layer_id": string, "fx_id": string, "enabled": boolean }',
    example: 'node mcp-server/cli.mjs call toggle_layer_fx \'{"layer_id": "layer-1", "fx_id": "fx-abc123", "enabled": false}\''
  },
  remove_layer_fx: {
    category: '4. Keyframes & Hoạt ảnh',
    desc: 'Xóa vĩnh viễn một hiệu ứng đã áp dụng trên layer và dọn dẹp keyframes/viền neon tương ứng.',
    params: '{ "layer_id": string, "fx_id": string }',
    example: 'node mcp-server/cli.mjs call remove_layer_fx \'{"layer_id": "layer-1", "fx_id": "fx-abc123"}\''
  },
  set_keyframe: {
    category: '4. Keyframes & Hoạt ảnh',
    desc: 'Đặt keyframe cho thuộc tính tại thời điểm time (giây).',
    params: '{ "prop": string, "time": number, "value": any, "easing"?: "linear"|"easeInOut"|"easeIn"|"easeOut"|"hold" }',
    example: 'node mcp-server/cli.mjs call set_keyframe \'{"prop": "camera.position", "time": 0, "value": [0,0,-1500]}\''
  },
  remove_keyframe: {
    category: '4. Keyframes & Hoạt ảnh',
    desc: 'Xóa keyframe tại thời điểm time.',
    params: '{ "prop": string, "time": number }'
  },
  clear_keyframes: {
    category: '4. Keyframes & Hoạt ảnh',
    desc: 'Xóa toàn bộ keyframe của thuộc tính.',
    params: '{ "prop": string }'
  },

  // Nhóm Camera
  set_camera: {
    category: '5. Camera & Đường bay 3D',
    desc: 'Đặt vị trí camera, mục tiêu ngắm hoặc FOV.',
    params: '{ "position"?: [x, y, z], "target"?: [x, y, z], "fov"?: number, "time"?: number }'
  },
  apply_camera_preset: {
    category: '5. Camera & Đường bay 3D',
    desc: 'Áp dụng chuyển động camera mẫu (slow_push, pan_left, orbit_subtle, crane_up).',
    params: '{ "preset": string, "shot_id"?: string }'
  },
  camera_fly_to_shot: {
    category: '5. Camera & Đường bay 3D',
    desc: 'Bay camera tới khung nhìn bao quát cảnh chỉ định.',
    params: '{ "shot_id": string, "duration"?: number }'
  },
  build_camera_path: {
    category: '5. Camera & Đường bay 3D',
    desc: 'Tự động tính toán đường bay Bezier mượt mà nối tất cả các phân cảnh trong dự án.',
    params: '{ "transition_duration"?: number, "easing"?: string }'
  },

  // Nhóm Xử lý & Dàn dựng Âm Thanh
  set_audio: {
    category: '6. Xử lý & Dàn dựng Âm Thanh (Audio)',
    desc: 'Đặt hoặc gỡ bỏ nhạc nền cho dự án từ file âm thanh.',
    params: '{ "file_path"?: string, "offset"?: number, "volume"?: number, "remove"?: boolean }',
    example: 'node mcp-server/cli.mjs call set_audio \'{"file_path": "assets/bgm.mp3", "volume": 0.8}\''
  },
  get_audio_info: {
    category: '6. Xử lý & Dàn dựng Âm Thanh (Audio)',
    desc: 'Xem danh sách toàn bộ các track âm thanh trên timeline (thời lượng, offset, volume, loop, speed...).',
    params: '{}',
    example: 'node mcp-server/cli.mjs call get_audio_info'
  },
  add_audio_track: {
    category: '6. Xử lý & Dàn dựng Âm Thanh (Audio)',
    desc: 'Thêm track âm thanh mới vào timeline từ file hoặc asset có sẵn tại mốc thời gian offset.',
    params: '{ "file_path"?: string, "asset_id"?: string, "name"?: string, "offset"?: number, "volume"?: number, "muted"?: boolean, "loop"?: boolean }',
    example: 'node mcp-server/cli.mjs call add_audio_track \'{"file_path": "assets/sfx.wav", "offset": 1.5, "volume": 0.9}\''
  },
  update_audio_track: {
    category: '6. Xử lý & Dàn dựng Âm Thanh (Audio)',
    desc: 'Chỉnh sửa thuộc tính của track âm thanh (volume, offset, tốc độ, fade in/out, gain dB...).',
    params: '{ "track_id": string, "volume"?: number, "offset"?: number, "playback_rate"?: number, "gain_db"?: number }',
    example: 'node mcp-server/cli.mjs call update_audio_track \'{"track_id": "audio-xyz", "volume": 0.5}\''
  },
  delete_audio_track: {
    category: '6. Xử lý & Dàn dựng Âm Thanh (Audio)',
    desc: 'Xoá một track âm thanh khỏi timeline theo ID.',
    params: '{ "track_id": string }',
    example: 'node mcp-server/cli.mjs call delete_audio_track \'{"track_id": "audio-xyz"}\''
  },
  duplicate_audio_track: {
    category: '6. Xử lý & Dàn dựng Âm Thanh (Audio)',
    desc: 'Nhân bản đoạn âm thanh lùi thêm một khoảng thời gian offset_delta.',
    params: '{ "track_id": string, "offset_delta"?: number }',
    example: 'node mcp-server/cli.mjs call duplicate_audio_track \'{"track_id": "audio-xyz", "offset_delta": 2.0}\''
  },
  split_audio_track: {
    category: '6. Xử lý & Dàn dựng Âm Thanh (Audio)',
    desc: 'Cắt đôi một track âm thanh thành 2 phần tại thời điểm split_time.',
    params: '{ "track_id": string, "split_time"?: number }',
    example: 'node mcp-server/cli.mjs call split_audio_track \'{"track_id": "audio-xyz", "split_time": 3.2}\''
  },
  merge_audio_tracks: {
    category: '6. Xử lý & Dàn dựng Âm Thanh (Audio)',
    desc: 'Hòa âm và gộp nhiều track âm thanh (hoặc tất cả các tracks) thành 1 track WAV duy nhất.',
    params: '{ "track_ids"?: string[] }',
    example: 'node mcp-server/cli.mjs call merge_audio_tracks \'{}\''
  },

  // Nhóm Xuất video & Điều khiển
  set_time: {
    category: '7. Timeline & Xuất Video',
    desc: 'Di chuyển con trỏ thời gian (playhead) tới giây time.',
    params: '{ "time": number }'
  },
  set_playing: {
    category: '7. Timeline & Xuất Video',
    desc: 'Phát hoặc dừng phát hoạt ảnh realtime.',
    params: '{ "playing": boolean }'
  },
  undo: {
    category: '7. Timeline & Xuất Video',
    desc: 'Hoàn tác thao tác vừa thực hiện.',
    params: '{}'
  },
  redo: {
    category: '7. Timeline & Xuất Video',
    desc: 'Làm lại thao tác vừa hoàn tác.',
    params: '{}'
  },
  export_video: {
    category: '7. Timeline & Xuất Video',
    desc: 'Render và xuất video MP4 qua FFmpeg.',
    params: '{ "out_path"?: string, "fps"?: number, "quality"?: "draft"|"high"|"ultra" }'
  }
}

// ------------------------------------------------------------------ CLI Commands
async function cmdHelp(toolName) {
  if (toolName && TOOLS_CATALOG[toolName]) {
    const t = TOOLS_CATALOG[toolName]
    console.log(`\n======================================================`)
    console.log(`  CÔNG CỤ MCP: ${toolName}`)
    console.log(`======================================================`)
    console.log(`Nhóm:        ${t.category}`)
    console.log(`Mô tả:       ${t.desc}`)
    console.log(`Tham số:     ${t.params}`)
    if (t.example) {
      console.log(`Ví dụ gọi:   ${t.example}`)
    }
    console.log(`======================================================\n`)
    return
  }

  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║             PARALLAX STUDIO V2 — AI & DEVELOPER CLI CONTROLLER             ║
║                 Điều khiển và Chỉnh sửa Cảnh 3D Thời Gian Thực             ║
╚════════════════════════════════════════════════════════════════════════════╝

📌 NGUYÊN LÝ KHÔNG GIAN 2.5D (QUY ƯỚC TỌA ĐỘ):
  • Trục X: Chiều ngang (sang phải: +X, sang trái: -X)
  • Trục Y: Chiều đứng  (lên trên: +Y, xuống dưới: -Y)
  • Trục Z: Độ sâu không gian (càng ra xa camera thì Z càng lớn):
      - Tiền cảnh (Foreground): Z = -300 đến 0      (trôi nhanh nhất)
      - Tiêu điểm gốc (Focus):  Z = 0               (chuẩn pixel 1:1)
      - Trung cảnh (Midground): Z = 300 đến 800     (nhân vật, vật thể chính)
      - Hậu cảnh (Background):  Z = 1000 đến 2500   (công trình, núi đồi xa)
      - Bầu trời (Sky Plane):   Z = 3000 trở lên    (gần như cố định)

🚀 CÁC LỆNH CLI ĐIỀU KHIỂN NHANH:
  pnpm pxs status                       Kiểm tra kết nối và trạng thái app
  pnpm pxs review [--view camera|3d]    Chụp ảnh review cảnh và lưu file PNG
  pnpm pxs inspect                      Đọc toàn bộ cấu trúc dự án (JSON)
  pnpm pxs call <tool> '<json_params>'  Gọi trực tiếp bất kỳ công cụ MCP nào
  pnpm pxs help <tool_name>             Xem chi tiết 1 công cụ cụ thể
  pnpm pxs disconnect                   Ngắt kết nối để giải phóng CPU/RAM

📋 DANH MỤC ${Object.keys(TOOLS_CATALOG).length} CÔNG CỤ MCP KHẢ DỤNG:`)

  let currentCat = ''
  for (const [name, info] of Object.entries(TOOLS_CATALOG)) {
    if (info.category !== currentCat) {
      currentCat = info.category
      console.log(`\n── ${currentCat} ─────────────────────────────`)
    }
    console.log(`  • ${name.padEnd(26)} : ${info.desc}`)
  }

  console.log(`
💡 QUY TRÌNH MẪU DÀNH CHO AI TỰ ĐỘNG DỰNG CẢNH:
  1. pnpm pxs call get_project_info
  2. pnpm pxs call add_shot '{"name": "Cyber City", "duration": 8}'
  3. pnpm pxs call add_image_layer '{"file_path": "assets/city/sky.png", "z": 3200}'
  4. pnpm pxs call add_image_layer '{"file_path": "assets/city/buildings.png", "z": 1200}'
  5. pnpm pxs call add_image_layer '{"file_path": "assets/city/street.png", "z": 400}'
  6. pnpm pxs call build_camera_path
  7. pnpm pxs review --view camera --out artifacts/review.png
  8. Dùng tool "view_file" đọc file "artifacts/review.png" để kiểm tra kết quả visual.
`)
}

async function cmdStatus() {
  try {
    const res = await sendCommand('get_project_info')
    const mem = await sendCommand('get_memory_stats').catch(() => null)
    const comp = res.composition || res.project?.comp || {}
    const shots = res.shots || res.project?.shots || []
    const layers = res.layers || res.project?.layers || []
    const camPos = res.camera?.position || res.evaluated?.camera?.position || []

    console.log(`\n✓ [PXS CLI] Kết nối thành công tới Parallax Studio V2!`)
    console.log(`──────────────────────────────────────────────────────`)
    console.log(`Dự án:        ${res.name || comp.name || 'Untitled'}`)
    console.log(`Kích thước:   ${comp.width || 1920}x${comp.height || 1080} @ ${comp.fps || 30} fps`)
    console.log(`Thời lượng:   ${comp.duration || 0} giây`)
    console.log(`Phân cảnh:    ${shots.length} shots`)
    console.log(`Số Layer:     ${layers.length} layers`)
    console.log(`Camera Pos:   [${camPos.map((v) => Math.round(v)).join(', ')}]`)
    if (mem?.gpu) {
      console.log(`VRAM GPU:     ${mem.gpu.texturesMB?.toFixed(0) || 0} / ${mem.gpu.budgetMB || 512} MB (${mem.gpu.loadedTextures || 0} textures)`)
    }
    console.log(`──────────────────────────────────────────────────────\n`)
  } catch (err) {
    console.error(`✗ Lỗi: ${err.message}`)
    process.exit(1)
  }
}

async function cmdInspect() {
  try {
    const res = await sendCommand('get_project_info')
    console.log(JSON.stringify(res, null, 2))
  } catch (err) {
    console.error(`✗ Lỗi: ${err.message}`)
    process.exit(1)
  }
}

async function cmdReview(args) {
  try {
    let view = 'camera'
    let time = undefined
    let outPath = 'artifacts/review_viewport.png'

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--view' && args[i + 1]) view = args[++i]
      else if (args[i] === '--time' && args[i + 1]) time = parseFloat(args[++i])
      else if (args[i] === '--out' && args[i + 1]) outPath = args[++i]
    }

    console.log(`\n⏳ Đang render ảnh preview từ Three.js (view: ${view}, time: ${time ?? 'hiện tại'})...`)
    const res = await sendCommand('get_viewport_screenshot', { view, time, width: 960, format: 'png' })

    if (!res || !res.data) {
      throw new Error('Không nhận được dữ liệu ảnh render từ engine.')
    }

    const absOut = isAbsolute(outPath) ? outPath : resolve(process.cwd(), outPath)
    mkdirSync(join(absOut, '..'), { recursive: true })
    const buf = Buffer.from(res.data, 'base64')
    writeFileSync(absOut, buf)

    console.log(`✓ Đã xuất ảnh review thành công!`)
    console.log(`  File:      ${absOut}`)
    console.log(`  Kích thước: ${res.width}x${res.height} px`)
    console.log(`  Thời điểm:  ${res.time?.toFixed(2)}s`)
    console.log(`👉 AI Agent có thể dùng công cụ "view_file" trên đường dẫn trên để xem trực quan giao diện!\n`)
  } catch (err) {
    console.error(`✗ Lỗi khi review: ${err.message}`)
    process.exit(1)
  }
}

async function cmdCall(method, paramsArg) {
  if (!method) {
    console.error('Thiếu tên phương thức! Ví dụ: pnpm pxs call get_project_info')
    process.exit(1)
  }
  let params = {}
  if (paramsArg) {
    try {
      params = JSON.parse(paramsArg)
    } catch (e) {
      console.error(`Lỗi định dạng JSON params: ${e.message}`)
      process.exit(1)
    }
  }

  try {
    console.log(`⏳ Đang gọi "${method}"...`)
    const res = await sendCommand(method, params)
    console.log(`✓ Kết quả:`)
    console.log(JSON.stringify(res, null, 2))
  } catch (err) {
    console.error(`✗ Lỗi thực thi "${method}": ${err.message}`)
    process.exit(1)
  }
}

// ------------------------------------------------------------------ Main Entrypoint
async function main() {
  const args = process.argv.slice(2)
  const action = args[0] || '--help'

  switch (action) {
    case 'help':
    case '--help':
    case '-h':
      await cmdHelp(args[1])
      break
    case 'status':
      await cmdStatus()
      break
    case 'inspect':
      await cmdInspect()
      break
    case 'review':
    case 'screenshot':
      await cmdReview(args.slice(1))
      break
    case 'call':
      await cmdCall(args[1], args[2])
      break
    default:
      console.log(`Lệnh không hợp lệ: "${action}". Chạy "pnpm pxs --help" để xem danh sách lệnh.`)
      break
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err)
  process.exit(1)
})
