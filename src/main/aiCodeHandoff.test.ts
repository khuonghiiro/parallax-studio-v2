import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { AiCodeHandoffService, parseCodeReply } from './aiCodeHandoffService'
import { safeSourcePath } from './aiCodeHandoffFiles'
import { collectCompactSources } from './aiCodeCompactCollector'

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
  const bundle = await service.export([{ path: source, line: 2 }, { path: 'src/renderer/src/example.css', line: 1, classes: ['example'] }], 'UI context')
  const js = bundle.files.find((f) => f.path === source)!
  return { bundle, reply: JSON.stringify({ version: 2, bundleId: bundle.id,
    files: [{ path: source, baseHash: js.hash, edits: [{ id: js.snippets![0].id, content }] }] }) }
}

describe('AI code handoff', () => {
  it('includes compact snippets and inline UI rules without importing project docs', async () => {
    const { bundle } = await response()
    expect(bundle.files).toHaveLength(2)
    expect(bundle.markdown).toContain('1 | import')
    expect(bundle.markdown).toContain('Quy tắc sửa UI')
    expect(bundle.markdown).not.toContain('# Rules')
    expect(bundle.markdown.length).toBeLessThan(28000)
    expect(bundle.files[0]).not.toHaveProperty('content')
    expect(bundle.markdown).toContain(bundle.files[0].hash)
  })
  it('previews without writes and applies with exact originals backed up', async () => {
    const { bundle, reply } = await response()
    expect((await service.import(reply, false)).applied).toBe(false)
    expect(await readFile(join(root, source), 'utf8')).toBe(bundle.files.find((f) => f.path === source)!.snippets![0].content)
    const result = await service.import(reply, true)
    expect(await readFile(join(result.backupPath, source), 'utf8')).toBe(bundle.files.find((f) => f.path === source)!.snippets![0].content)
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
    const css = bundle.files.find((f) => f.path.endsWith('.css'))!
    parsed.files.push({ path: css.path, baseHash: css.hash, edits: [{ id: css.snippets![0].id, content: '.example {}' }] })
    await put(css.path, '/* new work */')
    await expect(service.import(JSON.stringify(parsed), true)).rejects.toThrow('đã thay đổi')
    expect(await readFile(join(root, source), 'utf8')).toBe(bundle.files.find((f) => f.path === source)!.snippets![0].content)
  })
  it('blocks traversal, absolute paths and secret files', async () => {
    for (const path of ['../.env', 'src/renderer/src/../../.env', 'C:/secret.ts', '.env']) {
      await expect(safeSourcePath(root, path)).rejects.toThrow()
    }
  })
  it('accepts one JSON fence, rejects duplicates and malformed replies', async () => {
    const { reply } = await response()
    expect(parseCodeReply('```json\n' + reply + '\n```').version).toBe(2)
    const parsed = JSON.parse(reply); parsed.files.push(parsed.files[0])
    expect(() => parseCodeReply(JSON.stringify(parsed))).toThrow('trùng')
    expect(() => parseCodeReply('{}')).toThrow()
  })
  it('does not follow JS imports into stores or engine', async () => {
    await put(source, "import { x } from '@shared/helper'\nexport const y = x\n")
    await put('src/shared/helper.ts', "export const x = 'PRIVATE_UNRELATED_LOGIC'")
    const result = await collectCompactSources(root, [{ path: source, line: 2 }])
    expect(result.files).toHaveLength(1)
    expect(result.files[0].snippets![0].content).not.toContain('PRIVATE_UNRELATED_LOGIC')
  })
  it('changes only the exported snippet and preserves the rest byte-for-byte', async () => {
    const content = Array.from({ length: 150 }, (_, i) => `// line ${i + 1}`).join('\n')
    await put(source, content)
    const bundle = await service.export([{ path: source, line: 75 }], '')
    const file = bundle.files[0], snippet = file.snippets![0]
    const replacement = snippet.content.replace('// line 75', '// Đã sửa UI')
    const reply = { version: 2, bundleId: bundle.id, files: [{ path: source, baseHash: file.hash,
      edits: [{ id: snippet.id, content: replacement }] }] }
    await service.import(JSON.stringify(reply), true)
    expect(await readFile(join(root, source), 'utf8')).toBe(content.replace('// line 75', '// Đã sửa UI'))
  })
  it('rejects a full-file downgrade or edits outside exported snippet IDs', async () => {
    const { reply } = await response()
    const parsed = JSON.parse(reply)
    parsed.files[0].edits[0].id = 'outside'
    await expect(service.import(JSON.stringify(parsed), true)).rejects.toThrow('không thuộc gói')
    parsed.version = 1; parsed.files[0].content = '// replacement'
    await expect(service.import(JSON.stringify(parsed), true)).rejects.toThrow('toàn bộ file')
  })
  it('budgets source snippets and reports omissions instead of exporting full large files', async () => {
    const css = Array.from({ length: 250 }, (_, i) => `.example:hover { --sample-${i}: "${'x'.repeat(100)}"; }`).join('\n')
    await put('src/renderer/src/example.css', css)
    const bundle = await service.export([{ path: source, line: 2 },
      { path: 'src/renderer/src/example.css', line: 1, classes: ['example'] }], '')
    const size = bundle.files.flatMap((f) => f.snippets || []).reduce((n, s) => n + s.content.length, 0)
    expect(size).toBeLessThanOrEqual(18000)
    expect(bundle.markdown.length).toBeLessThanOrEqual(28000)
    expect(bundle.warnings.join(' ')).toContain('chưa đưa vào')
    expect(bundle.files.some((f) => f.path === source)).toBe(true)
  })
})
