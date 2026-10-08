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

async function run() {
  console.log('1. Mở Xưởng Lắp Ráp 3D cho model-tudor-estate...')
  await sendCommand('open_assembly_workshop', { model_id: 'model-tudor-estate' })
  await new Promise((r) => setTimeout(r, 2000))

  console.log('2. Chụp ảnh góc Isometric...')
  const isoRes = await sendCommand('get_assembly_screenshot', { preset: 'iso', auto_fit: true, transparent: true })
  if (isoRes?.data) {
    const buf = Buffer.from(isoRes.data, 'base64')
    writeFileSync('D:/_tmp/estate_iso.png', buf)
    writeFileSync('asset-3ds/architecture/tudor-estate/thumbnail.png', buf)
    console.log('   ✓ Đã lưu D:/_tmp/estate_iso.png và thumbnail.png')
  }

  console.log('3. Chụp ảnh góc Front...')
  const frontRes = await sendCommand('get_assembly_screenshot', { preset: 'front', auto_fit: true, transparent: true })
  if (frontRes?.data) {
    writeFileSync('D:/_tmp/estate_front.png', Buffer.from(frontRes.data, 'base64'))
    console.log('   ✓ Đã lưu D:/_tmp/estate_front.png')
  }

  console.log('4. Đóng Xưởng Lắp Ráp 3D và lưu thumbnail chuẩn...')
  await sendCommand('close_assembly_workshop', { save: true })
  console.log('✓ Hoàn tất!')
}

run().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
