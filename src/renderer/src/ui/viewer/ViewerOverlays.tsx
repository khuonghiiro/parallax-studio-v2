import '../../styles/viewerCameraStatus.css'
import { ViewTags } from './ViewTags'
import type { ResidencyStats } from '../../engine/SceneRenderer'
import type { EditorViewKind } from '../../engine/EditorCamera'
import { useView, type ViewState } from '../../store/view'
import { useEditor } from '../../store/editor'
import { evaluate } from '../../animation/keyframes'
import {
  IconCamera,
  IconCameraFrustumCull,
  IconCompFrame,
  IconCube,
  IconFlightPath3D,
  IconFocusTarget3D,
  IconGizmoBbox,
  IconGizmoRotate3D,
  IconGizmoTranslate3D,
  IconReadout
} from '../icons'
import { EDITOR_KINDS, type Layout } from './viewerLayout'

interface ViewerOverlaysProps {
  view: ViewState
  playing: boolean
  fps: number
  fov?: number
  stats: ResidencyStats | null
  rects: Layout
}

const VIEW_3D_NAV_TOOLTIP =
  'Điều hướng Không gian 3D:\n' +
  '• Chuột trái: Di chuyển mặt phẳng (Pan)\n' +
  '• Con lăn chuột (hoặc Alt + Chuột trái): Xoay 360° (Orbit)\n' +
  '• Cuộn chuột: Phóng to / Thu nhỏ (Zoom)\n' +
  '• Phím F: Tiêu điểm vào layer hoặc cảnh đang chọn'

export function ViewerOverlays({
  view,
  playing,
  fps,
  fov,
  stats,
  rects
}: ViewerOverlaysProps) {
  const cameraFov = useEditor((s) => s.project.camera.fov)
  const time = useEditor((s) => s.time)
  const selectedLayerName = useEditor((s) => {
    if (!s.selectedLayerId) return null
    const l = s.project.layers.find((item) => item.id === s.selectedLayerId)
    return l ? l.name : null
  })
  const visibleLayerRatio = useEditor((s) => {
    const valid = s.project.layers.filter((l) => !l.locked)
    const vis = valid.filter((l) => l.visible !== false).length
    return `${vis}/${valid.length}`
  })
  const currentFov = fov ?? evaluate(cameraFov, time)
  const showEd = !!rects.ed
  const isAnimate2D = !!rects.stage2d
  const isAnimateSplit = Boolean(isAnimate2D && view.animate2dSplit && rects.cam && rects.ed && rects.stage2d)
  const isStandardSplit = Boolean(!isAnimate2D && rects.cam && rects.ed)

  const showBbox = view.showBbox ?? true
  const showTranslate = view.showTranslate ?? true
  const showRotate = view.showRotate ?? true
  const showReadout = view.showReadout ?? true

  const selectEditorKind = (kind: EditorViewKind) => {
    view.set({ editorKind: kind })
    useView.setState((s) => ({
      focus: { kind: 'selection', n: (s.focus?.n ?? 0) + 1 }
    }))
  }

  return (
    <>
      {rects.cam && (
        <div
          id="camera-frame"
          className="camera-frame"
          style={{ left: rects.cam.x, top: rects.cam.y, width: rects.cam.w, height: rects.cam.h }}
        />
      )}

      {/* Vách ngăn chia đôi tiêu chuẩn (Camera | 3D) */}
      {isStandardSplit && rects.ed && (
        <div className="pane-divider" style={{ left: rects.ed.x - 1 }} />
      )}

      {/* Vách ngăn chế độ 2D & 3D (Cột 1 chia 2 hàng: Hàng 1 Camera + Hàng 2 3D | Cột 2: Mặt phẳng 2D) */}
      {isAnimateSplit && rects.ed && rects.stage2d && (
        <>
          <div
            className="pane-divider"
            style={{
              left: rects.stage2d.x - 1,
              top: 30,
              height: 'calc(100% - 30px)'
            }}
          />
          <div
            className="pane-divider-h"
            style={{ top: rects.ed.y - 1, left: 0, width: rects.ed.w }}
          />
        </>
      )}

      {/* Dock công cụ Viewport & Không gian 3D (Nằm gọn trên thanh Header 30px, không che tầm nhìn Camera 3D) */}
      <div className="viewer-tools" data-mcp-region="viewer_tools">
        <ViewTags />
        <span className="viewer-tool-sep" />

        {/* Nhóm 2: Góc chiếu Không gian 3D 1-Click Segmented Pills (Không dùng combobox, không đè vào canvas 3D) */}
        {showEd && (
          <>
            <div
              id="view-kind"
              className="viewer-mode-seg viewer-3d-presets"
              data-mcp-region="viewer_3d_presets"
              role="group"
              aria-label="Góc chiếu không gian 3D"
            >
              <span className="viewer-3d-presets-tag" title={VIEW_3D_NAV_TOOLTIP}>
                <IconCube width={12} height={12} />
                <span>3D</span>
              </span>
              {EDITOR_KINDS.map((spec) => {
                const active = view.editorKind === spec.id
                return (
                  <button
                    key={spec.id}
                    type="button"
                    className={`seg-btn${active ? ' active' : ''}`}
                    onClick={() => selectEditorKind(spec.id)}
                    title={`Góc nhìn 3D: ${spec.label}`}
                    aria-pressed={active}
                  >
                    {spec.shortLabel}
                  </button>
                )
              })}
            </div>
            <span className="viewer-tool-sep" />
          </>
        )}

        {/* Nhóm 3: Các công cụ Gizmo & BBox thao tác layer */}
        <div className="viewer-tool-group" title="Công cụ thao tác layer (BBox, Di chuyển 3D, Xoay 3D, Tọa độ)">
          <button
            id="view-toggle-bbox"
            type="button"
            className={`viewer-tool-btn icon${showBbox ? ' active' : ''}`}
            title={`Khung bao BBox (${showBbox ? 'Đang hiện' : 'Đang ẩn'})\n• Bật/Tắt khung viền và 8 điểm mút co dãn layer`}
            onClick={() => view.set({ showBbox: !showBbox })}
            aria-label="Khung bao co dãn BBox"
          >
            <IconGizmoBbox width={14} height={14} />
          </button>
          <button
            id="view-toggle-translate"
            type="button"
            className={`viewer-tool-btn icon${showTranslate ? ' active' : ''}`}
            title={`Trục di chuyển 3D XYZ (${showTranslate ? 'Đang hiện' : 'Đang ẩn'})\n• Kéo mũi tên XYZ để dời vị trí\n• Phím W để bật/tắt nhanh`}
            onClick={() => view.set({ showTranslate: !showTranslate })}
            aria-label="Trục di chuyển XYZ"
          >
            <IconGizmoTranslate3D width={14} height={14} />
          </button>
          <button
            id="view-toggle-rotate"
            type="button"
            className={`viewer-tool-btn icon${showRotate ? ' active' : ''}`}
            title={`Vòng xoay Gimbal 3D (${showRotate ? 'Đang hiện' : 'Đang ẩn'})\n• Kéo vòng cầu để xoay nghiêng\n• Phím E để bật/tắt nhanh`}
            onClick={() => view.set({ showRotate: !showRotate })}
            aria-label="Vòng xoay góc 3D"
          >
            <IconGizmoRotate3D width={14} height={14} />
          </button>
          <button
            id="view-toggle-readout"
            type="button"
            className={`viewer-tool-btn icon${showReadout ? ' active' : ''}`}
            title={`Thông số tọa độ P/R (${showReadout ? 'Đang hiện' : 'Đang ẩn'})\n• Bật/Tắt hiển thị vị trí (P) và góc xoay (R) của layer`}
            onClick={() => view.set({ showReadout: !showReadout })}
            aria-label="Thông số tọa độ P/R"
          >
            <IconReadout width={14} height={14} />
          </button>
        </div>

        {/* Nhóm 4: Hỗ trợ hiển thị & Căn khung không gian 3D */}
        {showEd && (
          <>
            <span className="viewer-tool-sep" />
            <div className="viewer-tool-group">
              <button
                id="view-path"
                type="button"
                className={`viewer-tool-btn icon${view.showPath ? ' active' : ''}`}
                title="Hiện/ẩn đường bay quỹ đạo camera 3D"
                onClick={() => view.set({ showPath: !view.showPath })}
                aria-label="Hiện/ẩn đường bay camera 3D"
              >
                <IconFlightPath3D width={14} height={14} />
              </button>
              <button
                id="view-camera-only"
                type="button"
                className={`viewer-tool-btn icon${view.cameraOnly ? ' active' : ''}`}
                title="Chỉ hiện nội dung trong hình nón tầm nhìn Camera (Frustum Culling)"
                onClick={() => view.set({ cameraOnly: !view.cameraOnly })}
                aria-label="Chỉ hiện vùng nhìn camera"
              >
                <IconCameraFrustumCull width={14} height={14} />
              </button>
              <button
                id="view-focus"
                type="button"
                className="viewer-tool-btn icon"
                title="Tiêu điểm vào layer đang chọn trong 3D (Phím F)"
                onClick={() => useView.getState().requestFocus('selection')}
                aria-label="Tiêu điểm vào vùng chọn"
              >
                <IconFocusTarget3D width={14} height={14} />
              </button>
              <button
                id="view-fit-all"
                type="button"
                className="viewer-tool-btn viewer-fit-scene-btn"
                title="Căn khung 3D ôm gọn toàn bộ phân cảnh"
                onClick={() =>
                  useView.setState((s) => ({
                    focus: { kind: 'all', n: (s.focus?.n ?? 0) + 1 }
                  }))
                }
                aria-label="Căn cảnh 3D"
              >
                <IconCompFrame width={13} height={13} />
                <span>Căn cảnh</span>
              </button>
              <span
                className="viewer-3d-help-chip"
                title={VIEW_3D_NAV_TOOLTIP}
                aria-label="Hướng dẫn chuột không gian 3D"
              >
                ?
              </span>
            </div>
          </>
        )}

        {rects.cam && (
          <div
            className="viewer-camera-status"
            data-mcp-region="viewer_camera_status"
            title={selectedLayerName ?? 'Khung nhìn Camera'}
          >
            <IconCamera />
            <span>Camera · {visibleLayerRatio} lớp</span>
            {selectedLayerName && <span className="viewer-camera-selection">{selectedLayerName}</span>}
          </div>
        )}

        {/* Nhóm phải: Telemetry HUD (FOV, FPS, VRAM) nằm gọn bên phải thanh công cụ, không đè lên nút bên trái */}
        <div className="viewer-hud viewer-hud-inline" data-mcp-region="viewer_hud">
          {playing && (
            <>
              <span className="hud-item" title="Tốc độ khung hình phát thực tế">
                <span className="dot live" /> {fps} fps
              </span>
              <span className="hud-sep" />
            </>
          )}
          {rects.cam && (
            <span className="hud-item" title={`Góc mở ống kính camera: ${currentFov.toFixed(1)}°`}>
              FOV {currentFov.toFixed(0)}°
            </span>
          )}
          {stats && (
            <>
              {rects.cam && <span className="hud-sep" />}
              <span
                id="memory-chip"
                className={`hud-item mem${stats.textureMB > stats.budgetMB * 0.85 ? ' warn' : ''}`}
                onClick={() => useView.getState().openDialog('performance')}
                title={`⚡ Texture GPU đang giữ: ${stats.textures} (${stats.pending} đang giải mã)\nNgân sách VRAM: ${stats.budgetMB} MB · LOD bias ${stats.lodBias}\nLayer đang vẽ trong camera: ${stats.visibleLayers}/${stats.totalLayers}\n\n👉 Bấm vào đây để mở Cấu hình Hiệu năng, RAM & VRAM GPU.`}
              >
                ⚡ {stats.textureMB.toFixed(0)}/{stats.budgetMB} MB
              </span>
            </>
          )}
        </div>
      </div>
    </>
  )
}
