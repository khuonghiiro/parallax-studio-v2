import React from 'react'
import type { Animatable, AnimValue, Layer } from '@shared/types'
import { evaluate } from '../../animation/keyframes'
import { deleteSelectedLayer, duplicateSelectedLayer, moveLayer } from '../../actions'
import { useEditor, type PropRef } from '../../store/editor'
import {
  IconCaret,
  IconCopy,
  IconDown,
  IconEye,
  IconLock,
  IconTrash,
  IconUp
} from '../icons'
import { TYPE_COLORS } from '../TopView'
import { LAYER_PROPS, TYPE_LETTER } from './timelineTypes'
import { TimelineRow } from './TimelineRow'
import { TimelineGlowKeys } from './TimelineGlowKeys'

export interface TimelineLayerRowProps {
  layer: Layer
  isOpen: boolean
  isSelected: boolean
  isRenaming: boolean
  time: number
  x: (t: number) => number
  trackWidth?: number
  onToggleOpen: () => void
  onSelect: () => void
  setRenaming: (id: string | null) => void
  startBarDrag: (e: React.PointerEvent, layer: Layer, mode: 'move' | 'in' | 'out') => void
  renderKeys: (a: Animatable<AnimValue>, ref: PropRef) => React.ReactNode
  summaryKeys: (anims: Animatable<AnimValue>[]) => React.ReactNode
  onTrackPointerDown?: (e: React.PointerEvent) => void
  onBarContextMenu?: (e: React.MouseEvent, layer: Layer) => void
}

export function TimelineLayerRow({
  layer,
  isOpen,
  isSelected,
  isRenaming,
  time,
  x,
  trackWidth,
  onToggleOpen,
  onSelect,
  setRenaming,
  startBarDrag,
  renderKeys,
  summaryKeys,
  onTrackPointerDown,
  onBarContextMenu
}: TimelineLayerRowProps) {
  const anims = LAYER_PROPS.map((p) => layer.transform[p.prop] as Animatable<AnimValue>)
  const color = TYPE_COLORS[layer.type]

  return (
    <div>
      <TimelineRow
        selected={isSelected}
        onClick={onSelect}
        trackWidth={trackWidth}
        onTrackPointerDown={onTrackPointerDown}
        onTrackContextMenu={(e) => onBarContextMenu?.(e, layer)}
        name={
          <div className="tl-name">
            <button className="mini" onClick={(e) => (e.stopPropagation(), onToggleOpen())}>
              <IconCaret className={`caret${isOpen ? ' open' : ''}`} />
            </button>
            <span className="ico" style={{ background: color }}>
              {TYPE_LETTER[layer.type]}
            </span>
            <span className="label" onDoubleClick={() => setRenaming(layer.id)}>
              {isRenaming ? (
                <input
                  autoFocus
                  defaultValue={layer.name}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v) {
                      useEditor.getState().update((d) => {
                        const target = d.layers.find((l) => l.id === layer.id)
                        if (target) target.name = v
                      })
                    }
                    setRenaming(null)
                  }}
                />
              ) : (
                layer.name
              )}
            </span>
            <span className="row-actions">
              <button
                className="mini"
                title="Lên trên"
                onClick={(e) => (e.stopPropagation(), moveLayer(layer.id, -1))}
              >
                <IconUp />
              </button>
              <button
                className="mini"
                title="Xuống dưới"
                onClick={(e) => (e.stopPropagation(), moveLayer(layer.id, 1))}
              >
                <IconDown />
              </button>
              <button
                className="mini"
                title="Nhân bản (Ctrl+D)"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect()
                  duplicateSelectedLayer()
                }}
              >
                <IconCopy />
              </button>
              <button
                className="mini"
                title="Xoá (Del)"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect()
                  deleteSelectedLayer()
                }}
              >
                <IconTrash />
              </button>
            </span>
            <span className="depth" title={`Độ sâu trục Z: ${Math.round(evaluate(layer.transform.position, time)[2])}px`}>
              {Math.round(evaluate(layer.transform.position, time)[2])}
            </span>
            <button
              className={`mini${layer.visible ? '' : ' off'}`}
              title={layer.visible ? 'Đang hiện (Click để ẩn)' : 'Đang ẩn (Click để hiện)'}
              onClick={(e) => {
                e.stopPropagation()
                useEditor.getState().update((d) => {
                  const l = d.layers.find((q) => q.id === layer.id)!
                  l.visible = !l.visible
                })
              }}
            >
              <IconEye />
            </button>
            <button
              className={`mini${layer.locked ? '' : ' off'}`}
              title={layer.locked ? 'Đang khóa (Click để mở)' : 'Đang mở (Click để khóa)'}
              onClick={(e) => {
                e.stopPropagation()
                useEditor.getState().update((d) => {
                  const l = d.layers.find((q) => q.id === layer.id)!
                  l.locked = !l.locked
                })
              }}
            >
              <IconLock />
            </button>
          </div>
        }
        track={
          <>
            <div
              className={`tl-bar${isSelected ? ' is-selected' : ''}`}
              style={{
                left: x(layer.inPoint),
                width: Math.max(16, x(layer.outPoint) - x(layer.inPoint)),
                background: `linear-gradient(180deg, ${color}48, ${color}22)`,
                borderColor: `${color}${isSelected ? 'ff' : '88'}`,
                opacity: layer.visible ? 0.95 : 0.35
              }}
              title={`${layer.name} · ${layer.inPoint.toFixed(2)}s → ${layer.outPoint.toFixed(2)}s (${(layer.outPoint - layer.inPoint).toFixed(2)}s)`}
              onPointerDown={(e) => startBarDrag(e, layer, 'move')}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect()
                onBarContextMenu?.(e, layer)
              }}
            >
              <div
                className="handle l"
                title={`Kéo đổi điểm bắt đầu [In] (Hiện tại: ${layer.inPoint.toFixed(2)}s)`}
                onPointerDown={(e) => startBarDrag(e, layer, 'in')}
              >
                <span className="gripper" />
              </div>
              <span className="tl-bar-label">
                <span className="bar-title">{layer.name}</span>
                <span className="bar-span">{(layer.outPoint - layer.inPoint).toFixed(1)}s</span>
              </span>
              <div
                className="handle r"
                title={`Kéo đổi điểm kết thúc [Out] (Hiện tại: ${layer.outPoint.toFixed(2)}s)`}
                onPointerDown={(e) => startBarDrag(e, layer, 'out')}
              >
                <span className="gripper" />
              </div>
            </div>
            {summaryKeys(anims)}
            <TimelineGlowKeys
              layer={layer}
              x={x}
              trackWidth={trackWidth}
              isSubRow={false}
            />
          </>
        }
      />
      {isOpen &&
        LAYER_PROPS.map((p) => (
          <TimelineRow
            key={p.prop}
            sub
            selected={isSelected}
            trackWidth={trackWidth}
            onTrackPointerDown={onTrackPointerDown}
            name={<div className="tl-name sub">{p.label}</div>}
            track={renderKeys(layer.transform[p.prop] as Animatable<AnimValue>, {
              kind: 'layer',
              layerId: layer.id,
              prop: p.prop
            })}
          />
        ))}
      {isOpen && layer.glow?.enabled && (
        <TimelineRow
          sub
          selected={isSelected}
          trackWidth={trackWidth}
          onTrackPointerDown={onTrackPointerDown}
          name={
            <div
              className="tl-name sub"
              style={{
                color: layer.glow.color || 'var(--accent-cyan)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer'
              }}
              title={`Hiệu ứng viền Neon (${layer.glow.animated || 'tĩnh'}) - Click để chỉnh`}
              onClick={() => {
                useEditor.getState().setInspectorTab('layer')
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: layer.glow.color || 'var(--accent-cyan)',
                  boxShadow: `0 0 6px ${layer.glow.color || 'var(--accent-cyan)'}`,
                  flexShrink: 0
                }}
              />
              <span>Viền Neon</span>
              <span style={{ fontSize: 9, opacity: 0.8, fontWeight: 'normal' }}>
                ({layer.glow.animated === 'breathe' ? 'Thở' : layer.glow.animated === 'blink' ? 'Chớp' : layer.glow.animated === 'flicker' ? 'Flicker' : 'Tĩnh'})
              </span>
            </div>
          }
          track={
            <TimelineGlowKeys
              layer={layer}
              x={x}
              trackWidth={trackWidth}
              isSubRow={true}
            />
          }
        />
      )}
    </div>
  )
}
