import type { AudioTrackItem } from '@shared/types'
import { duplicateAudioTrack, removeAudioTrack, splitAudioTrack } from '../../actions'
import { assetStore } from '../../project/assets'
import { IconCopy, IconMerge, IconMusic, IconPlus, IconScissors, IconTrash } from '../icons'

interface AudioStudioTrackListProps {
  tracks: AudioTrackItem[]
  selectedTrackId: string
  time: number
  onSelectTrack: (id: string) => void
  onImportAudio: () => void
  onMergeTracks: () => void
  toDbString: (vol: number) => string
}

export function AudioStudioTrackList({
  tracks,
  selectedTrackId,
  time,
  onSelectTrack,
  onImportAudio,
  onMergeTracks,
  toDbString
}: AudioStudioTrackListProps) {
  return (
    <aside className="audio-track-list">
      <div className="audio-track-list-head">
        <span>Luồng âm ({tracks.length})</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn sm"
            style={{ padding: '2px 8px', fontSize: '11px', height: '22px' }}
            onClick={onImportAudio}
            title="Nhập thêm file âm thanh từ máy tính tại vị trí kim phát"
          >
            <IconPlus width={11} height={11} /> Thêm
          </button>
          {tracks.length >= 2 && (
            <button
              className="btn sm"
              style={{ padding: '2px 6px', fontSize: '11px', height: '22px' }}
              onClick={onMergeTracks}
              title="Gộp tất cả các luồng âm thành 1 track WAV thống nhất"
            >
              <IconMerge width={11} height={11} /> Gộp
            </button>
          )}
        </div>
      </div>

      <div className="audio-track-items">
        {tracks.length === 0 ? (
          <div className="audio-empty-tracks">
            <IconMusic width={28} height={28} style={{ opacity: 0.4 }} />
            <p>Chưa có file âm thanh nào trong dự án.</p>
            <button className="btn sm primary" onClick={onImportAudio}>
              <IconPlus width={12} height={12} /> Thêm bài hát / hiệu ứng âm thanh
            </button>
          </div>
        ) : (
          tracks.map((t, idx) => {
            const isSel = t.id === selectedTrackId
            const trackAsset = assetStore.get(t.assetId)
            const name = t.name || trackAsset?.meta.name || `Luồng âm ${idx + 1}`
            const canSplit = time > t.offset && (!t.duration || time < t.offset + t.duration)
            return (
              <div
                key={t.id}
                className={`audio-track-card${isSel ? ' selected' : ''}`}
                onClick={() => onSelectTrack(t.id)}
              >
                <div className="audio-track-card-top">
                  <span className="audio-track-num">#{idx + 1}</span>
                  <span className="audio-track-card-name" title={name}>
                    {name}
                  </span>
                  <span className="audio-track-db-tag">{toDbString(t.volume)}</span>
                </div>
                <div className="audio-track-card-meta">
                  <span>Bắt đầu: {t.offset.toFixed(2)}s</span>
                  <span>
                    {t.playbackRate && t.playbackRate !== 1 ? `${t.playbackRate}x · ` : ''}
                    {Math.round(t.volume * 100)}%
                  </span>
                </div>
                <div className="audio-track-card-actions">
                  <button
                    className="btn sm icon"
                    title="Cắt đôi đoạn này tại vị trí kim phát"
                    disabled={!canSplit}
                    onClick={(e) => {
                      e.stopPropagation()
                      splitAudioTrack(t.id, time)
                    }}
                  >
                    <IconScissors width={11} height={11} />
                  </button>
                  <button
                    className="btn sm icon"
                    title="Nhân bản / Tách đoạn này"
                    onClick={(e) => {
                      e.stopPropagation()
                      duplicateAudioTrack(t.id)
                    }}
                  >
                    <IconCopy width={11} height={11} />
                  </button>
                  <button
                    className="btn sm icon danger"
                    title="Xoá đoạn âm thanh này"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAudioTrack(t.id)
                    }}
                  >
                    <IconTrash width={11} height={11} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
