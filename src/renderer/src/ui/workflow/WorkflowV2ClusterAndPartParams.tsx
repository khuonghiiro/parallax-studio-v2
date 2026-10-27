import React, { useMemo, useState } from 'react'
import type { Vec3 } from '@shared/types'
import {
  getClusterMemberLayers,
  getClusterPartShortName,
  getClusterRootLayer,
  v2LayerNodeId
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { Assembly3DDialog } from '../assets/models3d/Assembly3DDialog'
import { getStoredModels3D } from '../assets/models3d/models3dStorage'
import type { Model3D } from '../assets/models3d/types'
import { LayerAssemblyDialog } from '../layerAssembly/LayerAssemblyDialog'
import { findCompositeTemplate } from '../layerAssembly/scenePartSwap'
import type { LayerComposite } from '../layerAssembly/types'
import {
  Cluster25DTransformSection,
  Cluster3DTransformSection,
  ClusterMemberPositionColumnSection
} from './WorkflowV2ClusterSubSections'
import type { WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

export { WorkflowV2PartSwapParams } from './WorkflowV2PartSwapParams'

export function WorkflowV2ClusterLockParams({
  node,
  project,
  workflow,
  onUpdate,
  onConnectLayer,
  onDisconnectEdge,
  onToggleEdgeDisable
}: WorkflowV2NodeParamsProps): React.ReactElement {
  const editorUpdate = useEditor((s) => s.update)
  const selectLayer = useEditor((s) => s.selectLayer)
  const p = node.params ?? {}
  const instId = p.instanceId
  const members = useMemo(
    () => getClusterMemberLayers(project, instId, project.layers.find((l) => (p.targetLayerIds ?? []).includes(l.id))),
    [project, instId, p.targetLayerIds]
  )
  const rootLayer = getClusterRootLayer(members)
  const is3D = Boolean(rootLayer?.model3d)
  const isLocked = node.enabled && (p.lockedGroup ?? true)
  const isCollapsed = Boolean(p.collapsedSubLayers)

  const [editingModel, setEditingModel] = useState<Model3D | null>(null)
  const [editingComposite, setEditingComposite] = useState<LayerComposite | null>(null)
  const [showCompositeModal, setShowCompositeModal] = useState(false)

  const rootPos: Vec3 = rootLayer?.transform.position.value ?? [p.transformX ?? 0, p.transformY ?? 0, p.transformZ ?? 0]
  const scalePct = Math.round(Math.abs(rootLayer?.transform.scale.value?.[0] ?? (p.clusterScalePct ?? 100) / 100) * 100)
  const model3d = rootLayer?.model3d

  const openWorkshop25D = (): void => {
    const compId = rootLayer?.composite?.compositeId
    const found = findCompositeTemplate(compId)
    setEditingComposite(found ?? null)
    setShowCompositeModal(true)
  }

  const openWorkshop3D = (): void => {
    if (!model3d) return
    const stored = getStoredModels3D()
    const found = stored.find((m) => m.id === model3d.modelId)
    setEditingModel(
      found ?? {
        id: model3d.modelId,
        name: model3d.modelName,
        category: 'custom',
        scale: model3d.initialScale || 1.0,
        faces: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    )
  }

  const toggleMemberConnection = (layerId: string, currentlyConnected: boolean): void => {
    const layerNodeId = v2LayerNodeId(layerId)
    const existingEdge = workflow?.edges.find((e) => e.fromNode === layerNodeId && e.toNode === node.id)
    if (currentlyConnected && existingEdge) {
      if (onDisconnectEdge) {
        onDisconnectEdge(existingEdge.id)
        return
      }
    }
    if (!currentlyConnected) {
      if (existingEdge && existingEdge.disabled && onToggleEdgeDisable) {
        onToggleEdgeDisable(existingEdge.id)
        return
      }
      if (onConnectLayer) {
        onConnectLayer(layerNodeId, node.id)
        return
      }
    }
    editorUpdate((d) => {
      const l = d.layers.find((x) => x.id === layerId)
      if (!l) return
      if (l.composite) l.composite.lockedGroup = !currentlyConnected
      if (l.model3d) l.model3d.lockedGroup = !currentlyConnected
    })
  }

  const connectedCount = members.filter((m) => {
    const layerNodeId = v2LayerNodeId(m.id)
    const edge = workflow?.edges.find((e) => e.fromNode === layerNodeId && e.toNode === node.id)
    if (edge) return !edge.disabled
    return m.composite ? m.composite.lockedGroup !== false : m.model3d ? m.model3d.lockedGroup !== false : true
  }).length

  return (
    <>
      <div className="wf-v2-insp-subhead">
        🔒 Logic Khoá Cụm ({connectedCount}/{members.length} mảnh đang nối line khoá)
      </div>
      <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <button
          type="button"
          className={`wf-v2-opt-pill${isLocked ? ' active' : ''}`}
          onClick={() => onUpdate({ lockedGroup: !isLocked })}
          title={
            isLocked
              ? 'Đang KHOÁ CỤM: Các mảnh có đường line nối vào Node Khoá Cụm sẽ di chuyển & nhận logic đồng bộ'
              : 'Đang MỞ KHOÁ TOÀN CỤM: Tạm thời cho phép chỉnh lẻ từng mảnh'
          }
        >
          {isLocked ? '🔒 Đang khoá theo line' : '🔓 Mở khoá toàn cụm'}
        </button>
        <button
          type="button"
          className={`wf-v2-opt-pill${!isCollapsed ? ' active' : ''}`}
          onClick={() => onUpdate({ collapsedSubLayers: !isCollapsed })}
          title="Bung toàn bộ các mảnh layer con trên sơ đồ Workflow hoặc thu gọn chỉ giữ lại mảnh gốc"
        >
          {isCollapsed ? `📁 Bung ${members.length} mảnh con` : `📂 Đang bung ${members.length} mảnh`}
        </button>
      </div>

      {members.length > 0 && (
        <>
          <div className="wf-v2-insp-subhead">
            🔗 Kết nối Line từ từng Layer đến Khoá Cụm
          </div>
          <p className="wf-v2-hint" style={{ marginBottom: 4 }}>
            Layer nào <b>có line nối vào Khoá Cụm</b> sẽ được khoá đi theo cụm. Ngắt line (🔌/✕) để tách riêng Layer đó khỏi cụm.
          </p>
          <div className="wf-v2-member-lock-list">
            {members.map((m) => {
              const layerNodeId = v2LayerNodeId(m.id)
              const edge = workflow?.edges.find((e) => e.fromNode === layerNodeId && e.toNode === node.id)
              const isMemberConnected = edge
                ? !edge.disabled
                : m.composite
                  ? m.composite.lockedGroup !== false
                  : m.model3d
                    ? m.model3d.lockedGroup !== false
                    : true
              const isRoot = m.id === rootLayer?.id
              const shortName = getClusterPartShortName(m)
              return (
                <div
                  key={m.id}
                  className={`wf-v2-member-lock-row${isMemberConnected ? ' is-locked' : ' is-unlocked'}`}
                >
                  <button
                    type="button"
                    className="wf-v2-member-name-btn"
                    title={`Chọn mảnh "${m.name}"`}
                    onClick={() => selectLayer(m.id)}
                  >
                    <span className="ico">{isRoot ? '⚓' : is3D ? '🧊' : '🧩'}</span>
                    <span className="txt">{shortName}</span>
                  </button>
                  {!is3D && members.length > 1 && (
                    <button
                      type="button"
                      className={`wf-v2-mini-btn${isRoot ? ' active' : ''}`}
                      title={isRoot ? 'Đang là Gốc neo định vị của cụm' : `Đặt "${shortName}" làm Gốc neo định vị`}
                      onClick={() => onUpdate({ rootLayerId: m.id })}
                    >
                      ⚓ Gốc
                    </button>
                  )}
                  <button
                    type="button"
                    className={`wf-v2-member-line-btn${isMemberConnected ? ' on' : ' off'}`}
                    title={
                      isMemberConnected
                        ? `Đang nối line vào Khoá Cụm — nhấn để ngắt line (mở khoá riêng "${shortName}")`
                        : `Đang ngắt line (không khoá theo cụm) — nhấn để nối lại vào Khoá Cụm`
                    }
                    onClick={() => toggleMemberConnection(m.id, isMemberConnected)}
                  >
                    {isMemberConnected ? '🔗 Đang khoá' : '🔌 Đã tách line'}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {!is3D && (
        <ClusterMemberPositionColumnSection
          clusterNodeId={node.id}
          instId={instId}
          rootLayer={rootLayer}
          members={members}
          standaloneLayers={project.layers.filter(
            (l) => !l.composite && !l.model3d && (!p.shotId || !l.shotId || l.shotId === p.shotId)
          )}
          activeMemberLayerId={p.activeMemberLayerId}
          onUpdate={onUpdate}
        />
      )}

      {is3D && model3d ? (
        <Cluster3DTransformSection model3d={model3d} onOpenWorkshop3D={openWorkshop3D} />
      ) : (
        <Cluster25DTransformSection
          instId={instId}
          rootPos={rootPos}
          scalePct={scalePct}
          onUpdate={onUpdate}
          onOpenWorkshop25D={openWorkshop25D}
        />
      )}

      {editingModel && (
        <Assembly3DDialog
          isOpen={true}
          initialModel={editingModel}
          onClose={() => setEditingModel(null)}
          onSaved={() => setEditingModel(null)}
        />
      )}

      {showCompositeModal && (
        <LayerAssemblyDialog
          initialComposite={editingComposite}
          onClose={() => setShowCompositeModal(false)}
        />
      )}
    </>
  )
}

