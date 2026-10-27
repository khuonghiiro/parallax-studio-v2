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

type TopTabId = 'layer' | 'camera' | 'route' | 'scene'

const COL_EXPANDED_KEY = 'pxs:right-col-expanded'
const COL_COLLAPSED_KEY = 'pxs:right-col-collapsed'
const COL_WIDTH_KEY = 'pxs:wf-v2-inspector-width'
const MIN_COL_W = 280
const MAX_COL_W = 680
const DEFAULT_EXPANDED_W = 420
const COLLAPSED_RAIL_W = 38

function readInitialColWidth(): number {
  const raw = Number(localStorage.getItem(COL_WIDTH_KEY))
  if (Number.isFinite(raw) && raw >= MIN_COL_W && raw <= MAX_COL_W) return Math.round(raw)
  return DEFAULT_EXPANDED_W
}

function isTopTab(tab: string): tab is TopTabId {
  return tab === 'layer' || tab === 'camera' || tab === 'route' || tab === 'scene'
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
  // Trạng thái ẩn/hiện cột phải thành thanh dọc sát mép phải màn hình
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(
    () => localStorage.getItem(COL_COLLAPSED_KEY) === '1'
  )
  const [lastTopTab, setLastTopTab] = useState<TopTabId>('layer')
  const [splitBottomMode, setSplitBottomMode] = useState<'node' | 'json'>('node')
  const [colWidth, setColWidth] = useState<number>(readInitialColWidth)
  const [resizingWidth, setResizingWidth] = useState(false)

  useEffect(() => {
    if (isTopTab(tab)) setLastTopTab(tab)
    else if (tab === 'node' || tab === 'json') setSplitBottomMode(tab)
  }, [tab])

  // Đồng bộ biến CSS `--right-col-w` lên `.app` (khi ẩn chỉ chiếm 38px thanh dọc sát phải để mở rộng Timeline/Workflow)
  useEffect(() => {
    const effectiveW = isRightCollapsed ? COLLAPSED_RAIL_W : colWidth
    document.documentElement.style.setProperty('--right-col-w', `${effectiveW}px`)
  }, [colWidth, isRightCollapsed])

  // Bộ điều khiển chung cho Thuộc tính Node & JSON Cảnh & Main (dùng chung cho cả Timeline và Workflow)
  const wfCtrl = useWorkflowV2Controller()
  useWorkflowV2SelectionSync(wfCtrl)

  const handleSetRightCollapsed = (next: boolean): void => {
    localStorage.setItem(COL_COLLAPSED_KEY, next ? '1' : '0')
    setIsRightCollapsed(next)
  }

  const updateColWidth = (nextW: number): void => {
    const clamped = Math.round(Math.max(MIN_COL_W, Math.min(MAX_COL_W, nextW)))
    setColWidth(clamped)
    localStorage.setItem(COL_WIDTH_KEY, String(clamped))
  }

  const startResizeWidth = (e: React.PointerEvent): void => {
    if (isRightCollapsed) return
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

  const isTopGroupExpanded = isColumnExpanded && isTopTab(tab)
  const isBottomGroupExpanded = isColumnExpanded && (tab === 'node' || tab === 'json')

  const handleToggleTopGroupExpand = (): void => {
    if (isTopGroupExpanded) {
      localStorage.setItem(COL_EXPANDED_KEY, '0')
      setIsColumnExpanded(false)
    } else {
      localStorage.setItem(COL_EXPANDED_KEY, '1')
      setIsColumnExpanded(true)
      if (!isTopTab(tab)) setTab(lastTopTab)
      if (colWidth < DEFAULT_EXPANDED_W) updateColWidth(DEFAULT_EXPANDED_W)
    }
  }

  const handleToggleBottomGroupExpand = (): void => {
    if (isBottomGroupExpanded) {
      localStorage.setItem(COL_EXPANDED_KEY, '0')
      setIsColumnExpanded(false)
      setSplitBottomMode(tab === 'json' ? 'json' : 'node')
      setTab(lastTopTab)
    } else {
      localStorage.setItem(COL_EXPANDED_KEY, '1')
      setIsColumnExpanded(true)
      setTab(splitBottomMode)
      if (colWidth < DEFAULT_EXPANDED_W) updateColWidth(DEFAULT_EXPANDED_W)
    }
  }

  const tabTitle = audioTrack ? 'Âm thanh' : !layer && shot ? 'Cảnh này' : 'Layer'
  const topTabInSplit: TopTabId = isTopTab(tab) ? tab : lastTopTab
  const effectiveBottomMode: 'node' | 'json' =
    tab === 'json' ? 'json' : tab === 'node' ? 'node' : splitBottomMode

  const renderTopTabBar = () => {
    const activeTop = isColumnExpanded ? (isTopTab(tab) ? tab : null) : topTabInSplit
    return (
      <div className="tabs" data-mcp-region="inspector_tabs">
        <button
          id="tab-layer"
          className={`tab${activeTop === 'layer' ? ' active' : ''}`}
          onClick={() => setTab('layer')}
        >
          {tabTitle}
        </button>
        <button
          id="tab-camera"
          className={`tab${activeTop === 'camera' ? ' active' : ''}`}
          onClick={() => setTab('camera')}
        >
          Camera
        </button>
        <button
          id="tab-route"
          className={`tab${activeTop === 'route' ? ' active' : ''}`}
          onClick={() => setTab('route')}
          title="Lộ trình di chuyển và thu phóng Camera 2D (Adobe Animate)"
        >
          Lộ trình
        </button>
        <button
          id="tab-scene"
          className={`tab${activeTop === 'scene' ? ' active' : ''}`}
          onClick={() => setTab('scene')}
        >
          Dự án
        </button>
        <button
          id="btn-expand-top-tabs"
          type="button"
          className={`wf-v2-insp-expand-btn${isTopGroupExpanded ? ' active' : ''}`}
          aria-pressed={isTopGroupExpanded}
          title={
            isTopGroupExpanded
              ? 'Đang mở rộng cụm 4 tab chiếm hết cột phải — nhấn để thu về chế độ chia đôi trên/dưới'
              : 'Mở rộng cụm 4 tab (Layer · Camera · Lộ trình · Dự án) chiếm hết cột phải màn hình'
          }
          onClick={handleToggleTopGroupExpand}
        >
          <span className="exp-ico">{isTopGroupExpanded ? '⤡' : '⤢'}</span>
          <span>{isTopGroupExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
        </button>
      </div>
    )
  }

  const renderTopTabBody = (activeTopTab: TopTabId) => (
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
      isColumnExpanded={isBottomGroupExpanded}
      onToggleColumnExpanded={handleToggleBottomGroupExpand}
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
      onDisconnectEdge={wfCtrl.actions.disconnect}
      onToggleEdgeDisable={wfCtrl.actions.toggleEdgeDisable}
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
          title="Cấu hình đúng logic riêng của Node đang chọn (BBox 2D / 2.5D cố định trên đầu + thông số riêng của Node đó)"
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
          className={`wf-v2-insp-expand-btn${isBottomGroupExpanded ? ' active' : ''}`}
          aria-pressed={isBottomGroupExpanded}
          title={
            isBottomGroupExpanded
              ? 'Đang mở rộng Thuộc tính Node & JSON Cảnh chiếm hết cột phải — nhấn để thu về chế độ chia đôi trên/dưới'
              : 'Mở rộng Thuộc tính Node & JSON Cảnh chiếm hết cột phải màn hình (4 tab trên giữ nguyên, 2 tab này nằm dưới đáy màn hình)'
          }
          onClick={handleToggleBottomGroupExpand}
        >
          <span className="exp-ico">{isBottomGroupExpanded ? '⤡' : '⤢'}</span>
          <span>{isBottomGroupExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
        </button>
        <button
          id="btn-toggle-right-column"
          type="button"
          className="wf-v2-insp-expand-btn wf-v2-insp-collapse-btn"
          aria-pressed={isRightCollapsed}
          title="Ẩn cột phải thành thanh dọc sát mép phải màn hình để mở rộng chiều ngang cho Timeline & Workflow"
          onClick={() => handleSetRightCollapsed(true)}
        >
          <span className="exp-ico">»</span>
          <span>Ẩn</span>
        </button>
      </div>
    )
  }

  if (isRightCollapsed) {
    return (
      <aside className="right is-collapsed-rail" data-mcp-region="inspector">
        <div className="right-collapsed-rail" data-mcp-region="inspector_tabs">
          <button
            id="btn-show-right-column"
            type="button"
            className="right-rail-show-btn"
            title="Hiện lại cột phải (Layer · Camera · Lộ trình · Dự án · Thuộc tính Node · JSON Cảnh) như cũ"
            onClick={() => handleSetRightCollapsed(false)}
          >
            <span className="rail-arrow">«</span>
            <span className="rail-show-text">Hiện</span>
          </button>

          <div className="right-rail-group" role="tablist" aria-label="4 tab trên">
            <button
              type="button"
              className={`right-rail-pill${tab === 'layer' ? ' active' : ''}`}
              title={`Mở tab ${tabTitle}`}
              onClick={() => {
                setTab('layer')
                handleSetRightCollapsed(false)
              }}
            >
              <span>{tabTitle}</span>
            </button>
            <button
              type="button"
              className={`right-rail-pill${tab === 'camera' ? ' active' : ''}`}
              title="Mở tab Camera"
              onClick={() => {
                setTab('camera')
                handleSetRightCollapsed(false)
              }}
            >
              <span>Camera</span>
            </button>
            <button
              type="button"
              className={`right-rail-pill${tab === 'route' ? ' active' : ''}`}
              title="Mở tab Lộ trình"
              onClick={() => {
                setTab('route')
                handleSetRightCollapsed(false)
              }}
            >
              <span>Lộ trình</span>
            </button>
            <button
              type="button"
              className={`right-rail-pill${tab === 'scene' ? ' active' : ''}`}
              title="Mở tab Dự án"
              onClick={() => {
                setTab('scene')
                handleSetRightCollapsed(false)
              }}
            >
              <span>Dự án</span>
            </button>
          </div>

          <div className="right-rail-bottom" data-mcp-region="inspector_body">
            <button
              id="rail-tab-node-props"
              type="button"
              className={`right-rail-pill bottom-pill${tab === 'node' ? ' active' : ''}`}
              title="Hiện lại Thuộc tính Node"
              onClick={() => {
                setSplitBottomMode('node')
                if (isColumnExpanded) setTab('node')
                handleSetRightCollapsed(false)
              }}
            >
              <span>🎛️ Thuộc tính Node</span>
            </button>
            <button
              id="rail-tab-shot-json"
              type="button"
              className={`right-rail-pill bottom-pill${tab === 'json' ? ' active' : ''}`}
              title="Hiện lại JSON Cảnh"
              onClick={() => {
                setSplitBottomMode('json')
                if (isColumnExpanded) setTab('json')
                handleSetRightCollapsed(false)
              }}
            >
              <span>{'{ }'} JSON Cảnh</span>
            </button>
          </div>
        </div>
      </aside>
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
          {renderTopTabBar()}

          <div
            className={`panel-body right-unified-body${tab === 'node' || tab === 'json' ? ' is-node-or-json' : ''}`}
            data-mcp-region="inspector_body"
          >
            {isTopTab(tab) && renderTopTabBody(tab)}
            {(tab === 'node' || tab === 'json') && renderWorkflowInspector(tab === 'json')}
          </div>

          {renderNodeJsonTabBar(true)}
        </section>
      ) : (
        <>
          <section className="panel right-top-split" style={{ flex: 1 }}>
            {renderTopTabBar()}
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
