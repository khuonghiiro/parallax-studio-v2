import React from 'react'
import type { LoopSequenceGroup, LoopTriggerMode } from './types'

export const TRIGGER_OPTIONS: Array<{ id: LoopTriggerMode; label: string; hint: string }> = [
  { id: 'sequential', label: '⏭ Nối tiếp', hint: 'Chạy sau khi nhóm trước kết thúc (+ thời gian chờ)' },
  { id: 'on_frame', label: '⚡ Tại Frame #', hint: 'Bắt đầu ngay tại frame chỉ định của nhóm trước (VD: sét chạm đất → nổ)' },
  { id: 'parallel', label: '⇉ Song song', hint: 'Chạy cùng thời điểm với nhóm trước (+ độ trễ nếu có)' }
]

export const HOLD_PRESETS = [
  { label: '1 vòng', value: 0 },
  { label: '1.5s', value: 1.5 },
  { label: '3s', value: 3 },
  { label: '5s', value: 5 },
  { label: '8s', value: 8 }
]

export interface LoopGroupColumnCardProps {
  group: LoopSequenceGroup
  index: number
  isSelected: boolean
  prevGroup: LoopSequenceGroup | null
  curLocalFrame: number
  cycleDuration: number
  previewBg: string
  colStageDim: number
  commonScale: number
  onSelect: () => void
  onUpdate: (patch: Partial<LoopSequenceGroup>) => void
  onToggleSyncChroma: () => void
  onSetFrameIndex: (frameIdx: number) => void
  onRegisterCanvas: (canvas: HTMLCanvasElement | null) => void
  onDragStartStage: (e: React.MouseEvent<HTMLDivElement>) => void
  onDragMoveStage: (e: React.MouseEvent<HTMLDivElement>) => void
  onDragEndStage: () => void
}

export function LoopGroupColumnCard({
  group: g,
  index: idx,
  isSelected,
  prevGroup,
  curLocalFrame,
  cycleDuration,
  previewBg,
  onSelect,
  onUpdate,
  onToggleSyncChroma,
  onSetFrameIndex,
  onRegisterCanvas,
  onDragStartStage,
  onDragMoveStage,
  onDragEndStage
}: LoopGroupColumnCardProps): React.ReactElement {
  const enabledFrames = g.frames.filter((f) => f.enabled)
  const prevEnabledCount = prevGroup ? prevGroup.frames.filter((f) => f.enabled).length : 0

  return (
    <div
      className={`loop-align-col-card${isSelected ? ' active' : ''}`}
      onClick={onSelect}
    >
      <div className="loop-align-col-head">
        <div className="loop-align-col-head-left">
          <span className="loop-align-col-num">Nhóm #{idx + 1}</span>
          <input
            type="text"
            className="la-input loop-align-name-input"
            value={g.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            title="Tên nhóm hiệu ứng"
          />
        </div>
        <label
          className="loop-align-sync-chk"
          onClick={(e) => e.stopPropagation()}
          title="Tích để nhóm này ăn theo thông số Tách nền chung"
        >
          <input
            type="checkbox"
            checked={g.syncChromaKey !== false}
            onChange={onToggleSyncChroma}
          />
          <span>Đồng bộ nền</span>
        </label>
      </div>

      {/* Sân khấu kéo thả căn chỉnh vị trí trực tiếp của cột #idx */}
      <div
        className={`loop-align-col-stage bg-${previewBg}`}
        title="Kéo chuột trực tiếp trên khung này để căn vị trí (X, Y) của nhóm khớp với điểm chạm"
        onMouseDown={onDragStartStage}
        onMouseMove={onDragMoveStage}
        onMouseUp={onDragEndStage}
        onMouseLeave={onDragEndStage}
      >
        <canvas
          ref={onRegisterCanvas}
          className="loop-align-col-canvas"
        />
        <span className="loop-player-hud-badge">
          Frame #{curLocalFrame + 1}/{Math.max(1, enabledFrames.length)}
        </span>
        <span className="loop-player-hud-pos-badge">
          X:{g.offsetX >= 0 ? `+${g.offsetX}` : g.offsetX} · Y:{g.offsetY >= 0 ? `+${g.offsetY}` : g.offsetY} · {Math.round((g.scale || 1) * 100)}%
        </span>
      </div>

      {/* Thanh chọn Frame để soi & nút căn tâm nhanh */}
      <div className="loop-align-col-stage-bar">
        <div className="loop-align-frame-stepper">
          <button
            type="button"
            className="la-btn la-btn--xs"
            onClick={() =>
              onSetFrameIndex(
                (curLocalFrame - 1 + Math.max(1, enabledFrames.length)) % Math.max(1, enabledFrames.length)
              )
            }
            title="Xem frame trước của nhóm này"
          >
            ◀
          </button>
          <span>Soi F#{curLocalFrame + 1}</span>
          <button
            type="button"
            className="la-btn la-btn--xs"
            onClick={() =>
              onSetFrameIndex((curLocalFrame + 1) % Math.max(1, enabledFrames.length))
            }
            title="Xem frame tiếp theo của nhóm này"
          >
            ▶
          </button>
        </div>

        <div className="loop-align-quick-pos">
          <button
            type="button"
            className="la-btn la-btn--xs"
            onClick={() => onUpdate({ offsetX: 0, offsetY: 0, scale: 1 })}
            title="Đưa nhóm về tâm gốc (0, 0)"
          >
            🎯 Tâm 0,0
          </button>
          {prevGroup && (
            <button
              type="button"
              className="la-btn la-btn--xs"
              onClick={() =>
                onUpdate({
                  offsetX: prevGroup.offsetX || 0,
                  offsetY: prevGroup.offsetY || 0
                })
              }
              title={`Khớp toạ độ X, Y bằng với Nhóm #${idx}`}
            >
              ⊕ Khớp N#{idx}
            </button>
          )}
        </div>
      </div>

      {/* Toạ độ X / Y / Tỉ lệ */}
      <div className="loop-align-coords-grid">
        <label className="loop-align-num-field">
          <span>Vị trí X (px)</span>
          <input
            type="number"
            className="la-input la-input--xs"
            step={2}
            value={Math.round(g.offsetX || 0)}
            onChange={(e) => onUpdate({ offsetX: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="loop-align-num-field">
          <span>Vị trí Y (px)</span>
          <input
            type="number"
            className="la-input la-input--xs"
            step={2}
            value={Math.round(g.offsetY || 0)}
            onChange={(e) => onUpdate({ offsetY: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="loop-align-num-field">
          <span>Tỉ lệ (%)</span>
          <input
            type="number"
            className="la-input la-input--xs"
            min={10}
            max={400}
            step={5}
            value={Math.round((g.scale || 1) * 100)}
            onChange={(e) =>
              onUpdate({
                scale: Math.max(0.1, Math.min(4, (Number(e.target.value) || 100) / 100))
              })
            }
          />
        </label>
      </div>

      {/* Logic Kích Hoạt & Thời Lượng */}
      <div className="loop-align-logic-box">
        {idx === 0 ? (
          <div className="loop-align-first-badge">
            🎬 Nhóm mở đầu chuỗi (Bắt đầu tại 0.00s · tự nhiên {cycleDuration.toFixed(2)}s)
          </div>
        ) : (
          <>
            <div className="loop-align-logic-label">
              Khi nào Nhóm #{idx + 1} bắt đầu chạy (so với Nhóm #{idx})?
            </div>
            <div className="la-seg loop-align-trigger-seg">
              {TRIGGER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`la-seg-btn${g.triggerMode === opt.id ? ' active' : ''}`}
                  onClick={() => onUpdate({ triggerMode: opt.id })}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {g.triggerMode === 'on_frame' && prevEnabledCount > 0 && (
              <div className="loop-align-frame-picker">
                <span className="loop-align-picker-lbl">
                  Chọn Frame của Nhóm #{idx} kích hoạt Nhóm #{idx + 1}:
                </span>
                <div className="loop-align-frame-pills">
                  {Array.from({ length: Math.min(24, prevEnabledCount) }, (_, fIdx) => {
                    const fNum = fIdx + 1
                    const isTrig = (g.triggerFrameIndex || 1) === fNum
                    return (
                      <button
                        key={fNum}
                        type="button"
                        className={`loop-align-f-pill${isTrig ? ' active' : ''}`}
                        onClick={() => onUpdate({ triggerFrameIndex: fNum })}
                      >
                        #{fNum}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <div className="loop-align-timing-row">
          {idx > 0 && (
            <label className="loop-align-num-field">
              <span>Chờ thêm (s)</span>
              <input
                type="number"
                className="la-input la-input--xs"
                min={0}
                max={60}
                step={0.1}
                value={g.delaySec}
                onChange={(e) =>
                  onUpdate({
                    delaySec: Math.max(0, Number(e.target.value) || 0)
                  })
                }
              />
            </label>
          )}
          <label className="loop-align-num-field">
            <span>Giữ chạy (s)</span>
            <input
              type="number"
              className="la-input la-input--xs"
              min={0}
              max={300}
              step={0.2}
              value={g.holdDurationSec}
              onChange={(e) =>
                onUpdate({
                  holdDurationSec: Math.max(0, Number(e.target.value) || 0)
                })
              }
              title="0 = chạy đúng 1 vòng tự nhiên; >0 = giữ lặp lại trong số giây chỉ định"
            />
          </label>
          <div className="loop-align-hold-pills">
            {HOLD_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`loop-align-f-pill${Math.abs((g.holdDurationSec || 0) - p.value) < 0.05 ? ' active' : ''}`}
                onClick={() => onUpdate({ holdDurationSec: p.value })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
