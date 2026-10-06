import { useEffect, useReducer, useState } from 'react'
import { assetStore } from '../project/assets'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import { AssetPanel } from './assets/AssetPanel'
import { IconFilm, IconFolder, IconRoute } from './icons'
import { ShotsPanel } from './ShotsPanel'
import { TopView, useFocusShotId } from './TopView'

type LeftTab = 'shots' | 'assets' | 'topview'

export function LeftPanel() {
  const assets = useEditor((s) => s.project.assets)
  const shots = useEditor((s) => s.project.shots)
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [tab, setTab] = useState<LeftTab>(() => (localStorage.getItem('pxs.leftTab') as LeftTab) || 'shots')
  const topViewMode = useView((s) => s.topViewMode)
  const focusShotId = useFocusShotId()
  const focusShot = shots.find((s) => s.id === focusShotId)

  useEffect(() => assetStore.subscribe(force), [])
  useEffect(() => localStorage.setItem('pxs.leftTab', tab), [tab])

  const handleExpandToViewer = () => {
    useView.getState().set({ primary: 'topview' })
  }

  return (
    <aside className="left">
      <section className="panel" style={{ flex: '1 1 100%', height: '100%' }}>
        <div className="tabs">
          <button
            id="tab-shots"
            type="button"
            className={`tab${tab === 'shots' ? ' active' : ''}`}
            onClick={() => setTab('shots')}
            title="Quản lý danh sách các cảnh (Shots)"
          >
            <IconFilm width={12} height={12} /> Cảnh {shots.length > 0 && <span className="tab-count">{shots.length}</span>}
          </button>
          <button
            id="tab-assets"
            type="button"
            className={`tab${tab === 'assets' ? ' active' : ''}`}
            onClick={() => setTab('assets')}
            title="Thư viện tài nguyên ảnh & âm thanh"
          >
            <IconFolder width={12} height={12} /> Tài nguyên {assets.length > 0 && <span className="tab-count">{assets.length}</span>}
          </button>
          <button
            id="tab-topview"
            type="button"
            className={`tab${tab === 'topview' ? ' active' : ''}`}
            onClick={() => setTab('topview')}
            title="Sơ đồ độ sâu không gian 2.5D (Top-down view)"
          >
            <IconRoute width={12} height={12} /> Sơ đồ 3D
          </button>
        </div>

        {tab === 'shots' && (
          <div className="panel-body">
            <ShotsPanel />
          </div>
        )}

        {tab === 'assets' && (
          <AssetPanel />
        )}

        {tab === 'topview' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, height: '100%', position: 'relative', overflow: 'hidden' }}>
            <div className="topview-toolbar">
              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                Sơ đồ 2.5D
              </span>
              <div className="topview-header-switcher">
                <button
                  type="button"
                  className={`btn xs${topViewMode === 'top' ? ' active' : ''}`}
                  onClick={() => useView.getState().set({ topViewMode: 'top' })}
                  title="Nhìn từ trên đỉnh (Top View X-Z): Căn vị trí trái - phải và độ sâu xa - gần"
                >
                  ⬇️ Top (X-Z)
                </button>
                <button
                  type="button"
                  className={`btn xs${topViewMode === 'side' ? ' active' : ''}`}
                  onClick={() => useView.getState().set({ topViewMode: 'side' })}
                  title="Nhìn từ cạnh hông (Side View Z-Y): Căn độ cao nâng - hạ và độ dốc sàn đất"
                >
                  ➡️ Side (Z-Y)
                </button>
              </div>
              <span className="spacer" />
              <button
                type="button"
                className="btn sm"
                onClick={handleExpandToViewer}
                title="Mở rộng sơ đồ độ sâu ra khung hình Viewport chính giữa màn hình"
                style={{ fontSize: '10.5px' }}
              >
                Mở rộng ↗
              </button>
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
