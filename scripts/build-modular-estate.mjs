import { createConnection } from 'node:net'
import { readConfigFile } from '../mcp-server/catalog/index.mjs'

function readConfig() {
  const cfg = readConfigFile()
  if (!cfg) throw new Error('mcp.json not found')
  return { host: '127.0.0.1', port: cfg.port || 9877, token: cfg.token }
}

function sendCommand(method, params = {}) {
  const cfg = readConfig()
  return new Promise((resolve, reject) => {
    const sock = createConnection({ host: cfg.host, port: cfg.port })
    sock.setEncoding('utf8')
    let buffer = ''
    const reqId = Date.now() + Math.floor(Math.random() * 1000)
    const timeout = setTimeout(() => {
      sock.destroy()
      reject(new Error(`Timeout waiting for "${method}"`))
    }, 15000)

    sock.once('connect', () => {
      sock.write(JSON.stringify({ id: reqId, token: cfg.token, method, params }) + '\n')
    })

    sock.on('data', (chunk) => {
      buffer += chunk
      let idx
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        if (!line) continue
        let res
        try {
          res = JSON.parse(line)
        } catch {
          continue
        }
        if (res.id !== reqId && res.id !== null) continue
        clearTimeout(timeout)
        sock.destroy()
        if (res.ok) resolve(res.result)
        else reject(new Error(res.error || 'Unknown error'))
        return
      }
    })

    sock.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

async function main() {
  console.log('🚀 Bắt đầu tạo các thành phần 3D modular và lắp ráp 3D-on-3D...')

  // 1. Cửa Sổ Tudor 3D (Modular)
  console.log('📦 1. Tạo Cửa Sổ Tudor (model-window-tudor)...')
  const tplWindow = await sendCommand('list_assembly_templates', { category: 'decor' })
  // Template window-shuttered
  const windowFaces = [
    {
      id: 'window-glass',
      name: 'Mặt kính hoa văn chì',
      assetPath: 'assembly_3d/modular/decor_window.png',
      width: 200,
      height: 260,
      position: [0, 0, -2],
      rotation: [0, 0, 0]
    },
    {
      id: 'window-lintel',
      name: 'Khung trên gỗ sồi',
      color: '#451a03',
      width: 250,
      height: 30,
      position: [0, 145, -12],
      rotation: [0, 0, 0]
    },
    {
      id: 'window-sill-top',
      name: 'Bậu cửa mặt trên',
      color: '#3b1c0b',
      width: 250,
      height: 40,
      position: [0, -130, -20],
      rotation: [-90, 0, 0]
    },
    {
      id: 'window-sill-front',
      name: 'Bậu cửa mặt đứng',
      color: '#291409',
      width: 250,
      height: 16,
      position: [0, -138, -40],
      rotation: [0, 0, 0]
    },
    {
      id: 'window-shutter-left',
      name: 'Cánh cửa sổ trái mở',
      assetPath: 'assembly_3d/modular/decor_window.png',
      width: 105,
      height: 260,
      position: [-89.69, 0, -32.11],
      rotation: [0, 35, 0]
    },
    {
      id: 'window-shutter-right',
      name: 'Cánh cửa sổ phải mở',
      assetPath: 'assembly_3d/modular/decor_window.png',
      width: 105,
      height: 260,
      position: [89.69, 0, -32.11],
      rotation: [0, -35, 0]
    }
  ]
  await sendCommand('save_assembly_model', {
    id: 'model-window-tudor',
    name: 'Cửa Sổ Tudor Khung Gỗ 3D',
    category: 'decor',
    description: 'Cửa sổ hoa văn chì cổ điển có bậu cửa gỗ và 2 cánh mở góc 35 độ, gắn lên tường.',
    scale: 0.6,
    faces: windowFaces
  })
  console.log('✓ Đã lưu model-window-tudor')

  // 2. Cửa Vòm Cổng Đá 3D (Modular)
  console.log('📦 2. Tạo Cửa Vòm Cổng Đá (model-door-arched)...')
  const doorFaces = [
    {
      id: 'door-leaf',
      name: 'Cánh cửa gỗ vòm đá',
      assetPath: 'assembly_3d/modular/decor_door.png',
      width: 220,
      height: 400,
      position: [0, 0, -2],
      rotation: [0, 0, 0]
    },
    {
      id: 'door-frame-left',
      name: 'Cột trụ đá trái',
      color: '#64748b',
      width: 30,
      height: 420,
      position: [-125, 10, -8],
      rotation: [0, 0, 0]
    },
    {
      id: 'door-frame-right',
      name: 'Cột trụ đá phải',
      color: '#64748b',
      width: 30,
      height: 420,
      position: [125, 10, -8],
      rotation: [0, 0, 0]
    },
    {
      id: 'door-frame-top',
      name: 'Vòm đá đỉnh cửa',
      color: '#475569',
      width: 280,
      height: 30,
      position: [0, 215, -8],
      rotation: [0, 0, 0]
    },
    {
      id: 'door-step-top',
      name: 'Mặt bậc thềm đá',
      color: '#334155',
      width: 320,
      height: 80,
      position: [0, -200, -40],
      rotation: [-90, 0, 0]
    },
    {
      id: 'door-step-front',
      name: 'Mặt đứng bậc thềm',
      color: '#1e293b',
      width: 320,
      height: 30,
      position: [0, -215, -80],
      rotation: [0, 0, 0]
    },
    {
      id: 'door-canopy-roof',
      name: 'Mái che ngói nghiêng',
      assetPath: 'assembly_3d/modular/roof_terracotta.png',
      width: 320,
      height: 120,
      position: [0, 260, -50.7],
      rotation: [-25, 0, 0]
    }
  ]
  await sendCommand('save_assembly_model', {
    id: 'model-door-arched',
    name: 'Cửa Vòm Cổng Đá 3D',
    category: 'decor',
    description: 'Cửa ra vào vòm cuốn đá khối, cánh gỗ sồi bản lề rèn thép, bậc thềm đá và mái ngói hiên.',
    scale: 0.6,
    faces: doorFaces
  })
  console.log('✓ Đã lưu model-door-arched')

  // 3. Bồn Hoa Dưới Cửa 3D (Modular)
  console.log('📦 3. Tạo Bồn Hoa Ban Công (model-flower-box)...')
  const flowerFaces = [
    {
      id: 'planter-front',
      name: 'Thành bồn trước',
      color: '#5c3a21',
      width: 260,
      height: 70,
      position: [0, 0, -90],
      rotation: [0, 0, 0]
    },
    {
      id: 'planter-left',
      name: 'Thành bồn trái',
      color: '#4a2e18',
      width: 60,
      height: 70,
      position: [-130, 0, -60],
      rotation: [0, 90, 0]
    },
    {
      id: 'planter-right',
      name: 'Thành bồn phải',
      color: '#4a2e18',
      width: 60,
      height: 70,
      position: [130, 0, -60],
      rotation: [0, -90, 0]
    },
    {
      id: 'planter-bottom',
      name: 'Đáy bồn gỗ',
      color: '#3d2512',
      width: 260,
      height: 60,
      position: [0, -35, -60],
      rotation: [90, 0, 0]
    },
    {
      id: 'planter-soil',
      name: 'Đất mùn trồng hoa',
      color: '#1c1917',
      width: 250,
      height: 55,
      position: [0, 25, -60],
      rotation: [-90, 0, 0]
    },
    {
      id: 'flowers-front',
      name: 'Khóm hoa trước rủ',
      assetPath: 'assembly_3d/modular/decor_flower_box.png',
      width: 280,
      height: 110,
      position: [0, 60, -75],
      rotation: [0, 0, 0]
    },
    {
      id: 'flowers-back',
      name: 'Khóm hoa sau vươn cao',
      assetPath: 'assembly_3d/modular/decor_flower_box.png',
      width: 280,
      height: 140,
      position: [0, 75, -45],
      rotation: [0, 0, 0]
    }
  ]
  await sendCommand('save_assembly_model', {
    id: 'model-flower-box',
    name: 'Bồn Hoa Dưới Cửa 3D',
    category: 'decor',
    description: 'Bồn hoa gỗ sồi treo dưới bậu cửa sổ, ngập tràn hoa phong lữ và dây leo trường xuân.',
    scale: 0.6,
    faces: flowerFaces
  })
  console.log('✓ Đã lưu model-flower-box')

  // 4. Ống Khói Gạch Cổ Điển 3D (Modular)
  console.log('📦 4. Tạo Ống Khói Gạch (model-chimney-brick)...')
  const chimFaces = [
    {
      id: 'chim-front',
      name: 'Vách ống khói trước',
      assetPath: 'assembly_3d/modular/decor_chimney.png',
      width: 110,
      height: 260,
      position: [0, 0, -55],
      rotation: [0, 0, 0]
    },
    {
      id: 'chim-back',
      name: 'Vách ống khói sau',
      assetPath: 'assembly_3d/modular/decor_chimney.png',
      width: 110,
      height: 260,
      position: [0, 0, 55],
      rotation: [0, 180, 0]
    },
    {
      id: 'chim-left',
      name: 'Vách ống khói trái',
      assetPath: 'assembly_3d/modular/decor_chimney.png',
      width: 110,
      height: 260,
      position: [-55, 0, 0],
      rotation: [0, 90, 0]
    },
    {
      id: 'chim-right',
      name: 'Vách ống khói phải',
      assetPath: 'assembly_3d/modular/decor_chimney.png',
      width: 110,
      height: 260,
      position: [55, 0, 0],
      rotation: [0, -90, 0]
    },
    {
      id: 'chim-cap',
      name: 'Mũ ống khói trên',
      color: '#991b1b',
      width: 140,
      height: 140,
      position: [0, 138, 0],
      rotation: [-90, 0, 0]
    },
    {
      id: 'chim-rim',
      name: 'Viền gờ mũ ống khói',
      color: '#7f1d1d',
      width: 140,
      height: 16,
      position: [0, 130, -70],
      rotation: [0, 0, 0]
    }
  ]
  await sendCommand('save_assembly_model', {
    id: 'model-chimney-brick',
    name: 'Ống Khói Gạch Cổ Điển 3D',
    category: 'decor',
    description: 'Ống khói gạch nung nắp chụp gờ cổ điển, cắm xuyên mái dốc công trình.',
    scale: 0.6,
    faces: chimFaces
  })
  console.log('✓ Đã lưu model-chimney-brick')

  // 5. Bụi Cây Hoa Sân Vườn 3D (Modular Nature)
  console.log('📦 5. Tạo Bụi Cây Sân Vườn (model-garden-bush)...')
  const bushFaces = [
    {
      id: 'bush-core',
      name: 'Cụm tán trung tâm',
      assetPath: 'assembly_3d/modular/nature_bush.png',
      width: 320,
      height: 280,
      position: [0, 0, 0],
      rotation: [0, 0, 0]
    },
    {
      id: 'bush-cross',
      name: 'Cụm tán đan chéo thể tích',
      assetPath: 'assembly_3d/modular/nature_bush.png',
      width: 320,
      height: 280,
      position: [0, 0, 0],
      rotation: [0, 90, 0]
    },
    {
      id: 'bush-front-left',
      name: 'Cụm lá xòe trái trước',
      assetPath: 'assembly_3d/modular/nature_bush.png',
      width: 240,
      height: 220,
      position: [-80, -20, -70],
      rotation: [0, 30, 0]
    },
    {
      id: 'bush-front-right',
      name: 'Cụm lá xòe phải trước',
      assetPath: 'assembly_3d/modular/nature_bush.png',
      width: 240,
      height: 220,
      position: [80, -20, -70],
      rotation: [0, -30, 0]
    },
    {
      id: 'bush-top-dome',
      name: 'Vòm lá đón sáng trên',
      assetPath: 'assembly_3d/modular/nature_bush.png',
      width: 260,
      height: 260,
      position: [0, 80, 0],
      rotation: [-90, 0, 0]
    }
  ]
  await sendCommand('save_assembly_model', {
    id: 'model-garden-bush',
    name: 'Bụi Cây Hoa Sân Vườn 3D',
    category: 'nature',
    description: 'Bụi cây xanh xum xuê 5 cụm đan chéo đa góc nhìn thể tích, rực rỡ điểm xuyết hoa cỏ.',
    scale: 0.6,
    faces: bushFaces
  })
  console.log('✓ Đã lưu model-garden-bush')

  // 6. Khung Nhà Mái Chữ A Tudor (Shell 3D)
  console.log('📦 6. Tạo Khung Nhà Tudor Rỗng (model-house-shell)...')
  const shellFaces = [
    {
      id: 'face-front',
      name: 'Tường Đầu Hồi Trước (Gable Front)',
      assetPath: 'assembly_3d/modular/wall_front_tudor.png',
      width: 600,
      height: 660,
      position: [0, 130, 0],
      rotation: [0, 0, 0]
    },
    {
      id: 'face-back',
      name: 'Tường Đầu Hồi Sau (Gable Back)',
      assetPath: 'assembly_3d/modular/wall_front_tudor.png',
      width: 600,
      height: 660,
      position: [0, 130, 600],
      rotation: [0, 180, 0]
    },
    {
      id: 'face-left',
      name: 'Vách Tường Trái (Left Wall)',
      assetPath: 'assembly_3d/modular/wall_side_tudor.png',
      width: 600,
      height: 400,
      position: [-300, 0, 300],
      rotation: [0, 90, 0]
    },
    {
      id: 'face-right',
      name: 'Vách Tường Phải (Right Wall)',
      assetPath: 'assembly_3d/modular/wall_side_tudor.png',
      width: 600,
      height: 400,
      position: [300, 0, 300],
      rotation: [0, -90, 0]
    },
    {
      id: 'face-roof-left',
      name: 'Mái Dốc Ngói Trái (Left Roof)',
      assetPath: 'assembly_3d/modular/roof_terracotta.png',
      width: 660,
      height: 397,
      position: [-150, 330, 300],
      rotation: [-40.9, 90, 0]
    },
    {
      id: 'face-roof-right',
      name: 'Mái Dốc Ngói Phải (Right Roof)',
      assetPath: 'assembly_3d/modular/roof_terracotta.png',
      width: 660,
      height: 397,
      position: [150, 330, 300],
      rotation: [-40.9, -90, 0]
    }
  ]
  await sendCommand('save_assembly_model', {
    id: 'model-house-shell',
    name: 'Khung Nhà Mái Chữ A Tudor (Shell 3D)',
    category: 'architecture',
    description: 'Khung nhà rỗng phong cách Tudor thuần túy: tường trát vôi trắng nẹp gỗ và mái ngói đất nung, sẵn sàng lắp ráp chi tiết trang trí.',
    scale: 0.6,
    faces: shellFaces
  })
  console.log('✓ Đã lưu model-house-shell')

  // 7. LẮP RÁP 3D-on-3D: Tạo Master Composite "Biệt Thự Tudor 3D Hoàn Chỉnh"
  console.log('🏗️ 7. Tiến hành ghép 3D LẮP 3D tạo Biệt Thự Tudor Hoàn Chỉnh...')
  // Bắt đầu từ bản sao của model-house-shell
  await sendCommand('save_assembly_model', {
    id: 'model-tudor-estate',
    name: 'Biệt Thự Tudor 3D Lắp Ráp Hoàn Chỉnh',
    category: 'architecture',
    description: 'Biệt thự Tudor cao cấp ghép nối modular 3D hoàn chỉnh: Cửa vòm đá, cửa sổ chì mở cánh, bồn hoa ban công, ống khói gạch và bụi cây cảnh sân vườn.',
    scale: 0.6,
    faces: shellFaces
  })

  // 7.1 Gắn Cửa Vòm Đá lên tường trước (snaps flush to ground at Y = -200)
  console.log('   ↳ Gắn Cửa Vòm Cổng Đá lên tường trước...')
  let r = await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-door-arched',
    face_id: 'face-front',
    uv: [0.5, 0.2576],
    scale: 0.85,
    prefix_names: false
  })
  console.log('     [OK] Total faces:', r.faceCount)

  // 7.2 Gắn Cửa Sổ Tudor lên tường trước tầng 2 (centered in gable truss at Y = 270)
  console.log('   ↳ Gắn Cửa Sổ Tudor lên tường trước...')
  r = await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-window-tudor',
    face_id: 'face-front',
    uv: [0.5, 0.7121],
    scale: 0.75,
    prefix_names: false
  })
  console.log('     [OK] Total faces:', r.faceCount)

  // 7.3 Gắn Bồn Hoa Ban Công trực tiếp dưới bậu cửa sổ tầng 2 (gapless snug at Y = 141)
  console.log('   ↳ Gắn Bồn Hoa Ban Công dưới cửa sổ tầng 2...')
  r = await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-flower-box',
    face_id: 'face-front',
    uv: [0.5, 0.5167],
    scale: 0.70,
    prefix_names: false
  })
  console.log('     [OK] Total faces:', r.faceCount)

  // 7.4 Gắn Cửa Sổ bên tường trái
  console.log('   ↳ Gắn Cửa Sổ Tudor bên vách trái...')
  r = await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-window-tudor',
    face_id: 'face-left',
    uv: [0.5, 0.55],
    scale: 0.75,
    prefix_names: false
  })
  console.log('     [OK] Total faces:', r.faceCount)

  // 7.5 Gắn Cửa Sổ bên tường phải
  console.log('   ↳ Gắn Cửa Sổ Tudor bên vách phải...')
  r = await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-window-tudor',
    face_id: 'face-right',
    uv: [0.5, 0.55],
    scale: 0.75,
    prefix_names: false
  })
  console.log('     [OK] Total faces:', r.faceCount)

  // 7.6 Ghép Ống Khói cắm vào mái dốc
  console.log('   ↳ Ghép Ống Khói Gạch cắm vào mái phải...')
  r = await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-chimney-brick',
    face_id: 'face-roof-right',
    uv: [0.45, 0.65],
    scale: 0.85,
    prefix_names: false
  })
  console.log('     [OK] Total faces:', r.faceCount)

  // 7.7 Thêm Bụi Cây Sân Vườn bên phải (base resting on ground Y = -200)
  console.log('   ↳ Bố trí Bụi Cây Hoa Sân Vườn bên phải...')
  r = await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-garden-bush',
    at: [340, -88, 70],
    scale: 0.85,
    prefix_names: false
  })
  console.log('     [OK] Total faces:', r.faceCount)

  // 7.8 Thêm Bụi Cây Sân Vườn bên trái (base resting on ground Y = -200)
  console.log('   ↳ Bố trí Bụi Cây Hoa Sân Vườn bên trái...')
  r = await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-garden-bush',
    at: [-340, -88, 70],
    scale: 0.85,
    prefix_names: false
  })
  console.log('     [OK] Total faces:', r.faceCount)

  // 7.9 Thêm Bụi Cây hoa nhỏ phía trước trái tiền cảnh
  console.log('   ↳ Bố trí Bụi Cây hoa nhỏ phía trước...')
  r = await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-garden-bush',
    at: [-230, -112, 130],
    scale: 0.65,
    prefix_names: false
  })
  console.log('     [OK] Total faces:', r.faceCount)

  // 7.10 Thêm Bụi Cây hoa nhỏ phía trước phải tiền cảnh
  r = await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-garden-bush',
    at: [230, -112, 130],
    scale: 0.65,
    prefix_names: false
  })
  console.log('     [OK] Total faces:', r.faceCount)

  // 7.9 Chạy auto clip để cắt mặt đâm xuyên
  console.log('   ↳ Cắt mặt đâm xuyên tự động (auto_assembly_clip)...')
  await sendCommand('auto_assembly_clip', { model_id: 'model-tudor-estate' })

  // 7.10 Bật ánh sáng mặt trời & đổ bóng râm
  console.log('   ↳ Cấu hình ánh sáng tự nhiên và đổ bóng (set_assembly_lighting)...')
  await sendCommand('set_assembly_lighting', {
    model_id: 'model-tudor-estate',
    preset: 'morning',
    sun: true,
    shadows: true,
    azimuth: 45,
    elevation: 35,
    intensity: 1.2
  })

  console.log('✨ Kiểm tra danh sách mô hình sau khi tạo...')
  const list = await sendCommand('list_models3d', {})
  console.log(`Đã tạo thành công ${list.count} mô hình:`)
  list.models.forEach((m) => {
    console.log(` - [${m.category}] ${m.id}: "${m.name}" (${m.faceCount} faces)`)
  })
}

main().catch((err) => {
  console.error('❌ Lỗi:', err)
  process.exit(1)
})
