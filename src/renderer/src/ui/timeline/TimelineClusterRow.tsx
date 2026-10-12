import React from 'react'
import type { Animatable, AnimValue } from '@shared/types'
import { useEditor } from '../../store/editor'
import {
  IconCaret,
  IconCube,
  IconEye,
  IconLayerAssembly,
  IconLipSync,
  IconLock
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
  summaryKeys?: (anims: Animatable<AnimValue>[]) => React.ReactNode
}

export function TimelineClusterRow({
  cluster,
  isCollapsed,
  isSelected,
  trackWidth,
  x,
  onToggleCollapse,
  onSelect,
  onTrackPointerDown,
  summaryKeys
}: TimelineClusterRowProps) {
  const isComposite = cluster.clusterType === 'composite'
  const accentColor = isComposite ? 'var(--accent, #6366f1)' : 'var(--accent-cyan, #06b6d4)'
  const badgeLabel = isComposite ? 'Nhân vật' : 'Mô hình 3D'

  // Thu thập tất cả keyframe của các layer con trong cụm
  const allAnims: Animatable<AnimValue>[] = []
  for (const l of cluster.layers) {
    allAnims.push(
      l.transform.position as Animatable<AnimValue>,
      l.transform.rotation as Animatable<AnimValue>,
      l.transform.scale as Animatable<AnimValue>,
      l.transform.opacity as Animatable<AnimValue>
    )
  }

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

          <span className="depth" title={`Số lớp cấu thành: ${cluster.layers.length}`}>
            {cluster.layers.length} lớp
          </span>

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

          {/* Keyframes tổng hợp của cụm */}
          {summaryKeys && summaryKeys(allAnims)}
        </div>
      }
    />
  )
}
