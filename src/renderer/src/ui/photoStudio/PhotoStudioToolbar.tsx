import React from 'react'
import type { PhotoStudioTool, PhotoCanvasBgMode } from './types'
import {
  IconEraser,
  IconBrush,
  IconWand,
  IconEyedropper,
  IconUndo,
  IconRedo,
  IconUpload,
  IconImage,
  IconSave,
  IconX
} from '../icons'

export interface PhotoStudioToolbarProps {
  tool: PhotoStudioTool
  onChangeTool: (tool: PhotoStudioTool) => void
  canvasBg: PhotoCanvasBgMode
  onChangeCanvasBg: (bg: PhotoCanvasBgMode) => void
  zoomScale: number
  onStepZoom: (delta: number) => void
  onFitZoom: () => void
  onResetZoom: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  brushRadius: number
  onChangeBrushRadius: (r: number) => void
  wandTolerance: number
  onChangeWandTolerance: (tol: number) => void
  imageSize: { w: number; h: number }
  fileName: string
  onUploadImage: () => void
  onLoadSample: () => void
  onOpenSaveModal: () => void
  onClose: () => void
}

export function PhotoStudioToolbar({
  tool,
  onChangeTool,
  canvasBg,
  onChangeCanvasBg,
  zoomScale,
  onStepZoom,
  onFitZoom,
  onResetZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  brushRadius,
  onChangeBrushRadius,
  wandTolerance,
  onChangeWandTolerance,
  imageSize,
  fileName,
  onUploadImage,
  onLoadSample,
  onOpenSaveModal,
  onClose
}: PhotoStudioToolbarProps) {
  return (
    <header className="ps-toolbar" data-mcp-region="photo_editor_toolbar">
      {/* 1. Header Left: Title + Size badge */}
      <div className="ps-toolbar-left">
        <div className="ps-title-group">
          <span className="ps-app-icon" aria-hidden="true">
            <IconImage width={16} height={16} />
          </span>
          <span className="ps-app-title">Tách nền & Chỉnh sửa ảnh</span>
          <span className="ps-size-badge" title={`Kích thước ảnh gốc: ${imageSize.w}×${imageSize.h}px`}>
            {imageSize.w}×{imageSize.h}
          </span>
          {fileName && <span className="ps-file-name" title={fileName}>{fileName}</span>}
        </div>

        {/* 2. Tool Buttons (Photoshop-like) */}
        <div className="ps-tools-cluster" role="toolbar" aria-label="Công cụ chỉnh sửa">
          <button
            type="button"
            className={`ps-tool-btn ${tool === 'pan' ? 'active' : ''}`}
            onClick={() => onChangeTool('pan')}
            title="Di chuyển (Giữ Space + Kéo chuột)"
          >
            ✋ Di chuyển
          </button>
          <button
            type="button"
            className={`ps-tool-btn ${tool === 'wand' ? 'active' : ''}`}
            onClick={() => onChangeTool('wand')}
            title="Đũa thần: Bấm vào vùng màu để tách/xóa"
          >
            <IconWand width={14} height={14} />
            <span>Đũa</span>
          </button>
          <button
            type="button"
            className={`ps-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => onChangeTool('eraser')}
            title="Cọ tẩy: Xóa thủ công từng chi tiết"
          >
            <IconEraser width={14} height={14} />
            <span>Tẩy</span>
          </button>
          <button
            type="button"
            className={`ps-tool-btn ${tool === 'restore' ? 'active' : ''}`}
            onClick={() => onChangeTool('restore')}
            title="Khôi phục: Lấy lại pixel gốc ban đầu"
          >
            <IconBrush width={14} height={14} />
            <span>Khôi phục</span>
          </button>
          <button
            type="button"
            className={`ps-tool-btn ${tool === 'box' ? 'active' : ''}`}
            onClick={() => onChangeTool('box')}
            title="Khung chọn chữ nhật (Kéo chọn vùng để xóa/cắt)"
          >
            ⬚ Khung
          </button>
          <button
            type="button"
            className={`ps-tool-btn ${tool === 'lasso' ? 'active' : ''}`}
            onClick={() => onChangeTool('lasso')}
            title="Dây thòng lọng Lasso (Vẽ vùng tự do)"
          >
            ☡ Lasso
          </button>
          <button
            type="button"
            className={`ps-tool-btn ${tool === 'eyedropper' ? 'active' : ''}`}
            onClick={() => onChangeTool('eyedropper')}
            title="Hút màu trực tiếp từ ảnh"
          >
            <IconEyedropper width={14} height={14} />
            <span>Hút màu</span>
          </button>
        </div>

        {/* Brush radius or wand tolerance slider inline */}
        {(tool === 'eraser' || tool === 'restore') && (
          <div className="ps-inline-slider" title="Bán kính nét cọ">
            <span className="ps-slider-label">Cọ:</span>
            <input
              type="range"
              min={2}
              max={80}
              value={brushRadius}
              onChange={(e) => onChangeBrushRadius(Number(e.target.value))}
            />
            <span className="ps-slider-val">{brushRadius}px</span>
          </div>
        )}

        {tool === 'wand' && (
          <div className="ps-inline-slider" title="Dung sai màu đũa thần">
            <span className="ps-slider-label">Dung sai:</span>
            <input
              type="range"
              min={2}
              max={90}
              value={wandTolerance}
              onChange={(e) => onChangeWandTolerance(Number(e.target.value))}
            />
            <span className="ps-slider-val">{wandTolerance}%</span>
          </div>
        )}
      </div>

      {/* 3. Header Right: Canvas Bg + Zoom + History + Actions */}
      <div className="ps-toolbar-right">
        {/* Undo / Redo */}
        <div className="ps-btn-group">
          <button
            type="button"
            className="ps-icon-btn"
            disabled={!canUndo}
            onClick={onUndo}
            title="Hoàn tác (Ctrl+Z)"
          >
            <IconUndo width={14} height={14} />
          </button>
          <button
            type="button"
            className="ps-icon-btn"
            disabled={!canRedo}
            onClick={onRedo}
            title="Làm lại (Ctrl+Y)"
          >
            <IconRedo width={14} height={14} />
          </button>
        </div>

        {/* Canvas BG Selector */}
        <div className="ps-segmented-pill" role="radiogroup" aria-label="Nền xem thử">
          <button
            type="button"
            className={`ps-seg-item ${canvasBg === 'checker-dark' ? 'active' : ''}`}
            onClick={() => onChangeCanvasBg('checker-dark')}
            title="Nền caro tối"
          >
            Caro
          </button>
          <button
            type="button"
            className={`ps-seg-item ${canvasBg === 'dark' ? 'active' : ''}`}
            onClick={() => onChangeCanvasBg('dark')}
            title="Nền đen tuyền"
          >
            Tối
          </button>
          <button
            type="button"
            className={`ps-seg-item ${canvasBg === 'light' ? 'active' : ''}`}
            onClick={() => onChangeCanvasBg('light')}
            title="Nền sáng"
          >
            Sáng
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="ps-zoom-cluster">
          <button type="button" className="ps-btn ghost sm" onClick={onFitZoom} title="Vừa khung nhìn">
            Vừa ({Math.round(zoomScale * 100)}%)
          </button>
          <button type="button" className="ps-btn ghost sm" onClick={onResetZoom} title="Chuẩn 100%">
            100%
          </button>
          <button type="button" className="ps-icon-btn sm" onClick={() => onStepZoom(-0.15)} title="Thu nhỏ (-)">
            -
          </button>
          <button type="button" className="ps-icon-btn sm" onClick={() => onStepZoom(0.15)} title="Phóng to (+)">
            +
          </button>
        </div>

        {/* Action Buttons: Upload, Sample, Save, Close */}
        <button type="button" className="ps-btn primary sm" onClick={onUploadImage} title="Chọn ảnh từ máy tính">
          <IconUpload width={13} height={13} />
          <span className="ps-btn-text">Tải ảnh</span>
        </button>

        <button type="button" className="ps-btn ghost sm" onClick={onLoadSample} title="Nạp ảnh nhân vật mẫu">
          <IconImage width={13} height={13} />
          <span className="ps-btn-text">Mẫu</span>
        </button>

        <button
          type="button"
          className="ps-btn success sm"
          onClick={onOpenSaveModal}
          title="Lưu ảnh vào Thư viện tài nguyên & Cảnh"
        >
          <IconSave width={14} height={14} />
          <span>Lưu ảnh…</span>
        </button>

        <button type="button" className="ps-icon-btn close-btn" onClick={onClose} title="Đóng xưởng ảnh">
          <IconX width={15} height={15} />
        </button>
      </div>
    </header>
  )
}
