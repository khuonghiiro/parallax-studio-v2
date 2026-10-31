import React from 'react'
import { toast } from '../../actions'
import { snapCameraToEntityBBox } from '../../project/shotSpatial3D'
import { syncWorkflowV2NodeToProject } from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { ParamSlider } from './WorkflowV2NodeParams'
import type { BboxMotionModel } from './useBboxMotionModel'

export function BboxMotionTargetSection({ model }: { model: BboxMotionModel }): React.ReactElement {
  const {
    p,
    node,
    rootLayer,
    tStart,
    tEnd,
    startPos,
    targetX,
    targetY,
    targetScalePct,
    depthMode,
    startZ,
    applyBboxPatch,
    onScrubTime
  } = model

  const sharedCount = p.sharedLayerNodeIds?.length ?? 1
  const multiMode = p.bboxMultiMode ?? 'group_offset'

  const handleCameraTrackMotion = (): void => {
    const layerIds = p.targetLayerIds?.length ? p.targetLayerIds : rootLayer ? [rootLayer.id] : []
    if (layerIds.length === 0) return
    let ok = false
    useEditor.getState().update((draft) => {
      const res = snapCameraToEntityBBox(draft, {
        shotId: p.shotId ?? rootLayer?.shotId ?? undefined,
        layerIds,
        atTime: tStart,
        mode: 'follow_bbox_motion',
        endTime: tEnd,
        startXY: [Math.round(startPos[0]), Math.round(startPos[1])],
        targetXY: [Math.round(targetX), Math.round(targetY)],
        targetScalePct
      })
      ok = Boolean(res)
    }, 'wf-bbox-cam-follow')
    if (ok) {
      onScrubTime(tStart)
      toast(`🎥 Camera 3D đã tự tạo lộ trình lia bám BBox #1 ➔ #2 (${tStart.toFixed(1)}s – ${tEnd.toFixed(1)}s)`)
    }
  }

  return (
    <div className="vl-subcard" style={{ padding: '6px 7px' }}>
      {sharedCount > 1 && (
        <div className="wf-bbox-multi-card">
          <div className="wf-v2-subsec-head">
            <span>🔗 Đang kết hợp di chuyển chung {sharedCount} BBox</span>
          </div>
          <div className="wf-v2-seg-tabs" role="tablist" aria-label="Cách di chuyển nhiều BBox">
            <button
              type="button"
              role="tab"
              aria-selected={multiMode === 'group_offset'}
              className={`wf-v2-seg-tab${multiMode === 'group_offset' ? ' active' : ''}`}
              title="Các BBox cùng dịch chuyển song song, giữ nguyên khoảng cách đội hình ban đầu"
              onClick={() => applyBboxPatch({ bboxMultiMode: 'group_offset' }, 'wf-bbox-multimode')}
            >
              🔗 Giữ đội hình
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={multiMode === 'converge_target'}
              className={`wf-v2-seg-tab${multiMode === 'converge_target' ? ' active' : ''}`}
              title="Mỗi BBox xuất phát từ vị trí riêng của nó và cùng tiến về toạ độ BBox Đích #2"
              onClick={() => applyBboxPatch({ bboxMultiMode: 'converge_target' }, 'wf-bbox-multimode')}
            >
              🎯 Cùng hội tụ về Đích
            </button>
          </div>
        </div>
      )}

      {/* 1-Click khớp Camera 3D lia bám theo Motion BBox mà không cần dựng lộ trình Camera thủ công */}
      <button
        type="button"
        className="wf-v2-opt-pill active wf-bbox-cam-cta"
        title="Tự động khớp Camera 3D bắt từ BBox #1 lia theo chủ thể tới BBox #2 mà không cần dựng lộ trình Camera bằng tay"
        onClick={handleCameraTrackMotion}
      >
        <span className="wf-v2-opt-pill-txt">
          🎥 Khớp Camera 3D lia bám BBox #1 → #2 ({tStart.toFixed(1)}s–{tEnd.toFixed(1)}s)
        </span>
      </button>

      <div className="vl-row-header" style={{ marginBottom: 4, marginTop: 6 }}>
        <span className="vl-subtitle">Vị trí &amp; kích thước đích</span>
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
          title="Đổi chỗ vị trí xuất phát đầu và vị trí đích"
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
