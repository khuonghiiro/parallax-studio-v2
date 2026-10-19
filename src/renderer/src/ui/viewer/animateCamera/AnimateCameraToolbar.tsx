import { memo } from 'react'
import { useEditor } from '../../../store/editor'
import {
  IconFocus,
  IconLayout2D3D,
  IconPause,
  IconPlay,
  IconPlus,
  IconRoute,
  IconSingle
} from '../../icons'
import type { StageToolMode } from './AnimateCameraViewfinder'
import type { CameraLineStyle } from './animateCameraEdgePaths'
import type { ProjectedLayer2D, ShotStageBox } from './animateCameraMath'
import type { CameraWaypointItem } from './animateCameraRouteLogic'

interface AnimateCameraToolbarProps {
  animate2dSplit: boolean
  toolMode: StageToolMode
  lineStyle: CameraLineStyle
  activeFrame: CameraWaypointItem | undefined
  activeShotBox: ShotStageBox | undefined
  activeShotLayers: ProjectedLayer2D[]
  hasMovedBubbles: boolean
  playing: boolean
  showAllFrames: boolean
  showGrid: boolean
  inspectorTab: string
  onSetAnimate2dSplit: (split: boolean) => void
  onSetToolMode: (mode: StageToolMode) => void
  onSetLineStyle: (style: CameraLineStyle) => void
  onSpawnNextFrame: (mode: 'pan' | 'zoom-in' | 'zoom-out' | 'shot') => void
  onAddHold: () => void
  onQuickAnglePreset: (yaw: number, pitch: number, roll: number, label: string) => void
  onAimAtLayer: (box: ShotStageBox, layer: ProjectedLayer2D) => void
  onResetAllBubbles: () => void
  onTogglePlaying: () => void
  onToggleShowAllFrames: () => void
  onToggleShowGrid: () => void
  onFitStage: () => void
}

export const AnimateCameraToolbar = memo(function AnimateCameraToolbar({
  animate2dSplit,
  toolMode,
  lineStyle,
  activeFrame,
  activeShotBox,
  activeShotLayers,
  hasMovedBubbles,
  playing,
  showAllFrames,
  showGrid,
  inspectorTab,
  onSetAnimate2dSplit,
  onSetToolMode,
  onSetLineStyle,
  onSpawnNextFrame,
  onAddHold,
  onQuickAnglePreset,
  onAimAtLayer,
  onResetAllBubbles,
  onTogglePlaying,
  onToggleShowAllFrames,
  onToggleShowGrid,
  onFitStage
}: AnimateCameraToolbarProps) {
  return (
    <div className="anim2d-toolbar">
      <div className="anim2d-toolbar-row1">
        {/* 1. Bố cục 2D & 3D / Chỉ 2D */}
        <div className="viewer-mode-seg" title="Chọn bố cục hiển thị cho Lộ trình Camera 2D">
          <button
            id="view-animate2d-split"
            type="button"
            className={`seg-btn${animate2dSplit ? ' active' : ''}`}
            title="Chế độ 2D & 3D: Cột trái hiện Camera kết quả & Không gian 3D · Cột phải hiện Bàn dựng 2D"
            onClick={() => onSetAnimate2dSplit(true)}
          >
            <IconLayout2D3D width={12} height={12} /> 2D &amp; 3D
          </button>
          <button
            id="view-animate2d-single"
            type="button"
            className={`seg-btn${!animate2dSplit ? ' active' : ''}`}
            title="Chỉ hiện Bàn dựng Mặt phẳng 2D rộng toàn vùng xem"
            onClick={() => onSetAnimate2dSplit(false)}
          >
            <IconSingle width={12} height={12} /> Chỉ 2D
          </button>
        </div>

        <span className="viewer-tool-sep" />

        {/* 2. Chế độ công cụ thao tác trực tiếp trên Bàn dựng 2D */}
        <div className="viewer-mode-seg" title="Chế độ thao tác chuột trên Khung Camera">
          <button
            id="anim2d-mode-pan"
            type="button"
            className={`seg-btn${toolMode === 'pan-scale' ? ' active' : ''}`}
            onClick={() => onSetToolMode('pan-scale')}
            title="Chế độ Lia & Khung: Kéo khung để Lia (Pan), kéo 8 góc để Phóng/Thu (Zoom), kéo đỉnh để Xoay nghiêng (Roll)"
          >
            ✢ Lia &amp; Zoom
          </button>
          <button
            id="anim2d-mode-orbit"
            type="button"
            className={`seg-btn${toolMode === 'orbit-3d' ? ' active' : ''}`}
            onClick={() => onSetToolMode('orbit-3d')}
            title="Chế độ Xoay góc 3D: Kéo trên khung để xoay góc nhìn 3D (Yaw trái/phải, Pitch cao/thấp)"
          >
            ↻ Xoay 3D
          </button>
          <button
            id="anim2d-mode-aim"
            type="button"
            className={`seg-btn${toolMode === 'aim-target' ? ' active' : ''}`}
            onClick={() => onSetToolMode('aim-target')}
            title="Chế độ Bấm chọn chủ thể: Bấm trực tiếp vào bất kỳ Layer nào trên cảnh 2D để ngắm và lấy nét"
          >
            🎯 Ngắm Layer
          </button>
        </div>
      </div>

      {/* Dòng 2: Thay đổi linh hoạt theo Tab chế độ đang kích hoạt + nút điều khiển khung nhìn */}
      <div className="anim2d-toolbar-row2">
        <div className="anim2d-actions">
          {toolMode === 'pan-scale' && (
            <>
              <button
                id="anim2d-add-pan"
                type="button"
                className="btn xs primary"
                onClick={() => onSpawnNextFrame('pan')}
                title="Tạo thêm Mốc Camera tiếp theo để lia sang vị trí hoặc cảnh kế tiếp"
              >
                <IconPlus width={11} height={11} /> Mốc
              </button>
              <button
                id="anim2d-add-hold"
                type="button"
                className="btn xs"
                onClick={onAddHold}
                title="Tạo mốc Dừng ngắm (+2.0s) giữ nguyên khung hình để người xem thưởng thức cảnh"
              >
                ⏸ Dừng
              </button>
              <button
                id="anim2d-add-zoom-in"
                type="button"
                className="btn xs"
                onClick={() => onSpawnNextFrame('zoom-in')}
                title="Tạo mốc Đẩy cận cảnh (Zoom In)"
              >
                🔍+ Cận
              </button>
              <button
                id="anim2d-add-zoom-out"
                type="button"
                className="btn xs"
                onClick={() => onSpawnNextFrame('zoom-out')}
                title="Tạo mốc Kéo toàn cảnh (Zoom Out)"
              >
                🔍- Rộng
              </button>
            </>
          )}

          {toolMode === 'orbit-3d' && activeFrame && (
            <>
              <span className="anim2d-mode-pill orbit" title="Góc xoay 3D của mốc đang chọn (Kéo trên cảnh để xoay)">
                ↻ Y:{Math.round(activeFrame.yaw)}° P:{Math.round(activeFrame.pitch)}° R:{Math.round(activeFrame.roll)}°
              </span>
              <button
                type="button"
                className={`btn xs${Math.round(activeFrame.yaw) === -25 ? ' active' : ''}`}
                onClick={() => onQuickAnglePreset(-25, activeFrame.pitch, activeFrame.roll, 'Liếc Trái -25°')}
                title="Xoay góc 3D sang trái (-25° Yaw)"
              >
                ⟲ Trái 25°
              </button>
              <button
                type="button"
                className={`btn xs${Math.abs(activeFrame.yaw) < 1 && Math.abs(activeFrame.pitch) < 1 && Math.abs(activeFrame.roll) < 1 ? ' active' : ''}`}
                onClick={() => onQuickAnglePreset(0, 0, 0, 'Thẳng trực diện 0°')}
                title="Đặt lại góc máy thẳng trực diện 0°"
              >
                ● Thẳng 0°
              </button>
              <button
                type="button"
                className={`btn xs${Math.round(activeFrame.yaw) === 25 ? ' active' : ''}`}
                onClick={() => onQuickAnglePreset(25, activeFrame.pitch, activeFrame.roll, 'Liếc Phải +25°')}
                title="Xoay góc 3D sang phải (+25° Yaw)"
              >
                ⟳ Phải 25°
              </button>
              <button
                type="button"
                className={`btn xs${Math.round(activeFrame.pitch) === 22 ? ' active' : ''}`}
                onClick={() => onQuickAnglePreset(activeFrame.yaw, 22, activeFrame.roll, 'Góc cao +22°')}
                title="Góc nhìn từ trên cao xuống (+22° Pitch)"
              >
                ⤴ Cao +22°
              </button>
              <button
                type="button"
                className={`btn xs${Math.round(activeFrame.pitch) === -16 ? ' active' : ''}`}
                onClick={() => onQuickAnglePreset(activeFrame.yaw, -16, activeFrame.roll, 'Góc thấp -16°')}
                title="Góc nhìn từ dưới hất lên (-16° Pitch)"
              >
                ⤵ Thấp -16°
              </button>
            </>
          )}

          {toolMode === 'aim-target' && (
            <>
              <span className="anim2d-mode-pill aim" title="Bấm vào thẻ Layer bên dưới hoặc ghim trên cảnh để ngắm & lấy nét">
                🎯 Ngắm ({activeShotBox?.name ?? 'Cảnh'}):
              </span>
              {activeShotLayers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  className="btn xs aim-layer-chip"
                  onClick={() => activeShotBox && onAimAtLayer(activeShotBox, layer)}
                  title={`Ngắm & lấy nét Camera vào "${layer.name}" (Độ sâu Z: ${Math.round(layer.zDepth)})`}
                >
                  🎯 {layer.name}
                </button>
              ))}
            </>
          )}

          {toolMode === 'pan-scale' && (
            <>
              <span className="viewer-tool-sep" />

              {/* Kiểu Đường Nối Lộ Trình & Dây Liên Kết (ReactFlow Line Styles: Vuông góc bo tròn vs Vòng cung) */}
              <div
                className="viewer-mode-seg"
                title="Chọn kiểu đường dây liên kết Lộ trình Camera (Thiết kế chuẩn ReactFlow)"
              >
                <button
                  id="anim2d-line-smoothstep"
                  type="button"
                  className={`seg-btn${lineStyle === 'smoothstep' ? ' active' : ''}`}
                  onClick={() => onSetLineStyle('smoothstep')}
                  title="Kiểu đường Vuông góc bo tròn (ReactFlow SmoothStep Edge)"
                >
                  ╭╯ Vuông bo
                </button>
                <button
                  id="anim2d-line-bezier"
                  type="button"
                  className={`seg-btn${lineStyle === 'bezier' ? ' active' : ''}`}
                  onClick={() => onSetLineStyle('bezier')}
                  title="Kiểu đường Vòng cung mềm mại (ReactFlow Bezier Arc Edge)"
                >
                  ⌒ Vòng cung
                </button>
              </div>
            </>
          )}

          {hasMovedBubbles && (
            <button
              id="anim2d-reset-bubbles"
              type="button"
              className="btn xs"
              onClick={onResetAllBubbles}
              title="Đặt lại vị trí các bóng tròn đã kéo về hàng mặc định bên dưới cảnh"
            >
              ↺ Đặt lại bóng
            </button>
          )}
        </div>

        <div className="anim2d-actions">
          <button
            type="button"
            className={`btn xs icon${playing ? ' primary' : ''}`}
            onClick={onTogglePlaying}
            title={playing ? 'Dừng phát (Space)' : 'Phát thử lộ trình Camera (Space)'}
          >
            {playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
          </button>
          <button
            type="button"
            className={`btn xs icon${showAllFrames ? ' active' : ''}`}
            onClick={onToggleShowAllFrames}
            title="Bật/Tắt hiển thị khung viền mờ của tất cả các mốc cùng lúc"
          >
            #
          </button>
          <button
            type="button"
            className={`btn xs icon${showGrid ? ' active' : ''}`}
            onClick={onToggleShowGrid}
            title="Bật/Tắt lưới bố cục 1/3 (Rule of Thirds) trong khung ngắm"
          >
            ⊞
          </button>
          <button
            type="button"
            className="btn xs icon"
            onClick={onFitStage}
            title="Căn vừa toàn bộ các Cảnh 2D và Khung Camera vào màn hình"
          >
            <IconFocus width={13} height={13} />
          </button>
          <button
            id="view-toggle-route-panel"
            type="button"
            className={`btn xs${inspectorTab === 'route' ? ' primary' : ''}`}
            onClick={() => useEditor.getState().setInspectorTab('route')}
            title="Mở Bảng Lộ trình Camera ở cột bên phải (Inspector)"
          >
            <IconRoute width={12} height={12} /> Lộ trình
          </button>
        </div>
      </div>
    </div>
  )
})
