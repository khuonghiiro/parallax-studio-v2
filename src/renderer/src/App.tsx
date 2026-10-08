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
import { Inspector } from './ui/Inspector'
import { LeftPanel } from './ui/LeftPanel'
import { Timeline } from './ui/Timeline'
import { Toolbar } from './ui/Toolbar'
import { Viewer } from './ui/Viewer'
import { usePerformance } from './store/performance'

export default function App() {
  const [ready, setReady] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [timelineH, setTimelineH] = useState(300)
  const toast = useToast((s) => s.message)
  const dialog = useView((s) => s.dialog)
  const assemblyModalModel = useView((s) => s.assemblyModalModel)
  const closeAssemblyWorkshop = useView((s) => s.closeAssemblyWorkshop)
  const openExport = useCallback(() => {
    useEditor.getState().setPlaying(false)
    setExporting(true)
  }, [])

  usePlayback()
  useShortcuts(openExport)

  // Open the demo scene on first launch, then accept AI commands over MCP.
  useEffect(() => {
    let off: (() => void) | undefined
    let disposed = false
    loadDemo(true)
      .catch((err) => console.error(err))
      .finally(() => {
        setReady(true)
        usePerformance.getState().init().catch(() => undefined)
        // StrictMode mounts twice in dev: never subscribe from a disposed effect.
        if (!disposed) off = initMcp()
      })
    return () => {
      disposed = true
      off?.()
    }
  }, [])

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
    const move = (ev: PointerEvent): void =>
      setTimelineH(Math.max(160, Math.min(window.innerHeight - 320, startH - (ev.clientY - startY))))
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

  return (
    <div
      className={`app ${theme}${dragOver ? ' dropzone-active' : ''}`}
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

      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
      {dialog === 'path' && <CameraPathDialog />}
      {dialog === 'sketch' && <CameraSketchDialog />}
      {dialog === 'performance' && <PerformanceDialog />}
      {dialog === 'mcp' && <McpDialog />}
      {dialog === 'audio' && <AudioStudioDialog />}
      {assemblyModalModel && (
        <Assembly3DDialog
          isOpen={true}
          model={assemblyModalModel}
          onClose={closeAssemblyWorkshop}
        />
      )}
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
