import { useMemo } from 'react'
import type { CreateTemplateItem } from './templateCatalogue'
import { templatePreview } from './assemblyTemplates'

interface TemplateCardVisualProps {
  item: CreateTemplateItem
}

const CATEGORY_PALETTES = {
  architecture: {
    stroke: '#38bdf8',
    fill: '#0284c7',
    glow: 'rgba(56, 189, 248, 0.25)',
    grid: 'rgba(56, 189, 248, 0.08)'
  },
  props: {
    stroke: '#fb923c',
    fill: '#ea580c',
    glow: 'rgba(251, 146, 60, 0.25)',
    grid: 'rgba(251, 146, 60, 0.08)'
  },
  nature: {
    stroke: '#34d399',
    fill: '#059669',
    glow: 'rgba(52, 211, 153, 0.25)',
    grid: 'rgba(52, 211, 153, 0.08)'
  },
  stage: {
    stroke: '#a78bfa',
    fill: '#6366f1',
    glow: 'rgba(167, 139, 250, 0.25)',
    grid: 'rgba(167, 139, 250, 0.08)'
  }
}

export function TemplateCardVisual({ item }: TemplateCardVisualProps) {
  const { image, assemblyTemplate, category, name } = item

  // If handcrafted detailed SVG image is present (Cottage, Cube, Corner, Room), use it directly
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    )
  }

  // Otherwise render vector 3D isometric line-art with depth shading
  if (assemblyTemplate) {
    const polys = useMemo(() => templatePreview(assemblyTemplate, 180), [assemblyTemplate])
    const pal = CATEGORY_PALETTES[category] || CATEGORY_PALETTES.architecture

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at center, var(--bg-1) 0%, var(--bg-0) 100%)',
          position: 'relative'
        }}
      >
        {/* Isometric subtle grid backdrop */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 240 140"
          style={{ position: 'absolute', inset: 0, opacity: 0.7 }}
          aria-hidden="true"
        >
          <defs>
            <pattern id={`iso-grid-${category}`} width="40" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 0 10 L 20 0 L 40 10 L 20 20 Z"
                fill="none"
                stroke={pal.grid}
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#iso-grid-${category})`} />
        </svg>

        {/* 3D Isometric Polygons */}
        <svg
          viewBox="0 0 180 180"
          style={{
            width: '120px',
            height: '120px',
            filter: `drop-shadow(0 6px 14px ${pal.glow})`,
            zIndex: 1
          }}
          aria-hidden="true"
        >
          {polys.map((p, idx) => (
            <polygon
              key={idx}
              points={p.points}
              fill={pal.fill}
              fillOpacity={0.16 + p.shade * 0.58}
              stroke={pal.stroke}
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    )
  }

  return null
}
