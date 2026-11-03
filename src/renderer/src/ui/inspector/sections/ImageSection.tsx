import { useCallback, useState } from 'react'
import type { Layer, Vec3 } from '@shared/types'
import { toast } from '../../../actions'
import { setValueAt } from '../../../animation/keyframes'
import { referenceDistance } from '../../../animation/math'
import { assetStore } from '../../../project/assets'
import {
  attachLogicNodeToLayerV2,
  syncWorkflowV2Graph,
  syncWorkflowV2NodeToProject,
  v2LayerNodeId
} from '../../../project/workflowV2Engine'
import { frameTolerance, useEditor } from '../../../store/editor'
import { useView } from '../../../store/view'
import { NumberInput, Row } from '../../controls'
import { openLoopAnimatorInPlace } from '../../loopAnimator/loopAnimatorLauncher'
import { AssetReplaceModal } from '../AssetReplaceModal'
import type { Setter } from '../types'

export function ImageSection({ layer, set }: { layer: Layer & { type: 'image' }; set: Setter }) {
  const [showReplaceModal, setShowReplaceModal] = useState(false)
  const handleCloseModal = useCallback(() => setShowReplaceModal(false), [])
  const comp = useEditor((s) => s.project.comp)
  const time = useEditor((s) => s.time)
  const tol = useEditor((s) => frameTolerance(s.project))
  const asset = assetStore.get(layer.props.assetId)
  const isLoopOrGif = Boolean(
    asset?.meta.isAnimated || asset?.gif || layer.props.loopTemplateId
  )

  const setScale = (k: number): void =>
    set((l) => setValueAt(l.transform.scale, time, [k, k, 1] as Vec3, tol))
  const matchComp = (): void => {
    useEditor.getState().update((d) => {
      d.comp.width = layer.props.width
      d.comp.height = layer.props.height
      const refD = referenceDistance(d.comp)
      d.camera.position.value = [0, 0, -refD]
      d.camera.target.value = [0, 0, 0]
      d.camera.focusDistance.value = Math.round(refD)
    })
  }

  const handleOpenInLoopStudio = (): void => {
    openLoopAnimatorInPlace(layer.props.loopTemplateId)
  }

  const handleOpenLoopNodeInWorkflow = (): void => {
    let targetNodeId = `v2-loop_anim-${layer.id}`
    useEditor.getState().update((d) => {
      const wf = syncWorkflowV2Graph(d, d.workflow)
      const res = attachLogicNodeToLayerV2(
        wf,
        v2LayerNodeId(layer.id),
        'loop_anim',
        `v2:loop_anim:${layer.props.loopMode === 'ping-pong' ? 'ping_pong' : (layer.props.loopMode ?? 'loop')}`
      )
      d.workflow = res.workflow
      targetNodeId = res.createdNodeId || targetNodeId
      const createdNode = res.workflow.nodes.find((n) => n.id === targetNodeId)
      if (createdNode) {
        syncWorkflowV2NodeToProject(d, createdNode)
      }
    })
    useView.getState().setTimelineTab('workflow')
    window.dispatchEvent(new CustomEvent('pxs:select-workflow-node', { detail: { nodeId: targetNodeId } }))
    toast(`🔁 Đã mở Node Animation Loop của "${layer.name}" trên Workflow!`)
  }

  return (
    <div className="section" data-mcp-region="inspector_loop_logic">
      <div className="section-title">Ảnh</div>
      <Row label="Nguồn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 }}>
          <span
            className="hint-text"
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={`${asset?.meta.name ?? '—'} · ${layer.props.width}×${layer.props.height}`}
          >
            {asset?.meta.name ?? '—'} · {layer.props.width}×{layer.props.height}
          </span>
          <button
            type="button"
            className="btn sm accent"
            style={{ flexShrink: 0, padding: '2px 8px', fontSize: 11 }}
            title="Đổi nguồn ảnh khác cho layer này (giữ nguyên vị trí 3D, keyframes, độ sâu Z)"
            onClick={() => setShowReplaceModal(true)}
          >
            Đổi ảnh...
          </button>
        </div>
      </Row>
      <Row label="Kích thước">
        <button className="btn sm" title="Phủ kín khung hình" onClick={() => setScale(Math.max(comp.width / layer.props.width, comp.height / layer.props.height))}>
          Phủ khung
        </button>
        <button className="btn sm" title="Thu vừa lọt vào khung hình" onClick={() => setScale(Math.min(comp.width / layer.props.width, comp.height / layer.props.height))}>
          Vừa khung
        </button>
        <button className="btn sm" title="Giữ nguyên 100% kích thước pixel gốc" onClick={() => setScale(1)}>
          100%
        </button>
        <button className="btn sm" title="Đổi kích thước khung hình (Composition) bằng đúng kích thước ảnh này" onClick={matchComp}>
          Khớp khung
        </button>
      </Row>
      <Row label="Lặp texture" title="Lặp lại ảnh theo chiều rộng (X) và chiều sâu (Y) khi làm mặt đất/sàn">
        <NumberInput
          axis="x"
          value={layer.props.repeat?.[0] ?? 1}
          min={1}
          max={64}
          step={1}
          precision={0}
          onChange={(v) =>
            set((l) => {
              if (l.type === 'image') {
                const rep = l.props.repeat ? [...l.props.repeat] : [1, 1]
                rep[0] = v
                l.props.repeat = rep as [number, number]
              }
            })
          }
        />
        <NumberInput
          axis="y"
          value={layer.props.repeat?.[1] ?? 1}
          min={1}
          max={64}
          step={1}
          precision={0}
          onChange={(v) =>
            set((l) => {
              if (l.type === 'image') {
                const rep = l.props.repeat ? [...l.props.repeat] : [1, 1]
                rep[1] = v
                l.props.repeat = rep as [number, number]
              }
            })
          }
        />
      </Row>

      {isLoopOrGif && (
        <>
          <div style={{ height: 6 }} />
          <div className="section-title" style={{ marginTop: 8 }}>
            🔁 Tài nguyên Hoạt Ảnh Loop
            <span className="spacer" />
            <span className="badge-count">
              {asset?.meta.frameCount ?? asset?.gif?.frames.length ?? 1} frames · {(layer.props.speed ?? 1).toFixed(1)}×
            </span>
          </div>
          <Row label="Điều khiển">
            <button
              type="button"
              className="btn sm"
              onClick={handleOpenInLoopStudio}
              title="Mở Xưởng Tách Hoạt Ảnh Loop để chỉnh sửa khung cắt và Chroma Key"
            >
              ✎ Xưởng Loop
            </button>
            <button
              type="button"
              className="btn sm accent"
              onClick={handleOpenLoopNodeInWorkflow}
              title="Mở Node Animation Loop kết nối mặc định của Layer này trên Workflow"
            >
              🔁 Node Animation Loop
            </button>
          </Row>
        </>
      )}

      {showReplaceModal && (
        <AssetReplaceModal
          layerId={layer.id}
          currentAssetId={layer.props.assetId}
          layerName={layer.name}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}
