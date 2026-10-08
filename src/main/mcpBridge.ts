import { app, ipcMain, type BrowserWindow } from 'electron'
import { createServer, type Server, type Socket } from 'net'
import { randomBytes, timingSafeEqual } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import { join, basename, extname, dirname } from 'path'
import type {
  McpCaptureOptions,
  McpCaptureResult,
  McpCommand,
  McpDocsLang,
  McpResponse,
  McpStatus,
  PickedFile
} from '@shared/ipc'

/** Capture the whole app window (UI + dialogs) so an AI can review what the user sees. */
async function captureWebContents(wc: Electron.WebContents, opts: McpCaptureOptions = {}): Promise<McpCaptureResult> {
  const img = await wc.capturePage()
  const full = img.getSize()
  const width = Math.max(64, Math.min(full.width, Math.round(opts.width ?? full.width)))
  const out = width < full.width ? img.resize({ width, quality: 'good' }) : img
  const size = out.getSize()
  const jpeg = opts.format === 'jpeg'
  const buf = jpeg ? out.toJPEG(85) : out.toPNG()
  return { mime: jpeg ? 'image/jpeg' : 'image/png', data: buf.toString('base64'), width: size.width, height: size.height }
}

/**
 * Local control bridge for AI agents (Blender-MCP style).
 *
 * The app listens on 127.0.0.1 only. The external `mcp-server` (stdio MCP server
 * launched by the AI client) connects here and sends newline-delimited JSON:
 *
 *   → {"id":1,"token":"…","method":"get_project_info","params":{}}
 *   ← {"id":1,"ok":true,"result":{…}}
 *
 * Every request must carry the token stored in `<userData>/mcp.json`, which only
 * processes of the same OS user can read. Commands are forwarded to the renderer
 * (where the project state lives) and executed as normal undoable edits.
 */

const DEFAULT_PORT = 9877
const MAX_LINE = 256 * 1024 * 1024 // base64 images can be large
const MAX_FILE = 1024 * 1024 * 1024

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pxs: 'application/zip'
}

/** Long-running commands get a longer timeout. */
const TIMEOUTS: Record<string, number> = {
  export_video: 4 * 60 * 60 * 1000,
  execute_script: 30 * 60 * 1000,
  open_project: 10 * 60 * 1000,
  save_project: 10 * 60 * 1000
}
const DEFAULT_TIMEOUT = 5 * 60 * 1000

interface Pending {
  resolve: (r: McpResponse) => void
  timer: NodeJS.Timeout
}

export class McpBridge {
  private server: Server | null = null
  private sockets = new Set<Socket>()
  private pending = new Map<string, Pending>()
  private queue: McpCommand[] = []
  private rendererReady = false
  private seq = 0
  private token = ''
  private status: McpStatus

  constructor(private getWindow: () => BrowserWindow | null) {
    const candidates = [
      join(app.getAppPath(), 'mcp-server', 'index.mjs'),
      join(process.resourcesPath, 'mcp-server', 'index.mjs'),
      join(app.getAppPath(), '..', 'mcp-server', 'index.mjs'),
      join(process.cwd(), 'mcp-server', 'index.mjs')
    ]
    const serverScript = candidates.find((p) => existsSync(p)) || candidates[0]

    this.status = {
      listening: false,
      port: Number(process.env.PARALLAX_MCP_PORT) || DEFAULT_PORT,
      clients: 0,
      commands: 0,
      lastMethod: null,
      lastAt: null,
      configPath: join(app.getPath('userData'), 'mcp.json'),
      serverScriptPath: serverScript.replace(/\\/g, '/'),
      docsLang: 'en'
    }
    this.status.docsLang = this.loadDocsLang()

    ipcMain.on('mcp:ready', () => {
      this.rendererReady = true
      const q = this.queue.splice(0)
      for (const c of q) this.getWindow()?.webContents.send('mcp:command', c)
      this.broadcast()
    })
    ipcMain.on('mcp:response', (_e, res: McpResponse) => {
      const p = this.pending.get(res.reqId)
      if (!p) return
      clearTimeout(p.timer)
      this.pending.delete(res.reqId)
      p.resolve(res)
    })
    ipcMain.handle('mcp:status', () => this.status)
    ipcMain.handle('mcp:disconnectAll', () => {
      this.disconnectAll()
      return true
    })
    ipcMain.handle('mcp:toggleListening', (_e, enable?: boolean) => {
      return this.toggleListening(enable)
    })
    ipcMain.handle('mcp:setDocsLang', (_e, lang: unknown) => this.setDocsLang(lang))
    ipcMain.handle('mcp:captureWindow', (e, opts?: McpCaptureOptions) => captureWebContents(e.sender, opts))
  }

  /** Call when the window (re)loads — commands queue until the renderer subscribes again. */
  onWindowLoading(): void {
    this.rendererReady = false
  }

  start(): void {
    if (process.env.PARALLAX_MCP === '0') {
      this.status.error = 'MCP bị tắt (PARALLAX_MCP=0)'
      return
    }
    this.token = this.loadOrCreateToken()
    this.listen(this.status.port, 0)
  }

  stop(): void {
    this.disconnectAll()
    this.server?.close()
    this.server = null
    this.status.listening = false
    this.broadcast()
  }

  /** Close all active client connections to immediately release network and CPU/RAM resources. */
  disconnectAll(): void {
    for (const s of this.sockets) {
      try {
        s.destroy()
      } catch {
        /* ignore */
      }
    }
    this.sockets.clear()
    this.broadcast()
  }

  /** Pause or resume the TCP server listener. */
  toggleListening(enable?: boolean): McpStatus {
    const target = enable !== undefined ? enable : !this.status.listening
    if (!target) {
      this.stop()
    } else if (!this.status.listening) {
      this.start()
    }
    return this.status
  }

  /**
   * Language of the docs the MCP server gives AI agents (tool descriptions, guide). Written to
   * mcp.json even while the listener is paused; running MCP servers pick it up live.
   */
  setDocsLang(lang: unknown): McpStatus {
    this.status.docsLang = lang === 'vi' ? 'vi' : 'en'
    if (!this.token) this.token = this.loadOrCreateToken()
    try {
      this.writeConfig()
    } catch (e) {
      this.status.error = `Không ghi được ${this.status.configPath}: ${String(e)}`
    }
    this.broadcast()
    return this.status
  }

  // ---------------------------------------------------------------- setup

  private loadOrCreateToken(): string {
    try {
      if (existsSync(this.status.configPath)) {
        const cfg = JSON.parse(readFileSync(this.status.configPath, 'utf8'))
        if (typeof cfg.token === 'string' && cfg.token.length >= 32) return cfg.token
      }
    } catch {
      /* regenerate */
    }
    return randomBytes(24).toString('hex')
  }

  private loadDocsLang(): McpDocsLang {
    try {
      if (existsSync(this.status.configPath)) {
        const cfg = JSON.parse(readFileSync(this.status.configPath, 'utf8'))
        if (cfg.docsLang === 'vi') return 'vi'
      }
    } catch {
      /* default */
    }
    return 'en'
  }

  private writeConfig(): void {
    mkdirSync(dirname(this.status.configPath), { recursive: true })
    const cfg = {
      host: '127.0.0.1',
      port: this.status.port,
      token: this.token,
      docsLang: this.status.docsLang,
      pid: process.pid,
      updatedAt: new Date().toISOString()
    }
    writeFileSync(this.status.configPath, JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 })
  }

  private listen(port: number, attempt: number): void {
    const server = createServer((sock) => this.onConnection(sock))
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && attempt < 9) {
        this.listen(port + 1, attempt + 1)
        return
      }
      this.status.error = `Không mở được cổng MCP: ${err.message}`
      this.broadcast()
    })
    server.listen(port, '127.0.0.1', () => {
      this.server = server
      this.status.port = port
      this.status.listening = true
      this.status.error = undefined
      try {
        this.writeConfig()
      } catch (e) {
        this.status.error = `Không ghi được ${this.status.configPath}: ${String(e)}`
      }
      this.broadcast()
    })
  }

  private broadcast(): void {
    this.status.clients = this.sockets.size
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    try {
      if (!win.webContents.isDestroyed()) {
        win.webContents.send('mcp:status', this.status)
      }
    } catch {
      /* ignore if window or webContents is being destroyed */
    }
  }

  // ---------------------------------------------------------------- protocol

  private onConnection(sock: Socket): void {
    // Defence in depth: the server is bound to loopback, but refuse anything else anyway.
    const addr = sock.remoteAddress ?? ''
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(addr)) {
      sock.destroy()
      return
    }
    this.sockets.add(sock)
    this.broadcast()
    let buf = ''
    sock.setEncoding('utf8')
    sock.on('data', (chunk: string) => {
      buf += chunk
      if (buf.length > MAX_LINE) {
        this.send(sock, { id: null, ok: false, error: 'Request too large' })
        sock.destroy()
        return
      }
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (line) void this.handleLine(sock, line)
      }
    })
    const drop = (): void => {
      this.sockets.delete(sock)
      this.broadcast()
    }
    sock.on('close', drop)
    sock.on('error', drop)
  }

  private send(sock: Socket, msg: unknown): void {
    if (!sock.destroyed) sock.write(JSON.stringify(msg) + '\n')
  }

  private checkToken(t: unknown): boolean {
    if (typeof t !== 'string' || !this.token) return false
    const a = Buffer.from(t)
    const b = Buffer.from(this.token)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  private async handleLine(sock: Socket, line: string): Promise<void> {
    let req: { id?: unknown; token?: unknown; method?: unknown; params?: unknown }
    try {
      req = JSON.parse(line)
    } catch {
      this.send(sock, { id: null, ok: false, error: 'Invalid JSON' })
      return
    }
    const id = req.id ?? null
    if (!this.checkToken(req.token)) {
      this.send(sock, { id, ok: false, error: 'Unauthorized: invalid token (see mcp.json)' })
      return
    }
    const method = typeof req.method === 'string' ? req.method : ''
    const params = (req.params && typeof req.params === 'object' ? req.params : {}) as Record<string, unknown>
    try {
      const result = await this.dispatch(method, params)
      this.send(sock, { id, ok: true, result })
    } catch (err) {
      this.send(sock, { id, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  private async dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!method) throw new Error('Missing method')
    this.status.commands++
    this.status.lastMethod = method
    this.status.lastAt = Date.now()
    this.broadcast()

    if (method === 'ping') return { app: 'parallax-studio', version: app.getVersion(), port: this.status.port, rendererReady: this.rendererReady }

    const cmd: McpCommand = { reqId: `${Date.now().toString(36)}-${++this.seq}`, method, params }
    if (typeof params.file_path === 'string' && params.file_path) cmd.file = await readPicked(params.file_path)

    const res = await this.forward(cmd)
    if (!res.ok) throw new Error(res.error ?? 'Command failed')

    if (method === 'get_memory_stats' && res.result && typeof res.result === 'object') {
      const metrics = app.getAppMetrics().map((m) => ({
        type: m.type,
        pid: m.pid,
        workingSetMB: Math.round(m.memory.workingSetSize / 1024),
        peakMB: Math.round(m.memory.peakWorkingSetSize / 1024),
        cpu: Math.round(m.cpu.percentCPUUsage * 10) / 10
      }))
      return { ...(res.result as object), processes: metrics, totalWorkingSetMB: metrics.reduce((s, m) => s + m.workingSetMB, 0) }
    }
    return res.result
  }

  private forward(cmd: McpCommand): Promise<McpResponse> {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return Promise.resolve({ reqId: cmd.reqId, ok: false, error: 'App window is not open' })
    return new Promise<McpResponse>((resolve) => {
      const ms = TIMEOUTS[cmd.method] ?? DEFAULT_TIMEOUT
      const timer = setTimeout(() => {
        this.pending.delete(cmd.reqId)
        this.queue = this.queue.filter((q) => q.reqId !== cmd.reqId)
        resolve({ reqId: cmd.reqId, ok: false, error: `Timeout after ${Math.round(ms / 1000)}s` })
      }, ms)
      this.pending.set(cmd.reqId, { resolve, timer })
      if (this.rendererReady) win.webContents.send('mcp:command', cmd)
      else this.queue.push(cmd)
    })
  }
}

async function readPicked(p: string): Promise<PickedFile> {
  const st = await stat(p).catch(() => null)
  if (!st || !st.isFile()) throw new Error(`File not found: ${p}`)
  if (st.size > MAX_FILE) throw new Error(`File too large (${Math.round(st.size / 1e6)} MB): ${p}`)
  const ext = extname(p).slice(1).toLowerCase()
  return { name: basename(p), path: p, mime: MIME[ext] ?? 'application/octet-stream', data: new Uint8Array(await readFile(p)) }
}
