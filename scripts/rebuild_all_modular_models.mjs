import { createConnection } from 'node:net'
import { writeFileSync } from 'node:fs'
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
    }, 20000)

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

async function captureAndSaveThumbnail(modelId, category, folderName) {
  console.log(`📸 Chụp thumbnail 3D cho ${modelId}...`)
  await sendCommand('open_assembly_workshop', { model_id: modelId })
  await new Promise((r) => setTimeout(r, 2000))

  const shot = await sendCommand('get_assembly_screenshot', {
    preset: 'iso',
    auto_fit: true,
    transparent: true
  })

  if (shot?.data) {
    const buf = Buffer.from(shot.data, 'base64')
    const outPath = `asset-3ds/${category}/${folderName}/thumbnail.png`
    writeFileSync(outPath, buf)
    writeFileSync(`D:/_tmp/${folderName}_iso.png`, buf)
    console.log(`   ✓ Đã lưu thumbnail: ${outPath}`)
  }

  await sendCommand('close_assembly_workshop', { save: true })
}

export function getCleanHouseShellFaces() {
  return [
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
      width: 600,
      height: 397,
      position: [-150, 330, 300],
      rotation: [-49.09, 90, 0]
    },
    {
      id: 'face-roof-right',
      name: 'Mái Dốc Ngói Phải (Right Roof)',
      assetPath: 'assembly_3d/modular/roof_terracotta.png',
      width: 600,
      height: 397,
      position: [150, 330, 300],
      rotation: [-49.09, -90, 0]
    }
  ]
}

export function getCleanChimneyFaces() {
  const w = 100
  const h = 260
  const half = w / 2

  return [
    {
      id: 'chim-front',
      name: 'Vách ống khói gạch trước',
      assetPath: 'assembly_3d/modular/decor_chimney_brick.png',
      width: w,
      height: h,
      position: [0, 0, -half],
      rotation: [0, 0, 0]
    },
    {
      id: 'chim-back',
      name: 'Vách ống khói gạch sau',
      assetPath: 'assembly_3d/modular/decor_chimney_brick.png',
      width: w,
      height: h,
      position: [0, 0, half],
      rotation: [0, 180, 0]
    },
    {
      id: 'chim-left',
      name: 'Vách ống khói gạch trái',
      assetPath: 'assembly_3d/modular/decor_chimney_brick.png',
      width: w,
      height: h,
      position: [-half, 0, 0],
      rotation: [0, 90, 0]
    },
    {
      id: 'chim-right',
      name: 'Vách ống khói gạch phải',
      assetPath: 'assembly_3d/modular/decor_chimney_brick.png',
      width: w,
      height: h,
      position: [half, 0, 0],
      rotation: [0, -90, 0]
    },
    // Gờ đá mũ ống khói (Stone collar)
    {
      id: 'chim-cap-front',
      name: 'Gờ đá mũ trước',
      assetPath: 'assembly_3d/modular/decor_chimney_cap.png',
      width: 116,
      height: 26,
      position: [0, 130, -58],
      rotation: [0, 0, 0]
    },
    {
      id: 'chim-cap-back',
      name: 'Gờ đá mũ sau',
      assetPath: 'assembly_3d/modular/decor_chimney_cap.png',
      width: 116,
      height: 26,
      position: [0, 130, 58],
      rotation: [0, 180, 0]
    },
    {
      id: 'chim-cap-left',
      name: 'Gờ đá mũ trái',
      assetPath: 'assembly_3d/modular/decor_chimney_cap.png',
      width: 116,
      height: 26,
      position: [-58, 130, 0],
      rotation: [0, 90, 0]
    },
    {
      id: 'chim-cap-right',
      name: 'Gờ đá mũ phải',
      assetPath: 'assembly_3d/modular/decor_chimney_cap.png',
      width: 116,
      height: 26,
      position: [58, 130, 0],
      rotation: [0, -90, 0]
    },
    // Mặt nắp đá trên cùng
    {
      id: 'chim-cap-top',
      name: 'Mặt đá nắp trên',
      color: '#78716c',
      width: 120,
      height: 120,
      position: [0, 143, 0],
      rotation: [-90, 0, 0]
    },
    // Ống gốm thoát khói đỉnh
    {
      id: 'chim-pot-front',
      name: 'Ống gốm thoát khói',
      assetPath: 'assembly_3d/modular/decor_chimney_pot.png',
      width: 38,
      height: 42,
      position: [0, 164, 0],
      rotation: [0, 0, 0]
    },
    {
      id: 'chim-pot-side',
      name: 'Ống gốm thoát khói góc nghiêng',
      assetPath: 'assembly_3d/modular/decor_chimney_pot.png',
      width: 38,
      height: 42,
      position: [0, 164, 0],
      rotation: [0, 90, 0]
    }
  ]
}

export function getCleanWindowFaces() {
  return [
    {
      id: 'window-glass',
      name: 'Khung kính quả trám Tudor',
      assetPath: 'assembly_3d/modular/decor_window_glass.png',
      width: 180,
      height: 260,
      position: [0, 0, -2],
      rotation: [0, 0, 0]
    },
    {
      id: 'window-lintel',
      name: 'Thanh trán trên gỗ sồi',
      color: '#451a03',
      width: 210,
      height: 24,
      position: [0, 142, -6],
      rotation: [0, 0, 0]
    },
    // Bậu cửa sổ đá (Stone sill)
    {
      id: 'window-sill-top',
      name: 'Mặt trên bậu cửa đá',
      color: '#a8a29e',
      width: 220,
      height: 35,
      position: [0, -130, -17.5],
      rotation: [-90, 0, 0]
    },
    {
      id: 'window-sill-front',
      name: 'Gờ đứng bậu cửa đá',
      assetPath: 'assembly_3d/modular/decor_window_sill.png',
      width: 220,
      height: 20,
      position: [0, -140, -35],
      rotation: [0, 0, 0]
    },
    // Cánh cửa sổ mở góc 35 độ
    {
      id: 'window-shutter-left',
      name: 'Cánh cửa sổ gỗ trái mở',
      assetPath: 'assembly_3d/modular/decor_window_shutter.png',
      width: 45,
      height: 245,
      position: [-71.5, 0, -16.9],
      rotation: [0, 35, 0]
    },
    {
      id: 'window-shutter-right',
      name: 'Cánh cửa sổ gỗ phải mở',
      assetPath: 'assembly_3d/modular/decor_window_shutter.png',
      width: 45,
      height: 245,
      position: [71.5, 0, -16.9],
      rotation: [0, -35, 0]
    }
  ]
}

export function getCleanDoorFaces() {
  return [
    {
      id: 'door-portal',
      name: 'Cổng đá vòm & cánh gỗ sồi',
      assetPath: 'assembly_3d/modular/decor_door.png',
      width: 220,
      height: 400,
      position: [0, 0, -2],
      rotation: [0, 0, 0]
    },
    // Bậc thềm đá (Step)
    {
      id: 'door-step-top',
      name: 'Mặt bậc thềm đá',
      color: '#64748b',
      width: 250,
      height: 50,
      position: [0, -200, -25],
      rotation: [-90, 0, 0]
    },
    {
      id: 'door-step-front',
      name: 'Mặt đứng thềm đá',
      color: '#334155',
      width: 250,
      height: 25,
      position: [0, -212.5, -50],
      rotation: [0, 0, 0]
    },
    // Mái ngói hiên che cửa
    {
      id: 'door-canopy-roof',
      name: 'Mái hiên ngói nghiêng',
      assetPath: 'assembly_3d/modular/roof_terracotta.png',
      width: 250,
      height: 90,
      position: [0, 218, -40.7],
      rotation: [-25, 0, 0]
    }
  ]
}

export function getCleanFlowerBoxFaces() {
  return [
    {
      id: 'planter-front',
      name: 'Thành bồn gỗ trước',
      color: '#451a03',
      width: 240,
      height: 50,
      position: [0, 0, -40],
      rotation: [0, 0, 0]
    },
    {
      id: 'planter-left',
      name: 'Hông bồn gỗ trái',
      color: '#3b1c0b',
      width: 40,
      height: 50,
      position: [-120, 0, -20],
      rotation: [0, 90, 0]
    },
    {
      id: 'planter-right',
      name: 'Hông bồn gỗ phải',
      color: '#3b1c0b',
      width: 40,
      height: 50,
      position: [120, 0, -20],
      rotation: [0, -90, 0]
    },
    {
      id: 'planter-bottom',
      name: 'Đáy bồn gỗ',
      color: '#291409',
      width: 240,
      height: 40,
      position: [0, -25, -20],
      rotation: [90, 0, 0]
    },
    {
      id: 'planter-soil',
      name: 'Đất mùn trồng hoa',
      color: '#1c1917',
      width: 235,
      height: 36,
      position: [0, 20, -20],
      rotation: [-90, 0, 0]
    },
    {
      id: 'flowers-front',
      name: 'Khóm hoa trước rủ',
      assetPath: 'assembly_3d/modular/decor_flower_box.png',
      width: 250,
      height: 95,
      position: [0, 50, -35],
      rotation: [0, 0, 0]
    },
    {
      id: 'flowers-back',
      name: 'Khóm hoa sau vươn cao',
      assetPath: 'assembly_3d/modular/decor_flower_box.png',
      width: 250,
      height: 105,
      position: [0, 58, -15],
      rotation: [0, 0, 0]
    }
  ]
}

export function getCleanSphericalBushFaces() {
  const tilt = -28
  const slantY = 110
  const slantDist = 80
  const width = 340
  const height = 260

  return [
    {
      id: 'bush-tri-front',
      name: 'Tam giác cầu lồi trước (Front Gore)',
      assetPath: 'assembly_3d/modular/nature_bush_tri_1.png',
      width,
      height,
      position: [0, slantY, slantDist],
      rotation: [tilt, 0, 0],
      bendX: 68,
      bendY: 45
    },
    {
      id: 'bush-tri-right',
      name: 'Tam giác cầu lồi phải (Right Gore)',
      assetPath: 'assembly_3d/modular/nature_bush_tri_2.png',
      width,
      height,
      position: [slantDist, slantY, 0],
      rotation: [tilt, 90, 0],
      bendX: 68,
      bendY: 45
    },
    {
      id: 'bush-tri-back',
      name: 'Tam giác cầu lồi sau (Back Gore)',
      assetPath: 'assembly_3d/modular/nature_bush_tri_1.png',
      width,
      height,
      position: [0, slantY, -slantDist],
      rotation: [tilt, 180, 0],
      bendX: 68,
      bendY: 45
    },
    {
      id: 'bush-tri-left',
      name: 'Tam giác cầu lồi trái (Left Gore)',
      assetPath: 'assembly_3d/modular/nature_bush_tri_3.png',
      width,
      height,
      position: [-slantDist, slantY, 0],
      rotation: [tilt, -90, 0],
      bendX: 68,
      bendY: 45
    }
  ]
}

async function rebuildAll() {
  console.log('🏛️ BẮT ĐẦU CẬP NHẬT TOÀN BỘ CÁC MÔ HÌNH 3D VÀ THUMBNAIL...\n')

  // 1. model-house-shell
  console.log('1️⃣ Cập nhật model-house-shell (Khung Nhà Tudor 3D)...')
  await sendCommand('save_assembly_model', {
    id: 'model-house-shell',
    name: 'Khung Nhà Mái Chữ A Tudor (Shell 3D)',
    category: 'architecture',
    description: 'Khung nhà rỗng phong cách Tudor thuần túy: tường trát vôi trắng nẹp gỗ và mái ngói đất nung kín khít không khe hở.',
    scale: 1.0,
    faces: getCleanHouseShellFaces()
  })
  await captureAndSaveThumbnail('model-house-shell', 'architecture', 'house-shell')

  // 2. model-chimney-brick
  console.log('\n2️⃣ Cập nhật model-chimney-brick (Ống Khói Gạch 3D)...')
  await sendCommand('save_assembly_model', {
    id: 'model-chimney-brick',
    name: 'Ống Khói Gạch Cổ Điển 3D',
    category: 'decor',
    description: 'Ống khói gạch nung nắp chụp gờ cổ điển, vách gạch liền mạch khít góc, cắm xuyên mái dốc công trình.',
    scale: 0.45,
    faces: getCleanChimneyFaces()
  })
  await captureAndSaveThumbnail('model-chimney-brick', 'decor', 'chimney-brick')

  // 3. model-window-tudor
  console.log('\n3️⃣ Cập nhật model-window-tudor (Cửa Sổ Tudor 3D)...')
  await sendCommand('save_assembly_model', {
    id: 'model-window-tudor',
    name: 'Cửa Sổ Tudor Khung Gỗ 3D',
    category: 'decor',
    description: 'Cửa sổ hoa văn chì cổ điển có bậu cửa đá và 2 cánh mở góc 35 độ khớp bản lề không hở.',
    scale: 0.32,
    faces: getCleanWindowFaces()
  })
  await captureAndSaveThumbnail('model-window-tudor', 'decor', 'window-tudor')

  // 4. model-door-arched
  console.log('\n4️⃣ Cập nhật model-door-arched (Cửa Vòm Cổng Đá 3D)...')
  await sendCommand('save_assembly_model', {
    id: 'model-door-arched',
    name: 'Cửa Vòm Cổng Đá 3D',
    category: 'decor',
    description: 'Cửa ra vào vòm cuốn đá khối, cánh gỗ sồi bản lề rèn thép, bậc thềm đá và mái ngói hiên khít tường.',
    scale: 0.36,
    faces: getCleanDoorFaces()
  })
  await captureAndSaveThumbnail('model-door-arched', 'decor', 'door-arched')

  // 5. model-flower-box
  console.log('\n5️⃣ Cập nhật model-flower-box (Bồn Hoa Ban Công 3D)...')
  await sendCommand('save_assembly_model', {
    id: 'model-flower-box',
    name: 'Bồn Hoa Dưới Cửa 3D',
    category: 'decor',
    description: 'Bồn hoa gỗ sồi treo dưới bậu cửa sổ, ngập tràn hoa phong lữ và dây leo trường xuân, khít tường không khe hở.',
    scale: 0.30,
    faces: getCleanFlowerBoxFaces()
  })
  await captureAndSaveThumbnail('model-flower-box', 'decor', 'flower-box')

  // 6. model-garden-bush
  console.log('\n6️⃣ Cập nhật model-garden-bush (Bụi Cây Thể Tích 3D)...')
  await sendCommand('save_assembly_model', {
    id: 'model-garden-bush',
    name: 'Bụi Cây Hoa Sân Vườn 3D',
    category: 'nature',
    description: 'Bụi cây xanh xum xuê ghép từ 4 tam giác cầu lồi khít cạnh tạo hình quả bóng 3D tròn đầy tự nhiên nhìn được mọi góc độ.',
    scale: 0.35,
    faces: getCleanSphericalBushFaces()
  })
  await captureAndSaveThumbnail('model-garden-bush', 'nature', 'garden-bush')

  // 7. model-tudor-estate (Master Composite)
  console.log('\n7️⃣ Lắp ráp lại Biệt Thự Tudor Đầy Đủ (model-tudor-estate)...')
  await sendCommand('save_assembly_model', {
    id: 'model-tudor-estate',
    name: 'Biệt Thự Tudor 3D Lắp Ráp Hoàn Chỉnh',
    category: 'architecture',
    description: 'Biệt thự Tudor cao cấp ghép nối modular 3D hoàn chỉnh chuẩn tỉ lệ kiến trúc: Cửa vòm đá tỉ lệ người thật, 2 cửa sổ đối xứng có bồn hoa ban công, cửa sổ gác mái, ống khói gạch thanh mảnh thẳng đứng và bụi cây cảnh sân vườn thể tích.',
    scale: 1.0,
    faces: getCleanHouseShellFaces()
  })

  // Door
  console.log('   ↳ Gắn Cửa Vòm Cổng Đá...')
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-door-arched',
    face_id: 'face-front',
    uv: [0.5, 0.1091],
    prefix_names: false
  })

  // Windows & Flower boxes (Front)
  console.log('   ↳ Gắn Cửa Sổ & Bồn Hoa Tầng 2 Trái...')
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-window-tudor',
    face_id: 'face-front',
    uv: [0.25, 0.45],
    prefix_names: false
  })
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-flower-box',
    face_id: 'face-front',
    uv: [0.25, 0.364],
    prefix_names: false
  })

  console.log('   ↳ Gắn Cửa Sổ & Bồn Hoa Tầng 2 Phải...')
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-window-tudor',
    face_id: 'face-front',
    uv: [0.75, 0.45],
    prefix_names: false
  })
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-flower-box',
    face_id: 'face-front',
    uv: [0.75, 0.364],
    prefix_names: false
  })

  console.log('   ↳ Gắn Cửa Sổ & Bồn Hoa Gác Mái...')
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-window-tudor',
    face_id: 'face-front',
    uv: [0.5, 0.697],
    prefix_names: false
  })
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-flower-box',
    face_id: 'face-front',
    uv: [0.5, 0.62],
    scale: 0.90,
    prefix_names: false
  })

  // Side Windows
  console.log('   ↳ Gắn 2 Cửa Sổ Vách Trái & 2 Cửa Sổ Vách Phải...')
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-window-tudor',
    face_id: 'face-left',
    uv: [0.32, 0.52],
    prefix_names: false
  })
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-window-tudor',
    face_id: 'face-left',
    uv: [0.68, 0.52],
    prefix_names: false
  })
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-window-tudor',
    face_id: 'face-right',
    uv: [0.32, 0.52],
    prefix_names: false
  })
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-window-tudor',
    face_id: 'face-right',
    uv: [0.68, 0.52],
    prefix_names: false
  })

  // Chimney
  console.log('   ↳ Ghép Ống Khói cắm thẳng đứng qua mái...')
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-chimney-brick',
    at: [140, 390, 380],
    prefix_names: false
  })

  // Bushes: Plump 3D spherical bushes!
  console.log('   ↳ Ghép các Bụi Cây Thể Tích 3D góc móng và lối đi...')
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-garden-bush',
    at: [290, -155, 35],
    prefix_names: false
  })
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-garden-bush',
    at: [-290, -155, 35],
    prefix_names: false
  })
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-garden-bush',
    at: [-125, -169, 50],
    scale: 0.70,
    prefix_names: false
  })
  await sendCommand('append_assembly_model', {
    model_id: 'model-tudor-estate',
    source_model_id: 'model-garden-bush',
    at: [125, -169, 50],
    scale: 0.70,
    prefix_names: false
  })

  // Intersection Clipping
  console.log('   ↳ Thiết lập cắt giao chính xác (clipBy)...')
  const estate = await sendCommand('get_model3d', { id: 'model-tudor-estate' })
  const cleanFaces = estate.model.faces.map((f) => {
    // Tường nhà và mái luôn nguyên vẹn 100%
    if (['face-front', 'face-back', 'face-left', 'face-right', 'face-roof-left', 'face-roof-right'].includes(f.id)) {
      const copy = { ...f }
      delete copy.clipBy
      return copy
    }
    // Vách ống khói cắm qua mái dốc phải: cắt bỏ phần đáy chìm dưới mái
    if (f.name && f.name.includes('Vách ống khói')) {
      return { ...f, clipBy: ['face-roof-right'] }
    }
    const copy = { ...f }
    delete copy.clipBy
    return copy
  })

  await sendCommand('save_assembly_model', {
    ...estate.model,
    faces: cleanFaces
  })

  // Ánh sáng và bóng râm
  console.log('   ↳ Cấu hình ánh sáng tự nhiên và đổ bóng...')
  await sendCommand('set_assembly_lighting', {
    model_id: 'model-tudor-estate',
    preset: 'morning',
    sun: true,
    shadows: true,
    azimuth: 45,
    elevation: 35,
    intensity: 1.2
  })

  // Chụp thumbnail cho tudor estate
  await captureAndSaveThumbnail('model-tudor-estate', 'architecture', 'tudor-estate')

  console.log('\n✨ ĐÃ HOÀN TẤT CẬP NHẬT TOÀN BỘ 7 MÔ HÌNH VÀ THUMBNAIL SẠCH!')
}

rebuildAll().catch((err) => {
  console.error('❌ Lỗi:', err)
  process.exit(1)
})
