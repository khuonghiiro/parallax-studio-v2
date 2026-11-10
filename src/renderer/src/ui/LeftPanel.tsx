import React, { useEffect, useMemo, useReducer, useState } from 'react'
import { assetStore } from '../project/assets'
import { useEditor } from '../store/editor'
import { useView, type LeftTab } from '../store/view'
import { AssetPanel } from './assets/AssetPanel'
import {
  IconExpandToStage,
  IconFilm,
  IconFolder,
  IconRoute,
  IconSidebarLeftCollapse,
  IconSideElevationZY,
  IconTopDownXZ
} from './icons'
import {
  CollapsibleRail,
  IconActionBtn,
  SegmentedTabs,
  ToolCluster,
  useResponsiveViewport,
  type SegmentedTabItem
} from './primitives'
import { ShotsPanel } from './ShotsPanel'
import { TopView, useFocusShotId } from './TopView'

const LEFT_WIDTH_KEY = 'pxs:left-col-width'
const MIN_LEFT_W = 224
const MAX_LEFT_W = 480
const DEFAULT_LEFT_W = 296
const COLLAPSED_LEFT_W = 40

function readInitialLeftWidth(): number {
  try {
    const raw = Number(localStorage.getItem(LEFT_WIDTH_KEY))
    if (Number.isFinite(raw) && raw >= MIN_LEFT_W && raw <= MAX_LEFT_W) return Math.round(raw)
  } catch {
    /* ignore */
  }
  return DEFAULT_LEFT_W
}

export function LeftPanel() {
  const assets = useEditor((s) => s.project.assets)
  const shots = useEditor((s) => s.project.shots)
  const [, force] = useReducer((x: number) => x + 1, 0)
  const tab = useView((s) => s.leftTab)
  const setTab = useView((s) => s.setLeftTab)
  const leftCollapsed = useView((s) => s.leftCollapsed)
  const setLeftCollapsed = useView((s) => s.setLeftCollapsed)
  const topViewMode = useView((s) => s.topViewMode)
  const focusShotId = useFocusShotId()
  const { isDrawerMode } = useResponsiveViewport()

  const [colWidth, setColWidth] = useState<number>(readInitialLeftWidth)
  const [resizing, setResizing] = useState(false)

  useEffect(() => assetStore.subscribe(force), [])

  const effectiveCollapsed = !isDrawerMode && leftCollapsed

  useEffect(() => {
    const w = effectiveCollapsed ? COLLAPSED_LEFT_W : colWidth
    document.documentElement.style.setProperty('--left-col-w', `${w}px`)
  }, [colWidth, effectiveCollapsed])

  const startResizeWidth = (e: React.PointerEvent): void => {
    if (effectiveCollapsed || isDrawerMode) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colWidth
    setResizing(true)

    const onMove = (ev: PointerEvent): void => {
      const next = Math.round(Math.max(MIN_LEFT_W, Math.min(MAX_LEFT_W, startW + (ev.clientX - startX))))
      setColWidth(next)
      try {
        localStorage.setItem(LEFT_WIDTH_KEY, String(next))
      } catch {
        /* ignore */
      }
    }
    const onUp = (): void => {
      setResizing(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleExpandToViewer = (): void => {
    useView.getState().set({ primary: 'topview' })
  }

  const tabItems = useMemo<SegmentedTabItem<LeftTab>[]>(
    () => [
      {
        id: 'shots',
        domId: 'tab-shots',
        label: 'Cảnh',
        icon: <IconFilm width={13} height={13} />,
        badge: shots.length > 0 ? shots.length : undefined,
        title: 'Quản lý danh sách các cảnh (Shots)'
      },
      {
        id: 'assets',
        domId: 'tab-assets',
        label: 'Tài nguyên',
        icon: <IconFolder width={13} height={13} />,
        badge: assets.length > 0 ? assets.length : undefined,
        title: 'Thư viện tài nguyên ảnh, mô hình 3D, lắp ráp 2.5D & âm thanh'
      },
      {
        id: 'topview',
        domId: 'tab-topview',
        label: 'Sơ đồ 3D',
        icon: <IconRoute width={13} height={13} />,
        title: 'Sơ đồ độ sâu không gian 2.5D (Top-down & Side-elevation)'
      }
    ],
    [shots.length, assets.length]
  )

  if (effectiveCollapsed) {
    return (
      <CollapsibleRail<LeftTab>
        side="left"
        activeId={tab}
        expandDomId="btn-show-left-column"
        expandTitle="Mở rộng cột trái (Cảnh · Tài nguyên · Sơ đồ 3D)"
        mcpRegion="left_panel"
        tabsMcpRegion="left_tabs"
        items={[
          {
            id: 'shots',
            domId: 'rail-tab-shots',
            label: 'Cảnh',
            icon: <IconFilm width={15} height={15} />,
            badge: shots.length,
            title: `Mở danh sách Cảnh (${shots.length} cảnh)`
          },
          {
            id: 'assets',
            domId: 'rail-tab-assets',
            label: 'Tài nguyên',
            icon: <IconFolder width={15} height={15} />,
            badge: assets.length,
            title: `Mở Thư viện Tài nguyên (${assets.length} tệp dự án)`
          },
          {
            id: 'topview',
            domId: 'rail-tab-topview',
            label: 'Sơ đồ 3D',
            icon: <IconRoute width={15} height={15} />,
            accent: 'cyan',
            title: 'Mở Sơ đồ độ sâu không gian 2.5D'
          }
        ]}
        onExpand={() => setLeftCollapsed(false)}
        onSelectItem={(nextTab) => {
          setTab(nextTab)
          setLeftCollapsed(false)
        }}
      />
    )
  }

  return (
    <aside className="left" data-mcp-region="left_panel">
      {!isDrawerMode && (
        <div
          className={`left-col-resizer${resizing ? ' dragging' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo co dãn độ rộng cột trái"
          title={`Kéo trái/phải để đổi độ rộng cột trái (${colWidth}px)`}
          onPointerDown={startResizeWidth}
        />
      )}

      <section className="panel" style={{ flex: '1 1 100%', height: '100%' }}>
        <SegmentedTabs<LeftTab>
          items={tabItems}
          value={tab}
          onChange={setTab}
          variant="underline"
          adaptiveCompact
          ariaLabel="Chế độ cột bên trái"
          mcpRegion="left_tabs"
          trailing={
            !isDrawerMode ? (
              <IconActionBtn
                id="btn-collapse-left-column"
                size="xs"
                icon={<IconSidebarLeftCollapse width={13} height={13} />}
                title="Thu gọn cột trái thành thanh Icon Rail dọc để mở rộng Viewport & Timeline"
                onClick={() => setLeftCollapsed(true)}
              />
            ) : undefined
          }
        />

        {tab === 'shots' && (
          <div className="panel-body">
            <ShotsPanel />
          </div>
        )}

        {tab === 'assets' && <AssetPanel />}

        {tab === 'topview' && (
          <div
            data-mcp-region="topview"
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: '1 1 0%',
              minHeight: 0,
              height: '100%',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div className="topview-toolbar">
              <ToolCluster ariaLabel="Góc chiếu sơ đồ 2.5D" className="topview-header-switcher">
                <IconActionBtn
                  size="xs"
                  active={topViewMode === 'top'}
                  icon={<IconTopDownXZ width={13} height={13} />}
                  label="Top (X-Z)"
                  onClick={() => useView.getState().set({ topViewMode: 'top' })}
                  title="Nhìn từ trên đỉnh (Top View X-Z): Căn vị trí trái - phải và độ sâu xa - gần"
                />
                <IconActionBtn
                  size="xs"
                  active={topViewMode === 'side'}
                  icon={<IconSideElevationZY width={13} height={13} />}
                  label="Side (Z-Y)"
                  onClick={() => useView.getState().set({ topViewMode: 'side' })}
                  title="Nhìn từ cạnh hông (Side View Z-Y): Căn độ cao nâng - hạ và độ dốc sàn đất"
                />
              </ToolCluster>
              <span className="spacer" />
              <IconActionBtn
                size="xs"
                tone="cyan"
                compactHideLabel
                icon={<IconExpandToStage width={13} height={13} />}
                label="Mở rộng"
                onClick={handleExpandToViewer}
                title="Mở rộng sơ đồ độ sâu ra khung hình Viewport chính giữa màn hình"
              />
            </div>
            <div style={{ flex: '1 1 0%', position: 'relative', minHeight: 0, height: '100%', overflow: 'hidden' }}>
              <TopView shotId={focusShotId} />
            </div>
          </div>
        )}
      </section>
    </aside>
  )
}
