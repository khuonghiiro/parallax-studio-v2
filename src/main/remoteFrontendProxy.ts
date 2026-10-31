import { request as httpRequest, type IncomingMessage, type OutgoingHttpHeaders, type ServerResponse } from 'http'
import { createConnection, type Socket } from 'net'
import { existsSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import { extname, join, normalize, resolve } from 'path'
import type { RemoteDeviceKind, RemoteLayoutProfile } from '@shared/ipc'

export interface RemoteBootstrapPayload {
  token: string
  clientId: string
  deviceKind: RemoteDeviceKind
  deviceLabel: string
  layoutProfile: RemoteLayoutProfile
  serverPort: number
}

const STATIC_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4'
}

const REMOTE_CSP =
  "default-src 'self' data: blob: http: https:; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: http: https:; " +
  "media-src 'self' data: blob: http: https:; " +
  "font-src 'self' data:; " +
  "connect-src 'self' data: blob: http: https: ws: wss:; " +
  "worker-src 'self' blob:;"

/**
 * Biến đổi index.html gốc của Parallax Studio để chạy mượt như App Native trên Điện thoại, iPad, Tablet, Laptop qua mạng LAN.
 */
export function transformRemoteIndexHtml(rawHtml: string, bootstrap: RemoteBootstrapPayload): string {
  let html = rawHtml

  // Nới CSP để cho phép kết nối tới IP LAN (192.168.x.x / 10.x.x.x), WebSocket HMR và Blob/Worker WebGL
  if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
    html = html.replace(
      /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i,
      `<meta http-equiv="Content-Security-Policy" content="${REMOTE_CSP}" />`
    )
  }

  // Nâng cấp thẻ viewport chuẩn Mobile/iPad App (chống double-tap zoom lệch canvas, hỗ trợ tai thỏ safe-area)
  const mobileMeta =
    `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />\n` +
    `    <meta name="apple-mobile-web-app-capable" content="yes" />\n` +
    `    <meta name="mobile-web-app-capable" content="yes" />\n` +
    `    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n` +
    `    <meta name="theme-color" content="#0b0d12" />`

  if (/<meta\s+name=["']viewport["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name=["']viewport["'][^>]*>/i, mobileMeta)
  } else {
    html = html.replace('<head>', `<head>\n    ${mobileMeta}`)
  }

  const safeJson = JSON.stringify(bootstrap).replace(/</g, '\\u003c')
  const bootstrapScript =
    `    <script>window.__PXS_REMOTE_BOOTSTRAP__ = ${safeJson};</script>\n`

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${bootstrapScript}  </head>`)
  } else {
    html = `${bootstrapScript}${html}`
  }

  return html
}

/**
 * Sửa biến `directSocketHost` của `/@vite/client` để trình duyệt trên Điện thoại / iPad kết nối WebSocket HMR
 * qua đúng IP:Port & giao thức (ws/wss) của Remote Server thay vì `ws://localhost:5173` (tránh lỗi Mixed Content).
 */
export function rewriteViteClientScript(code: string): string {
  return code.replace(
    /const directSocketHost\s*=\s*["'][^"']*["'];?/,
    'const directSocketHost = `${importMetaUrl.host}/`;'
  )
}

function resolveDevUpstream(): { hostname: string; port: number; hostHeader: string } | null {
  const raw = process.env['ELECTRON_RENDERER_URL']
  if (!raw) return null
  try {
    const u = new URL(raw)
    const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80)
    return { hostname: u.hostname || 'localhost', port, hostHeader: u.host }
  } catch {
    return null
  }
}

/**
 * Kiểm tra xem đường dẫn có phải tài nguyên mã nguồn / bundle tĩnh mà trình duyệt nạp sau index.html hay không.
 */
export function isFrontendAssetPath(pathname: string): boolean {
  if (pathname === '/favicon.ico' || pathname === '/manifest.webmanifest') return true
  if (
    pathname.startsWith('/src/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/@vite/') ||
    pathname.startsWith('/@fs/') ||
    pathname.startsWith('/@id/') ||
    pathname.startsWith('/@react-refresh') ||
    pathname.startsWith('/node_modules/')
  ) {
    return true
  }
  const ext = extname(pathname).toLowerCase()
  return Boolean(ext && STATIC_MIME[ext] && !pathname.startsWith('/api/'))
}

/**
 * Phục vụ toàn bộ giao diện Parallax Studio (Dev Vite Proxy hoặc Production Dist) tới mọi thiết bị từ xa.
 */
export async function serveRemoteStudioFrontend(
  req: IncomingMessage,
  res: ServerResponse,
  urlObj: URL,
  bootstrap: RemoteBootstrapPayload,
  extraHeaders: Record<string, string> = {},
  customDistDir?: string
): Promise<boolean> {
  const devUpstream = customDistDir ? null : resolveDevUpstream()
  if (devUpstream) {
    return proxyDevRenderer(req, res, urlObj, devUpstream, bootstrap, extraHeaders)
  }

  const distRoot = resolve(customDistDir || join(__dirname, '../renderer'))
  return serveBuiltRenderer(res, urlObj.pathname, distRoot, bootstrap, extraHeaders)
}

function proxyDevRenderer(
  req: IncomingMessage,
  res: ServerResponse,
  urlObj: URL,
  upstream: { hostname: string; port: number; hostHeader: string },
  bootstrap: RemoteBootstrapPayload,
  extraHeaders: Record<string, string>
): Promise<boolean> {
  return new Promise((resolveDone) => {
    const isIndex = urlObj.pathname === '/' || urlObj.pathname === '/index.html'
    const isViteClient = urlObj.pathname === '/@vite/client'
    const forwardPath = isIndex ? '/index.html' : urlObj.pathname + urlObj.search

    const headers: Record<string, string | string[] | undefined> = {
      ...req.headers,
      host: upstream.hostHeader
    }
    if (isIndex || isViteClient) {
      // Tắt nén gzip trên upstream cho 2 tệp text nhỏ cần biến đổi nội dung trực tiếp
      delete headers['accept-encoding']
    }

    const proxyReq = httpRequest(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        method: req.method || 'GET',
        path: forwardPath,
        headers
      },
      (proxyRes) => {
        const status = proxyRes.statusCode || 200
        if ((isIndex || isViteClient) && status === 200) {
          const chunks: Buffer[] = []
          proxyRes.on('data', (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
          proxyRes.on('end', () => {
            const rawText = Buffer.concat(chunks).toString('utf-8')
            const outText = isIndex
              ? transformRemoteIndexHtml(rawText, bootstrap)
              : rewriteViteClientScript(rawText)
            const outBuf = Buffer.from(outText, 'utf-8')
            res.writeHead(200, {
              'Content-Type': isIndex ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8',
              'Content-Length': String(outBuf.byteLength),
              'Cache-Control': 'no-store',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Private-Network': 'true',
              ...extraHeaders
            })
            res.end(outBuf)
            resolveDone(true)
          })
          return
        }

        const resHeaders: OutgoingHttpHeaders = {}
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (v !== undefined) resHeaders[k] = v
        }
        resHeaders['Access-Control-Allow-Origin'] = '*'
        resHeaders['Access-Control-Allow-Private-Network'] = 'true'
        for (const [k, v] of Object.entries(extraHeaders)) resHeaders[k] = v

        res.writeHead(status, resHeaders)
        proxyRes.pipe(res)
        proxyRes.on('end', () => resolveDone(true))
      }
    )

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      }
      res.end(`Remote Dev Proxy Error: ${err.message}`)
      resolveDone(true)
    })

    req.pipe(proxyReq)
  })
}

async function serveBuiltRenderer(
  res: ServerResponse,
  pathname: string,
  distRoot: string,
  bootstrap: RemoteBootstrapPayload,
  extraHeaders: Record<string, string>
): Promise<boolean> {
  const cleanRel = pathname === '/' ? 'index.html' : normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '')
  let candidate = resolve(distRoot, cleanRel)

  if (!candidate.startsWith(distRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return true
  }

  let isIndex = cleanRel === 'index.html'
  if (!existsSync(candidate) || !(await stat(candidate)).isFile()) {
    // SPA Fallback về index.html nếu không phải file tĩnh có đuôi mở rộng
    if (!extname(cleanRel)) {
      candidate = resolve(distRoot, 'index.html')
      isIndex = true
    } else {
      return false
    }
  }

  if (!existsSync(candidate)) return false

  if (isIndex) {
    const rawHtml = await readFile(candidate, 'utf-8')
    const outHtml = transformRemoteIndexHtml(rawHtml, bootstrap)
    const buf = Buffer.from(outHtml, 'utf-8')
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': String(buf.byteLength),
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true',
      ...extraHeaders
    })
    res.end(buf)
    return true
  }

  const ext = extname(candidate).toLowerCase()
  const mime = STATIC_MIME[ext] || 'application/octet-stream'
  const buf = await readFile(candidate)
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': String(buf.byteLength),
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Private-Network': 'true',
    ...extraHeaders
  })
  res.end(buf)
  return true
}

/**
 * Chuyển tiếp kết nối WebSocket (Vite HMR) từ trình duyệt Điện thoại / iPad / Laptop về Vite Dev Server nội bộ.
 */
export function forwardRemoteWsUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void {
  const devUpstream = resolveDevUpstream()
  if (!devUpstream) {
    socket.destroy()
    return
  }

  const upstream = createConnection({ host: devUpstream.hostname, port: devUpstream.port }, () => {
    const rawUrl = req.url || '/'
    let headerLines = `${req.method || 'GET'} ${rawUrl} HTTP/${req.httpVersion}\r\n`
    for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) {
      const k = req.rawHeaders[i]
      const v = k.toLowerCase() === 'host' ? devUpstream.hostHeader : req.rawHeaders[i + 1]
      headerLines += `${k}: ${v}\r\n`
    }
    headerLines += '\r\n'
    upstream.write(headerLines)
    if (head && head.length > 0) upstream.write(head)
    socket.pipe(upstream).pipe(socket)
  })

  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
}
