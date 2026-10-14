import { useCallback, useEffect, useState } from 'react'
import { importDroppedFiles, loadDemo, addLayerFromAsset, useToast } from './actions'
import { usePlayback } from './hooks/usePlayback'
import { useShortcuts } from './hooks/useShortcuts'
import { initMcp } from './mcp/commands'
import { useEditor } from './store/editor'
import { useView } from './store/view'
import { CameraPathDialog } from './ui/CameraPathDialog'
import { CameraSketchDialog } from './ui/CameraSketchDialog'
import { ExportDialog } from './ui/ExportDialog'
import { PerformanceDialog } from './ui/PerformanceDialog'
import { McpDialog } from './ui/McpDialog'
import { AudioStudioDialog } from './ui/AudioStudioDialog'
import { Assembly3DDialog } from './ui/assets/models3d/Assembly3DDialog'
import { GlobalLayerAssemblyHost } from './ui/layerAssembly/GlobalLayerAssemblyHost'
import { AiControlOverlay } from './ui/AiControlOverlay'
import { Inspector } from './ui/Inspector'
import { LeftPanel } from './ui/LeftPanel'
import { Timeline } from './ui/Timeline'
import { Toolbar } from './ui/Toolbar'
import { Viewer } from './ui/Viewer'
import { usePerformance } from './store/performance'

export default function App() {
  const [ready, setReady] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [timelineH, setTimelineH] = useState(300)
  const toast = useToast((s) => s.message)
  const dialog = useView((s) => s.dialog)
  const assemblyModalModel = useView((s) => s.assemblyModalModel)
  const closeAssemblyWorkshop = useView((s) => s.closeAssemblyWorkshop)
  const openExport = useCallback(() => {
    useView.getState().openDialog('export')
  }, [])

  usePlayback()
  useShortcuts(openExport)

  // Open the demo scene on first launch and ensure UI zoom is at 100%.
  useEffect(() => {
    window.api?.resetZoom?.()
    loadDemo(true)
      .catch((err) => console.error(err))
      .finally(() => {
        setReady(true)
        usePerformance.getState().init().catch(() => undefined)
      })
  }, [])

  // Accept AI commands over MCP (re-subscribes cleanly on HMR).
  useEffect(() => {
    if (!ready) return
    return initMcp()
  }, [ready])

  // Window title reflects document state.
  const dirty = useEditor((s) => s.dirty)
  const filePath = useEditor((s) => s.filePath)
  useEffect(() => {
    const name = filePath ? filePath.split(/[\\/]/).pop() : 'Untitled'
    window.api?.setTitle(`${dirty ? '• ' : ''}${name} — Parallax Studio`)
  }, [dirty, filePath])

  const startSplit = (e: React.PointerEvent): void => {
    const startY = e.clientY
    const startH = timelineH
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => {
      const maxH = Math.max(140, Math.floor(window.innerHeight * 0.58))
      setTimelineH(Math.max(110, Math.min(maxH, startH - (ev.clientY - startY))))
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  useEffect(() => {
    if (!dragOver) return
    const handleDragEnd = () => setDragOver(false)
    window.addEventListener('dragend', handleDragEnd)
    window.addEventListener('drop', handleDragEnd)
    return () => {
      window.removeEventListener('dragend', handleDragEnd)
      window.removeEventListener('drop', handleDragEnd)
    }
  }, [dragOver])

  const theme = useView((s) => s.theme)
  const aiActive = useView((s) => s.aiActive)
  const aiLocked = useView((s) => s.aiLocked)

  return (
    <div
      className={`app ${theme}${dragOver ? ' dropzone-active' : ''}${aiActive || aiLocked ? ' ai-active' : ''}`}
      data-theme={theme}
      style={{ ['--timeline-h' as string]: `${timelineH}px` }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const assetId = e.dataTransfer.getData('application/x-pxs-asset')
        if (assetId) addLayerFromAsset(assetId)
        else if (e.dataTransfer.files.length) importDroppedFiles(e.dataTransfer.files)
      }}
    >
      <Toolbar onExport={openExport} />
      <LeftPanel />
      <div className="viewer-wrap">
        <Viewer />
      </div>
      <Inspector />
      <div className="splitter" onPointerDown={startSplit} />
      <Timeline />

      <AiControlOverlay />

      {dialog === 'export' && <ExportDialog onClose={() => useView.getState().openDialog(null)} />}
      {dialog === 'path' && <CameraPathDialog />}
      {dialog === 'sketch' && <CameraSketchDialog />}
      {dialog === 'performance' && <PerformanceDialog />}
      {dialog === 'mcp' && <McpDialog />}
      {dialog === 'audio' && <AudioStudioDialog />}
      {assemblyModalModel && (
        <Assembly3DDialog
          key={assemblyModalModel.id}
          isOpen={true}
          initialModel={assemblyModalModel}
          onClose={closeAssemblyWorkshop}
        />
      )}
      <GlobalLayerAssemblyHost />
      {toast && <div className="toast">{toast}</div>}
      {!ready && (
        <div className="loading-screen">
          <div style={{ textAlign: 'center' }}>
            <div className="brand-logo" />
            Đang dựng cảnh mẫu…
          </div>
        </div>
      )}
    </div>
  )
}
