import { useState } from 'react'
import { addLayerFromAsset, removeAsset } from '../../actions'
import { assetStore } from '../../project/assets'
import { useEditor } from '../../store/editor'
import { IconMusic, IconPlus, IconTrash } from '../icons'

export function ProjectAssetList() {
  const assets = useEditor((s) => s.project.assets)
  const audio = useEditor((s) => s.project.audio)
  const [hover, setHover] = useState<string | null>(null)

  if (assets.length === 0) {
    return (
      <div className="empty">
        Chưa có tài nguyên nào trong dự án.
        <br />
        Chọn tài nguyên ở tab <b>Thư viện</b> hoặc kéo thả ảnh/nhạc vào cửa sổ.
      </div>
    )
  }

  return (
    <div className="asset-grid">
      {assets.map((a) => {
        const rt = assetStore.get(a.id)
        const isAudio = a.kind === 'audio'
        return (
          <div
            key={a.id}
            className={`asset${isAudio ? ' audio' : ''}`}
            title={
              isAudio
                ? `${a.name} — ${a.duration?.toFixed(1)}s`
                : `${a.name} — ${a.width}×${a.height}\nDouble-click để thêm layer`
            }
            onDoubleClick={() => !isAudio && addLayerFromAsset(a.id)}
            onMouseEnter={() => setHover(a.id)}
            onMouseLeave={() => setHover(null)}
            draggable={!isAudio}
            onDragStart={(e) => e.dataTransfer.setData('application/x-pxs-asset', a.id)}
          >
            {isAudio ? (
              <IconMusic
                width={26}
                height={26}
                style={{
                  color: audio?.assetId === a.id ? 'var(--accent-2)' : 'var(--text-faint)'
                }}
              />
            ) : (
              rt?.thumbUrl && <img src={rt.thumbUrl} alt={a.name} draggable={false} />
            )}
            {(a.isAnimated || rt?.gif) && (
              <span
                className="badge-count"
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  background: 'rgba(139, 123, 255, 0.9)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '9px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                }}
              >
                GIF
              </span>
            )}
            <span className="asset-name">{a.name}</span>
            {hover === a.id && (
              <div className="add-hint" style={{ display: 'flex', gap: 3 }}>
                {!isAudio && (
                  <button
                    type="button"
                    className="btn sm icon"
                    title="Thêm thành layer"
                    onClick={() => addLayerFromAsset(a.id)}
                  >
                    <IconPlus />
                  </button>
                )}
                <button
                  type="button"
                  className="btn sm icon danger"
                  title="Xoá asset"
                  onClick={() => removeAsset(a.id)}
                >
                  <IconTrash />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
