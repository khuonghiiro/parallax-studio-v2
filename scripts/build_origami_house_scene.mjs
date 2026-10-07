import { createConnection } from 'node:net'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
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

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('Connecting to Parallax Studio MCP server...')
  const proj = await sendCommand('get_project_info')
  console.log(`Current project: "${proj.name}", shots: ${proj.shots.length}`)

  // Find or create shot "Ngôi Nhà Lập Thể 3D"
  let houseShot = proj.shots.find(s => s.name === 'Ngôi Nhà Lập Thể 3D')
  if (!houseShot) {
    console.log('Creating shot "Ngôi Nhà Lập Thể 3D"...')
    houseShot = await sendCommand('add_shot', {
      name: 'Ngôi Nhà Lập Thể 3D',
      color: '#00d2ff',
      position: [15000, 0, 0]
    })
  } else {
    // Ensure shot is positioned away from demo scene
    await sendCommand('update_shot', {
      shot_id: houseShot.id,
      position: [15000, 0, 0]
    })
  }

  // Select the house shot
  await sendCommand('select', { shot_id: houseShot.id })

  // Delete existing house layers in this shot to avoid duplicates
  const updatedP = await sendCommand('get_project_info')
  const existingLayers = updatedP.layers.filter(l => l.shot_id === houseShot.id)
  console.log(`Cleaning ${existingLayers.length} old layers in shot...`)
  for (const l of existingLayers) {
    try {
      await sendCommand('delete_layer', { layer_id: l.id })
    } catch (e) {
      console.warn('Could not delete layer', l.id, e.message)
    }
  }

  // Scale factor: S = 0.6
  // Front: 980 x 966
  // Side Left & Right: 840 x 393
  // Roof Left & Right: 840 x 608
  const S = 0.6
  const scale = [S, S, S]

  console.log('Adding Ground Lawn...')
  await sendCommand('add_ground_layer', {
    shot_id: houseShot.id,
    name: 'Thảm Cỏ Sân Vườn',
    position: [0, -289.8, 252],
    scale: [4, 4, 1],
    color: '#2d4a22'
  })

  console.log('Adding Layer 1: Front Facade (Mặt Tiền)...')
  const frontLayer = await sendCommand('add_image_layer', {
    shot_id: houseShot.id,
    file_path: resolve('assets/assembly_3d/house/origami_front.png'),
    name: 'Mặt Tiền Origami (Front)',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: scale,
    auto_scale: false
  })

  console.log('Adding Layer 2: Left Wall (Tường Hông Trái)...')
  const leftWall = await sendCommand('add_image_layer', {
    shot_id: houseShot.id,
    file_path: resolve('assets/assembly_3d/house/origami_side_left.png'),
    name: 'Tường Hông Trái Origami',
    position: [-252, -171.9, 252],
    rotation: [0, 90, 0],
    scale: scale,
    auto_scale: false
  })

  console.log('Adding Layer 3: Right Wall (Tường Hông Phải)...')
  const rightWall = await sendCommand('add_image_layer', {
    shot_id: houseShot.id,
    file_path: resolve('assets/assembly_3d/house/origami_side_right.png'),
    name: 'Tường Hông Phải Origami',
    position: [252, -171.9, 252],
    rotation: [0, -90, 0],
    scale: scale,
    auto_scale: false
  })

  console.log('Adding Layer 4: Left Roof (Mái Nghiêng Trái)...')
  const leftRoof = await sendCommand('add_image_layer', {
    shot_id: houseShot.id,
    file_path: resolve('assets/assembly_3d/house/origami_roof_left.png'),
    name: 'Mái Dốc Trái Origami',
    position: [-126, 77.89, 252],
    rotation: [-43.69, 90, 0],
    scale: scale,
    auto_scale: false
  })

  console.log('Adding Layer 5: Right Roof (Mái Nghiêng Phải)...')
  const rightRoof = await sendCommand('add_image_layer', {
    shot_id: houseShot.id,
    file_path: resolve('assets/assembly_3d/house/origami_roof_right.png'),
    name: 'Mái Dốc Phải Origami',
    position: [126, 77.89, 252],
    rotation: [-43.69, -90, 0],
    scale: scale,
    auto_scale: false
  })

  console.log('Adding Layer 6: Chimney Left Side (Hông Ống Khói Trái)...')
  await sendCommand('add_image_layer', {
    shot_id: houseShot.id,
    file_path: resolve('assets/assembly_3d/house/origami_chimney_side.png'),
    name: 'Hông Ống Khói Trái',
    position: [-28.8, 247.8, 33.9],
    rotation: [0, 90, 0],
    scale: scale,
    auto_scale: false
  })

  console.log('Adding Layer 7: Chimney Right Side (Hông Ống Khói Phải)...')
  await sendCommand('add_image_layer', {
    shot_id: houseShot.id,
    file_path: resolve('assets/assembly_3d/house/origami_chimney_side.png'),
    name: 'Hông Ống Khói Phải',
    position: [28.8, 247.8, 33.9],
    rotation: [0, -90, 0],
    scale: scale,
    auto_scale: false
  })


  // Set composition duration to 10s
  await sendCommand('set_composition', { duration: 10, fps: 30 })

  // Animate Camera
  console.log('Configuring smooth camera orbit around the house...')
  const updatedProj = await sendCommand('get_project_info')
  const shotObj = updatedProj.shots.find(s => s.id === houseShot.id) || houseShot
  const rawPos = shotObj.position
  const [sx, sy, sz] = Array.isArray(rawPos) ? rawPos : (rawPos?.value ?? [0, 0, 0])
  console.log(`Shot world origin: [${sx}, ${sy}, ${sz}]`)

  const targetCenter = [sx, sy + 60, sz + 252]

  await sendCommand('clear_keyframes', { target: 'camera' })

  // Keyframe 1: Front view at t = 0s
  await sendCommand('set_camera', {
    position: [sx, sy + 80, sz - 1150],
    target: targetCenter,
    at_time: 0.0
  })

  // Keyframe 2: Diagonal Left at t = 2.5s
  await sendCommand('set_camera', {
    position: [sx - 720, sy + 180, sz - 550],
    target: targetCenter,
    at_time: 2.5
  })

  // Keyframe 3: Top Roof / High Angle at t = 5.0s
  await sendCommand('set_camera', {
    position: [sx - 150, sy + 680, sz - 350],
    target: [sx, sy + 100, sz + 252],
    at_time: 5.0
  })

  // Keyframe 4: Diagonal Right at t = 7.5s
  await sendCommand('set_camera', {
    position: [sx + 720, sy + 180, sz - 550],
    target: targetCenter,
    at_time: 7.5
  })

  // Keyframe 5: Return to front at t = 10.0s
  await sendCommand('set_camera', {
    position: [sx, sy + 80, sz - 1150],
    target: targetCenter,
    at_time: 10.0
  })

  // Ensure camera view is selected
  await sendCommand('set_view', { view: 'camera' })

  // Review snapshots
  const artifactDir = 'C:\\Users\\khuongpv\\.gemini\\antigravity-ide\\brain\\e2d02efd-1afd-4771-a76d-9953c3c5e3b4'
  const reviews = [
    { time: 0.0, name: 'origami_review_01_front.png', label: 'Góc 1: Chính diện (Chỉ thấy mặt tiền)' },
    { time: 2.5, name: 'origami_review_02_diagonal_left.png', label: 'Góc 2: Chéo trái (Khít 100% không kẽ hở)' },
    { time: 5.0, name: 'origami_review_03_top_roof.png', label: 'Góc 3: Nhìn từ trên xuống (Mái dốc đôi kín khít)' },
    { time: 7.5, name: 'origami_review_04_diagonal_right.png', label: 'Góc 4: Chéo phải (Khít 100% không kẽ hở)' }
  ]

  for (const rev of reviews) {
    console.log(`Setting time t = ${rev.time}s for ${rev.label}...`)
    await sendCommand('set_time', { time: rev.time })
    await sleep(400)
    const shot = await sendCommand('get_viewport_screenshot', { view: 'camera', quality: 95 })
    if (shot && shot.data) {
      const buf = Buffer.from(shot.data, 'base64')
      writeFileSync(join('assets', 'house', rev.name), buf)
      writeFileSync(join(artifactDir, rev.name), buf)
      console.log(`  Saved ${rev.name} (${Math.round(buf.length / 1024)} KB)`)
    }
  }

  // 3D Orbit view
  await sendCommand('set_view', { view: 'orbit' })
  await sleep(400)
  const orbitShot = await sendCommand('get_viewport_screenshot', { view: 'orbit', quality: 90 })
  if (orbitShot && orbitShot.data) {
    const buf = Buffer.from(orbitShot.data, 'base64')
    writeFileSync(join('assets', 'house', 'origami_review_05_3d_orbit.png'), buf)
    writeFileSync(join(artifactDir, 'origami_review_05_3d_orbit.png'), buf)
    console.log(`  Saved origami_review_05_3d_orbit.png (${Math.round(buf.length / 1024)} KB)`)
  }

  await sendCommand('set_view', { view: 'camera' })
  await sendCommand('set_time', { time: 2.5 })

  console.log('✅ Hoàn thành lắp ráp ngôi nhà 3D Origami Folding hoàn mỹ!')
}

main().catch(err => {
  console.error('Error running script:', err)
  process.exit(1)
})
