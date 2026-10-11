import React from 'react'
import type { AudioTrackItem } from '@shared/types'
import { duplicateAudioTrack, removeAudioTrack, splitAudioTrack, updateAudioTrack } from '../../actions'
import { assetStore } from '../../project/assets'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { NumberInput, Row, Switch, TextInput } from '../controls'
import { IconCopy, IconLoop, IconMusic, IconScissors, IconSliders, IconTrash, IconVolume } from '../icons'

export interface AudioTrackInspectorProps {
  track: AudioTrackItem
}

export function AudioTrackInspector({ track }: AudioTrackInspectorProps) {
  const time = useEditor((s) => s.time)
  const meta = assetStore.get(track.assetId)?.meta
  const audioDur = meta?.duration ?? track.duration ?? 0
  const rate = track.playbackRate ?? 1
  const isMuted = track.volume === 0 || track.muted

  return (
    <>
      <div className="section">
        <div className="section-title">
          <IconMusic width={13} height={13} style={{ color: 'var(--accent)' }} />
          <span>Đoạn âm thanh</span>
          <span className="spacer" />
          <span className="badge" style={{ fontSize: '10px', padding: '1px 6px' }}>
            {audioDur > 0 ? `${audioDur.toFixed(1)}s` : 'Audio'}
          </span>
        </div>

        {/* Tên đoạn âm thanh */}
        <Row label="Tên">
          <TextInput
            id="audio-track-name"
            value={track.name || 'Audio'}
            onCommit={(v) => updateAudioTrack(track.id, { name: v })}
          />
        </Row>

        {/* Mức âm lượng */}
        <Row label="Âm lượng">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <button
              type="button"
              className="btn xs icon"
              style={{ color: isMuted ? '#ef4444' : 'var(--text-dim)', flex: 'none' }}
              onClick={() => {
                if (isMuted) {
                  updateAudioTrack(track.id, { volume: 1, muted: false })
                } else {
                  updateAudioTrack(track.id, { volume: 0, muted: true })
                }
              }}
              title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng (Mute)'}
            >
              <IconVolume width={12} height={12} />
            </button>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={track.volume ?? 1}
              style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
              onChange={(e) => updateAudioTrack(track.id, { volume: parseFloat(e.target.value), muted: false })}
            />
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                minWidth: '34px',
                textAlign: 'right',
                color: 'var(--text-dim)',
                flex: 'none'
              }}
            >
              {isMuted ? 'Mute' : `${Math.round((track.volume ?? 1) * 100)}%`}
            </span>
          </div>
        </Row>

        {/* Tốc độ phát */}
        <Row label="Tốc độ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
            <div style={{ display: 'flex', gap: 3, width: '100%' }}>
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`btn xs${Math.abs(rate - r) < 0.04 ? ' primary' : ''}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '2px 0',
                    fontSize: '9.5px',
                    fontFamily: 'monospace',
                    textAlign: 'center'
                  }}
                  onClick={() => updateAudioTrack(track.id, { playbackRate: r })}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>
        </Row>

        {/* Bắt đầu lúc */}
        <Row label="Bắt đầu">
          <NumberInput
            value={track.offset}
            step={0.1}
            precision={2}
            min={0}
            suffix="s"
            onChange={(v) => updateAudioTrack(track.id, { offset: Math.max(0, v) })}
          />
        </Row>

        {/* Lặp lại */}
        <Row label="Lặp lại (Loop)">
          <Switch
            on={!!track.loop}
            onChange={(v) => updateAudioTrack(track.id, { loop: v })}
          />
        </Row>

        {/* Phai âm lượng */}
        <Row label="Phai vào">
          <NumberInput
            value={track.fadeIn ?? 0}
            step={0.1}
            precision={2}
            min={0}
            max={10}
            suffix="s"
            onChange={(v) => updateAudioTrack(track.id, { fadeIn: Math.max(0, v) })}
          />
        </Row>
        <Row label="Phai ra">
          <NumberInput
            value={track.fadeOut ?? 0}
            step={0.1}
            precision={2}
            min={0}
            max={10}
            suffix="s"
            onChange={(v) => updateAudioTrack(track.id, { fadeOut: Math.max(0, v) })}
          />
        </Row>
      </div>

      {/* Thao tác đoạn âm thanh */}
      <div className="section">
        <div className="section-title">Thao tác</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn sm"
              style={{ flex: 1 }}
              onClick={() => splitAudioTrack(track.id, time)}
              title={`Cắt đôi đoạn âm thanh tại vị trí kim phát hiện tại (${time.toFixed(2)}s)`}
            >
              <IconScissors width={12} height={12} /> Cắt tại {time.toFixed(1)}s
            </button>
            <button
              type="button"
              className="btn sm"
              style={{ flex: 1 }}
              onClick={() => duplicateAudioTrack(track.id)}
              title="Nhân bản đoạn âm thanh này"
            >
              <IconCopy width={12} height={12} /> Nhân đôi
            </button>
          </div>

          <button
            type="button"
            className="btn sm primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => useView.getState().openAudioDialog('waveform')}
            title="Mở Audio Studio chuyên sâu với Mixer và biểu đồ sóng âm (phím tắt LL)"
          >
            <IconSliders width={12} height={12} /> Mở Audio Studio (Mixer & Sóng âm)
          </button>

          <button
            type="button"
            className="btn sm danger"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            onClick={() => removeAudioTrack(track.id)}
            title="Xoá đoạn âm thanh này khỏi timeline (hoặc nhấn phím Del)"
          >
            <IconTrash width={12} height={12} /> Xoá khỏi timeline
          </button>
        </div>
      </div>
    </>
  )
}
