import React, { useMemo } from 'react'
import type { Animatable, AnimValue, AudioTrackItem } from '@shared/types'
import { useEditor } from '../../store/editor'
import {
  IconCaret,
  IconCube,
  IconEye,
  IconLayerAssembly,
  IconLipSync,
  IconLock,
  IconVoiceDialogue
} from '../icons'
import type { TimelineClusterGroup } from './timelineClusters'
import { TimelineRow } from './TimelineRow'

export interface TimelineClusterRowProps {
  cluster: TimelineClusterGroup
  isCollapsed: boolean
  isSelected: boolean
  trackWidth: number
  x: (t: number) => number
  onToggleCollapse: () => void
  onSelect: () => void
  onTrackPointerDown?: (e: React.PointerEvent) => void
  onManageAudio?: (track: AudioTrackItem) => void
  onOpenAttachAudio?: () => void
  summaryKeys?: (anims: Animatable<AnimValue>[]) => React.ReactNode
}

function TimelineClusterRowComponent({
  cluster,
  isCollapsed,
  isSelected,
  trackWidth,
  x,
  onToggleCollapse,
  onSelect,
  onTrackPointerDown,
  onManageAudio,
  onOpenAttachAudio,
  summaryKeys
}: TimelineClusterRowProps) {
  const isComposite = cluster.clusterType === 'composite'
  const accentColor = isComposite ? 'var(--accent, #6366f1)' : 'var(--accent-cyan, #06b6d4)'
  const badgeLabel = isComposite ? 'Nhân vật' : 'Mô hình 3D'

  // Thu thập tất cả keyframe của các layer con trong cụm (được memoize để không tính lại mỗi frame)
  const allAnims = useMemo(() => {
    const anims: Animatable<AnimValue>[] = []
    for (const l of cluster.layers) {
      anims.push(
        l.transform.position as Animatable<AnimValue>,
        l.transform.rotation as Animatable<AnimValue>,
        l.transform.scale as Animatable<AnimValue>,
        l.transform.opacity as Animatable<AnimValue>
      )
    }
    return anims
  }, [cluster.layers])

  const allVisible = cluster.layers.every((l) => l.visible)
  const allLocked = cluster.layers.every((l) => l.locked)

  const toggleAllVisible = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !allVisible
    useEditor.getState().update((d) => {
      for (const l of d.layers) {
        const inst = l.composite?.instanceId || l.model3d?.instanceId
        if (inst === cluster.instanceId) {
          l.visible = next
        }
      }
    }, `${next ? 'Hiện' : 'Ẩn'} cụm: ${cluster.name}`)
  }

  const toggleAllLocked = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !allLocked
    useEditor.getState().update((d) => {
      for (const l of d.layers) {
        const inst = l.composite?.instanceId || l.model3d?.instanceId
        if (inst === cluster.instanceId) {
          l.locked = next
        }
      }
    }, `${next ? 'Khóa' : 'Mở khóa'} cụm: ${cluster.name}`)
  }

  const left = x(cluster.inPoint)
  const width = Math.max(4, x(cluster.outPoint) - left)

  return (
    <TimelineRow
      className="group tl-cluster-row"
      trackWidth={trackWidth}
      onTrackPointerDown={onTrackPointerDown}
      selected={isSelected}
      onClick={onSelect}
      name={
        <div
          className="tl-name group tl-cluster-name"
          id={`tl-cluster-${cluster.instanceId}`}
          style={{ borderLeft: `3px solid ${accentColor}`, paddingLeft: 4 }}
        >
          <button
            type="button"
            className="mini"
            title={isCollapsed ? 'Mở rộng cụm layer' : 'Thu gọn cụm layer'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse()
            }}
          >
            <IconCaret className={`caret${isCollapsed ? '' : ' open'}`} />
          </button>

          <span
            className="ico"
            style={{
              background: isComposite ? 'rgba(99, 102, 241, 0.2)' : 'rgba(6, 182, 212, 0.2)',
              color: accentColor,
              border: `1px solid ${accentColor}`
            }}
          >
            {isComposite ? <IconLayerAssembly width={11} height={11} /> : <IconCube width={11} height={11} />}
          </span>

          <span
            className="tl-cluster-badge"
            style={{
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: '3px',
              background: isComposite ? 'rgba(99, 102, 241, 0.15)' : 'rgba(6, 182, 212, 0.15)',
              color: accentColor,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {badgeLabel}
          </span>

          <span
            className="label"
            title={`${cluster.name} (${cluster.layers.length} lớp layer xếp chồng) · Click để chọn cụm`}
            style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {cluster.name}
          </span>

          {cluster.hasMouth && (
            <span
              className="tl-cluster-lipsync-badge"
              title="Cụm nhân vật có layer khẩu hình miệng (Sẵn sàng đồng bộ âm thanh)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                fontSize: '9.5px',
                color: '#f43f5e',
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                padding: '1px 4px',
                borderRadius: '3px'
              }}
            >
              <IconLipSync width={10} height={10} strokeWidth={2.2} />
              <span>Khẩu hình</span>
            </span>
          )}

          {cluster.audioTracks && cluster.audioTracks.length > 0 && (
            <span
              className="tl-cluster-audio-badge"
              title={`Nhân vật đã gắn ${cluster.audioTracks.length} track âm thanh (Click để xem / đổi)`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                fontSize: '9.5px',
                color: '#a855f7',
                background: 'rgba(168, 85, 247, 0.14)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                padding: '1px 4px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: 600
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (cluster.audioTracks && cluster.audioTracks[0]) {
                  onManageAudio?.(cluster.audioTracks[0])
                }
              }}
            >
              <IconVoiceDialogue width={10} height={10} strokeWidth={2.2} />
              <span>{cluster.audioTracks.length > 1 ? `${cluster.audioTracks.length} Thoại` : 'Thoại'}</span>
            </span>
          )}

          <span className="depth" title={`Số lớp cấu thành: ${cluster.layers.length}`}>
            {cluster.layers.length} lớp
          </span>

          <button
            type="button"
            className="mini"
            title="Gắn âm thanh thoại / hiệu ứng cho nhân vật này"
            style={{ color: cluster.audioTracks?.length ? '#a855f7' : undefined }}
            onClick={(e) => {
              e.stopPropagation()
              onOpenAttachAudio?.()
            }}
          >
            <IconVoiceDialogue width={11} height={11} />
          </button>
          <button
            type="button"
            className={`mini${allVisible ? '' : ' off'}`}
            title={allVisible ? 'Ẩn toàn bộ cụm' : 'Hiện toàn bộ cụm'}
            onClick={toggleAllVisible}
          >
            <IconEye />
          </button>
          <button
            type="button"
            className={`mini${allLocked ? '' : ' off'}`}
            title={allLocked ? 'Mở khóa toàn bộ cụm' : 'Khóa toàn bộ cụm'}
            onClick={toggleAllLocked}
          >
            <IconLock />
          </button>
        </div>
      }
      track={
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* Thanh bao trùm thời gian của cả cụm khi thu gọn */}
          {isCollapsed && (
            <div
              className="tl-bar tl-cluster-bar"
              style={{
                left,
                width,
                background: isComposite
                  ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.25), rgba(99, 102, 241, 0.45))'
                  : 'linear-gradient(90deg, rgba(6, 182, 212, 0.25), rgba(6, 182, 212, 0.45))',
                border: `1px solid ${accentColor}`,
                borderRadius: '3px',
                pointerEvents: 'none'
              }}
            >
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  paddingLeft: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {isComposite ? <IconLayerAssembly width={10} height={10} /> : <IconCube width={10} height={10} />}
                {cluster.name}
              </span>
            </div>
          )}

          {/* Dải âm thanh thoại thu gọn hiển thị trên thanh cụm */}
          {isCollapsed &&
            cluster.audioTracks?.map((atr) => {
              const aLeft = x(atr.offset)
              const aWidth = Math.max(6, x(atr.offset + (atr.duration || 2)) - aLeft)
              return (
                <div
                  key={atr.id}
                  style={{
                    position: 'absolute',
                    top: 2,
                    bottom: 2,
                    left: aLeft,
                    width: aWidth,
                    background: 'rgba(126, 34, 206, 0.85)',
                    border: '1px solid #9333ea',
                    borderRadius: 2,
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 4,
                    fontSize: '8.5px',
                    fontWeight: 600,
                    color: '#fff',
                    overflow: 'hidden',
                    pointerEvents: 'none'
                  }}
                >
                  🎙️ {atr.name}
                </div>
              )
            })}

          {/* Keyframes tổng hợp của cụm khi thu gọn */}
          {isCollapsed && summaryKeys && summaryKeys(allAnims)}
        </div>
      }
    />
  )
}

export const TimelineClusterRow = React.memo(TimelineClusterRowComponent)
