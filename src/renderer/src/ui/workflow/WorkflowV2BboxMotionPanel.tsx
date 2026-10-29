import { bboxStartPosition } from '../../project/workflowMotionStart'
import React, { useMemo, useState } from 'react'
import type { Layer, Vec3, WorkflowNodeParams } from '@shared/types'
import { evaluate } from '../../animation/keyframes'
import {
  depthToZIndex,
  detectPathCollisionsInScene,
  evaluateCleanLayerPos,
  zIndexToDepth
} from '../../project/workflowV2BboxMotionAndCollision'
import {
  attachLogicNodeToLayerV2,
  getClusterMemberLayers,
  getClusterRootLayer,
  getLayerDisplayName,
  syncWorkflowV2NodeToProject
} from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import { resolveActionTargetLayerIds } from './WorkflowV2MotionAndRigEditors'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

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

/**
 * Bảng cấu hình Chuyển động BBox Đích (đầu -> đích) + Chiều sâu Z-Index + Tác động Va chạm trên đường đi.
 */
export const WorkflowV2BboxMotionPanel: React.FC<{
  props: WorkflowV2NodeParamsProps
  onSpawnFollowupNode?: (durationSec?: number) => void
}> = ({ props, onSpawnFollowupNode }) => {
  const { node, project, onScrubTime, onSelectNode } = props
  const p = node.params ?? {}
  const targetIds = useMemo(() => resolveActionTargetLayerIds(props), [props])
  const instId =
    p.instanceId ??
    project.layers.find((l) => targetIds.includes(l.id) && l.composite?.instanceId)?.composite?.instanceId
  const clusterMembers = useMemo(
    () => (instId ? getClusterMemberLayers(project, instId) : []),
    [project, instId]
  )
  const rootLayer: Layer | undefined = useMemo(
    () =>
      getClusterRootLayer(clusterMembers) ??
      project.layers.find((l) => targetIds.includes(l.id)),
    [clusterMembers, project.layers, targetIds]
  )

  const compDur = Math.max(1, project.comp.duration || 5)
  const tStart = Number((p.timeStart ?? rootLayer?.inPoint ?? 0).toFixed(2))
  const tEnd = Number(
    Math.max(tStart + 0.3, Math.min(compDur, p.timeEnd ?? tStart + 3)).toFixed(2)
  )
  const runDuration = Number(Math.max(0.3, tEnd - tStart).toFixed(2))

  const startPos: Vec3 = useMemo(
    () => (rootLayer ? bboxStartPosition(rootLayer, tStart, node.id) : [0, 0, 0]),
    [rootLayer, tStart]
  )

  const pathType = p.bboxPathType ?? 'shortest'
  const targetX = p.bboxTargetX ?? Math.round(startPos[0] + 280)
  const targetY = p.bboxTargetY ?? Math.round(startPos[1])
  const targetScalePct = p.bboxTargetScalePct ?? 135
  const depthMode = p.depthMode ?? 'flat_2d'
  const startZ = p.bboxStartZ ?? Math.round(startPos[2] ?? 0)
  const targetZ =
    p.bboxTargetZ ??
    (depthMode === 'depth_z'
      ? Math.round(startZ - ((targetScalePct - 100) / 100) * 180)
      : startZ)

  const [draftCurve, setDraftCurve] = useState<[number, number][] | null>(null)
  const isPlaying = useEditor((s) => s.playing)

  const applyBboxPatch = (
    patch: Partial<WorkflowNodeParams>,
    mergeKey = 'wf-bbox-motion'
  ): void => {
    const merged: WorkflowNodeParams = {
      ...p,
      motionMode: 'bbox',
      actionPreset: 'bbox_target',
      bboxPathType: pathType,
      bboxTargetX: targetX,
      bboxTargetY: targetY,
      bboxTargetScalePct: targetScalePct,
      depthMode,
      bboxStartZ: startZ,
      bboxTargetZ: targetZ,
      timeStart: tStart,
      timeEnd: tEnd,
      ...patch
    }
    useEditor.getState().update((d) => {
      const wfNode = d.workflow?.nodes.find((n) => n.id === node.id)
      if (wfNode) {
        wfNode.params = { ...(wfNode.params ?? {}), ...merged }
      }
      if (wfNode) syncWorkflowV2NodeToProject(d, wfNode, merged)
    }, mergeKey)
  }

  // Danh sách các Layer khác trong cùng cảnh để làm mốc Chiều sâu Z (cây, đá...) hoặc mục tiêu Va chạm
  const movingIdSet = useMemo(() => {
    const s = new Set(targetIds)
    for (const m of clusterMembers) s.add(m.id)
    return s
  }, [targetIds, clusterMembers])

  const sceneObstacleLayers = useMemo(() => {
    const shotId = p.shotId ?? rootLayer?.shotId
    return project.layers.filter((l) => {
      if (!l.visible || movingIdSet.has(l.id)) return false
      if (l.type === 'particles' || (l.type === 'solid' && Boolean(l.props.pattern))) return false
      if (shotId && l.shotId && l.shotId !== shotId) return false
      if (l.composite?.instanceId && !l.composite.isRoot) return false
      return true
    })
  }, [project.layers, movingIdSet, p.shotId, rootLayer?.shotId])

  const detectedCollisions = useMemo(
    () =>
      detectPathCollisionsInScene(project, targetIds, {
        ...p,
        bboxPathType: pathType,
        bboxTargetX: targetX,
        bboxTargetY: targetY,
        bboxTargetScalePct: targetScalePct,
        depthMode,
        bboxStartZ: startZ,
        bboxTargetZ: targetZ,
        timeStart: tStart,
        timeEnd: tEnd
      }, node.id),
    [project, targetIds, p, pathType, targetX, targetY, targetScalePct, depthMode, startZ, targetZ, tStart, tEnd]
  )

  const handleTogglePreview = (): void => {
    const ed = useEditor.getState()
    if (ed.playing) {
      ed.setPlaying(false)
      return
    }
    applyBboxPatch({}, 'wf-bbox-preview-bake')
    onScrubTime(tStart)
    ed.setTime(tStart)
    ed.setPlaying(true)
  }

  const distPx = Math.round(Math.hypot(targetX - startPos[0], targetY - startPos[1]))
  const speedPxPerSec = Math.round(distPx / Math.max(0.2, runDuration))

  return (
    <div className="vl-subcard" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Header tóm tắt BBox đầu -> đích & nút Preview */}
      <div className="vl-row-header" style={{ flexWrap: 'wrap', gap: 4 }}>
        <span className="vl-title">
          🎯 Di chuyển BBox đầu → đích ({targetScalePct >= 105 ? `To dần ${targetScalePct}%` : targetScalePct <= 95 ? `Nhỏ dần ${targetScalePct}%` : 'Giữ cỡ 100%'})
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            type="button"
            className="wf-v2-mini-btn"
            onClick={() => onScrubTime(tStart)}
            title="Tua về vị trí xuất phát BBox đầu"
          >
            đầu ({tStart}s)
          </button>
          <button
            type="button"
            className="wf-v2-mini-btn"
            onClick={() => onScrubTime(tEnd)}
            title="Tua tới vị trí đích BBox đích"
          >
            đích ({tEnd}s)
          </button>
          <button
            type="button"
            className="wf-v2-mini-btn active"
            onClick={handleTogglePreview}
            title="Phát thử chuyển động từ BBox đầu tới BBox đích"
          >
            {isPlaying ? '⏹ Dừng' : '▶ Preview'}
          </button>
        </div>
      </div>

      {/* Chọn 1 trong 2 dạng đường đi giữa 2 BBox */}
      <div className="vl-subcard" style={{ padding: '6px 7px' }}>
        <div className="vl-row-header" style={{ marginBottom: 4 }}>
          <span className="vl-subtitle">1. Chọn dạng đường đi tới BBox đích</span>
          <span className="vl-value-badge">
            {distPx}px · ~{speedPxPerSec}px/s
          </span>
        </div>
        <OptionPills
          cols={2}
          options={[
            { id: 'shortest', label: '📏 Đường ngắn nhất (đầu → đích)' },
            { id: 'custom_curve', label: '✏️ Đặt đích rồi Vẽ đường đi' }
          ]}
          value={pathType}
          onPick={(nextType) =>
            applyBboxPatch(
              {
                bboxPathType: nextType,
                ...(nextType === 'custom_curve' && (!p.customMotionPath || p.customMotionPath.length < 2)
                  ? {
                      customMotionPath: [
                        [0.15, 0.72],
                        [0.5, 0.24],
                        [0.85, 0.68]
                      ]
                    }
                  : {})
              },
              'wf-bbox-pathtype'
            )
          }
        />

        {/* Nếu chọn Dạng 2 (Đặt đích rồi vẽ đường đi): hiện bảng vẽ nối từ đầu -> đích */}
        {pathType === 'custom_curve' && (
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                position: 'relative',
                height: 112,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line-soft)',
                background:
                  'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.1), rgba(15, 23, 42, 0.92))',
                cursor: 'crosshair',
                touchAction: 'none',
                overflow: 'hidden'
              }}
              title="Kéo chuột để vẽ đường cong nối từ BBox đầu sang BBox đích (hoặc bấm nút ✏️ Vẽ đường đầu↝đích trên Khung BBox 2D phía trên)"
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                const toNorm = (cx: number, cy: number): [number, number] => [
                  Number(Math.max(0.04, Math.min(0.96, (cx - rect.left) / Math.max(1, rect.width))).toFixed(4)),
                  Number(Math.max(0.04, Math.min(0.96, (cy - rect.top) / Math.max(1, rect.height))).toFixed(4))
                ]
                const pts: [number, number][] = [toNorm(e.clientX, e.clientY)]
                setDraftCurve(pts)
                const onMove = (pev: PointerEvent): void => {
                  const next = toNorm(pev.clientX, pev.clientY)
                  const prev = pts[pts.length - 1]
                  if (Math.hypot(next[0] - prev[0], next[1] - prev[1]) >= 0.012) {
                    pts.push(next)
                    setDraftCurve([...pts])
                  }
                }
                const onUp = (): void => {
                  window.removeEventListener('pointermove', onMove)
                  window.removeEventListener('pointerup', onUp)
                  setDraftCurve(null)
                  if (pts.length >= 2) {
                    applyBboxPatch({ bboxPathType: 'custom_curve', customMotionPath: pts }, 'wf-bbox-curve')
                  }
                }
                window.addEventListener('pointermove', onMove)
                window.addEventListener('pointerup', onUp)
              }}
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                {/* Khung đầu và đích minh hoạ */}
                <rect x={8} y={40} width={14} height={20} rx={2} fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth={1.2} />
                <rect
                  x={76}
                  y={Math.max(8, Math.min(72, 50 - 10 * (targetScalePct / 100)))}
                  width={Math.max(8, Math.min(22, 14 * (targetScalePct / 100)))}
                  height={Math.max(10, Math.min(34, 20 * (targetScalePct / 100)))}
                  rx={2}
                  fill="rgba(245, 158, 11, 0.18)"
                  stroke="#f59e0b"
                  strokeDasharray="2.5 1.5"
                  strokeWidth={1.2}
                />
                {(() => {
                  const stroke = draftCurve ?? p.customMotionPath ?? [
                    [0.15, 0.5],
                    [0.5, 0.22],
                    [0.83, 0.5]
                  ]
                  if (stroke.length < 2) return null
                  const poly = stroke.map(([x, y]) => `${(x * 100).toFixed(1)},${(y * 100).toFixed(1)}`).join(' ')
                  return (
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={poly}
                    />
                  )
                })()}
              </svg>
              <span
                style={{
                  position: 'absolute',
                  left: 6,
                  bottom: 4,
                  fontSize: 9.5,
                  color: 'var(--text-dim)',
                  pointerEvents: 'none'
                }}
              >
                ✏️ Vẽ đường cong tại đây hoặc trên Khung BBox 2D — tự khớp đầu đầu &amp; đích đích
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Cấu hình vị trí & Độ phóng đại của BBox Đích đích */}
      <div className="vl-subcard" style={{ padding: '6px 7px' }}>
        <div className="vl-row-header" style={{ marginBottom: 4 }}>
          <span className="vl-subtitle">2. Kích thước &amp; Vị trí BBox Đích đích</span>
          <span className="vl-value-badge">
            ({targetX}, {targetY}) · {targetScalePct}%
          </span>
        </div>

        <div className="vl-pill-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 6 }}>
          <button
            type="button"
            className={`vl-pill-btn ${targetScalePct >= 145 ? 'active-amber' : ''}`}
            onClick={() =>
              applyBboxPatch({
                bboxTargetScalePct: 165,
                ...(depthMode === 'depth_z' ? { bboxTargetZ: startZ - 110 } : {})
              })
            }
            title="Cho BBox đích to hơn: khi di chuyển tới đích sẽ to dần lên cho tới khi vừa khít BBox đích"
          >
            🔍 To dần tới đích (165%)
          </button>
          <button
            type="button"
            className={`vl-pill-btn ${targetScalePct <= 70 ? 'active-amber' : ''}`}
            onClick={() =>
              applyBboxPatch({
                bboxTargetScalePct: 55,
                ...(depthMode === 'depth_z' ? { bboxTargetZ: startZ + 110 } : {})
              })
            }
            title="Cho BBox đích nhỏ hơn: khi di chuyển tới đích sẽ nhỏ dần đi cho tới khi vừa khít BBox đích"
          >
            🔽 Nhỏ dần tới đích (55%)
          </button>
          <button
            type="button"
            className={`vl-pill-btn ${targetScalePct === 100 ? 'active-amber' : ''}`}
            onClick={() => applyBboxPatch({ bboxTargetScalePct: 100 })}
          >
            ⊡ Giữ nguyên cỡ (100%)
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
            ⇄ Đảo vị trí đầu ⇄ đích
          </button>
        </div>

        <ParamSlider
          layout="stacked"
          label="Cỡ BBox đích (To dần >100% · Nhỏ dần <100%)"
          min={20}
          max={300}
          step={5}
          value={targetScalePct}
          format={(v) => `${Math.round(v)}%`}
          onChange={(v) => applyBboxPatch({ bboxTargetScalePct: Math.round(v) }, 'wf-bbox-scale')}
        />
        <ParamSlider
          layout="stacked"
          label="Vị trí ngang BBox đích (Trục X)"
          min={-960}
          max={960}
          step={10}
          value={targetX}
          format={(v) => `${Math.round(v)}px`}
          onChange={(v) => applyBboxPatch({ bboxTargetX: Math.round(v) }, 'wf-bbox-x')}
        />
        <ParamSlider
          layout="stacked"
          label="Vị trí dọc BBox đích (Trục Y)"
          min={-540}
          max={540}
          step={10}
          value={targetY}
          format={(v) => `${Math.round(v)}px`}
          onChange={(v) => applyBboxPatch({ bboxTargetY: Math.round(v) }, 'wf-bbox-y')}
        />
      </div>

      {/* Mốc thời gian bắt đầu & Thời gian hoàn thành */}
      <div className="vl-subcard" style={{ padding: '6px 7px' }}>
        <ParamSlider
          layout="stacked"
          label="Bắt đầu di chuyển lúc (Mốc giây)"
          min={0}
          max={Math.max(0.5, Number((compDur - 0.3).toFixed(1)))}
          step={0.1}
          value={tStart}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={(nextStart) => {
            const cleanStart = Number(Math.max(0, Math.min(compDur - 0.3, nextStart)).toFixed(2))
            const cleanEnd = Number(Math.min(compDur, cleanStart + runDuration).toFixed(2))
            applyBboxPatch({ timeStart: cleanStart, timeEnd: cleanEnd }, 'wf-bbox-tstart')
          }}
        />
        <ParamSlider
          layout="stacked"
          label="Thời gian chạy tới BBox đích (Ngắn = Nhanh)"
          min={0.3}
          max={Math.max(1.0, Number((compDur - tStart).toFixed(1)))}
          step={0.1}
          value={runDuration}
          format={(v) => `${v.toFixed(1)}s (${tStart.toFixed(1)}s→${(tStart + v).toFixed(1)}s)`}
          onChange={(nextDur) => {
            const cleanEnd = Number(Math.min(compDur, tStart + Math.max(0.3, nextDur)).toFixed(2))
            applyBboxPatch({ timeStart: tStart, timeEnd: cleanEnd }, 'wf-bbox-dur')
          }}
        />
      </div>

      {/* Logic Chiều sâu Z-Index: Đi theo chiều sâu (vượt qua / bị cây che) hoặc Không theo chiều sâu */}
      <div className="vl-subcard" style={{ padding: '6px 7px' }}>
        <div className="vl-row-header" style={{ marginBottom: 4 }}>
          <span className="vl-subtitle">3. Chiều sâu Z-Index (Qua cây / Vật cản)</span>
          <span className="vl-value-badge">
            {depthMode === 'depth_z'
              ? `Z-Index: ${depthToZIndex(startZ)} → ${depthToZIndex(targetZ)}`
              : `Giữ Z-Index: ${depthToZIndex(startZ)}`}
          </span>
        </div>

        <OptionPills
          cols={2}
          options={[
            { id: 'flat_2d', label: '🖼️ Không theo chiều sâu (Giữ Z)' },
            { id: 'depth_z', label: '🌲 Đi theo chiều sâu (Z-Index)' }
          ]}
          value={depthMode}
          onPick={(nextDepth) =>
            applyBboxPatch(
              {
                depthMode: nextDepth,
                bboxStartZ: startZ,
                bboxTargetZ:
                  nextDepth === 'depth_z' && targetZ === startZ
                    ? startZ - (targetScalePct >= 100 ? 80 : -80)
                    : targetZ
              },
              'wf-bbox-depthmode'
            )
          }
        />

        {depthMode === 'depth_z' && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <p className="wf-v2-hint" style={{ margin: 0 }}>
              Khi đi qua vật cản (như cái cây): <b>Z-Index lớn hơn cây</b> sẽ xuất hiện phía trước cây;{' '}
              <b>Z-Index nhỏ hơn cây</b> sẽ đi phía sau và bị cây che khuất.
            </p>

            {sceneObstacleLayers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>
                  Chọn nhanh quan hệ chiều sâu với Layer trong cảnh:
                </span>
                {sceneObstacleLayers.slice(0, 5).map((obs) => {
                  const obsZ = Math.round(evaluateCleanLayerPos(obs, tStart)[2] ?? 0)
                  const obsZIdx = depthToZIndex(obsZ)
                  const isRef = p.depthRefLayerId === obs.id
                  const isFront = isRef && p.depthRelation === 'in_front'
                  const isBehind = isRef && p.depthRelation === 'behind'
                  return (
                    <div
                      key={obs.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                        gap: 4,
                        alignItems: 'center',
                        padding: '3px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-1)',
                        border: '1px solid var(--line-soft)'
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={`${getLayerDisplayName(obs)} (Z-Index = ${obsZIdx})`}
                      >
                        🌲 {getLayerDisplayName(obs)} <small style={{ color: 'var(--text-dim)' }}>(Z-Idx:{obsZIdx})</small>
                      </span>
                      <button
                        type="button"
                        className={`wf-v2-mini-btn${isFront ? ' active' : ''}`}
                        onClick={() =>
                          applyBboxPatch({
                            depthMode: 'depth_z',
                            depthRefLayerId: obs.id,
                            depthRelation: 'in_front',
                            bboxTargetZ: obsZ - 60
                          })
                        }
                        title={`Cho Z-Index đích = ${obsZIdx + 60} (> ${obsZIdx}) để xuất hiện đè lên trước "${getLayerDisplayName(obs)}"`}
                      >
                        ⬆️ Qua trước (&gt;{obsZIdx})
                      </button>
                      <button
                        type="button"
                        className={`wf-v2-mini-btn${isBehind ? ' active' : ''}`}
                        onClick={() =>
                          applyBboxPatch({
                            depthMode: 'depth_z',
                            depthRefLayerId: obs.id,
                            depthRelation: 'behind',
                            bboxTargetZ: obsZ + 60
                          })
                        }
                        title={`Cho Z-Index đích = ${obsZIdx - 60} (< ${obsZIdx}) để đi ra sau và bị "${getLayerDisplayName(obs)}" che`}
                      >
                        ⬇️ Bị che (&lt;{obsZIdx})
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <ParamSlider
              layout="stacked"
              label="Z-Index tại BBox đầu (Xuất phát)"
              min={-200}
              max={1300}
              step={10}
              value={depthToZIndex(startZ)}
              format={(v) => `Z-Idx: ${Math.round(v)}`}
              onChange={(v) => applyBboxPatch({ bboxStartZ: zIndexToDepth(v) }, 'wf-bbox-z1')}
            />
            <ParamSlider
              layout="stacked"
              label="Z-Index tại BBox đích (Đích — Lớn hơn cây = Qua trước)"
              min={-200}
              max={1300}
              step={10}
              value={depthToZIndex(targetZ)}
              format={(v) => `Z-Idx: ${Math.round(v)}`}
              onChange={(v) =>
                applyBboxPatch(
                  { bboxTargetZ: zIndexToDepth(v), depthRefLayerId: undefined },
                  'wf-bbox-z2'
                )
              }
            />
          </div>
        )}
      </div>

      {/* Tích hợp Va chạm trên đường đi BBox đầu -> đích */}
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
            <span>💥 4. Tác động Va chạm khi di chuyển chạm Layer</span>
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
                          ? 'color-mix(in srgb, #f43f5e 18%, var(--bg-2))'
                          : 'var(--bg-1)',
                        border: `1px solid ${isSel ? '#f43f5e' : 'var(--line-soft)'}`
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
                Kéo <b>BBox Đích đích</b> đi cắt qua một Layer khác trên cảnh để tự động phát hiện điểm chạm và thời gian chạm!
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

      {onSpawnFollowupNode && (
        <button
          type="button"
          className="wf-v2-direct-btn accent"
          style={{ width: '100%', justifyContent: 'center', height: 26 }}
          onClick={() => onSpawnFollowupNode(runDuration)}
          title="Tạo tiếp chặng BBox kế tiếp nối đuôi thời gian hiện tại"
        >
          ➕ Nối tiếp chặng BBox kế tiếp (+{runDuration}s)
        </button>
      )}
    </div>
  )
}
