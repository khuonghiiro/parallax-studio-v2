import React, { useState } from 'react'
import type { LayerBboxTargetConfig } from '@shared/types'
import { bboxStartPosition } from '../../project/workflowMotionStart'
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
    targetZ,
    applyBboxPatch,
    onScrubTime
  } = model

  const connectedEntities = model.connectedEntities ?? []
  const hasMultiple = connectedEntities.length > 1
  const activeEntityId = p.activeMotionTargetEntityId ?? 'all'
  const setActiveEntityId = (id: string): void => {
    applyBboxPatch({ activeMotionTargetEntityId: id }, 'wf-bbox-target-ent')
  }
  const primaryEnt = connectedEntities[0]
  const currentEnt = activeEntityId !== 'all' ? connectedEntities.find((e) => e.id === activeEntityId) : undefined
  const sharedCount = Math.max(p.sharedLayerNodeIds?.length ?? 1, connectedEntities.length)
  const multiMode = p.bboxMultiMode ?? 'group_offset'


  const currentCustom = currentEnt ? p.layerBboxTargets?.[currentEnt.id] : undefined
  const activeTargetX = currentCustom?.targetX ?? (
    currentEnt && currentEnt.id !== primaryEnt?.id && multiMode === 'group_offset'
      ? Math.round(targetX + (bboxStartPosition(currentEnt.rootLayer, tStart, node.id)[0] - startPos[0]))
      : targetX
  )
  const activeTargetY = currentCustom?.targetY ?? (
    currentEnt && currentEnt.id !== primaryEnt?.id && multiMode === 'group_offset'
      ? Math.round(targetY + (bboxStartPosition(currentEnt.rootLayer, tStart, node.id)[1] - startPos[1]))
      : targetY
  )
  const activeTargetScalePct = currentCustom?.targetScalePct ?? targetScalePct
  const activeTargetRotZ = currentCustom?.targetRotZ ?? p.bboxTargetRotZ ?? 0
  const activeTargetRotY = currentCustom?.targetRotY ?? p.bboxTargetRotY ?? 0
  const activeTargetRotX = currentCustom?.targetRotX ?? p.bboxTargetRotX ?? 0

  const handleScaleChange = (nextPct: number): void => {
    if (activeEntityId === 'all') {
      const existing = p.layerBboxTargets ?? {}
      const nextMap: Record<string, LayerBboxTargetConfig> = {}
      for (const ent of connectedEntities) {
        const cur = existing[ent.id]
        nextMap[ent.id] = {
          targetX: cur?.targetX ?? (ent.id === primaryEnt?.id || multiMode === 'converge_target' ? targetX : Math.round(targetX + (bboxStartPosition(ent.rootLayer, tStart, node.id)[0] - startPos[0]))),
          targetY: cur?.targetY ?? (ent.id === primaryEnt?.id || multiMode === 'converge_target' ? targetY : Math.round(targetY + (bboxStartPosition(ent.rootLayer, tStart, node.id)[1] - startPos[1]))),
          targetScalePct: nextPct,
          targetZ: cur?.targetZ ?? targetZ
        }
      }
      applyBboxPatch({ bboxTargetScalePct: nextPct, layerBboxTargets: nextMap }, 'wf-bbox-scale')
    } else if (currentEnt) {
      const existing = p.layerBboxTargets ?? {}
      const cur = existing[currentEnt.id]
      const updatedTargets = {
        ...existing,
        [currentEnt.id]: {
          targetX: cur?.targetX ?? activeTargetX,
          targetY: cur?.targetY ?? activeTargetY,
          targetScalePct: nextPct,
          targetZ: cur?.targetZ ?? targetZ
        }
      }
      const isPrimary = currentEnt.id === primaryEnt?.id
      applyBboxPatch({
        layerBboxTargets: updatedTargets,
        ...(isPrimary ? { bboxTargetScalePct: nextPct } : {})
      }, 'wf-bbox-scale')
    } else {
      applyBboxPatch({ bboxTargetScalePct: nextPct }, 'wf-bbox-scale')
    }
  }

  const handleXChange = (nextX: number): void => {
    if (activeEntityId === 'all') {
      const deltaX = nextX - targetX
      const existing = p.layerBboxTargets ?? {}
      const nextMap: Record<string, LayerBboxTargetConfig> = {}
      for (const ent of connectedEntities) {
        const cur = existing[ent.id]
        const baseCurX = cur?.targetX ?? (ent.id === primaryEnt?.id || multiMode === 'converge_target' ? targetX : Math.round(targetX + (bboxStartPosition(ent.rootLayer, tStart, node.id)[0] - startPos[0])))
        nextMap[ent.id] = {
          targetX: baseCurX + deltaX,
          targetY: cur?.targetY ?? (ent.id === primaryEnt?.id || multiMode === 'converge_target' ? targetY : Math.round(targetY + (bboxStartPosition(ent.rootLayer, tStart, node.id)[1] - startPos[1]))),
          targetScalePct: cur?.targetScalePct ?? targetScalePct,
          targetZ: cur?.targetZ ?? targetZ
        }
      }
      applyBboxPatch({ bboxTargetX: nextX, layerBboxTargets: nextMap }, 'wf-bbox-x')
    } else if (currentEnt) {
      const existing = p.layerBboxTargets ?? {}
      const cur = existing[currentEnt.id]
      const updatedTargets = {
        ...existing,
        [currentEnt.id]: {
          targetX: nextX,
          targetY: cur?.targetY ?? activeTargetY,
          targetScalePct: cur?.targetScalePct ?? activeTargetScalePct,
          targetZ: cur?.targetZ ?? targetZ
        }
      }
      const isPrimary = currentEnt.id === primaryEnt?.id
      applyBboxPatch({
        layerBboxTargets: updatedTargets,
        ...(isPrimary ? { bboxTargetX: nextX } : {})
      }, 'wf-bbox-x')
    } else {
      applyBboxPatch({ bboxTargetX: nextX }, 'wf-bbox-x')
    }
  }

  const handleYChange = (nextY: number): void => {
    if (activeEntityId === 'all') {
      const deltaY = nextY - targetY
      const existing = p.layerBboxTargets ?? {}
      const nextMap: Record<string, LayerBboxTargetConfig> = {}
      for (const ent of connectedEntities) {
        const cur = existing[ent.id]
        const baseCurY = cur?.targetY ?? (ent.id === primaryEnt?.id || multiMode === 'converge_target' ? targetY : Math.round(targetY + (bboxStartPosition(ent.rootLayer, tStart, node.id)[1] - startPos[1])))
        nextMap[ent.id] = {
          targetX: cur?.targetX ?? (ent.id === primaryEnt?.id || multiMode === 'converge_target' ? targetX : Math.round(targetX + (bboxStartPosition(ent.rootLayer, tStart, node.id)[0] - startPos[0]))),
          targetY: baseCurY + deltaY,
          targetScalePct: cur?.targetScalePct ?? targetScalePct,
          targetZ: cur?.targetZ ?? targetZ
        }
      }
      applyBboxPatch({ bboxTargetY: nextY, layerBboxTargets: nextMap }, 'wf-bbox-y')
    } else if (currentEnt) {
      const existing = p.layerBboxTargets ?? {}
      const cur = existing[currentEnt.id]
      const updatedTargets = {
        ...existing,
        [currentEnt.id]: {
          targetX: cur?.targetX ?? activeTargetX,
          targetY: nextY,
          targetScalePct: cur?.targetScalePct ?? activeTargetScalePct,
          targetZ: cur?.targetZ ?? targetZ
        }
      }
      const isPrimary = currentEnt.id === primaryEnt?.id
      applyBboxPatch({
        layerBboxTargets: updatedTargets,
        ...(isPrimary ? { bboxTargetY: nextY } : {})
      }, 'wf-bbox-y')
    } else {
      applyBboxPatch({ bboxTargetY: nextY }, 'wf-bbox-y')
    }
  }


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

  const handleRotChange = (axis: 'z' | 'y' | 'x', nextDeg: number): void => {
    const clamped = axis === 'z'
      ? Math.round(nextDeg)
      : Math.max(-80, Math.min(80, Math.round(nextDeg)))
    const zVal = axis === 'z' ? clamped : activeTargetRotZ
    const yVal = axis === 'y' ? clamped : activeTargetRotY
    const xVal = axis === 'x' ? clamped : activeTargetRotX

    if (activeEntityId === 'all') {
      const existing = p.layerBboxTargets ?? {}
      const nextMap: Record<string, LayerBboxTargetConfig> = {}
      for (const ent of connectedEntities) {
        const cur = existing[ent.id]
        nextMap[ent.id] = {
          ...(cur ?? {}),
          targetX: cur?.targetX ?? (ent.id === primaryEnt?.id || multiMode === 'converge_target' ? targetX : Math.round(targetX + (bboxStartPosition(ent.rootLayer, tStart, node.id)[0] - startPos[0]))),
          targetY: cur?.targetY ?? (ent.id === primaryEnt?.id || multiMode === 'converge_target' ? targetY : Math.round(targetY + (bboxStartPosition(ent.rootLayer, tStart, node.id)[1] - startPos[1]))),
          targetScalePct: cur?.targetScalePct ?? targetScalePct,
          targetZ: cur?.targetZ ?? targetZ,
          targetRotZ: zVal,
          targetRotY: yVal,
          targetRotX: xVal
        }
      }
      applyBboxPatch({
        bboxTargetRotZ: zVal,
        bboxTargetRotY: yVal,
        bboxTargetRotX: xVal,
        layerBboxTargets: nextMap
      }, 'wf-bbox-rot')
    } else if (currentEnt) {
      const existing = p.layerBboxTargets ?? {}
      const cur = existing[currentEnt.id]
      const isPrimary = currentEnt.id === primaryEnt?.id
      applyBboxPatch({
        layerBboxTargets: {
          ...existing,
          [currentEnt.id]: {
            ...(cur ?? {}),
            targetX: cur?.targetX ?? activeTargetX,
            targetY: cur?.targetY ?? activeTargetY,
            targetScalePct: cur?.targetScalePct ?? activeTargetScalePct,
            targetZ: cur?.targetZ ?? targetZ,
            targetRotZ: zVal,
            targetRotY: yVal,
            targetRotX: xVal
          }
        },
        ...(isPrimary ? {
          bboxTargetRotZ: zVal,
          bboxTargetRotY: yVal,
          bboxTargetRotX: xVal
        } : {})
      }, 'wf-bbox-rot')
    } else {
      applyBboxPatch({
        bboxTargetRotZ: zVal,
        bboxTargetRotY: yVal,
        bboxTargetRotX: xVal
      }, 'wf-bbox-rot')
    }
  }

  const handleResetRotation = (): void => {
    handleRotChange('z', 0)
    if (activeEntityId === 'all') {
      const existing = p.layerBboxTargets ?? {}
      const nextMap: Record<string, LayerBboxTargetConfig> = {}
      for (const ent of connectedEntities) {
        const cur = existing[ent.id]
        nextMap[ent.id] = {
          ...(cur ?? {}),
          targetX: cur?.targetX ?? activeTargetX,
          targetY: cur?.targetY ?? activeTargetY,
          targetScalePct: cur?.targetScalePct ?? activeTargetScalePct,
          targetZ: cur?.targetZ ?? targetZ,
          targetRotZ: 0,
          targetRotY: 0,
          targetRotX: 0
        }
      }
      applyBboxPatch({
        bboxTargetRotZ: 0,
        bboxTargetRotY: 0,
        bboxTargetRotX: 0,
        layerBboxTargets: nextMap
      }, 'wf-bbox-rot')
    } else if (currentEnt) {
      const existing = p.layerBboxTargets ?? {}
      const cur = existing[currentEnt.id]
      const isPrimary = currentEnt.id === primaryEnt?.id
      applyBboxPatch({
        layerBboxTargets: {
          ...existing,
          [currentEnt.id]: {
            ...(cur ?? {}),
            targetX: cur?.targetX ?? activeTargetX,
            targetY: cur?.targetY ?? activeTargetY,
            targetScalePct: cur?.targetScalePct ?? activeTargetScalePct,
            targetZ: cur?.targetZ ?? targetZ,
            targetRotZ: 0,
            targetRotY: 0,
            targetRotX: 0
          }
        },
        ...(isPrimary ? {
          bboxTargetRotZ: 0,
          bboxTargetRotY: 0,
          bboxTargetRotX: 0
        } : {})
      }, 'wf-bbox-rot')
    } else {
      applyBboxPatch({
        bboxTargetRotZ: 0,
        bboxTargetRotY: 0,
        bboxTargetRotX: 0
      }, 'wf-bbox-rot')
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

      {hasMultiple && (
        <div style={{ marginTop: 8, marginBottom: 6 }}>
          <div className="wf-v2-subsec-head" style={{ marginBottom: 4 }}>
            <span>🎯 Chọn BBox Đích để điều chỉnh:</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <button
              type="button"
              className={`vl-pill-btn ${activeEntityId === 'all' ? 'active-amber' : ''}`}
              onClick={() => setActiveEntityId('all')}
              title="Điều chỉnh đồng thời tất cả BBox đích của các Layer đang kết nối"
              style={{ fontWeight: activeEntityId === 'all' ? 600 : 400 }}
            >
              🔗 Tất cả ({connectedEntities.length})
            </button>
            {connectedEntities.map((ent, idx) => {
              const isAct = activeEntityId === ent.id
              return (
                <button
                  key={ent.id}
                  type="button"
                  className={`vl-pill-btn ${isAct ? 'active-amber' : ''}`}
                  onClick={() => setActiveEntityId(ent.id)}
                  title={`Điều chỉnh BBox đích riêng của "${ent.name}"`}
                  style={{ fontWeight: isAct ? 600 : 400 }}
                >
                  🎯 #{idx + 1} {ent.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="vl-row-header" style={{ marginBottom: 4, marginTop: 6 }}>
        <span className="vl-subtitle">
          Vị trí &amp; kích thước đích {currentEnt ? `· ${currentEnt.name}` : hasMultiple ? '· Tất cả BBox' : ''}
        </span>
        <span className="vl-value-badge">
          ({activeTargetX}, {activeTargetY}) · {activeTargetScalePct}%
        </span>
      </div>

      <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 6 }}>
        <button
          type="button"
          className={`vl-pill-btn ${activeTargetScalePct === 165 ? 'active-amber' : ''}`}
          onClick={() => handleScaleChange(165)}
          title="Cho BBox đích to hơn: khi di chuyển tới đích sẽ to dần lên cho tới khi vừa khít BBox đích"
        >
          Phóng to · 165%
        </button>
        <button
          type="button"
          className={`vl-pill-btn ${activeTargetScalePct === 55 ? 'active-amber' : ''}`}
          onClick={() => handleScaleChange(55)}
          title="Cho BBox đích nhỏ hơn: khi di chuyển tới đích sẽ nhỏ dần đi cho tới khi vừa khít BBox đích"
        >
          Thu nhỏ · 55%
        </button>
        <button
          type="button"
          className={`vl-pill-btn ${activeTargetScalePct === 100 ? 'active-amber' : ''}`}
          onClick={() => handleScaleChange(100)}
        >
          Giữ cỡ · 100%
        </button>
        <button
          type="button"
          className="vl-pill-btn"
          onClick={() => {
            const swapTargetLayer = currentEnt ? currentEnt.rootLayer : rootLayer
            if (!swapTargetLayer) return
            const cPos = bboxStartPosition(swapTargetLayer, tStart, node.id)
            const curX = Math.round(cPos[0])
            const curY = Math.round(cPos[1])
            useEditor.getState().update((d) => {
              const rl = d.layers.find((l) => l.id === swapTargetLayer.id)
              if (rl) rl.transform.position.value = [activeTargetX, activeTargetY, startZ]
              const wfNode = d.workflow?.nodes.find((n) => n.id === node.id)
              if (wfNode?.params) {
                if (currentEnt && currentEnt.id !== primaryEnt?.id) {
                  wfNode.params.layerBboxTargets = {
                    ...(wfNode.params.layerBboxTargets ?? {}),
                    [currentEnt.id]: {
                      ...(wfNode.params.layerBboxTargets?.[currentEnt.id] ?? {}),
                      targetX: curX,
                      targetY: curY,
                      targetScalePct: activeTargetScalePct
                    }
                  }
                } else {
                  wfNode.params.bboxTargetX = curX
                  wfNode.params.bboxTargetY = curY
                }
              }
              if (wfNode) syncWorkflowV2NodeToProject(d, wfNode, wfNode.params ?? {})
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
        value={activeTargetScalePct}
        format={(v) => `${Math.round(v)}%`}
        onChange={handleScaleChange}
      />
      <ParamSlider
        layout="stacked"
        label="Vị trí X"
        min={-960}
        max={960}
        step={10}
        value={activeTargetX}
        format={(v) => `${Math.round(v)}px`}
        onChange={handleXChange}
      />
      <ParamSlider
        layout="stacked"
        label="Vị trí Y"
        min={-540}
        max={540}
        step={10}
        value={activeTargetY}
        format={(v) => `${Math.round(v)}px`}
        onChange={handleYChange}
      />

      {/* Cụm Góc xoay BBox 3D nằm ngay bên dưới Slider Vị trí Y */}
      <div className="vl-row-header" style={{ marginBottom: 4, marginTop: 10 }}>
        <span className="vl-subtitle" style={{ color: 'var(--accent-cyan, #38bdf8)' }}>
          🔄 Góc xoay BBox 3D {currentEnt ? `· ${currentEnt.name}` : ''}
        </span>
        {(activeTargetRotZ !== 0 || activeTargetRotY !== 0 || activeTargetRotX !== 0) && (
          <button
            type="button"
            className="btn ghost sm"
            style={{ padding: '1px 6px', fontSize: 10, height: 20 }}
            onClick={handleResetRotation}
            title="Đưa toàn bộ góc xoay Z, Y, X về 0°"
          >
            ↺ Đặt lại 0°
          </button>
        )}
      </div>

      <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 6 }}>
        <button
          type="button"
          className={`vl-pill-btn ${activeTargetRotZ === 0 && activeTargetRotY === 0 && activeTargetRotX === 0 ? 'active-amber' : ''}`}
          onClick={handleResetRotation}
          title="Reset toàn bộ góc xoay về 0°"
        >
          0° Thẳng
        </button>
        <button
          type="button"
          className={`vl-pill-btn ${activeTargetRotZ === 45 ? 'active-amber' : ''}`}
          onClick={() => handleRotChange('z', 45)}
          title="Nghiêng góc mặt phẳng Z 45°"
        >
          Z +45°
        </button>
        <button
          type="button"
          className={`vl-pill-btn ${activeTargetRotY === 40 ? 'active-amber' : ''}`}
          onClick={() => handleRotChange('y', 40)}
          title="Xoay lật ngang 3D Y 40°"
        >
          Y +40°
        </button>
        <button
          type="button"
          className={`vl-pill-btn ${activeTargetRotX === 30 ? 'active-amber' : ''}`}
          onClick={() => handleRotChange('x', 30)}
          title="Ngửa cúi 3D X 30°"
        >
          X +30°
        </button>
      </div>

      <ParamSlider
        layout="stacked"
        label="Xoay Z (Mặt phẳng / Roll)"
        min={-180}
        max={180}
        step={5}
        value={activeTargetRotZ}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => handleRotChange('z', v)}
      />
      <ParamSlider
        layout="stacked"
        label="Lật Y (Xoay ngang / Yaw)"
        min={-80}
        max={80}
        step={5}
        value={activeTargetRotY}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => handleRotChange('y', v)}
      />
      <ParamSlider
        layout="stacked"
        label="Ngửa X (Cúi / Ngửa / Pitch)"
        min={-80}
        max={80}
        step={5}
        value={activeTargetRotX}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => handleRotChange('x', v)}
      />
    </div>
  )
}
