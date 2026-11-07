import React from 'react'
import type { LoopAnimationMode, LoopRhythmMode } from '@shared/types'
import { toast } from '../../actions'
import { createDefaultVirtualLight } from '../../engine/virtualLight'
import '../../styles/loopWorkshop.css'
import { Menu } from '../controls/Menu'
import { IconLoopAnimate, IconPause, IconPen, IconPlay, IconRefresh, IconSun } from '../icons'
import { LoopCardPreviewCanvas } from '../loopAnimator/LoopCardPreviewCanvas'
import { LoopRangeField } from '../loopAnimator/LoopChromaControls'
import { openLoopAnimatorInPlace } from '../loopAnimator/loopAnimatorLauncher'
import { buildGridFrames } from '../loopAnimator/loopFrameExtractor'
import type { LoopAnimationTemplate } from '../loopAnimator/types'
import type { AssembledLayerItem, LoopWorkshopLayerConfig } from './types'
import { useLoopTemplateList } from './WorkshopLoopAssetTab'

export type LoopSubTab = 'template' | 'playback' | 'rhythm'

interface Props {
  selectedLayer: AssembledLayerItem | null
  isPlaying: boolean
  onTogglePlaying: () => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onBindLoopTemplate: (template: LoopAnimationTemplate) => void
  subTab?: LoopSubTab
  onChangeSubTab?: (tab: LoopSubTab) => void
}

export function buildWorkshopLoopConfigFromTemplate(template: LoopAnimationTemplate): LoopWorkshopLayerConfig {
  const source =
    template.frames && template.frames.length > 0
      ? template.frames.filter((f) => f.enabled)
      : buildGridFrames(1024, 1024, template.gridConfig)
  return {
    enabled: true,
    templateId: template.id,
    spriteSheetUrl: template.imageUrl,
    frames: source.map((f) => ({
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      offsetX: f.offsetX,
      offsetY: f.offsetY,
      durationRatio: f.durationRatio
    })),
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

const DEFAULT_CFG: LoopWorkshopLayerConfig = {
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

const LOOP_MODES: { id: LoopAnimationMode; label: string }[] = [
  { id: 'loop', label: 'Lặp vòng' },
  { id: 'ping-pong', label: 'Đảo chiều' },
  { id: 'once', label: '1 lần' },
  { id: 'random', label: 'Ngẫu nhiên' }
]

const RHYTHM_MODES: { id: LoopRhythmMode; label: string }[] = [
  { id: 'none', label: 'Tắt' },
  { id: 'flicker_opacity', label: 'Nháy mờ' },
  { id: 'pulse_scale', label: 'Nhịp scale' },
  { id: 'sync_both', label: 'Nhịp + Nháy' },
  { id: 'strobe_beat', label: 'Chớp beat' }
]

function BoundTemplateCard({
  layer,
  template,
  templates,
  onBind
}: {
  layer: AssembledLayerItem
  template: LoopAnimationTemplate | null
  templates: LoopAnimationTemplate[]
  onBind: (t: LoopAnimationTemplate) => void
}): React.ReactElement {
  return (
    <div className="lw-loop-bound">
      <div className="lw-loop-bound-thumb">
        {template ? <LoopCardPreviewCanvas template={template} isPlaying width={96} height={72} /> : <IconLoopAnimate width={22} height={22} />}
      </div>
      <div className="lw-loop-bound-info">
        <span className="la-label">Mảnh: {layer.name}</span>
        <strong title={template?.name}>{template ? template.name : 'Chưa gắn mẫu Loop'}</strong>
        <div className="lw-loop-bound-actions">
          <Menu portal label={template ? 'Đổi mẫu' : 'Gắn mẫu'} icon={<IconRefresh width={12} height={12} />} btnClassName="sm lw-loop-menu-btn" title="Chọn mẫu hoạt ảnh lặp trong kho">
            <div className="menu-label">Kho Loop Animate ({templates.length})</div>
            {templates.map((t) => (
              <button key={t.id} type="button" className={`menu-item${t.id === template?.id ? ' active' : ''}`} onClick={() => onBind(t)}>
                <IconLoopAnimate width={12} height={12} /> {t.name}
                <span className="hint">{t.frameCount}F</span>
              </button>
            ))}
          </Menu>
          <button type="button" className="la-btn la-btn--outline la-btn--sm" onClick={() => openLoopAnimatorInPlace(template?.id)} title={template ? 'Sửa mẫu trong Xưởng Tách Hoạt Ảnh Loop' : 'Tạo mẫu mới trong Xưởng Tách Hoạt Ảnh Loop'}>
            <IconPen width={11} height={11} />
            <span>{template ? 'Sửa mẫu' : 'Tạo mẫu'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function WorkshopLoopLogicPanel(props: Props): React.ReactElement {
  const { selectedLayer, isPlaying, onTogglePlaying, onUpdateLayer, onBindLoopTemplate, subTab } = props
  const templates = useLoopTemplateList()

  if (!selectedLayer) {
    return (
      <div className="lw-loop-panel" data-mcp-region="layer_assembly_loop_logic">
        <div className="lw-loop-empty">
          <IconLoopAnimate width={22} height={22} />
          <p>
            Chọn 1 mảnh trong danh sách lớp, hoặc mở tab <strong>Loop</strong> ở cột Tài nguyên bên trái để thêm hoạt ảnh lặp vào cụm 2.5D.
          </p>
        </div>
      </div>
    )
  }

  const cfg = selectedLayer.loopConfig
  const template = templates.find((t) => t.id === cfg?.templateId) ?? null
  const patch = (p: Partial<LoopWorkshopLayerConfig>): void => onUpdateLayer(selectedLayer.id, { loopConfig: { ...(cfg ?? DEFAULT_CFG), ...p } })
  const r = cfg?.rhythmMode ?? 'none'

  const handleSyncLight = (): void => {
    const rate = cfg?.rhythmRateHz ?? 2.8
    const isFire = /fire|torch|campfire/.test(cfg?.templateId ?? '')
    onUpdateLayer(selectedLayer.id, {
      virtualLight: { ...createDefaultVirtualLight(isFire ? 'candle' : 'bulb'), enabled: true, flickerSpeed: rate },
      loopConfig: cfg ? { ...cfg, rhythmMode: cfg.rhythmMode === 'none' ? 'sync_both' : cfg.rhythmMode, rhythmRateHz: rate } : undefined
    })
    toast(`🕯️ Đã bật nguồn sáng ảo nháy theo nhịp Loop cho "${selectedLayer.name}"`)
  }

  return (
    <div className="lw-loop-panel" data-mcp-region="layer_assembly_loop_logic">
      {(!subTab || subTab === 'template') && (
        <BoundTemplateCard layer={selectedLayer} template={template} templates={templates} onBind={onBindLoopTemplate} />
      )}

      {(!subTab || subTab === 'playback') && (
        <section className="lw-loop-section">
          <div className="lw-loop-section-head">
            <label className="la-switch" title="Bật xử lý phát lặp & nhịp nháy cho mảnh này">
              <input type="checkbox" checked={Boolean(cfg?.enabled)} onChange={(e) => patch({ enabled: e.target.checked })} />
              <span className="la-switch-track" aria-hidden />
              <span className="la-switch-text">Phát lặp</span>
            </label>
            <button type="button" className={`la-btn la-btn--sm ${isPlaying ? 'la-btn--outline' : 'la-btn--primary'}`} onClick={onTogglePlaying}>
              {isPlaying ? <IconPause width={11} height={11} /> : <IconPlay width={11} height={11} />}
              <span>{isPlaying ? 'Dừng thử' : 'Chạy thử'}</span>
            </button>
          </div>
          {cfg?.enabled && (
            <>
              {cfg.frames && cfg.frames.length > 1 && (
                <>
                  <LoopRangeField label="FPS" value={cfg.fps} display={`${cfg.fps}`} min={1} max={60} step={1} onChange={(v) => patch({ fps: v })} />
                  <div className="la-seg la-seg--fill">
                    {LOOP_MODES.map((m) => (
                      <button key={m.id} type="button" className={`la-seg-btn${cfg.loopMode === m.id ? ' active' : ''}`} onClick={() => patch({ loopMode: m.id })}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <LoopRangeField label="Tốc độ" value={cfg.speed ?? 1} display={`${(cfg.speed ?? 1).toFixed(2)}×`} min={0.2} max={4} step={0.05} onChange={(v) => patch({ speed: v })} />
              <LoopRangeField label="Lệch pha" value={cfg.timeOffset ?? 0} display={`${(cfg.timeOffset ?? 0).toFixed(2)}s`} min={0} max={3} step={0.05} onChange={(v) => patch({ timeOffset: v })} />
            </>
          )}
        </section>
      )}

      {(!subTab || subTab === 'rhythm') && (
        <section className="lw-loop-section">
          <div className="lw-loop-section-head">
            <span className="la-label">Nhịp & Nháy (Rhythm FX)</span>
          </div>
          <div className="la-seg la-seg--fill la-seg--wrap">
            {RHYTHM_MODES.map((m) => (
              <button key={m.id} type="button" className={`la-seg-btn${r === m.id ? ' active' : ''}`} onClick={() => patch({ enabled: true, rhythmMode: m.id })}>
                {m.label}
              </button>
            ))}
          </div>
          {cfg?.enabled && r !== 'none' && (
            <>
              <LoopRangeField label="Tần số" value={cfg.rhythmRateHz ?? 2.5} display={`${(cfg.rhythmRateHz ?? 2.5).toFixed(1)} Hz`} min={0.2} max={10} step={0.1} onChange={(v) => patch({ rhythmRateHz: v })} />
              <LoopRangeField label="Cường độ" value={cfg.rhythmIntensity ?? 0.4} display={`${Math.round((cfg.rhythmIntensity ?? 0.4) * 100)}%`} min={0.05} max={1} step={0.05} onChange={(v) => patch({ rhythmIntensity: v })} />
              {(r === 'flicker_opacity' || r === 'sync_both' || r === 'strobe_beat') && (
                <LoopRangeField label="Mờ đáy" value={cfg.minOpacity ?? 0.6} display={`${Math.round((cfg.minOpacity ?? 0.6) * 100)}%`} min={0.05} max={0.95} step={0.05} onChange={(v) => patch({ minOpacity: v })} />
              )}
              {(r === 'pulse_scale' || r === 'sync_both' || r === 'strobe_beat') && (
                <LoopRangeField label="Biên độ" value={cfg.scaleBeatPct ?? 12} display={`+${cfg.scaleBeatPct ?? 12}%`} min={2} max={40} step={1} onChange={(v) => patch({ scaleBeatPct: v })} />
              )}
            </>
          )}
          <button type="button" className="la-btn la-btn--outline la-btn--sm lw-loop-light-btn" onClick={handleSyncLight} title="Bật nguồn sáng ảo 2.5D nháy theo nhịp Loop của mảnh này">
            <IconSun width={12} height={12} />
            <span>Nguồn sáng ảo nháy theo Loop</span>
          </button>
        </section>
      )}
    </div>
  )
}
