import React from 'react'
import { keyAt } from '../../animation/keyframes'
import { frameTolerance, getAnimatable, useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import {
  IconKeyframeDiamond,
  IconPaneMaximizeV,
  IconPaneSplitH,
  IconPause,
  IconPlay,
  IconScissors,
  IconSkipStart,
  IconZoomIn,
  IconZoomOut
} from '../icons'
import { splitSelectedLayer } from '../timeline/timelineActions'
import { activeTimelineRef, toggleTimelineKey } from '../timeline/timelineKeyEditing'

export interface MobileTransportBarProps {
  pxPerSec: number
  onZoomChange: (updater: (prev: number) => number) => void
}

export const MobileTransportBar: React.FC<MobileTransportBarProps> = ({
  pxPerSec,
  onZoomChange
}) => {
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const project = useEditor((s) => s.project)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const mobileDrawerExpanded = useView((s) => s.mobileDrawerExpanded)
  const toggleMobileDrawerExpanded = useView((s) => s.toggleMobileDrawerExpanded)

  const duration = Math.max(0.5, project.comp.duration || 10)
  const tol = frameTolerance(project)

  const ref = activeTimelineRef()
  const anim = ref ? getAnimatable(project, ref) : undefined
  const hasKeyHere = Boolean(anim && keyAt(anim, time, tol))

  const handleTogglePlay = (): void => {
    const st = useEditor.getState()
    if (!st.playing && st.time >= duration - 1e-3) {
      st.setTime(0)
    }
    st.setPlaying(!st.playing)
  }

  const handleToggleKey = (): void => {
    const curRef = activeTimelineRef()
    if (curRef) {
      toggleTimelineKey(curRef)
    }
  }

  return (
    <div className="cc-transport-bar" data-mcp-region="mobile_transport">
      <div className="cc-transport-left">
        <button
          type="button"
          className="cc-tbtn"
          onClick={() => {
            useEditor.getState().setPlaying(false)
            useEditor.getState().setTime(0)
          }}
          title="Về đầu cảnh (0.0s)"
          aria-label="Về đầu cảnh"
        >
          <IconSkipStart width={14} height={14} />
        </button>

        <button
          id="cc-mobile-play"
          type="button"
          className={`cc-play-btn${playing ? ' playing' : ''}`}
          onClick={handleTogglePlay}
          title={playing ? 'Tạm dừng' : 'Phát cảnh'}
          aria-label={playing ? 'Tạm dừng' : 'Phát cảnh'}
        >
          {playing ? <IconPause width={14} height={14} /> : <IconPlay width={14} height={14} />}
        </button>

        <div className="cc-time-readout" aria-live="off">
          <span className="cc-time-cur">{time.toFixed(2)}s</span>
          <span className="cc-time-sep">/</span>
          <span className="cc-time-dur">{duration.toFixed(1)}s</span>
        </div>
      </div>

      <div className="cc-transport-right">
        <button
          id="cc-mobile-key"
          type="button"
          className={`cc-tbtn cc-key-btn${hasKeyHere ? ' active' : ''}`}
          disabled={!selectedLayerId}
          onClick={handleToggleKey}
          title={hasKeyHere ? 'Xoá mốc Keyframe tại kim phát' : 'Đặt mốc Keyframe vị trí tại kim phát'}
          aria-label="Đặt hoặc xoá mốc Keyframe"
        >
          <IconKeyframeDiamond width={14} height={14} />
          <span>{hasKeyHere ? 'Mốc' : '+Mốc'}</span>
        </button>

        <button
          id="cc-mobile-split"
          type="button"
          className="cc-tbtn"
          disabled={!selectedLayerId}
          onClick={() => splitSelectedLayer()}
          title="Tách đôi layer đang chọn tại kim phát"
          aria-label="Tách đôi layer"
        >
          <IconScissors width={13} height={13} />
        </button>

        <button
          type="button"
          className="cc-tbtn"
          onClick={() => onZoomChange((z) => Math.max(28, Math.round(z / 1.3)))}
          disabled={pxPerSec <= 28}
          title="Thu nhỏ thước Timeline"
          aria-label="Thu nhỏ Timeline"
        >
          <IconZoomOut width={13} height={13} />
        </button>

        <button
          type="button"
          className="cc-tbtn"
          onClick={() => onZoomChange((z) => Math.min(240, Math.round(z * 1.3)))}
          disabled={pxPerSec >= 240}
          title="Phóng to thước Timeline"
          aria-label="Phóng to Timeline"
        >
          <IconZoomIn width={13} height={13} />
        </button>

        <button
          type="button"
          className={`cc-tbtn${mobileDrawerExpanded ? ' expanded' : ''}`}
          onClick={() => {
            toggleMobileDrawerExpanded()
            window.setTimeout(() => window.dispatchEvent(new Event('resize')), 40)
          }}
          title={mobileDrawerExpanded ? 'Thu gọn về chế độ chia đôi' : 'Mở rộng vùng Timeline (70% màn hình)'}
          aria-label="Mở rộng hoặc thu gọn Timeline"
        >
          {mobileDrawerExpanded ? (
            <IconPaneSplitH width={13} height={13} />
          ) : (
            <IconPaneMaximizeV width={13} height={13} />
          )}
        </button>
      </div>
    </div>
  )
}
