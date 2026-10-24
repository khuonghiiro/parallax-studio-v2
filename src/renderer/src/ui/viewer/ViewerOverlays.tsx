import { ViewTags } from './ViewTags'
import type { ResidencyStats } from '../../engine/SceneRenderer'
import type { EditorViewKind } from '../../engine/EditorCamera'
import { useView, type ViewState } from '../../store/view'
import { useEditor } from '../../store/editor'
import { evaluate } from '../../animation/keyframes'
import {
  IconCamera,
  IconCameraFrustumCull,
  IconCube,
  IconFlightPath3D,
  IconFocusTarget3D,
  IconGizmoBbox,
  IconGizmoRotate3D,
  IconGizmoTranslate3D,
  IconReadout
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
  const kindLabel = EDITOR_KINDS.find((k) => k.id === view.editorKind)?.shortLabel ?? 'Tự do'

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
          <div
            className="pane-divider"
            style={{
              left: rects.stage2d.x - 1,
              top: 32,
              height: 'calc(100% - 32px)'
            }}
          />
          <div
            className="pane-divider-h"
            style={{ top: rects.ed.y - 1, left: 0, width: rects.ed.w }}
          />
        </>
      )}

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
            <IconCamera /> Camera · {visibleLayerRatio} lớp
          </span>
          {selectedLayerName && (
            <span className="pane-hint" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
              🎯 {selectedLayerName}
            </span>
          )}
        </span>
      )}
      {showEd && (
        <span
          className="pane-tag"
          style={{
            left: rects.ed!.x + 8,
            top: rects.ed!.y + rects.ed!.h - 30,
            maxWidth: Math.max(120, rects.ed!.w - 16),
            pointerEvents: 'auto'
          }}
          title={`Không gian 3D (${kindLabel})\n• Giữ chuột trái: Di chuyển mặt phẳng (Pan)\n• Giữ con lăn chuột (hoặc Alt + Chuột trái): Xoay 360° (Orbit)\n• Cuộn chuột: Phóng to / Thu nhỏ (Zoom)\n• Phím F: Tiêu điểm (Focus vào layer hoặc cảnh đang chọn)`}
        >
          <span className="pane-tag-badge">
            <IconCube /> 3D · {kindLabel}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              marginLeft: 4
            }}
          >
            {(['custom', 'front', 'top'] as EditorViewKind[]).map((kind) => {
              const spec = EDITOR_KINDS.find((k) => k.id === kind)
              const active = view.editorKind === kind
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    view.set({ editorKind: kind })
                    useView.setState((s) => ({
                      focus: { kind: 'selection', n: (s.focus?.n ?? 0) + 1 }
                    }))
                  }}
                  style={{
                    height: 18,
                    padding: '0 6px',
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    borderRadius: 4,
                    border: active ? '1px solid var(--accent-cyan)' : '1px solid var(--line)',
                    background: active ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-2)',
                    color: active ? 'var(--accent-cyan)' : 'var(--text-dim)',
                    cursor: 'pointer'
                  }}
                  title={`Chuyển góc nhìn 3D sang: ${spec?.label ?? kind}`}
                >
                  {spec?.shortLabel ?? kind}
                </button>
              )
            })}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                useView.setState((s) => ({
                  focus: { kind: 'all', n: (s.focus?.n ?? 0) + 1 }
                }))
              }}
              style={{
                height: 18,
                padding: '0 6px',
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 4,
                border: '1px solid var(--line)',
                background: 'var(--bg-2)',
                color: 'var(--text)',
                cursor: 'pointer'
              }}
              title="Căn chỉnh lại khung nhìn 3D ôm gọn toàn bộ phân cảnh (Phím F)"
            >
              ⊡ Căn cảnh
            </button>
          </span>
          {!isAnimateSplit && (
            <span className="pane-hint">
              Chuột trái: di chuyển · Giữ con lăn: xoay 360° · Lăn: zoom
            </span>
          )}
        </span>
      )}

      {/* Dock công cụ Viewport & Thao tác Layer (Top Bar Gọn Nhẹ Bằng Icon) */}
      <div className="viewer-tools" data-mcp-region="viewer_tools">
        <ViewTags />
        <span className="viewer-tool-sep" />

        {/* Nhóm 2: Kiểu nhìn 3D (CustomSelect gọn 60fps) */}
        {showEd && (
          <>
            <CustomSelect<EditorViewKind>
              id="view-kind"
              className="viewer-kind-select"
              value={view.editorKind}
              onChange={(val) => view.set({ editorKind: val })}
              options={EDITOR_KINDS.map((k) => ({ value: k.id, label: k.shortLabel }))}
              size="sm"
              title="Chọn góc chiếu không gian 3D (Tự do / Trước / Trên / Trái)"
              dropdownWidth={112}
            />
            <span className="viewer-tool-sep" />
          </>
        )}

        {/* Nhóm 3: Các công cụ Gizmo & BBox thao tác layer */}
        <div className="viewer-tool-group" title="Công cụ thao tác layer (BBox, Di chuyển 3D, Xoay 3D, Tọa độ)">
          <button
            id="view-toggle-bbox"
            className={`viewer-tool-btn icon${showBbox ? ' active' : ''}`}
            title={`Khung bao BBox (${showBbox ? 'Đang hiện' : 'Đang ẩn'})\n• Bật/Tắt khung viền và 8 điểm mút co dãn layer`}
            onClick={() => view.set({ showBbox: !showBbox })}
            aria-label="Khung bao co dãn BBox"
          >
            <IconGizmoBbox width={14} height={14} />
          </button>
          <button
            id="view-toggle-translate"
            className={`viewer-tool-btn icon${showTranslate ? ' active' : ''}`}
            title={`Trục di chuyển 3D XYZ (${showTranslate ? 'Đang hiện' : 'Đang ẩn'})\n• Kéo mũi tên XYZ để dời vị trí\n• Phím W để bật/tắt nhanh`}
            onClick={() => view.set({ showTranslate: !showTranslate })}
            aria-label="Trục di chuyển XYZ"
          >
            <IconGizmoTranslate3D width={14} height={14} />
          </button>
          <button
            id="view-toggle-rotate"
            className={`viewer-tool-btn icon${showRotate ? ' active' : ''}`}
            title={`Vòng xoay Gimbal 3D (${showRotate ? 'Đang hiện' : 'Đang ẩn'})\n• Kéo vòng cầu để xoay nghiêng\n• Phím E để bật/tắt nhanh`}
            onClick={() => view.set({ showRotate: !showRotate })}
            aria-label="Vòng xoay góc 3D"
          >
            <IconGizmoRotate3D width={14} height={14} />
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
                title="Hiện/ẩn đường bay quỹ đạo camera 3D"
                onClick={() => view.set({ showPath: !view.showPath })}
              >
                <IconFlightPath3D width={14} height={14} />
              </button>
              <button
                id="view-camera-only"
                className={`viewer-tool-btn icon${view.cameraOnly ? ' active' : ''}`}
                title="Chỉ hiện nội dung trong hình nón tầm nhìn Camera (Frustum Culling)"
                onClick={() => view.set({ cameraOnly: !view.cameraOnly })}
              >
                <IconCameraFrustumCull width={14} height={14} />
              </button>
              <button
                id="view-focus"
                className="viewer-tool-btn icon"
                title="Focus khung hình vào vùng chọn 3D (Phím F)"
                onClick={() => useView.getState().requestFocus('selection')}
              >
                <IconFocusTarget3D width={14} height={14} />
              </button>
            </div>
          </>
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
