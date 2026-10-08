#!/usr/bin/env node
/**
 * Parallax Studio MCP server (stdio).
 *
 * Lets an AI client (Antigravity, Claude Desktop, Cursor…) drive a running Parallax
 * Studio window, the same way blender-mcp drives Blender. This process only speaks
 * MCP on stdio and relays each tool call to the app's local bridge
 * (127.0.0.1, token from <userData>/parallax-studio/mcp.json).
 *
 * Tool docs come from the bilingual catalogue (./catalog). The docs language follows the
 * toggle in the app's MCP dialog ("docsLang" in mcp.json, default English) and switches
 * live: descriptions are re-registered and the client gets notifications/tools/list_changed.
 *
 * Never write to stdout here except through the MCP transport — logs go to stderr.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createConnection } from 'node:net'
import { watchFile } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import {
  TOOLS,
  buildShape,
  configPath,
  readConfigFile,
  renderGuide,
  resolveDocsLang,
  serverInstructions,
  toolDescription
} from './catalog/index.mjs'

const log = (...a) => console.error('[parallax-mcp]', ...a)

// ------------------------------------------------------------------ bridge client

function readConfig() {
  const cfg = readConfigFile()
  if (!cfg) {
    throw new Error(`Parallax Studio is not running (or has never been started): cannot read ${configPath()}. Start the app with "npm run dev" first.`)
  }
  return {
    host: '127.0.0.1', // never connect anywhere else
    port: Number(process.env.PARALLAX_MCP_PORT) || cfg.port || 9877,
    token: process.env.PARALLAX_MCP_TOKEN || cfg.token
  }
}

class Bridge {
  sock = null
  buf = ''
  seq = 0
  pending = new Map()
  connecting = null

  connect() {
    if (this.sock && !this.sock.destroyed) return Promise.resolve()
    if (this.connecting) return this.connecting
    const cfg = readConfig()
    this.token = cfg.token
    this.connecting = new Promise((res, rej) => {
      const s = createConnection({ host: cfg.host, port: cfg.port })
      s.setEncoding('utf8')
      s.once('connect', () => {
        this.sock = s
        this.connecting = null
        res()
      })
      s.once('error', (err) => {
        this.connecting = null
        rej(new Error(`Cannot reach Parallax Studio on ${cfg.host}:${cfg.port} (${err.code ?? err.message}). Is the app open?`))
      })
      s.on('data', (chunk) => this.onData(chunk))
      s.on('close', () => {
        if (this.sock === s) this.sock = null
        for (const [, p] of this.pending) p.reject(new Error('Connection to Parallax Studio closed'))
        this.pending.clear()
      })
    })
    return this.connecting
  }

  onData(chunk) {
    this.buf += chunk
    let nl
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl)
      this.buf = this.buf.slice(nl + 1)
      if (!line.trim()) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        log('bad line from app', line.slice(0, 200))
        continue
      }
      const p = this.pending.get(msg.id)
      if (!p) continue
      this.pending.delete(msg.id)
      if (msg.ok) p.resolve(msg.result)
      else p.reject(new Error(msg.error ?? 'Command failed'))
    }
  }

  async call(method, params = {}) {
    await this.connect()
    const id = ++this.seq
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej })
      this.sock.write(JSON.stringify({ id, token: this.token, method, params }) + '\n')
    })
  }
}

const bridge = new Bridge()

// ------------------------------------------------------------------ result formatting

/** Make relative paths absolute against this process's cwd (the app has a different cwd). */
function absPaths(args) {
  const out = { ...args }
  for (const k of ['file_path', 'out_path', 'path']) if (typeof out[k] === 'string' && out[k] && !isAbsolute(out[k])) out[k] = resolve(out[k])
  return out
}

const text = (v) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] })

/** Screenshots: an image block plus a one-line caption. */
function imageResult(r) {
  const { data, mime, ...rest } = r ?? {}
  const caption = r?.view
    ? `${r.view} view · t=${r.time}s · ${r.width}×${r.height} · textures ${r.stats?.textures} (${r.stats?.textureMB} MB)`
    : JSON.stringify(rest)
  return { content: [{ type: 'image', data, mimeType: mime ?? 'image/png' }, { type: 'text', text: caption }] }
}

const errorResult = (err) => ({ isError: true, content: [{ type: 'text', text: String(err?.message ?? err) }] })

// ------------------------------------------------------------------ server

let lang = resolveDocsLang()

const server = new McpServer({ name: 'parallax-studio', version: '0.2.0' }, { instructions: serverInstructions(lang) })

/** Tools answered here without a round-trip to the app. */
const LOCAL_HANDLERS = {
  get_ai_guide: (args) => text(renderGuide(lang, args?.topic ?? 'all'))
}

async function handle(spec, args) {
  try {
    if (spec.local) return LOCAL_HANDLERS[spec.name](args ?? {})
    const result = await bridge.call(spec.name, absPaths(args ?? {}))
    return spec.format === 'image' ? imageResult(result) : text(result)
  } catch (err) {
    return errorResult(err)
  }
}

const registered = new Map()
for (const spec of TOOLS) {
  const reg = server.registerTool(
    spec.name,
    { description: toolDescription(spec, lang), inputSchema: buildShape(spec, lang) },
    (args) => handle(spec, args)
  )
  registered.set(spec.name, { spec, reg })
}

/** Re-describe every tool in the new language and notify the client once. */
function applyDocsLang(next) {
  if (next === lang) return
  lang = next
  const notify = server.sendToolListChanged.bind(server)
  server.sendToolListChanged = () => {}
  try {
    for (const { spec, reg } of registered.values()) {
      reg.update({ description: toolDescription(spec, lang), paramsSchema: buildShape(spec, lang) })
    }
  } finally {
    server.sendToolListChanged = notify
  }
  notify()
  log(`docs language → ${lang}`)
}

// ------------------------------------------------------------------ start

const transport = new StdioServerTransport()
await server.connect(transport)
watchFile(configPath(), { interval: 2000 }, () => applyDocsLang(resolveDocsLang())).unref()
log(`ready · ${TOOLS.length} tools · docs ${lang} · config ${configPath()}`)
