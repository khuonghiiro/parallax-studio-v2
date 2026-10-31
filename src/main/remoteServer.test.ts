import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { request as httpsRequest } from 'https'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd()
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  }
}))

import { classifyRemoteDevice, normalizeLayoutProfile, parseRemoteCookies } from './remoteDeviceDetect'
import { buildRemoteViteClientShim, stripInlineSourceMap } from './remoteBootShim'
import { RemoteControlServer } from './remoteServer'
import type { McpBridge } from './mcpBridge'

describe('remoteDeviceDetect — Multi-Device Classification', () => {
  it('accurately classifies Phone, iPad (including iPadOS Macintosh UA + touch), Android Tablet, Laptop, and Desktop', () => {
    expect(
      classifyRemoteDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15', 390, 844, 5).kind
    ).toBe('phone')

    expect(
      classifyRemoteDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/123.0 Mobile Safari/537.36', 412, 915, 5).kind
    ).toBe('phone')

    expect(
      classifyRemoteDevice('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15', 820, 1180, 5).kind
    ).toBe('ipad')

    // iPadOS 13+ sends Macintosh UA in desktop mode with maxTouchPoints = 5
    expect(
      classifyRemoteDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15', 1024, 1366, 5).kind
    ).toBe('ipad')

    // Android Tablet (no "Mobile" token)
    expect(
      classifyRemoteDevice('Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 Chrome/123.0 Safari/537.36', 900, 1440, 5).kind
    ).toBe('tablet')

    // MacBook Laptop (Macintosh with 0 touch points, width <= 1680)
    expect(
      classifyRemoteDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0', 1440, 900, 0).kind
    ).toBe('laptop')

    // Windows Desktop (width > 1680)
    expect(
      classifyRemoteDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0', 2560, 1440, 0).kind
    ).toBe('desktop')
  })

  it('normalizes layout profiles and parses cookies reliably', () => {
    expect(normalizeLayoutProfile('phone')).toBe('phone')
    expect(normalizeLayoutProfile('mobile')).toBe('phone')
    expect(normalizeLayoutProfile('ipad')).toBe('tablet')
    expect(normalizeLayoutProfile('tablet')).toBe('tablet')
    expect(normalizeLayoutProfile('laptop')).toBe('desktop')
    expect(normalizeLayoutProfile('pad')).toBe('pad')
    expect(normalizeLayoutProfile(undefined)).toBe('auto')

    const cookies = parseRemoteCookies('foo=bar; pxs_remote_token=abc123xyz; theme=dark')
    expect(cookies.pxs_remote_token).toBe('abc123xyz')
    expect(cookies.theme).toBe('dark')
  })
})

describe('RemoteControlServer — Multi-Device Full Studio Web App & Bi-Directional Sync', () => {
  let server: RemoteControlServer | null = null
  let tempDistDir: string | null = null
  const savedDevUrl = process.env['ELECTRON_RENDERER_URL']

  afterEach(() => {
    server?.stop()
    server = null
    if (tempDistDir) {
      rmSync(tempDistDir, { recursive: true, force: true })
      tempDistDir = null
    }
    if (savedDevUrl === undefined) delete process.env['ELECTRON_RENDERER_URL']
    else process.env['ELECTRON_RENDERER_URL'] = savedDevUrl
  })

  it('serves Full Studio App HTML with injected bootstrap, enforces token auth, tracks multi-device sessions, and syncs state + binary assets', async () => {
    delete process.env['ELECTRON_RENDERER_URL']
    tempDistDir = mkdtempSync(join(tmpdir(), 'pxs-remote-dist-'))
    writeFileSync(
      join(tempDistDir, 'index.html'),
      `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'" /><title>Parallax Studio</title></head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>`,
      'utf-8'
    )

    let hostTime = 1.25
    let hostTheme: 'dark' | 'light' = 'dark'
    const hostAssets = new Map<string, { base64: string; mime: string; name: string }>()

    const fakeMcp = {
      call: vi.fn(async () => ({ ok: true }))
    } as unknown as McpBridge

    server = new RemoteControlServer(() => null, fakeMcp, {
      port: 0,
      registerIpc: false,
      rendererDistDir: tempDistDir,
      hostAdapter: async (kind, payload) => {
        if (kind === 'bootstrap') {
          return {
            project: { comp: { name: 'Remote Scene', width: 1920, height: 1080, fps: 30, duration: 10 }, shots: [], layers: [], assets: [] },
            time: hostTime,
            playing: false,
            theme: hostTheme,
            libraries: { 'pxs.layerComposites': '[]' }
          }
        }
        if (kind === 'applySync') {
          const env = payload as { time?: number; theme?: 'dark' | 'light' } | undefined
          if (typeof env?.time === 'number') hostTime = env.time
          if (env?.theme) hostTheme = env.theme
          return { applied: true }
        }
        if (kind === 'putAssetBytes') {
          const id = String(payload?.id ?? '')
          hostAssets.set(id, {
            base64: String(payload?.base64 ?? ''),
            mime: String(payload?.mime ?? 'image/png'),
            name: String(payload?.name ?? 'test.png')
          })
          return { stored: true }
        }
        if (kind === 'getAssetBytes') {
          const id = String(payload?.id ?? '')
          const found = hostAssets.get(id)
          return found ? { found: true, ...found } : { found: false }
        }
        return null
      }
    })

    const boundPort = await server.startAsync()
    expect(boundPort).toBeGreaterThan(0)
    const token = server.getStatus().token
    const baseUrl = `http://127.0.0.1:${boundPort}`

    // 1. Unauthenticated access must be rejected with 401
    const unauthResp = await fetch(`${baseUrl}/`)
    expect(unauthResp.status).toBe(401)

    // 2. Authenticated Phone request to `/` receives Full Parallax Studio Web App + Set-Cookie + __PXS_REMOTE_BOOTSTRAP__
    const phoneUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
    const appResp = await fetch(`${baseUrl}/?t=${token}&layout=phone`, {
      headers: { 'User-Agent': phoneUa }
    })
    expect(appResp.status).toBe(200)
    const setCookie = appResp.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`pxs_remote_token=${token}`)
    const html = await appResp.text()
    expect(html).toContain('window.__PXS_REMOTE_BOOTSTRAP__')
    expect(html).toContain('"layoutProfile":"phone"')
    expect(html).toContain('viewport-fit=cover')
    expect(html).toContain('id="pxs-remote-boot"')
    expect(html).toContain('crypto.randomUUID')

    // 2b. `/favicon.ico` returns 200 SVG without 404 console errors
    const favResp = await fetch(`${baseUrl}/favicon.ico`)
    expect(favResp.status).toBe(200)
    expect(favResp.headers.get('content-type')).toContain('image/svg+xml')

    // 2c. Polyglot TLS Multiplexer handles parallel HTTPS requests on the exact same port without dropping ClientHello packets
    const fetchHttpsText = (path: string): Promise<{ status: number; body: string }> =>
      new Promise((resolveReq, rejectReq) => {
        const req = httpsRequest(
          {
            hostname: '127.0.0.1',
            port: boundPort,
            path,
            method: 'GET',
            rejectUnauthorized: false,
            headers: { 'User-Agent': phoneUa }
          },
          (res) => {
            const chunks: Buffer[] = []
            res.on('data', (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
            res.on('end', () =>
              resolveReq({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') })
            )
          }
        )
        req.on('error', rejectReq)
        req.end()
      })

    const parallelTls = await Promise.all(
      Array.from({ length: 6 }, () => fetchHttpsText(`/?t=${token}&layout=phone`))
    )
    for (const item of parallelTls) {
      expect(item.status).toBe(200)
      expect(item.body).toContain('id="pxs-remote-boot"')
    }

    // 3. `/pad` serves quick Touchpad 3D mode with link back to Full Studio App
    const padResp = await fetch(`${baseUrl}/pad?t=${token}&cid=pad-preview`)
    expect(padResp.status).toBe(200)
    const padHtml = await padResp.text()
    expect(padHtml).toContain('Mở Toàn bộ App')

    // 4. `/api/remote/bootstrap` (using the injected clientId from HTML) & `/api/remote/heartbeat` register Phone + iPad simultaneously
    const injectedIdMatch = html.match(/"clientId":"([^"]+)"/)
    expect(injectedIdMatch).not.toBeNull()
    const phoneClientId = injectedIdMatch![1]!

    const bootResp = await fetch(
      `${baseUrl}/api/remote/bootstrap?t=${token}&clientId=${encodeURIComponent(phoneClientId)}&w=390&h=844&tp=5&layout=phone`,
      { headers: { 'User-Agent': phoneUa } }
    )
    expect(bootResp.status).toBe(200)
    const bootJson = (await bootResp.json()) as { ok: boolean; snapshot: { time: number } }
    expect(bootJson.ok).toBe(true)
    expect(bootJson.snapshot.time).toBe(1.25)

    const ipadDesktopUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15'
    const hbResp = await fetch(`${baseUrl}/api/remote/heartbeat?t=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ipadDesktopUa },
      body: JSON.stringify({ clientId: 'ipad-pro-1', width: 1024, height: 1366, maxTouchPoints: 5, layoutProfile: 'tablet' })
    })
    expect(hbResp.status).toBe(200)

    const statusNow = server.getStatus()
    expect(statusNow.connectedDevices).toBeGreaterThanOrEqual(2)
    const kinds = (statusNow.devices ?? []).map((d) => d.kind)
    expect(kinds).toContain('phone')
    expect(kinds).toContain('ipad')

    // 5. `/api/remote/sync` updates Host state bi-directionally
    const syncResp = await fetch(`${baseUrl}/api/remote/sync?t=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': phoneUa },
      body: JSON.stringify({
        clientId: 'iphone-1',
        time: 4.5,
        theme: 'light',
        action: 'remote-scrub'
      })
    })
    expect(syncResp.status).toBe(200)
    expect(hostTime).toBe(4.5)
    expect(hostTheme).toBe('light')

    // 6. `/api/remote/asset/:id` binary upload from mobile & download from another remote device
    const sampleBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4])
    const upResp = await fetch(`${baseUrl}/api/remote/asset/asset-mobile-1?t=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Asset-Name': encodeURIComponent('mobile-photo.png'),
        'X-Asset-Mime': 'image/png',
        'X-Asset-Kind': 'image'
      },
      body: sampleBytes
    })
    expect(upResp.status).toBe(200)

    const downResp = await fetch(`${baseUrl}/api/remote/asset/asset-mobile-1?t=${token}`)
    expect(downResp.status).toBe(200)
    expect(downResp.headers.get('content-type')).toBe('image/png')
    const downloaded = new Uint8Array(await downResp.arrayBuffer())
    expect(Array.from(downloaded)).toEqual(Array.from(sampleBytes))

    // 7. Vite client shim & inline sourcemap stripper keep dev payloads compact and valid
    const shimCode = buildRemoteViteClientShim()
    expect(shimCode).toContain('export function updateStyle')
    expect(shimCode).toContain('export function removeStyle')
    expect(shimCode).toContain('export function createHotContext')
    expect(shimCode).toContain('export function injectQuery')
    expect(shimCode).toContain('export class ErrorOverlay')

    const bloatedJs = `const x = 1;\n//# sourceMappingURL=data:application/json;base64,AAAA`
    expect(stripInlineSourceMap(bloatedJs)).toBe('const x = 1;\n')
  })
})
