import { contextBridge, ipcRenderer } from 'electron'
import type { ParallaxApi } from '@shared/ipc'

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
  setTitle: (title) => ipcRenderer.send('window:title', title)
}

contextBridge.exposeInMainWorld('api', api)
