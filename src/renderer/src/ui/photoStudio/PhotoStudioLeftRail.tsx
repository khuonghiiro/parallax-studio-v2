import React, { useState } from 'react'
import type { PhotoStudioTool } from './types'
import {
  IconToolPan,
  IconToolMarquee,
  IconToolLasso
} from './PhotoStudioIcons'
import {
  IconWand,
  IconEraser,
  IconBrush,
  IconEyedropper
} from '../icons'
import { PhotoStudioFlyout } from './PhotoStudioFlyout'

export interface PhotoStudioLeftRailProps {
  tool: PhotoStudioTool
  onChangeTool: (tool: PhotoStudioTool) => void
  brushRadius: number
  onChangeBrushRadius: (radius: number) => void
  wandTolerance: number
  onChangeWandTolerance: (tolerance: number) => void
}

export function PhotoStudioLeftRail({
  tool,
  onChangeTool,
  brushRadius,
  onChangeBrushRadius,
  wandTolerance,
  onChangeWandTolerance
}: PhotoStudioLeftRailProps) {
  const [activeFlyout, setActiveFlyout] = useState<'wand' | 'eraser' | 'restore' | null>(null)

  const handleToolClick = (t: PhotoStudioTool) => {
    onChangeTool(t)
    if (t === 'wand') {
      setActiveFlyout((f) => (f === 'wand' ? null : 'wand'))
    } else if (t === 'eraser') {
      setActiveFlyout((f) => (f === 'eraser' ? null : 'eraser'))
    } else if (t === 'restore') {
      setActiveFlyout((f) => (f === 'restore' ? null : 'restore'))
    } else {
      setActiveFlyout(null)
    }
  }

  return (
    <aside className="ps-left-rail" role="toolbar" aria-label="Hộp công cụ Photoshop" data-mcp-region="photo_editor_left_rail">
      {/* 1. Di chuyển */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${tool === 'pan' ? 'active' : ''}`}
          onClick={() => handleToolClick('pan')}
          title="Di chuyển ảnh (Giữ phím Space + Kéo chuột)"
        >
          <IconToolPan width={18} height={18} />
          <span className="ps-rail-label">Di chuyển</span>
        </button>
      </div>

      {/* 2. Đũa thần */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${tool === 'wand' ? 'active' : ''}`}
          onClick={() => handleToolClick('wand')}
          title="Đũa thần: Nhấp vào màu để tách/chọn"
        >
          <IconWand width={18} height={18} />
          <span className="ps-rail-label">Đũa</span>
          <span className="ps-rail-badge">{wandTolerance}%</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'wand'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Dung sai đũa thần"
          icon={<IconWand width={15} height={15} />}
          badge={`${wandTolerance}%`}
          onReset={() => onChangeWandTolerance(36)}
          resetTitle="Đặt lại 36%"
          width={250}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Dung sai:</span>
            <input
              type="range"
              min={2}
              max={90}
              value={wandTolerance}
              onChange={(e) => onChangeWandTolerance(Number(e.target.value))}
            />
            <span className="ps-flyout-val">{wandTolerance}%</span>
          </div>
          <div className="ps-flyout-presets">
            {[15, 25, 36, 50, 70].map((v) => (
              <button
                key={v}
                type="button"
                className={`ps-chip-btn ${wandTolerance === v ? 'active' : ''}`}
                onClick={() => onChangeWandTolerance(v)}
              >
                {v}%
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 3. Cọ tẩy điểm ảnh */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${tool === 'eraser' ? 'active' : ''}`}
          onClick={() => handleToolClick('eraser')}
          title="Cọ tẩy: Xóa thủ công từng chi tiết thừa"
        >
          <IconEraser width={18} height={18} />
          <span className="ps-rail-label">Tẩy</span>
          <span className="ps-rail-badge">{brushRadius}px</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'eraser'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Kích thước cọ tẩy"
          icon={<IconEraser width={15} height={15} />}
          badge={`${brushRadius}px`}
          onReset={() => onChangeBrushRadius(18)}
          resetTitle="Đặt lại 18px"
          width={250}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Bán kính:</span>
            <input
              type="range"
              min={2}
              max={80}
              value={brushRadius}
              onChange={(e) => onChangeBrushRadius(Number(e.target.value))}
            />
            <span className="ps-flyout-val">{brushRadius}px</span>
          </div>
          <div className="ps-flyout-presets">
            {[6, 12, 18, 28, 48].map((r) => (
              <button
                key={r}
                type="button"
                className={`ps-chip-btn ${brushRadius === r ? 'active' : ''}`}
                onClick={() => onChangeBrushRadius(r)}
              >
                {r}px
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 4. Khôi phục điểm ảnh */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${tool === 'restore' ? 'active' : ''}`}
          onClick={() => handleToolClick('restore')}
          title="Khôi phục: Lấy lại các pixel gốc ban đầu"
        >
          <IconBrush width={18} height={18} />
          <span className="ps-rail-label">Khôi phục</span>
          <span className="ps-rail-badge">{brushRadius}px</span>
        </button>

        <PhotoStudioFlyout
          isOpen={activeFlyout === 'restore'}
          onClose={() => setActiveFlyout(null)}
          side="right"
          title="Cọ khôi phục ảnh gốc"
          icon={<IconBrush width={15} height={15} />}
          badge={`${brushRadius}px`}
          onReset={() => onChangeBrushRadius(18)}
          resetTitle="Đặt lại 18px"
          width={250}
        >
          <div className="ps-flyout-slider-row">
            <span className="ps-flyout-label">Bán kính:</span>
            <input
              type="range"
              min={2}
              max={80}
              value={brushRadius}
              onChange={(e) => onChangeBrushRadius(Number(e.target.value))}
            />
            <span className="ps-flyout-val">{brushRadius}px</span>
          </div>
          <div className="ps-flyout-presets">
            {[6, 12, 18, 28, 48].map((r) => (
              <button
                key={r}
                type="button"
                className={`ps-chip-btn ${brushRadius === r ? 'active' : ''}`}
                onClick={() => onChangeBrushRadius(r)}
              >
                {r}px
              </button>
            ))}
          </div>
        </PhotoStudioFlyout>
      </div>

      {/* 5. Khung chữ nhật (Marquee) */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${tool === 'box' ? 'active' : ''}`}
          onClick={() => handleToolClick('box')}
          title="Khung chữ nhật: Kéo chọn vùng để xóa"
        >
          <IconToolMarquee width={18} height={18} />
          <span className="ps-rail-label">Khung</span>
        </button>
      </div>

      {/* 6. Lasso đa giác */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${tool === 'lasso' ? 'active' : ''}`}
          onClick={() => handleToolClick('lasso')}
          title="Lasso: Vẽ đa giác khoanh vùng để xóa"
        >
          <IconToolLasso width={18} height={18} />
          <span className="ps-rail-label">Lasso</span>
        </button>
      </div>

      {/* 7. Kính lúp hút màu */}
      <div className="ps-rail-item">
        <button
          type="button"
          className={`ps-rail-btn ${tool === 'eyedropper' ? 'active' : ''}`}
          onClick={() => handleToolClick('eyedropper')}
          title="Hút màu nền từ ảnh bằng kính lúp"
        >
          <IconEyedropper width={18} height={18} />
          <span className="ps-rail-label">Hút màu</span>
        </button>
      </div>
    </aside>
  )
}
