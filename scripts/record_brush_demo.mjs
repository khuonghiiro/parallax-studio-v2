import { createConnection } from 'node:net'
import { readConfigFile } from '../mcp-server/catalog/index.mjs'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import ffmpegStatic from 'ffmpeg-static'

const ffmpegBin = ffmpegStatic || 'ffmpeg'
const artifactDir = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\8b4c91ec-c380-478e-ba73-94fdf4776785'
const tmpDir = 'D:\\_tmp\\brush_demo'

if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true })
}

class DirectBridge {
  sock = null
  buf = ''
  seq = 0
  pending = new Map()

  async connect() {
    const cfg = readConfigFile()
    const port = 9877
    const token = cfg.token
    this.token = token
    return new Promise((res, rej) => {
      const s = createConnection({ host: '127.0.0.1', port })
      s.setEncoding('utf8')
      s.once('connect', () => {
        this.sock = s
        res()
      })
      s.once('error', (err) => rej(err))
      s.on('data', (chunk) => {
        this.buf += chunk
        let nl
        while ((nl = this.buf.indexOf('\n')) >= 0) {
          const line = this.buf.slice(0, nl)
          this.buf = this.buf.slice(nl + 1)
          if (!line.trim()) continue
          const msg = JSON.parse(line)
          const p = this.pending.get(msg.id)
          if (!p) continue
          this.pending.delete(msg.id)
          if (msg.ok) p.resolve(msg.result)
          else p.reject(new Error(msg.error || 'Failed'))
        }
      })
    })
  }

  async call(method, params = {}) {
    if (!this.sock) await this.connect()
    const id = ++this.seq
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej })
      this.sock.write(JSON.stringify({ id, token: this.token, method, params }) + '\n')
    })
  }

  close() {
    if (this.sock) this.sock.destroy()
  }
}

async function run() {
  const bridge = new DirectBridge()
  await bridge.connect()

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  console.log('1. Chụp frame 01: Nhân vật ban đầu...')
  await bridge.call('get_app_screenshot', { out_path: `${tmpDir}\\frame_01.png` })

  console.log('2. Mở bảng điều khiển cọ...')
  await bridge.call('ui_click', { selector: '.layer-workshop-split-pane.left-pane .layer-3d-dock-btn:nth-child(2)' })
  await sleep(400)
  await bridge.call('get_app_screenshot', { out_path: `${tmpDir}\\frame_02.png` })

  console.log('3. Đóng bảng cọ và sẵn sàng vẽ trên canvas...')
  await bridge.call('ui_click', { selector: '.layer-brush-popover button.btn.sm.primary' })
  await sleep(300)
  await bridge.call('get_app_screenshot', { out_path: `${tmpDir}\\frame_03.png` })

  console.log('4. Quẹt cọ mượt mà nét 1 (tạo độ mờ xuyên thấu trên Đùi trái)...')
  const stroke1 = `
    const vp = document.querySelector('.layer-workshop-viewport');
    if (!vp) return 'no vp';
    const x = 487, y = 575;
    vp.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, button: 0, buttons: 1, pointerId: 1 }));
    vp.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x - 3, clientY: y + 6, button: 0, buttons: 1, pointerId: 1 }));
    vp.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x - 6, clientY: y + 12, button: 0, buttons: 1, pointerId: 1 }));
    vp.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x - 6, clientY: y + 12, button: 0, buttons: 0, pointerId: 1 }));
    return 'ok';
  `
  await bridge.call('execute_script', { code: stroke1 })
  await sleep(300)
  await bridge.call('get_app_screenshot', { out_path: `${tmpDir}\\frame_04.png` })

  console.log('5. Quẹt cọ mượt mà nét 2...')
  const stroke2 = `
    const vp = document.querySelector('.layer-workshop-viewport');
    if (!vp) return 'no vp';
    const x = 482, y = 590;
    vp.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, button: 0, buttons: 1, pointerId: 1 }));
    vp.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 4, clientY: y + 5, button: 0, buttons: 1, pointerId: 1 }));
    vp.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 8, clientY: y + 10, button: 0, buttons: 1, pointerId: 1 }));
    vp.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x + 8, clientY: y + 10, button: 0, buttons: 0, pointerId: 1 }));
    return 'ok';
  `
  await bridge.call('execute_script', { code: stroke2 })
  await sleep(300)
  await bridge.call('get_app_screenshot', { out_path: `${tmpDir}\\frame_05.png` })

  console.log('6. Hoàn tất chuỗi frame, đóng bridge...')
  bridge.close()

  const outputMp4 = path.join(tmpDir, 'layer_brush_erase_demo.mp4')
  const targetArtifact = path.join(artifactDir, 'layer_brush_erase_demo.mp4')
  const outputGif = path.join(tmpDir, 'layer_brush_erase_demo.gif')
  const targetGif = path.join(artifactDir, 'layer_brush_erase_demo.gif')

  console.log('7. Xuất video MP4 & GIF...')
  execSync(`"${ffmpegBin}" -y -framerate 1.5 -i ${tmpDir}\\frame_%02d.png -vf "scale=1280:-2" -c:v libx264 -pix_fmt yuv420p "${outputMp4}"`, { stdio: 'inherit' })
  execSync(`"${ffmpegBin}" -y -framerate 1.5 -i ${tmpDir}\\frame_%02d.png -vf "scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${outputGif}"`, { stdio: 'inherit' })

  fs.copyFileSync(outputMp4, targetArtifact)
  fs.copyFileSync(outputGif, targetGif)
  console.log('✓ Hoàn tất! Video lưu tại:', targetArtifact)
  console.log('✓ GIF lưu tại:', targetGif)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
