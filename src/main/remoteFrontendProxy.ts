import {
  Agent as HttpAgent,
  request as httpRequest,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type ServerResponse
} from 'http'
import { createConnection, type Socket } from 'net'
import { existsSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import { extname, join, normalize, resolve } from 'path'
import { gzip as gzipCallback } from 'zlib'
import { promisify } from 'util'
import type { RemoteDeviceKind, RemoteLayoutProfile } from '@shared/ipc'
import {
  REMOTE_FAVICON_SVG,
  buildRemoteBootHeadScript,
  buildRemoteBootSplashHtml,
  buildRemoteViteClientShim,
  stripInlineSourceMap
} from './remoteBootShim'

const gzipAsync = promisify(gzipCallback)

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

const devKeepAliveAgent = new HttpAgent({ keepAlive: true, maxSockets: 64 })
const resolvedUpstreamHostCache = new Map<string, string>()

async function resolveFastLoopbackHost(hostname: string, port: number): Promise<string> {
  if (hostname !== 'localhost') return hostname
  const cacheKey = `${hostname}:${port}`
  const cached = resolvedUpstreamHostCache.get(cacheKey)
  if (cached) return cached

  const probe = (candidate: string): Promise<string> =>
    new Promise((resolveHost, rejectHost) => {
      const sock = createConnection({ host: candidate, port })
      const timer = setTimeout(() => {
        sock.destroy()
        rejectHost(new Error('timeout'))
      }, 180)
      sock.once('connect', () => {
        clearTimeout(timer)
        sock.destroy()
        resolveHost(candidate)
      })
      sock.once('error', (err) => {
        clearTimeout(timer)
        sock.destroy()
        rejectHost(err)
      })
    })

  try {
    const winner = await Promise.any([probe('::1'), probe('127.0.0.1')])
    resolvedUpstreamHostCache.set(cacheKey, winner)
    return winner
  } catch {
    return hostname
  }
}

function clientAcceptsGzip(req: IncomingMessage): boolean {
  const enc = String(req.headers['accept-encoding'] || '')
  return /\bgzip\b/i.test(enc)
}

function isCompressibleMime(contentType: string): boolean {
  return /javascript|text\/css|text\/html|application\/json|image\/svg\+xml/i.test(contentType)
}

function isImmutableVendorPath(pathname: string): boolean {
  return (
    pathname.includes('/node_modules/.vite/') ||
    pathname.includes('/node_modules/@fontsource/') ||
    /\.(woff2|woff|ttf|otf)$/i.test(pathname)
  )
}

async function sendBufferWithOptionalGzip(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  buf: Buffer,
  contentType: string,
  cacheControl: string,
  extraHeaders: Record<string, string>
): Promise<void> {
  let payload = buf
  const headers: OutgoingHttpHeaders = {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Private-Network': 'true',
    ...extraHeaders
  }

  if (buf.byteLength >= 512 && isCompressibleMime(contentType) && clientAcceptsGzip(req)) {
    try {
      payload = await gzipAsync(buf, { level: 4 })
      headers['Content-Encoding'] = 'gzip'
      headers['Vary'] = 'Accept-Encoding'
    } catch {
      payload = buf
    }
  }

  headers['Content-Length'] = String(payload.byteLength)
  res.writeHead(status, headers)
  res.end(payload)
}

/**
 * Biến đổi index.html gốc của Parallax Studio để chạy mượt như App Native trên Điện thoại, iPad, Tablet, Laptop qua mạng LAN.
 */
export function transformRemoteIndexHtml(rawHtml: string, bootstrap: RemoteBootstrapPayload): string {
  let html = rawHtml

  if (/http-equiv=["']Content-Security-Policy["']/i.test(html)) {
    html = html.replace(
      /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i,
      `<meta http-equiv="Content-Security-Policy" content="${REMOTE_CSP}" />`
    )
  }

  const mobileMeta =
    `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />\n` +
    `    <meta name="apple-mobile-web-app-capable" content="yes" />\n` +
    `    <meta name="mobile-web-app-capable" content="yes" />\n` +
    `    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n` +
    `    <meta name="theme-color" content="#0b0e14" />`

  if (/<meta\s+name=["']viewport["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name=["']viewport["'][^>]*>/i, mobileMeta)
  } else {
    html = html.replace('<head>', `<head>\n    ${mobileMeta}`)
  }

  const bootstrapScript = buildRemoteBootHeadScript(bootstrap)
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${bootstrapScript}  </head>`)
  } else {
    html = `${bootstrapScript}${html}`
  }

  const bootSplash = buildRemoteBootSplashHtml()
  if (html.includes('<div id="root"></div>')) {
    html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${bootSplash}`)
  }

  return html
}

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

export async function serveRemoteStudioFrontend(
  req: IncomingMessage,
  res: ServerResponse,
  urlObj: URL,
  bootstrap: RemoteBootstrapPayload,
  extraHeaders: Record<string, string> = {},
  customDistDir?: string
): Promise<boolean> {
  if (urlObj.pathname === '/favicon.ico') {
    const svgBuf = Buffer.from(REMOTE_FAVICON_SVG, 'utf-8')
    await sendBufferWithOptionalGzip(req, res, 200, svgBuf, 'image/svg+xml', 'public, max-age=86400', extraHeaders)
    return true
  }

  const devUpstream = customDistDir ? null : resolveDevUpstream()
  if (devUpstream) {
    if (urlObj.pathname === '/@vite/client') {
      const shimBuf = Buffer.from(buildRemoteViteClientShim(), 'utf-8')
      await sendBufferWithOptionalGzip(
        req,
        res,
        200,
        shimBuf,
        'application/javascript; charset=utf-8',
        'no-cache',
        extraHeaders
      )
      return true
    }
    return proxyDevRenderer(req, res, urlObj, devUpstream, bootstrap, extraHeaders)
  }

  const distRoot = resolve(customDistDir || join(__dirname, '../renderer'))
  return serveBuiltRenderer(req, res, urlObj.pathname, distRoot, bootstrap, extraHeaders)
}

async function proxyDevRenderer(
  req: IncomingMessage,
  res: ServerResponse,
  urlObj: URL,
  upstream: { hostname: string; port: number; hostHeader: string },
  bootstrap: RemoteBootstrapPayload,
  extraHeaders: Record<string, string>
): Promise<boolean> {
  const fastHost = await resolveFastLoopbackHost(upstream.hostname, upstream.port)

  return new Promise((resolveDone) => {
    const isIndex = urlObj.pathname === '/' || urlObj.pathname === '/index.html'
    const forwardPath = isIndex ? '/index.html' : urlObj.pathname + urlObj.search

    const headers: Record<string, string | string[] | undefined> = {
      ...req.headers,
      host: upstream.hostHeader
    }
    delete headers['accept-encoding']

    const proxyReq = httpRequest(
      {
        hostname: fastHost,
        port: upstream.port,
        method: req.method || 'GET',
        path: forwardPath,
        headers,
        agent: devKeepAliveAgent
      },
      (proxyRes) => {
        const status = proxyRes.statusCode || 200
        const contentType = String(proxyRes.headers['content-type'] || 'application/octet-stream')

        if (status === 200 && (isIndex || isCompressibleMime(contentType))) {
          const chunks: Buffer[] = []
          proxyRes.on('data', (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
          proxyRes.on('end', () => {
            const rawBuf = Buffer.concat(chunks)
            let outBuf = rawBuf
            let outMime = contentType

            if (isIndex) {
              outMime = 'text/html; charset=utf-8'
              outBuf = Buffer.from(transformRemoteIndexHtml(rawBuf.toString('utf-8'), bootstrap), 'utf-8')
            } else if (/javascript|text\/css/i.test(contentType)) {
              outBuf = Buffer.from(stripInlineSourceMap(rawBuf.toString('utf-8')), 'utf-8')
            }

            const cacheCtrl = isIndex
              ? 'no-store'
              : isImmutableVendorPath(urlObj.pathname)
                ? 'private, max-age=600'
                : 'no-cache'

            void sendBufferWithOptionalGzip(req, res, 200, outBuf, outMime, cacheCtrl, extraHeaders).then(() =>
              resolveDone(true)
            )
          })
          return
        }

        const resHeaders: OutgoingHttpHeaders = {}
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (v !== undefined) resHeaders[k] = v
        }
        if (isImmutableVendorPath(urlObj.pathname)) {
          resHeaders['cache-control'] = 'private, max-age=600'
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
  req: IncomingMessage,
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
    await sendBufferWithOptionalGzip(req, res, 200, buf, 'text/html; charset=utf-8', 'no-store', extraHeaders)
    return true
  }

  const ext = extname(candidate).toLowerCase()
  const mime = STATIC_MIME[ext] || 'application/octet-stream'
  const buf = await readFile(candidate)
  const cacheCtrl = ext === '.html' ? 'no-store' : 'public, max-age=300'
  await sendBufferWithOptionalGzip(req, res, 200, buf, mime, cacheCtrl, extraHeaders)
  return true
}

export function forwardRemoteWsUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void {
  const devUpstream = resolveDevUpstream()
  if (!devUpstream) {
    socket.destroy()
    return
  }

  void resolveFastLoopbackHost(devUpstream.hostname, devUpstream.port).then((fastHost) => {
    const upstream = createConnection({ host: fastHost, port: devUpstream.port }, () => {
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
  })
}
