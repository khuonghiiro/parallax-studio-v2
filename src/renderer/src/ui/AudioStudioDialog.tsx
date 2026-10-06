import { useEffect, useRef, useState } from 'react'
import type { AudioTrackItem } from '@shared/types'
import {
  importAudio,
  mergeAudioTracks,
  updateAudioTrack
} from '../actions'
import { assetStore } from '../project/assets'
import { getProjectAudioTracks } from '../project/audioTracks'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import {
  IconCheck,
  IconMusic,
  IconPause,
  IconPlay,
  IconVolume,
  IconX
} from './icons'
import { AudioStudioTrackList } from './audioStudio/AudioStudioTrackList'
import { AudioStudioWaveform } from './audioStudio/AudioStudioWaveform'

/** Converts linear volume ratio (0..2) to decibel string representation */
function toDbString(vol: number): string {
  if (vol <= 0.001) return '-∞ dB'
  const db = 20 * Math.log10(vol)
  const sign = db > 0 ? '+' : ''
  return `${sign}${db.toFixed(1)} dB`
}

export function AudioStudioDialog() {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const setTime = useEditor((s) => s.setTime)
  const mode = useView((s) => s.audioDialogMode)
  const theme = useView((s) => s.theme)
  const close = () => useView.getState().openDialog(null)

  const [activeTab, setActiveTab] = useState<'waveform' | 'tone' | 'mixer'>(
    mode === 'levels' ? 'tone' : 'waveform'
  )
  const tracks = getProjectAudioTracks(project)
  const [selectedTrackId, setSelectedTrackId] = useState<string>(tracks[0]?.id || '')

  // Keep selectedTrackId valid when tracks change
  useEffect(() => {
    if (tracks.length > 0 && !tracks.some((t) => t.id === selectedTrackId)) {
      setSelectedTrackId(tracks[0].id)
    }
  }, [tracks, selectedTrackId])

  const curTrack = tracks.find((t) => t.id === selectedTrackId) || tracks[0]
  const asset = curTrack ? assetStore.get(curTrack.assetId) : null

  // ------------------------------------------------ Audition Player with Web Audio EQ
  const [isPlayingAudition, setIsPlayingAudition] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)

  const stopAudition = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
      } catch {
        /* ignore */
      }
      sourceNodeRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined)
      audioCtxRef.current = null
    }
    setIsPlayingAudition(false)
  }

  useEffect(() => {
    return () => stopAudition()
  }, [])

  const toggleAudition = async () => {
    if (!asset || !curTrack) return
    if (isPlayingAudition) {
      stopAudition()
      return
    }

    try {
      const actx = new AudioContext()
      audioCtxRef.current = actx

      const data = await assetStore.getBytes(curTrack.assetId)
      if (!data) return
      const audioBuffer = await actx.decodeAudioData(data.buffer.slice(0))

      const src = actx.createBufferSource()
      src.buffer = audioBuffer
      src.playbackRate.value = curTrack.playbackRate || 1

      const gain = actx.createGain()
      gain.gain.value = curTrack.muted ? 0 : Math.max(0, Math.min(2, curTrack.volume))

      let lastNode: AudioNode = src
      if (curTrack.tone && curTrack.tone !== 'normal') {
        const filter = actx.createBiquadFilter()
        if (curTrack.tone === 'bass') {
          filter.type = 'lowshelf'
          filter.frequency.value = 150
          filter.gain.value = 6
        } else if (curTrack.tone === 'treble') {
          filter.type = 'highshelf'
          filter.frequency.value = 3500
          filter.gain.value = 6
        } else if (curTrack.tone === 'vocal') {
          filter.type = 'peaking'
          filter.frequency.value = 1500
          filter.Q.value = 1
          filter.gain.value = 4
        } else if (curTrack.tone === 'warm') {
          filter.type = 'lowpass'
          filter.frequency.value = 4500
        }
        lastNode.connect(filter)
        lastNode = filter
      }

      lastNode.connect(gain)
      gain.connect(actx.destination)

      const trim = curTrack.trimIn || 0
      const dur = curTrack.duration

      src.onended = () => setIsPlayingAudition(false)
      sourceNodeRef.current = src

      if (dur) src.start(0, trim, dur)
      else src.start(0, trim)

      setIsPlayingAudition(true)
    } catch (err) {
      console.warn('Audition error:', err)
      stopAudition()
    }
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal audio-studio-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-head audio-studio-head">
          <div className="audio-studio-title-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="audio-studio-badge">
                <IconMusic width={14} height={14} strokeWidth={2.4} />
              </span>
              <div>
                <h2>Studio Cấu Hình Âm Thanh & Sóng Âm</h2>
                <p>Biên tập sóng âm, chỉnh âm điệu, cắt tách gộp và cân chỉnh mức âm lượng (After Effects)</p>
              </div>
            </div>
            <button className="btn sm icon" onClick={close} title="Đóng bảng (Esc)">
              <IconX width={13} height={13} />
            </button>
          </div>

          {/* Tab selector */}
          <div className="audio-studio-tabs">
            <button
              className={`audio-tab-btn${activeTab === 'waveform' ? ' active' : ''}`}
              onClick={() => setActiveTab('waveform')}
            >
              🌊 Sóng âm & Cắt tách (Waveforms & Cut)
            </button>
            <button
              className={`audio-tab-btn${activeTab === 'tone' ? ' active' : ''}`}
              onClick={() => setActiveTab('tone')}
            >
              🎛️ Âm điệu, Tốc độ & EQ (Pitch & Tone)
            </button>
            <button
              className={`audio-tab-btn${activeTab === 'mixer' ? ' active' : ''}`}
              onClick={() => setActiveTab('mixer')}
            >
              🎚️ Bộ trộn âm lượng & Gộp âm (Mixer & Merge)
            </button>
          </div>
        </div>

        {/* Body: Two columns */}
        <div className="audio-studio-body">
          {/* Left Column: Track List */}
          <AudioStudioTrackList
            tracks={tracks}
            selectedTrackId={curTrack?.id || ''}
            time={time}
            onSelectTrack={setSelectedTrackId}
            onImportAudio={() => importAudio(time)}
            onMergeTracks={() => mergeAudioTracks()}
            toDbString={toDbString}
          />

          {/* Right Column: Track Editor */}
          <main className="audio-track-editor">
            {curTrack ? (
              <div className="audio-editor-content">
                {/* Active Track Title & Audition Bar */}
                <div className="audio-editor-banner">
                  <div>
                    <div className="audio-editor-name">
                      {curTrack.name || asset?.meta.name || 'Luồng âm thanh'}
                    </div>
                    <div className="audio-editor-submeta">
                      Bắt đầu: <strong>{curTrack.offset.toFixed(2)}s</strong>
                      {curTrack.duration ? ` · Độ dài: ${curTrack.duration.toFixed(2)}s` : ''} · Âm lượng:{' '}
                      <strong>{Math.round(curTrack.volume * 100)}%</strong> ({toDbString(curTrack.volume)})
                      {curTrack.playbackRate && curTrack.playbackRate !== 1 ? ` · Tốc độ: ${curTrack.playbackRate}x` : ''}
                      {curTrack.tone && curTrack.tone !== 'normal' ? ` · Âm sắc: ${curTrack.tone.toUpperCase()}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className={`btn sm${isPlayingAudition ? ' active' : ''}`}
                      onClick={toggleAudition}
                      title="Nghe thử file âm thanh này kèm các hiệu ứng âm điệu đã chỉnh"
                    >
                      {isPlayingAudition ? (
                        <>
                          <IconPause width={12} height={12} /> Tạm dừng
                        </>
                      ) : (
                        <>
                          <IconPlay width={12} height={12} /> Nghe thử
                        </>
                      )}
                    </button>
                    <button
                      className={`btn sm${curTrack.muted ? ' active danger' : ''}`}
                      onClick={() => updateAudioTrack(curTrack.id, { muted: !curTrack.muted })}
                      title={curTrack.muted ? 'Bật lại tiếng (Unmute)' : 'Tắt tiếng đoạn này (Mute)'}
                    >
                      {curTrack.muted ? 'Đang tắt tiếng' : 'Tắt tiếng (Mute)'}
                    </button>
                  </div>
                </div>

                {/* TAB 1: SÓNG ÂM & CẮT TÁCH (Waveforms & Editing) */}
                {activeTab === 'waveform' && (
                  <AudioStudioWaveform
                    curTrack={curTrack}
                    time={time}
                    totalTracks={tracks.length}
                    theme={theme}
                    onSeek={setTime}
                  />
                )}

                {/* TAB 2: CHỈNH ÂM ĐIỆU, TỐC ĐỘ & EQUALIZER (Pitch, Speed & Tone) */}
                {activeTab === 'tone' && (
                  <div className="audio-tone-panel">
                    {/* Pitch & Playback Speed */}
                    <div className="levels-row">
                      <div className="levels-header">
                        <span className="levels-label">
                          ⚡ Tốc độ & Cao độ âm điệu (Pitch & Playback Rate):
                        </span>
                        <span className="levels-value-badge">
                          {(curTrack.playbackRate || 1).toFixed(2)}x
                        </span>
                      </div>

                      <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        value={curTrack.playbackRate || 1}
                        onChange={(e) =>
                          updateAudioTrack(curTrack.id, { playbackRate: parseFloat(e.target.value) })
                        }
                        className="audio-fader-slider"
                      />

                      <div className="audio-preset-pills">
                        {[
                          { rate: 0.5, label: '0.5x (Rất trầm & Chậm)' },
                          { rate: 0.75, label: '0.75x (Hạ tông nhẹ)' },
                          { rate: 1.0, label: '1.0x (Tự nhiên / Chuẩn)' },
                          { rate: 1.25, label: '1.25x (Tăng tông sáng)' },
                          { rate: 1.5, label: '1.5x (Vang bổng & Nhanh)' },
                          { rate: 2.0, label: '2.0x (Tua nhanh)' }
                        ].map((p) => (
                          <button
                            key={p.rate}
                            className={`pill-btn${Math.abs((curTrack.playbackRate || 1) - p.rate) < 0.04 ? ' active' : ''}`}
                            onClick={() => updateAudioTrack(curTrack.id, { playbackRate: p.rate })}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tone Filter / Equalizer Presets */}
                    <div className="levels-row" style={{ marginTop: 12 }}>
                      <div className="levels-header">
                        <span className="levels-label">
                          🎵 Bộ lọc âm sắc & Equalizer (Tone Filters):
                        </span>
                        <span className="levels-value-badge">
                          {(curTrack.tone || 'normal').toUpperCase()}
                        </span>
                      </div>

                      <div className="audio-preset-pills">
                        {[
                          { key: 'normal', label: 'Tự nhiên (Flat)', desc: 'Giữ nguyên âm sắc gốc' },
                          { key: 'bass', label: 'Tăng trầm (Bass +6dB)', desc: 'Tiếng trống, va đập, rền vang' },
                          { key: 'treble', label: 'Tăng bổng (Treble +6dB)', desc: 'Chuông gió, tiếng kim khí' },
                          { key: 'vocal', label: 'Rõ lời thoại (Vocal +4dB)', desc: 'Tập trung giọng dẫn chuyện' },
                          { key: 'warm', label: 'Ấm áp (Warm Cinematic)', desc: 'Mềm mại, lọc tần số gắt' }
                        ].map((item) => (
                          <button
                            key={item.key}
                            className={`pill-btn${(curTrack.tone || 'normal') === item.key ? ' active' : ''}`}
                            onClick={() => updateAudioTrack(curTrack.id, { tone: item.key as any })}
                            title={item.desc}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: BỘ TRỘN ÂM LƯỢNG & FADE (Levels, Faders & Mixer) */}
                <div className="audio-levels-panel">
                  <div className="levels-row">
                    <div className="levels-header">
                      <span className="levels-label">
                        <IconVolume width={14} height={14} /> Mức âm lượng (Audio Levels):
                      </span>
                      <span className="levels-value-badge">
                        {Math.round(curTrack.volume * 100)}% ({toDbString(curTrack.volume)})
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.01}
                      value={curTrack.volume}
                      onChange={(e) =>
                        updateAudioTrack(curTrack.id, { volume: parseFloat(e.target.value) })
                      }
                      className="audio-fader-slider"
                    />

                    <div className="audio-preset-pills">
                      <button
                        className={`pill-btn${curTrack.volume === 0 ? ' active' : ''}`}
                        onClick={() => updateAudioTrack(curTrack.id, { volume: 0 })}
                      >
                        Mute (-∞ dB)
                      </button>
                      <button
                        className={`pill-btn${Math.abs(curTrack.volume - 0.5) < 0.05 ? ' active' : ''}`}
                        onClick={() => updateAudioTrack(curTrack.id, { volume: 0.5 })}
                      >
                        50% (-6.0 dB)
                      </button>
                      <button
                        className={`pill-btn${Math.abs(curTrack.volume - 1) < 0.05 ? ' active' : ''}`}
                        onClick={() => updateAudioTrack(curTrack.id, { volume: 1 })}
                      >
                        100% (0.0 dB Chuẩn)
                      </button>
                      <button
                        className={`pill-btn${Math.abs(curTrack.volume - 1.5) < 0.05 ? ' active' : ''}`}
                        onClick={() => updateAudioTrack(curTrack.id, { volume: 1.5 })}
                      >
                        150% (+3.5 dB)
                      </button>
                      <button
                        className={`pill-btn${Math.abs(curTrack.volume - 2) < 0.05 ? ' active' : ''}`}
                        onClick={() => updateAudioTrack(curTrack.id, { volume: 2 })}
                      >
                        200% (+6.0 dB Max)
                      </button>
                    </div>
                  </div>

                  {/* Offset & Position Controls */}
                  <div className="levels-row offset-row" style={{ marginTop: 8 }}>
                    <div className="levels-header">
                      <span className="levels-label">Thời điểm phát trên timeline (Offset):</span>
                      <span className="levels-value-badge">{curTrack.offset.toFixed(2)}s</span>
                    </div>

                    <div className="offset-controls">
                      <input
                        type="number"
                        min={0}
                        step={0.05}
                        value={curTrack.offset}
                        onChange={(e) =>
                          updateAudioTrack(curTrack.id, {
                            offset: Math.max(0, parseFloat(e.target.value) || 0)
                          })
                        }
                        className="audio-offset-input"
                      />
                      <button
                        className="btn sm"
                        onClick={() => updateAudioTrack(curTrack.id, { offset: time })}
                        title="Dời âm thanh về đúng mốc giây hiện tại của kim phát timeline"
                      >
                        📍 Đặt tại kim phát ({time.toFixed(2)}s)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="audio-editor-placeholder">
                <IconMusic width={36} height={36} style={{ opacity: 0.3 }} />
                <p>Chọn một luồng âm thanh ở danh sách bên trái hoặc nhấn "+ Thêm âm thanh".</p>
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="modal-foot audio-studio-foot">
          <div className="audio-studio-shortcuts-tip">
            💡 <strong>Phím tắt:</strong> Nhấn <code>L</code> để mở nhanh mức âm lượng, nhấn <code>LL</code> (2 lần L) để xem biểu đồ sóng âm & công cụ cắt tách âm thanh.
          </div>
          <button className="btn primary" onClick={close}>
            <IconCheck width={13} height={13} /> Hoàn tất
          </button>
        </div>
      </div>
    </div>
  )
}
