import { ParamSlider } from './WorkflowV2NodeParams'
import { useEditor } from '../../store/editor'
import { syncWorkflowV2NodeToProject } from '../../project/workflowV2Engine'
import type { BboxMotionModel } from './useBboxMotionModel'

export function BboxMotionTargetSection({ model }: { model: BboxMotionModel }) {
  const { node, rootLayer, startPos, targetX, targetY, targetScalePct, depthMode, startZ, applyBboxPatch } = model
  return (
<div className="vl-subcard" style={{ padding: '6px 7px' }}>
        <div className="vl-row-header" style={{ marginBottom: 4 }}>
          <span className="vl-subtitle">Vị trí & kích thước đích</span>
          <span className="vl-value-badge">
            ({targetX}, {targetY}) · {targetScalePct}%
          </span>
        </div>

        <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 6 }}>
          <button
            type="button"
            className={`vl-pill-btn ${targetScalePct === 165 ? 'active-amber' : ''}`}
            onClick={() =>
              applyBboxPatch({
                bboxTargetScalePct: 165,
                ...(depthMode === 'depth_z' ? { bboxTargetZ: startZ - 110 } : {})
              })
            }
            title="Cho BBox đích to hơn: khi di chuyển tới đích sẽ to dần lên cho tới khi vừa khít BBox đích"
          >
            Phóng to · 165%
          </button>
          <button
            type="button"
            className={`vl-pill-btn ${targetScalePct === 55 ? 'active-amber' : ''}`}
            onClick={() =>
              applyBboxPatch({
                bboxTargetScalePct: 55,
                ...(depthMode === 'depth_z' ? { bboxTargetZ: startZ + 110 } : {})
              })
            }
            title="Cho BBox đích nhỏ hơn: khi di chuyển tới đích sẽ nhỏ dần đi cho tới khi vừa khít BBox đích"
          >
            Thu nhỏ · 55%
          </button>
          <button
            type="button"
            className={`vl-pill-btn ${targetScalePct === 100 ? 'active-amber' : ''}`}
            onClick={() => applyBboxPatch({ bboxTargetScalePct: 100 })}
          >
            Giữ cỡ · 100%
          </button>
          <button
            type="button"
            className="vl-pill-btn"
            onClick={() => {
              if (!rootLayer) return
              const curX = Math.round(startPos[0])
              const curY = Math.round(startPos[1])
              useEditor.getState().update((d) => {
                const rl = d.layers.find((l) => l.id === rootLayer.id)
                if (rl) rl.transform.position.value = [targetX, targetY, startZ]
                const wfNode = d.workflow?.nodes.find((n) => n.id === node.id)
                if (wfNode?.params) {
                  wfNode.params.bboxTargetX = curX
                  wfNode.params.bboxTargetY = curY
                }
                if (wfNode) syncWorkflowV2NodeToProject(d, wfNode, { bboxTargetX: curX, bboxTargetY: curY })
              }, 'wf-bbox-swap12')
            }}
            title="Đổi chỗ vị trí xuất phát đầu và vị trí đích đích"
          >
            Đảo đầu / đích
          </button>
        </div>

        <ParamSlider
          layout="stacked"
          label="Kích thước đích"
          min={20}
          max={300}
          step={5}
          value={targetScalePct}
          format={(v) => `${Math.round(v)}%`}
          onChange={(v) => applyBboxPatch({ bboxTargetScalePct: Math.round(v) }, 'wf-bbox-scale')}
        />
        <ParamSlider
          layout="stacked"
          label="Vị trí X"
          min={-960}
          max={960}
          step={10}
          value={targetX}
          format={(v) => `${Math.round(v)}px`}
          onChange={(v) => applyBboxPatch({ bboxTargetX: Math.round(v) }, 'wf-bbox-x')}
        />
        <ParamSlider
          layout="stacked"
          label="Vị trí Y"
          min={-540}
          max={540}
          step={10}
          value={targetY}
          format={(v) => `${Math.round(v)}px`}
          onChange={(v) => applyBboxPatch({ bboxTargetY: Math.round(v) }, 'wf-bbox-y')}
        />
      </div>
  )
}
