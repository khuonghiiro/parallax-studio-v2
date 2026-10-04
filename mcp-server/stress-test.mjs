/**
 * Memory stress test: 30 shots × 6 unique 4K layers (180 images ≈ 6 GB if all were
 * decoded at once), built through MCP, then the camera tours every shot while we
 * sample texture residency and process RAM — including during a full export.
 *
 * Usage (from repo root): npm run build && node mcp-server/stress-test.mjs [outDir]
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { _electron as electron } from 'playwright-core'
import electronPath from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const here = import.meta.dirname
const root = resolve(here, '..')
const outDir = resolve(process.argv[2] ?? join(root, 'out', 'mcp-stress'))
mkdirSync(outDir, { recursive: true })
const SHOTS = Number(process.env.SHOTS ?? 30)
const PER_SHOT = 6

const app = await electron.launch({ executablePath: electronPath, args: [root], cwd: root })
const page = await app.firstWindow()
await page.waitForSelector('.loading-screen', { state: 'detached', timeout: 60000 })
await page.waitForSelector('#mcp-chip.listening, #mcp-chip.connected', { timeout: 15000 })

const client = new Client({ name: 'parallax-stress', version: '1.0.0' })
await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(here, 'index.mjs')], stderr: 'ignore' }))
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 60 * 60 * 1000 })
  const t = r.content.find((c) => c.type === 'text')?.text ?? ''
  if (r.isError) throw new Error(`${name}: ${t}`)
  try {
    return JSON.parse(t)
  } catch {
    return r
  }
}
const mem = async () => {
  const m = await call('get_memory_stats')
  const gpu = m.processes.find((p) => p.type === 'GPU')?.workingSetMB
  const renderer = m.processes.find((p) => p.type === 'Tab')?.workingSetMB
  return { textureMB: m.renderer?.textureMB, textures: m.renderer?.textures, visibleShots: m.renderer?.visibleShots, totalShots: m.renderer?.totalShots, totalMB: m.totalWorkingSetMB, gpuMB: gpu, rendererMB: renderer }
}

const result = { shots: SHOTS, layers: SHOTS * PER_SHOT, naiveDecodedGB: +((SHOTS * PER_SHOT * 3840 * 2160 * 4) / 1e9).toFixed(2) }
try {
  await call('new_project', { name: 'Stress', duration: 10 })
  result.baseline = await mem()

  const t0 = Date.now()
  const built = await call('execute_script', {
    code: `
      const depths = [3200, 2200, 1400, 800, 300, -200]
      const SHOTS = ${SHOTS}, PER = ${PER_SHOT}
      for (let s = 0; s < SHOTS; s++) {
        const shot = await api.run('add_shot', { name: 'Stress ' + (s + 1) })
        for (let k = 0; k < PER; k++) {
          const c = document.createElement('canvas'); c.width = 3840; c.height = 2160
          const g = c.getContext('2d')
          const hue = (s * 37 + k * 23) % 360
          if (k === 0) {
            const gr = g.createLinearGradient(0, 0, 0, 2160)
            gr.addColorStop(0, 'hsl(' + hue + ',60%,18%)'); gr.addColorStop(1, 'hsl(' + ((hue + 50) % 360) + ',70%,60%)')
            g.fillStyle = gr; g.fillRect(0, 0, 3840, 2160)
          } else {
            const base = 2160 * (0.45 + k * 0.08)
            g.fillStyle = 'hsl(' + hue + ',45%,' + (40 - k * 5) + '%)'
            g.beginPath(); g.moveTo(0, 2160)
            for (let x = 0; x <= 3840; x += 32) g.lineTo(x, base - 160 * Math.sin(x / (300 + k * 90) + s) - 80 * Math.sin(x / 97 + k))
            g.lineTo(3840, 2160); g.closePath(); g.fill()
            g.font = 'bold 220px sans-serif'; g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillText(s + 1 + '.' + k, 200 + k * 500, base - 260)
          }
          const blob = await new Promise((r) => c.toBlob(r, k === 0 ? 'image/jpeg' : 'image/webp', 0.85))
          const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
          await api.run('add_image_layer', { image_base64: url, file_name: 's' + s + '_' + k + (k === 0 ? '.jpg' : '.webp'), shot_id: shot.id, z: depths[k], fit: 'cover', name: 'L' + k })
        }
      }
      return { shots: api.project.shots.length, layers: api.project.layers.length, assets: api.project.assets.length }
    `
  })
  result.build = { ...built.result, secs: (Date.now() - t0) / 1000 }
  result.afterBuild = await mem()

  const info = await call('get_project_info')
  const steps = info.shots.map((s) => ({ shot_id: s.id, hold: 0.6, transition: 'fly', transition_duration: 0.6 }))
  const path = await call('build_camera_path', { steps, push_in: 0.1 })
  result.tourSeconds = path.end

  // Scrub through the tour like a user would.
  const samples = []
  for (let i = 0; i < SHOTS; i += 3) {
    await call('set_time', { time: i * 1.2 + 0.3 })
    await page.waitForTimeout(700)
    samples.push({ t: i * 1.2 + 0.3, ...(await mem()) })
  }
  result.scrub = {
    maxTextureMB: Math.max(...samples.map((s) => s.textureMB)),
    maxVisibleShots: Math.max(...samples.map((s) => s.visibleShots)),
    maxTotalMB: Math.max(...samples.map((s) => s.totalMB)),
    maxGpuMB: Math.max(...samples.map((s) => s.gpuMB ?? 0)),
    samples: samples.slice(0, 4)
  }
  await page.screenshot({ path: join(outDir, 'stress_app.png') })
  const shot3d = await client.callTool({ name: 'get_viewport_screenshot', arguments: { view: '3d', width: 1600, time: 5 } })
  const img = shot3d.content.find((c) => c.type === 'image')
  if (img) writeFileSync(join(outDir, 'stress_3d.png'), Buffer.from(img.data, 'base64'))

  // Full export while sampling memory.
  const mp4 = join(tmpdir(), `pxs-stress-${Date.now()}.mp4`)
  const exportSamples = []
  let done = false
  const sampler = (async () => {
    while (!done) {
      await new Promise((r) => setTimeout(r, 1500))
      if (!done) exportSamples.push(await mem().catch(() => null))
    }
  })()
  const te = Date.now()
  const exp = await call('export_video', { out_path: mp4, height: 540, preset: 'veryfast' })
  done = true
  await sampler
  const ok = exportSamples.filter(Boolean)
  result.export = {
    ok: exp.ok,
    frames: exp.frames,
    secs: (Date.now() - te) / 1000,
    maxTotalMB: Math.max(...ok.map((s) => s.totalMB)),
    maxGpuMB: Math.max(...ok.map((s) => s.gpuMB ?? 0)),
    maxRendererMB: Math.max(...ok.map((s) => s.rendererMB ?? 0)),
    samples: ok.length
  }
  result.end = await mem()
} catch (err) {
  result.error = String(err?.stack ?? err)
} finally {
  await client.close().catch(() => undefined)
  await app.close().catch(() => undefined)
  console.log(JSON.stringify(result, null, 2))
}
