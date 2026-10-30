import { ipcMain, type BrowserWindow } from 'electron'
import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'http'
import { createServer as createHttpsServer, type Server as HttpsServer } from 'https'
import { createConnection, createServer as createNetServer, type Server as NetServer, type Socket } from 'net'
import { networkInterfaces } from 'os'
import { randomBytes } from 'crypto'
import type { RemoteServerStatus } from '@shared/ipc'
import type { McpBridge } from './mcpBridge'
import { renderMobileRemoteHtml } from './remoteWebUi'
import { generateSelfSignedCert } from './selfSignedCert'

const DEFAULT_REMOTE_PORT = 9878
const DEVICE_TTL_MS = 15_000

const VIRTUAL_IFACE_PATTERN = /vethernet|wsl|docker|vmware|virtualbox|vbox|hyper-v|loopback|tailscale|zerotier/i

/**
 * Thu thập danh sách địa chỉ IPv4 mạng nội bộ (Wi-Fi / LAN), ưu tiên card Wi-Fi & Ethernet vật lý.
 */
export function detectLanIpv4Addresses(): string[] {
  const nets = networkInterfaces()
  const wifiPreferred: string[] = []
  const primary: string[] = []
  const secondary: string[] = []

  for (const [name, list] of Object.entries(nets)) {
    if (!list) continue
    const isVirtual = VIRTUAL_IFACE_PATTERN.test(name)
    const isWifi = /wi-?fi|wlan|wireless/i.test(name)
    const isEth = /ethernet|en\d|eth\d/i.test(name)

    for (const info of list) {
      const fam = String(info.family)
      if ((fam !== 'IPv4' && fam !== '4') || info.internal) continue
      const addr = info.address
      if (!addr || addr.startsWith('169.254.')) continue

      const isHostOnlyGateway = addr.startsWith('192.168.56.') || addr.endsWith('.1')
      if (!isVirtual && isWifi && !isHostOnlyGateway) {
        wifiPreferred.push(addr)
      } else if (!isVirtual && !isHostOnlyGateway && (isEth || addr.startsWith('192.168.') || addr.startsWith('10.'))) {
        primary.push(addr)
      } else {
        secondary.push(addr)
      }
    }
  }

  const all = Array.from(new Set([...wifiPreferred, ...primary, ...secondary]))
  return all.length > 0 ? all : ['127.0.0.1']
}

export class RemoteControlServer {
  private netServer: NetServer | null = null
  private httpServer: HttpServer | null = null
  private httpsServer: HttpsServer | null = null
  private port = Number(process.env.PARALLAX_REMOTE_PORT) || DEFAULT_REMOTE_PORT
  private listening = false
  private token = randomBytes(4).toString('hex')
  private activeClients = new Map<string, number>()
  private lastActiveAt: number | null = null
  private lastAction: string | null = null
  private error?: string
  /** Cache TLS cert/key — tạo một lần duy nhất, tránh block Main Process nhiều lần */
  private cachedCert: { key: string; cert: string } | null = null

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
    this.netServer?.close()
    this.httpServer?.close()
    this.httpsServer?.close()
    this.netServer = null
    this.httpServer = null
    this.httpsServer = null
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
    const urls = ips.map((ip) => `https://${ip}:${this.port}/?t=${this.token}`)
    return {
      listening: this.listening,
      port: this.port,
      ips,
      primaryIp,
      token: this.token,
      url: urls[0] ?? `https://127.0.0.1:${this.port}/?t=${this.token}`,
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

  /**
   * Lắng nghe đồng thời cả giao thức HTTP và HTTPS (TLS tự ký) trên cùng 1 cổng TCP (Polyglot Multiplexer).
   * Nhờ đó điện thoại bật chế độ "HTTPS-Only" trên trình duyệt hoặc phần mềm quét QR đều kết nối được.
   */
  private listen(port: number, attempt: number): void {
    const handler = (req: IncomingMessage, res: ServerResponse): void => {
      void this.handleHttp(req, res)
    }

    const httpSrv = createHttpServer(handler)
    let httpsSrv: HttpsServer | null = null
    try {
      const ips = detectLanIpv4Addresses()
      // Dùng cert đã cache — ECDSA P-256 tạo 1 lần duy nhất (~1ms), không block Main Process
      if (!this.cachedCert) {
        this.cachedCert = generateSelfSignedCert(ips)
      }
      httpsSrv = createHttpsServer({ key: this.cachedCert.key, cert: this.cachedCert.cert }, handler)
      httpsSrv.listen(0, '127.0.0.1')
    } catch {
      httpsSrv = null
    }

    const netSrv = createNetServer((socket: Socket) => {
      socket.once('data', (chunk: Buffer) => {
        socket.pause()
        const httpsAddr = httpsSrv?.address()
        const httpsPort = typeof httpsAddr === 'object' && httpsAddr ? httpsAddr.port : 0
        // Byte đầu tiên 0x16 (22) là bản tin TLS Handshake (ClientHello -> HTTPS)
        if (chunk[0] === 0x16 && httpsPort > 0) {
          const tlsConn = createConnection({ host: '127.0.0.1', port: httpsPort }, () => {
            tlsConn.write(chunk)
            socket.pipe(tlsConn).pipe(socket)
            socket.resume()
          })
          tlsConn.on('error', () => socket.destroy())
          socket.on('error', () => tlsConn.destroy())
        } else {
          socket.unshift(chunk)
          httpSrv.emit('connection', socket)
          socket.resume()
        }
      })
      socket.on('error', () => {
        /* ignore abrupt client socket close */
      })
    })

    netSrv.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && attempt < 8) {
        this.listen(port + 1, attempt + 1)
        return
      }
      this.error = `Không mở được cổng LAN Remote: ${err.message}`
      this.listening = false
      this.broadcast()
    })

    netSrv.listen(port, '0.0.0.0', () => {
      this.netServer = netSrv
      this.httpServer = httpSrv
      this.httpsServer = httpsSrv
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
      'Access-Control-Allow-Private-Network': 'true',
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

    if (pathname === '/' || pathname === '/index.html') {
      this.markClient(req, 'connected')
      const html = renderMobileRemoteHtml(this.token)
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Private-Network': 'true',
        'Cache-Control': 'no-store'
      })
      res.end(html)
      return
    }

    if (!this.checkAuth(req, urlObj)) {
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        `<!doctype html><html><body style="background:#0b0e14;color:#f1f5f9;font-family:sans-serif;padding:32px;text-align:center">` +
          `<h3>⚠️ Mã phiên QR đã hết hạn hoặc không hợp lệ</h3>` +
          `<p style="color:#94a3b8">Vui lòng tải lại trang hoặc quét lại mã QR mới nhất trên màn hình Parallax Studio.</p></body></html>`
      )
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
        const actionName = typeof body.action === 'string' ? body.action : 'action'
        this.markClient(req, actionName)
        const state = await this.mcpBridge.executeCommand('remote_control_action', body)
        this.sendJson(res, 200, { ok: true, state })
        return
      }

      if (pathname === '/api/preview' && req.method === 'GET') {
        this.markClient(req)
        const shot = (await this.mcpBridge.executeCommand('get_viewport_screenshot', {
          view: 'camera',
          width: 480,
          format: 'jpeg',
          quality: 0.72
        })) as { mime?: string; data?: string }
        this.sendJson(res, 200, {
          ok: true,
          mime: shot?.mime || 'image/jpeg',
          data: shot?.data || ''
        })
        return
      }

      this.sendJson(res, 404, { ok: false, error: 'Not found' })
    } catch (err) {
      this.sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
}
