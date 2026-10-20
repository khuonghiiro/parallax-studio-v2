import { memo } from 'react'
import { useEditor } from '../../../store/editor'
import { useView } from '../../../store/view'
import {
  IconCamera,
  IconCameraStage,
  IconCube,
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
    <div className="anim2d-toolbar single-row">
      <div className="anim2d-toolbar-left">
        {/* 0. Chuyển đổi góc nhìn nhanh tận dụng trọn vẹn khoảng trống trên đầu Cột 1 */}
        <div className="viewer-mode-seg" title="Chuyển đổi góc nhìn Viewport">
          <button
            id="view-camera"
            type="button"
            className="seg-btn"
            title="Góc nhìn Camera (kết quả render)"
            onClick={() => useView.getState().set({ split: false, primary: 'camera' })}
          >
            <IconCamera width={12} height={12} /> Camera
          </button>
          <button
            id="view-3d"
            type="button"
            className="seg-btn"
            title="Không gian 3D: xem các layer xếp chồng, các cảnh và đường bay camera"
            onClick={() => useView.getState().set({ split: false, primary: 'editor' })}
          >
            <IconCube width={12} height={12} /> 3D
          </button>
          <button
            id="view-topview"
            type="button"
            className="seg-btn"
            title="Sơ đồ độ sâu 2.5D: nhìn từ trên xuống để dàn dựng bố cục cảnh nhanh chóng"
            onClick={() => useView.getState().set({ split: false, primary: 'topview' })}
          >
            <IconRoute width={12} height={12} /> 2.5D
          </button>
          <button
            id="view-animate2d"
            type="button"
            className="seg-btn active"
            title="Đang ở Bàn dựng Cam 2D"
          >
            <IconCameraStage width={12} height={12} /> Cam 2D
          </button>
        </div>

        <span className="viewer-tool-sep" />

        {/* 1. Bố cục 2D & 3D / Chỉ 2D */}
        <div className="viewer-mode-seg" title="Bố cục hiển thị">
          <button
            id="view-animate2d-split"
            type="button"
            className={`seg-btn${animate2dSplit ? ' active' : ''}`}
            title="2D &amp; 3D: Cột trái Camera/3D · Cột phải Bàn dựng 2D"
            onClick={() => onSetAnimate2dSplit(true)}
          >
            <IconLayout2D3D width={12} height={12} /> 2D &amp; 3D
          </button>
          <button
            id="view-animate2d-single"
            type="button"
            className={`seg-btn${!animate2dSplit ? ' active' : ''}`}
            title="Chỉ hiện Bàn dựng 2D toàn màn hình"
            onClick={() => onSetAnimate2dSplit(false)}
          >
            <IconSingle width={12} height={12} /> Chỉ 2D
          </button>
        </div>

        <span className="viewer-tool-sep" />

        {/* 2. Chế độ công cụ thao tác */}
        <div className="viewer-mode-seg" title="Chế độ thao tác chuột trên Khung Camera">
          <button
            id="anim2d-mode-pan"
            type="button"
            className={`seg-btn${toolMode === 'pan-scale' ? ' active' : ''}`}
            onClick={() => onSetToolMode('pan-scale')}
            title="Lia (Pan) &amp; Khung (Zoom/Roll)"
          >
            ✢ Lia &amp; Zoom
          </button>
          <button
            id="anim2d-mode-orbit"
            type="button"
            className={`seg-btn${toolMode === 'orbit-3d' ? ' active' : ''}`}
            onClick={() => onSetToolMode('orbit-3d')}
            title="Xoay góc 3D (Yaw/Pitch)"
          >
            ↻ 3D
          </button>
          <button
            id="anim2d-mode-aim"
            type="button"
            className={`seg-btn${toolMode === 'aim-target' ? ' active' : ''}`}
            onClick={() => onSetToolMode('aim-target')}
            title="Bấm Layer để ngắm và lấy nét"
          >
            🎯 Ngắm
          </button>
        </div>

        <span className="viewer-tool-sep" />

        {/* 3. Phím tắt thêm nhanh theo chế độ */}
        {toolMode === 'pan-scale' && (
          <div className="anim2d-actions-group">
            <button
              id="anim2d-add-pan"
              type="button"
              className="btn xs primary"
              onClick={() => onSpawnNextFrame('pan')}
              title="Tạo thêm Mốc Camera tiếp theo"
            >
              <IconPlus width={11} height={11} /> Mốc
            </button>
            <button
              id="anim2d-add-hold"
              type="button"
              className="btn xs"
              onClick={onAddHold}
              title="Tạo mốc Dừng ngắm (+2.0s)"
            >
              ⏸ Dừng
            </button>
            <button
              id="anim2d-add-zoom-in"
              type="button"
              className="btn xs"
              onClick={() => onSpawnNextFrame('zoom-in')}
              title="Đẩy cận (Zoom In)"
            >
              🔍+
            </button>
            <button
              id="anim2d-add-zoom-out"
              type="button"
              className="btn xs"
              onClick={() => onSpawnNextFrame('zoom-out')}
              title="Kéo rộng (Zoom Out)"
            >
              🔍-
            </button>
          </div>
        )}

        {toolMode === 'orbit-3d' && activeFrame && (
          <div className="anim2d-actions-group">
            <span className="anim2d-mode-pill orbit">
              Y:{Math.round(activeFrame.yaw)}° P:{Math.round(activeFrame.pitch)}°
            </span>
            <button
              type="button"
              className="btn xs"
              onClick={() => onQuickAnglePreset(0, 0, 0, 'Thẳng 0°')}
              title="Đặt lại thẳng 0°"
            >
              0°
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={() => onQuickAnglePreset(-25, activeFrame.pitch, activeFrame.roll, 'Trái -25°')}
              title="Liếc Trái -25°"
            >
              ⟲ -25°
            </button>
            <button
              type="button"
              className="btn xs"
              onClick={() => onQuickAnglePreset(25, activeFrame.pitch, activeFrame.roll, 'Phải +25°')}
              title="Liếc Phải +25°"
            >
              ⟳ +25°
            </button>
          </div>
        )}

        {toolMode === 'aim-target' && (
          <div className="anim2d-actions-group">
            {activeShotLayers.slice(0, 3).map((layer) => (
              <button
                key={layer.id}
                type="button"
                className="btn xs aim-layer-chip"
                onClick={() => activeShotBox && onAimAtLayer(activeShotBox, layer)}
                title={`Ngắm & lấy nét vào "${layer.name}"`}
              >
                🎯 {layer.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="anim2d-toolbar-right">
        {toolMode === 'pan-scale' && (
          <div className="viewer-mode-seg" title="Kiểu đường nối lộ trình">
            <button
              id="anim2d-line-smoothstep"
              type="button"
              className={`seg-btn${lineStyle === 'smoothstep' ? ' active' : ''}`}
              onClick={() => onSetLineStyle('smoothstep')}
              title="Vuông góc bo tròn"
            >
              ╭╯ Vuông
            </button>
            <button
              id="anim2d-line-bezier"
              type="button"
              className={`seg-btn${lineStyle === 'bezier' ? ' active' : ''}`}
              onClick={() => onSetLineStyle('bezier')}
              title="Vòng cung"
            >
              ⌒ Cung
            </button>
          </div>
        )}

        {hasMovedBubbles && (
          <button
            id="anim2d-reset-bubbles"
            type="button"
            className="btn xs"
            onClick={onResetAllBubbles}
            title="Đặt lại vị trí bóng tròn"
          >
            ↺ Bóng
          </button>
        )}

        <button
          type="button"
          className={`btn xs icon${playing ? ' primary' : ''}`}
          onClick={onTogglePlaying}
          title={playing ? 'Dừng phát (Space)' : 'Phát thử lộ trình (Space)'}
        >
          {playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
        </button>

        <button
          type="button"
          className={`btn xs icon${showGrid ? ' active' : ''}`}
          onClick={onToggleShowGrid}
          title="Lưới 1/3 (Rule of Thirds)"
        >
          ⊞
        </button>

        <button
          type="button"
          className="btn xs icon"
          onClick={onFitStage}
          title="Căn vừa màn hình"
        >
          <IconFocus width={13} height={13} />
        </button>

        <button
          id="view-toggle-route-panel"
          type="button"
          className={`btn xs${inspectorTab === 'route' ? ' primary' : ''}`}
          onClick={() => useEditor.getState().setInspectorTab('route')}
          title="Mở Bảng Lộ trình Camera (Inspector)"
        >
          <IconRoute width={12} height={12} /> Lộ trình
        </button>
      </div>
    </div>
  )
})
