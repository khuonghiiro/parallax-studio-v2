import { useCallback, useEffect, useState } from 'react'
import { importDroppedFiles, loadDemo, addLayerFromAsset, useToast } from './actions'
import { usePlayback } from './hooks/usePlayback'
import { useShortcuts } from './hooks/useShortcuts'
import { initMcp } from './mcp/commands'
import { useEditor } from './store/editor'
import { applyTheme, useView } from './store/view'
import { CameraPathDialog } from './ui/CameraPathDialog'
import { CameraSketchDialog } from './ui/CameraSketchDialog'
import { ExportDialog } from './ui/ExportDialog'
import { PerformanceDialog } from './ui/PerformanceDialog'
import { McpDialog } from './ui/McpDialog'
import { MobileRemoteDialog } from './ui/MobileRemoteDialog'
import { AudioStudioDialog } from './ui/AudioStudioDialog'
import { Assembly3DDialog } from './ui/assets/models3d/Assembly3DDialog'
import { GlobalLayerAssemblyHost } from './ui/layerAssembly/GlobalLayerAssemblyHost'
import { AiControlOverlay } from './ui/AiControlOverlay'
import { Inspector } from './ui/Inspector'
import { LeftPanel } from './ui/LeftPanel'
import { ResponsiveDockBar } from './ui/ResponsiveDockBar'
import { Timeline } from './ui/Timeline'
import { Toolbar } from './ui/Toolbar'
import { Viewer } from './ui/Viewer'
import { usePerformance } from './store/performance'
import './styles/variables.css'
import './styles/controls.css'
import './styles/toolbar.css'
import './styles/viewer.css'
import './styles/animateCameraStage.css'
import './styles/animateCameraFilmstrip.css'
import './styles/cameraRouteInspector.css'
import './styles/inspector.css'
import './styles/assets.css'
import './styles/timelineToolbar.css'
import './styles/timelineKeys.css'
import './styles/workflow.css'
import './styles/workflowPalette.css'

export default function App() {
  const [ready, setReady] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [timelineH, setTimelineH] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem('pxs:timeline-dock-height'))
      if (Number.isFinite(saved) && saved >= 120 && saved <= 760) return Math.round(saved)
    } catch {
      /* ignore */
    }
    return 320
  })
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

  // Chặn phím Alt kích hoạt thanh menu mặc định của Windows để dành trọn phím Alt cho thao tác 3D/2D và phím tắt trong app.
  useEffect(() => {
    const suppressAltMenu = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', suppressAltMenu, true)
    window.addEventListener('keyup', suppressAltMenu, true)
    return () => {
      window.removeEventListener('keydown', suppressAltMenu, true)
      window.removeEventListener('keyup', suppressAltMenu, true)
    }
  }, [])

  // Accept AI commands over MCP (re-subscribes cleanly on HMR).
  useEffect(() => {
    initMcp()
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
    const move = (ev: PointerEvent): void => {
      const maxH = Math.max(160, Math.floor(window.innerHeight * 0.65))
      const nextH = Math.max(120, Math.min(maxH, Math.round(startH - (ev.clientY - startY))))
      setTimelineH(nextH)
      try {
        window.localStorage.setItem('pxs:timeline-dock-height', String(nextH))
      } catch {
        /* ignore */
      }
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
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  const aiActive = useView((s) => s.aiActive)
  const aiLocked = useView((s) => s.aiLocked)
  const storeMobileTab = useView((s) => s.mobileTab)
  const storeTabletTab = useView((s) => s.tabletTab)
  const [mobileTab, setMobileTabLocal] = useState<'timeline' | 'left' | 'right'>(storeMobileTab ?? 'timeline')
  const [tabletTab, setTabletTabLocal] = useState<'left' | 'right'>(storeTabletTab ?? 'left')

  useEffect(() => {
    if (storeMobileTab) setMobileTabLocal(storeMobileTab)
  }, [storeMobileTab])

  useEffect(() => {
    if (storeTabletTab) setTabletTabLocal(storeTabletTab)
  }, [storeTabletTab])

  const handleSetMobileTab = useCallback((tab: 'timeline' | 'left' | 'right') => {
    setMobileTabLocal(tab)
    if (tab === 'left' || tab === 'right') setTabletTabLocal(tab)
    useView.setState({ mobileTab: tab, ...(tab === 'left' || tab === 'right' ? { tabletTab: tab } : {}) })
  }, [])

  const handleSetTabletTab = useCallback((tab: 'left' | 'right') => {
    setTabletTabLocal(tab)
    useView.setState({ tabletTab: tab })
  }, [])

  useEffect(() => {
    const onTabEvent = (e: Event): void => {
      const detail = (e as CustomEvent<{ mobileTab?: 'timeline' | 'left' | 'right'; tabletTab?: 'left' | 'right' }>).detail
      if (detail?.mobileTab) handleSetMobileTab(detail.mobileTab)
      if (detail?.tabletTab) handleSetTabletTab(detail.tabletTab)
    }
    window.addEventListener('pxs:responsive-tab', onTabEvent)
    return () => window.removeEventListener('pxs:responsive-tab', onTabEvent)
  }, [handleSetMobileTab, handleSetTabletTab])

  return (
    <div
      className={`app ${theme}${dragOver ? ' dropzone-active' : ''}${aiActive || aiLocked ? ' ai-active' : ''}`}
      data-theme={theme}
      data-mobile-tab={mobileTab}
      data-tablet-tab={tabletTab}
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
      <ResponsiveDockBar
        mobileTab={mobileTab}
        tabletTab={tabletTab}
        setMobileTab={handleSetMobileTab}
        setTabletTab={handleSetTabletTab}
      />
      <Timeline />

      <AiControlOverlay />

      {dialog === 'export' && <ExportDialog onClose={() => useView.getState().openDialog(null)} />}
      {dialog === 'path' && <CameraPathDialog />}
      {dialog === 'sketch' && <CameraSketchDialog />}
      {dialog === 'performance' && <PerformanceDialog />}
      {dialog === 'mcp' && <McpDialog />}
      {dialog === 'remote' && <MobileRemoteDialog />}
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
