import { useEffect, useReducer, useState } from 'react'
import { assetStore } from '../project/assets'
import { useEditor } from '../store/editor'
import { AssetPanel } from './assets/AssetPanel'
import { IconFilm, IconImage } from './icons'
import { ShotsPanel } from './ShotsPanel'
import { TopView, useFocusShotId } from './TopView'

type LeftTab = 'shots' | 'assets'

export function LeftPanel() {
  const assets = useEditor((s) => s.project.assets)
  const shots = useEditor((s) => s.project.shots)
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [tab, setTab] = useState<LeftTab>(() => (localStorage.getItem('pxs.leftTab') as LeftTab) || 'shots')
  const focusShotId = useFocusShotId()
  const focusShot = shots.find((s) => s.id === focusShotId)

  useEffect(() => assetStore.subscribe(force), [])
  useEffect(() => localStorage.setItem('pxs.leftTab', tab), [tab])

  return (
    <aside className="left">
      <section className="panel" style={{ flex: '1 1 55%' }}>
        <div className="tabs">
          <button id="tab-shots" className={`tab${tab === 'shots' ? ' active' : ''}`} onClick={() => setTab('shots')}>
            <IconFilm width={12} height={12} /> Cảnh {shots.length > 0 && <span className="tab-count">{shots.length}</span>}
          </button>
          <button id="tab-assets" className={`tab${tab === 'assets' ? ' active' : ''}`} onClick={() => setTab('assets')}>
            <IconImage width={12} height={12} /> Assets {assets.length > 0 && <span className="tab-count">{assets.length}</span>}
          </button>
        </div>
        {tab === 'shots' ? (
          <div className="panel-body">
            <ShotsPanel />
          </div>
        ) : (
          <AssetPanel />
        )}
      </section>
      <section className="panel" style={{ flex: '1 1 45%' }}>
        <div className="panel-header">
          Sơ đồ độ sâu · nhìn từ trên
          {focusShot && (
            <>
              <span className="spacer" />
              <span className="shot-chip" style={{ ['--c' as string]: focusShot.color }}>
                {focusShot.name}
              </span>
            </>
          )}
        </div>
        <div className="panel-body" style={{ position: 'relative', overflow: 'hidden' }}>
          <TopView shotId={focusShotId} />
        </div>
      </section>
    </aside>
  )
}
