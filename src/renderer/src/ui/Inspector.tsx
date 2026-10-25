import React, { useEffect, useState } from 'react'
import { findLayer, findShot, useEditor } from '../store/editor'
import { IconLayers } from './icons'
import { ShotInspector } from './inspector/ShotInspector'
import { LayerInspector } from './inspector/LayerInspector'
import { CameraInspector } from './inspector/CameraInspector'
import { SceneInspector } from './inspector/SceneInspector'
import { AudioTrackInspector } from './inspector/AudioTrackInspector'
import { CameraRouteInspector } from './inspector/CameraRouteInspector'
import { WorkflowV2Inspector } from './workflow/WorkflowV2Inspector'
import { useWorkflowV2Controller, useWorkflowV2SelectionSync } from './workflow/useWorkflowV2Controller'

export { ShotInspector } from './inspector/ShotInspector'
export { LayerInspector } from './inspector/LayerInspector'
export { CameraInspector } from './inspector/CameraInspector'
export { SceneInspector } from './inspector/SceneInspector'
export { AudioTrackInspector } from './inspector/AudioTrackInspector'
export { CameraRouteInspector } from './inspector/CameraRouteInspector'

const COL_EXPANDED_KEY = 'pxs:right-col-expanded'
const COL_WIDTH_KEY = 'pxs:wf-v2-inspector-width'
const MIN_COL_W = 280
const MAX_COL_W = 680
const DEFAULT_EXPANDED_W = 420
const WIDE_PRESET_W = 480

function readInitialColWidth(): number {
  const raw = Number(localStorage.getItem(COL_WIDTH_KEY))
  if (Number.isFinite(raw) && raw >= MIN_COL_W && raw <= MAX_COL_W) return Math.round(raw)
  return DEFAULT_EXPANDED_W
}

export function Inspector() {
  const tab = useEditor((s) => s.inspectorTab)
  const setTab = useEditor((s) => s.setInspectorTab)
  const layer = useEditor((s) => findLayer(s.project, s.selectedLayerId))
  const shot = useEditor((s) => findShot(s.project, s.selectedShotId))
  const audioTrack = useEditor((s) =>
    s.selectedAudioTrackId
      ? s.project.audioTracks?.find((t) => t.id === s.selectedAudioTrackId) ?? null
      : null
  )

  // Mặc định mở rộng toàn cột phải (4 tab nằm trên, 2 tab Thuộc tính Node & JSON Cảnh nằm dưới đáy màn hình)
  const [isColumnExpanded, setIsColumnExpanded] = useState<boolean>(
    () => localStorage.getItem(COL_EXPANDED_KEY) !== '0'
  )
  const [splitBottomMode, setSplitBottomMode] = useState<'node' | 'json'>('node')
  const [colWidth, setColWidth] = useState<number>(readInitialColWidth)
  const [resizingWidth, setResizingWidth] = useState(false)

  // Đồng bộ biến CSS `--right-col-w` lên `.app` để mở rộng cột phải toàn màn hình
  useEffect(() => {
    document.documentElement.style.setProperty('--right-col-w', `${colWidth}px`)
  }, [colWidth])

  // Bộ điều khiển chung cho Thuộc tính Node & JSON Cảnh & Main (dùng chung cho cả Timeline và Workflow)
  const wfCtrl = useWorkflowV2Controller()
  useWorkflowV2SelectionSync(wfCtrl)

  const updateColWidth = (nextW: number): void => {
    const clamped = Math.round(Math.max(MIN_COL_W, Math.min(MAX_COL_W, nextW)))
    setColWidth(clamped)
    localStorage.setItem(COL_WIDTH_KEY, String(clamped))
  }

  const startResizeWidth = (e: React.PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colWidth
    setResizingWidth(true)

    const onMove = (ev: PointerEvent): void => {
      const delta = startX - ev.clientX
      updateColWidth(startW + delta)
    }
    const onUp = (): void => {
      setResizingWidth(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleToggleColumnExpanded = (): void => {
    setIsColumnExpanded((prev) => {
      const next = !prev
      localStorage.setItem(COL_EXPANDED_KEY, next ? '1' : '0')
      if (next) {
        // Khi bấm Expand từ khung dưới lên toàn cột: chuyển sang tab Node/JSON đang mở và nới rộng cột cho dễ thao tác
        if (tab !== 'node' && tab !== 'json') {
          setTab(splitBottomMode)
        }
        if (colWidth < DEFAULT_EXPANDED_W) {
          updateColWidth(DEFAULT_EXPANDED_W)
        }
      } else {
        // Khi thu về chế độ chia đôi: giữ nhớ mode dưới và trả phần trên về tab Layer
        if (tab === 'node' || tab === 'json') {
          setSplitBottomMode(tab)
          setTab('layer')
        }
      }
      return next
    })
  }

  const handleToggleWideWidth = (): void => {
    updateColWidth(colWidth >= WIDE_PRESET_W - 10 ? 370 : WIDE_PRESET_W)
  }

  const tabTitle = audioTrack ? 'Âm thanh' : !layer && shot ? 'Cảnh này' : 'Layer'
  const topTabInSplit = tab === 'node' || tab === 'json' ? 'layer' : tab
  const effectiveBottomMode: 'node' | 'json' =
    tab === 'json' ? 'json' : tab === 'node' ? 'node' : splitBottomMode

  const renderTopTabBody = (activeTopTab: 'layer' | 'camera' | 'route' | 'scene') => (
    <>
      {activeTopTab === 'layer' &&
        (audioTrack ? (
          <AudioTrackInspector track={audioTrack} />
        ) : layer ? (
          <LayerInspector layer={layer} />
        ) : shot ? (
          <ShotInspector shot={shot} />
        ) : (
          <div className="empty">
            <IconLayers width={28} height={28} style={{ opacity: 0.5 }} />
            <br />
            Chọn một layer, cảnh hoặc đoạn âm thanh trên timeline để chỉnh sửa.
          </div>
        ))}
      {activeTopTab === 'camera' && <CameraInspector />}
      {activeTopTab === 'route' && <CameraRouteInspector />}
      {activeTopTab === 'scene' && <SceneInspector />}
    </>
  )

  const renderWorkflowInspector = (isJson: boolean) => (
    <WorkflowV2Inspector
      embedded
      hideModeTabs
      workflow={wfCtrl.workflow}
      project={wfCtrl.project}
      node={wfCtrl.selectedNode}
      selectedLayerId={wfCtrl.selectedLayerId}
      currentTime={wfCtrl.currentTime}
      shots={wfCtrl.shotItems}
      activeShotId={wfCtrl.activeShotId}
      focusedShotId={wfCtrl.focusedShotId}
      jsonMode={isJson}
      isColumnExpanded={isColumnExpanded}
      onToggleColumnExpanded={handleToggleColumnExpanded}
      onSetJsonMode={(nextJson) => {
        setSplitBottomMode(nextJson ? 'json' : 'node')
        if (isColumnExpanded) setTab(nextJson ? 'json' : 'node')
      }}
      onSelectShotFocus={(shotId) => wfCtrl.handleFocusShot(shotId)}
      onUpdateParams={wfCtrl.actions.updateParams}
      onToggleEnable={wfCtrl.actions.toggleEnable}
      onDeleteNode={wfCtrl.actions.deleteNode}
      onAttachLogic={wfCtrl.actions.attachLogic}
      onSpawnCameraWaypoint={wfCtrl.actions.spawnCameraWaypoint}
      onSelectNode={(id) => wfCtrl.activateNode(id, true, false)}
      onConnectLayer={(layerNodeId, logicNodeId) =>
        wfCtrl.actions.connect(layerNodeId, 'layers_tree', logicNodeId, 'layers_tree')
      }
      onScrubTime={wfCtrl.setTime}
    />
  )

  const renderNodeJsonTabBar = (dockedBottom: boolean) => {
    const isNodeActive = isColumnExpanded ? tab === 'node' : effectiveBottomMode === 'node'
    const isJsonActive = isColumnExpanded ? tab === 'json' : effectiveBottomMode === 'json'
    return (
      <div
        className={`wf-v2-insp-tabs${dockedBottom ? ' docked-bottom' : ' split-header'}`}
        role="tablist"
        aria-label="Thuộc tính Node và JSON Cảnh"
      >
        <button
          id="tab-node-props"
          type="button"
          role="tab"
          aria-selected={isNodeActive}
          className={`wf-v2-insp-tab${isNodeActive ? ' active' : ''}`}
          title="Cấu hình BBox 2D, X/Y/Z, thời lượng và các logic 2.5D (Vật lý, Ánh sáng, Chuyển động, Cửa hang) cho cả Timeline & Workflow"
          onClick={() => {
            setSplitBottomMode('node')
            if (isColumnExpanded) setTab('node')
          }}
        >
          <span>🎛️ Thuộc tính Node</span>
        </button>
        <button
          id="tab-shot-json"
          type="button"
          role="tab"
          aria-selected={isJsonActive}
          className={`wf-v2-insp-tab${isJsonActive ? ' active' : ''}`}
          title="Xem và chỉnh sửa JSON độc lập của từng Cảnh (shot-N.json) và lộ trình chính (main.json)"
          onClick={() => {
            setSplitBottomMode('json')
            if (isColumnExpanded) setTab('json')
          }}
        >
          <code>{'{ }'}</code>
          <span>JSON Cảnh</span>
        </button>
        <button
          id="btn-expand-right-column"
          type="button"
          className={`wf-v2-insp-expand-btn${isColumnExpanded ? ' active' : ''}`}
          aria-pressed={isColumnExpanded}
          title={
            isColumnExpanded
              ? 'Đang mở rộng chiếm hết cột phải (4 tab ở trên, 2 tab Node & JSON ở đáy màn hình) — nhấn để chia đôi trên/dưới'
              : 'Mở rộng chiếm hết 1 cột bên phải màn hình (4 tab trên giữ nguyên, 2 tab Thuộc tính Node & JSON Cảnh nằm dưới đáy màn hình)'
          }
          onClick={handleToggleColumnExpanded}
        >
          <span className="exp-ico">{isColumnExpanded ? '⤡' : '⤢'}</span>
          <span>{isColumnExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
        </button>
      </div>
    )
  }

  return (
    <aside
      className={`right${isColumnExpanded ? ' is-full-column' : ' is-split-column'}`}
      data-mcp-region="inspector"
    >
      <div
        className={`wf-v2-insp-resizer right-col-resizer${resizingWidth ? ' dragging' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Kéo co dãn độ rộng cột phải"
        title={`Kéo trái/phải để mở rộng cột phải (Hiện tại: ${colWidth}px)`}
        onPointerDown={startResizeWidth}
      />

      {isColumnExpanded ? (
        <section className="panel right-unified-panel" style={{ flex: 1 }}>
          <div className="tabs" data-mcp-region="inspector_tabs">
            <button id="tab-layer" className={`tab${tab === 'layer' ? ' active' : ''}`} onClick={() => setTab('layer')}>
              {tabTitle}
            </button>
            <button id="tab-camera" className={`tab${tab === 'camera' ? ' active' : ''}`} onClick={() => setTab('camera')}>
              Camera
            </button>
            <button
              id="tab-route"
              className={`tab${tab === 'route' ? ' active' : ''}`}
              onClick={() => setTab('route')}
              title="Lộ trình di chuyển và thu phóng Camera 2D (Adobe Animate)"
            >
              Lộ trình
            </button>
            <button id="tab-scene" className={`tab${tab === 'scene' ? ' active' : ''}`} onClick={() => setTab('scene')}>
              Dự án
            </button>
            <button
              type="button"
              className={`tab-width-btn${colWidth >= WIDE_PRESET_W - 10 ? ' active' : ''}`}
              title={`Mở rộng nhanh bề ngang cột phải (${colWidth}px) — hoặc kéo mép trái cột để chỉnh tự do`}
              onClick={handleToggleWideWidth}
            >
              ⇔
            </button>
          </div>

          <div
            className={`panel-body right-unified-body${tab === 'node' || tab === 'json' ? ' is-node-or-json' : ''}`}
            data-mcp-region="inspector_body"
          >
            {(tab === 'layer' || tab === 'camera' || tab === 'route' || tab === 'scene') &&
              renderTopTabBody(tab)}
            {(tab === 'node' || tab === 'json') && renderWorkflowInspector(tab === 'json')}
          </div>

          {renderNodeJsonTabBar(true)}
        </section>
      ) : (
        <>
          <section className="panel right-top-split" style={{ flex: 1 }}>
            <div className="tabs" data-mcp-region="inspector_tabs">
              <button
                id="tab-layer"
                className={`tab${topTabInSplit === 'layer' ? ' active' : ''}`}
                onClick={() => setTab('layer')}
              >
                {tabTitle}
              </button>
              <button
                id="tab-camera"
                className={`tab${topTabInSplit === 'camera' ? ' active' : ''}`}
                onClick={() => setTab('camera')}
              >
                Camera
              </button>
              <button
                id="tab-route"
                className={`tab${topTabInSplit === 'route' ? ' active' : ''}`}
                onClick={() => setTab('route')}
                title="Lộ trình di chuyển và thu phóng Camera 2D (Adobe Animate)"
              >
                Lộ trình
              </button>
              <button
                id="tab-scene"
                className={`tab${topTabInSplit === 'scene' ? ' active' : ''}`}
                onClick={() => setTab('scene')}
              >
                Dự án
              </button>
              <button
                type="button"
                className={`tab-width-btn${colWidth >= WIDE_PRESET_W - 10 ? ' active' : ''}`}
                title={`Mở rộng nhanh bề ngang cột phải (${colWidth}px)`}
                onClick={handleToggleWideWidth}
              >
                ⇔
              </button>
            </div>
            <div className="panel-body" data-mcp-region="inspector_body">
              {renderTopTabBody(topTabInSplit)}
            </div>
          </section>

          <section className="panel right-bottom-split">
            {renderNodeJsonTabBar(false)}
            <div className="panel-body right-unified-body is-node-or-json">
              {renderWorkflowInspector(effectiveBottomMode === 'json')}
            </div>
          </section>
        </>
      )}
    </aside>
  )
}
