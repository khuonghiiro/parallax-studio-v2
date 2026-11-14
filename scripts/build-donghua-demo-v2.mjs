/**
 * Đóng gói Dự án Mẫu 2 ("Vân Sơn Kiếm Khúc — Hoạt Ảnh Quốc Phong 2.5D"):
 *  - Đọc kích thước thật của 14 ảnh từ `assets/scenes-donghua-v2/cutout-manifest.json`
 *  - Gọi `buildDonghuaWorkflowV2Project` & `buildModularWorkflowBundle` (bundle tạm bằng esbuild)
 *  - Xuất `projects/demo-2-son-thuy-kiem-hiep.json` (tham chiếu path tương đối, không nhúng base64)
 *  - Xuất `projects/donghua-v2-bundle/{main.json, workflow-bundle.json, shots/shot-1..3.json}`
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const MANIFEST_PATH = resolve('assets/scenes-donghua-v2/cutout-manifest.json')
const OUT_PROJ = resolve('projects/demo-2-son-thuy-kiem-hiep.json')
const OUT_BUNDLE_DIR = resolve('projects/donghua-v2-bundle')
const OUT_SHOTS_DIR = join(OUT_BUNDLE_DIR, 'shots')

function buildEntrySource() {
  return `
    export { buildDonghuaWorkflowV2Project } from '${resolve('src/renderer/src/project/donghuaDemoBuilder.ts').replace(/\\/g, '/')}'
    export { buildModularWorkflowBundle } from '${resolve('src/renderer/src/project/workflowV2ModularJson.ts').replace(/\\/g, '/')}'
  `
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const assetInputs = manifest.map((m) => ({
    id: m.id,
    file: m.file,
    name: m.name,
    width: m.width,
    height: m.height
  }))

  const require = createRequire(import.meta.url)
  const esbuild = require('esbuild')
  const tmpEntry = join(tmpdir(), `pxs-dg-entry-${Date.now()}.ts`)
  const tmpBundle = join(tmpdir(), `pxs-dg-build-${Date.now()}.mjs`)
  writeFileSync(tmpEntry, buildEntrySource(), 'utf8')

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
    const project = mod.buildDonghuaWorkflowV2Project(assetInputs)
    // Đảm bảo không nhúng dataUrl base64 lớn vào JSON mẫu
    project.assets = project.assets.map((a) => {
      const { dataUrl: _drop, ...rest } = a
      return rest
    })

    mkdirSync(OUT_SHOTS_DIR, { recursive: true })
    writeFileSync(OUT_PROJ, JSON.stringify(project, null, 2) + '\n', 'utf8')

    const bundle = mod.buildModularWorkflowBundle(project, project.workflow)
    writeFileSync(join(OUT_BUNDLE_DIR, 'main.json'), JSON.stringify(bundle.main, null, 2) + '\n', 'utf8')
    writeFileSync(join(OUT_BUNDLE_DIR, 'workflow-bundle.json'), JSON.stringify(bundle, null, 2) + '\n', 'utf8')
    for (const [relFile, doc] of Object.entries(bundle.files)) {
      if (relFile === 'main.json') continue
      const target = join(OUT_BUNDLE_DIR, relFile)
      mkdirSync(resolve(target, '..'), { recursive: true })
      writeFileSync(target, JSON.stringify(doc, null, 2) + '\n', 'utf8')
    }

    console.log(`✓ Đã xuất ${OUT_PROJ} (${project.shots.length} shots, ${project.layers.length} layers, ${project.workflow?.nodes.length ?? 0} nodes)`)
    console.log(`✓ Đã xuất bundle tại ${OUT_BUNDLE_DIR} (${Object.keys(bundle.files).length} files)`)
  } finally {
    if (existsSync(tmpBundle)) unlinkSync(tmpBundle)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
