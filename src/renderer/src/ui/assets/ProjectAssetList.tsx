import { useState } from 'react'
import type { AssetMeta } from '@shared/types'
import { addAudioTrackFromAsset, addLayerFromAsset, removeAsset } from '../../actions'
import { assetStore } from '../../project/assets'
import { useEditor } from '../../store/editor'
import { IconInfo, IconMusic, IconPause, IconPlay, IconPlus, IconTrash } from '../icons'
import { useAudioPreview } from './audioPreviewManager'
import { AssetDetailModal } from './AssetDetailModal'
import { AssetDeleteConfirmModal } from './AssetDeleteConfirmModal'

export function isAssetPublicScope(a: AssetMeta): boolean {
  if (a.assetPath) return true
  if (a.path && (a.path.includes('demo_transparent') || a.path.includes('assets') || a.path.includes('assembly_3d'))) {
    return true
  }
  return false
}

export function ProjectAssetList() {
  const assets = useEditor((s) => s.project.assets)
  const [hover, setHover] = useState<string | null>(null)
  const { playingId, toggleProjectAsset } = useAudioPreview()
  const [detailTarget, setDetailTarget] = useState<AssetMeta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AssetMeta | null>(null)

  if (assets.length === 0) {
    return (
      <div className="empty">
        Chưa có tài nguyên nào trong dự án.
        <br />
        Chọn tài nguyên ở tab <b>Tất cả</b> hoặc kéo thả ảnh/nhạc vào cửa sổ.
      </div>
    )
  }

  return (
    <>
      <div className="asset-grid">
        {assets.map((a) => {
          const rt = assetStore.get(a.id)
          const isAudio = a.kind === 'audio'
          const isPlaying = playingId === a.id
          const isPublic = isAssetPublicScope(a)

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
              {/* Badge phân biệt Public (Công khai) vs Private (Dự án) */}
              <span
                className={`asset-scope-badge ${isPublic ? 'public' : 'private'}`}
                title={
                  isPublic
                    ? 'Tài nguyên Công khai (Public từ kho dùng chung)'
                    : 'Tài nguyên Riêng tư (Private của riêng dự án này)'
                }
              >
                {isPublic ? '🌍 Công khai' : '🔒 Dự án'}
              </span>

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

              <div className="add-hint" style={{ display: 'flex', gap: 3 }}>
                <button
                  type="button"
                  className="btn sm icon danger"
                  title="Xoá asset khỏi dự án (kiểm tra cảnh báo nếu đang được dùng)"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(a)
                  }}
                >
                  <IconTrash width={12} height={12} />
                </button>

                <button
                  type="button"
                  className="btn sm icon"
                  title="Xem chi tiết và vị trí sử dụng tệp này"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDetailTarget(a)
                  }}
                >
                  <IconInfo width={12} height={12} />
                </button>

                {isAudio ? (
                  <button
                    type="button"
                    className="btn sm icon primary"
                    style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
                    title="Thêm vào mốc thời gian hiện tại (tại vị trí kim phát)"
                    onClick={() => addAudioTrackFromAsset(a.id, useEditor.getState().time)}
                  >
                    <IconPlus />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn sm icon primary"
                    style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
                    title="Thêm thành layer vào cảnh"
                    onClick={() => addLayerFromAsset(a.id)}
                  >
                    <IconPlus />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {detailTarget && (
        <AssetDetailModal
          target={{
            name: detailTarget.name,
            assetId: detailTarget.id,
            fileName: detailTarget.name,
            previewUrl: assetStore.get(detailTarget.id)?.thumbUrl || detailTarget.dataUrl,
            assetPath: detailTarget.assetPath || detailTarget.path,
            scope: isAssetPublicScope(detailTarget) ? 'public' : 'private'
          }}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {deleteTarget && (
        <AssetDeleteConfirmModal
          target={{
            name: deleteTarget.name,
            assetId: deleteTarget.id,
            fileName: deleteTarget.name,
            previewUrl: assetStore.get(deleteTarget.id)?.thumbUrl || deleteTarget.dataUrl,
            assetPath: deleteTarget.assetPath || deleteTarget.path,
            scope: isAssetPublicScope(deleteTarget) ? 'public' : 'private'
          }}
          onClose={() => setDeleteTarget(null)}
          onConfirmDelete={(target) => {
            const itemToDelete = deleteTarget || target
            if (itemToDelete) {
              const id = 'id' in itemToDelete ? (itemToDelete as AssetMeta).id : (itemToDelete as { assetId?: string }).assetId
              if (id) {
                removeAsset(id)
                assetStore.remove?.(id)
              }
            }
            setDeleteTarget(null)
          }}
        />
      )}
    </>
  )
}
