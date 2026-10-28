import { startIntervalDrag } from './intervalDrag'
import { useTimelineSelection } from './timelineSelection'
import { intervalId, type TimelineInterval } from '../../project/timelineIntervals'
import type { PointerEvent } from 'react'
import type { AppliedLayerEffect, Layer } from '@shared/types'
import { listLayerEffects } from '../../animation/motionEffects'
import type { EffectDragMode } from '../../animation/effectTiming'
import { useEffectSelection } from '../../store/effectSelection'
import { useEditor } from '../../store/editor'
import { TimelineRow } from './TimelineRow'

import { toggleLayerEffect, deleteLayerEffect } from './timelineEffects'
import { getFxColor, renderFxIcon } from './fxIcons'
import { IconTrash } from '../icons'
import '../../styles/timelineEffects.css'

export function TimelineEffectRows({ layer, x, trackWidth }: { layer: Layer; x: (time: number) => number; trackWidth?: number }) {
  return <>{listLayerEffects(layer).map((effect) => <EffectRow key={effect.id} layer={layer} effect={effect} x={x} trackWidth={trackWidth} />)}</>
}

function EffectRow({ layer, effect, x, trackWidth }: {
  layer: Layer; effect: AppliedLayerEffect; x: (time: number) => number; trackWidth?: number
}) {
  const item: TimelineInterval = { kind: 'effect', layerId: layer.id, effectId: effect.id }
  const multiSelected = useTimelineSelection(s => s.intervals.some(i => intervalId(i) === intervalId(item)))
  const selection = useEffectSelection()
  const timing = effect
  const selected = selection.layerId === layer.id && selection.effectId === effect.id
  const end = timing.duration > 0 ? timing.startTime + timing.duration : Math.max(layer.outPoint, timing.startTime)
  const select = (): void => {
    selection.select(layer.id, effect.id)
    useEditor.getState().selectLayer(layer.id)
    useEditor.getState().setInspectorTab('node')
  }
  const drag = (event: PointerEvent, mode: EffectDragMode): void => {
    select()
    startIntervalDrag(event, item, x(1) - x(0), mode)
  }
  const update = (remove: boolean): void => useEditor.getState().update((p) => {
    const l = p.layers.find((item) => item.id === layer.id)
    if (!l || l.locked) return
    if (remove) deleteLayerEffect(l, effect.id)
    else toggleLayerEffect(l, effect.id, !effect.enabled)
  })
  const fxColor = getFxColor(effect.presetId)
  return <TimelineRow sub selected={selected} trackWidth={trackWidth} className={`timeline-effect-row${effect.enabled ? '' : ' is-disabled'}`}
    name={<div className="timeline-effect-name">
      <button className="timeline-effect-select" onClick={select} aria-pressed={selected} title={`Chỉnh ${effect.name}`}>
        <span className="timeline-effect-icon" style={{ color: effect.enabled ? fxColor : 'var(--text-faint)' }} aria-hidden="true">
          {renderFxIcon(effect.presetId, 12, effect.enabled ? fxColor : 'var(--text-faint)')}
        </span>
        <span className="timeline-effect-title">ƒx · {effect.name}</span>
      </button>
      <button className={`switch${effect.enabled ? ' on' : ''}`} aria-label={`Bật/tắt ${effect.name}`} aria-pressed={effect.enabled}
        disabled={layer.locked} onClick={() => update(false)} />
      <button className="mini" aria-label={`Xóa ${effect.name}`} disabled={layer.locked} onClick={() => update(true)}><IconTrash width={11} /></button>
    </div>}
    track={<div className={`timeline-effect-clip${multiSelected ? ' interval-selected' : ''}`} data-effect-id={effect.id} data-timeline-interval={intervalId(item)} aria-pressed={multiSelected}
      style={{ left: x(timing.startTime), width: Math.max(8, x(end) - x(timing.startTime)) }}
      role="button" tabIndex={0} aria-label={`${effect.name}: ${timing.startTime.toFixed(2)} đến ${end.toFixed(2)} giây`}
      title="Kéo để dời · Kéo hai đầu để cắt thời lượng · Escape hủy · Enter để chỉnh"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); select() } }}
      onClick={e => { e.stopPropagation(); if (e.detail === 0 && !layer.locked) { useTimelineSelection.getState().pick(item, e.ctrlKey || e.metaKey); select() } }}
      onPointerDown={(e) => drag(e, 'move')}
      onDoubleClick={() => useEditor.getState().setTime(timing.startTime)}>
      <span className="timeline-effect-trim start" title="Chỉnh điểm bắt đầu"
        onClick={e => { e.stopPropagation(); if (e.detail === 0 && !layer.locked) { useTimelineSelection.getState().pick(item, e.ctrlKey || e.metaKey); select() } }}
      onPointerDown={(e) => drag(e, 'in')} />
      <span className="timeline-effect-label">{effect.name} · {(end - timing.startTime).toFixed(2)}s</span>
      <span className="timeline-effect-trim end" title="Chỉnh điểm kết thúc"
        onClick={e => { e.stopPropagation(); if (e.detail === 0 && !layer.locked) { useTimelineSelection.getState().pick(item, e.ctrlKey || e.metaKey); select() } }}
      onPointerDown={(e) => drag(e, 'out')} />
    </div>} />
}
