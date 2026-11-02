import { useCallback, useState } from 'react'
import type { Layer, LoopAnimationMode, LoopRhythmMode, Vec3 } from '@shared/types'
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
import { NumberInput, Row, Select, Slider, Switch } from '../../controls'
import { useLoopAnimator } from '../../loopAnimator/loopAnimatorState'
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
    asset?.meta.isAnimated ||
      asset?.gif ||
      layer.props.loopTemplateId ||
      (layer.props.loopRhythmMode && layer.props.loopRhythmMode !== 'none')
  )
  const rhythmMode: LoopRhythmMode = layer.props.loopRhythmMode ?? 'none'

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
    useLoopAnimator.getState().open(layer.props.loopTemplateId)
    useView.getState().openDialog('loop_animator')
  }

  const handleAttachWorkflowLoopNode = (): void => {
    useEditor.getState().update((d) => {
      const wf = syncWorkflowV2Graph(d, d.workflow)
      const res = attachLogicNodeToLayerV2(
        wf,
        v2LayerNodeId(layer.id),
        'anim_fx',
        'v2:anim_fx:loop_rhythm'
      )
      d.workflow = res.workflow
      const createdNode = res.workflow.nodes.find((n) => n.id === res.createdNodeId)
      if (createdNode) {
        syncWorkflowV2NodeToProject(d, createdNode)
      }
    })
    toast(`🔁 Đã gắn Node Animation (Loop & Nhịp) cho "${layer.name}" trên Workflow & Timeline!`)
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

      <div style={{ height: 6 }} />
      <div className="section-title" style={{ marginTop: 8 }}>
        🔁 Logic Loop Animate &amp; Nhịp Nháy
        <span className="spacer" />
        {isLoopOrGif && (
          <span className="badge-count">
            {asset?.meta.frameCount ?? asset?.gif?.frames.length ?? 1} frames
          </span>
        )}
      </div>

      {isLoopOrGif && (
        <>
          <Row label="Tốc độ chạy">
            <Slider
              value={layer.props.speed ?? 1}
              min={0.1}
              max={4}
              step={0.05}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(v) =>
                set((l) => {
                  if (l.type === 'image') l.props.speed = v
                })
              }
            />
          </Row>
          <Row label="Kiểu lặp">
            <Select
              value={layer.props.loopMode ?? 'loop'}
              options={[
                { value: 'loop', label: '🔁 Lặp vô tận (Loop)' },
                { value: 'ping-pong', label: '↔ Lặp đảo chiều (Ping-Pong)' },
                { value: 'once', label: '1️⃣ Chạy 1 lần (Play Once)' },
                { value: 'random', label: '🎲 Ngẫu nhiên (Random Flicker)' }
              ]}
              onChange={(val) =>
                set((l) => {
                  if (l.type === 'image') l.props.loopMode = val as LoopAnimationMode
                })
              }
            />
          </Row>
          <Row label="Lệch pha">
            <Slider
              value={layer.props.timeOffset ?? 0}
              min={0}
              max={Math.max(1, asset?.meta.duration ?? asset?.gif?.totalDuration ?? 3)}
              step={0.05}
              format={(v) => `${v.toFixed(2)}s`}
              onChange={(v) =>
                set((l) => {
                  if (l.type === 'image') l.props.timeOffset = v
                })
              }
            />
          </Row>
          <Row label="Chạy liên tục" title="Tự động lặp hoạt họa trong khung nhìn 3D ngay cả khi timeline đang tạm dừng">
            <Switch
              on={layer.props.autoPlayPaused !== false}
              onChange={(v) =>
                set((l) => {
                  if (l.type === 'image') l.props.autoPlayPaused = v
                })
              }
            />
          </Row>
        </>
      )}

      <Row label="Nhịp & Nháy">
        <Select
          value={rhythmMode}
          options={[
            { value: 'none', label: 'Tắt nhịp kết hợp' },
            { value: 'flicker_opacity', label: '✨ Nháy độ mờ (Opacity Flicker)' },
            { value: 'pulse_scale', label: '💓 Tạo nhịp đập (Scale Pulse)' },
            { value: 'sync_both', label: '🔥 Kết hợp Nhịp + Nháy sáng' },
            { value: 'strobe_beat', label: '⚡ Nhịp chớp mạnh (Strobe Beat)' }
          ]}
          onChange={(val) =>
            set((l) => {
              if (l.type === 'image') {
                l.props.loopRhythmMode = val as LoopRhythmMode
                if (val !== 'none') {
                  l.props.loopRhythmRateHz = l.props.loopRhythmRateHz ?? 2.5
                  l.props.loopRhythmIntensity = l.props.loopRhythmIntensity ?? 0.45
                  l.props.loopMinOpacity = l.props.loopMinOpacity ?? 0.55
                  l.props.loopScaleBeatPct = l.props.loopScaleBeatPct ?? 12
                }
              }
            })
          }
        />
      </Row>

      {rhythmMode !== 'none' && (
        <>
          <Row label="Tần số nhịp">
            <Slider
              value={layer.props.loopRhythmRateHz ?? 2.5}
              min={0.2}
              max={12}
              step={0.1}
              format={(v) => `${v.toFixed(1)} Hz`}
              onChange={(v) =>
                set((l) => {
                  if (l.type === 'image') l.props.loopRhythmRateHz = v
                })
              }
            />
          </Row>
          <Row label="Cường độ">
            <Slider
              value={layer.props.loopRhythmIntensity ?? 0.45}
              min={0.05}
              max={1}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) =>
                set((l) => {
                  if (l.type === 'image') l.props.loopRhythmIntensity = v
                })
              }
            />
          </Row>
          {(rhythmMode === 'flicker_opacity' || rhythmMode === 'sync_both' || rhythmMode === 'strobe_beat') && (
            <Row label="Độ mờ đáy">
              <Slider
                value={layer.props.loopMinOpacity ?? 0.55}
                min={0.05}
                max={0.95}
                step={0.05}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) =>
                  set((l) => {
                    if (l.type === 'image') l.props.loopMinOpacity = v
                  })
                }
              />
            </Row>
          )}
          {(rhythmMode === 'pulse_scale' || rhythmMode === 'sync_both' || rhythmMode === 'strobe_beat') && (
            <Row label="Biên độ nhịp">
              <Slider
                value={layer.props.loopScaleBeatPct ?? 12}
                min={2}
                max={45}
                step={1}
                format={(v) => `+${Math.round(v)}%`}
                onChange={(v) =>
                  set((l) => {
                    if (l.type === 'image') l.props.loopScaleBeatPct = v
                  })
                }
              />
            </Row>
          )}
        </>
      )}

      <Row label="Xưởng & Node">
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
          onClick={handleAttachWorkflowLoopNode}
          title="Gắn Node Animation (Loop & Nhịp) vào Layer này trên sơ đồ Workflow và Timeline"
        >
          🔗 Gắn Node Loop
        </button>
      </Row>

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
