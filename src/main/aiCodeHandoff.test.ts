import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { AiCodeHandoffService, parseCodeReply } from './aiCodeHandoffService'
import { collectSourceFiles, safeSourcePath } from './aiCodeHandoffFiles'

let root: string
let service: AiCodeHandoffService
const source = 'src/renderer/src/Example.tsx'
async function put(path: string, text: string) {
  await mkdir(join(root, path, '..'), { recursive: true })
  await writeFile(join(root, path), text)
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pxs-code-test-'))
  service = new AiCodeHandoffService(root, join(root, 'storage'))
  for (const path of ['AGENTS.md', '.agents/skills/ai-ui-inspector/SKILL.md',
    '.agents/skills/mcp-ui-region/SKILL.md', '.agents/rules/responsive-standard.md']) await put(path, '# Rules')
  await put(source, "import './example.css'\nexport const Example = () => <button>Hi</button>\n")
  await put('src/renderer/src/example.css', '.example { color: red; }')
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

async function response(content = 'export const Example = () => <button>Đã sửa</button>\n') {
  const bundle = await service.export([source], 'UI context')
  return { bundle, reply: JSON.stringify({ version: 1, bundleId: bundle.id,
    files: [{ path: source, baseHash: bundle.files[0].hash, content }] }) }
}

describe('AI code handoff', () => {
  it('includes full source, local CSS, line numbers and rules', async () => {
    const { bundle } = await response()
    expect(bundle.files).toHaveLength(2)
    expect(bundle.markdown).toContain('1 | import')
    expect(bundle.markdown).toContain('# Rules')
    expect(bundle.markdown).toContain(bundle.files[0].hash)
  })
  it('previews without writes and applies with exact originals backed up', async () => {
    const { bundle, reply } = await response()
    expect((await service.import(reply, false)).applied).toBe(false)
    expect(await readFile(join(root, source), 'utf8')).toBe(bundle.files[0].content)
    const result = await service.import(reply, true)
    expect(await readFile(join(result.backupPath, source), 'utf8')).toBe(bundle.files[0].content)
    expect(await readFile(join(root, source), 'utf8')).toContain('Đã sửa')
    await expect(service.import(reply, true)).rejects.toThrow('đã thay đổi')
  })
  it('rejects stale files, invalid syntax and paths outside the exported set', async () => {
    const { reply } = await response('export const = <')
    await expect(service.import(reply, true)).rejects.toThrow()
    const valid = await response()
    await put(source, '// concurrent edit')
    await expect(service.import(valid.reply, true)).rejects.toThrow('đã thay đổi')
    const forged = JSON.parse(valid.reply)
    forged.files[0].path = 'src/renderer/src/other.ts'
    await expect(service.import(JSON.stringify(forged), true)).rejects.toThrow('không thuộc gói')
  })
  it('rejects an entire batch before writing when a later file conflicts', async () => {
    const { bundle, reply } = await response()
    const parsed = JSON.parse(reply)
    const css = bundle.files[1]
    parsed.files.push({ path: css.path, baseHash: css.hash, content: '.example {}' })
    await put(css.path, '/* new work */')
    await expect(service.import(JSON.stringify(parsed), true)).rejects.toThrow('đã thay đổi')
    expect(await readFile(join(root, source), 'utf8')).toBe(bundle.files[0].content)
  })
  it('blocks traversal, absolute paths and secret files', async () => {
    for (const path of ['../.env', 'src/renderer/src/../../.env', 'C:/secret.ts', '.env']) {
      await expect(safeSourcePath(root, path)).rejects.toThrow()
    }
  })
  it('accepts one JSON fence, rejects duplicates and malformed replies', async () => {
    const { reply } = await response()
    expect(parseCodeReply('```json\n' + reply + '\n```').version).toBe(1)
    const parsed = JSON.parse(reply); parsed.files.push(parsed.files[0])
    expect(() => parseCodeReply(JSON.stringify(parsed))).toThrow('trùng')
    expect(() => parseCodeReply('{}')).toThrow()
  })
  it('resolves cycles and shared aliases once and reports dynamic imports', async () => {
    await put(source, "import { x } from '@shared/helper'\nimport('./' + x)\n")
    await put('src/shared/helper.ts', "import '../renderer/src/Example'\nexport const x = 'foo'")
    const result = await collectSourceFiles(root, [source])
    expect(result.files).toHaveLength(2)
    expect(result.warnings.join()).toContain('import động')
  })
})
