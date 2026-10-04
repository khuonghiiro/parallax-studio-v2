// Debug helper: reproduce save → open and capture renderer console + GPU process logs.
import { _electron as electron } from 'playwright-core'
import electronPath from 'electron'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const root = resolve(import.meta.dirname, '..')
const shot = process.argv[2] ?? join(root, 'out', 'debug-open.png')
const t0 = Date.now()
const logs = []
const log = (s) => logs.push(`${((Date.now() - t0) / 1000).toFixed(2)}s ${s}`)

const app = await electron.launch({ executablePath: electronPath, args: [root], cwd: root })
app.process().stderr.on('data', (d) => log(`[main-stderr] ${String(d).trim().slice(0, 200)}`))
try {
  const page = await app.firstWindow()
  page.on('console', (m) => log(`[${m.type()}] ${m.text().slice(0, 200)}`))
  await page.waitForSelector('.loading-screen', { state: 'detached', timeout: 30000 })
  log('demo loaded')
  await page.waitForTimeout(1000)
  const projPath = join(tmpdir(), `pxs-debug-${Date.now()}.pxs`)
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  }, projPath)
  log('save')
  await page.keyboard.press('Control+s')
  await page.waitForSelector('text=Đã lưu dự án')
  await page.waitForTimeout(1000)
  log('open')
  await page.keyboard.press('Control+o')
  await page.waitForSelector('text=Đã mở dự án')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: shot })
  log('done')
} finally {
  await app.close()
  console.log(logs.join('\n'))
}
