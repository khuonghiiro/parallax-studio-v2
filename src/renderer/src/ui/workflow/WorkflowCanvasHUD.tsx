import React from 'react'

export interface WorkflowCanvasHUDProps {
  clusterMoveMode: boolean
  showSubNodes?: boolean
  zoom: number
  onToggleClusterMove: () => void
  onToggleSubNodes?: () => void
  onAutoLayout: () => void
  onFitView: () => void
  onZoomByStep: (delta: number) => void
  onResetZoom: () => void
}

/**
 * Thanh công cụ dạng dọc (Vertical Icon HUD) ở góc canvas.
 * Giữ canvas thoáng đãng, chỉ sử dụng icon trực quan và tooltip rõ ràng.
 */
export const WorkflowCanvasHUD: React.FC<WorkflowCanvasHUDProps> = ({
  clusterMoveMode,
  showSubNodes = false,
  zoom,
  onToggleClusterMove,
  onToggleSubNodes,
  onAutoLayout,
  onFitView,
  onZoomByStep,
  onResetZoom
}) => {
  return (
    <div className="wf-canvas-hud vertical" data-mcp-region="workflow_canvas_hud">
      <button
        id="wf-btn-cluster-drag"
        type="button"
        className={`wf-hud-btn icon${clusterMoveMode ? ' active' : ''}`}
        title={`Kéo cả cụm: ${clusterMoveMode ? 'ĐANG BẬT' : 'ĐANG TẮT'} (Hoặc giữ phím Shift khi kéo khối)`}
        aria-label="Kéo cả cụm"
        onClick={(e) => {
          e.stopPropagation()
          onToggleClusterMove()
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="8.5" y="14" width="7" height="7" rx="1.5" />
          <path d="M10 6.5h4M6.5 10l3.5 4M17.5 10l-3.5 4" />
        </svg>
      </button>

      {onToggleSubNodes && (
        <button
          id="wf-btn-toggle-subnodes"
          type="button"
          className={`wf-hud-btn icon${showSubNodes ? ' active' : ''}`}
          title={
            showSubNodes
              ? 'Đang HIỆN rời thẻ Tọa độ & Mảnh con — Bấm để gộp gọn vào thẻ Layer chính'
              : 'Đang GỘP GỌN thẻ Tọa độ & Mảnh con trong thẻ Layer — Bấm nếu muốn bung rời trên sơ đồ'
          }
          aria-label="Gộp/Bung thẻ phụ"
          onClick={(e) => {
            e.stopPropagation()
            onToggleSubNodes()
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="6" rx="1.5" />
            <rect x="6" y="14" width="12" height="6" rx="1.5" strokeDasharray="2 2" />
            <path d="M12 10v4" />
          </svg>
        </button>
      )}

      <button
        id="wf-btn-autolayout"
        type="button"
        className="wf-hud-btn icon"
        title="Căn gọn cụm: Sắp xếp tự động vị trí các khối chức năng thoáng đẹp"
        aria-label="Căn gọn cụm"
        onClick={(e) => {
          e.stopPropagation()
          onAutoLayout()
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>

      <button
        id="wf-btn-fit-view"
        type="button"
        className="wf-hud-btn icon"
        title="Khớp khung nhìn: Đưa toàn bộ sơ đồ về chính giữa màn hình"
        aria-label="Khớp khung nhìn"
        onClick={(e) => {
          e.stopPropagation()
          onFitView()
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      </button>

      <div className="wf-hud-sep horizontal" />

      <button
        type="button"
        className="wf-hud-btn icon"
        title="Phóng to sơ đồ (Hoặc lăn con lăn chuột)"
        aria-label="Phóng to"
        onClick={(e) => {
          e.stopPropagation()
          onZoomByStep(0.1)
        }}
      >
        +
      </button>
      <button
        type="button"
        className="wf-hud-btn wf-hud-zoom-val"
        title="Tỷ lệ hiển thị (Bấm để đặt về chuẩn 100% 1:1)"
        onClick={(e) => {
          e.stopPropagation()
          onResetZoom()
        }}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        className="wf-hud-btn icon"
        title="Thu nhỏ sơ đồ (Hoặc lăn con lăn chuột)"
        aria-label="Thu nhỏ"
        onClick={(e) => {
          e.stopPropagation()
          onZoomByStep(-0.1)
        }}
      >
        −
      </button>
    </div>
  )
}
