#!/usr/bin/env node
/**
 * Regenerates the Antigravity lazy-tool schemas (<name>.json + instructions.md) from the
 * bilingual catalogue, so the IDE always matches the MCP server exactly.
 *
 *   node mcp-server/scripts/sync-tool-schemas.mjs [--lang en|vi] [--out <dir>] [--check]
 *
 * --lang   defaults to the app's docs-language toggle (mcp.json "docsLang", default en)
 * --out    defaults to ~/.gemini/antigravity-ide/mcp/parallax-studio
 * --check  only report missing / outdated / stale files (exit 1 if any), write nothing
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { TOOLS, normalizeLang, paramsJsonSchema, resolveDocsLang, serverInstructions, toolDescription } from '../catalog/index.mjs'

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const lang = argValue('--lang') ? normalizeLang(argValue('--lang')) : resolveDocsLang()
const outDir = argValue('--out') ?? join(homedir(), '.gemini', 'antigravity-ide', 'mcp', 'parallax-studio')
const checkOnly = process.argv.includes('--check')

/** Expected file name → content. */
function expectedFiles() {
  const files = new Map()
  for (const tool of TOOLS) {
    const parameters = { $schema: 'http://json-schema.org/draft-07/schema#', ...paramsJsonSchema(tool, lang) }
    files.set(`${tool.name}.json`, JSON.stringify({ name: tool.name, description: toolDescription(tool, lang), parameters }))
  }
  files.set('instructions.md', `${serverInstructions(lang)}\n`)
  return files
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)

const files = expectedFiles()
const known = new Set(files.keys())
const stale = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.json') && !known.has(f)) : []
const changed = [...files].filter(([name, body]) => read(join(outDir, name)) !== body).map(([name]) => name)

if (checkOnly) {
  for (const f of changed) console.log(`outdated/missing: ${f}`)
  for (const f of stale) console.log(`stale: ${f}`)
  console.log(`${files.size} expected · ${changed.length} outdated · ${stale.length} stale · lang ${lang} · ${outDir}`)
  process.exit(changed.length || stale.length ? 1 : 0)
}

mkdirSync(outDir, { recursive: true })
for (const name of changed) writeFileSync(join(outDir, name), files.get(name), 'utf8')
for (const f of stale) unlinkSync(join(outDir, f))
console.log(`wrote ${changed.length} file(s), removed ${stale.length} stale · ${TOOLS.length} tools · lang ${lang} · ${outDir}`)
