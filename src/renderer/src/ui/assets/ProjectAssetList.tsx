import { useState } from 'react'
import { addAudioTrackFromAsset, addLayerFromAsset, removeAsset } from '../../actions'
import { assetStore } from '../../project/assets'
import { useEditor } from '../../store/editor'
import { IconMusic, IconPause, IconPlay, IconPlus, IconTrash } from '../icons'
import { useAudioPreview } from './audioPreviewManager'

export function ProjectAssetList() {
  const assets = useEditor((s) => s.project.assets)
  const audio = useEditor((s) => s.project.audio)
  const [hover, setHover] = useState<string | null>(null)
  const { playingId, toggleProjectAsset } = useAudioPreview()

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
        const isPlaying = playingId === a.id
        return (
          <div
            key={a.id}
            className={`asset${isAudio ? ' audio' : ''}${isPlaying ? ' playing-audio' : ''}`}
            title={
              isAudio
                ? `${a.name} — ${a.duration?.toFixed(1)}s\nClick nút Play để nghe thử · Double-click hoặc bấm + để thêm vào timeline`
                : `${a.name} — ${a.width}×${a.height}\nDouble-click để thêm layer`
            }
            onDoubleClick={() => {
              if (isAudio) addAudioTrackFromAsset(a.id, useEditor.getState().time)
              else addLayerFromAsset(a.id)
            }}
            onMouseEnter={() => setHover(a.id)}
            onMouseLeave={() => setHover(null)}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('application/x-pxs-asset', a.id)}
            onDragEnd={() => setHover(null)}
          >
            {isAudio ? (
              <div className="audio-card-inner">
                <span className="audio-badge" title="Tệp âm thanh">
                  <IconMusic width={10} height={10} strokeWidth={2.4} />
                </span>
                <button
                  type="button"
                  className={`btn sm icon audio-preview-btn${isPlaying ? ' active' : ''}`}
                  title={isPlaying ? 'Dừng nghe thử' : 'Nghe thử âm thanh này'}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleProjectAsset(a.id)
                  }}
                >
                  {isPlaying ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
                </button>
              </div>
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
                {isAudio ? (
                  <button
                    type="button"
                    className="btn sm icon"
                    title="Thêm vào mốc thời gian hiện tại (tại vị trí kim phát)"
                    onClick={() => addAudioTrackFromAsset(a.id, useEditor.getState().time)}
                  >
                    <IconPlus />
                  </button>
                ) : (
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
