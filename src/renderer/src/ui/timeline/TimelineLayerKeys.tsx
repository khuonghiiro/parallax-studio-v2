import type React from 'react'
import { useMemo } from 'react'
import type { Animatable, AnimValue, Keyframe, Layer } from '@shared/types'
import { EASE_LABELS } from '../../animation/easing'
import { timelineRangeAt } from '../../animation/timelineRange'
import { useEditor, type PropRef } from '../../store/editor'
import { jumpTimelineKey } from './timelineKeyEditing'
import { LAYER_PROPS } from './timelineTypes'
import { getFxColor, renderFxIcon } from './fxIcons'

interface Props {
  layer: Layer
  animation: Animatable<AnimValue>
  property: (typeof LAYER_PROPS)[number]
  x: (time: number) => number
  trackWidth?: number
  startKeyDrag?: (event: React.PointerEvent, ref: PropRef, id: string) => void
}

function LayerKey({ layer, animation, property, x, startKeyDrag, frame, selected }: Props & {
  frame: Keyframe<AnimValue>; selected: boolean
}) {
  const ref: PropRef = { kind: 'layer', layerId: layer.id, prop: property.prop }
  const fx = layer.appliedEffects?.find(effect => effect.keyframeIds?.includes(frame.id))
  const off = fx && !fx.enabled
  const color = fx ? getFxColor(fx.presetId) : undefined
  const boundary = timelineRangeAt(animation, frame.t).start?.id === frame.id ? 'range-start' : 'range-end'
  const title = `${fx?.name ?? property.label} · ${frame.t.toFixed(2)}s · ${EASE_LABELS[frame.ease]} · Bấm để sửa, kéo để dời · K thêm mốc · Alt+←/→ đổi mốc`
  return <div className={`tl-key ${fx ? 'tl-key-fx' : boundary}${off ? ' disabled' : ''}${selected ? ' selected' : ''}${frame.ease === 'hold' ? ' hold' : ''}`}
    style={{ left: x(frame.t), ['--fx-color' as string]: off ? 'var(--text-faint)' : color }}
    title={title} role="button" aria-label={title} tabIndex={layer.locked ? -1 : 0}
    onClick={event => {
      event.stopPropagation()
      if (!layer.locked && event.detail === 0) jumpTimelineKey(ref, frame.id, frame.t)
    }}
    onPointerDown={event => {
      event.stopPropagation()
      if (layer.locked) return
      jumpTimelineKey(ref, frame.id, frame.t)
      startKeyDrag?.(event, ref, frame.id)
    }}
    onKeyDown={event => {
      if (layer.locked || !['Enter', ' '].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      jumpTimelineKey(ref, frame.id, frame.t)
    }}>
    {fx && <span className="tl-key-fx-icon">{renderFxIcon(fx.presetId, 12, off ? 'var(--text-faint)' : color!)}</span>}
  </div>
}

export function TimelineLayerKeys(props: Props) {
  const { layer, animation, x, trackWidth } = props
  const selectedKey = useEditor(s => s.selectedKey)
  let lastPx = -Infinity
  const visible = animation.keyframes.filter(key => {
    if (selectedKey?.keyId === key.id || layer.appliedEffects?.some(fx => fx.keyframeIds?.includes(key.id))) return true
    const px = x(key.t)
    if (trackWidth && (px < -20 || px > trackWidth + 20) || px - lastPx < 6) return false
    lastPx = px
    return true
  })
  return <>
    {visible.map((key, index) => {
      const next = visible[index + 1]
      const width = next ? x(next.t) - x(key.t) : 0
      return width >= 8 ? <div key={`line-${key.id}`} className={`tl-tween-line${key.ease === 'hold' ? ' hold' : ''}`}
        style={{ left: x(key.t), width }} /> : null
    })}
    {visible.map(frame => <LayerKey key={frame.id} {...props} frame={frame} selected={selectedKey?.keyId === frame.id} />)}
  </>
}

function summaryGroups(layer: Layer, x: (time: number) => number) {
  const groups = new Map<number, NonNullable<Layer['appliedEffects']>>()
  for (const { prop } of LAYER_PROPS) {
    for (const key of layer.transform[prop]!.keyframes) {
      const time = Math.round(key.t * 1000) / 1000
      const list = groups.get(time) ?? []
      for (const fx of layer.appliedEffects ?? []) {
        if (fx.keyframeIds?.includes(key.id) && !list.some(item => item.id === fx.id)) list.push(fx)
      }
      groups.set(time, list)
    }
  }
  let lastPx = -Infinity
  return [...groups].sort((a, b) => a[0] - b[0]).filter(([time, effects]) => {
    if (effects.length) return true
    if (x(time) - lastPx < 6) return false
    lastPx = x(time)
    return true
  })
}

export function TimelineLayerSummary({ layer, x }: { layer: Layer; x: (time: number) => number }) {
  const entries = useMemo(() => summaryGroups(layer, x), [layer, x])
  const setTime = useEditor(s => s.setTime)
  return <>
    {entries.map(([time, effects], index) => {
      const next = entries[index + 1]
      const width = next ? x(next[0]) - x(time) : 0
      const fx = effects[0]
      const off = fx && !fx.enabled
      const color = fx ? getFxColor(fx.presetId) : undefined
      return <span key={time}>
        {width >= 8 && <div className="tl-tween-line summary-tween" style={{ left: x(time), width }} />}
        <div className={`tl-key summary${fx ? ' tl-key-fx' : ''}${off ? ' disabled' : ''}`}
          style={{ left: x(time), ['--fx-color' as string]: off ? 'var(--text-faint)' : color }}
          title={`${fx ? effects.map(item => item.name).join(' + ') : layer.name} @ ${time.toFixed(2)}s${off ? ' [ĐÃ TẮT]' : ''}`}
          onPointerDown={event => { event.stopPropagation(); setTime(time) }}>
          {fx && <span className="tl-key-fx-icon">{renderFxIcon(fx.presetId, 11, off ? 'var(--text-faint)' : color!)}</span>}
        </div>
      </span>
    })}
  </>
}
