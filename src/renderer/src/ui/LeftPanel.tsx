import { useEffect, useReducer, useState } from 'react'
import { addLayerFromAsset, importAudio, importImages, removeAsset } from '../actions'
import { assetStore } from '../project/assets'
import { useEditor } from '../store/editor'
import { IconFilm, IconImage, IconMusic, IconPlus, IconTrash } from './icons'
import { ShotsPanel } from './ShotsPanel'
import { TopView, useFocusShotId } from './TopView'

type LeftTab = 'shots' | 'assets'

export function LeftPanel() {
  const assets = useEditor((s) => s.project.assets)
  const audio = useEditor((s) => s.project.audio)
  const shots = useEditor((s) => s.project.shots)
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [hover, setHover] = useState<string | null>(null)
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
          <>
        <div className="panel-header">
          <IconImage width={14} height={14} />
          Assets
          <span className="spacer" />
          <button id="import-images" className="btn sm" onClick={() => importImages(false)} title="Nhập ảnh vào thư viện">
            <IconPlus /> Ảnh
          </button>
          <button id="import-audio" className="btn sm icon" onClick={importAudio} title="Nhập nhạc nền">
            <IconMusic />
          </button>
        </div>
        <div className="panel-body">
          {assets.length === 0 ? (
            <div className="empty">
              Kéo thả ảnh PNG (nền trong suốt) hoặc nhạc vào cửa sổ,
              <br />
              hoặc bấm <b>+ Ảnh</b> để bắt đầu.
            </div>
          ) : (
            <div className="asset-grid">
              {assets.map((a) => {
                const rt = assetStore.get(a.id)
                const isAudio = a.kind === 'audio'
                return (
                  <div
                    key={a.id}
                    className={`asset${isAudio ? ' audio' : ''}`}
                    title={isAudio ? `${a.name} — ${a.duration?.toFixed(1)}s` : `${a.name} — ${a.width}×${a.height}\nDouble-click để thêm layer`}
                    onDoubleClick={() => !isAudio && addLayerFromAsset(a.id)}
                    onMouseEnter={() => setHover(a.id)}
                    onMouseLeave={() => setHover(null)}
                    draggable={!isAudio}
                    onDragStart={(e) => e.dataTransfer.setData('application/x-pxs-asset', a.id)}
                  >
                    {isAudio ? (
                      <IconMusic width={26} height={26} style={{ color: audio?.assetId === a.id ? 'var(--accent-2)' : 'var(--text-faint)' }} />
                    ) : (
                      rt?.thumbUrl && <img src={rt.thumbUrl} alt={a.name} draggable={false} />
                    )}
                    <span className="asset-name">{a.name}</span>
                    {hover === a.id && (
                      <div className="add-hint" style={{ display: 'flex', gap: 3 }}>
                        {!isAudio && (
                          <button className="btn sm icon" title="Thêm thành layer" onClick={() => addLayerFromAsset(a.id)}>
                            <IconPlus />
                          </button>
                        )}
                        <button className="btn sm icon danger" title="Xoá asset" onClick={() => removeAsset(a.id)}>
                          <IconTrash />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
          </>
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
