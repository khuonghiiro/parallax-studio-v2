import { ipcMain, type BrowserWindow } from 'electron'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { networkInterfaces } from 'os'
import { randomBytes } from 'crypto'
import type { RemoteServerStatus } from '@shared/ipc'
import type { McpBridge } from './mcpBridge'
import { renderMobileRemoteHtml } from './remoteWebUi'

const DEFAULT_REMOTE_PORT = 9878
const DEVICE_TTL_MS = 15_000

const VIRTUAL_IFACE_PATTERN = /vethernet|wsl|docker|vmware|virtualbox|vbox|hyper-v|loopback|tailscale|zerotier/i

/**
 * Thu thập danh sách địa chỉ IPv4 mạng nội bộ (Wi-Fi / LAN), ưu tiên card Wi-Fi & Ethernet vật lý.
 */
export function detectLanIpv4Addresses(): string[] {
  const nets = networkInterfaces()
  const primary: string[] = []
  const secondary: string[] = []

  for (const [name, list] of Object.entries(nets)) {
    if (!list) continue
    const isVirtual = VIRTUAL_IFACE_PATTERN.test(name)
    const isWifiOrEth = /wi-?fi|wlan|wireless|ethernet|en\d|eth\d/i.test(name)

    for (const info of list) {
      const fam = String(info.family)
      if ((fam !== 'IPv4' && fam !== '4') || info.internal) continue
      const addr = info.address
      if (!addr || addr.startsWith('169.254.')) continue

      if (!isVirtual && (isWifiOrEth || addr.startsWith('192.168.') || addr.startsWith('10.'))) {
        primary.push(addr)
      } else {
        secondary.push(addr)
      }
    }
  }

  const all = Array.from(new Set([...primary, ...secondary]))
  return all.length > 0 ? all : ['127.0.0.1']
}

export class RemoteControlServer {
  private server: Server | null = null
  private port = Number(process.env.PARALLAX_REMOTE_PORT) || DEFAULT_REMOTE_PORT
  private listening = false
  private token = randomBytes(4).toString('hex')
  private activeClients = new Map<string, number>()
  private lastActiveAt: number | null = null
  private lastAction: string | null = null
  private error?: string

  constructor(
    private getWindow: () => BrowserWindow | null,
    private mcpBridge: McpBridge
  ) {
    ipcMain.handle('remote:status', () => this.getStatus())
    ipcMain.handle('remote:toggle', (_e, enable?: boolean) => this.toggle(enable))
    ipcMain.handle('remote:regenerateToken', () => this.regenerateToken())
  }

  start(): void {
    if (this.listening) return
    this.listen(this.port, 0)
  }

  stop(): void {
    this.server?.close()
    this.server = null
    this.listening = false
    this.activeClients.clear()
    this.broadcast()
  }

  toggle(enable?: boolean): RemoteServerStatus {
    const next = enable !== undefined ? enable : !this.listening
    if (next) this.start()
    else this.stop()
    return this.getStatus()
  }

  regenerateToken(): RemoteServerStatus {
    this.token = randomBytes(4).toString('hex')
    this.activeClients.clear()
    this.broadcast()
    return this.getStatus()
  }

  getStatus(): RemoteServerStatus {
    this.pruneClients()
    const ips = detectLanIpv4Addresses()
    const primaryIp = ips[0] ?? '127.0.0.1'
    const urls = ips.map((ip) => `http://${ip}:${this.port}/?t=${this.token}`)
    return {
      listening: this.listening,
      port: this.port,
      ips,
      primaryIp,
      token: this.token,
      url: urls[0] ?? `http://127.0.0.1:${this.port}/?t=${this.token}`,
      urls,
      connectedDevices: this.activeClients.size,
      lastActiveAt: this.lastActiveAt,
      lastAction: this.lastAction,
      error: this.error
    }
  }

  private pruneClients(): void {
    const now = Date.now()
    for (const [ip, ts] of this.activeClients.entries()) {
      if (now - ts > DEVICE_TTL_MS) this.activeClients.delete(ip)
    }
  }

  private markClient(req: IncomingMessage, actionLabel?: string): void {
    const ip = req.socket.remoteAddress || 'unknown'
    const prevCount = this.activeClients.size
    this.activeClients.set(ip, Date.now())
    this.lastActiveAt = Date.now()
    if (actionLabel) this.lastAction = actionLabel
    if (this.activeClients.size !== prevCount || actionLabel) {
      this.broadcast()
    }
  }

  private broadcast(): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    try {
      if (!win.webContents.isDestroyed()) {
        win.webContents.send('remote:status', this.getStatus())
      }
    } catch {
      /* ignore */
    }
  }

  private listen(port: number, attempt: number): void {
    const srv = createServer((req, res) => {
      void this.handleHttp(req, res)
    })
    srv.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && attempt < 8) {
        this.listen(port + 1, attempt + 1)
        return
      }
      this.error = `Không mở được cổng LAN Remote: ${err.message}`
      this.listening = false
      this.broadcast()
    })
    srv.listen(port, '0.0.0.0', () => {
      this.server = srv
      this.port = port
      this.listening = true
      this.error = undefined
      this.broadcast()
    })
  }

  private isLocalhostRequest(req: IncomingMessage): boolean {
    const addr = req.socket.remoteAddress || ''
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
  }

  private checkAuth(req: IncomingMessage, urlObj: URL): boolean {
    const qToken = urlObj.searchParams.get('t') || urlObj.searchParams.get('token')
    const hToken = req.headers['x-remote-token']
    return qToken === this.token || hToken === this.token
  }

  private sendJson(res: ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload)
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Remote-Token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Cache-Control': 'no-store'
    })
    res.end(body)
  }

  private readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let raw = ''
      req.setEncoding('utf8')
      req.on('data', (chunk: string) => {
        raw += chunk
        if (raw.length > 1024 * 1024) {
          reject(new Error('Payload too large'))
          req.destroy()
        }
      })
      req.on('end', () => {
        if (!raw.trim()) return resolve({})
        try {
          resolve(JSON.parse(raw))
        } catch (e) {
          reject(e)
        }
      })
      req.on('error', reject)
    })
  }

  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
      this.sendJson(res, 200, { ok: true })
      return
    }

    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = urlObj.pathname

    if (pathname === '/api/ping') {
      if (this.isLocalhostRequest(req)) {
        this.sendJson(res, 200, { ok: true, app: 'parallax-studio-remote', ...this.getStatus() })
      } else {
        this.sendJson(res, 200, { ok: true, app: 'parallax-studio-remote', port: this.port })
      }
      return
    }

    if (pathname === '/api/regenerate-token' && req.method === 'POST' && this.isLocalhostRequest(req)) {
      this.sendJson(res, 200, { ok: true, ...this.regenerateToken() })
      return
    }

    if (!this.checkAuth(req, urlObj)) {
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<!doctype html><html><body style="background:#0b0e14;color:#f1f5f9;font-family:sans-serif;padding:32px;text-align:center">` +
          `<h3>⚠️ Mã phiên QR đã hết hạn hoặc không hợp lệ</h3>` +
          `<p style="color:#94a3b8">Vui lòng quét lại mã QR mới nhất trên màn hình Parallax Studio.</p></body></html>`
      )
      return
    }

    if (pathname === '/' || pathname === '/index.html') {
      this.markClient(req, 'connected')
      const html = renderMobileRemoteHtml(this.token)
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      })
      res.end(html)
      return
    }

    try {
      if (pathname === '/api/state' && req.method === 'GET') {
        this.markClient(req)
        const state = await this.mcpBridge.executeCommand('get_remote_state', {})
        this.sendJson(res, 200, { ok: true, state })
        return
      }

      if (pathname === '/api/action' && req.method === 'POST') {
        const body = await this.readJsonBody(req)
        const actName = typeof body.action === 'string' ? body.action : 'action'
        this.markClient(req, actName)
        const state = await this.mcpBridge.executeCommand('remote_control_action', body)
        this.sendJson(res, 200, { ok: true, state })
        return
      }

      if (pathname === '/api/preview' && req.method === 'GET') {
        this.markClient(req)
        const shot = await this.mcpBridge.executeCommand('get_viewport_screenshot', {
          width: 560,
          format: 'jpeg'
        })
        this.sendJson(res, 200, { ok: true, ...(typeof shot === 'object' && shot ? shot : {}) })
        return
      }

      this.sendJson(res, 404, { ok: false, error: 'Not found' })
    } catch (err) {
      this.sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
}
