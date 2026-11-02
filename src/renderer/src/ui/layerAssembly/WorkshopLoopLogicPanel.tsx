import React, { useEffect, useState } from 'react'
import type { LoopAnimationMode, LoopRhythmMode } from '@shared/types'
import { toast } from '../../actions'
import { createDefaultVirtualLight } from '../../engine/virtualLight'
import { useView } from '../../store/view'
import {
  LOOP_STORAGE_UPDATED_EVENT,
  getAllLoopTemplates
} from '../loopAnimator/loopAnimatorStorage'
import { buildGridFrames } from '../loopAnimator/loopFrameExtractor'
import { useLoopAnimator } from '../loopAnimator/loopAnimatorState'
import type { LoopAnimationTemplate } from '../loopAnimator/types'
import type { AssembledLayerItem, LoopWorkshopLayerConfig } from './types'

interface Props {
  selectedLayer: AssembledLayerItem | null
  isPlaying: boolean
  onTogglePlaying: () => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onAddLoopTemplateLayer: (template: LoopAnimationTemplate) => void
}

export function buildWorkshopLoopConfigFromTemplate(
  template: LoopAnimationTemplate
): LoopWorkshopLayerConfig {
  const frames =
    template.frames && template.frames.length > 0
      ? template.frames
          .filter((f) => f.enabled)
          .map((f) => ({
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            offsetX: f.offsetX,
            offsetY: f.offsetY,
            durationRatio: f.durationRatio
          }))
      : buildGridFrames(1024, 1024, template.gridConfig).map((f) => ({
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          offsetX: f.offsetX,
          offsetY: f.offsetY,
          durationRatio: f.durationRatio
        }))

  return {
    enabled: true,
    templateId: template.id,
    spriteSheetUrl: template.imageUrl,
    frames,
    chromaKey: { ...template.chromaKey },
    fps: template.fps || 12,
    speed: template.speed ?? 1,
    loopMode: template.loopMode || 'loop',
    timeOffset: 0,
    rhythmMode: template.rhythm?.rhythmMode ?? 'none',
    rhythmRateHz: template.rhythm?.rhythmRateHz ?? 2.5,
    rhythmIntensity: template.rhythm?.rhythmIntensity ?? 0.4,
    minOpacity: template.rhythm?.minOpacity ?? 0.6,
    scaleBeatPct: template.rhythm?.scaleBeatPct ?? 12
  }
}

export function WorkshopLoopLogicPanel({
  selectedLayer,
  isPlaying,
  onTogglePlaying,
  onUpdateLayer,
  onAddLoopTemplateLayer
}: Props): React.ReactElement {
  const [templates, setTemplates] = useState<LoopAnimationTemplate[]>(() => getAllLoopTemplates())

  useEffect(() => {
    const refresh = (): void => setTemplates(getAllLoopTemplates())
    window.addEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(LOOP_STORAGE_UPDATED_EVENT, refresh)
  }, [])

  const loopCfg = selectedLayer?.loopConfig

  const patchLoopCfg = (patch: Partial<LoopWorkshopLayerConfig>): void => {
    if (!selectedLayer) return
    const base: LoopWorkshopLayerConfig = loopCfg ?? {
      enabled: true,
      fps: 12,
      speed: 1,
      loopMode: 'loop',
      timeOffset: 0,
      rhythmMode: 'none',
      rhythmRateHz: 2.5,
      rhythmIntensity: 0.4,
      minOpacity: 0.6,
      scaleBeatPct: 12
    }
    onUpdateLayer(selectedLayer.id, {
      loopConfig: { ...base, ...patch }
    })
  }

  const handleApplyTemplateToSelected = (tpl: LoopAnimationTemplate): void => {
    if (!selectedLayer) {
      onAddLoopTemplateLayer(tpl)
      return
    }
    const nextCfg = buildWorkshopLoopConfigFromTemplate(tpl)
    onUpdateLayer(selectedLayer.id, {
      name: selectedLayer.name || tpl.name,
      imageUrl: tpl.thumbUrl || tpl.imageUrl,
      loopConfig: nextCfg
    })
    toast(`🔁 Đã gắn hoạt ảnh Loop "${tpl.name}" vào mảnh "${selectedLayer.name}"!`)
  }

  const handleSyncVirtualLight = (): void => {
    if (!selectedLayer) return
    const rate = loopCfg?.rhythmRateHz ?? 2.8
    const isFire = selectedLayer.loopConfig?.templateId?.includes('fire') || selectedLayer.loopConfig?.templateId?.includes('torch')
    const baseLight = createDefaultVirtualLight(isFire ? 'candle' : 'bulb')
    onUpdateLayer(selectedLayer.id, {
      virtualLight: {
        ...baseLight,
        enabled: true,
        flickerSpeed: rate
      },
      loopConfig: loopCfg
        ? {
            ...loopCfg,
            rhythmMode: loopCfg.rhythmMode === 'none' ? 'sync_both' : loopCfg.rhythmMode,
            rhythmRateHz: rate
          }
        : undefined
    })
    toast(`🕯️ Đã đồng bộ Nguồn sáng ảo 2.5D nháy theo nhịp Loop cho "${selectedLayer.name}"!`)
  }

  const handleOpenLoopStudio = (): void => {
    useLoopAnimator.getState().open(loopCfg?.templateId)
    useView.getState().openDialog('loop_animator')
  }

  const LOOP_MODES: { id: LoopAnimationMode; label: string }[] = [
    { id: 'loop', label: '🔁 Lặp vòng' },
    { id: 'ping-pong', label: '↔ Đảo chiều' },
    { id: 'once', label: '1️⃣ 1 Lần' },
    { id: 'random', label: '🎲 Ngẫu nhiên' }
  ]

  const RHYTHM_MODES: { id: LoopRhythmMode; label: string }[] = [
    { id: 'none', label: '⏹ Tắt' },
    { id: 'flicker_opacity', label: '✨ Nháy độ mờ' },
    { id: 'pulse_scale', label: '💓 Nhịp Scale' },
    { id: 'sync_both', label: '🔥 Nhịp + Nháy' },
    { id: 'strobe_beat', label: '⚡ Chớp Beat' }
  ]

  return (
    <div className="la-inspector-body" data-mcp-region="layer_assembly_loop_logic">
      {/* Quick Add or Bind Loop Template */}
      <div className="la-prop-group">
        <div className="la-prop-group-header">
          <span className="la-prop-group-title">🎞 Kho Mẫu Loop Animate</span>
          <button
            type="button"
            className="btn ghost sm"
            onClick={handleOpenLoopStudio}
            title="Mở Xưởng Tách Hoạt Ảnh Loop"
          >
            ✎ Xưởng Loop
          </button>
        </div>
        <div className="la-loop-template-pills">
          {templates.map((tpl) => {
            const isBound = loopCfg?.templateId === tpl.id
            return (
              <div key={tpl.id} className={`la-loop-tpl-card ${isBound ? 'active' : ''}`}>
                <div className="la-loop-tpl-meta">
                  <span className="la-loop-tpl-badge">{tpl.badge}</span>
                  <span className="la-loop-tpl-name">{tpl.name}</span>
                </div>
                <div className="la-loop-tpl-actions">
                  <button
                    type="button"
                    className="btn primary sm"
                    onClick={() => onAddLoopTemplateLayer(tpl)}
                    title="Thêm thành 1 mảnh (layer) hoạt ảnh mới trong Cụm 2.5D"
                  >
                    + Thêm mảnh
                  </button>
                  {selectedLayer && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => handleApplyTemplateToSelected(tpl)}
                      title={`Gán hoạt ảnh này vào mảnh "${selectedLayer.name}" đang chọn`}
                    >
                      Gán vào mảnh
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!selectedLayer ? (
        <div className="la-empty-hint">
          Hãy chọn 1 mảnh (layer) trong danh sách hoặc bấm <strong>+ Thêm mảnh</strong> ở trên để cấu hình Logic Loop trong Xưởng 2.5D.
        </div>
      ) : (
        <>
          <div className="la-prop-group">
            <div className="la-prop-group-header">
              <span className="la-prop-group-title">
                🔁 Cấu Hình Chạy Loop: <strong>{selectedLayer.name}</strong>
              </span>
              <button
                type="button"
                className={`btn ${isPlaying ? 'secondary' : 'primary'} sm`}
                onClick={onTogglePlaying}
              >
                {isPlaying ? '⏸ Dừng thử' : '▶ Chạy thử'}
              </button>
            </div>

            <label className="la-checkbox-row" style={{ marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={Boolean(loopCfg?.enabled)}
                onChange={(e) => patchLoopCfg({ enabled: e.target.checked })}
              />
              <span>Kích hoạt xử lý Loop &amp; Nhịp Nháy cho mảnh này</span>
            </label>

            {loopCfg?.enabled && (
              <>
                {loopCfg.frames && loopCfg.frames.length > 1 && (
                  <>
                    <div className="la-field-row">
                      <label>Tốc độ khung (FPS): <strong>{loopCfg.fps}</strong></label>
                      <input
                        type="range"
                        min={2}
                        max={30}
                        value={loopCfg.fps}
                        onChange={(e) => patchLoopCfg({ fps: Number(e.target.value) })}
                      />
                    </div>

                    <div className="la-field-row">
                      <label>Chế độ lặp (Loop Mode):</label>
                      <div className="loop-mode-pills">
                        {LOOP_MODES.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={`loop-mode-pill ${loopCfg.loopMode === m.id ? 'active' : ''}`}
                            onClick={() => patchLoopCfg({ loopMode: m.id })}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="la-field-row">
                  <label>Hệ số tốc độ: <strong>{(loopCfg.speed ?? 1).toFixed(2)}×</strong></label>
                  <input
                    type="range"
                    min={0.2}
                    max={4}
                    step={0.05}
                    value={loopCfg.speed ?? 1}
                    onChange={(e) => patchLoopCfg({ speed: Number(e.target.value) })}
                  />
                </div>

                <div className="la-field-row">
                  <label>Độ lệch pha (Phase Offset): <strong>{(loopCfg.timeOffset ?? 0).toFixed(2)}s</strong></label>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.05}
                    value={loopCfg.timeOffset ?? 0}
                    onChange={(e) => patchLoopCfg({ timeOffset: Number(e.target.value) })}
                  />
                </div>
              </>
            )}
          </div>

          {/* Rhythm & Flicker Coupling inside 2.5D Workshop */}
          <div className="la-prop-group">
            <div className="la-prop-group-header">
              <span className="la-prop-group-title">⚡ Logic Tạo Nhịp &amp; Độ Mờ Nháy (Rhythm FX)</span>
            </div>

            <div className="loop-mode-pills" style={{ marginBottom: 8 }}>
              {RHYTHM_MODES.map((rm) => (
                <button
                  key={rm.id}
                  type="button"
                  className={`loop-mode-pill ${(loopCfg?.rhythmMode ?? 'none') === rm.id ? 'active' : ''}`}
                  onClick={() => patchLoopCfg({ enabled: true, rhythmMode: rm.id })}
                >
                  {rm.label}
                </button>
              ))}
            </div>

            {loopCfg?.enabled && loopCfg.rhythmMode && loopCfg.rhythmMode !== 'none' && (
              <>
                <div className="la-field-row">
                  <label>Tần số nhịp: <strong>{(loopCfg.rhythmRateHz ?? 2.5).toFixed(1)} Hz</strong></label>
                  <input
                    type="range"
                    min={0.2}
                    max={10}
                    step={0.1}
                    value={loopCfg.rhythmRateHz ?? 2.5}
                    onChange={(e) => patchLoopCfg({ rhythmRateHz: Number(e.target.value) })}
                  />
                </div>

                <div className="la-field-row">
                  <label>Cường độ nháy / nhịp: <strong>{Math.round((loopCfg.rhythmIntensity ?? 0.4) * 100)}%</strong></label>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={loopCfg.rhythmIntensity ?? 0.4}
                    onChange={(e) => patchLoopCfg({ rhythmIntensity: Number(e.target.value) })}
                  />
                </div>

                {(loopCfg.rhythmMode === 'flicker_opacity' ||
                  loopCfg.rhythmMode === 'sync_both' ||
                  loopCfg.rhythmMode === 'strobe_beat') && (
                  <div className="la-field-row">
                    <label>Độ mờ đáy (Min Opacity): <strong>{Math.round((loopCfg.minOpacity ?? 0.6) * 100)}%</strong></label>
                    <input
                      type="range"
                      min={0.05}
                      max={0.95}
                      step={0.05}
                      value={loopCfg.minOpacity ?? 0.6}
                      onChange={(e) => patchLoopCfg({ minOpacity: Number(e.target.value) })}
                    />
                  </div>
                )}

                {(loopCfg.rhythmMode === 'pulse_scale' ||
                  loopCfg.rhythmMode === 'sync_both' ||
                  loopCfg.rhythmMode === 'strobe_beat') && (
                  <div className="la-field-row">
                    <label>Biên độ nhịp Scale: <strong>+{loopCfg.scaleBeatPct ?? 12}%</strong></label>
                    <input
                      type="range"
                      min={2}
                      max={40}
                      step={1}
                      value={loopCfg.scaleBeatPct ?? 12}
                      onChange={(e) => patchLoopCfg({ scaleBeatPct: Number(e.target.value) })}
                    />
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              className="btn secondary sm"
              style={{ width: '100%', marginTop: 6 }}
              onClick={handleSyncVirtualLight}
              title="Tự động bật Nguồn sáng ảo 2.5D và đồng bộ độ nhấp nháy theo nhịp Loop của mảnh này"
            >
              🕯️ Kết hợp Nguồn Sáng Ảo 2.5D Nháy Theo Loop
            </button>
          </div>
        </>
      )}
    </div>
  )
}
