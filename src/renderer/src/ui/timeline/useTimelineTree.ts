import { useCallback, useRef, useState } from 'react'
import type { Layer, Project } from '@shared/types'

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
  const projectRef = useRef(project)
  projectRef.current = project

  const expandAll = useCallback(() => {
    const p = projectRef.current
    setCollapsed(new Set())
    setCollapsedClusters(new Set())
    setExpanded(new Set(['camera', ...p.layers.map((layer) => layer.id),
      ...p.shots.map((shot) => `shotkeys:${shot.id}`)]))
  }, [])

  const collapseAll = useCallback(() => {
    const p = projectRef.current
    setExpanded(new Set())
    // Without shots there is no global root row to reopen, so keep its layers visible.
    setCollapsed(new Set(p.shots.length ? ['__global', ...p.shots.map((shot) => shot.id)] : []))
    setCollapsedClusters(new Set(p.layers.flatMap((layer) => {
      const id = layer.composite?.instanceId || layer.model3d?.instanceId
      return id ? [id] : []
    })))
  }, [])

  const toggle = useCallback((id: string) => setExpanded((state) => toggleId(state, id)), [])
  const toggleGroup = useCallback((id: string) => setCollapsed((state) => toggleId(state, id)), [])
  const toggleCluster = useCallback((id: string) => setCollapsedClusters((state) => toggleId(state, id)), [])
  const ensureLayerVisible = useCallback((layerOrId: Layer | string, expandCluster = true) => {
    const layer = typeof layerOrId === 'string'
      ? projectRef.current.layers.find((l) => l.id === layerOrId)
      : layerOrId
    if (!layer) return
    if (layer.shotId) {
      setCollapsed((prev) => {
        if (!prev.has(layer.shotId!)) return prev
        const next = new Set(prev)
        next.delete(layer.shotId!)
        return next
      })
    }
    const clusterId = layer.composite?.instanceId || layer.model3d?.instanceId
    if (clusterId && expandCluster) {
      setCollapsedClusters((prev) => {
        if (!prev.has(clusterId)) return prev
        const next = new Set(prev)
        next.delete(clusterId)
        return next
      })
    }
  }, [])

  return {
    expanded, collapsed, collapsedClusters, expandAll, collapseAll,
    toggle, toggleGroup, toggleCluster, ensureLayerVisible
  }
}
