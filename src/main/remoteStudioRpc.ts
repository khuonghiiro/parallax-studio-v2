import { createReadStream, existsSync } from 'fs'
import { mkdir, rm, stat, unlink, writeFile } from 'fs/promises'
import type { ServerResponse } from 'http'
import { tmpdir } from 'os'
import { basename, dirname, join } from 'path'
import { randomBytes } from 'crypto'
import type { ExportStartOptions } from '@shared/ipc'
import { FfmpegEncoder } from './ffmpeg'
import { getSystemHardwareInfo } from './systemInfo'
import {
  deleteBuiltInAsset,
  importBuiltInAssetFile,
  loadAssetBytes,
  saveManifestJson,
  scanAssembly3DAssets,
  scanBuiltInCatalog
} from './builtInAssets'
import {
  getAsset3DsRoot,
  loadAsset3DBytes,
  saveAsset3DModel,
  scanAsset3DsCatalog,
  scanAsset3DsModels
} from './asset3ds'

interface ExportDownloadRecord {
  path: string
  fileName: string
  createdAt: number
}

export class RemoteStudioRpcService {
  private remoteEncoder: FfmpegEncoder | null = null
  private downloads = new Map<string, ExportDownloadRecord>()

  dispose(): void {
    this.remoteEncoder?.cancel()
    this.remoteEncoder = null
  }

  async executeRpc(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    switch (method) {
      case 'getSystemInfo':
        return getSystemHardwareInfo()

      case 'getBuiltInCatalog':
        return scanBuiltInCatalog()

      case 'getAssemblyAssets':
        return scanAssembly3DAssets()

      case 'saveBuiltInManifest':
        return saveManifestJson(String(params.jsonContent ?? ''))

      case 'deleteBuiltInAsset':
        return deleteBuiltInAsset(String(params.relativePath ?? ''))

      case 'importBuiltInAssetFile': {
        const name = String(params.name ?? '')
        const b64 = String(params.bufferBase64 ?? '')
        const buffer = new Uint8Array(Buffer.from(b64, 'base64'))
        return importBuiltInAssetFile({
          name,
          buffer,
          folder: typeof params.folder === 'string' ? params.folder : undefined,
          title: typeof params.title === 'string' ? params.title : undefined
        })
      }

      case 'asset3ds:getCatalog':
        return scanAsset3DsCatalog()

      case 'asset3ds:list':
        return scanAsset3DsModels()

      case 'asset3ds:save':
        return saveAsset3DModel(params.model)

      case 'asset3ds:delete': {
        const id = String(params.id ?? '')
        const models = await scanAsset3DsModels()
        const target = models.find((m) => m.id === id)
        if (target?._filePath) {
          const folder = dirname(target._filePath)
          if (existsSync(folder)) {
            await rm(folder, { recursive: true, force: true })
          }
        }
        return { ok: true }
      }

      case 'asset3ds:saveManifest': {
        const root = getAsset3DsRoot()
        const manifestPath = join(root, 'manifest.json')
        const parsed = JSON.parse(String(params.jsonContent ?? '{}'))
        await writeFile(manifestPath, JSON.stringify(parsed, null, 2), 'utf-8')
        return { ok: true }
      }

      case 'exportChoosePath': {
        const rawName = String(params.defaultName || 'parallax-remote.mp4')
        const safeName = basename(rawName).replace(/[^a-zA-Z0-9._\-\u00C0-\u1EF9 ]+/g, '_') || 'parallax.mp4'
        const exportDir = join(tmpdir(), 'pxs-remote-exports')
        await mkdir(exportDir, { recursive: true })
        const outPath = join(exportDir, `${Date.now()}-${safeName.endsWith('.mp4') ? safeName : `${safeName}.mp4`}`)
        return { ok: true, outPath }
      }

      case 'exportStart': {
        try {
          this.remoteEncoder?.cancel()
          const rawAudio = params.audio as
            | { dataBase64?: string; ext: string; offset: number; volume: number; duration: number }
            | undefined
          let audioPath: string | undefined
          let audioOpt: ExportStartOptions['audio']
          if (rawAudio?.dataBase64) {
            const audioBuf = Buffer.from(rawAudio.dataBase64, 'base64')
            audioPath = join(tmpdir(), `pxs-remote-audio-${Date.now()}.${rawAudio.ext || 'wav'}`)
            await writeFile(audioPath, audioBuf)
            audioOpt = {
              data: new Uint8Array(audioBuf),
              ext: rawAudio.ext || 'wav',
              offset: Number(rawAudio.offset) || 0,
              volume: Number(rawAudio.volume) || 1,
              duration: Number(rawAudio.duration) || 1
            }
          }
          const opts: ExportStartOptions = {
            width: Number(params.width) || 1920,
            height: Number(params.height) || 1080,
            fps: Number(params.fps) || 30,
            crf: Number(params.crf) || 18,
            preset: (params.preset as ExportStartOptions['preset']) || 'medium',
            outPath: String(params.outPath || join(tmpdir(), `pxs-remote-${Date.now()}.mp4`)),
            audio: audioOpt
          }
          this.remoteEncoder = new FfmpegEncoder(opts, audioPath)
          this.remoteEncoder.onDone(() => {
            if (audioPath) unlink(audioPath).catch(() => undefined)
          })
          return { ok: true }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) }
        }
      }

      case 'exportFinish': {
        if (!this.remoteEncoder) return { ok: false, error: 'No export in progress' }
        const res = await this.remoteEncoder.finish()
        this.remoteEncoder = null
        if (res.ok && res.outPath && existsSync(res.outPath)) {
          const downloadId = randomBytes(6).toString('hex')
          this.downloads.set(downloadId, {
            path: res.outPath,
            fileName: basename(res.outPath).replace(/^\d+-/, ''),
            createdAt: Date.now()
          })
          return { ...res, downloadId }
        }
        return res
      }

      case 'exportCancel': {
        this.remoteEncoder?.cancel()
        this.remoteEncoder = null
        return { ok: true }
      }

      default:
        throw new Error(`Unknown remote RPC method: ${method}`)
    }
  }

  async writeExportFrame(frameBytes: Buffer): Promise<void> {
    if (!this.remoteEncoder) throw new Error('No export in progress')
    await this.remoteEncoder.writeFrame(new Uint8Array(frameBytes))
  }

  async serveBuiltInAssetBytes(relPath: string, res: ServerResponse): Promise<void> {
    const loaded = await loadAssetBytes(relPath)
    if (!loaded) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: 'Asset not found' }))
      return
    }
    const buf = Buffer.from(loaded.data)
    res.writeHead(200, {
      'Content-Type': loaded.mime,
      'Content-Length': String(buf.byteLength),
      'X-Asset-Name': encodeURIComponent(loaded.name),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'X-Asset-Name',
      'Cache-Control': 'public, max-age=120'
    })
    res.end(buf)
  }

  async serveAsset3DBytes(relPath: string, res: ServerResponse): Promise<void> {
    const loaded = await loadAsset3DBytes(relPath)
    if (!loaded) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: '3D texture not found' }))
      return
    }
    const buf = Buffer.from(loaded.data)
    res.writeHead(200, {
      'Content-Type': loaded.mime,
      'Content-Length': String(buf.byteLength),
      'X-Asset-Name': encodeURIComponent(loaded.name),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'X-Asset-Name',
      'Cache-Control': 'public, max-age=120'
    })
    res.end(buf)
  }

  async streamExportDownload(downloadId: string, res: ServerResponse): Promise<void> {
    const entry = this.downloads.get(downloadId)
    if (!entry || !existsSync(entry.path)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Exported video not found or expired')
      return
    }
    const st = await stat(entry.path)
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': String(st.size),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(entry.fileName)}"`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    })
    createReadStream(entry.path).pipe(res)
  }
}
