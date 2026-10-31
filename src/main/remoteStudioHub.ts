import { ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron'
import type { IncomingMessage, ServerResponse } from 'http'
import { randomBytes } from 'crypto'
import type {
  RemoteBridgeRequest,
  RemoteBridgeResponse,
  RemoteConnectedDevice,
  RemoteLayoutProfile,
  RemoteSyncEnvelope
} from '@shared/ipc'
import { classifyRemoteDevice, normalizeLayoutProfile } from './remoteDeviceDetect'
import { RemoteStudioRpcService } from './remoteStudioRpc'

export type HostBridgeAdapter = (
  kind: RemoteBridgeRequest['kind'],
  payload?: Record<string, unknown>
) => Promise<unknown>

interface SseSubscriber {
  subId: string
  clientId: string
  res: ServerResponse
}

interface CachedAssetBinary {
  id: string
  name: string
  mime: string
  kind: 'image' | 'audio'
  bytes: Buffer
  updatedAt: number
}

const DEVICE_TTL_MS = 45_000
const MAX_CACHE_BYTES = 256 * 1024 * 1024

export class RemoteStudioHub {
  private devices = new Map<string, RemoteConnectedDevice>()
  private sseClients = new Set<SseSubscriber>()
  private assetCache = new Map<string, CachedAssetBinary>()
  private assetCacheBytes = 0
  private pendingHostCalls = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >()
  private rev = 1
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null
  private rpc = new RemoteStudioRpcService()
  private ipcReplyHandler: ((e: IpcMainEvent, res: RemoteBridgeResponse) => void) | null = null
  private ipcHostBroadcastHandler: ((e: IpcMainEvent, env: RemoteSyncEnvelope) => void) | null = null

  constructor(
    private getWindow: () => BrowserWindow | null,
    private onDevicesChanged: (lastAction?: string) => void,
    private customHostAdapter?: HostBridgeAdapter
  ) {
    if (!customHostAdapter && ipcMain?.on) {
      this.ipcReplyHandler = (_e, res: RemoteBridgeResponse) => {
        const pending = this.pendingHostCalls.get(res.reqId)
        if (!pending) return
        clearTimeout(pending.timer)
        this.pendingHostCalls.delete(res.reqId)
        if (res.ok) pending.resolve(res.result)
        else pending.reject(new Error(res.error || 'Host bridge error'))
      }

      this.ipcHostBroadcastHandler = (_e, env: RemoteSyncEnvelope) => {
        this.rev = Math.max(this.rev + 1, (env.rev || 0) + 1)
        this.broadcastSse('sync', { ...env, rev: this.rev, clientId: 'host' }, 'host')
      }

      ipcMain.on('remote:bridgeReply', this.ipcReplyHandler)
      ipcMain.on('remote:hostBroadcast', this.ipcHostBroadcastHandler)
    }

    this.keepAliveTimer = setInterval(() => {
      for (const sub of this.sseClients) {
        try {
          sub.res.write(': keepalive\n\n')
          const dev = this.devices.get(sub.clientId)
          if (dev) dev.lastActiveAt = Date.now()
        } catch {
          this.sseClients.delete(sub)
        }
      }
    }, 15_000)
    this.keepAliveTimer.unref?.()
  }

  dispose(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
    if (this.ipcReplyHandler && ipcMain?.removeListener) {
      ipcMain.removeListener('remote:bridgeReply', this.ipcReplyHandler)
    }
    if (this.ipcHostBroadcastHandler && ipcMain?.removeListener) {
      ipcMain.removeListener('remote:hostBroadcast', this.ipcHostBroadcastHandler)
    }
    for (const [, p] of this.pendingHostCalls) {
      clearTimeout(p.timer)
      p.reject(new Error('Remote hub stopped'))
    }
    this.pendingHostCalls.clear()
    for (const sub of this.sseClients) {
      try {
        sub.res.end()
      } catch {
        /* ignore */
      }
    }
    this.sseClients.clear()
    this.devices.clear()
    this.assetCache.clear()
    this.assetCacheBytes = 0
    this.rpc.dispose()
  }

  clearDevices(): void {
    this.devices.clear()
    for (const sub of this.sseClients) {
      try {
        sub.res.write('event: auth_expired\ndata: {}\n\n')
        sub.res.end()
      } catch {
        /* ignore */
      }
    }
    this.sseClients.clear()
  }

  getActiveDevices(): RemoteConnectedDevice[] {
    const now = Date.now()
    const activeStreamIds = new Set<string>()
    for (const sub of this.sseClients) activeStreamIds.add(sub.clientId)

    for (const [id, dev] of this.devices.entries()) {
      if (!activeStreamIds.has(id) && now - dev.lastActiveAt > DEVICE_TTL_MS) {
        this.devices.delete(id)
      }
    }
    return Array.from(this.devices.values()).sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  }

  registerOrTouchDevice(
    req: IncomingMessage,
    opts?: {
      clientId?: string
      width?: number
      height?: number
      maxTouchPoints?: number
      layoutProfile?: RemoteLayoutProfile
      action?: string
    }
  ): RemoteConnectedDevice {
    const rawIp = (req.socket?.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '')
    const ua = String(req.headers['user-agent'] || '')
    const clientId =
      opts?.clientId?.trim() ||
      String(req.headers['x-remote-client-id'] || '').trim() ||
      `dev-${Buffer.from(`${rawIp}|${ua.slice(0, 48)}`).toString('hex').slice(0, 12)}`

    const existing = this.devices.get(clientId)
    const width = opts?.width ?? existing?.width
    const height = opts?.height ?? existing?.height
    const classified = classifyRemoteDevice(ua, width, height, opts?.maxTouchPoints)
    const now = Date.now()

    const updated: RemoteConnectedDevice = {
      id: clientId,
      ip: rawIp,
      kind: classified.kind,
      label: classified.label,
      width,
      height,
      layoutProfile: opts?.layoutProfile ?? existing?.layoutProfile ?? 'auto',
      connectedAt: existing?.connectedAt ?? now,
      lastActiveAt: now,
      lastAction: opts?.action ?? existing?.lastAction
    }

    const prevCount = this.devices.size
    const kindChanged = existing?.kind !== updated.kind || existing?.layoutProfile !== updated.layoutProfile
    this.devices.set(clientId, updated)
    if (this.devices.size !== prevCount || kindChanged || opts?.action) {
      this.onDevicesChanged(opts?.action)
    }
    return updated
  }

  /** Phát sự kiện đồng bộ từ Host (trong test hoặc main process) tới toàn bộ client từ xa */
  emitHostSync(envelope: Omit<RemoteSyncEnvelope, 'rev' | 'clientId'>): number {
    this.rev++
    this.broadcastSse('sync', { ...envelope, rev: this.rev, clientId: 'host' }, 'host')
    return this.rev
  }

  private broadcastSse(event: string, data: unknown, excludeClientId?: string): void {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    for (const sub of this.sseClients) {
      if (excludeClientId && sub.clientId === excludeClientId) continue
      try {
        sub.res.write(frame)
      } catch {
        this.sseClients.delete(sub)
      }
    }
  }

  private callHost(kind: RemoteBridgeRequest['kind'], payload?: Record<string, unknown>): Promise<unknown> {
    if (this.customHostAdapter) {
      return this.customHostAdapter(kind, payload)
    }
    const win = this.getWindow()
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) {
      return Promise.reject(new Error('Host Studio window is not ready'))
    }
    const reqId = randomBytes(6).toString('hex')
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingHostCalls.delete(reqId)
        reject(new Error(`Host bridge timeout (${kind})`))
      }, 12_000)
      this.pendingHostCalls.set(reqId, { resolve, reject, timer })
      win.webContents.send('remote:bridgeCall', { reqId, kind, payload } satisfies RemoteBridgeRequest)
    })
  }

  private cacheAsset(entry: CachedAssetBinary): void {
    const old = this.assetCache.get(entry.id)
    if (old) this.assetCacheBytes -= old.bytes.byteLength
    this.assetCache.set(entry.id, entry)
    this.assetCacheBytes += entry.bytes.byteLength

    if (this.assetCacheBytes > MAX_CACHE_BYTES) {
      const sorted = Array.from(this.assetCache.values()).sort((a, b) => a.updatedAt - b.updatedAt)
      for (const item of sorted) {
        if (this.assetCacheBytes <= MAX_CACHE_BYTES * 0.75) break
        this.assetCache.delete(item.id)
        this.assetCacheBytes -= item.bytes.byteLength
      }
    }
  }

  private readRawBuffer(req: IncomingMessage, maxBytes = 64 * 1024 * 1024): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let total = 0
      req.on('data', (chunk: Buffer | string) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        total += buf.byteLength
        if (total > maxBytes) {
          reject(new Error('Payload exceeds limit'))
          req.destroy()
          return
        }
        chunks.push(buf)
      })
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
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

  async handleApiRequest(req: IncomingMessage, res: ServerResponse, urlObj: URL): Promise<boolean> {
    const pathname = urlObj.pathname

    if (pathname === '/api/remote/bootstrap' && req.method === 'GET') {
      const dev = this.registerOrTouchDevice(req, {
        clientId: urlObj.searchParams.get('clientId') || undefined,
        width: Number(urlObj.searchParams.get('w')) || undefined,
        height: Number(urlObj.searchParams.get('h')) || undefined,
        maxTouchPoints: Number(urlObj.searchParams.get('tp')) || undefined,
        layoutProfile: normalizeLayoutProfile(urlObj.searchParams.get('layout')),
        action: 'bootstrap_studio'
      })
      const snapshot = await this.callHost('bootstrap')
      this.sendJson(res, 200, { ok: true, clientId: dev.id, device: dev, rev: this.rev, snapshot })
      return true
    }

    if (pathname === '/api/remote/events' && req.method === 'GET') {
      const dev = this.registerOrTouchDevice(req, {
        clientId: urlObj.searchParams.get('clientId') || undefined,
        action: 'live_stream'
      })
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*'
      })
      res.flushHeaders?.()
      res.write(`event: connected\ndata: ${JSON.stringify({ clientId: dev.id, rev: this.rev, device: dev })}\n\n`)
      const sub: SseSubscriber = { subId: randomBytes(4).toString('hex'), clientId: dev.id, res }
      this.sseClients.add(sub)
      req.on('close', () => {
        this.sseClients.delete(sub)
        this.onDevicesChanged()
      })
      return true
    }

    if (pathname === '/api/remote/heartbeat' && req.method === 'POST') {
      const raw = await this.readRawBuffer(req, 64 * 1024)
      const body = raw.byteLength ? (JSON.parse(raw.toString('utf-8')) as Record<string, unknown>) : {}
      const dev = this.registerOrTouchDevice(req, {
        clientId: typeof body.clientId === 'string' ? body.clientId : undefined,
        width: typeof body.width === 'number' ? body.width : undefined,
        height: typeof body.height === 'number' ? body.height : undefined,
        maxTouchPoints: typeof body.maxTouchPoints === 'number' ? body.maxTouchPoints : undefined,
        layoutProfile: typeof body.layoutProfile === 'string' ? normalizeLayoutProfile(body.layoutProfile) : undefined,
        action: typeof body.action === 'string' ? body.action : undefined
      })
      this.sendJson(res, 200, { ok: true, device: dev, rev: this.rev })
      return true
    }

    if (pathname === '/api/remote/sync' && req.method === 'POST') {
      const raw = await this.readRawBuffer(req, 32 * 1024 * 1024)
      const body = JSON.parse(raw.toString('utf-8')) as RemoteSyncEnvelope
      const dev = this.registerOrTouchDevice(req, {
        clientId: body.clientId,
        action: body.action || 'studio_sync'
      })
      this.rev++
      const envelope: RemoteSyncEnvelope = { ...body, clientId: dev.id, rev: this.rev }
      await this.callHost('applySync', envelope as unknown as Record<string, unknown>)
      this.broadcastSse('sync', envelope, dev.id)
      this.sendJson(res, 200, { ok: true, rev: this.rev })
      return true
    }

    if (pathname.startsWith('/api/remote/asset/')) {
      const assetId = decodeURIComponent(pathname.slice('/api/remote/asset/'.length))
      if (!assetId) {
        this.sendJson(res, 400, { ok: false, error: 'Missing assetId' })
        return true
      }

      if (req.method === 'GET') {
        const cached = this.assetCache.get(assetId)
        if (cached) {
          res.writeHead(200, {
            'Content-Type': cached.mime,
            'Content-Length': String(cached.bytes.byteLength),
            'X-Asset-Name': encodeURIComponent(cached.name),
            'X-Asset-Kind': cached.kind,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'X-Asset-Name, X-Asset-Kind',
            'Cache-Control': 'public, max-age=300'
          })
          res.end(cached.bytes)
          return true
        }

        const hostAsset = (await this.callHost('getAssetBytes', { id: assetId })) as {
          found?: boolean
          name?: string
          mime?: string
          kind?: 'image' | 'audio'
          base64?: string
        } | null

        if (!hostAsset?.found || typeof hostAsset.base64 !== 'string') {
          this.sendJson(res, 404, { ok: false, error: `Asset ${assetId} not found` })
          return true
        }

        const bytes = Buffer.from(hostAsset.base64, 'base64')
        const entry: CachedAssetBinary = {
          id: assetId,
          name: hostAsset.name || assetId,
          mime: hostAsset.mime || 'application/octet-stream',
          kind: hostAsset.kind || 'image',
          bytes,
          updatedAt: Date.now()
        }
        this.cacheAsset(entry)
        res.writeHead(200, {
          'Content-Type': entry.mime,
          'Content-Length': String(bytes.byteLength),
          'X-Asset-Name': encodeURIComponent(entry.name),
          'X-Asset-Kind': entry.kind,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'X-Asset-Name, X-Asset-Kind',
          'Cache-Control': 'public, max-age=300'
        })
        res.end(bytes)
        return true
      }

      if (req.method === 'POST') {
        const bytes = await this.readRawBuffer(req, 64 * 1024 * 1024)
        const name = decodeURIComponent(String(req.headers['x-asset-name'] || assetId))
        const mime = String(req.headers['x-asset-mime'] || 'image/png')
        const kind = req.headers['x-asset-kind'] === 'audio' ? 'audio' : 'image'
        const width = Number(req.headers['x-asset-width']) || undefined
        const height = Number(req.headers['x-asset-height']) || undefined
        const dev = this.registerOrTouchDevice(req, { action: `upload_${kind}` })

        this.cacheAsset({ id: assetId, name, mime, kind, bytes, updatedAt: Date.now() })
        await this.callHost('putAssetBytes', {
          id: assetId,
          name,
          mime,
          kind,
          width,
          height,
          base64: bytes.toString('base64')
        })
        this.broadcastSse('asset', { id: assetId, name, mime, kind, width, height, clientId: dev.id }, dev.id)
        this.sendJson(res, 200, { ok: true, id: assetId, size: bytes.byteLength })
        return true
      }
    }

    if (pathname === '/api/remote/builtin-bytes' && req.method === 'GET') {
      await this.rpc.serveBuiltInAssetBytes(urlObj.searchParams.get('path') || '', res)
      return true
    }

    if (pathname === '/api/remote/asset3d-bytes' && req.method === 'GET') {
      await this.rpc.serveAsset3DBytes(urlObj.searchParams.get('path') || '', res)
      return true
    }

    if (pathname === '/api/remote/rpc' && req.method === 'POST') {
      const raw = await this.readRawBuffer(req, 32 * 1024 * 1024)
      const body = JSON.parse(raw.toString('utf-8')) as { method?: string; params?: Record<string, unknown> }
      const method = String(body.method || '')
      this.registerOrTouchDevice(req, { action: method })
      const result = await this.rpc.executeRpc(method, body.params || {})
      this.sendJson(res, 200, { ok: true, result })
      return true
    }

    if (pathname === '/api/remote/export-frame' && req.method === 'POST') {
      const frame = await this.readRawBuffer(req, 64 * 1024 * 1024)
      await this.rpc.writeExportFrame(frame)
      this.sendJson(res, 200, { ok: true })
      return true
    }

    if (pathname === '/api/remote/export-download' && req.method === 'GET') {
      await this.rpc.streamExportDownload(urlObj.searchParams.get('id') || '', res)
      return true
    }

    return false
  }
}
