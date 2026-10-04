import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join, extname, basename } from 'path'
import { readFile, writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { FfmpegEncoder } from './ffmpeg'
import { McpBridge } from './mcpBridge'
import type { ExportStartOptions, PickedFile } from '@shared/ipc'

// ANGLE's default D3D11 backend crashes the GPU process right at startup on some
// Windows driver/Electron combos (exit 0xC0000005 before any shader is linked), which
// loses the WebGL context. D3D11-on-12 is stable and equally fast. Override with
// PARALLAX_ANGLE=d3d11|gl|vulkan or by passing --use-angle=... on the command line.
if (process.platform === 'win32' && !app.commandLine.hasSwitch('use-angle')) {
  app.commandLine.appendSwitch('use-angle', process.env.PARALLAX_ANGLE || 'd3d11on12')
}

let mainWindow: BrowserWindow | null = null
let encoder: FfmpegEncoder | null = null
let mcp: McpBridge | null = null

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac'
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b0d12',
    title: 'Parallax Studio',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.on('did-start-loading', () => mcp?.onWindowLoading())

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('files:open', async (_e, kind: 'image' | 'audio'): Promise<PickedFile[]> => {
    const exts = kind === 'image' ? IMAGE_EXT : AUDIO_EXT
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: kind === 'image' ? 'Import images' : 'Import audio',
      properties: kind === 'image' ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [{ name: kind === 'image' ? 'Images' : 'Audio', extensions: exts }]
    })
    if (res.canceled) return []
    return Promise.all(
      res.filePaths.map(async (p) => {
        const ext = extname(p).slice(1).toLowerCase()
        const data = await readFile(p)
        return { name: basename(p), path: p, mime: MIME[ext] ?? 'application/octet-stream', data: new Uint8Array(data) }
      })
    )
  })

  ipcMain.handle('project:save', async (_e, data: Uint8Array, suggestedPath?: string) => {
    let target = suggestedPath
    if (!target) {
      const res = await dialog.showSaveDialog(mainWindow!, {
        title: 'Save project',
        defaultPath: 'untitled.pxs',
        filters: [
          { name: 'Parallax Studio Project (*.pxs, *.json)', extensions: ['pxs', 'json'] },
          { name: 'Parallax Archive (*.pxs)', extensions: ['pxs'] },
          { name: 'JSON Project (*.json)', extensions: ['json'] }
        ]
      })
      if (res.canceled || !res.filePath) return null
      target = res.filePath
    }
    await writeFile(target, Buffer.from(data))
    return target
  })

  ipcMain.handle('project:open', async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open project',
      properties: ['openFile'],
      filters: [
        { name: 'Parallax Studio Project (*.pxs, *.json)', extensions: ['pxs', 'json'] },
        { name: 'Parallax Archive (*.pxs)', extensions: ['pxs'] },
        { name: 'JSON Project (*.json)', extensions: ['json'] }
      ]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const p = res.filePaths[0]
    return { path: p, data: new Uint8Array(await readFile(p)) }
  })

  ipcMain.handle('project:saveJson', async (_e, content: string, defaultName = 'project.json') => {
    const res = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save project as JSON',
      defaultPath: defaultName,
      filters: [{ name: 'JSON Project / Scene (*.json)', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return null
    await writeFile(res.filePath, content, 'utf-8')
    return res.filePath
  })

  ipcMain.handle('project:openJson', async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open JSON Project or Scene',
      properties: ['openFile'],
      filters: [{ name: 'JSON Project / Scene (*.json)', extensions: ['json'] }]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    const p = res.filePaths[0]
    const content = await readFile(p, 'utf-8')
    return { path: p, content }
  })

  ipcMain.handle('export:choosePath', async (_e, defaultName: string) => {
    const res = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export video',
      defaultPath: defaultName,
      filters: [{ name: 'MP4 Video (H.264)', extensions: ['mp4'] }]
    })
    return res.canceled || !res.filePath ? null : res.filePath
  })

  ipcMain.handle('export:start', async (_e, opts: ExportStartOptions) => {
    try {
      encoder?.cancel()
      let audioPath: string | undefined
      if (opts.audio) {
        audioPath = join(tmpdir(), `pxs-audio-${Date.now()}.${opts.audio.ext}`)
        await writeFile(audioPath, Buffer.from(opts.audio.data))
      }
      encoder = new FfmpegEncoder(opts, audioPath)
      encoder.onDone(() => {
        if (audioPath) unlink(audioPath).catch(() => undefined)
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('export:frame', async (_e, frame: Uint8Array) => {
    if (!encoder) throw new Error('No export in progress')
    await encoder.writeFrame(frame)
  })

  ipcMain.handle('export:finish', async () => {
    if (!encoder) return { ok: false, error: 'No export in progress' }
    const res = await encoder.finish()
    encoder = null
    return res
  })

  ipcMain.handle('export:cancel', async () => {
    encoder?.cancel()
    encoder = null
  })

  ipcMain.handle('shell:reveal', async (_e, p: string) => shell.showItemInFolder(p))

  ipcMain.on('window:title', (_e, title: string) => mainWindow?.setTitle(title))
}

app.whenReady().then(() => {
  registerIpc()
  mcp = new McpBridge(() => mainWindow)
  mcp.start()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  encoder?.cancel()
  mcp?.stop()
  if (process.platform !== 'darwin') app.quit()
})
