import type { Layer } from '@shared/types'
import { useEditor, type LayerProp } from '../../store/editor'
import { timelineRangeAt } from '../../animation/timelineRange'
import { AnimRow } from '../controls'
import '../../styles/timelineProperties.css'
import { TimelineRangeControls } from './TimelineRangeControls'

/** Same authored values, animation rules and Undo gestures as the Inspector. */
export function TimelinePropertyControls({ layer, prop, label }: { layer: Layer; prop: LayerProp; label: string }) {
  const percent = prop === 'scale' || prop === 'opacity'
  const time = useEditor(s => s.time)
  const animation = layer.transform[prop]
  if (!animation) return null
  const { start, end } = timelineRangeAt(animation, time)
  const editable = !!start && time >= start.t - 1e-4 && (!end || time <= end.t + 1e-4)
  return <fieldset className="tl-property-controls" disabled={layer.locked}
    data-layer-property={prop} aria-label={`${layer.name} · ${label}`}
    title="Đặt Đầu, chuyển thời gian rồi đặt Cuối. Bấm mốc để sửa giá trị; kéo mốc trên đường thời gian để đổi thời điểm."
    onFocusCapture={() => useEditor.getState().setPlaying(false)}
    onPointerDown={(event) => { event.stopPropagation(); useEditor.getState().setPlaying(false) }}
    onKeyDown={(event) => event.stopPropagation()}>
    <fieldset className="tl-range-values" disabled={!editable}>
    <AnimRow label={label} refp={{ kind: 'layer', layerId: layer.id, prop }}
      kind={prop === 'opacity' ? 'number' : prop === 'scale' ? 'vec2' : 'vec3'}
      step={prop === 'scale' ? 0.5 : 1} precision={1} displayScale={percent ? 100 : 1}
      suffix={percent ? '%' : prop === 'rotation' ? '°' : undefined}
      min={prop === 'opacity' ? 0 : undefined} max={prop === 'opacity' ? 100 : undefined}
      linkable={prop === 'scale'} timelineEditing />
    </fieldset>
    <TimelineRangeControls animation={animation} refp={{ kind: 'layer', layerId: layer.id, prop }} />
    {layer.locked && <span className="tl-property-lock" title="Mở khóa layer để chỉnh thuộc tính" />}
  </fieldset>
}
