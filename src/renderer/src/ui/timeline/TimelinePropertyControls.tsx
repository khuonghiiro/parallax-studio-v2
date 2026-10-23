import type { Layer } from '@shared/types'
import { useEditor, type LayerProp } from '../../store/editor'
import { AnimRow } from '../controls'
import '../../styles/timelineProperties.css'
import { focusTimelineProperty, useTimelineProperty } from './timelineKeyEditing'

/** Same authored values, animation rules and Undo gestures as the Inspector. */
export function TimelinePropertyControls({ layer, prop, label }: { layer: Layer; prop: LayerProp; label: string }) {
  const percent = prop === 'scale' || prop === 'opacity'
  const active = useTimelineProperty(s => s.ref)
  const keyRef = useEditor(s => s.selectedKey?.ref)
  const selected = useEditor(s => s.selectedLayerId)
  const animation = layer.transform[prop]
  if (!animation) return null
  const chosen = keyRef?.kind === 'layer' && keyRef.layerId === layer.id ? keyRef : active
  const activeProp = chosen?.kind === 'layer' && chosen.layerId === layer.id ? chosen.prop : 'position'
  const isActive = selected === layer.id && activeProp === prop
  return <fieldset className={`tl-property-controls${isActive ? ' active' : ''}`} disabled={layer.locked}
    data-layer-property={prop} aria-label={`${layer.name} · ${label}`}
    title="Bấm để chọn thuộc tính. Thanh Chuyển động phía trên dùng để thêm mốc và chọn cách di chuyển."
    tabIndex={layer.locked ? -1 : 0}
    onFocusCapture={() => { useEditor.getState().setPlaying(false); focusTimelineProperty({ kind: 'layer', layerId: layer.id, prop }) }}
    onPointerDown={(event) => {
      event.stopPropagation()
      useEditor.getState().setPlaying(false)
      focusTimelineProperty({ kind: 'layer', layerId: layer.id, prop })
    }}>
    <fieldset className="tl-range-values">
    <AnimRow label={label} refp={{ kind: 'layer', layerId: layer.id, prop }}
      kind={prop === 'opacity' ? 'number' : prop === 'scale' ? 'vec2' : 'vec3'}
      step={prop === 'scale' ? 0.5 : 1} precision={1} displayScale={percent ? 100 : 1}
      suffix={percent ? '%' : prop === 'rotation' ? '°' : undefined}
      min={prop === 'opacity' ? 0 : undefined} max={prop === 'opacity' ? 100 : undefined}
      linkable={prop === 'scale'} timelineEditing />
    </fieldset>
    {layer.locked && <span className="tl-property-lock" title="Mở khóa layer để chỉnh thuộc tính" />}
  </fieldset>
}
