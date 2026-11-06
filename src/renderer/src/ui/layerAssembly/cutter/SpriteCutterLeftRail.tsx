import React, { useState } from 'react'
import type { CutterToolMode, GridSlicerSettings } from './types'
import {
  IconSparkles,
  IconGrid3D,
  IconCrop,
  IconLasso,
  IconWand,
  IconEraser,
  IconBrush,
  IconEyedropper,
  IconUndo,
  IconRedo
} from '../../icons'
import { SpriteCutterFlyout } from './SpriteCutterFlyout'

export interface SpriteCutterLeftRailProps {
  tool: CutterToolMode
  islandsCount: number
  gridSettings: GridSlicerSettings
  brushRadius: number
  brushHardness: number
  brushOpacity: number
  wandTolerance: number
  canUndo: boolean
  canRedo: boolean
  eyedropperActive: boolean
  onChangeTool: (tool: CutterToolMode) => void
  onChangeGrid: (patch: Partial<GridSlicerSettings>) => void
  onChangeRadius: (r: number) => void
  onChangeHardness: (h: number) => void
  onChangeOpacity: (o: number) => void
  onChangeWandTolerance: (t: number) => void
  onUndo: () => void
  onRedo: () => void
  onToggleEyedropper: () => void
  onSendAllToBoard?: () => void
}

type FlyoutId = 'grid' | 'wand' | 'brush' | null

export function SpriteCutterLeftRail({
  tool,
  islandsCount,
  gridSettings,
  brushRadius,
  brushHardness,
  brushOpacity,
  wandTolerance,
  canUndo,
  canRedo,
  eyedropperActive,
  onChangeTool,
  onChangeGrid,
  onChangeRadius,
  onChangeHardness,
  onChangeOpacity,
  onChangeWandTolerance,
  onUndo,
  onRedo,
  onToggleEyedropper,
  onSendAllToBoard
}: SpriteCutterLeftRailProps) {
  const [activeFlyout, setActiveFlyout] = useState<FlyoutId>(null)

  const toggleFlyout = (id: FlyoutId) => {
    setActiveFlyout((prev) => (prev === id ? null : id))
  }

  return (
    <aside className="sc-left-rail" aria-label="Thanh công cụ cắt tách và cọ vẽ">
      {/* 1. Tool Tự Động (Auto Islands) */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${tool === 'auto' && !eyedropperActive ? 'active' : ''}`}
          onClick={() => {
            onChangeTool('auto')
            setActiveFlyout(null)
          }}
          title="Tự động nhận diện các mảnh bộ phận rời (Auto Islands)"
        >
          <IconSparkles width={18} height={18} />
          <span className="sc-rail-label">Tự động</span>
          <span className="sc-rail-badge">{islandsCount}</span>
        </button>
      </div>

      {/* 2. Tool Cắt Lưới (Grid Slicer) */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${tool === 'grid' && !eyedropperActive ? 'active' : ''} ${activeFlyout === 'grid' ? 'has-flyout-open' : ''}`}
          onClick={() => {
            onChangeTool('grid')
            toggleFlyout('grid')
          }}
          title="Cắt lưới ma trận đều (Grid Slicer): Click để mở cấu hình hàng/cột"
        >
          <IconGrid3D width={18} height={18} />
          <span className="sc-rail-label">Lưới</span>
          <span className="sc-rail-badge">{gridSettings.rows}×{gridSettings.cols}</span>
        </button>

        <SpriteCutterFlyout
          isOpen={activeFlyout === 'grid'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Cấu hình Cắt Lưới Ma Trận"
          icon={<IconGrid3D width={14} height={14} />}
          badge={`${gridSettings.rows}×${gridSettings.cols}`}
          width={280}
        >
          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Số Hàng (Rows)</span>
              <strong>{gridSettings.rows}</strong>
            </div>
            <div className="sc-grid-num-buttons">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`sc-chip-btn ${gridSettings.rows === num ? 'active' : ''}`}
                  onClick={() => onChangeGrid({ rows: num })}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Số Cột (Cols)</span>
              <strong>{gridSettings.cols}</strong>
            </div>
            <div className="sc-grid-num-buttons">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`sc-chip-btn ${gridSettings.cols === num ? 'active' : ''}`}
                  onClick={() => onChangeGrid({ cols: num })}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Lề viền trong (Padding)</span>
              <strong>{gridSettings.paddingInset ?? 2}px</strong>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={gridSettings.paddingInset ?? 2}
              onChange={(e) => onChangeGrid({ paddingInset: Number(e.target.value) })}
              className="sc-slider"
            />
          </div>

          {onSendAllToBoard && (
            <button
              type="button"
              className="sc-btn-primary"
              onClick={onSendAllToBoard}
              style={{ marginTop: 8 }}
            >
              ⚡ Đưa tất cả các ô vào Bố cục 2D
            </button>
          )}
        </SpriteCutterFlyout>
      </div>

      {/* 3. Tool Khung Chữ Nhật (Box Marquee) */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${tool === 'box' && !eyedropperActive ? 'active' : ''}`}
          onClick={() => {
            onChangeTool('box')
            setActiveFlyout(null)
          }}
          title="Kéo khung chữ nhật (Box Selection) để cắt một phần ảnh"
        >
          <IconCrop width={18} height={18} />
          <span className="sc-rail-label">Khung</span>
        </button>
      </div>

      {/* 4. Tool Lasso (Vẽ Vùng Tự Do) */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${tool === 'lasso' && !eyedropperActive ? 'active' : ''}`}
          onClick={() => {
            onChangeTool('lasso')
            setActiveFlyout(null)
          }}
          title="Vẽ vùng khoanh tự do (Lasso Path) để tách chi tiết uốn lượn"
        >
          <IconLasso width={18} height={18} />
          <span className="sc-rail-label">Lasso</span>
        </button>
      </div>

      <div className="sc-rail-sep" />

      {/* 5. Tool Đũa Thần (Magic Wand) */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${tool === 'wand' && !eyedropperActive ? 'active' : ''} ${activeFlyout === 'wand' ? 'has-flyout-open' : ''}`}
          onClick={() => {
            onChangeTool('wand')
            toggleFlyout('wand')
          }}
          title="Đũa thần (Magic Wand): Click điểm để đục thủng vùng nền (Click để mở cấu hình độ nhạy)"
        >
          <IconWand width={18} height={18} />
          <span className="sc-rail-label">Đũa</span>
          <span className="sc-rail-badge">{wandTolerance}%</span>
        </button>

        <SpriteCutterFlyout
          isOpen={activeFlyout === 'wand'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Độ Nhạy Đũa Thần"
          icon={<IconWand width={14} height={14} />}
          badge={`${wandTolerance}%`}
          width={260}
          onReset={() => onChangeWandTolerance(38)}
          resetTitle="Đặt lại độ nhạy 38%"
        >
          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Độ nhạy màu loang (Tolerance)</span>
              <strong>{wandTolerance}%</strong>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={wandTolerance}
              onChange={(e) => onChangeWandTolerance(Number(e.target.value))}
              className="sc-slider"
            />
            <div className="sc-slider-ticks">
              <span>5% (chặt)</span>
              <span>38% (chuẩn)</span>
              <span>100% (rộng)</span>
            </div>
          </div>
          <div className="sc-flyout-tip">
            💡 <strong>Mẹo:</strong> Click chuột trái để đục thủng nền kẹt kín. Giữ phím <code>Alt</code> + click để khôi phục vùng đã đục.
          </div>
        </SpriteCutterFlyout>
      </div>

      {/* 6. Tool Cọ Tẩy (Eraser) */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${tool === 'eraser' && !eyedropperActive ? 'active' : ''} ${activeFlyout === 'brush' && tool === 'eraser' ? 'has-flyout-open' : ''}`}
          onClick={() => {
            onChangeTool('eraser')
            toggleFlyout('brush')
          }}
          title="Cọ tẩy xóa chi tiết thừa (Eraser): Click để mở cấu hình cọ"
        >
          <IconEraser width={18} height={18} />
          <span className="sc-rail-label">Tẩy</span>
          <span className="sc-rail-badge">{brushRadius}px</span>
        </button>

        <SpriteCutterFlyout
          isOpen={activeFlyout === 'brush' && tool === 'eraser'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Cấu hình Cọ Tẩy Xóa"
          icon={<IconEraser width={14} height={14} />}
          badge={`${brushRadius}px`}
          width={280}
        >
          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Kích thước cọ (Radius)</span>
              <strong>{brushRadius}px</strong>
            </div>
            <input
              type="range"
              min={2}
              max={80}
              step={1}
              value={brushRadius}
              onChange={(e) => onChangeRadius(Number(e.target.value))}
              className="sc-slider"
            />
            <div className="sc-quick-radii">
              {[4, 8, 14, 20, 32, 48].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`sc-chip-btn ${brushRadius === r ? 'active' : ''}`}
                  onClick={() => onChangeRadius(r)}
                >
                  {r}px
                </button>
              ))}
            </div>
          </div>

          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Độ cứng viền cọ (Hardness)</span>
              <strong>{Math.round(brushHardness * 100)}%</strong>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={brushHardness}
              onChange={(e) => onChangeHardness(Number(e.target.value))}
              className="sc-slider"
            />
          </div>

          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Độ mờ đục nét vẽ (Opacity)</span>
              <strong>{Math.round(brushOpacity * 100)}%</strong>
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={brushOpacity}
              onChange={(e) => onChangeOpacity(Number(e.target.value))}
              className="sc-slider"
            />
          </div>

          <div className="sc-flyout-actions-row">
            <button
              type="button"
              className="sc-btn-secondary"
              disabled={!canUndo}
              onClick={onUndo}
              title="Hoàn tác nét cọ trước (Ctrl+Z)"
            >
              <IconUndo width={12} height={12} /> Hoàn tác
            </button>
            <button
              type="button"
              className="sc-btn-secondary"
              disabled={!canRedo}
              onClick={onRedo}
              title="Làm lại nét cọ vừa huỷ (Ctrl+Y)"
            >
              <IconRedo width={12} height={12} /> Làm lại
            </button>
          </div>
        </SpriteCutterFlyout>
      </div>

      {/* 7. Tool Cọ Khôi Phục (Restore) */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${tool === 'restore' && !eyedropperActive ? 'active' : ''} ${activeFlyout === 'brush' && tool === 'restore' ? 'has-flyout-open' : ''}`}
          onClick={() => {
            onChangeTool('restore')
            toggleFlyout('brush')
          }}
          title="Cọ khôi phục pixel gốc (Restore): Click để mở cấu hình cọ"
        >
          <IconBrush width={18} height={18} />
          <span className="sc-rail-label">Khôi phục</span>
          <span className="sc-rail-badge">{brushRadius}px</span>
        </button>

        <SpriteCutterFlyout
          isOpen={activeFlyout === 'brush' && tool === 'restore'}
          onClose={() => setActiveFlyout(null)}
          side="left"
          title="Cấu hình Cọ Khôi Phục"
          icon={<IconBrush width={14} height={14} />}
          badge={`${brushRadius}px`}
          width={280}
        >
          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Kích thước cọ (Radius)</span>
              <strong>{brushRadius}px</strong>
            </div>
            <input
              type="range"
              min={2}
              max={80}
              step={1}
              value={brushRadius}
              onChange={(e) => onChangeRadius(Number(e.target.value))}
              className="sc-slider"
            />
            <div className="sc-quick-radii">
              {[4, 8, 14, 20, 32, 48].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`sc-chip-btn ${brushRadius === r ? 'active' : ''}`}
                  onClick={() => onChangeRadius(r)}
                >
                  {r}px
                </button>
              ))}
            </div>
          </div>

          <div className="sc-flyout-field">
            <div className="sc-flyout-label-row">
              <span>Độ cứng viền cọ (Hardness)</span>
              <strong>{Math.round(brushHardness * 100)}%</strong>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={brushHardness}
              onChange={(e) => onChangeHardness(Number(e.target.value))}
              className="sc-slider"
            />
          </div>

          <div className="sc-flyout-actions-row">
            <button
              type="button"
              className="sc-btn-secondary"
              disabled={!canUndo}
              onClick={onUndo}
              title="Hoàn tác nét cọ trước (Ctrl+Z)"
            >
              <IconUndo width={12} height={12} /> Hoàn tác
            </button>
            <button
              type="button"
              className="sc-btn-secondary"
              disabled={!canRedo}
              onClick={onRedo}
              title="Làm lại nét cọ vừa huỷ (Ctrl+Y)"
            >
              <IconRedo width={12} height={12} /> Làm lại
            </button>
          </div>
        </SpriteCutterFlyout>
      </div>

      <div className="sc-rail-sep" />

      {/* 8. Kính Lúp Hút Màu Photoshop (Eyedropper) */}
      <div className="sc-rail-item-wrap">
        <button
          type="button"
          className={`sc-rail-btn ${eyedropperActive ? 'active sc-eyedropper-pulsing' : ''}`}
          onClick={onToggleEyedropper}
          title={eyedropperActive ? 'Đang bật Kính lúp hút màu (Click vào ảnh để lấy màu, bấm lại hoặc Esc để dừng)' : 'Bật Kính lúp hút màu pixel chuẩn Photoshop từ ảnh'}
        >
          <IconEyedropper width={18} height={18} />
          <span className="sc-rail-label">Hút màu</span>
          {eyedropperActive && <span className="sc-rail-badge-dot" />}
        </button>
      </div>
    </aside>
  )
}
