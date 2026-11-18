/**
 * Đóng gói Dự án Mẫu 3 ("Hàn Bối Tháp — Đại Chiến Linh Thú 2.5D"):
 * Gọi `buildHanbetaWorkflowV2Project()` qua esbuild bundle tạm và xuất `projects/demo-3-han-boi-thap-quai-dam.json`
 * với tham chiếu đường dẫn ảnh tương đối (không nhúng base64).
 */
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT_PROJ = resolve('projects/demo-3-han-boi-thap-quai-dam.json')

async function main() {
  const require = createRequire(import.meta.url)
  const esbuild = require('esbuild')
  const tmpEntry = join(tmpdir(), `pxs-act25d-entry-${Date.now()}.ts`)
  const tmpBundle = join(tmpdir(), `pxs-act25d-build-${Date.now()}.mjs`)
  const builderPath = resolve('src/renderer/src/project/hanbetaDemoBuilder.ts').replace(/\\/g, '/')
  writeFileSync(tmpEntry, `export { buildHanbetaWorkflowV2Project } from '${builderPath}'\n`, 'utf8')

  let mod
  try {
    await esbuild.build({
      entryPoints: [tmpEntry],
      outfile: tmpBundle,
      bundle: true,
      format: 'esm',
      platform: 'node',
      loader: { '.woff': 'empty', '.woff2': 'empty', '.ttf': 'empty', '.css': 'empty', '.svg': 'dataurl' },
      tsconfig: resolve('tsconfig.web.json')
    })
    mod = await import(pathToFileURL(tmpBundle).href)
  } finally {
    if (existsSync(tmpEntry)) unlinkSync(tmpEntry)
  }

  try {
    const project = mod.buildHanbetaWorkflowV2Project()
    project.assets = project.assets.map((a) => {
      const { dataUrl: _drop, ...rest } = a
      return rest
    })
    mkdirSync(resolve(OUT_PROJ, '..'), { recursive: true })
    writeFileSync(OUT_PROJ, JSON.stringify(project, null, 2) + '\n', 'utf8')
    console.log(
      `✓ Đã xuất ${OUT_PROJ} (${project.shots.length} shots, ${project.layers.length} layers, ${project.assets.length} assets, ${project.workflow?.nodes.length ?? 0} nodes)`
    )
  } finally {
    if (existsSync(tmpBundle)) unlinkSync(tmpBundle)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
