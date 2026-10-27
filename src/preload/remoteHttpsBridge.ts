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
      httpsSrv.listen(0, '127.0.0.1')

      const netSrv = createNetServer((socket: Socket) => {
        socket.once('data', (chunk: Buffer) => {
          socket.pause()
          const httpsAddr = httpsSrv.address()
          const httpsPort = typeof httpsAddr === 'object' && httpsAddr ? httpsAddr.port : 0
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
        socket.on('error', () => undefined)
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
  const urls = status.ips.map((ip) => `https://${ip}:${activePort}/?t=${status.token}`)
  return {
    ...status,
    port: activePort,
    url: urls[0] ?? `https://127.0.0.1:${activePort}/?t=${status.token}`,
    urls
  }
}
