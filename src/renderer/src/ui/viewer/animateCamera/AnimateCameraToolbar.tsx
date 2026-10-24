import { memo } from 'react'
import { useEditor } from '../../../store/editor'
import {
  IconAim,
  IconCamOrbitTilt,
  IconCamPanZoom2D,
  IconFitStage2D,
  IconLineBezier,
  IconLineSmoothstep,
  IconOrbitCenter0,
  IconOrbitLeft25,
  IconOrbitRight25,
  IconPause,
  IconPlay,
  IconPlus,
  IconResetBubbles,
  IconRouteInspector,
  IconRuleOfThirds
} from '../../icons'
import type { StageToolMode } from './AnimateCameraViewfinder'
import type { CameraLineStyle } from './animateCameraEdgePaths'
import type { ProjectedLayer2D, ShotStageBox } from './animateCameraMath'
import type { CameraWaypointItem } from './animateCameraRouteLogic'

interface AnimateCameraToolbarProps {
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
  toolMode,
  lineStyle,
  activeFrame,
  activeShotBox,
  activeShotLayers,
  hasMovedBubbles,
  playing,
  showGrid,
  inspectorTab,
  onSetToolMode,
  onSetLineStyle,
  onSpawnNextFrame,
  onQuickAnglePreset,
  onAimAtLayer,
  onResetAllBubbles,
  onTogglePlaying,
  onToggleShowGrid,
  onFitStage
}: AnimateCameraToolbarProps) {
  return (
    <div className="anim2d-toolbar single-row" data-mcp-region="viewer_stage2d_tools">
      <div className="anim2d-toolbar-left">
        {/* 1. Chế độ công cụ thao tác trên Khung Camera */}
        <div className="viewer-mode-seg" title="Chế độ thao tác chuột trên Khung Camera 2D">
          <button
            id="anim2d-mode-pan"
            type="button"
            className={`seg-btn${toolMode === 'pan-scale' ? ' active' : ''}`}
            onClick={() => onSetToolMode('pan-scale')}
            title="Lia (Pan) &amp; Co dãn Khung Camera (Zoom/Roll)"
          >
            <IconCamPanZoom2D width={14} height={14} />
          </button>
          <button
            id="anim2d-mode-orbit"
            type="button"
            className={`seg-btn${toolMode === 'orbit-3d' ? ' active' : ''}`}
            onClick={() => onSetToolMode('orbit-3d')}
            title="Xoay góc nghiêng Camera 3D (Yaw/Pitch)"
          >
            <IconCamOrbitTilt width={14} height={14} />
          </button>
          <button
            id="anim2d-mode-aim"
            type="button"
            className={`seg-btn${toolMode === 'aim-target' ? ' active' : ''}`}
            onClick={() => onSetToolMode('aim-target')}
            title="Bấm trực tiếp vào Layer để ngắm và lấy nét"
          >
            <IconAim width={14} height={14} />
          </button>
        </div>

        <span className="viewer-tool-sep" />

        {/* 2. Phím tắt thêm nhanh theo chế độ */}
        {toolMode === 'pan-scale' && (
          <div className="anim2d-actions-group">
            <button
              id="anim2d-add-pan"
              type="button"
              className="btn xs icon primary"
              onClick={() => onSpawnNextFrame('pan')}
              title="Tạo thêm Mốc Camera tiếp theo"
            >
              <IconPlus width={14} height={14} />
            </button>
          </div>
        )}

        {toolMode === 'orbit-3d' && activeFrame && (
          <div className="anim2d-actions-group">
            <span className="anim2d-mode-pill orbit" title="Góc xoay ngang (Yaw) và dọc (Pitch) hiện tại">
              {Math.round(activeFrame.yaw)}°/{Math.round(activeFrame.pitch)}°
            </span>
            <button
              type="button"
              className="btn xs icon"
              onClick={() => onQuickAnglePreset(0, 0, 0, 'Thẳng 0°')}
              title="Đặt lại góc nhìn thẳng chính diện 0°"
            >
              <IconOrbitCenter0 width={13} height={13} />
            </button>
            <button
              type="button"
              className="btn xs icon"
              onClick={() => onQuickAnglePreset(-25, activeFrame.pitch, activeFrame.roll, 'Trái -25°')}
              title="Liếc góc nghiêng Trái -25°"
            >
              <IconOrbitLeft25 width={13} height={13} />
            </button>
            <button
              type="button"
              className="btn xs icon"
              onClick={() => onQuickAnglePreset(25, activeFrame.pitch, activeFrame.roll, 'Phải +25°')}
              title="Liếc góc nghiêng Phải +25°"
            >
              <IconOrbitRight25 width={13} height={13} />
            </button>
          </div>
        )}

        {toolMode === 'aim-target' && (
          <div className="anim2d-actions-group">
            {activeShotLayers.slice(0, 2).map((layer) => (
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
          <div className="viewer-mode-seg" title="Kiểu đường nối lộ trình Camera">
            <button
              id="anim2d-line-smoothstep"
              type="button"
              className={`seg-btn${lineStyle === 'smoothstep' ? ' active' : ''}`}
              onClick={() => onSetLineStyle('smoothstep')}
              title="Đường nối vuông góc bo tròn (Smoothstep)"
            >
              <IconLineSmoothstep width={14} height={14} />
            </button>
            <button
              id="anim2d-line-bezier"
              type="button"
              className={`seg-btn${lineStyle === 'bezier' ? ' active' : ''}`}
              onClick={() => onSetLineStyle('bezier')}
              title="Đường nối vòng cung mượt (Bezier)"
            >
              <IconLineBezier width={14} height={14} />
            </button>
          </div>
        )}

        {hasMovedBubbles && (
          <button
            id="anim2d-reset-bubbles"
            type="button"
            className="btn xs icon"
            onClick={onResetAllBubbles}
            title="Đặt lại vị trí bóng tròn chú thích về mặc định"
          >
            <IconResetBubbles width={13} height={13} />
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
          title="Bật/tắt Lưới bố cục 1/3 (Rule of Thirds)"
        >
          <IconRuleOfThirds width={13} height={13} />
        </button>

        <button
          type="button"
          className="btn xs icon"
          onClick={onFitStage}
          title="Căn vừa toàn bộ cảnh vào màn hình (Fit Stage)"
        >
          <IconFitStage2D width={13} height={13} />
        </button>

        <button
          id="view-toggle-route-panel"
          type="button"
          className={`btn xs icon${inspectorTab === 'route' ? ' primary' : ''}`}
          onClick={() => useEditor.getState().setInspectorTab('route')}
          title="Mở Bảng Chi tiết Lộ trình Camera (Inspector)"
        >
          <IconRouteInspector width={13} height={13} />
        </button>
      </div>
    </div>
  )
})
