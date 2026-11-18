import React, { useState } from 'react'
import type {
  SubtitleBubbleTail,
  SubtitleEnterEffect,
  SubtitleExitEffect,
  SubtitlePositionPreset,
  SubtitleProtectField,
  SubtitleStylePresetId
} from '@shared/types'
import { toast } from '../../actions'
import {
  SUBTITLE_STYLE_PRESETS,
  applySubtitleDefaultsToAllNodes,
  defaultOffsetYForPreset,
  getProjectSubtitleDefaults,
  resetSubtitleNodeToDefaults,
  validateAndRepairDialogueContinuity
} from '../../project/subtitleAndDialogueSync'
import { syncWorkflowV2Graph } from '../../project/workflowV2Sync'
import { useEditor } from '../../store/editor'
import { ColorInput } from '../controls'
import { OptionPills, ParamSlider, type WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'

const FONT_FAMILY_OPTIONS: { id: string; label: string }[] = [
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'Be Vietnam Pro', label: 'Be Vietnam' },
  { id: 'Oswald', label: 'Oswald' },
  { id: 'Noto Serif', label: 'Noto Serif' },
  { id: 'Comic Neue', label: 'Comic Neue' },
  { id: 'JetBrains Mono', label: 'Mono HUD' }
]

const FONT_WEIGHT_OPTIONS: { id: string; label: string }[] = [
  { id: '600', label: '600 Vừa' },
  { id: '700', label: '700 Đậm' },
  { id: '800', label: '800 Rất đậm' },
  { id: '900', label: '900 Siêu đậm' }
]

const ALIGN_OPTIONS: { id: 'left' | 'center' | 'right'; label: string }[] = [
  { id: 'left', label: '⬅ Trái' },
  { id: 'center', label: '✦ Giữa' },
  { id: 'right', label: '➡ Phải' }
]

const BUBBLE_TAIL_OPTIONS: { id: SubtitleBubbleTail; label: string }[] = [
  { id: 'none', label: '▭ Không đuôi' },
  { id: 'left', label: '◣ Trỏ Trái' },
  { id: 'right', label: '◢ Trỏ Phải' },
  { id: 'bottom', label: '▼ Trỏ Dưới' }
]

const POSITION_PRESET_OPTIONS: { id: SubtitlePositionPreset; label: string }[] = [
  { id: 'bottom_center', label: '⬇ Đáy giữa' },
  { id: 'top_center', label: '⬆ Đỉnh giữa' },
  { id: 'above_speaker', label: '🗣️ Trên đầu NV' },
  { id: 'below_speaker', label: '🧍 Dưới chân NV' },
  { id: 'speech_left', label: '💬 Trái NV' },
  { id: 'speech_right', label: '💬 Phải NV' },
  { id: 'custom', label: '🎯 Tuỳ chỉnh X/Y' }
]

const ENTER_EFFECT_OPTIONS: { id: SubtitleEnterEffect; label: string }[] = [
  { id: 'fade', label: '🌕 Mờ → Đậm' },
  { id: 'pop_bounce', label: '💥 Bật nảy Pop' },
  { id: 'slide_up', label: '⬆ Trượt lên' },
  { id: 'typewriter_scale', label: '⌨️ Phóng chữ' },
  { id: 'none', label: '⚡ Hiện ngay' }
]

const EXIT_EFFECT_OPTIONS: { id: SubtitleExitEffect; label: string }[] = [
  { id: 'fade', label: '🌓 Đậm → Nhạt' },
  { id: 'slide_down', label: '⬇ Trượt xuống' },
  { id: 'scale_out', label: '🔹 Thu nhỏ' },
  { id: 'none', label: '⚡ Ẩn ngay' }
]

const PROTECT_FIELD_OPTIONS: { id: SubtitleProtectField; label: string }[] = [
  { id: 'font', label: '🔤 Font & Cỡ' },
  { id: 'color', label: '🎨 Màu & Viền' },
  { id: 'background', label: '⬛ Hộp nền' },
  { id: 'position', label: '📍 Vị trí' },
  { id: 'animation', label: '✨ Hiệu ứng' }
]

export function WorkflowV2SubtitleParams({ node, project, onUpdate }: WorkflowV2NodeParamsProps): React.ReactElement {
  const editorUpdate = useEditor((s) => s.update)
  const [subTab, setSubTab] = useState<'style' | 'position' | 'global'>('style')
  const defaults = getProjectSubtitleDefaults(project)
  const p = node.params ?? {}

  const curPreset = (p.subtitleStylePreset ?? defaults.presetId) as SubtitleStylePresetId
  const curFont = p.subtitleFontFamily ?? defaults.fontFamily
  const curSize = p.subtitleFontSize ?? defaults.fontSize
  const curWeight = String(p.subtitleFontWeight ?? defaults.fontWeight)
  const curItalic = p.subtitleItalic ?? defaults.italic ?? false
  const curColor = p.subtitleColor ?? defaults.color
  const curStroke = p.subtitleStrokeColor ?? defaults.strokeColor
  const curStrokeW = p.subtitleStrokeWidth ?? defaults.strokeWidth
  const curBoxColor = p.subtitleBoxColor || '#090d16'
  const curBoxOp = p.subtitleBoxOpacity ?? defaults.boxOpacity
  const curBubbleTail = (p.subtitleBubbleTail ?? defaults.bubbleTail ?? 'none') as SubtitleBubbleTail
  const curAlign = (p.subtitleAlign ?? defaults.align) as 'left' | 'center' | 'right'
  const curPosPreset = (p.subtitlePositionPreset ?? defaults.positionPreset) as SubtitlePositionPreset
  const curOffX = typeof p.subtitleOffsetX === 'number' ? p.subtitleOffsetX : defaults.offsetX
  const curOffY = typeof p.subtitleOffsetY === 'number' ? p.subtitleOffsetY : defaultOffsetYForPreset(curPosPreset)
  const curEnter = (p.subtitleEnterEffect ?? defaults.enterEffect) as SubtitleEnterEffect
  const curExit = (p.subtitleExitEffect ?? defaults.exitEffect) as SubtitleExitEffect
  const curFadeIn = p.subtitleFadeIn ?? defaults.fadeInDuration
  const curFadeOut = p.subtitleFadeOut ?? defaults.fadeOutDuration
  const isProtected = Boolean(p.preserveCustomSettings)
  const lockedFields = p.lockedSubtitleFields ?? []
  const syncHold = p.syncHoldTargetLayer !== false

  const toggleProtectField = (field: SubtitleProtectField): void => {
    const next = lockedFields.includes(field)
      ? lockedFields.filter((f) => f !== field)
      : [...lockedFields, field]
    onUpdate({ lockedSubtitleFields: next })
  }

  const handleApplyToAll = (): void => {
    let updated = 0
    let skipped = 0
    editorUpdate((d) => {
      const res = applySubtitleDefaultsToAllNodes(d, {
        presetId: curPreset,
        fontFamily: curFont,
        fontSize: curSize,
        fontWeight: Number(curWeight),
        italic: curItalic,
        color: curColor,
        strokeColor: curStroke,
        strokeWidth: curStrokeW,
        boxColor: curBoxOp > 0.01 ? curBoxColor : '',
        boxOpacity: curBoxOp,
        bubbleTail: curBubbleTail,
        align: curAlign,
        positionPreset: curPosPreset,
        offsetX: curOffX,
        offsetY: curOffY,
        enterEffect: curEnter,
        exitEffect: curExit,
        fadeInDuration: curFadeIn,
        fadeOutDuration: curFadeOut,
        syncHoldTargetLayer: syncHold
      })
      updated = res.updatedCount
      skipped = res.skippedProtectedCount
      d.workflow = syncWorkflowV2Graph(d, d.workflow)
    }, 'subtitle-apply-all')
    toast(
      skipped > 0
        ? `💬 Đã áp dụng cấu hình cho ${updated} Vietsub (Đã bảo vệ ${skipped} node khoá đặc biệt 🔒)`
        : `💬 Đã đồng bộ cấu hình cho toàn bộ ${updated} node Vietsub!`
    )
  }

  const handleResetThisNode = (): void => {
    editorUpdate((d) => {
      resetSubtitleNodeToDefaults(d, node.id)
      d.workflow = syncWorkflowV2Graph(d, d.workflow)
    }, 'subtitle-reset-default')
    toast('↺ Đã khôi phục Node Vietsub này về cấu hình mặc định chung')
  }

  const handleRepairContinuity = (): void => {
    let fixed = 0
    editorUpdate((d) => {
      const res = validateAndRepairDialogueContinuity(d, true)
      fixed = res.repairedCount
      d.workflow = syncWorkflowV2Graph(d, d.workflow)
    }, 'subtitle-continuity-sync')
    toast(
      fixed > 0
        ? `🔗 Đã đồng bộ thời lượng hiển thị cho ${fixed} nhân vật khớp lời thoại & audio!`
        : '✓ Toàn bộ nhân vật, Vietsub và Audio thoại đã đồng bộ hoàn hảo!'
    )
  }

  return (
    <div className="vl-section-card" data-mcp-region="subtitle_node_inspector" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="wf-v2-pair" style={{ justifyContent: 'space-between' }}>
        <span className="wf-v2-pair-tag">
          💬 Vietsub gắn đối tượng {isProtected ? '· 🔒 Đang khoá riêng' : '· 🌐 Nhận cấu hình chung'}
        </span>
        <button
          type="button"
          className={`wf-v2-opt-pill${isProtected ? ' active' : ''}`}
          style={{ padding: '2px 8px', minHeight: 24 }}
          title="Khi bật Khoá đặc biệt, nút 'Áp dụng cho tất cả Vietsub' sẽ bỏ qua không ghi đè Node này"
          onClick={() => onUpdate({ preserveCustomSettings: !isProtected })}
        >
          <span className="wf-v2-opt-pill-txt">{isProtected ? '🔒 Đã khoá đặc biệt' : '🔓 Cho phép Apply All'}</span>
        </button>
      </div>

      <label className="wf-v2-param-row stacked">
        <div className="wf-v2-param-head">
          <span className="wf-v2-param-label">Nội dung lời thoại Vietsub</span>
          <strong>{(p.subtitleText ?? '').length} ký tự</strong>
        </div>
        <textarea
          className="input"
          rows={2}
          style={{ width: '100%', resize: 'vertical', fontSize: 12, padding: '5px 7px' }}
          value={p.subtitleText ?? ''}
          placeholder="Nhập lời thoại của nhân vật..."
          onChange={(e) => onUpdate({ subtitleText: e.target.value }, `Vietsub: ${e.target.value.slice(0, 24)}`)}
        />
      </label>

      <label className="wf-v2-param-row">
        <span className="wf-v2-param-label">Tên người nói</span>
        <input
          type="text"
          className="input"
          style={{ fontSize: 12, padding: '3px 7px' }}
          value={p.subtitleSpeakerName ?? ''}
          placeholder="Tuỳ chọn (VD: Tiểu Khô Lâu, Ngộ Không)"
          onChange={(e) => onUpdate({ subtitleSpeakerName: e.target.value })}
        />
      </label>

      <div className="wf-v2-insp-subhead">Mẫu Phong Cách Vietsub &amp; Hộp Thoại</div>
      <OptionPills
        cols={2}
        options={SUBTITLE_STYLE_PRESETS.map((pr) => ({ id: pr.id, label: pr.shortLabel }))}
        value={curPreset}
        onPick={(presetId) => onUpdate({ subtitleStylePreset: presetId })}
      />

      <div className="wf-v2-seg-tabs" role="tablist" aria-label="Nhóm cấu hình Vietsub">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'style'}
          className={`wf-v2-seg-tab${subTab === 'style' ? ' active' : ''}`}
          onClick={() => setSubTab('style')}
        >
          🎨 Chữ &amp; Nền
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'position'}
          className={`wf-v2-seg-tab${subTab === 'position' ? ' active' : ''}`}
          onClick={() => setSubTab('position')}
        >
          📍 Vị trí &amp; Hiệu ứng
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'global'}
          className={`wf-v2-seg-tab${subTab === 'global' ? ' active' : ''}`}
          onClick={() => setSubTab('global')}
        >
          ⚡ Đồng bộ All
        </button>
      </div>

      {subTab === 'style' && (
        <>
          <div className="wf-v2-insp-subhead">Phông chữ (Font Family)</div>
          <OptionPills
            cols={3}
            options={FONT_FAMILY_OPTIONS}
            value={curFont}
            onPick={(fontFamily) => onUpdate({ subtitleFontFamily: fontFamily })}
          />
          <ParamSlider
            label="Cỡ chữ (Font Size)"
            min={20}
            max={72}
            step={1}
            value={curSize}
            format={(v) => `${Math.round(v)}px`}
            onChange={(v) => onUpdate({ subtitleFontSize: Math.round(v) })}
          />
          <div className="wf-v2-insp-subhead">Độ đậm · Kiểu nghiêng &amp; Căn lề</div>
          <OptionPills
            cols={2}
            options={FONT_WEIGHT_OPTIONS}
            value={curWeight}
            onPick={(w) => onUpdate({ subtitleFontWeight: Number(w) })}
          />
          <OptionPills
            cols={2}
            options={[
              { id: 'normal', label: 'T Chữ đứng' },
              { id: 'italic', label: '𝑰 Chữ nghiêng (2.5D)' }
            ]}
            value={curItalic ? 'italic' : 'normal'}
            onPick={(st) => onUpdate({ subtitleItalic: st === 'italic' })}
          />
          <OptionPills
            cols={3}
            options={ALIGN_OPTIONS}
            value={curAlign}
            onPick={(align) => onUpdate({ subtitleAlign: align })}
          />
          <div className="wf-v2-param-row">
            <span className="wf-v2-param-label">Màu chữ / Viền</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <ColorInput value={curColor} onChange={(c: string) => onUpdate({ subtitleColor: c })} />
              <ColorInput value={curStroke} onChange={(c: string) => onUpdate({ subtitleStrokeColor: c })} />
            </div>
            <strong>{curStrokeW}px</strong>
          </div>
          <ParamSlider
            label="Độ dày viền chữ"
            min={0}
            max={14}
            step={1}
            value={curStrokeW}
            format={(v) => `${Math.round(v)}px`}
            onChange={(v) => onUpdate({ subtitleStrokeWidth: Math.round(v) })}
          />
          <div className="wf-v2-param-row">
            <span className="wf-v2-param-label">Màu hộp nền</span>
            <ColorInput
              value={curBoxColor}
              onChange={(c: string) => onUpdate({ subtitleBoxColor: c, subtitleBoxOpacity: Math.max(0.65, curBoxOp) })}
            />
            <strong>{Math.round(curBoxOp * 100)}%</strong>
          </div>
          <ParamSlider
            label="Độ đậm nền (Background)"
            min={0}
            max={1}
            step={0.05}
            value={curBoxOp}
            onChange={(v) => onUpdate({ subtitleBoxOpacity: Number(v.toFixed(2)), subtitleBoxColor: v > 0.02 ? curBoxColor : '' })}
          />
          <div className="wf-v2-insp-subhead">Đuôi Hộp Thoại Truyện Tranh</div>
          <OptionPills
            cols={2}
            options={BUBBLE_TAIL_OPTIONS}
            value={curBubbleTail}
            onPick={(tail) =>
              onUpdate({
                subtitleBubbleTail: tail,
                ...(tail !== 'none' && curBoxOp < 0.1
                  ? { subtitleBoxColor: '#ffffff', subtitleBoxOpacity: 0.96, subtitleBoxBorderColor: '#0f172a', subtitleColor: '#0f172a', subtitleStrokeWidth: 0 }
                  : {})
              })
            }
          />
        </>
      )}

      {subTab === 'position' && (
        <>
          <div className="wf-v2-insp-subhead">Vị trí xuất hiện trên màn hình</div>
          <OptionPills
            cols={2}
            options={POSITION_PRESET_OPTIONS}
            value={curPosPreset}
            onPick={(pos) => {
              onUpdate({ subtitlePositionPreset: pos, subtitleOffsetX: 0, subtitleOffsetY: defaultOffsetYForPreset(pos) })
            }}
          />
          <ParamSlider
            label="Vị trí ngang X"
            min={-650}
            max={650}
            step={5}
            value={curOffX}
            format={(v) => `${Math.round(v)}px`}
            onChange={(v) => onUpdate({ subtitleOffsetX: Math.round(v) })}
          />
          <ParamSlider
            label="Vị trí dọc Y"
            min={-480}
            max={480}
            step={5}
            value={curOffY}
            format={(v) => `${Math.round(v)}px`}
            onChange={(v) => onUpdate({ subtitleOffsetY: Math.round(v) })}
          />
          <div className="wf-v2-insp-subhead">Hiệu ứng Xuất hiện (Từ mờ sang đậm)</div>
          <OptionPills
            cols={2}
            options={ENTER_EFFECT_OPTIONS}
            value={curEnter}
            onPick={(eff) => onUpdate({ subtitleEnterEffect: eff })}
          />
          <div className="wf-v2-insp-subhead">Hiệu ứng Biến mất (Từ đậm sang nhạt)</div>
          <OptionPills
            cols={2}
            options={EXIT_EFFECT_OPTIONS}
            value={curExit}
            onPick={(eff) => onUpdate({ subtitleExitEffect: eff })}
          />
          <ParamSlider
            label="Thời lượng Hiện (Fade In)"
            min={0.04}
            max={0.8}
            step={0.02}
            value={curFadeIn}
            format={(v) => `${v.toFixed(2)}s`}
            onChange={(v) => onUpdate({ subtitleFadeIn: Number(v.toFixed(2)) })}
          />
          <ParamSlider
            label="Thời lượng Ẩn (Fade Out)"
            min={0.04}
            max={0.8}
            step={0.02}
            value={curFadeOut}
            format={(v) => `${v.toFixed(2)}s`}
            onChange={(v) => onUpdate({ subtitleFadeOut: Number(v.toFixed(2)) })}
          />
        </>
      )}

      {subTab === 'global' && (
        <>
          <div className="wf-v2-insp-subhead">Đồng bộ Thời lượng Thoại &amp; Hình ảnh Nhân vật</div>
          <button
            type="button"
            className={`wf-v2-opt-pill${syncHold ? ' active' : ''}`}
            onClick={() => onUpdate({ syncHoldTargetLayer: !syncHold })}
            title="Khi bật: nếu nhân vật đang nói mà chưa nói xong, hệ thống tự giữ hình nhân vật đến hết câu thoại để không nhảy sang hình khác sớm"
          >
            <span className="wf-v2-opt-pill-txt">
              {syncHold
                ? '🔗 Đang BẬT: Giữ hình nhân vật đến khi nói xong Vietsub / Audio'
                : '⚪ Đang TẮT: Thời gian Vietsub độc lập với thời gian đứng hình'}
            </span>
          </button>

          <div className="wf-v2-insp-subhead">Bảo vệ từng phần khi nhận Apply All</div>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {PROTECT_FIELD_OPTIONS.map((f) => {
              const locked = lockedFields.includes(f.id)
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`wf-v2-opt-pill${locked ? ' active' : ''}`}
                  onClick={() => toggleProtectField(f.id)}
                  title="Khoá thuộc tính này để khi áp dụng cấu hình chung sẽ không bị ghi đè"
                >
                  <span className="wf-v2-opt-pill-txt">
                    {locked ? '🔒 ' : '🔓 '}
                    {f.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="wf-v2-insp-subhead">Áp dụng Cấu hình Chung Toàn Dự Án</div>
          <button
            type="button"
            id="wf-subtitle-apply-all-btn"
            className="btn primary sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleApplyToAll}
            title="Áp dụng Font, Cỡ chữ, Màu, Nền và Vị trí của Node này cho toàn bộ Vietsub trong dự án (Tự động bỏ qua các Node có bật Khoá đặc biệt 🔒)"
          >
            ⚡ Áp dụng cấu hình này cho TOÀN BỘ Vietsub
          </button>
          <div className="wf-v2-pill-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button
              type="button"
              className="wf-v2-ghost-btn"
              onClick={handleRepairContinuity}
              title="Rà soát toàn bộ dự án để sửa lỗi nhân vật đang nói chưa xong đã nhảy hình hoặc Audio lệch Vietsub"
            >
              🔗 Đồng bộ Thoại &amp; Audio
            </button>
            <button
              type="button"
              className="wf-v2-ghost-btn"
              onClick={handleResetThisNode}
              title="Bỏ khoá đặc biệt và khôi phục Node này về đúng cấu hình mặc định chung của dự án"
            >
              ↺ Khôi phục mặc định
            </button>
          </div>
        </>
      )}
    </div>
  )
}
