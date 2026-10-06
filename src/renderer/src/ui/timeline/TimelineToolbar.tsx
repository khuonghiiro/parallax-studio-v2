import React from 'react'
import { formatTimecode, snapToFrame } from '../../animation/math'
import {
  IconCopy,
  IconFitWidth,
  IconKeyframe,
  IconLoop,
  IconPause,
  IconPlay,
  IconScissors,
  IconSkipEnd,
  IconSkipStart,
  IconStepBack,
  IconStepFwd,
  IconTrash,
  IconTrimLeft,
  IconTrimRight,
  IconZoomIn,
  IconZoomOut
} from '../icons'
import {
  addKeyframeForSelectedLayer,
  setSelectedLayerInPoint,
  setSelectedLayerOutPoint,
  splitSelectedLayer
} from './timelineActions'
import { FxPresetMenu } from './FxPresetMenu'
import { deleteSelectedAudioTrack, deleteSelectedLayer, duplicateSelectedLayer } from '../../actions'
import { useEditor } from '../../store/editor'

export interface TimelineToolbarProps {
  time: number
  fps: number
  duration: number
  playing: boolean
  loop: boolean
  zoom: number
  hasSelectedLayer: boolean
  setTime: (t: number) => void
  setPlaying: (playing: boolean) => void
  setLoop: (loop: boolean) => void
  setZoom: (zoom: number | ((prev: number) => number)) => void
}

export function TimelineToolbar({
  time,
  fps,
  duration,
  playing,
  loop,
  zoom,
  hasSelectedLayer,
  setTime,
  setPlaying,
  setLoop,
  setZoom
}: TimelineToolbarProps) {
  const selectedAudioTrackId = useEditor((s) => s.selectedAudioTrackId)
  const canDelete = hasSelectedLayer || !!selectedAudioTrackId

  return (
    <div className="timeline-toolbar">
      {/* 1. Playback Transport Group */}
      <div className="tl-tool-group">
        <button
          id="tl-start"
          type="button"
          className="btn ghost icon sm"
          title="Về đầu cảnh (Home)"
          onClick={() => setTime(0)}
        >
          <IconSkipStart width={14} height={14} />
        </button>
        <button
          id="tl-prev"
          type="button"
          className="btn ghost icon sm"
          title="Lùi 1 frame (←)"
          onClick={() => setTime(snapToFrame(time - 1 / fps, fps))}
        >
          <IconStepBack width={14} height={14} />
        </button>
        <button
          id="tl-play"
          type="button"
          className="btn primary icon sm tl-play-btn"
          title="Phát / Tạm dừng (Space)"
          onClick={() => {
            if (!playing && time >= duration - 1e-3) setTime(0)
            setPlaying(!playing)
          }}
        >
          {playing ? <IconPause width={14} height={14} /> : <IconPlay width={14} height={14} />}
        </button>
        <button
          id="tl-next"
          type="button"
          className="btn ghost icon sm"
          title="Tiến 1 frame (→)"
          onClick={() => setTime(snapToFrame(time + 1 / fps, fps))}
        >
          <IconStepFwd width={14} height={14} />
        </button>
        <button
          id="tl-end"
          type="button"
          className="btn ghost icon sm"
          title="Về cuối cảnh (End)"
          onClick={() => setTime(duration)}
        >
          <IconSkipEnd width={14} height={14} />
        </button>
        <button
          id="tl-loop"
          type="button"
          className={`btn ghost icon sm${loop ? ' active' : ''}`}
          title="Lặp lại phân cảnh (Loop)"
          onClick={() => setLoop(!loop)}
        >
          <IconLoop width={14} height={14} />
        </button>
      </div>

      {/* 2. Recessed Cyan Timecode */}
      <div className="timecode">
        {formatTimecode(time, fps)}
        <small>
          {Math.round(time * fps)} / {Math.round(duration * fps)}f
        </small>
      </div>

      <div className="tl-toolbar-divider" />

      {/* 3. Quick Edit Operations Group */}
      <div className="tl-tool-group">
        <button
          type="button"
          className="btn ghost sm tl-action-btn tl-btn-split"
          title="Tách / Cắt layer tại Playhead (Ctrl+Shift+D hoặc S)"
          disabled={!hasSelectedLayer}
          onClick={() => splitSelectedLayer()}
        >
          <IconScissors width={13} height={13} />
          <span>Cắt</span>
        </button>

        <button
          type="button"
          className="btn ghost sm tl-action-btn"
          title="Cắt đầu layer về Playhead ( Phím [ )"
          disabled={!hasSelectedLayer}
          onClick={() => setSelectedLayerInPoint()}
        >
          <IconTrimLeft width={13} height={13} />
          <span>Đặt In</span>
        </button>

        <button
          type="button"
          className="btn ghost sm tl-action-btn"
          title="Cắt đuôi layer về Playhead ( Phím ] )"
          disabled={!hasSelectedLayer}
          onClick={() => setSelectedLayerOutPoint()}
        >
          <IconTrimRight width={13} height={13} />
          <span>Đặt Out</span>
        </button>

        <button
          type="button"
          className="btn ghost sm tl-action-btn tl-btn-key"
          title="Thêm Keyframe vị trí tại Playhead ( Phím K )"
          disabled={!hasSelectedLayer}
          onClick={() => addKeyframeForSelectedLayer()}
        >
          <IconKeyframe width={12} height={12} />
          <span>Thêm Key</span>
        </button>

        <FxPresetMenu time={time} hasSelectedLayer={hasSelectedLayer} />

        <button
          type="button"
          className="btn ghost icon sm"
          title="Nhân bản layer (Ctrl+D)"
          disabled={!hasSelectedLayer}
          onClick={() => duplicateSelectedLayer()}
        >
          <IconCopy width={13} height={13} />
        </button>

        <button
          type="button"
          className="btn ghost icon sm danger"
          title={selectedAudioTrackId ? 'Xoá đoạn âm thanh đã chọn (Del)' : 'Xoá layer đã chọn (Del)'}
          disabled={!canDelete}
          onClick={() => {
            if (selectedAudioTrackId) deleteSelectedAudioTrack()
            else deleteSelectedLayer()
          }}
        >
          <IconTrash width={13} height={13} />
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* 4. Timeline Zoom & View Controls */}
      <div className="tl-tool-group tl-zoom-group">
        <button
          type="button"
          className="btn ghost icon sm"
          title="Thu nhỏ thước đo (-)"
          onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
          disabled={zoom <= 1}
        >
          <IconZoomOut width={13} height={13} />
        </button>

        <input
          type="range"
          className="tl-zoom-slider"
          min={1}
          max={6}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          title={`Độ phóng đại: ${zoom.toFixed(1)}x (Cuộn Alt + Lăn chuột trên thước đo để zoom)`}
        />

        <button
          type="button"
          className="btn ghost icon sm"
          title="Phóng to thước đo (+)"
          onClick={() => setZoom((z) => Math.min(6, Math.round((z + 0.25) * 100) / 100))}
          disabled={zoom >= 6}
        >
          <IconZoomIn width={13} height={13} />
        </button>

        <button
          type="button"
          className={`btn ghost sm tl-zoom-badge${zoom === 1 ? ' active' : ''}`}
          title="Khôi phục zoom vừa màn hình (Fit 1.0x)"
          onClick={() => setZoom(1)}
        >
          <IconFitWidth width={12} height={12} />
          <span>{zoom.toFixed(1)}x</span>
        </button>
      </div>
    </div>
  )
}
