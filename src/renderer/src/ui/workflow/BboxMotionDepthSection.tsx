import { OptionPills, ParamSlider } from './WorkflowV2NodeParams'
import { depthToZIndex, zIndexToDepth, evaluateCleanLayerPos } from '../../project/workflowV2BboxMotionAndCollision'
import { getLayerDisplayName } from '../../project/workflowV2Engine'
import type { BboxMotionModel } from './useBboxMotionModel'

export function BboxMotionDepthSection({ model }: { model: BboxMotionModel }) {
  const { p, tStart, targetScalePct, depthMode, startZ, targetZ, applyBboxPatch, sceneObstacleLayers } = model
  return (
<div className="vl-subcard" style={{ padding: '6px 7px' }}>
        <div className="vl-row-header" style={{ marginBottom: 4 }}>
          <span className="vl-subtitle">Chiều sâu</span>
          <span className="vl-value-badge">
            {depthMode === 'depth_z'
              ? `Z-Index: ${depthToZIndex(startZ)} → ${depthToZIndex(targetZ)}`
              : `Giữ Z-Index: ${depthToZIndex(startZ)}`}
          </span>
        </div>

        <OptionPills
          cols={2}
          options={[
            { id: 'flat_2d', label: 'Giữ chiều sâu' },
            { id: 'depth_z', label: 'Di chuyển theo Z' }
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
  )
}
