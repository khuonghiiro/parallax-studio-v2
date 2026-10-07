import { contextBridge, ipcRenderer } from 'electron'
import type { McpCommand, McpStatus, ParallaxApi } from '@shared/ipc'

const api: ParallaxApi = {
  openFiles: (kind) => ipcRenderer.invoke('files:open', kind),
  saveProject: (data, suggestedPath) => ipcRenderer.invoke('project:save', data, suggestedPath),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveJson: (content, defaultName) => ipcRenderer.invoke('project:saveJson', content, defaultName),
  openJson: () => ipcRenderer.invoke('project:openJson'),
  chooseExportPath: (defaultName) => ipcRenderer.invoke('export:choosePath', defaultName),
  exportStart: (opts) => ipcRenderer.invoke('export:start', opts),
  exportFrame: (frame) => ipcRenderer.invoke('export:frame', frame),
  exportFinish: () => ipcRenderer.invoke('export:finish'),
  exportCancel: () => ipcRenderer.invoke('export:cancel'),
  revealFile: (p) => ipcRenderer.invoke('shell:reveal', p),
  setTitle: (title) => ipcRenderer.send('window:title', title),
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),
  getBuiltInCatalog: () => ipcRenderer.invoke('builtinAssets:getCatalog'),
  getAssemblyAssets: () => ipcRenderer.invoke('builtinAssets:getAssemblyAssets'),
  saveBuiltInManifest: (jsonContent) => ipcRenderer.invoke('builtinAssets:saveManifest', jsonContent),
  loadBuiltInAssetBytes: (relPath) => ipcRenderer.invoke('builtinAssets:loadAssetBytes', relPath),
  openBuiltInFolder: (subFolder) => ipcRenderer.invoke('builtinAssets:openFolder', subFolder),
  asset3ds: {
    getCatalog: () => ipcRenderer.invoke('asset3ds:getCatalog'),
    list: () => ipcRenderer.invoke('asset3ds:list'),
    save: (model) => ipcRenderer.invoke('asset3ds:save', model),
    delete: (id) => ipcRenderer.invoke('asset3ds:delete', id),
    loadBytes: (relPath) => ipcRenderer.invoke('asset3ds:loadBytes', relPath),
    openFolder: () => ipcRenderer.invoke('asset3ds:openFolder'),
    saveManifest: (content) => ipcRenderer.invoke('asset3ds:saveManifest', content)
  },
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
    },
    disconnectAll: () => ipcRenderer.invoke('mcp:disconnectAll'),
    toggleListening: (enable?: boolean) => ipcRenderer.invoke('mcp:toggleListening', enable)
  }
}

contextBridge.exposeInMainWorld('api', api)
