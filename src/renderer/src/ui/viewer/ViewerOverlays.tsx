import type { Project } from '@shared/types'
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
  IconCube,
  IconEye,
  IconFocus,
  IconReadout,
  IconRoute,
  IconSingle,
  IconSplit
} from '../icons'
import { CustomSelect } from '../controls/CustomSelect'
import { EDITOR_KINDS, type Layout, type Quality } from './viewerLayout'

interface ViewerOverlaysProps {
  view: ViewState
  comp: Project['comp']
  playing: boolean
  fps: number
  fov?: number
  stats: ResidencyStats | null
  rects: Layout
  quality: Quality
  setQuality: React.Dispatch<React.SetStateAction<Quality>>
}

export function ViewerOverlays({
  view,
  comp,
  playing,
  fps,
  fov,
  stats,
  rects,
  quality,
  setQuality
}: ViewerOverlaysProps) {
  const cameraFov = useEditor((s) => s.project.camera.fov)
  const time = useEditor((s) => s.time)
  const currentFov = fov ?? evaluate(cameraFov, time)
  const showEd = !!rects.ed
  const isSplitActive = Boolean(view.split && rects.cam && rects.ed)
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
      {isSplitActive && rects.ed && (
        <div className="pane-divider" style={{ left: rects.ed.x - 1 }} />
      )}

      {/* Dock trạng thái thông số & bộ nhớ (Top-Left HUD) */}
      <div className="viewer-hud">
        <span className="hud-item" title={playing ? 'Đang phát video' : 'Trạng thái sẵn sàng'}>
          <span className={`dot${playing ? ' live' : ''}`} /> {playing ? `${fps} fps` : 'Sẵn sàng'}
        </span>
        <span className="hud-sep" />
        <span className="hud-item" title="Độ phân giải & Tỉ lệ khung hình">
          {comp.width}×{comp.height} · {comp.fps}p
        </span>
        {rects.cam && (
          <>
            <span className="hud-sep" />
            <span className="hud-item" title={`Góc mở ống kính camera: ${currentFov.toFixed(1)}°`}>
              FOV {currentFov.toFixed(1)}°
            </span>
          </>
        )}
        {stats && (
          <>
            <span className="hud-sep" />
            <span
              id="memory-chip"
              className={`hud-item mem${stats.textureMB > stats.budgetMB * 0.85 ? ' warn' : ''}`}
              onClick={() => useView.getState().openDialog('performance')}
              title={`⚡ Texture GPU đang giữ: ${stats.textures} (${stats.pending} đang giải mã)\nNgân sách VRAM: ${stats.budgetMB} MB · LOD bias ${stats.lodBias}\nLayer đang vẽ trong camera: ${stats.visibleLayers}/${stats.totalLayers}\n\n👉 Bấm vào đây để mở Cấu hình Hiệu năng, RAM & VRAM GPU.`}
            >
              ⚡ VRAM {stats.textureMB.toFixed(0)}/{stats.budgetMB} MB · {stats.textures} tex
              {stats.totalShots > 0 && ` · cảnh ${stats.visibleShots}/${stats.totalShots}`}
            </span>
          </>
        )}
      </div>

      {isSplitActive && rects.cam && (
        <span
          className="pane-tag"
          style={{
            left: rects.cam.x + 8,
            top: rects.cam.y + rects.cam.h - 34,
            maxWidth: Math.max(120, rects.cam.w - 16)
          }}
          title="Khung nhìn Camera (Góc render video chính thức)"
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
            left: rects.ed!.x + 12,
            top: rects.ed!.y + rects.ed!.h - 34,
            maxWidth: Math.max(160, rects.ed!.w - 24)
          }}
          title={`Không gian 3D (${kindLabel})\n• Chuột trái: Xoay tự do (Orbit)\n• Shift + Chuột trái / Chuột phải: Di chuyển mặt phẳng (Pan)\n• Cuộn chuột: Phóng to / Thu nhỏ (Zoom)\n• Phím F: Tiêu điểm (Focus vào layer hoặc cảnh đang chọn)\n• Nhấp đúp chuột vào cảnh: Bay camera tới cảnh đó`}
        >
          <span className="pane-tag-badge">
            <IconCube /> 3D · {kindLabel}
          </span>
          <span className="pane-hint">
            Kéo: xoay · Shift: pan · Lăn: zoom · F: focus · Nhấp đúp cảnh: bay tới
          </span>
        </span>
      )}

      {/* Dock công cụ Viewport & Thao tác Layer (Top-Right Tools) */}
      <div className="viewer-tools">
        {/* Nhóm 1: Chuyển đổi góc nhìn chính (khi không chia đôi màn hình) */}
        {!isSplitActive && (
          <>
            <div className="viewer-mode-seg">
              <button
                id="view-camera"
                className={`seg-btn${view.primary === 'camera' ? ' active' : ''}`}
                title="Góc nhìn camera (kết quả render)"
                onClick={() => view.set({ primary: 'camera' })}
              >
                <IconCamera width={12} height={12} /> Camera
              </button>
              <button
                id="view-3d"
                className={`seg-btn${view.primary === 'editor' ? ' active' : ''}`}
                title="Không gian 3D: xem các layer xếp chồng, các cảnh và đường bay camera"
                onClick={() => view.set({ primary: 'editor' })}
              >
                <IconCube width={12} height={12} /> 3D
              </button>
              <button
                id="view-topview"
                className={`seg-btn${view.primary === 'topview' ? ' active' : ''}`}
                title="Sơ đồ độ sâu 2.5D: nhìn từ trên xuống để dàn dựng bố cục cảnh nhanh chóng"
                onClick={() => view.set({ primary: 'topview' })}
              >
                <IconRoute width={12} height={12} /> 2.5D
              </button>
            </div>
            <span className="viewer-tool-sep" />
          </>
        )}

        {/* Nhóm 2: Kiểu nhìn 3D (CustomSelect chuẩn 60fps thay thế native select) */}
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

        {/* Nhóm 3: Các công cụ Gizmo & BBox thao tác layer (Bật/Tắt BBox, Di chuyển, Xoay, Tọa độ) */}
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

        <span className="viewer-tool-sep" />

        {/* Nhóm 5: Chia màn hình & Chất lượng render */}
        <div className="viewer-tool-group">
          <button
            id="view-split"
            className={`viewer-tool-btn icon${view.split ? ' active' : ''}`}
            title={view.split ? '1 view: Phóng to góc nhìn hiện tại' : '2 view: Camera + 3D song song'}
            onClick={() => view.set({ split: !view.split })}
          >
            {view.split ? <IconSingle width={14} height={14} /> : <IconSplit width={14} height={14} />}
          </button>
          <button
            id="quality-toggle"
            className={`viewer-tool-btn quality${quality === 1 ? ' active' : ''}`}
            title={`Chất lượng preview: ${quality === 1 ? 'Full 100% (Sắc nét)' : 'Half 50% (Tiết kiệm)'}`}
            onClick={() => setQuality((q) => (q === 1 ? 0.5 : 1))}
          >
            {quality === 1 ? 'Full' : 'Half'}
          </button>
        </div>
      </div>
    </>
  )
}

