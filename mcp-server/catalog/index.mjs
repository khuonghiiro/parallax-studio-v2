/**
 * Bilingual MCP catalogue — single source for the MCP server (index.mjs), the CLI controller
 * (cli.mjs), the Antigravity schema sync script and the app's MCP dialog guide.
 *
 * Docs language: env PARALLAX_MCP_LANG  >  "docsLang" in <userData>/mcp.json (toggle in the
 * app's MCP dialog)  >  "en" (default — English gives AI agents the most precise tool calls).
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describer, pick, z } from './shared.mjs'
import { SCENE_TOOLS } from './tools-scene.mjs'
import { FX_TOOLS } from './tools-motion.mjs'
import { ASSEMBLY_TOOLS } from './tools-assembly.mjs'
import { LAYER_ASSEMBLY_TOOLS } from './tools-layer-assembly.mjs'

const here = dirname(fileURLToPath(import.meta.url))

export const GUIDE = JSON.parse(readFileSync(join(here, 'guide.json'), 'utf8'))
export const TOOLS = [...SCENE_TOOLS, ...FX_TOOLS, ...ASSEMBLY_TOOLS, ...LAYER_ASSEMBLY_TOOLS]
export const LANGS = ['en', 'vi']
export const GUIDE_TOPICS = ['all', ...GUIDE.sections.map((s) => s.id)]

// ------------------------------------------------------------------ config

export function configPath() {
  if (process.env.PARALLAX_MCP_CONFIG) return process.env.PARALLAX_MCP_CONFIG
  const appName = 'parallax-studio'
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), appName, 'mcp.json')
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', appName, 'mcp.json')
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), appName, 'mcp.json')
}

/** Parsed mcp.json, or null when the app has never run. */
export function readConfigFile() {
  try {
    return JSON.parse(readFileSync(configPath(), 'utf8'))
  } catch {
    return null
  }
}

export const normalizeLang = (v) => (String(v ?? '').toLowerCase().startsWith('vi') ? 'vi' : 'en')

/** Language the AI docs are served in (see file header for precedence). */
export function resolveDocsLang(cfg = readConfigFile()) {
  if (process.env.PARALLAX_MCP_LANG) return normalizeLang(process.env.PARALLAX_MCP_LANG)
  return normalizeLang(cfg?.docsLang)
}

// ------------------------------------------------------------------ tool docs

export const findTool = (name) => TOOLS.find((t) => t.name === name)
export const toolDescription = (tool, lang) => pick(tool.doc, lang)
/** Zod raw shape of a tool with parameter descriptions in `lang`. */
export const buildShape = (tool, lang) => tool.shape(describer(lang))
export const categoryLabel = (cat, lang) => pick(GUIDE.categories[cat] ?? { en: cat, vi: cat }, lang)

/** JSON Schema (draft-07) of a tool's parameters in `lang`. */
export function paramsJsonSchema(tool, lang) {
  const schema = z.toJSONSchema(z.object(buildShape(tool, lang)), { target: 'draft-7' })
  delete schema.$schema
  return schema
}

/** Short human type label for a JSON Schema node (tuples → [number, number]). */
function typeLabel(p) {
  if (!p) return 'any'
  if (p.enum) return p.enum.map((v) => JSON.stringify(v)).join('|')
  if (p.anyOf) return p.anyOf.map(typeLabel).join('|')
  if (p.type === 'array' && Array.isArray(p.items)) return `[${p.items.map(typeLabel).join(', ')}]`
  if (p.type === 'array') return `${typeLabel(p.items)}[]`
  return Array.isArray(p.type) ? p.type.join('|') : p.type ?? 'any'
}

/** One line per parameter: `name: type (optional) — description`. */
export function paramsSummary(tool, lang) {
  const schema = paramsJsonSchema(tool, lang)
  const required = new Set(schema.required ?? [])
  return Object.entries(schema.properties ?? {}).map(([name, p]) => {
    const opt = required.has(name) ? '' : lang === 'vi' ? ' (tùy chọn)' : ' (optional)'
    return `${name}: ${typeLabel(p)}${opt}${p.description ? ` — ${p.description}` : ''}`
  })
}

// ------------------------------------------------------------------ guide

/** Guide text in `lang`; topic = "all" or a section id. */
export function renderGuide(lang, topic = 'all') {
  const sections = topic === 'all' ? GUIDE.sections : GUIDE.sections.filter((s) => s.id === topic)
  if (sections.length === 0) throw new Error(`Unknown guide topic "${topic}" (${GUIDE_TOPICS.join(', ')})`)
  return sections.map((s) => [`## ${pick(s.title, lang)}`, ...pick(s.lines, lang)].join('\n')).join('\n\n')
}

/** MCP `instructions` sent to the client on connect. */
export function serverInstructions(lang) {
  const header =
    lang === 'vi'
      ? 'Parallax Studio MCP — tài liệu tiếng Việt. Gọi get_ai_guide để đọc lại từng phần.'
      : 'Parallax Studio MCP — English docs. Call get_ai_guide to re-read any section.'
  return `${header}\n\n${renderGuide(lang)}`
}
