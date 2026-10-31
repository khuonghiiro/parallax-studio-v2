import type {
  Asset3DsCatalogResult,
  BuiltInAssetItem,
  BuiltInCatalogResult,
  BuiltInSaveManifestResult,
  ExportResult,
  ExportStartOptions,
  McpStatus,
  ParallaxApi,
  PickedFile,
  RemoteServerStatus,
  SystemHardwareInfo
} from '@shared/ipc'
import { buildRemoteApiUrl, initRemoteClientLayout, isRemoteWebClient, remoteFetch } from './remoteSession'

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode(...sub)
  }
  return btoa(binary)
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 15_000)
}

function triggerUrlDownload(href: string, fileName?: string): void {
  const a = document.createElement('a')
  a.href = href
  if (fileName) a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function pickLocalBrowserFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.appendChild(input)

    let settled = false
    const finish = (files: File[]): void => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onWindowFocus)
      input.remove()
      resolve(files)
    }

    const onWindowFocus = (): void => {
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) finish([])
      }, 450)
    }

    input.addEventListener('change', () => {
      finish(input.files ? Array.from(input.files) : [])
    })
    input.addEventListener('cancel', () => finish([]))
    window.addEventListener('focus', onWindowFocus)
    input.click()
  })
}

async function remoteRpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const resp = await remoteFetch('/api/remote/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params })
  })
  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText)
    throw new Error(`Remote RPC (${method}) failed: ${errText}`)
  }
  const json = (await resp.json()) as { ok: boolean; result: T; error?: string }
  if (!json.ok) throw new Error(json.error || `Remote RPC (${method}) failed`)
  return json.result
}

export function createRemoteParallaxApi(): ParallaxApi {
  let cachedCatalog: BuiltInCatalogResult | null = null
  let cachedAssemblyAssets: BuiltInAssetItem[] | null = null
  let lastExportDownloadUrl: string | null = null

  const stubMcpStatus: McpStatus = {
    listening: false,
    port: 9877,
    clients: 0,
    commands: 0,
    lastMethod: null,
    lastAt: null,
    configPath: '',
    docsLang: 'vi'
  }

  return {
    async openFiles(kind: 'image' | 'audio'): Promise<PickedFile[]> {
      const accept =
        kind === 'image'
          ? 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml'
          : 'audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac'
      const files = await pickLocalBrowserFiles(accept, kind === 'image')
      return Promise.all(
        files.map(async (f) => ({
          name: f.name,
          path: f.name,
          mime: f.type || (kind === 'image' ? 'image/png' : 'audio/mpeg'),
          data: new Uint8Array(await f.arrayBuffer())
        }))
      )
    },

    async saveProject(data: Uint8Array, suggestedPath?: string): Promise<string | null> {
      const base = suggestedPath?.split(/[\\/]/).pop() || 'parallax-project.pxs'
      const fileName = base.endsWith('.pxs') || base.endsWith('.json') ? base : `${base}.pxs`
      triggerBrowserDownload(new Blob([data as BlobPart], { type: 'application/octet-stream' }), fileName)
      return fileName
    },

    async openProject(): Promise<{ path: string; data: Uint8Array } | null> {
      const files = await pickLocalBrowserFiles('.pxs,.json,application/json', false)
      const f = files[0]
      if (!f) return null
      return { path: f.name, data: new Uint8Array(await f.arrayBuffer()) }
    },

    async saveJson(content: string, defaultName = 'project.json'): Promise<string | null> {
      const fileName = defaultName.endsWith('.json') ? defaultName : `${defaultName}.json`
      triggerBrowserDownload(new Blob([content], { type: 'application/json;charset=utf-8' }), fileName)
      return fileName
    },

    async openJson(): Promise<{ path: string; content: string } | null> {
      const files = await pickLocalBrowserFiles('.json,application/json', false)
      const f = files[0]
      if (!f) return null
      return { path: f.name, content: await f.text() }
    },

    async chooseExportPath(defaultName: string): Promise<string | null> {
      const res = await remoteRpc<{ ok: boolean; outPath?: string }>('exportChoosePath', { defaultName })
      return res.ok && res.outPath ? res.outPath : null
    },

    async exportStart(opts: ExportStartOptions): Promise<{ ok: boolean; error?: string }> {
      const payload: Record<string, unknown> = {
        width: opts.width,
        height: opts.height,
        fps: opts.fps,
        crf: opts.crf,
        preset: opts.preset,
        outPath: opts.outPath
      }
      if (opts.audio) {
        payload.audio = {
          dataBase64: uint8ToBase64(opts.audio.data),
          ext: opts.audio.ext,
          offset: opts.audio.offset,
          volume: opts.audio.volume,
          duration: opts.audio.duration
        }
      }
      return remoteRpc<{ ok: boolean; error?: string }>('exportStart', payload)
    },

    async exportFrame(frame: Uint8Array): Promise<void> {
      const resp = await remoteFetch('/api/remote/export-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: frame as unknown as BodyInit
      })
      if (!resp.ok) throw new Error(`Export frame failed (${resp.status})`)
    },

    async exportFinish(): Promise<ExportResult> {
      const res = await remoteRpc<ExportResult & { downloadId?: string }>('exportFinish')
      if (res.ok && res.downloadId) {
        lastExportDownloadUrl = buildRemoteApiUrl('/api/remote/export-download', { id: res.downloadId })
        triggerUrlDownload(lastExportDownloadUrl)
      }
      return res
    },

    async exportCancel(): Promise<void> {
      await remoteRpc('exportCancel')
    },

    async revealFile(_path: string): Promise<void> {
      if (lastExportDownloadUrl) triggerUrlDownload(lastExportDownloadUrl)
    },

    setTitle(title: string): void {
      if (typeof document !== 'undefined') document.title = title
    },

    resetZoom(): void {
      /* browser viewport handles scaling */
    },

    getSystemInfo(): Promise<SystemHardwareInfo> {
      return remoteRpc<SystemHardwareInfo>('getSystemInfo')
    },

    async getBuiltInCatalog(): Promise<BuiltInCatalogResult> {
      if (cachedCatalog) return cachedCatalog
      cachedCatalog = await remoteRpc<BuiltInCatalogResult>('getBuiltInCatalog')
      return cachedCatalog
    },

    async getAssemblyAssets(): Promise<BuiltInAssetItem[]> {
      if (cachedAssemblyAssets) return cachedAssemblyAssets
      cachedAssemblyAssets = await remoteRpc<BuiltInAssetItem[]>('getAssemblyAssets')
      return cachedAssemblyAssets
    },

    async saveBuiltInManifest(jsonContent: string): Promise<BuiltInSaveManifestResult> {
      cachedCatalog = null
      return remoteRpc<BuiltInSaveManifestResult>('saveBuiltInManifest', { jsonContent })
    },

    async loadBuiltInAssetBytes(relativePath: string): Promise<{ name: string; mime: string; data: Uint8Array } | null> {
      const resp = await remoteFetch(
        buildRemoteApiUrl('/api/remote/builtin-bytes', { path: relativePath })
      )
      if (!resp.ok) return null
      const mime = resp.headers.get('content-type') || 'application/octet-stream'
      const rawName = resp.headers.get('x-asset-name')
      const name = rawName ? decodeURIComponent(rawName) : relativePath.split('/').pop() || 'asset'
      return { name, mime, data: new Uint8Array(await resp.arrayBuffer()) }
    },

    async openBuiltInFolder(): Promise<void> {
      /* no-op on remote device */
    },

    async deleteBuiltInAsset(relativePath: string): Promise<{ ok: boolean; error?: string }> {
      cachedCatalog = null
      cachedAssemblyAssets = null
      return remoteRpc<{ ok: boolean; error?: string }>('deleteBuiltInAsset', { relativePath })
    },

    async importBuiltInAssetFile(opts) {
      cachedCatalog = null
      cachedAssemblyAssets = null
      return remoteRpc('importBuiltInAssetFile', {
        name: opts.name,
        bufferBase64: uint8ToBase64(opts.buffer),
        folder: opts.folder,
        title: opts.title
      })
    },

    asset3ds: {
      getCatalog: () => remoteRpc<Asset3DsCatalogResult>('asset3ds:getCatalog'),
      list: () => remoteRpc<any[]>('asset3ds:list'),
      save: (model) => remoteRpc('asset3ds:save', { model }),
      delete: (id) => remoteRpc('asset3ds:delete', { id }),
      async loadBytes(relPath: string) {
        const resp = await remoteFetch(buildRemoteApiUrl('/api/remote/asset3d-bytes', { path: relPath }))
        if (!resp.ok) return null
        const mime = resp.headers.get('content-type') || 'application/octet-stream'
        const rawName = resp.headers.get('x-asset-name')
        const name = rawName ? decodeURIComponent(rawName) : relPath.split('/').pop() || 'texture'
        return { name, mime, data: new Uint8Array(await resp.arrayBuffer()) }
      },
      openFolder: async () => undefined,
      saveManifest: (jsonContent) => remoteRpc('asset3ds:saveManifest', { jsonContent })
    },

    mcp: {
      onCommand: () => () => undefined,
      respond: () => undefined,
      status: async () => stubMcpStatus,
      onStatus: () => () => undefined,
      disconnectAll: async () => undefined,
      toggleListening: async () => stubMcpStatus,
      setDocsLang: async () => stubMcpStatus,
      captureWindow: async () => ({ mime: 'image/png', data: '', width: 0, height: 0 })
    },

    remote: {
      async status(): Promise<RemoteServerStatus> {
        const resp = await remoteFetch('/api/remote/status')
        return (await resp.json()) as RemoteServerStatus
      },
      onStatus(cb: (s: RemoteServerStatus) => void): () => void {
        const timer = window.setInterval(() => {
          remoteFetch('/api/remote/status')
            .then((r) => (r.ok ? r.json() : null))
            .then((s) => s && cb(s as RemoteServerStatus))
            .catch(() => undefined)
        }, 4000)
        return () => window.clearInterval(timer)
      },
      async toggle(): Promise<RemoteServerStatus> {
        const resp = await remoteFetch('/api/remote/status')
        return (await resp.json()) as RemoteServerStatus
      },
      async regenerateToken(): Promise<RemoteServerStatus> {
        const resp = await remoteFetch('/api/regenerate-token', { method: 'POST' })
        return (await resp.json()) as RemoteServerStatus
      }
    }
  }
}

export function installRemoteWebApiBridge(): boolean {
  if (!isRemoteWebClient()) return false
  initRemoteClientLayout()
  const w = window as unknown as { api?: ParallaxApi }
  if (!w.api) {
    w.api = createRemoteParallaxApi()
  }
  return true
}
