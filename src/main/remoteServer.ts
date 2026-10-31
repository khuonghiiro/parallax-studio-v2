import { ipcMain, type BrowserWindow } from 'electron'
import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'http'
import { createServer as createHttpsServer, type Server as HttpsServer } from 'https'
import { createServer as createNetServer, type Server as NetServer, type Socket } from 'net'
import { networkInterfaces } from 'os'
import { randomBytes } from 'crypto'
import type { RemoteServerStatus } from '@shared/ipc'
import type { McpBridge } from './mcpBridge'
import { renderMobileRemoteHtml } from './remoteWebUi'
import { generateSelfSignedCert } from './selfSignedCert'
import { normalizeLayoutProfile, parseRemoteCookies } from './remoteDeviceDetect'
import {
  forwardRemoteWsUpgrade,
  isFrontendAssetPath,
  serveRemoteStudioFrontend,
  type RemoteBootstrapPayload
} from './remoteFrontendProxy'
import { RemoteStudioHub, type HostBridgeAdapter } from './remoteStudioHub'

const DEFAULT_REMOTE_PORT = 9878

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

export interface RemoteControlServerOptions {
  port?: number
  registerIpc?: boolean
  rendererDistDir?: string
  hostAdapter?: HostBridgeAdapter
}

export class RemoteControlServer {
  private netServer: NetServer | null = null
  private httpServer: HttpServer | null = null
  private httpsServer: HttpsServer | null = null
  private port: number
  private listening = false
  private token = randomBytes(4).toString('hex')
  private lastActiveAt: number | null = null
  private lastAction: string | null = null
  private error?: string
  private cachedCert: { key: string; cert: string; ipsKey: string } | null = null
  readonly hub: RemoteStudioHub

  constructor(
    private getWindow: () => BrowserWindow | null,
    private mcpBridge: McpBridge,
    private opts?: RemoteControlServerOptions
  ) {
    this.port =
      opts?.port !== undefined
        ? opts.port
        : Number(process.env.PARALLAX_REMOTE_PORT) || DEFAULT_REMOTE_PORT

    this.hub = new RemoteStudioHub(
      getWindow,
      (action) => {
        this.lastActiveAt = Date.now()
        if (action) this.lastAction = action
        this.broadcast()
      },
      opts?.hostAdapter
    )

    if (opts?.registerIpc !== false && ipcMain?.handle) {
      ipcMain.removeHandler?.('remote:status')
      ipcMain.removeHandler?.('remote:toggle')
      ipcMain.removeHandler?.('remote:regenerateToken')
      ipcMain.handle('remote:status', () => this.getStatus())
      ipcMain.handle('remote:toggle', (_e, enable?: boolean) => this.toggle(enable))
      ipcMain.handle('remote:regenerateToken', () => this.regenerateToken())
    }
  }

  start(): void {
    if (this.listening) return
    void this.listen(this.port, 0)
  }

  startAsync(): Promise<number> {
    if (this.listening) return Promise.resolve(this.port)
    return this.listen(this.port, 0)
  }

  stop(): void {
    this.netServer?.close()
    this.httpServer?.close()
    this.httpsServer?.close()
    this.netServer = null
    this.httpServer = null
    this.httpsServer = null
    this.listening = false
    this.hub.dispose()
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
    this.hub.clearDevices()
    this.broadcast()
    return this.getStatus()
  }

  getStatus(): RemoteServerStatus {
    const devices = this.hub.getActiveDevices()
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
      connectedDevices: devices.length,
      devices,
      lastActiveAt: this.lastActiveAt,
      lastAction: this.lastAction,
      error: this.error
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
   */
  private listen(port: number, attempt: number): Promise<number> {
    return new Promise((resolve) => {
      const handler = (req: IncomingMessage, res: ServerResponse): void => {
        void this.handleHttp(req, res)
      }

      const httpSrv = createHttpServer(handler)
      httpSrv.on('upgrade', forwardRemoteWsUpgrade)

      let httpsSrv: HttpsServer | null = null
      try {
        const ips = detectLanIpv4Addresses()
        const ipsKey = ips.join(',')
        if (!this.cachedCert || this.cachedCert.ipsKey !== ipsKey) {
          this.cachedCert = { ...generateSelfSignedCert(ips), ipsKey }
        }
        httpsSrv = createHttpsServer({ key: this.cachedCert.key, cert: this.cachedCert.cert }, handler)
        httpsSrv.on('upgrade', forwardRemoteWsUpgrade)
      } catch {
        httpsSrv = null
      }

      // Multiplexer không mất gói tin (pauseOnConnect): đọc byte đầu tiên (0x16 = TLS Handshake) rồi đẩy trực tiếp vào
      // httpsSrv hoặc httpSrv ngay trong tiến trình, không qua socket trung gian và giữ nguyên IP LAN thật của điện thoại.
      const netSrv = createNetServer({ pauseOnConnect: true }, (socket: Socket) => {
        socket.on('error', () => undefined)
        const onReadable = (): void => {
          const first = socket.read(1) as Buffer | null
          if (!first) {
            if (socket.readableEnded || socket.destroyed) return
            socket.once('readable', onReadable)
            return
          }
          socket.unshift(first)
          if (first[0] === 0x16 && httpsSrv) {
            httpsSrv.emit('connection', socket)
          } else {
            httpSrv.emit('connection', socket)
          }
          socket.resume()
        }
        socket.once('readable', onReadable)
      })

      netSrv.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && port > 0 && attempt < 8) {
          resolve(this.listen(port + 1, attempt + 1))
          return
        }
        this.error = `Không mở được cổng LAN Remote: ${err.message}`
        this.listening = false
        this.broadcast()
        resolve(this.port)
      })

      netSrv.listen(port, '0.0.0.0', () => {
        const addr = netSrv.address()
        const boundPort = typeof addr === 'object' && addr ? addr.port : port
        this.netServer = netSrv
        this.httpServer = httpSrv
        this.httpsServer = httpsSrv
        this.port = boundPort
        this.listening = true
        this.error = undefined
        this.broadcast()
        resolve(boundPort)
      })
    })
  }

  private isLocalhostRequest(req: IncomingMessage): boolean {
    const addr = req.socket.remoteAddress || ''
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
  }

  private checkAuth(req: IncomingMessage, urlObj: URL): boolean {
    const qToken = urlObj.searchParams.get('t') || urlObj.searchParams.get('token')
    const hToken = req.headers['x-remote-token']
    if (qToken === this.token || hToken === this.token) return true
    const cookies = parseRemoteCookies(req.headers.cookie)
    return cookies['pxs_remote_token'] === this.token
  }

  private checkStaticBundleAccess(req: IncomingMessage, urlObj: URL): boolean {
    if (this.checkAuth(req, urlObj)) return true
    const referer = String(req.headers.referer || '')
    if (referer.includes(`t=${this.token}`) || referer.includes(`token=${this.token}`)) return true
    // Các tệp bundle JS/CSS/Font tĩnh không chứa dữ liệu dự án (dữ liệu nằm sau /api/* có checkAuth chặt chẽ),
    // cho phép tải để hỗ trợ WebView in-app (Zalo / Camera iOS) chặn cookie bên thứ ba trên ES Module import.
    return true
  }

  private sendUnauthorizedHtml(res: ServerResponse): void {
    res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(
      `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>` +
        `<body style="background:#0b0e14;color:#f1f5f9;font-family:system-ui,sans-serif;padding:32px;text-align:center">` +
        `<h3>⚠️ Mã phiên QR đã hết hạn hoặc không hợp lệ</h3>` +
        `<p style="color:#94a3b8;max-width:420px;margin:10px auto">Vui lòng mở hộp thoại <b>Remote QR</b> trên màn hình Parallax Studio và quét lại mã QR mới nhất.</p>` +
        `</body></html>`
    )
  }

  private sendJson(res: ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload)
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, X-Remote-Token, X-Remote-Client-Id, X-Asset-Name, X-Asset-Mime, X-Asset-Kind, X-Asset-Width, X-Asset-Height',
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
        if (raw.length > 2 * 1024 * 1024) {
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
      if (this.isLocalhostRequest(req) || this.checkAuth(req, urlObj)) {
        this.sendJson(res, 200, { ok: true, app: 'parallax-studio-remote', ...this.getStatus() })
      } else {
        this.sendJson(res, 200, { ok: true, app: 'parallax-studio-remote', port: this.port })
      }
      return
    }

    if (pathname === '/api/regenerate-token' && req.method === 'POST' && (this.isLocalhostRequest(req) || this.checkAuth(req, urlObj))) {
      this.sendJson(res, 200, { ok: true, ...this.regenerateToken() })
      return
    }

    // 1. Phục vụ tệp tĩnh JS/CSS/Fonts/Modules của Full Studio Web App
    if (!pathname.startsWith('/api/') && pathname !== '/' && pathname !== '/index.html' && pathname !== '/pad') {
      if (isFrontendAssetPath(pathname) && this.checkStaticBundleAccess(req, urlObj)) {
        const dev = this.hub.registerOrTouchDevice(req)
        const served = await serveRemoteStudioFrontend(
          req,
          res,
          urlObj,
          {
            token: this.token,
            clientId: dev.id,
            deviceKind: dev.kind,
            deviceLabel: dev.label,
            layoutProfile: dev.layoutProfile ?? 'auto',
            serverPort: this.port
          },
          {},
          this.opts?.rendererDistDir
        )
        if (served) return
      }
    }

    // 2. Mọi truy cập trang gốc (`/`, `/pad`) và `/api/*` đều bắt buộc xác thực Token / Cookie phiên QR
    if (!this.checkAuth(req, urlObj)) {
      if (pathname.startsWith('/api/')) {
        this.sendJson(res, 401, { ok: false, error: 'Unauthorized or expired QR token' })
      } else {
        this.sendUnauthorizedHtml(res)
      }
      return
    }

    const cookieHeader = `pxs_remote_token=${encodeURIComponent(this.token)}; Path=/; SameSite=Lax; Max-Age=86400`

    // 3. Trang Touchpad 3D Nhanh tùy chọn (`/pad` hoặc `/?mode=pad` hoặc `/?layout=pad`)
    const requestedLayout = normalizeLayoutProfile(
      urlObj.searchParams.get('layout') || urlObj.searchParams.get('mode')
    )
    if (pathname === '/pad' || ((pathname === '/' || pathname === '/index.html') && requestedLayout === 'pad')) {
      this.hub.registerOrTouchDevice(req, { layoutProfile: 'pad', action: 'open_touchpad' })
      const html = renderMobileRemoteHtml(this.token)
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': cookieHeader,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Private-Network': 'true',
        'Cache-Control': 'no-store'
      })
      res.end(html)
      return
    }

    // 4. Trang gốc `/` -> Phục vụ TOÀN BỘ ỨNG DỤNG PARALLAX STUDIO tự động thích ứng Điện thoại / iPad / Tablet / Laptop / Desktop!
    if (pathname === '/' || pathname === '/index.html') {
      const dev = this.hub.registerOrTouchDevice(req, {
        layoutProfile: requestedLayout,
        action: 'open_full_studio'
      })
      const bootstrap: RemoteBootstrapPayload = {
        token: this.token,
        clientId: dev.id,
        deviceKind: dev.kind,
        deviceLabel: dev.label,
        layoutProfile: requestedLayout,
        serverPort: this.port
      }
      const served = await serveRemoteStudioFrontend(
        req,
        res,
        urlObj,
        bootstrap,
        { 'Set-Cookie': cookieHeader },
        this.opts?.rendererDistDir
      )
      if (!served) {
        // Fallback an toàn nếu thư mục dist chưa build trong môi trường tối giản
        const html = renderMobileRemoteHtml(this.token)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookieHeader })
        res.end(html)
      }
      return
    }

    // 5. Các API đồng bộ Full Studio đa thiết bị (`/api/remote/*`)
    try {
      if (pathname === '/api/remote/status' && req.method === 'GET') {
        this.sendJson(res, 200, { ok: true, ...this.getStatus() })
        return
      }

      if (pathname.startsWith('/api/remote/')) {
        const handled = await this.hub.handleApiRequest(req, res, urlObj)
        if (handled) return
      }

      // 6. Các API Touchpad 3D Nhanh tương thích ngược (`/api/state`, `/api/action`, `/api/preview`)
      if (pathname === '/api/state' && req.method === 'GET') {
        this.hub.registerOrTouchDevice(req)
        const state = await this.mcpBridge.executeCommand('get_remote_state', {})
        this.sendJson(res, 200, { ok: true, state })
        return
      }

      if (pathname === '/api/action' && req.method === 'POST') {
        const body = await this.readJsonBody(req)
        const actionName = typeof body.action === 'string' ? body.action : 'action'
        this.hub.registerOrTouchDevice(req, { action: actionName })
        const state = await this.mcpBridge.executeCommand('remote_control_action', body)
        this.sendJson(res, 200, { ok: true, state })
        return
      }

      if (pathname === '/api/preview' && req.method === 'GET') {
        this.hub.registerOrTouchDevice(req)
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
