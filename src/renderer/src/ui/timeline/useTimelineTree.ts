import { useState } from 'react'
import type { Project } from '@shared/types'

function toggleId(current: Set<string>, id: string): Set<string> {
  const next = new Set(current)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** View-only tree state; expanding branches never changes project data or Undo history. */
export function useTimelineTree(project: Project) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set())
  const expandAll = () => {
    setCollapsed(new Set())
    setCollapsedClusters(new Set())
    setExpanded(new Set(['camera', ...project.layers.map((layer) => layer.id),
      ...project.shots.map((shot) => `shotkeys:${shot.id}`)]))
  }
  const collapseAll = () => {
    setExpanded(new Set())
    // Without shots there is no global root row to reopen, so keep its layers visible.
    setCollapsed(new Set(project.shots.length ? ['__global', ...project.shots.map((shot) => shot.id)] : []))
    setCollapsedClusters(new Set(project.layers.flatMap((layer) => {
      const id = layer.composite?.instanceId || layer.model3d?.instanceId
      return id ? [id] : []
    })))
  }
  return {
    expanded, collapsed, collapsedClusters, expandAll, collapseAll,
    toggle: (id: string) => setExpanded((state) => toggleId(state, id)),
    toggleGroup: (id: string) => setCollapsed((state) => toggleId(state, id)),
    toggleCluster: (id: string) => setCollapsedClusters((state) => toggleId(state, id))
  }
}
