import { useId, useMemo } from 'react'
import type { CreateTemplateItem } from './templateCatalogue'
import type { TemplateCategory } from './assemblyTemplates'
import { templatePreview } from './assemblyTemplates'

interface TemplateCardVisualProps {
  item: CreateTemplateItem
}

/** Theme tokens per category — both themes define these, so contrast follows the theme. */
const CATEGORY_TOKEN: Record<TemplateCategory, string> = {
  architecture: 'var(--accent-cyan)',
  decor: 'var(--key)',
  props: 'var(--accent)',
  nature: 'var(--ok)',
  stage: 'var(--accent)'
}

const PREVIEW_SIZE = 180

/** Isometric shaded preview of a geometry template (hooks always run, colours from tokens). */
function IsoPreview({ item }: TemplateCardVisualProps) {
  const patternId = useId()
  const polys = useMemo(
    () => (item.assemblyTemplate ? templatePreview(item.assemblyTemplate, PREVIEW_SIZE) : []),
    [item.assemblyTemplate]
  )
  const tone = CATEGORY_TOKEN[item.category]

  return (
    <div className="c3d-iso" style={{ color: tone }}>
      <svg className="c3d-iso-grid" viewBox="0 0 240 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <pattern id={patternId} width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M 0 10 L 20 0 L 40 10 L 20 20 Z" fill="none" stroke="currentColor" strokeOpacity={0.12} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <svg className="c3d-iso-shape" viewBox={`0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`} aria-hidden="true">
        {polys.map((p, idx) => (
          <polygon
            key={idx}
            points={p.points}
            fill="currentColor"
            fillOpacity={0.12 + p.shade * 0.5}
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  )
}

export function TemplateCardVisual({ item }: TemplateCardVisualProps) {
  // Handcrafted illustrations (Cottage, Cube, Corner, Room) are shown as-is.
  if (item.image) return <img className="c3d-thumb-img" src={item.image} alt={item.name} />
  if (item.assemblyTemplate) return <IsoPreview item={item} />
  return null
}
