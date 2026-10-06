import React from 'react'
import { NAME_W } from './timelineTypes'

export interface TimelineRowProps {
  name: React.ReactNode
  track: React.ReactNode
  sub?: boolean
  selected?: boolean
  onClick?: () => void
  className?: string
  trackWidth?: number
  onTrackPointerDown?: (e: React.PointerEvent) => void
}

export function TimelineRow({
  name,
  track,
  sub,
  selected,
  onClick,
  className,
  trackWidth,
  onTrackPointerDown
}: TimelineRowProps) {
  return (
    <div
      className={`tl-row${sub ? ' sub' : ''}${selected ? ' selected' : ''}${className ? ' ' + className : ''}`}
      onPointerDown={onClick}
    >
      <div
        className="tl-row-name-col"
        style={{
          width: NAME_W,
          flex: 'none',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          borderRight: '1px solid var(--line-soft)',
          position: 'sticky',
          left: 0,
          background: 'inherit',
          zIndex: 5
        }}
      >
        {name}
      </div>
      <div
        className="tl-row-track-col"
        style={{
          width: trackWidth,
          minWidth: trackWidth,
          flex: trackWidth ? 'none' : 1,
          position: 'relative',
          height: '100%'
        }}
        onPointerDown={onTrackPointerDown}
      >
        {track}
      </div>
    </div>
  )
}
