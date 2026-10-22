import type { WorkflowEdge, WorkflowNode } from '@shared/types'

/** Allocate disjoint subtrees per scene, respecting assembly/part hierarchy. */
export function layoutWorkflowTree(nodes: WorkflowNode[], edges: WorkflowEdge[], height: (node: WorkflowNode) => number) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const children = new Map<string, WorkflowNode[]>()
  const parented = new Set<string>()
  const transforms = new Map<string, WorkflowNode>()
  for (const edge of edges) {
    const child = byId.get(edge.toNode)
    if (!child || !byId.has(edge.fromNode)) continue
    if (edge.toPort === 'transform_link') { transforms.set(edge.fromNode, child); parented.add(child.id); continue }
    if (edge.toPort !== 'layers_tree' || parented.has(child.id)) continue
    children.set(edge.fromNode, [...(children.get(edge.fromNode) ?? []), child])
    parented.add(child.id)
  }
  const widths = new Map<string, number>()
  const width = (node: WorkflowNode, seen = new Set<string>()): number => {
    if (seen.has(node.id)) return 320
    if (widths.has(node.id)) return widths.get(node.id)!
    const next = new Set(seen).add(node.id)
    const value = Math.max(320, (children.get(node.id) ?? []).reduce((sum, child) => sum + width(child, next), 0))
    widths.set(node.id, value)
    return value
  }
  const positions: Record<string, { x: number; y: number }> = {}
  const place = (node: WorkflowNode, x: number, y: number) => {
    if (positions[node.id]) return
    positions[node.id] = { x: x + (width(node) - 320) / 2, y }
    const transform = transforms.get(node.id)
    if (transform) positions[transform.id] = { x: positions[node.id].x, y: y + height(node) + 40 }
    const childY = y + height(node) + (transform ? height(transform) + 100 : 100)
    let childX = x
    for (const child of children.get(node.id) ?? []) { place(child, childX, childY); childX += width(child) }
  }
  let x = 80
  for (const scene of nodes.filter((node) => node.type === 'scene_shot')) {
    place(scene, x, 40)
    const peers = nodes.filter((node) => !positions[node.id] && !parented.has(node.id)
      && node.type !== 'scene_shot' && node.params?.shotId === scene.params?.shotId)
    let y = 40
    for (const peer of peers) { place(peer, x + width(scene) + 40, y); y += height(peer) + 80 }
    x += width(scene) + (peers.length ? 720 : 120)
  }
  let y = 40
  for (const node of nodes) if (!positions[node.id]) { place(node, x, y); y += height(node) + 80 }
  return positions
}
