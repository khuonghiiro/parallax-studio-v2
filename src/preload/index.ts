import { contextBridge, ipcRenderer } from 'electron'
import type { McpCommand, McpStatus, ParallaxApi } from '@shared/ipc'

const api: ParallaxApi = {
  openFiles: (kind) => ipcRenderer.invoke('files:open', kind),
  saveProject: (data, suggestedPath) => ipcRenderer.invoke('project:save', data, suggestedPath),
  openProject: () => ipcRenderer.invoke('project:open'),
  chooseExportPath: (defaultName) => ipcRenderer.invoke('export:choosePath', defaultName),
  exportStart: (opts) => ipcRenderer.invoke('export:start', opts),
  exportFrame: (frame) => ipcRenderer.invoke('export:frame', frame),
  exportFinish: () => ipcRenderer.invoke('export:finish'),
  exportCancel: () => ipcRenderer.invoke('export:cancel'),
  revealFile: (p) => ipcRenderer.invoke('shell:reveal', p),
  setTitle: (title) => ipcRenderer.send('window:title', title),
  mcp: {
    onCommand: (cb) => {
      const h = (_e: Electron.IpcRendererEvent, cmd: McpCommand): void => cb(cmd)
      ipcRenderer.on('mcp:command', h)
      ipcRenderer.send('mcp:ready')
      return () => ipcRenderer.removeListener('mcp:command', h)
    },
    respond: (res) => ipcRenderer.send('mcp:response', res),
    status: () => ipcRenderer.invoke('mcp:status'),
    onStatus: (cb) => {
      const h = (_e: Electron.IpcRendererEvent, s: McpStatus): void => cb(s)
      ipcRenderer.on('mcp:status', h)
      return () => ipcRenderer.removeListener('mcp:status', h)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
