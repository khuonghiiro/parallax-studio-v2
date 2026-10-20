import type { ResidencyStats } from '../../engine/SceneRenderer'
import type { EditorViewKind } from '../../engine/EditorCamera'
import { useView, type ViewState } from '../../store/view'
import { useEditor } from '../../store/editor'
import { evaluate } from '../../animation/keyframes'
import {
  IconAxisMove,
  IconAxisRotate,
  IconBoundingBox,
  IconCamera,
  IconCameraStage,
  IconCube,
  IconEye,
  IconFocus,
  IconReadout,
  IconRoute,
  IconSingle,
  IconSplit
} from '../icons'
import { CustomSelect } from '../controls/CustomSelect'
import { EDITOR_KINDS, type Layout } from './viewerLayout'

interface ViewerOverlaysProps {
  view: ViewState
  playing: boolean
  fps: number
  fov?: number
  stats: ResidencyStats | null
  rects: Layout
}

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
  const currentFov = fov ?? evaluate(cameraFov, time)
  const showEd = !!rects.ed
  const isAnimate2D = view.primary === 'animate2d'
  const isAnimateSplit = Boolean(isAnimate2D && view.animate2dSplit && rects.cam && rects.ed && rects.stage2d)
  const isStandardSplit = Boolean(!isAnimate2D && view.split && rects.cam && rects.ed)
  const kindLabel = EDITOR_KINDS.find((k) => k.id === view.editorKind)?.label ?? ''

  const showBbox = view.showBbox ?? true
  const showTranslate = view.showTranslate ?? true
  const showRotate = view.showRotate ?? true
  const showReadout = view.showReadout ?? true

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
          <div className="pane-divider" style={{ left: rects.stage2d.x - 1 }} />
          <div
            className="pane-divider-h"
            style={{ top: rects.ed.y - 1, left: 0, width: rects.ed.w }}
          />
        </>
      )}

      {/* Dock trạng thái thông số & bộ nhớ gọn nhẹ, không lặp lại kích thước/fps đã có trên thanh tiêu đề */}
      <div className="viewer-hud">
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

      {(isStandardSplit || isAnimateSplit) && rects.cam && (
        <span
          className="pane-tag"
          style={{
            left: 8,
            top: isAnimateSplit && rects.ed ? rects.ed.y - 30 : rects.cam.y + rects.cam.h - 34,
            maxWidth: Math.max(100, (isAnimateSplit && rects.ed ? rects.ed.w : rects.cam.w) - 16)
          }}
          title="Hàng 1 — Khung nhìn Camera (Kết quả render video chính thức)"
        >
          <span className="pane-tag-badge">
            <IconCamera /> Camera
          </span>
        </span>
      )}
      {showEd && (
        <span
          className="pane-tag"
          style={{
            left: rects.ed!.x + 8,
            top: rects.ed!.y + rects.ed!.h - 30,
            maxWidth: Math.max(120, rects.ed!.w - 16)
          }}
          title={`Không gian 3D (${kindLabel})\n• Giữ chuột trái: Di chuyển mặt phẳng (Pan)\n• Giữ con lăn chuột (hoặc Alt + Chuột trái): Xoay 360° (Orbit)\n• Cuộn chuột: Phóng to / Thu nhỏ (Zoom)\n• Phím F: Tiêu điểm (Focus vào layer hoặc cảnh đang chọn)\n• Nhấp đúp chuột vào cảnh: Bay camera tới cảnh đó`}
        >
          <span className="pane-tag-badge">
            <IconCube /> 3D · {kindLabel}
          </span>
          {!isAnimateSplit && (
            <span className="pane-hint">
              Chuột trái: di chuyển · Giữ con lăn: xoay 360° · Lăn: zoom · F: focus
            </span>
          )}
        </span>
      )}

      {/* Dock công cụ Viewport & Thao tác Layer (Top-Right Tools) — ở chế độ Cam 2D đã tích hợp vào thanh toolbar của bàn dựng */}
      {!isAnimate2D && (
        <div className="viewer-tools">
          {/* Nhóm 1: Chuyển đổi góc nhìn chính (luôn hiển thị để dễ thao tác) */}
          <div className="viewer-mode-seg">
            <button
              id="view-camera"
              className={`seg-btn${!view.split && view.primary === 'camera' ? ' active' : ''}`}
              title="Góc nhìn Camera (kết quả render)"
              onClick={() => view.set({ split: false, primary: 'camera' })}
            >
              <IconCamera width={12} height={12} /> Camera
            </button>
            <button
              id="view-3d"
              className={`seg-btn${!view.split && view.primary === 'editor' ? ' active' : ''}`}
              title="Không gian 3D: xem các layer xếp chồng, các cảnh và đường bay camera"
              onClick={() => view.set({ split: false, primary: 'editor' })}
            >
              <IconCube width={12} height={12} /> 3D
            </button>
            <button
              id="view-topview"
              className={`seg-btn${!view.split && view.primary === 'topview' ? ' active' : ''}`}
              title="Sơ đồ độ sâu 2.5D: nhìn từ trên xuống để dàn dựng bố cục cảnh nhanh chóng"
              onClick={() => view.set({ split: false, primary: 'topview' })}
            >
              <IconRoute width={12} height={12} /> 2.5D
            </button>
            <button
              id="view-animate2d"
              className={`seg-btn${view.primary === 'animate2d' ? ' active' : ''}`}
              title="Lộ trình Camera 2D kiểu Adobe Animate: đóng khung camera, lia cảnh, phóng to/thu nhỏ dần trực quan trên mặt phẳng 2D"
              onClick={() => {
                view.set({ split: false, primary: 'animate2d' })
                useEditor.getState().setInspectorTab('route')
              }}
            >
              <IconCameraStage width={12} height={12} /> Cam 2D
            </button>
          </div>

          <span className="viewer-tool-sep" />

          <button
            id="view-split"
            className={`viewer-tool-btn icon${view.split ? ' active' : ''}`}
            title={view.split ? '1 view: Phóng to góc nhìn hiện tại' : '2 view: Camera + 3D song song'}
            onClick={() => view.set({ split: !view.split })}
          >
            {view.split ? <IconSingle width={14} height={14} /> : <IconSplit width={14} height={14} />}
          </button>
          <span className="viewer-tool-sep" />

          {/* Nhóm 2: Kiểu nhìn 3D (CustomSelect chuẩn 60fps) */}
          {showEd && (
            <>
              <CustomSelect<EditorViewKind>
                id="view-kind"
                className="viewer-kind-select"
                value={view.editorKind}
                onChange={(val) => view.set({ editorKind: val })}
                options={EDITOR_KINDS.map((k) => ({ value: k.id, label: k.label }))}
                size="sm"
                title="Kiểu nhìn 3D"
                dropdownWidth={126}
              />
              <span className="viewer-tool-sep" />
            </>
          )}

          {/* Nhóm 3: Các công cụ Gizmo & BBox thao tác layer */}
          <div className="viewer-tool-group" title="Công cụ thao tác layer (BBox, Di chuyển, Xoay, Tọa độ)">
            <button
              id="view-toggle-bbox"
              className={`viewer-tool-btn icon${showBbox ? ' active' : ''}`}
              title={`Khung bao BBox (${showBbox ? 'Đang hiện' : 'Đang ẩn'})\n• Bật/Tắt khung viền và 8 điểm mút co dãn layer`}
              onClick={() => view.set({ showBbox: !showBbox })}
              aria-label="Khung bao co dãn BBox"
            >
              <IconBoundingBox width={14} height={14} />
            </button>
            <button
              id="view-toggle-translate"
              className={`viewer-tool-btn icon${showTranslate ? ' active' : ''}`}
              title={`Trục di chuyển XYZ (${showTranslate ? 'Đang hiện' : 'Đang ẩn'})\n• Kéo mũi tên XYZ để dời vị trí\n• Phím W để bật/tắt nhanh`}
              onClick={() => view.set({ showTranslate: !showTranslate })}
              aria-label="Trục di chuyển XYZ"
            >
              <IconAxisMove width={14} height={14} />
            </button>
            <button
              id="view-toggle-rotate"
              className={`viewer-tool-btn icon${showRotate ? ' active' : ''}`}
              title={`Vòng xoay góc 3D (${showRotate ? 'Đang hiện' : 'Đang ẩn'})\n• Kéo vòng tròn để xoay nghiêng\n• Phím E để bật/tắt nhanh`}
              onClick={() => view.set({ showRotate: !showRotate })}
              aria-label="Vòng xoay góc 3D"
            >
              <IconAxisRotate width={14} height={14} />
            </button>
            <button
              id="view-toggle-readout"
              className={`viewer-tool-btn icon${showReadout ? ' active' : ''}`}
              title={`Thông số tọa độ P/R (${showReadout ? 'Đang hiện' : 'Đang ẩn'})\n• Bật/Tắt hiển thị vị trí (P) và góc xoay (R) của layer`}
              onClick={() => view.set({ showReadout: !showReadout })}
              aria-label="Thông số tọa độ P/R"
            >
              <IconReadout width={14} height={14} />
            </button>
          </div>

          {/* Nhóm 4: Hỗ trợ hiển thị không gian 3D */}
          {showEd && (
            <>
              <span className="viewer-tool-sep" />
              <div className="viewer-tool-group">
                <button
                  id="view-path"
                  className={`viewer-tool-btn icon${view.showPath ? ' active' : ''}`}
                  title="Hiện đường bay camera"
                  onClick={() => view.set({ showPath: !view.showPath })}
                >
                  <IconRoute width={14} height={14} />
                </button>
                <button
                  id="view-camera-only"
                  className={`viewer-tool-btn icon${view.cameraOnly ? ' active' : ''}`}
                  title="Chỉ hiện nội dung camera đang thấy (xem trước cơ chế streaming — cảnh ngoài khung chỉ là khung viền)"
                  onClick={() => view.set({ cameraOnly: !view.cameraOnly })}
                >
                  <IconEye width={14} height={14} />
                </button>
                <button
                  id="view-focus"
                  className="viewer-tool-btn icon"
                  title="Focus vùng chọn (Phím F)"
                  onClick={() => useView.getState().requestFocus('selection')}
                >
                  <IconFocus width={14} height={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
