import type { Animatable, AnimValue, Layer } from '@shared/types'
import type { TimelineLayerRowProps } from './TimelineLayerRow'
import { useEditor, type PropRef } from '../../store/editor'
import { TimelineRow } from './TimelineRow'
import { TimelinePropertyControls } from './TimelinePropertyControls'
import { TimelineLayerKeys } from './TimelineLayerKeys'
import { focusTimelineProperty, useActiveTimelineProperty } from './timelineKeyEditing'
import type { LAYER_PROPS } from './timelineTypes'

export function TimelinePropertyRow({ layer, property, x, trackWidth, startKeyDrag, onTrackPointerDown }: {
  layer: Layer; property: typeof LAYER_PROPS[number]
} & Pick<TimelineLayerRowProps, 'x' | 'trackWidth' | 'startKeyDrag' | 'onTrackPointerDown'>) {
  const ref: PropRef = { kind: 'layer', layerId: layer.id, prop: property.prop }
  const active = useActiveTimelineProperty(ref)
  return <TimelineRow sub selected={active} className="tl-property-row" trackWidth={trackWidth}
    onClick={() => focusTimelineProperty(ref)}
    onTrackPointerDown={event => {
      focusTimelineProperty(ref)
      useEditor.getState().selectKey(null)
      onTrackPointerDown?.(event)
    }}
    name={<TimelinePropertyControls layer={layer} prop={property.prop} label={property.label} />}
    track={<TimelineLayerKeys layer={layer} animation={layer.transform[property.prop] as Animatable<AnimValue>}
      property={property} x={x} trackWidth={trackWidth} startKeyDrag={startKeyDrag} />} />
}
