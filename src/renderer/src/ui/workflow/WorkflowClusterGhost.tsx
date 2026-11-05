import type { Project } from '@shared/types'
import { assetStore } from '../../project/assets'
import type { ProjectedLayer2D } from '../viewer/animateCamera/animateCameraMath'

/** Preserve the projected arrangement; a cluster root image is never a cluster preview. */
export function WorkflowClusterGhost({ parts, bounds, project, opacity }: {
  parts: ProjectedLayer2D[]
  bounds: ProjectedLayer2D
  project: Project
  opacity: number
}) {
  return <div className="wf-cluster-ghost-parts" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity }}>
    {parts.map(part => {
      const runtime = part.assetId ? assetStore.get(part.assetId) : undefined
      const asset = project.assets.find(a => a.id === part.assetId)
      const src = runtime?.url || runtime?.thumbUrl || asset?.dataUrl
      return <div key={part.id} style={{
        position: 'absolute',
        left: `${50 + (part.offsetX - bounds.offsetX - part.width / 2) / bounds.width * 100}%`,
        top: `${50 + (part.offsetY - bounds.offsetY - part.height / 2) / bounds.height * 100}%`,
        width: `${part.width / bounds.width * 100}%`,
        height: `${part.height / bounds.height * 100}%`,
        opacity: part.opacity,
        transform: `rotate(${part.rotation}deg)`,
        background: part.type === 'solid' ? part.solidColor : undefined
      }}>
        {src && <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', display: 'block' }} />}
        {part.type === 'text' && <span style={{ color: part.textColor }}>{part.text}</span>}
      </div>
    })}
  </div>
}
