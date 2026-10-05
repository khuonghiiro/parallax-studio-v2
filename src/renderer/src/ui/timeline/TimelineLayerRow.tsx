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

export interface TimelineLayerRowProps {
  layer: Layer
  isOpen: boolean
  isSelected: boolean
  isRenaming: boolean
  time: number
  x: (t: number) => number
  onToggleOpen: () => void
  onSelect: () => void
  setRenaming: (id: string | null) => void
  startBarDrag: (e: React.PointerEvent, layer: Layer, mode: 'move' | 'in' | 'out') => void
  renderKeys: (a: Animatable<AnimValue>, ref: PropRef) => React.ReactNode
  summaryKeys: (anims: Animatable<AnimValue>[]) => React.ReactNode
}

export function TimelineLayerRow({
  layer,
  isOpen,
  isSelected,
  isRenaming,
  time,
  x,
  onToggleOpen,
  onSelect,
  setRenaming,
  startBarDrag,
  renderKeys,
  summaryKeys
}: TimelineLayerRowProps) {
  const anims = LAYER_PROPS.map((p) => layer.transform[p.prop] as Animatable<AnimValue>)
  const color = TYPE_COLORS[layer.type]

  return (
    <div>
      <TimelineRow
        selected={isSelected}
        onClick={onSelect}
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
            <span className="depth">
              {Math.round(evaluate(layer.transform.position, time)[2])}
            </span>
            <button
              className={`mini${layer.visible ? '' : ' off'}`}
              title="Ẩn / hiện"
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
              title="Khoá"
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
              className="tl-bar"
              style={{
                left: x(layer.inPoint),
                width: Math.max(4, x(layer.outPoint) - x(layer.inPoint)),
                background: `linear-gradient(180deg, ${color}55, ${color}30)`,
                border: `1px solid ${color}${isSelected ? 'ff' : '66'}`,
                opacity: layer.visible ? 0.95 : 0.35
              }}
              onPointerDown={(e) => startBarDrag(e, layer, 'move')}
            >
              <div className="handle l" onPointerDown={(e) => startBarDrag(e, layer, 'in')} />
              <div className="handle r" onPointerDown={(e) => startBarDrag(e, layer, 'out')} />
            </div>
            {summaryKeys(anims)}
          </>
        }
      />
      {isOpen &&
        LAYER_PROPS.map((p) => (
          <TimelineRow
            key={p.prop}
            sub
            selected={isSelected}
            name={<div className="tl-name sub">{p.label}</div>}
            track={renderKeys(layer.transform[p.prop] as Animatable<AnimValue>, {
              kind: 'layer',
              layerId: layer.id,
              prop: p.prop
            })}
          />
        ))}
    </div>
  )
}
