import { createConnection } from 'node:net'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

function getMcpConfigPath() {
  if (process.env.PARALLAX_MCP_CONFIG) return process.env.PARALLAX_MCP_CONFIG
  const appName = 'parallax-studio'
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), appName, 'mcp.json')
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', appName, 'mcp.json')
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), appName, 'mcp.json')
}

function readConfig() {
  const p = getMcpConfigPath()
  if (!existsSync(p)) throw new Error(`Cannot find config at ${p}`)
  const cfg = JSON.parse(readFileSync(p, 'utf8'))
  return {
    host: '127.0.0.1',
    port: Number(process.env.PARALLAX_MCP_PORT) || cfg.port || 9877,
    token: process.env.PARALLAX_MCP_TOKEN || cfg.token
  }
}

function sendCommand(method, params = {}) {
  const cfg = readConfig()
  return new Promise((resolvePromise, rejectPromise) => {
    const sock = createConnection({ host: cfg.host, port: cfg.port })
    sock.setEncoding('utf8')
    let buffer = ''
    const reqId = Date.now() + Math.random()

    const timeout = setTimeout(() => {
      sock.destroy()
      rejectPromise(new Error(`Timeout waiting for "${method}"`))
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
          clearTimeout(timeout)
          sock.destroy()
          if (res.ok) resolvePromise(res.result)
          else rejectPromise(new Error(res.error || 'Command failed'))
          return
        } catch {}
      }
    })

    sock.on('error', (err) => {
      clearTimeout(timeout)
      rejectPromise(err)
    })
  })
}

async function main() {
  console.log('Connecting to Parallax Studio...')
  const proj = await sendCommand('get_project_info')
  console.log(`Connected to project: "${proj.name}"`)

  // 1. Create a dedicated shot for the 3D House
  console.log('Creating shot: "Ngôi Nhà Lập Thể 3D"...')
  const shot = await sendCommand('add_shot', {
    name: 'Ngôi Nhà Lập Thể 3D',
    duration: 8
  })
  const shotId = shot.id
  console.log(`Created shot id: ${shotId}`)

  // Retrieve the shot's actual world position
  const updatedProj = await sendCommand('get_project_info')
  const shotObj = updatedProj.shots.find((s) => s.id === shotId)
  const [sx, sy, sz] = shotObj?.position ?? [0, 0, 0]
  console.log(`Shot world position: [${sx}, ${sy}, ${sz}]`)

  const houseDir = resolve('assets/house')
  const frontImg = join(houseDir, 'house_front.png')
  const leftImg = join(houseDir, 'house_left.png')
  const rightImg = join(houseDir, 'house_right.png')
  const roofImg = join(houseDir, 'house_roof.png')

  // Precise geometric dimensions:
  // Textures are 860x900. Scale S = 0.6 => W = 516, H = 540, D = 516
  const S = 0.6
  const W = 516
  const H = 540
  const D = 516
  const hw = W / 2 // 258
  const hh = H / 2 // 270
  const hd = D / 2 // 258

  // 2. Add Ground Layer (thảm cỏ sân vườn)
  console.log('Adding ground plane...')
  await sendCommand('add_ground_layer', {
    shot_id: shotId,
    name: 'Sân vườn cỏ xanh',
    color: '#2a4422',
    position: [0, -hh, hd],
    scale: [3.5, 3.5, 1]
  })

  // 3. Add Front Wall (Mặt trước)
  console.log('Adding Front Face (Mặt trước)...')
  await sendCommand('add_image_layer', {
    shot_id: shotId,
    file_path: frontImg,
    name: '1. Mặt Trước (Cửa chính)',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: S,
    auto_scale: false
  })

  // 4. Add Left Wall (Mặt bên trái)
  console.log('Adding Left Face (Mặt hông trái)...')
  await sendCommand('add_image_layer', {
    shot_id: shotId,
    file_path: leftImg,
    name: '2. Mặt Hông Trái (Dây leo)',
    position: [-hw, 0, hd],
    rotation: [0, 90, 0],
    scale: S,
    auto_scale: false
  })

  // 5. Add Right Wall (Mặt bên phải kèm ống khói)
  console.log('Adding Right Face (Mặt hông phải)...')
  await sendCommand('add_image_layer', {
    shot_id: shotId,
    file_path: rightImg,
    name: '3. Mặt Hông Phải (Ống khói)',
    position: [hw, 0, hd],
    rotation: [0, -90, 0],
    scale: S,
    auto_scale: false
  })

  // 6. Add Roof (Mái nhà)
  console.log('Adding Roof Face (Mái nhà)...')
  await sendCommand('add_image_layer', {
    shot_id: shotId,
    file_path: roofImg,
    name: '4. Mái Nhà (Ngói đất nung)',
    position: [0, 190, hd],
    rotation: [-90, 0, 0],
    scale: S,
    auto_scale: false
  })

  // Center of the house box in world coordinates
  const cx = sx
  const cy = sy
  const cz = sz + hd
  const target = [cx, cy - 20, cz]
  console.log(`House box 3D center target: [${cx}, ${cy}, ${cz}]`)

  // 7. Select the shot
  console.log('Selecting shot...')
  await sendCommand('select', { shot_id: shotId })

  // 8. Clear previous camera keyframes
  await sendCommand('clear_keyframes', { target: 'camera' })

  // 9. Set 4 camera orbit keyframes around the house:
  // Keyframe t=0: Nhìn chính diện mặt trước
  console.log('Setting keyframe at_time=0 (Chính diện)...')
  await sendCommand('set_camera', {
    at_time: 0,
    position: [cx, cy, cz - 1100],
    target: target
  })

  // Keyframe t=2.5: Xoay chéo góc trái (thấy mặt trước + mặt trái)
  console.log('Setting keyframe at_time=2.5 (Góc chéo trái)...')
  await sendCommand('set_camera', {
    at_time: 2.5,
    position: [cx - 750, cy + 100, cz - 750],
    target: target
  })

  // Keyframe t=5.0: Nâng góc nhìn từ trên cao xuống (thấy mái nhà + mặt trước + mặt trái)
  console.log('Setting keyframe at_time=5.0 (Góc nhìn trên cao mái nhà)...')
  await sendCommand('set_camera', {
    at_time: 5.0,
    position: [cx - 300, cy + 600, cz - 600],
    target: target
  })

  // Keyframe t=7.5: Xoay sang góc chéo phải (thấy mặt phải ống khói + mái)
  console.log('Setting keyframe at_time=7.5 (Góc chéo phải)...')
  await sendCommand('set_camera', {
    at_time: 7.5,
    position: [cx + 750, cy + 120, cz - 750],
    target: target
  })

  console.log('Taking review screenshots from multiple angles...')
  const outDir = resolve('assets/house/reviews')
  const brainDir = 'C:\\Users\\khuongpv\\.gemini\\antigravity-ide\\brain\\e2d02efd-1afd-4771-a76d-9953c3c5e3b4'
  mkdirSync(outDir, { recursive: true })

  function saveSnap(name, snap) {
    const raw = snap?.data || snap?.base64
    if (!raw) {
      console.warn(`No image data for ${name}`)
      return
    }
    const buf = Buffer.from(raw, 'base64')
    writeFileSync(join(outDir, name), buf)
    writeFileSync(join(brainDir, name), buf)
    console.log(`Saved ${name} (${buf.length} bytes)`)
  }

  // Screenshot 1: t = 0 (Chính diện)
  await sendCommand('set_time', { time: 0 })
  const snapFront = await sendCommand('get_viewport_screenshot', { view: 'camera', width: 960, time: 0 })
  saveSnap('house_review_01_front.png', snapFront)

  // Screenshot 2: t = 2.5 (Góc chéo trái)
  await sendCommand('set_time', { time: 2.5 })
  const snapLeft = await sendCommand('get_viewport_screenshot', { view: 'camera', width: 960, time: 2.5 })
  saveSnap('house_review_02_diagonal_left.png', snapLeft)

  // Screenshot 3: t = 5.0 (Góc nhìn từ trên cao xuống mái)
  await sendCommand('set_time', { time: 5.0 })
  const snapTop = await sendCommand('get_viewport_screenshot', { view: 'camera', width: 960, time: 5.0 })
  saveSnap('house_review_03_top_roof.png', snapTop)

  // Screenshot 4: t = 7.5 (Góc chéo phải ống khói)
  await sendCommand('set_time', { time: 7.5 })
  const snapRight = await sendCommand('get_viewport_screenshot', { view: 'camera', width: 960, time: 7.5 })
  saveSnap('house_review_04_diagonal_right.png', snapRight)

  // Screenshot 5: Toàn cảnh 3D Viewport Orbit
  const snapOrbit = await sendCommand('get_viewport_screenshot', { view: '3d', width: 960, shot_id: shotId })
  saveSnap('house_review_05_3d_orbit.png', snapOrbit)

  console.log('✓ Successfully assembled 3D House Box with 4 transparent faces!')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
