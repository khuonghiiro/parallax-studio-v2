import type { ReactNode } from 'react'
import { TimelineRangeControls } from './TimelineRangeControls'
import type { Layer } from '@shared/types'
import { useEditor, type LayerProp } from '../../store/editor'
import { AnimRow } from '../controls'
import { IconPropOpacity, IconPropPosition, IconPropRotation, IconPropScale } from '../icons'
import '../../styles/timelineProperties.css'
import { focusTimelineProperty, useActiveTimelineProperty } from './timelineKeyEditing'

const PROP_ICONS: Record<LayerProp, ReactNode> = {
  position: <IconPropPosition width={12} height={12} />,
  rotation: <IconPropRotation width={12} height={12} />,
  scale: <IconPropScale width={12} height={12} />,
  opacity: <IconPropOpacity width={12} height={12} />
}

/** Same authored values, animation rules and Undo gestures as the Inspector. */
export function TimelinePropertyControls({ layer, prop, label }: { layer: Layer; prop: LayerProp; label: string }) {
  const percent = prop === 'scale' || prop === 'opacity'
  const refp = { kind: 'layer' as const, layerId: layer.id, prop }
  const isActive = useActiveTimelineProperty(refp)
  const animation = layer.transform[prop]
  if (!animation) return null
  return (
    <fieldset
      className={`tl-property-controls prop-${prop}${isActive ? ' active' : ''}`}
      disabled={layer.locked}
      data-layer-property={prop}
      aria-label={`${layer.name} · ${label}`}
      aria-current={isActive ? 'true' : undefined}
      title={`${label} · Kéo số hoặc thanh trượt để chỉnh · ◆ bật/tắt mốc · Bấm biểu tượng đường cong để chọn kiểu chuyển động`}
      tabIndex={layer.locked ? -1 : 0}
      onClick={(event) => {
        event.stopPropagation()
        focusTimelineProperty(refp)
      }}
      onFocusCapture={() => {
        useEditor.getState().setPlaying(false)
        focusTimelineProperty({ kind: 'layer', layerId: layer.id, prop })
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        useEditor.getState().setPlaying(false)
        focusTimelineProperty({ kind: 'layer', layerId: layer.id, prop })
      }}
    >
      <fieldset className="tl-range-values">
        <AnimRow
          label={label}
          icon={PROP_ICONS[prop]}
          refp={{ kind: 'layer', layerId: layer.id, prop }}
          kind={prop === 'opacity' ? 'number' : prop === 'scale' ? 'vec2' : 'vec3'}
          step={prop === 'scale' ? 0.5 : 1}
          precision={prop === 'opacity' ? 0 : 1}
          displayScale={percent ? 100 : 1}
          suffix={percent ? '%' : prop === 'rotation' ? '°' : undefined}
          min={prop === 'opacity' ? 0 : undefined}
          max={prop === 'opacity' ? 100 : undefined}
          linkable={prop === 'scale'}
          timelineEditing
        />
      </fieldset>
      <TimelineRangeControls animation={animation} refp={{ kind: 'layer', layerId: layer.id, prop }} />
      {layer.locked && <span className="tl-property-lock" title="Mở khóa layer để chỉnh thuộc tính" />}
    </fieldset>
  )
}

