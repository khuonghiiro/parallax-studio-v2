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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const ids = [
    'model-house-shell',
    'model-door-arched',
    'model-window-tudor',
    'model-flower-box',
    'model-chimney-brick',
    'model-garden-bush'
  ]

  for (const id of ids) {
    console.log(`📸 Chụp thumbnail 3D sạch cho ${id}...`)
    await sendCommand('open_assembly_workshop', { model_id: id })
    await sleep(400)
    await sendCommand('close_assembly_workshop', { save: true })
    await sleep(200)
  }
  console.log('✓ Đã sinh đầy đủ thumbnail 3D sạch cho tất cả các mô hình!')
}

main().catch(console.error)
