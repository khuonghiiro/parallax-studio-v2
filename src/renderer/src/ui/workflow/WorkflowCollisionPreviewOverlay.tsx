import React from 'react'
import type { Project, WorkflowNode } from '@shared/types'
import { evaluate } from '../../animation/keyframes'
import { findWorkflowContact, workflowLayerBounds } from '../../project/workflowBboxContact'

interface Props {
  project: Project
  node: WorkflowNode
  stageW: number
  stageH: number
  centerX: number
  centerY: number
  zoom: number
}

/** The collision inspector shows both real paths; editing remains on their Motion nodes. */
export function WorkflowCollisionPreviewOverlay({ project, node, stageW, stageH, centerX, centerY, zoom }: Props) {
  const p = node.params ?? {}
  const a = project.layers.find(l => l.id === (p.strikerLayerId ?? p.targetLayerIds?.[0]))
  const b = project.layers.find(l => l.id === p.targetColliderLayerId)
  const start = p.timeStart ?? 0, end = p.timeEnd ?? project.comp.duration
  const contact = a && b ? findWorkflowContact(project, a, b, start, end,
    p.depthMode === 'flat_2d' ? Number.MAX_VALUE : 24) : null
  const screen = (x: number, y: number, z: number) => {
    const perspective = 1483.64 / Math.max(80, 1483.64 + z)
    return [centerX + x * perspective * zoom, centerY - y * perspective * zoom]
  }
  return <svg className="wf-collision-preview" data-mcp-region="workflow_collision_preview"
    width={stageW} height={stageH} style={{ position: 'absolute', inset: 0, zIndex: 24, pointerEvents: 'none' }}>
    {[a, b].map((layer, index) => {
      if (!layer) return null
      const label = index === 0 ? 'A' : 'B'
      const color = index === 0 ? 'var(--accent-cyan)' : 'var(--key)'
      const points = Array.from({ length: 49 }, (_, i) => {
        const pos = evaluate(layer.transform.position, start + (end - start) * i / 48)
        return screen(...pos).join(',')
      }).join(' ')
      return <g key={layer.id} stroke={color}>
        <title>{label}: {layer.name} — chỉnh đường đi ở node Motion nối với layer này</title>
        <polyline points={points} fill="none" strokeWidth={1.5} strokeDasharray="4 3" />
        {[start, end].map((time, step) => {
          const bounds = workflowLayerBounds(project, layer, time)
          if (bounds.isEmpty()) return null
          const z = -(bounds.min.z + bounds.max.z) / 2
          const [left, top] = screen(bounds.min.x, bounds.max.y, z)
          const [right, bottom] = screen(bounds.max.x, bounds.min.y, z)
          const tx = Math.max(4, Math.min(stageW - 38, left))
          const ty = Math.max(14, Math.min(stageH - 6, top - 4 - index * 14))
          return <g key={step}>
            <rect x={left} y={top} width={Math.max(1, right - left)} height={Math.max(1, bottom - top)}
              fill="none" strokeWidth={1.4} strokeDasharray={step ? '5 2' : undefined} rx={4} />
            <text x={tx} y={ty} fill={color} stroke="var(--bg-0)" strokeWidth={3}
              paintOrder="stroke" fontSize={10} fontWeight={700}>{label}{step + 1}</text>
          </g>
        })}
      </g>
    })}
    <text x={8} y={stageH - 10} fill="var(--text)" stroke="var(--bg-0)" strokeWidth={3}
      paintOrder="stroke" fontSize={10}>{!a || !b ? 'Nối đủ layer A và B' : contact ? `Chạm · ${contact.time.toFixed(2)}s` : 'Không giao nhau'}</text>
  </svg>
}
