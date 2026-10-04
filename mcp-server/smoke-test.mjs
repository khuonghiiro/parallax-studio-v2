/**
 * MCP integration test: launches the built app, then drives it through the real stdio
 * MCP server with the official SDK client — exactly what an AI client does.
 *
 * Usage (from repo root): npm run build && node mcp-server/smoke-test.mjs [outDir]
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { _electron as electron } from 'playwright-core'
import electronPath from 'electron'
import ffmpegPath from 'ffmpeg-static'
import { spawnSync } from 'node:child_process'
import { createConnection } from 'node:net'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const here = import.meta.dirname
const root = resolve(here, '..')
const outDir = resolve(process.argv[2] ?? join(root, 'out', 'mcp-smoke'))
mkdirSync(outDir, { recursive: true })
const stamp = Date.now()

const report = { steps: [], errors: [] }
const step = (name, data) => {
  report.steps.push({ name, ...data })
  console.error(`✓ ${name}`)
}

const app = await electron.launch({ executablePath: electronPath, args: [root], cwd: root })
const page = await app.firstWindow()
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.waitForSelector('.loading-screen', { state: 'detached', timeout: 60000 })
await page.waitForSelector('#mcp-chip.listening, #mcp-chip.connected', { timeout: 15000 })

const client = new Client({ name: 'parallax-smoke', version: '1.0.0' })
const transport = new StdioClientTransport({ command: process.execPath, args: [join(here, 'index.mjs')], stderr: 'inherit' })

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args })
  const textPart = r.content.find((c) => c.type === 'text')?.text ?? ''
  if (r.isError) throw new Error(`${name}: ${textPart}`)
  let json = null
  try {
    json = JSON.parse(textPart)
  } catch {
    /* not json (screenshots) */
  }
  return { raw: r, json, text: textPart }
}

const saveImage = (r, file) => {
  const img = r.raw.content.find((c) => c.type === 'image')
  writeFileSync(join(outDir, file), Buffer.from(img.data, 'base64'))
  return join(outDir, file)
}

try {
  await client.connect(transport)
  const tools = await client.listTools()
  step('list_tools', { count: tools.tools.length })

  const info = (await call('get_project_info')).json
  step('get_project_info', { shots: info.shots.map((s) => s.name), layers: info.layers.length, duration: info.composition.duration })

  const mem0 = (await call('get_memory_stats')).json
  step('get_memory_stats', { renderer: mem0.renderer, totalWorkingSetMB: mem0.totalWorkingSetMB })

  // Build a 4th shot entirely through MCP.
  const shot = (await call('add_shot', { name: 'AI Ocean', direction: 'right', color: '#60a5fa' })).json
  await call('add_solid_layer', { shot_id: shot.id, name: 'Ocean sky', color: '#06122b', color2: '#2f7bd6', gradient: true, z: 2600, width: 6000, height: 3600 })

  // Use a rendered frame of shot 1 as an "image file" to test file_path loading.
  const cam1 = await call('get_viewport_screenshot', { view: 'camera', time: 2.5, width: 1280 })
  const pngPath = saveImage(cam1, 'mcp_camera_t2_5.png')
  const img = (await call('add_image_layer', { shot_id: shot.id, file_path: pngPath, name: 'Postcard', z: 900, scale: 0.45, rotation: [0, 0, -4] })).json
  const title = (await call('add_text_layer', { shot_id: shot.id, text: 'MADE BY AI', font_size: 110, font_weight: 800, z: 400, position: [0, 260, 400] })).json
  await call('add_particles', { shot_id: shot.id, name: 'Bubbles', color: '#9fd8ff', velocity: [0, 30, 0], count: 300 })
  await call('set_keyframe', { target: 'layer', id: title.id, property: 'opacity', time: 0, value: 0 })
  step('build_shot', { shot: shot.id, image: img.id, imageSize: img.size, title: title.id })

  const all = (await call('get_project_info')).json
  const ids = all.shots.map((s) => s.id)
  const path = (
    await call('build_camera_path', {
      steps: [
        { shot_id: ids[0], hold: 2, transition: 'arc', transition_duration: 2 },
        { shot_id: ids[1], hold: 2, transition: 'fade', transition_duration: 1 },
        { shot_id: ids[2], hold: 2, transition: 'fly', transition_duration: 2 },
        { shot_id: ids[3], hold: 2.5 }
      ],
      push_in: 0.12
    })
  ).json
  step('build_camera_path', path)
  const arrive4 = path.end - 2.5
  await call('set_keyframe', { target: 'layer', id: title.id, property: 'opacity', time: arrive4, value: 0 })
  await call('set_keyframe', { target: 'layer', id: title.id, property: 'opacity', time: arrive4 + 1.2, value: 1, ease: 'easeOut' })

  const shotCam = await call('get_viewport_screenshot', { view: 'camera', time: path.end - 0.3, width: 1280 })
  saveImage(shotCam, 'mcp_camera_ai_shot.png')
  const over = await call('get_viewport_screenshot', { view: '3d', time: 3, width: 1600 })
  saveImage(over, 'mcp_3d_overview.png')
  const close = await call('get_viewport_screenshot', { view: '3d', shot_id: ids[3], yaw: -25, pitch: 15, width: 1280 })
  saveImage(close, 'mcp_3d_ai_shot.png')
  step('screenshots', { camera: shotCam.text.split('\n').pop(), overview: over.text.split('\n').pop() })

  // Show the user what happened in the app itself.
  await call('set_view', { mode: 'split', focus: 'all' })
  await call('set_time', { time: path.end - 0.5 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(outDir, 'mcp_app_split.png') })
  await call('set_view', { mode: 'camera' })

  const script = (await call('execute_script', { code: "log('hello'); const s = await api.run('get_camera_info', { time: 1 }); return { shots: api.project.shots.map(s => s.name), lookingAt: s.looking_at_shot }" })).json
  step('execute_script', script)

  const layersBefore = (await call('get_project_info')).json.layers.length
  await call('delete_layer', { layer_id: img.id })
  await call('undo')
  const layersAfter = (await call('get_project_info')).json.layers.length
  step('undo', { layersBefore, layersAfter })

  let errorOk = false
  try {
    await call('get_shot_info', { shot_id: 'nope' })
  } catch (e) {
    errorOk = /not found/.test(String(e))
  }
  step('error_handling', { errorOk })

  // Raw socket with a wrong token must be refused.
  const cfg = JSON.parse(readFileSync(join(process.env.APPDATA, 'parallax-studio', 'mcp.json'), 'utf8'))
  const refused = await new Promise((res) => {
    const s = createConnection({ host: '127.0.0.1', port: cfg.port })
    s.setEncoding('utf8')
    s.on('connect', () => s.write(JSON.stringify({ id: 1, token: 'wrong', method: 'get_project_info' }) + '\n'))
    s.on('data', (d) => {
      res(JSON.parse(d).error)
      s.destroy()
    })
    s.on('error', (e) => res(String(e)))
  })
  step('auth', { refused })

  const proj = join(tmpdir(), `pxs-mcp-${stamp}.pxs`)
  const saved = (await call('save_project', { path: proj })).json
  const reopened = (await call('open_project', { file_path: proj })).json
  step('save_open', { saved, reopened })

  const mp4 = join(tmpdir(), `pxs-mcp-${stamp}.mp4`)
  const t0 = Date.now()
  const exp = (await call('export_video', { out_path: mp4, height: 480, preset: 'veryfast' })).json
  const probe = spawnSync(ffmpegPath, ['-hide_banner', '-i', mp4], { encoding: 'utf8' }).stderr
  step('export_video', {
    ok: exp.ok,
    frames: exp.frames,
    secs: (Date.now() - t0) / 1000,
    sizeKB: existsSync(mp4) ? Math.round(statSync(mp4).size / 1024) : 0,
    stream: (probe.match(/Stream #0:0.*$/m) ?? [''])[0].trim(),
    duration: (probe.match(/Duration: [^,]+/) ?? [''])[0]
  })
  // Frames from the exported video: one per shot.
  for (const [i, t] of [1, 5, 8.5, path.end - 0.4].entries()) {
    spawnSync(ffmpegPath, ['-y', '-loglevel', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', join(outDir, `mcp_video_${i}.png`)])
  }

  const mem1 = (await call('get_memory_stats')).json
  step('memory_after', { renderer: mem1.renderer, totalWorkingSetMB: mem1.totalWorkingSetMB })
} catch (err) {
  report.errors.push(String(err?.stack ?? err))
} finally {
  report.pageErrors = logs.filter((l) => /pageerror|\[error\]/i.test(l)).slice(0, 20)
  await client.close().catch(() => undefined)
  await app.close().catch(() => undefined)
  console.log(JSON.stringify(report, null, 2))
}
