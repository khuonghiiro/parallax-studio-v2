import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { AppliedLayerEffect, Layer } from '@shared/types'
import { listLayerEffects } from '../../animation/motionEffects'
import type { EffectDragMode, EffectTiming } from '../../animation/effectTiming'
import { useEffectSelection } from '../../store/effectSelection'
import { useEditor } from '../../store/editor'
import { TimelineRow } from './TimelineRow'
import { startEffectDrag } from './effectDrag'
import { toggleLayerEffect, deleteLayerEffect } from './timelineEffects'
import { IconTrash } from '../icons'
import '../../styles/timelineEffects.css'

export function TimelineEffectRows({ layer, x, trackWidth }: { layer: Layer; x: (time: number) => number; trackWidth?: number }) {
  return <>{listLayerEffects(layer).map((effect) => <EffectRow key={effect.id} layer={layer} effect={effect} x={x} trackWidth={trackWidth} />)}</>
}

function EffectRow({ layer, effect, x, trackWidth }: {
  layer: Layer; effect: AppliedLayerEffect; x: (time: number) => number; trackWidth?: number
}) {
  const [preview, setPreview] = useState<EffectTiming | null>(null)
  const cancelDrag = useRef<(() => void) | undefined>(undefined)
  useEffect(() => () => cancelDrag.current?.(), [layer.id, effect.id, layer.locked])
  const selection = useEffectSelection()
  const timing = preview ?? effect
  const selected = selection.layerId === layer.id && selection.effectId === effect.id
  const end = timing.duration > 0 ? timing.startTime + timing.duration : Math.max(layer.outPoint, timing.startTime)
  const select = (): void => selection.select(layer.id, effect.id)
  const drag = (event: PointerEvent, mode: EffectDragMode): void => {
    select()
    cancelDrag.current?.()
    cancelDrag.current = startEffectDrag(event, layer, effect, mode, x(1) - x(0), setPreview)
  }
  const update = (remove: boolean): void => useEditor.getState().update((p) => {
    const l = p.layers.find((item) => item.id === layer.id)
    if (!l || l.locked) return
    if (remove) deleteLayerEffect(l, effect.id)
    else toggleLayerEffect(l, effect.id, !effect.enabled)
  })
  return <TimelineRow sub selected={selected} trackWidth={trackWidth} className={`timeline-effect-row${effect.enabled ? '' : ' is-disabled'}`}
    name={<div className="timeline-effect-name">
      <button className="timeline-effect-select" onClick={select} aria-pressed={selected} title={`Chỉnh ${effect.name}`}>ƒx · {effect.name}</button>
      <button className={`switch${effect.enabled ? ' on' : ''}`} aria-label={`Bật/tắt ${effect.name}`} aria-pressed={effect.enabled}
        disabled={layer.locked} onClick={() => update(false)} />
      <button className="mini" aria-label={`Xóa ${effect.name}`} disabled={layer.locked} onClick={() => update(true)}><IconTrash width={11} /></button>
    </div>}
    track={<div className={`timeline-effect-clip${selected ? ' selected' : ''}`} data-effect-id={effect.id}
      style={{ left: x(timing.startTime), width: Math.max(8, x(end) - x(timing.startTime)) }}
      role="button" tabIndex={0} aria-label={`${effect.name}: ${timing.startTime.toFixed(2)} đến ${end.toFixed(2)} giây`}
      title="Kéo để dời · Kéo hai đầu để cắt thời lượng · Escape hủy · Enter để chỉnh"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); select() } }}
      onPointerDown={(e) => drag(e, 'move')}
      onDoubleClick={() => useEditor.getState().setTime(timing.startTime)}>
      <span className="timeline-effect-trim start" title="Chỉnh điểm bắt đầu"
        onPointerDown={(e) => drag(e, 'in')} />
      <span className="timeline-effect-label">{effect.name} · {(end - timing.startTime).toFixed(2)}s</span>
      <span className="timeline-effect-trim end" title="Chỉnh điểm kết thúc"
        onPointerDown={(e) => drag(e, 'out')} />
    </div>} />
}
