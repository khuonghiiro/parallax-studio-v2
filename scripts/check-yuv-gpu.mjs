// Chạy trên app Electron đang mở; không sửa project và không tạo tiến trình Electron khác.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const outputDir = mkdtempSync(join(tmpdir(), 'pxs-yuv-')).replaceAll('\\', '/')
const code = readFileSync(new URL('./yuv-gpu-probe.js', import.meta.url), 'utf8')
  + readFileSync(new URL('./export-lifecycle-probe.js', import.meta.url), 'utf8')
  + '\nreturn { gpu: await runYuvGpuProbe(api), lifecycle: await runExportLifecycleProbe(api, '
  + JSON.stringify(outputDir) + ') }'
const payloadPath = join(outputDir, 'probe.json')
writeFileSync(payloadPath, JSON.stringify({ code }))
const result = execFileSync(process.execPath, ['mcp-server/cli.mjs', 'call', 'execute_script', '@' + payloadPath], {
  encoding: 'utf8', timeout: 120000, env: { ...process.env, PXS_TIMEOUT_MS: '110000' }, windowsHide: true
})
process.stdout.write(result)
if (!result.includes('"passed": true')) process.exitCode = 1
