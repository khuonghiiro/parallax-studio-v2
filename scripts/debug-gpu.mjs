// Debug helper: find which shader program link crashes the GPU process.
import { _electron as electron } from 'playwright-core'
import electronPath from 'electron'
import { resolve } from 'path'

const root = resolve(import.meta.dirname, '..')
const t0 = Date.now()
const logs = []
const log = (s) => logs.push(`${((Date.now() - t0) / 1000).toFixed(2)}s ${s}`)
const extraArgs = process.argv.slice(2)

const app = await electron.launch({ executablePath: electronPath, args: [...extraArgs, root], cwd: root })
app.process().stderr.on('data', (d) => log(`[main-stderr] ${String(d).trim().slice(0, 160)}`))
try {
  const page = await app.firstWindow()
  page.on('console', (m) => log(`[${m.type()}] ${m.text().slice(0, 400)}`))
  await page.addInitScript(() => {
    let n = 0
    const proto = WebGL2RenderingContext.prototype
    const origLink = proto.linkProgram
    proto.linkProgram = function (program) {
      const shaders = this.getAttachedShaders(program) || []
      const srcs = shaders.map((s) => this.getShaderSource(s) || '')
      const frag = srcs.find((s) => s.includes('gl_FragColor') || s.includes('pc_fragColor')) || srcs[1] || ''
      const tag = (frag.match(/uniform\s+\w+\s+(\w+);/g) || []).slice(0, 4).join(' ')
      console.log(`[link #${++n}] ${tag}`)
      return origLink.call(this, program)
    }
    const info = (gl) => {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a'
    }
    setTimeout(() => {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2')
      console.log(`[gpu] ${gl ? info(gl) : 'no webgl2'}`)
    }, 0)
  })
  await page.reload()
  await page.waitForTimeout(4000)
} finally {
  await app.close()
  console.log(logs.join('\n'))
}
