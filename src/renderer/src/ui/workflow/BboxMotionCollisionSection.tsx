import type { WorkflowNodeParams } from '@shared/types'
import { OptionPills } from './WorkflowV2NodeParams'
import { useEditor } from '../../store/editor'
import { attachLogicNodeToLayerV2, syncWorkflowV2NodeToProject } from '../../project/workflowV2Engine'
import type { BboxMotionModel } from './useBboxMotionModel'

const COLLISION_RESPONSE_OPTIONS: {
  id: NonNullable<WorkflowNodeParams['collisionResponse']>
  label: string
}[] = [
  { id: 'bounce', label: '🏀 Nảy bật ra' },
  { id: 'stop', label: '🛑 Dừng khi chạm' },
  { id: 'push', label: '💨 Đẩy lùi vật cản' },
  { id: 'shake', label: '📳 Rung chấn' },
  { id: 'jelly', label: '🍮 Lún đàn hồi' }
]


export function BboxMotionCollisionSection({ model }: { model: BboxMotionModel }) {
  const { p, node, onScrubTime, onSelectNode, rootLayer, tStart, tEnd, applyBboxPatch, sceneObstacleLayers, detectedCollisions } = model
  return (
<div className="vl-subcard" style={{ padding: '6px 7px' }}>
        <div className="vl-row-header" style={{ marginBottom: 4 }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(p.collisionOnPathEnabled)}
              onChange={(e) =>
                applyBboxPatch({
                  collisionOnPathEnabled: e.target.checked,
                  collisionResponse: p.collisionResponse ?? 'bounce',
                  collisionTargetLayerId:
                    p.collisionTargetLayerId ??
                    detectedCollisions[0]?.layerId ??
                    sceneObstacleLayers[0]?.id
                })
              }
            />
            <span>Bật va chạm trên đường đi</span>
          </label>
          {detectedCollisions.length > 0 && (
            <span className="vl-value-badge">
              Phát hiện {detectedCollisions.length} điểm chạm
            </span>
          )}
        </div>

        {p.collisionOnPathEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {detectedCollisions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {detectedCollisions.map((col) => {
                  const isSel =
                    (p.collisionTargetLayerId ?? detectedCollisions[0]?.layerId) === col.layerId
                  return (
                    <div
                      key={col.layerId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        padding: '4px 7px',
                        borderRadius: 'var(--radius-sm)',
                        background: isSel
                          ? 'color-mix(in srgb, var(--danger) 12%, var(--bg-2))'
                          : 'var(--bg-1)',
                        border: `1px solid ${isSel ? 'var(--danger)' : 'var(--line-soft)'}`
                      }}
                    >
                      <span style={{ fontSize: 10.5 }}>
                        💥 Chạm <b>{col.layerName}</b> lúc <b>{col.hitTime}s</b>{' '}
                        <small style={{ color: 'var(--text-dim)' }}>
                          ({col.depthRelationAtHit === 'same_plane'
                            ? 'Cùng tầng Z'
                            : col.depthRelationAtHit === 'in_front'
                              ? 'Đi trước'
                              : 'Đi sau'})
                        </small>
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="wf-v2-mini-btn"
                          onClick={() => onScrubTime(col.hitTime)}
                        >
                          Tua {col.hitTime}s
                        </button>
                        {!isSel && (
                          <button
                            type="button"
                            className="wf-v2-mini-btn active"
                            onClick={() => applyBboxPatch({ collisionTargetLayerId: col.layerId })}
                          >
                            Chọn
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="wf-v2-hint" style={{ margin: 0 }}>
                Kéo <b>BBox đích</b> đi cắt qua một Layer khác trên cảnh để tự động phát hiện điểm chạm và thời gian chạm!
              </p>
            )}

            <OptionPills
              cols={2}
              options={COLLISION_RESPONSE_OPTIONS}
              value={p.collisionResponse ?? 'bounce'}
              onPick={(resp) => applyBboxPatch({ collisionResponse: resp })}
            />

            {/* Nút tạo / liên kết sang Node Va chạm chuyên biệt trên sơ đồ */}
            {sceneObstacleLayers.length > 0 && (
              <button
                type="button"
                className="wf-v2-direct-btn"
                style={{ width: '100%', justifyContent: 'center', height: 25 }}
                onClick={() => {
                  const obsId =
                    p.collisionTargetLayerId ??
                    detectedCollisions[0]?.layerId ??
                    sceneObstacleLayers[0]?.id
                  if (!obsId || !rootLayer) return
                  useEditor.getState().update((d) => {
                    if (!d.workflow) return
                    const parentNodeId =
                      p.hierarchyParentNodeId ??
                      d.workflow.edges.find((e) => e.toNode === node.id && !e.disabled)?.fromNode ??
                      `v2-layer-${rootLayer.id}`
                    const obsNodeId = `v2-layer-${obsId}`
                    const r1 = attachLogicNodeToLayerV2(
                      d.workflow,
                      parentNodeId,
                      'collision',
                      'v2:collision:elastic_bounce',
                      {
                        strikerLayerId: rootLayer.id,
                        targetColliderLayerId: obsId,
                        targetLayerIds: [rootLayer.id, obsId],
                        timeStart: tStart,
                        timeEnd: tEnd
                      }
                    )
                    d.workflow = r1.workflow
                    if (!d.workflow.edges.some((e) => e.fromNode === obsNodeId && e.toNode === r1.createdNodeId)) {
                      d.workflow.edges.push({
                        id: `e-${obsNodeId}-${r1.createdNodeId}`,
                        fromNode: obsNodeId,
                        fromPort: 'layers_tree',
                        toNode: r1.createdNodeId,
                        toPort: 'layers_tree'
                      })
                    }
                    const colNode = d.workflow.nodes.find((n) => n.id === r1.createdNodeId)
                    if (colNode) {
                      syncWorkflowV2NodeToProject(d, colNode)
                      setTimeout(() => onSelectNode?.(colNode.id), 0)
                    }
                  }, 'wf-spawn-col-from-bbox')
                }}
              >
                🔗 Mở / Gắn Node Va chạm Vật lý riêng cho đường đi này
              </button>
            )}
          </div>
        )}
      </div>
  )
}
