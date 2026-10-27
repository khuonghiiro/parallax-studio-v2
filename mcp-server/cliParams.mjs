/**
 * Dual-Shell (PowerShell & CMD) argument parser and command formatter for `pnpm pxs`.
 *
 * Why this exists:
 *   - Windows PowerShell 5.1 (`powershell.exe`) strips unescaped double quotes (`"`) when
 *     forwarding `'{"theme":"dark"}'` through `pnpm` to `node`, and splits on spaces inside
 *     string values (turning `'{"name":"Shot 1","z":1500}'` into `["{name:Shot", "1,z:1500}"]`).
 *   - Windows CMD (`cmd.exe`) keeps surrounding single quotes literally (`'{"theme":"dark"}'`)
 *     or requires escaped double quotes (`"{\"theme\":\"dark\"}"`).
 *   - Some AI agents prefer native CLI flags (`--theme dark --z 1500` or `theme=dark`) or
 *     PowerShell hashtables (`@{theme=dark; z=1500}`).
 *
 * This module normalizes all of those forms into the exact parameter object expected by
 * the MCP tool's Zod schema, and generates both PowerShell and CMD invocation examples
 * for every tool in the catalogue.
 */
import { existsSync, readFileSync } from 'node:fs'
import { paramsJsonSchema } from './catalog/index.mjs'

/** Strip matching outer single or double quotes from a string. */
function stripOuterQuotes(str) {
  const s = str.trim()
  if (s.length >= 2 && ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"')))) {
    return s.slice(1, -1).trim()
  }
  return s
}

/** Split `inner` at depth 0 where a separator (`,` or `;`) is followed by a valid key `:`. */
function splitObjectEntries(inner, allowedKeys = null) {
  const entries = []
  let depth = 0
  let quote = ''
  let start = 0

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '{' || ch === '[' || ch === '(') depth++
    else if (ch === '}' || ch === ']' || ch === ')') depth = Math.max(0, depth - 1)
    else if (depth === 0 && (ch === ',' || ch === ';')) {
      const rest = inner.slice(i + 1)
      const m = rest.match(/^\s*["']?([A-Za-z_@][A-Za-z0-9_.-]*)["']?\s*([:=])/)
      if (m) {
        const candidateKey = m[1]
        const sep = m[2]
        if (ch === ';' || sep === '=' || !allowedKeys || allowedKeys.has(candidateKey)) {
          entries.push(inner.slice(start, i).trim())
          start = i + 1
        }
      }
    }
  }
  const tail = inner.slice(start).trim()
  if (tail) entries.push(tail)
  return entries
}

/** Split `inner` array items at depth 0 on `,`. */
function splitArrayItems(inner) {
  const items = []
  let depth = 0
  let quote = ''
  let start = 0

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '{' || ch === '[' || ch === '(') depth++
    else if (ch === '}' || ch === ']' || ch === ')') depth = Math.max(0, depth - 1)
    else if (depth === 0 && ch === ',') {
      items.push(inner.slice(start, i).trim())
      start = i + 1
    }
  }
  const tail = inner.slice(start).trim()
  if (tail) items.push(tail)
  return items
}

/** Check if a JSON Schema property node exclusively expects a string. */
function schemaExpectsOnlyString(propSchema) {
  if (!propSchema) return false
  if (propSchema.type === 'string') return true
  if (Array.isArray(propSchema.enum) && propSchema.enum.every((v) => typeof v === 'string')) return true
  return false
}

/** Parse any loose value (object, array, boolean, number, null, or unquoted string). */
export function parseLooseValue(raw, propSchema = null, allowedKeys = null) {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  // Try strict JSON first
  try {
    return JSON.parse(trimmed)
  } catch {
    /* continue to loose parsing */
  }

  // PowerShell hashtable prefix `@{ ... }` -> `{ ... }`
  const normalized = trimmed.startsWith('@{') && trimmed.endsWith('}') ? trimmed.slice(1) : trimmed

  // Object `{ ... }`
  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    const inner = normalized.slice(1, -1).trim()
    if (!inner) return {}
    const propMap = propSchema?.properties ?? null
    const keySet = allowedKeys ?? (propMap ? new Set(Object.keys(propMap)) : null)
    const entries = splitObjectEntries(inner, keySet)
    const out = {}
    for (const entry of entries) {
      const m = entry.match(/^\s*["']?([A-Za-z_@][A-Za-z0-9_.-]*)["']?\s*[:=]\s*([\s\S]*)$/)
      if (!m) continue
      const key = stripOuterQuotes(m[1])
      const valRaw = m[2].trim()
      const childSchema = propMap?.[key] ?? null
      out[key] = parseLooseValue(valRaw, childSchema, null)
    }
    return out
  }

  // Array `[ ... ]`
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    const inner = normalized.slice(1, -1).trim()
    if (!inner) return []
    const items = splitArrayItems(inner)
    const itemSchema = propSchema?.items ?? null
    return items.map((item, idx) =>
      parseLooseValue(item, Array.isArray(itemSchema) ? itemSchema[idx] : itemSchema, null)
    )
  }

  // Explicitly quoted string
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return stripOuterQuotes(normalized)
  }

  // Scalars: boolean, null, number, or bare string
  if (!schemaExpectsOnlyString(propSchema)) {
    if (normalized === 'true' || normalized === '$true') return true
    if (normalized === 'false' || normalized === '$false') return false
    if (normalized === 'null' || normalized === '$null') return null
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(normalized)) {
      return Number(normalized)
    }
  }

  return stripOuterQuotes(normalized)
}

/** Parse `--key value`, `--key=value`, or `key=value` CLI flags into a parameter object. */
function parseFlagTokens(tokens, rootSchema = null) {
  const out = {}
  const props = rootSchema?.properties ?? {}
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok.startsWith('--no-') && tok.length > 5) {
      out[tok.slice(5)] = false
      i++
      continue
    }
    if (tok.startsWith('--')) {
      const body = tok.slice(2)
      const eq = body.indexOf('=')
      if (eq >= 0) {
        const k = body.slice(0, eq)
        const v = body.slice(eq + 1)
        out[k] = parseLooseValue(v, props[k] ?? null)
        i++
      } else {
        const next = tokens[i + 1]
        if (next === undefined || (next.startsWith('--') && !/^--\d/.test(next))) {
          out[body] = true
          i++
        } else {
          out[body] = parseLooseValue(next, props[body] ?? null)
          i += 2
        }
      }
      continue
    }
    const eq = tok.indexOf('=')
    if (eq > 0) {
      const k = tok.slice(0, eq)
      const v = tok.slice(eq + 1)
      out[k] = parseLooseValue(v, props[k] ?? null)
      i++
      continue
    }
    i++
  }
  return out
}

/**
 * Parse parameters passed to `pnpm pxs call <tool> ...` from EITHER PowerShell OR CMD.
 * Accepts an array of CLI tokens (or a single string) plus optional `tool` spec.
 */
export function parseCliCallParams(rawInput, tool = null) {
  const tokens = Array.isArray(rawInput)
    ? rawInput.filter((x) => x !== undefined && x !== null && String(x).trim() !== '')
    : typeof rawInput === 'string' && rawInput.trim()
      ? [rawInput.trim()]
      : []

  if (tokens.length === 0) return {}

  // 0. Handle PowerShell unquoted `{...}` ScriptBlock expansion (`-encodedCommand <base64> -inputFormat xml -outputFormat text`)
  const encIdx = tokens.findIndex((t) => String(t).toLowerCase() === '-encodedcommand')
  if (encIdx >= 0) {
    const b64 = tokens[encIdx + 1]
    if (!b64 || b64.startsWith('-') || b64 === '\\') return {}
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf16le').trim()
      if (!decoded) return {}
      return parseCliCallParams([`{${decoded}}`], tool)
    } catch {
      return {}
    }
  }

  const rootSchema = tool ? paramsJsonSchema(tool, 'en') : null
  const allowedKeys = rootSchema?.properties ? new Set(Object.keys(rootSchema.properties)) : null

  // 1. Flag / key=value syntax (`--theme dark` or `theme=dark`)
  const first = tokens[0].trim()
  if (first.startsWith('--') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(first)) {
    return parseFlagTokens(tokens, rootSchema)
  }

  // 2. Rejoin tokens that PowerShell 5.1 or CMD split on spaces
  let joined = stripOuterQuotes(tokens.join(' ').trim())
  if (!joined) return {}

  // 3. `@file.json` or `file.json`
  if (joined.startsWith('@') && !joined.startsWith('@{')) {
    const filePath = stripOuterQuotes(joined.slice(1))
    const content = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
    return parseCliCallParams([content], tool)
  }
  if (joined.endsWith('.json') && existsSync(joined)) {
    const content = readFileSync(joined, 'utf8').replace(/^\uFEFF/, '')
    return parseCliCallParams([content], tool)
  }

  // 4. Unescape `\"` if passed as a literal escaped JSON string
  if (joined.includes('\\"')) {
    const unescaped = joined.replace(/\\"/g, '"')
    try {
      return JSON.parse(unescaped)
    } catch {
      joined = unescaped
    }
  }

  // 5. Try strict JSON first
  try {
    return JSON.parse(joined)
  } catch {
    /* fallback to PowerShell/CMD quote-stripped parser */
  }

  // 6. PowerShell 5.1 quote-stripped `{key: val}` or hashtable `@{key=val}`
  const parsed = parseLooseValue(joined, rootSchema, allowedKeys)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed
  }

  throw new Error(`Cannot parse parameters: ${joined}`)
}

/**
 * Build ready-to-run CLI examples for BOTH PowerShell and CMD from a tool's spec,
 * so any AI agent can pick whichever shell syntax is optimal for its environment.
 */
export function toolDualShellExamples(tool) {
  const exRaw = tool?.example?.trim()
  if (!exRaw || exRaw === '{}') {
    return {
      powershell: `pnpm pxs call ${tool.name} '{}'`,
      cmd: `pnpm pxs call ${tool.name} "{}"`,
      flags: `pnpm pxs call ${tool.name}`
    }
  }

  const powershell = `pnpm pxs call ${tool.name} '${exRaw}'`
  const cmdEscaped = exRaw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const cmd = `pnpm pxs call ${tool.name} "${cmdEscaped}"`

  let flags = powershell
  try {
    const obj = JSON.parse(exRaw)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const parts = Object.entries(obj).map(([k, v]) => {
        if (typeof v === 'boolean') return v ? `--${k}` : `--no-${k}`
        if (typeof v === 'number') return `--${k} ${v}`
        if (typeof v === 'string') {
          return /\s/.test(v) ? `--${k} "${v}"` : `--${k} ${v}`
        }
        return `--${k} "${JSON.stringify(v).replace(/"/g, '\\"')}"`
      })
      if (parts.length > 0) {
        flags = `pnpm pxs call ${tool.name} ${parts.join(' ')}`
      }
    }
  } catch {
    /* keep fallback */
  }

  return { powershell, cmd, flags }
}
