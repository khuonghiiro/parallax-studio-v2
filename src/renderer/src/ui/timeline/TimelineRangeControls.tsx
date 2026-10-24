import type { Animatable, AnimValue } from '@shared/types'
import { frameTolerance, useEditor, type PropRef } from '../../store/editor'
import { keyAt } from '../../animation/keyframes'
import { timelineSegmentAt } from '../../animation/timelineRange'
import { toggleTimelineKey } from './timelineKeyEditing'
import {
  isSilentHoldGuard,
  MOTION_MODES,
  openMotionPopup,
  selectQuickTimelineMotion
} from './timelineMotionModel'
import { IconKeyframeDiamond, IconMotionTuning } from '../icons'

export function TimelineRangeControls({ animation, refp }: { animation: Animatable<AnimValue>; refp: PropRef }) {
  const time = useEditor(s => s.time)
  const current = keyAt(animation, time, frameTolerance(useEditor.getState().project))
  const segment = timelineSegmentAt(animation, time)
  const effectiveStart = isSilentHoldGuard(animation, segment.start) ? undefined : segment.start
  const isCurrentRealKey = !!current && !isSilentHoldGuard(animation, current)

  return (
    <div className="tl-compact-keys tl-range-controls" data-mcp-region="timeline_key_controls">
      <button
        type="button"
        aria-pressed={isCurrentRealKey}
        className={`tl-key-diamond${isCurrentRealKey ? ' active' : ''}`}
        title={
          isCurrentRealKey
            ? `Đang có mốc tại ${time.toFixed(2)}s · Bấm để xóa mốc · Chuột phải để cấu hình`
            : `Đặt mốc chuyển động (Keyframe) tại ${time.toFixed(2)}s`
        }
        onClick={(e) => {
          e.stopPropagation()
          toggleTimelineKey(refp)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openMotionPopup(refp, { clientX: e.clientX, clientY: e.clientY })
        }}
      >
        <IconKeyframeDiamond active={isCurrentRealKey} width={12} height={12} />
      </button>
      {MOTION_MODES.map(({ value, label, Icon }) => {
        const isActive =
          !!effectiveStart &&
          (effectiveStart.ease === value || (value === 'easeInOut' && effectiveStart.ease.startsWith('ease')))
        return (
          <button
            type="button"
            key={value}
            className={`tl-motion-quick${isActive ? ' active' : ''}`}
            aria-pressed={isActive}
            title={
              isActive
                ? `${label} (Đang bật) · Bấm lần nữa hoặc chuột phải để tinh chỉnh thông số`
                : effectiveStart
                  ? `${label} · Áp dụng cho đoạn hiện tại`
                  : `${label} · Tự động tạo mốc tại ${time.toFixed(2)}s và áp dụng kiểu chuyển động`
            }
            onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              selectQuickTimelineMotion(refp, time, value, { clientX: rect.left, clientY: rect.bottom })
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              openMotionPopup(refp, { clientX: e.clientX, clientY: e.clientY })
            }}
          >
            <Icon width={13} height={13} />
          </button>
        )
      })}
      <button
        type="button"
        className="tl-motion-settings"
        title="Mở bảng tinh chỉnh thông số chuyển động (Độ mượt, Số nhịp...)"
        onClick={(e) => {
          e.stopPropagation()
          const rect = e.currentTarget.getBoundingClientRect()
          openMotionPopup(refp, { clientX: rect.left, clientY: rect.bottom })
        }}
      >
        <IconMotionTuning width={12} height={12} />
      </button>
    </div>
  )
}
