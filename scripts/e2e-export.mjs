/**
 * End-to-end smoke test: launches the built Electron app, checks the demo scene renders,
 * selects a layer by clicking the viewer, then exports a 720p MP4 and validates it.
 *
 * Usage: npm run build && node scripts/e2e-export.mjs [screenshotDir]
 */
import { _electron as electron } from 'playwright-core'
import electronPath from 'electron'
import ffmpegPath from 'ffmpeg-static'
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const root = resolve(import.meta.dirname, '..')
const shotDir = resolve(process.argv[2] ?? join(root, 'out', 'e2e'))
mkdirSync(shotDir, { recursive: true })
const outPath = join(tmpdir(), `pxs-e2e-${Date.now()}.mp4`)

const app = await electron.launch({ executablePath: electronPath, args: [root], cwd: root })
const logs = []
try {
  const page = await app.firstWindow()
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
  await page.setViewportSize({ width: 1600, height: 960 }).catch(() => undefined)
  await page.waitForSelector('#viewer-canvas')
  await page.waitForSelector('.loading-screen', { state: 'detached', timeout: 30000 })
  await page.waitForTimeout(800)
  logs.push('--- phase: demo loaded')
  await page.screenshot({ path: join(shotDir, 'e2e_t0.png') })

  // Jump to ~2.7s (80 frames at 30fps) using Shift+→ (10 frames each): shot 1 title fully in.
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowRight')
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(shotDir, 'e2e_t5.png') })

  // Click the title area inside the camera frame and read the selected layer name.
  const box = await page.locator('#camera-frame').boundingBox()
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.335)
  await page.waitForTimeout(300)
  const selected = await page.locator('#layer-name').inputValue().catch(() => '(none)')

  // 3D orbit view (all shots + camera path) and split view.
  await page.click('#view-3d')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(shotDir, 'e2e_3d.png') })
  await page.click('#view-split')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(shotDir, 'e2e_split.png') })
  await page.click('#view-split')
  await page.click('#view-camera')
  await page.waitForTimeout(300)
  // Later in the tour: shot 2 (Twilight Valley), shot 3 (Northern Lights), shot 4 (Golden Dunes).
  for (const [name, t] of [['e2e_shot2', 8], ['e2e_shot3', 13], ['e2e_shot4', 17.5]]) {
    await page.evaluate(() => undefined)
    await page.keyboard.press('Home')
    for (let i = 0; i < Math.round((t * 30) / 10); i++) await page.keyboard.press('Shift+ArrowRight')
    await page.waitForTimeout(900)
    await page.screenshot({ path: join(shotDir, `${name}.png`) })
  }
  const memory = await page.locator('#memory-chip').innerText().catch(() => '')

  // Stub native dialogs in the main process (path chosen by requested extension).
  const projPath = join(tmpdir(), `pxs-e2e-${Date.now()}.pxs`)
  await app.evaluate(({ dialog }, paths) => {
    dialog.showSaveDialog = async (_w, opts) => ({
      canceled: false,
      filePath: (opts ?? _w)?.filters?.[0]?.extensions?.[0] === 'pxs' ? paths.proj : paths.mp4
    })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.proj] })
  }, { proj: projPath, mp4: outPath })

  // Save → reopen round-trip.
  const layerRows = async () => page.locator('.tl-row:not(.sub)').count()
  const rowsBefore = await layerRows()
  logs.push('--- phase: save')
  await page.keyboard.press('Control+s')
  await page.waitForSelector('text=Đã lưu dự án')
  logs.push('--- phase: open')
  await page.keyboard.press('Control+o')
  await page.waitForSelector('text=Đã mở dự án')
  await page.waitForTimeout(500)
  const rowsAfter = await layerRows()
  const projKB = existsSync(projPath) ? Math.round(statSync(projPath).size / 1024) : 0

  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+m')
  await page.waitForSelector('#export-start')
  await page.selectOption('#export-res', '720')
  await page.selectOption('#export-speed', 'veryfast')
  const t0 = Date.now()
  logs.push('--- phase: export')
  await page.click('#export-start')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(shotDir, 'e2e_exporting.png') })
  await page.waitForSelector('text=Đã xuất xong', { timeout: 240000 })
  const exportSecs = (Date.now() - t0) / 1000
  await page.screenshot({ path: join(shotDir, 'e2e_done.png') })

  const probe = spawnSync(ffmpegPath, ['-hide_banner', '-i', outPath], { encoding: 'utf8' }).stderr
  const result = {
    selectedByClick: selected,
    memory,
    roundTrip: { rowsBefore, rowsAfter, projKB },
    outPath,
    exists: existsSync(outPath),
    sizeKB: existsSync(outPath) ? Math.round(statSync(outPath).size / 1024) : 0,
    exportSecs,
    stream: (probe.match(/Stream #0:0.*$/m) ?? [''])[0],
    duration: (probe.match(/Duration: [^,]+/) ?? [''])[0],
    errors: logs.filter((l) => l.startsWith('---') || /error|warn/i.test(l)).map((l) => l.slice(0, 160))
  }
  console.log(JSON.stringify(result, null, 2))
} finally {
  await app.close()
}
