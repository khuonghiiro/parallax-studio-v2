import type { Layer, Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { getClusterDisplayName, getClusterMemberLayers, getClusterRootLayer } from '../../project/workflowV2ClusterRigAndSwap'
import type { ProjectedLayer2D } from '../viewer/animateCamera/animateCameraMath'

interface MotionEntityInput {
  project: Project
  workflow: WorkflowGraph
  motionNode?: WorkflowNode
  coordRefLayer?: Layer
  layers2D?: ProjectedLayer2D[]
  selectedProjLayer?: ProjectedLayer2D
}

function collectMotionLayerIds({ project, workflow, motionNode, coordRefLayer }: MotionEntityInput): Set<string> {
  const mp = motionNode?.params
  const ids = new Set<string>()
  if (mp?.targetLayerIds?.length) {
    for (const id of mp.targetLayerIds) ids.add(id)
  }
  if (mp?.sharedLayerNodeIds?.length) {
    for (const nid of mp.sharedLayerNodeIds) {
    if (nid.startsWith('v2-layer-')) ids.add(nid.slice('v2-layer-'.length))
    const nObj = workflow.nodes.find((n) => n.id === nid)
    const nodeLayerId = nObj?.params?.rootLayerId ?? (nObj?.params as Record<string, any> | undefined)?.layerId
    if (nodeLayerId) ids.add(nodeLayerId)
    if (nObj?.params?.instanceId) {
      const members = getClusterMemberLayers(project, nObj.params.instanceId)
      for (const m of members) ids.add(m.id)
    }
    }
  }
  if (motionNode) {
    const inEdges = workflow.edges.filter((e) => e.toNode === motionNode.id && !e.disabled)
    for (const e of inEdges) {
    const srcNode = workflow.nodes.find((n) => n.id === e.fromNode)
    if (srcNode?.params?.targetLayerIds?.length) {
      for (const id of srcNode.params.targetLayerIds) ids.add(id)
    }
    const srcLayerId = srcNode?.params?.rootLayerId ?? (srcNode?.params as Record<string, any> | undefined)?.layerId
    if (srcLayerId) {
      ids.add(srcLayerId)
    } else if (srcNode?.id?.startsWith('v2-layer-')) {
      ids.add(srcNode.id.slice('v2-layer-'.length))
    }
    if (srcNode?.params?.instanceId) {
      const members = getClusterMemberLayers(project, srcNode.params.instanceId)
      for (const m of members) ids.add(m.id)
    }
    }
  }
  if (coordRefLayer && !ids.has(coordRefLayer.id)) {
    ids.add(coordRefLayer.id)
  }

  return ids
}

function projectClusterBounds(memberProjs: ProjectedLayer2D[], root: Layer): ProjectedLayer2D | undefined {
  let proj: ProjectedLayer2D | undefined
  if (memberProjs.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of memberProjs) {
      minX = Math.min(minX, p.offsetX - p.width / 2)
      maxX = Math.max(maxX, p.offsetX + p.width / 2)
      minY = Math.min(minY, p.offsetY - p.height / 2)
      maxY = Math.max(maxY, p.offsetY + p.height / 2)
    }
    const baseP = memberProjs.find((p) => p.id === root.id) ?? memberProjs[0]
    proj = {
      ...baseP,
      name: getClusterDisplayName(root),
      offsetX: (minX + maxX) / 2,
      offsetY: (minY + maxY) / 2,
      width: Math.max(24, maxX - minX),
      height: Math.max(24, maxY - minY)
    }
  }
  return proj
}

export function resolveMotionEntities(input: MotionEntityInput) {
  const { project, coordRefLayer, layers2D, selectedProjLayer } = input
  const ids = collectMotionLayerIds(input)
    const entityMap = new Map<
      string,
      {
        id: string
        rootLayer: Layer
        isCluster: boolean
        name: string
        parts?: ProjectedLayer2D[]
        projLayer?: ProjectedLayer2D
      }
    >()

    for (const lid of Array.from(ids)) {
      const l = project.layers.find((ly) => ly.id === lid)
      if (!l) continue
      const inst = l.composite?.instanceId ?? l.model3d?.instanceId
      if (inst) {
        if (!entityMap.has(inst)) {
          const members = getClusterMemberLayers(project, inst)
          const rootL = getClusterRootLayer(members) ?? members[0] ?? l
          const memberIds = new Set(members.map((m) => m.id))
          const memberProjs = layers2D?.filter((lp) => memberIds.has(lp.id)) ?? []
          const proj = projectClusterBounds(memberProjs, rootL)
          entityMap.set(inst, {
            id: inst,
            rootLayer: rootL,
            isCluster: true,
            name: getClusterDisplayName(rootL),
            parts: memberProjs,
            projLayer: proj ?? (rootL.id === coordRefLayer?.id ? selectedProjLayer : undefined)
          })
        }
      } else {
        if (!entityMap.has(l.id)) {
          const proj =
            layers2D?.find((p) => p.id === l.id) ??
            (l.id === coordRefLayer?.id ? selectedProjLayer : undefined)
          entityMap.set(l.id, {
            id: l.id,
            rootLayer: l,
            isCluster: false,
            name: l.name,
            projLayer: proj
          })
        }
      }
    }

    if (entityMap.size === 0 && coordRefLayer) {
      entityMap.set(coordRefLayer.id, {
        id: coordRefLayer.id,
        rootLayer: coordRefLayer,
        isCluster: false,
        name: coordRefLayer.name,
        projLayer: selectedProjLayer
      })
    }

    return Array.from(entityMap.values())
}
