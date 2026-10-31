import React, { useEffect, useMemo, useState } from 'react'
import { findLayer, findShot, useEditor } from '../store/editor'
import { useView } from '../store/view'
import {
  IconCameraLens,
  IconCompFrame,
  IconFilm,
  IconJsonBraces,
  IconLayers,
  IconMusic,
  IconNodeCircuit,
  IconPaneMaximizeV,
  IconPaneSplitH,
  IconRouteWaypoints,
  IconSidebarRightCollapse
} from './icons'
import {
  CollapsibleRail,
  IconActionBtn,
  SegmentedTabs,
  useResponsiveViewport,
  type SegmentedTabItem
} from './primitives'
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
type InspectorAnyTab = TopTabId | 'node' | 'json'

const COL_WIDTH_KEY = 'pxs:wf-v2-inspector-width'
const MIN_COL_W = 280
const MAX_COL_W = 680
const DEFAULT_EXPANDED_W = 420
const COLLAPSED_RAIL_W = 40

function readInitialColWidth(): number {
  try {
    const raw = Number(localStorage.getItem(COL_WIDTH_KEY))
    if (Number.isFinite(raw) && raw >= MIN_COL_W && raw <= MAX_COL_W) return Math.round(raw)
  } catch {
    /* ignore */
  }
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

  const isColumnExpanded = useView((s) => s.inspectorExpanded)
  const setIsColumnExpanded = useView((s) => s.setInspectorExpanded)
  const isRightCollapsed = useView((s) => s.rightCollapsed)
  const setRightCollapsed = useView((s) => s.setRightCollapsed)
  const { isDrawerMode } = useResponsiveViewport()

  const [lastTopTab, setLastTopTab] = useState<TopTabId>('layer')
  const [splitBottomMode, setSplitBottomMode] = useState<'node' | 'json'>('node')
  const [colWidth, setColWidth] = useState<number>(readInitialColWidth)
  const [resizingWidth, setResizingWidth] = useState(false)

  useEffect(() => {
    if (isTopTab(tab)) setLastTopTab(tab)
    else if (tab === 'node' || tab === 'json') setSplitBottomMode(tab)
  }, [tab])

  const effectiveCollapsed = !isDrawerMode && isRightCollapsed

  useEffect(() => {
    const effectiveW = effectiveCollapsed ? COLLAPSED_RAIL_W : colWidth
    document.documentElement.style.setProperty('--right-col-w', `${effectiveW}px`)
  }, [colWidth, effectiveCollapsed])

  // Bộ điều khiển chung cho Thuộc tính Node & JSON Cảnh & Main (dùng chung cho cả Timeline và Workflow)
  const wfCtrl = useWorkflowV2Controller()
  useWorkflowV2SelectionSync(wfCtrl)

  const updateColWidth = (nextW: number): void => {
    const clamped = Math.round(Math.max(MIN_COL_W, Math.min(MAX_COL_W, nextW)))
    setColWidth(clamped)
    try {
      localStorage.setItem(COL_WIDTH_KEY, String(clamped))
    } catch {
      /* ignore */
    }
  }

  const startResizeWidth = (e: React.PointerEvent): void => {
    if (effectiveCollapsed || isDrawerMode) return
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
      setIsColumnExpanded(false)
    } else {
      setIsColumnExpanded(true)
      if (!isTopTab(tab)) setTab(lastTopTab)
      if (colWidth < DEFAULT_EXPANDED_W) updateColWidth(DEFAULT_EXPANDED_W)
    }
  }

  const handleToggleBottomGroupExpand = (): void => {
    if (isBottomGroupExpanded) {
      setIsColumnExpanded(false)
      setSplitBottomMode(tab === 'json' ? 'json' : 'node')
      setTab(lastTopTab)
    } else {
      setIsColumnExpanded(true)
      setTab(splitBottomMode)
      if (colWidth < DEFAULT_EXPANDED_W) updateColWidth(DEFAULT_EXPANDED_W)
    }
  }

  const tabTitle = audioTrack ? 'Âm thanh' : !layer && shot ? 'Cảnh này' : 'Layer'
  const LayerContextIcon = audioTrack ? IconMusic : !layer && shot ? IconFilm : IconLayers
  const topTabInSplit: TopTabId = isTopTab(tab) ? tab : lastTopTab
  const effectiveBottomMode: 'node' | 'json' =
    tab === 'json' ? 'json' : tab === 'node' ? 'node' : splitBottomMode

  const topTabItems = useMemo<SegmentedTabItem<TopTabId>[]>(
    () => [
      {
        id: 'layer',
        domId: 'tab-layer',
        label: tabTitle,
        icon: <LayerContextIcon width={13} height={13} />,
        title: `Thuộc tính ${tabTitle} đang chọn`
      },
      {
        id: 'camera',
        domId: 'tab-camera',
        label: 'Camera',
        icon: <IconCameraLens width={13} height={13} />,
        title: 'Thông số ống kính, vị trí và tiêu cự Camera 3D'
      },
      {
        id: 'route',
        domId: 'tab-route',
        label: 'Lộ trình',
        icon: <IconRouteWaypoints width={13} height={13} />,
        title: 'Lộ trình di chuyển và thu phóng Camera 2D (Adobe Animate)'
      },
      {
        id: 'scene',
        domId: 'tab-scene',
        label: 'Dự án',
        icon: <IconCompFrame width={13} height={13} />,
        title: 'Thiết lập Composition, màu sắc điện ảnh và tổng thể dự án'
      }
    ],
    [tabTitle, LayerContextIcon]
  )

  const bottomTabItems = useMemo<SegmentedTabItem<'node' | 'json'>[]>(
    () => [
      {
        id: 'node',
        domId: 'tab-node-props',
        label: 'Thuộc tính Node',
        icon: <IconNodeCircuit width={13} height={13} />,
        title: 'Cấu hình đúng logic riêng của Node đang chọn (BBox 2D / 2.5D cố định trên đầu + thông số riêng của Node đó)'
      },
      {
        id: 'json',
        domId: 'tab-shot-json',
        label: 'JSON Cảnh',
        icon: <IconJsonBraces width={13} height={13} />,
        title: 'Xem và chỉnh sửa JSON độc lập của từng Cảnh (shot-N.json) và lộ trình chính (main.json)'
      }
    ],
    []
  )

  const renderTopTabBar = () => {
    const activeTop = isColumnExpanded ? (isTopTab(tab) ? tab : null) : topTabInSplit
    return (
      <SegmentedTabs<TopTabId>
        items={topTabItems}
        value={activeTop}
        onChange={(next) => setTab(next)}
        variant="underline"
        adaptiveCompact
        ariaLabel="Chế độ thanh tra thuộc tính"
        mcpRegion="inspector_tabs"
        trailing={
          <>
            <IconActionBtn
              id="btn-expand-top-tabs"
              size="xs"
              tone="cyan"
              active={isTopGroupExpanded}
              icon={
                isTopGroupExpanded ? (
                  <IconPaneSplitH width={13} height={13} />
                ) : (
                  <IconPaneMaximizeV width={13} height={13} />
                )
              }
              title={
                isTopGroupExpanded
                  ? 'Đang mở rộng cụm 4 tab chiếm hết cột phải — nhấn để thu về chế độ chia đôi trên/dưới'
                  : 'Mở rộng cụm 4 tab (Layer · Camera · Lộ trình · Dự án) chiếm hết cột phải màn hình'
              }
              onClick={handleToggleTopGroupExpand}
            />
            {!isDrawerMode && (
              <IconActionBtn
                id="btn-toggle-right-column"
                size="xs"
                icon={<IconSidebarRightCollapse width={13} height={13} />}
                title="Thu gọn cột phải thành thanh Icon Rail dọc để mở rộng chiều ngang cho Viewport, Timeline & Workflow"
                onClick={() => setRightCollapsed(true)}
              />
            )}
          </>
        }
      />
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
    const activeBottom: 'node' | 'json' | null = isColumnExpanded
      ? tab === 'node' || tab === 'json'
        ? tab
        : null
      : effectiveBottomMode

    return (
      <SegmentedTabs<'node' | 'json'>
        items={bottomTabItems}
        value={activeBottom}
        onChange={(nextMode) => {
          setSplitBottomMode(nextMode)
          if (isColumnExpanded) setTab(nextMode)
        }}
        variant="docked"
        size="sm"
        dockBottom={dockedBottom}
        ariaLabel="Thuộc tính Node và JSON Cảnh"
        mcpRegion="inspector_bottom_tabs"
        className={`wf-v2-insp-tabs${dockedBottom ? ' docked-bottom' : ' split-header'}`}
        trailing={
          <>
            <IconActionBtn
              id="btn-expand-right-column"
              size="xs"
              tone="cyan"
              compactHideLabel
              active={isBottomGroupExpanded}
              icon={
                isBottomGroupExpanded ? (
                  <IconPaneSplitH width={13} height={13} />
                ) : (
                  <IconPaneMaximizeV width={13} height={13} />
                )
              }
              label={isBottomGroupExpanded ? 'Chia đôi' : 'Mở rộng'}
              title={
                isBottomGroupExpanded
                  ? 'Đang mở rộng Thuộc tính Node & JSON Cảnh chiếm hết cột phải — nhấn để thu về chế độ chia đôi trên/dưới'
                  : 'Mở rộng Thuộc tính Node & JSON Cảnh chiếm hết cột phải màn hình'
              }
              onClick={handleToggleBottomGroupExpand}
            />
          </>
        }
      />
    )
  }

  if (effectiveCollapsed) {
    return (
      <CollapsibleRail<InspectorAnyTab>
        side="right"
        activeId={tab as InspectorAnyTab}
        expandDomId="btn-show-right-column"
        expandTitle="Mở rộng lại cột phải (Layer · Camera · Lộ trình · Dự án · Thuộc tính Node · JSON Cảnh)"
        mcpRegion="inspector"
        tabsMcpRegion="inspector_tabs"
        bottomMcpRegion="inspector_bottom_tabs"
        items={[
          {
            id: 'layer',
            domId: 'rail-tab-layer',
            label: tabTitle,
            icon: <LayerContextIcon width={15} height={15} />,
            title: `Mở tab ${tabTitle}`
          },
          {
            id: 'camera',
            domId: 'rail-tab-camera',
            label: 'Camera',
            icon: <IconCameraLens width={15} height={15} />,
            title: 'Mở tab Camera 3D'
          },
          {
            id: 'route',
            domId: 'rail-tab-route',
            label: 'Lộ trình',
            icon: <IconRouteWaypoints width={15} height={15} />,
            title: 'Mở tab Lộ trình Camera 2D'
          },
          {
            id: 'scene',
            domId: 'rail-tab-scene',
            label: 'Dự án',
            icon: <IconCompFrame width={15} height={15} />,
            title: 'Mở tab Thiết lập Dự án'
          }
        ]}
        bottomItems={[
          {
            id: 'node',
            domId: 'rail-tab-node-props',
            label: 'Thuộc tính Node',
            icon: <IconNodeCircuit width={15} height={15} />,
            accent: 'cyan',
            title: 'Mở bảng Thuộc tính Node'
          },
          {
            id: 'json',
            domId: 'rail-tab-shot-json',
            label: 'JSON Cảnh',
            icon: <IconJsonBraces width={15} height={15} />,
            accent: 'cyan',
            title: 'Mở bảng JSON Cảnh & Main'
          }
        ]}
        onExpand={() => setRightCollapsed(false)}
        onSelectItem={(nextId) => {
          if (nextId === 'node' || nextId === 'json') {
            setSplitBottomMode(nextId)
            if (isColumnExpanded) setTab(nextId)
          } else {
            setTab(nextId)
          }
          setRightCollapsed(false)
        }}
      />
    )
  }

  return (
    <aside
      className={`right${isColumnExpanded ? ' is-full-column' : ' is-split-column'}`}
      data-mcp-region="inspector"
    >
      {!isDrawerMode && (
        <div
          className={`wf-v2-insp-resizer right-col-resizer${resizingWidth ? ' dragging' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo co dãn độ rộng cột phải"
          title={`Kéo trái/phải để mở rộng cột phải (Hiện tại: ${colWidth}px)`}
          onPointerDown={startResizeWidth}
        />
      )}

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
