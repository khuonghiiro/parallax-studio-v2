import { createConnection } from 'node:net'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

function readConfig() {
  const p1 = resolve(process.cwd(), 'mcp.json')
  const p2 = join(process.env.APPDATA || '', 'parallax-studio', 'mcp.json')
  const path = existsSync(p1) ? p1 : existsSync(p2) ? p2 : null
  if (!path) throw new Error('Không tìm thấy file cấu hình mcp.json.')
  const cfg = JSON.parse(readFileSync(path, 'utf8'))
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
      rejectPromise(new Error(`Timeout 20s cho lệnh ${method}`))
    }, 20000)

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
              rejectPromise(new Error(res.error || 'Lỗi từ Parallax Studio'))
            }
            return
          }
        } catch {
          // ignore
        }
      }
    })

    sock.on('error', (err) => {
      clearTimeout(timeout)
      rejectPromise(new Error(`Không thể kết nối TCP port ${cfg.port}: ${err.message}`))
    })
  })
}

async function main() {
  console.log('🚀 [MCP SCRIPT] Bắt đầu xây dựng cảnh demo mới qua MCP...')

  // 0. Tạo project mới tinh để xoá sạch mọi cảnh cũ
  console.log('0. Khởi tạo dự án mới (new_project)...')
  await sendCommand('new_project', { width: 1920, height: 1080, fps: 30, duration: 10 })
  console.log('   ✓ Dự án mới đã được khởi tạo, sạch toàn bộ demo canvas cũ.')

  // 1. Tạo shot mới
  console.log('1. Tạo phân cảnh mới (Shot)...')
  const shot = await sendCommand('add_shot', {
    name: 'Thung Lũng Huyền Ảo (Transparent Assets)',
    duration: 8
  })
  console.log(`   ✓ Đã tạo Shot: ${shot.name} (id: ${shot.id})`)

  // 2. Thêm các layer ảnh nền trong suốt
  const layers = [
    {
      name: 'Bầu trời hoàng hôn',
      file: 'assets/demo_transparent/layer1_sky.png',
      z: 3200,
      scale: 1
    },
    {
      name: 'Dãy núi xa',
      file: 'assets/demo_transparent/layer2_distant_mountains.png',
      z: 1800,
      scale: 1
    },
    {
      name: 'Đảo đá bay kỳ ảo',
      file: 'assets/demo_transparent/layer3_floating_island.png',
      z: 950,
      position: [-60, 20, 950],
      scale: 1
    },
    {
      name: 'Cổng di tích cổ',
      file: 'assets/demo_transparent/layer4_ancient_ruins.png',
      z: 450,
      position: [140, -20, 450],
      scale: 1
    },
    {
      name: 'Dây leo tiền cảnh',
      file: 'assets/demo_transparent/layer5_foreground_vines.png',
      z: -120,
      scale: 1
    }
  ]

  for (let i = 0; i < layers.length; i++) {
    const l = layers[i]
    console.log(`2.${i + 1} Thêm layer "${l.name}" tại Z = ${l.z}...`)
    const absPath = resolve(process.cwd(), l.file)
    const res = await sendCommand('add_image_layer', {
      file_path: absPath,
      shot_id: shot.id,
      name: l.name,
      z: l.z,
      position: l.position,
      scale: l.scale
    })
    console.log(`   ✓ Layer "${l.name}" id: ${res.id}`)
  }

  // 3. Thêm Text Layer 3D
  console.log('3. Thêm Text Layer 3D...')
  const textLayer = await sendCommand('add_text_layer', {
    text: 'PARALLAX 2.5D',
    shot_id: shot.id,
    z: 600,
    font_size: 72,
    color: '#ffe599',
    position: [0, 160, 600]
  })
  console.log(`   ✓ Đã thêm Text Layer id: ${textLayer.id}`)

  // 4. Thêm hạt ánh sáng lung linh (Particles)
  console.log('4. Thêm hiệu ứng hạt ánh sáng (Fireflies)...')
  const partLayer = await sendCommand('add_particles', {
    preset: 'fireflies',
    shot_id: shot.id,
    density: 60
  })
  console.log(`   ✓ Đã thêm Particle Layer id: ${partLayer.id}`)

  // 5. Áp dụng chuyển động camera
  console.log('5. Áp dụng Camera Preset "dollyIn"...')
  await sendCommand('apply_camera_preset', {
    preset: 'dollyIn',
    shot_id: shot.id,
    start: 0,
    end: 8,
    intensity: 1.2
  })
  console.log('   ✓ Đã áp dụng camera preset dollyIn')

  // Đặt con trỏ thời gian về 2.5s để thấy chuyển động camera
  await sendCommand('set_time', { time: 2.5 })

  // 6. Chụp ảnh review từ Viewport
  console.log('6. Chụp ảnh review từ Camera Viewport...')
  const camShot = await sendCommand('get_viewport_screenshot', {
    view: 'camera',
    width: 960,
    format: 'png'
  })
  const outDir = resolve(process.cwd(), 'artifacts')
  mkdirSync(outDir, { recursive: true })
  const camOut = join(outDir, 'mcp_demo_camera.png')
  writeFileSync(camOut, Buffer.from(camShot.data, 'base64'))
  console.log(`   ✓ Đã lưu ảnh camera review tại: ${camOut}`)

  console.log('7. Chụp ảnh review từ 3D Orbit Viewport...')
  const orbitShot = await sendCommand('get_viewport_screenshot', {
    view: '3d',
    width: 960,
    format: 'png'
  })
  const orbitOut = join(outDir, 'mcp_demo_3d.png')
  writeFileSync(orbitOut, Buffer.from(orbitShot.data, 'base64'))
  console.log(`   ✓ Đã lưu ảnh 3D orbit review tại: ${orbitOut}`)

  console.log('\n🎉 [HOÀN TẤT] Cảnh demo mới với các layer ảnh trong suốt đã được dựng thành công 100% qua MCP!')
}

main().catch((err) => {
  console.error('✗ Lỗi:', err)
  process.exit(1)
})
