import type { Layer } from '@shared/types'
import type { LayerProp } from '../../store/editor'
import { AnimRow } from '../controls'
import '../../styles/timelineProperties.css'

/** Same authored values, animation rules and Undo gestures as the Inspector. */
export function TimelinePropertyControls({ layer, prop, label }: { layer: Layer; prop: LayerProp; label: string }) {
  const percent = prop === 'scale' || prop === 'opacity'
  return <fieldset className="tl-property-controls" disabled={layer.locked}
    data-layer-property={prop} aria-label={`${layer.name} · ${label}`}
    onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <AnimRow label={label} refp={{ kind: 'layer', layerId: layer.id, prop }}
      kind={prop === 'opacity' ? 'number' : prop === 'scale' ? 'vec2' : 'vec3'}
      step={prop === 'scale' ? 0.5 : 1} precision={1} displayScale={percent ? 100 : 1}
      suffix={percent ? '%' : prop === 'rotation' ? '°' : undefined}
      min={prop === 'opacity' ? 0 : undefined} max={prop === 'opacity' ? 100 : undefined}
      linkable={prop === 'scale'} />
    {layer.locked && <span className="tl-property-lock" title="Mở khóa layer để chỉnh thuộc tính" />}
  </fieldset>
}
