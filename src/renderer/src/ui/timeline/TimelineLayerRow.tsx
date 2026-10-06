import React, { useEffect, useState } from 'react'
import type { Animatable, AnimValue, Layer } from '@shared/types'
import { evaluate } from '../../animation/keyframes'
import { deleteSelectedLayer, duplicateSelectedLayer, importBuiltInAsset, moveLayer, replaceLayerAsset } from '../../actions'
import { assetStore } from '../../project/assets'
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
import { getFxColor, renderFxIcon } from './fxIcons'

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
  startKeyDrag?: (e: React.PointerEvent, ref: PropRef, keyId: string) => void
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
  startKeyDrag,
  renderKeys,
  summaryKeys,
  onTrackPointerDown,
  onBarContextMenu
}: TimelineLayerRowProps) {
  const anims = LAYER_PROPS.map((p) => layer.transform[p.prop] as Animatable<AnimValue>)
  const color = TYPE_COLORS[layer.type]
  const selectedKey = useEditor((s) => s.selectedKey)
  const setTime = useEditor((s) => s.setTime)
  const [isDragOver, setIsDragOver] = useState(false)

  // Clear dashed drop indicator whenever drag ends, drops anywhere or mouse is released
  useEffect(() => {
    if (!isDragOver) return
    const handleDragEnd = () => setIsDragOver(false)
    window.addEventListener('dragend', handleDragEnd)
    window.addEventListener('drop', handleDragEnd)
    window.addEventListener('pointerup', handleDragEnd)
    return () => {
      window.removeEventListener('dragend', handleDragEnd)
      window.removeEventListener('drop', handleDragEnd)
      window.removeEventListener('pointerup', handleDragEnd)
    }
  }, [isDragOver])

  // Specialized keyframe renderer for layer properties: identifies effect keyframes and shows dedicated icons
  const renderLayerTrackKeys = (a: Animatable<AnimValue>, p: (typeof LAYER_PROPS)[number]) => {
    const ref: PropRef = { kind: 'layer', layerId: layer.id, prop: p.prop }

    return a.keyframes.map((k) => {
      // Find if this keyframe is part of an applied layer effect
      const fx = layer.appliedEffects?.find((e) => e.keyframeIds?.includes(k.id))
      const isSelectedKey = selectedKey?.keyId === k.id

      if (fx) {
        const isOff = !fx.enabled
        const fxColor = getFxColor(fx.presetId)
        return (
          <div
            key={k.id}
            className={`tl-key tl-key-fx${isOff ? ' disabled' : ''}${isSelectedKey ? ' selected' : ''}${k.ease === 'hold' ? ' hold' : ''}`}
            style={{
              left: x(k.t),
              ['--fx-color' as string]: isOff ? 'var(--text-faint)' : fxColor
            }}
            title={`${fx.name} Keyframe @ ${k.t.toFixed(2)}s ${isOff ? '[ĐÃ TẮT]' : ''} · Kéo để dời mốc, double-click để nhảy tới`}
            onPointerDown={(e) => (startKeyDrag ? startKeyDrag(e, ref, k.id) : undefined)}
            onDoubleClick={() => setTime(k.t)}
          >
            <span className="tl-key-fx-icon">
              {renderFxIcon(fx.presetId, 12, isOff ? 'var(--text-faint)' : fxColor)}
            </span>
          </div>
        )
      }

      // Default classic diamond keyframe for user manual keys
      return (
        <div
          key={k.id}
          className={`tl-key${k.ease === 'hold' ? ' hold' : ''}${isSelectedKey ? ' selected' : ''}`}
          style={{ left: x(k.t) }}
          title={`${p.label}: ${k.t.toFixed(2)}s`}
          onPointerDown={(e) => (startKeyDrag ? startKeyDrag(e, ref, k.id) : undefined)}
          onDoubleClick={() => setTime(k.t)}
        />
      )
    })
  }

  // Specialized summary keyframe renderer on main layer bar: combines nested effects into distinct visual icons
  const renderLayerSummary = () => {
    const keyMap = new Map<number, { keyIds: string[]; fxList: NonNullable<typeof layer.appliedEffects> }>()

    for (const a of anims) {
      for (const k of a.keyframes) {
        const roundedT = Math.round(k.t * 1000) / 1000
        let item = keyMap.get(roundedT)
        if (!item) {
          item = { keyIds: [], fxList: [] }
          keyMap.set(roundedT, item)
        }
        item.keyIds.push(k.id)
        if (layer.appliedEffects) {
          for (const fx of layer.appliedEffects) {
            if (fx.keyframeIds?.includes(k.id) && !item.fxList.some((f) => f.id === fx.id)) {
              item.fxList.push(fx)
            }
          }
        }
      }
    }

    return Array.from(keyMap.entries()).map(([t, { fxList }]) => {
      if (fxList && fxList.length > 0) {
        const primaryFx = fxList[0]
        const isOff = !primaryFx.enabled
        const fxColor = getFxColor(primaryFx.presetId)
        const allNames = fxList.map((f) => f.name).join(' + ')

        return (
          <div
            key={`summary-fx-${t}`}
            className={`tl-key summary tl-key-fx${isOff ? ' disabled' : ''}`}
            style={{
              left: x(t),
              ['--fx-color' as string]: isOff ? 'var(--text-faint)' : fxColor
            }}
            title={`Hiệu ứng: [${allNames}] @ ${t.toFixed(2)}s ${isOff ? '[ĐÃ TẮT]' : ''} · Click để nhảy tới`}
            onPointerDown={(e) => {
              e.stopPropagation()
              setTime(t)
            }}
          >
            <span className="tl-key-fx-icon">
              {renderFxIcon(primaryFx.presetId, 11, isOff ? 'var(--text-faint)' : fxColor)}
            </span>
          </div>
        )
      }

      return (
        <div
          key={`summary-${t}`}
          className="tl-key summary"
          style={{ left: x(t) }}
          title={`${layer.name} @ ${t.toFixed(2)}s`}
          onPointerDown={(e) => {
            e.stopPropagation()
            setTime(t)
          }}
        />
      )
    })
  }

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
              className={`tl-bar${isSelected ? ' is-selected' : ''}${isDragOver ? ' drag-over-replace' : ''}`}
              tabIndex={0}
              onFocus={onSelect}
              style={{
                left: x(layer.inPoint),
                width: Math.max(16, x(layer.outPoint) - x(layer.inPoint)),
                background: isSelected
                  ? `linear-gradient(180deg, ${color}66, ${color}36)`
                  : `linear-gradient(180deg, ${color}48, ${color}22)`,
                borderColor: `${color}${isSelected ? 'ff' : '88'}`,
                opacity: layer.visible ? 0.95 : 0.35
              }}
              title={
                layer.type === 'image'
                  ? `${layer.name} · ${layer.inPoint.toFixed(2)}s → ${layer.outPoint.toFixed(2)}s (${(layer.outPoint - layer.inPoint).toFixed(2)}s)\n💡 Kéo thả ảnh từ thư viện hoặc máy tính vào đây để đổi ảnh`
                  : `${layer.name} · ${layer.inPoint.toFixed(2)}s → ${layer.outPoint.toFixed(2)}s (${(layer.outPoint - layer.inPoint).toFixed(2)}s)`
              }
              onPointerDown={(e) => startBarDrag(e, layer, 'move')}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect()
                onBarContextMenu?.(e, layer)
              }}
              onDragOver={(e) => {
                if (layer.type === 'image' && !layer.locked) {
                  const isAsset = e.dataTransfer.types.includes('application/x-pxs-asset')
                  const isBuiltIn = e.dataTransfer.types.includes('application/x-pxs-builtin-asset')
                  const isFile = e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('files')
                  if (isAsset || isBuiltIn || isFile) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'copy'
                    if (!isDragOver) setIsDragOver(true)
                  }
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDragOver(false)
                }
              }}
              onDrop={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragOver(false)
                if (layer.type !== 'image' || layer.locked) return

                // 1. From Built-in library catalog
                const builtInRaw = e.dataTransfer.getData('application/x-pxs-builtin-asset')
                if (builtInRaw) {
                  try {
                    const item = JSON.parse(builtInRaw)
                    if (item && item.kind === 'image') {
                      const newAssetId = await importBuiltInAsset(item, false)
                      if (newAssetId) replaceLayerAsset(layer.id, newAssetId)
                    }
                  } catch (err) {
                    console.error('Error dropping built-in asset:', err)
                  }
                  return
                }

                // 2. From project assets list
                const assetId = e.dataTransfer.getData('application/x-pxs-asset')
                if (assetId) {
                  replaceLayerAsset(layer.id, assetId)
                  return
                }

                // 3. From OS / disk image files
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
                  if (file) {
                    const data = new Uint8Array(await file.arrayBuffer())
                    const added = await assetStore.add(file.name, file.type, data, 'image')
                    useEditor.getState().update((d) => {
                      d.assets.push(added.meta)
                    })
                    replaceLayerAsset(layer.id, added.meta.id)
                  }
                }
              }}
            >
              {isDragOver && (
                <div className="tl-bar-drop-badge">
                  <span>🖼 Thả để đổi ảnh</span>
                </div>
              )}
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
            {renderLayerSummary()}
            <TimelineGlowKeys
              layer={layer}
              x={x}
              trackWidth={trackWidth}
              isSubRow={false}
            />

            {/* Visual Effect Badges on Layer Bar */}
            {layer.appliedEffects?.filter((fx) => fx.category !== 'glow').map((fx) => {
              const isOff = !fx.enabled
              const fxColor = getFxColor(fx.presetId)
              return (
                <div
                  key={fx.id}
                  className={`tl-fx-badge-marker${isOff ? ' disabled' : ''}`}
                  style={{ left: x(fx.startTime) }}
                  title={`${fx.name} @ ${fx.startTime.toFixed(2)}s (${fx.duration ? `${fx.duration.toFixed(1)}s` : ''}) ${isOff ? '[ĐÃ TẮT]' : ''} - Click để nhảy tới`}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    useEditor.getState().setTime(fx.startTime)
                  }}
                >
                  <span
                    className={`tl-fx-badge-bubble${isOff ? ' disabled' : ''}`}
                    style={{
                      ['--fx-color' as string]: isOff ? 'var(--text-faint)' : fxColor,
                      borderColor: isOff ? undefined : fxColor
                    }}
                  >
                    {renderFxIcon(fx.presetId, 13, isOff ? 'var(--text-faint)' : fxColor)}
                  </span>
                </div>
              )
            })}
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
            track={renderLayerTrackKeys(layer.transform[p.prop] as Animatable<AnimValue>, p)}
          />
        ))}
      {isOpen && layer.glow && (() => {
        const isOff = !layer.glow.enabled
        return (
          <TimelineRow
            sub
            selected={isSelected}
            trackWidth={trackWidth}
            onTrackPointerDown={onTrackPointerDown}
            name={
              <div
                className="tl-name sub"
                style={{
                  color: isOff ? 'var(--text-faint)' : (layer.glow.color || 'var(--accent-cyan)'),
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  opacity: isOff ? 0.6 : 1
                }}
                title={`Hiệu ứng viền Neon (${layer.glow.animated || 'tĩnh'}) ${isOff ? '[ĐÃ TẮT]' : ''} - Click để chỉnh`}
                onClick={() => {
                  useEditor.getState().setInspectorTab('layer')
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: isOff ? 'var(--text-faint)' : (layer.glow.color || 'var(--accent-cyan)'),
                    boxShadow: isOff ? 'none' : `0 0 6px ${layer.glow.color || 'var(--accent-cyan)'}`,
                    flexShrink: 0
                  }}
                />
                <span style={{ textDecoration: isOff ? 'line-through' : 'none' }}>Viền Neon</span>
                <span style={{ fontSize: 9, opacity: 0.8, fontWeight: 'normal' }}>
                  ({isOff ? 'Đã tắt' : (layer.glow.animated === 'breathe' ? 'Thở' : layer.glow.animated === 'blink' ? 'Chớp' : layer.glow.animated === 'flicker' ? 'Flicker' : 'Tĩnh')})
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
        )
      })()}
    </div>
  )
}
