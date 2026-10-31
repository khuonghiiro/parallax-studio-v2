import { createServer as createHttpServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'http'
import { createServer as createHttpsServer } from 'https'
import { createConnection, createServer as createNetServer, type Server as NetServer, type Socket } from 'net'
import { connect as tlsConnect } from 'tls'
import type { RemoteServerStatus } from '@shared/ipc'
import { generateSelfSignedCert } from '../main/selfSignedCert'

let bridgeNetServer: NetServer | null = null
let bridgePort: number | null = null
let latestUpstreamPort = 9878
let latestToken = ''
let checkingPromise: Promise<number | null> | null = null

function checkPortSupportsTls(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = tlsConnect(
      { host: '127.0.0.1', port, rejectUnauthorized: false, timeout: 450 },
      () => {
        sock.destroy()
        resolve(true)
      }
    )
    sock.on('error', () => {
      sock.destroy()
      resolve(false)
    })
    sock.on('timeout', () => {
      sock.destroy()
      resolve(false)
    })
  })
}

function forwardToUpstream(req: IncomingMessage, res: ServerResponse): void {
  const rawUrl = req.url || '/'
  const urlObj = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`)
  if (!urlObj.searchParams.get('t') && !urlObj.searchParams.get('token') && latestToken) {
    urlObj.searchParams.set('t', latestToken)
  }

  const proxyReq = httpRequest(
    {
      hostname: '127.0.0.1',
      port: latestUpstreamPort,
      method: req.method || 'GET',
      path: urlObj.pathname + urlObj.search,
      headers: {
        ...req.headers,
        'x-remote-token': (req.headers['x-remote-token'] as string) || latestToken
      }
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, {
        ...proxyRes.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Private-Network': 'true'
      })
      if (String(proxyRes.headers['content-type'] || '').includes('text/event-stream')) {
        res.flushHeaders?.()
      }
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    }
    res.end(JSON.stringify({ ok: false, error: err.message }))
  })

  req.pipe(proxyReq)
}

function forwardUpgradeToUpstream(req: IncomingMessage, socket: Socket, head: Buffer): void {
  const upstream = createConnection({ host: '127.0.0.1', port: latestUpstreamPort }, () => {
    const rawUrl = req.url || '/'
    let headerLines = `${req.method || 'GET'} ${rawUrl} HTTP/${req.httpVersion}\r\n`
    for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) {
      headerLines += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`
    }
    if (latestToken && !req.headers['x-remote-token']) {
      headerLines += `X-Remote-Token: ${latestToken}\r\n`
    }
    headerLines += '\r\n'
    upstream.write(headerLines)
    if (head && head.length > 0) upstream.write(head)
    socket.pipe(upstream).pipe(socket)
  })
  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
}

async function ensureBridgeForStatus(status: RemoteServerStatus): Promise<number | null> {
  latestUpstreamPort = status.port
  latestToken = status.token
  if (!status.listening) return null

  const mainHasTls = await checkPortSupportsTls(status.port)
  if (mainHasTls) {
    return status.port
  }

  if (bridgeNetServer && bridgePort) {
    return bridgePort
  }

  const candidatePort = status.port + 1
  const existingBridgeHasTls = await checkPortSupportsTls(candidatePort)
  if (existingBridgeHasTls) {
    bridgePort = candidatePort
    return candidatePort
  }

  return new Promise((resolve) => {
    try {
      const { key, cert } = generateSelfSignedCert(status.ips)
      const httpSrv = createHttpServer(forwardToUpstream)
      const httpsSrv = createHttpsServer({ key, cert }, forwardToUpstream)
      httpSrv.on('upgrade', forwardUpgradeToUpstream)
      httpsSrv.on('upgrade', forwardUpgradeToUpstream)
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
          if (first[0] === 0x16) {
            httpsSrv.emit('connection', socket)
          } else {
            httpSrv.emit('connection', socket)
          }
          socket.resume()
        }
        socket.once('readable', onReadable)
      })

      netSrv.once('error', () => {
        try {
          httpsSrv.close()
        } catch {
          /* ignore */
        }
        resolve(null)
      })

      netSrv.listen(candidatePort, '0.0.0.0', () => {
        bridgeNetServer = netSrv
        bridgePort = candidatePort
        const g = globalThis as unknown as { addEventListener?: (t: string, cb: () => void) => void }
        g.addEventListener?.('beforeunload', () => {
          try {
            netSrv.close()
            httpSrv.close()
            httpsSrv.close()
          } catch {
            /* ignore */
          }
        })
        resolve(candidatePort)
      })
    } catch {
      resolve(null)
    }
  })
}

export async function enrichRemoteStatusWithHttps(status: RemoteServerStatus): Promise<RemoteServerStatus> {
  if (!checkingPromise) {
    checkingPromise = ensureBridgeForStatus(status).finally(() => {
      checkingPromise = null
    })
  }
  const activePort = (await checkingPromise) ?? bridgePort ?? status.port
  const urls = status.ips.map((ip) => `http://${ip}:${activePort}/?t=${status.token}`)
  return {
    ...status,
    port: activePort,
    url: urls[0] ?? `http://127.0.0.1:${activePort}/?t=${status.token}`,
    urls
  }
}
