import React from 'react'
import { IconEraser, IconBrush, IconUndo, IconRedo } from '../../icons'

export interface CutterBrushSubBarProps {
  tool: 'eraser' | 'restore'
  brushRadius: number
  brushHardness: number
  brushOpacity: number
  canUndo: boolean
  canRedo: boolean
  onChangeRadius: (radius: number) => void
  onChangeHardness: (hardness: number) => void
  onChangeOpacity: (opacity: number) => void
  onUndo: () => void
  onRedo: () => void
}

const PRESET_SIZES = [8, 16, 32, 50]

export function CutterBrushSubBar({
  tool,
  brushRadius,
  brushHardness,
  brushOpacity,
  canUndo,
  canRedo,
  onChangeRadius,
  onChangeHardness,
  onChangeOpacity,
  onUndo,
  onRedo
}: CutterBrushSubBarProps) {
  const isEraser = tool === 'eraser'

  return (
    <div className="layer-cutter-brush-subbar">
      {/* Tool Badge */}
      <div className="layer-cutter-brush-badge">
        {isEraser ? (
          <>
            <IconEraser width={13} height={13} style={{ color: 'var(--accent-cyan)' }} />
            <span>Cọ tẩy</span>
          </>
        ) : (
          <>
            <IconBrush width={13} height={13} style={{ color: 'var(--key)' }} />
            <span>Khôi phục gốc</span>
          </>
        )}
      </div>

      <div className="layer-cutter-divider" />

      {/* Preset Sizes */}
      <div className="layer-cutter-brush-presets">
        <span className="subbar-label">Cỡ nhanh:</span>
        <div className="brush-preset-btn-group">
          {PRESET_SIZES.map((sz) => (
            <button
              key={sz}
              type="button"
              className={`brush-preset-pill ${brushRadius === sz ? 'active' : ''}`}
              onClick={() => onChangeRadius(sz)}
              title={`Đặt cỡ cọ ${sz}px`}
            >
              {sz}px
            </button>
          ))}
        </div>
      </div>

      <div className="layer-cutter-divider" />

      {/* Stepper + Slider Radius */}
      <div className="layer-cutter-control-row">
        <span className="subbar-label">Cỡ:</span>
        <button
          type="button"
          className="stepper-btn"
          title="Giảm cỡ cọ 2px"
          onClick={() => onChangeRadius(Math.max(2, brushRadius - 2))}
        >
          -
        </button>
        <input
          type="range"
          min={2}
          max={80}
          value={brushRadius}
          onChange={(e) => onChangeRadius(Number(e.target.value))}
          style={{ width: 64 }}
        />
        <button
          type="button"
          className="stepper-btn"
          title="Tăng cỡ cọ 2px"
          onClick={() => onChangeRadius(Math.min(80, brushRadius + 2))}
        >
          +
        </button>
        <span className="subbar-val">{brushRadius}px</span>
      </div>

      <div className="layer-cutter-divider" />

      {/* Hardness Toggle / Stepper */}
      <div className="layer-cutter-control-row">
        <span className="subbar-label">Viền:</span>
        <div className="brush-hardness-group">
          <button
            type="button"
            className={`brush-hardness-pill ${brushHardness <= 0.5 ? 'active' : ''}`}
            onClick={() => onChangeHardness(0.4)}
            title="Nét cọ mềm (Viền mờ nhạt dần theo hàm mượt smoothstep)"
          >
            Mềm
          </button>
          <button
            type="button"
            className={`brush-hardness-pill ${brushHardness > 0.5 ? 'active' : ''}`}
            onClick={() => onChangeHardness(0.9)}
            title="Nét cọ cứng (Viền sắc sảo, dứt khoát)"
          >
            Cứng
          </button>
        </div>
      </div>

      <div className="layer-cutter-divider" />

      {/* Opacity */}
      <div className="layer-cutter-control-row">
        <span className="subbar-label">Lực:</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={brushOpacity}
          onChange={(e) => onChangeOpacity(Number(e.target.value))}
          style={{ width: 50 }}
        />
        <span className="subbar-val">{Math.round(brushOpacity * 100)}%</span>
      </div>

      {/* Undo & Redo Quick Group */}
      <div className="layer-cutter-brush-actions" style={{ marginLeft: 'auto' }}>
        <button
          type="button"
          className="btn sm icon"
          disabled={!canUndo}
          onClick={onUndo}
          title="Hoàn tác nét cọ vừa vẽ (Ctrl+Z)"
        >
          <IconUndo width={12} height={12} />
        </button>
        <button
          type="button"
          className="btn sm icon"
          disabled={!canRedo}
          onClick={onRedo}
          title="Làm lại nét cọ vừa hoàn tác (Ctrl+Y)"
        >
          <IconRedo width={12} height={12} />
        </button>
        <span className="layer-cutter-subbar-hint">
          Ctrl+Z để hoàn tác
        </span>
      </div>
    </div>
  )
}
