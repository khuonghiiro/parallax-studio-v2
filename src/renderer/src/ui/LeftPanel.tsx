import { useEffect, useReducer, useState } from 'react'
import { addLayerFromAsset, importAudio, importImages, removeAsset } from '../actions'
import { assetStore } from '../project/assets'
import { useEditor } from '../store/editor'
import { IconImage, IconMusic, IconPlus, IconTrash } from './icons'
import { TopView } from './TopView'

export function LeftPanel() {
  const assets = useEditor((s) => s.project.assets)
  const audio = useEditor((s) => s.project.audio)
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [hover, setHover] = useState<string | null>(null)
  useEffect(() => assetStore.subscribe(force), [])

  return (
    <aside className="left">
      <section className="panel" style={{ flex: '1 1 55%' }}>
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
                      rt && <img src={rt.url} alt={a.name} draggable={false} />
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
      </section>
      <section className="panel" style={{ flex: '1 1 45%' }}>
        <div className="panel-header">Sơ đồ độ sâu · nhìn từ trên</div>
        <div className="panel-body" style={{ position: 'relative', overflow: 'hidden' }}>
          <TopView />
        </div>
      </section>
    </aside>
  )
}
