import { useEffect, useRef } from 'react'
import { assetStore } from '../../../project/assets'
import type { ProjectedLayer2D, ShotStageBox } from './animateCameraMath'
import type { CameraActionMode, CameraWaypointItem } from './animateCameraRouteLogic'

interface AnimateCameraFilmstripProps {
  waypoints: CameraWaypointItem[]
  activeFrameIndex: number
  stageLayout: ShotStageBox[]
  layersByShot: Map<string | null, ProjectedLayer2D[]>
  background: string
  showPreview: boolean
  onTogglePreview: () => void
  onSelectWaypoint: (wp: CameraWaypointItem) => void
}

const THUMB_W = 136
const THUMB_H = 76

/**
 * Kẻ phim dọc (Vertical Filmstrip) hiển thị danh sách các Mốc Lộ Trình theo chiều dọc
 * kèm ảnh Preview trực tiếp khung hình cảnh tại từng mốc, số thứ tự lộ trình (#1, #2...),
 * thời điểm (s), thời lượng đoạn (+s) và độ phóng (Zoom %).
 * Có nút Bật/Tắt render ảnh Preview dành cho máy cấu hình yếu.
 */
export function AnimateCameraVerticalFilmstrip({
  waypoints,
  activeFrameIndex,
  stageLayout,
  layersByShot,
  background,
  showPreview,
  onTogglePreview,
  onSelectWaypoint
}: AnimateCameraFilmstripProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const activeCard = el.querySelector<HTMLElement>('.anim2d-film-card.active')
    if (activeCard && typeof activeCard.scrollIntoView === 'function') {
      activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeFrameIndex])

  return (
    <aside
      id="anim2d-filmstrip"
      className={`anim2d-filmstrip${showPreview ? ' with-preview' : ' compact-only'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header Kẻ phim dọc & Toggle Bật/Tắt Preview cho máy yếu */}
      <div className="anim2d-filmstrip-head">
        <div className="filmstrip-title-wrap">
          <span className="filmstrip-ico">🎞</span>
          <span className="filmstrip-title">Lộ trình ({waypoints.length})</span>
        </div>
        <button
          id="anim2d-toggle-filmstrip-preview"
          type="button"
          className={`filmstrip-preview-toggle${showPreview ? ' on' : ' off'}`}
          onClick={onTogglePreview}
          title={
            showPreview
              ? 'Đang BẬT ảnh Preview từng mốc · Bấm để TẮT ảnh nếu máy yếu'
              : 'Đang TẮT ảnh Preview (Chế độ tiết kiệm cho máy yếu) · Bấm để BẬT lại ảnh'
          }
        >
          {showPreview ? '👁 Ảnh: Bật' : '⚡ Ảnh: Tắt'}
        </button>
      </div>

      {/* Danh sách Kẻ phim dọc */}
      <div ref={listRef} className="anim2d-filmstrip-list">
        {waypoints.map((wp, idx) => {
          const isActive = idx === activeFrameIndex
          const box =
            (wp.shotId ? stageLayout.find((b) => b.shotId === wp.shotId) : null) ?? stageLayout[0]
          const shotLayers = layersByShot.get(box?.shotId ?? null) ?? []
          const camRelX = box ? wp.stageX - box.stageX : wp.stageX
          const camRelY = box ? wp.stageY - box.stageY : wp.stageY
          const frameScaleToThumb = THUMB_W / Math.max(120, wp.width)

          return (
            <div key={`film-wp-${idx}-${wp.time}`} className="anim2d-film-step-wrap">
              {/* Nhịp nối thời lượng giữa mốc trước với mốc này */}
              {idx > 0 && (
                <div
                  className="anim2d-film-connector"
                  title={`Thời lượng di chuyển từ Mốc #${idx} sang Mốc #${idx + 1}: +${wp.durationFromPrev.toFixed(1)}s (${wp.ease})`}
                >
                  <span className="connector-line" />
                  <span className="connector-dur">
                    {wp.actionMode === 'cut' ? '⚡ Cắt tức thì' : `↓ +${wp.durationFromPrev.toFixed(1)}s`}
                  </span>
                </div>
              )}

              <div
                id={`anim2d-film-card-${idx + 1}`}
                className={`anim2d-film-card${wp.isFirstOfShot ? ' first-of-shot' : ''}${isActive ? ' active' : ''}`}
                onClick={() => onSelectWaypoint(wp)}
                title={`${wp.isFirstOfShot ? `⚑ MỐC MỞ MÀN CẢNH: ${wp.shotName}\n` : ''}Mốc #${idx + 1} tại ${wp.time.toFixed(1)}s ${idx > 0 ? `(+${wp.durationFromPrev.toFixed(1)}s)` : '(Bắt đầu)'}\nCảnh: ${wp.shotName} · Zoom ${wp.zoomPct}% · ${wp.tagLabel}\n👉 Bấm để chọn mốc này và mở tab Lộ trình chỉnh sửa`}
              >
                {/* Dải lỗ phim điện ảnh 2 bên (Sprocket Holes) */}
                <div className="film-card-top">
                  <span className={`film-card-num${wp.isFirstOfShot ? ' first-of-shot' : ''}`}>
                    {wp.isFirstOfShot ? '⚑ ' : ''}#{idx + 1}
                  </span>
                  {wp.isFirstOfShot && (
                    <span className="film-card-first-tag" title="Mốc camera lộ trình đầu tiên của cảnh này">
                      ⚑ Đầu cảnh
                    </span>
                  )}
                  <span className="film-card-time">{wp.time.toFixed(1)}s</span>
                  {idx > 0 && (
                    <span className="film-card-dur">+{wp.durationFromPrev.toFixed(1)}s</span>
                  )}
                  <span className="film-card-zoom">{wp.zoomPct}%</span>
                </div>

                {/* Khung ảnh Preview trực tiếp góc máy tại mốc (Chỉ render khi Bật Preview) */}
                {showPreview && (
                  <div
                    className="anim2d-film-thumb"
                    style={{
                      width: THUMB_W,
                      height: THUMB_H,
                      background
                    }}
                  >
                    <div
                      className="anim2d-film-thumb-world"
                      style={{
                        width: THUMB_W,
                        height: THUMB_H,
                        transform: wp.roll ? `rotate(${-wp.roll}deg)` : undefined
                      }}
                    >
                      {shotLayers.map((layer) => {
                        const lw = layer.width * frameScaleToThumb
                        const lh = layer.height * frameScaleToThumb
                        const lx = THUMB_W / 2 + (layer.offsetX - camRelX) * frameScaleToThumb - lw / 2
                        const ly = THUMB_H / 2 + (layer.offsetY - camRelY) * frameScaleToThumb - lh / 2

                        const itemStyle: React.CSSProperties = {
                          position: 'absolute',
                          left: lx,
                          top: ly,
                          width: lw,
                          height: lh,
                          opacity: layer.opacity,
                          transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                          pointerEvents: 'none'
                        }

                        if (layer.type === 'image' && layer.assetId) {
                          const runtimeAsset = assetStore.get(layer.assetId)
                          const imgUrl = runtimeAsset?.thumbUrl || runtimeAsset?.url
                          if (!imgUrl) return null
                          return (
                            <img
                              key={layer.id}
                              src={imgUrl}
                              alt=""
                              draggable={false}
                              loading="lazy"
                              style={{
                                ...itemStyle,
                                objectFit: 'fill',
                                display: 'block'
                              }}
                            />
                          )
                        }

                        if (layer.type === 'solid') {
                          const bg = layer.solidColor2
                            ? `linear-gradient(${layer.gradientAngle ?? 180}deg, ${layer.solidColor ?? '#000'}, ${layer.solidColor2})`
                            : (layer.solidColor ?? '#000')
                          return <div key={layer.id} style={{ ...itemStyle, background: bg }} />
                        }

                        if (layer.type === 'text') {
                          const fSize = Math.max(5, (layer.fontSize ?? 48) * frameScaleToThumb)
                          return (
                            <div
                              key={layer.id}
                              style={{
                                ...itemStyle,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: layer.textColor ?? '#ffffff',
                                fontSize: fSize,
                                fontWeight: layer.fontWeight ?? 700,
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden'
                              }}
                            >
                              {layer.text}
                            </div>
                          )
                        }

                        return null
                      })}
                    </div>

                    {/* Khung ngắm cinema mảnh bên trong ảnh preview */}
                    <div className="film-thumb-guides" />
                    <span className={`film-thumb-mode-badge ${wp.tag}`}>{wp.tagLabel}</span>
                  </div>
                )}

                {/* Dòng thông tin Cảnh & Trạng thái dưới chân thẻ phim */}
                <div className="film-card-bottom">
                  <span className="film-shot-dot" style={{ background: wp.shotColor }} />
                  <span className="film-shot-name">{wp.shotName}</span>
                  {!showPreview && (
                    <span className={`film-compact-tag ${wp.tag}`}>{wp.tagLabel}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

interface AnimateCameraProFooterBarProps {
  activeFrame: CameraWaypointItem | undefined
  waypoints: CameraWaypointItem[]
  onSelectWaypoint: (wp: CameraWaypointItem) => void
  onQuickActionMode: (mode: CameraActionMode) => void
  onEstablishCenter100: () => void
}

/**
 * Thanh công cụ Động tác Quay Chuyên Nghiệp dưới chân bàn dựng 2D:
 * Gọn gàng, đồng nhất, tập trung vào các kỹ thuật quay phim & hoạt hình dùng nhiều nhất
 * (Lia cân bằng, Đẩy cận, Kéo rộng, Dừng ngắm, Toàn cảnh chuẩn 100%, Cắt cảnh).
 */
export function AnimateCameraProFooterBar({
  activeFrame,
  waypoints,
  onSelectWaypoint,
  onQuickActionMode,
  onEstablishCenter100
}: AnimateCameraProFooterBarProps) {
  if (!activeFrame) return null

  const prevWp = activeFrame.index > 0 ? waypoints[activeFrame.index - 1] : null
  const nextWp =
    activeFrame.index + 1 < waypoints.length ? waypoints[activeFrame.index + 1] : null

  return (
    <div className="anim2d-footer">
      {/* Trạng thái mốc đang chọn & Nút lùi/tiến nhanh */}
      <div className="anim2d-footer-current">
        <button
          type="button"
          className="footer-nav-btn"
          disabled={!prevWp}
          onClick={() => prevWp && onSelectWaypoint(prevWp)}
          title="Lùi về mốc trước"
        >
          ◀
        </button>
        <div
          className="footer-active-pill"
          title={`Mốc #${activeFrame.index + 1} (${activeFrame.time.toFixed(1)}s) · Cảnh: ${activeFrame.shotName}`}
        >
          <span className="pill-idx">Mốc #{activeFrame.index + 1}</span>
          <span className="pill-time">{activeFrame.time.toFixed(1)}s</span>
          {activeFrame.index > 0 && (
            <span className="pill-dur">+{activeFrame.durationFromPrev.toFixed(1)}s</span>
          )}
        </div>
        <button
          type="button"
          className="footer-nav-btn"
          disabled={!nextWp}
          onClick={() => nextWp && onSelectWaypoint(nextWp)}
          title="Tiến tới mốc tiếp theo"
        >
          ▶
        </button>
      </div>

      {/* Các Góc quay & Động tác Chuyên gia Phim / Hoạt hình thông dụng nhất */}
      <div
        className="anim2d-footer-modes"
        title="Chọn kiểu động tác máy quay chuyên nghiệp cho Mốc đang chọn"
      >
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'pan' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('pan')}
          title="Lia cân bằng (Smooth Pan / Tracking): Lia máy mượt mà theo phương ngang/dọc, giữ đường chân trời thẳng 0°"
        >
          ↔ Lia cân bằng
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'push-in' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('push-in')}
          title="Đẩy cận (Push-in / Dolly In): Thu hẹp khung ngắm đẩy cận vào chủ thể để nhấn mạnh cảm xúc"
        >
          🔍+ Đẩy cận
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'pull-out' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('pull-out')}
          title="Kéo rộng (Pull-out / Reveal): Mở rộng khung ngắm để hé lộ toàn cảnh không gian xung quanh"
        >
          🔍- Kéo rộng
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'hold' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('hold')}
          title="Dừng ngắm (Camera Hold): Giữ nguyên khung hình của mốc trước để khán giả kịp cảm nhận bối cảnh"
        >
          ⏸ Dừng ngắm
        </button>
        <button
          type="button"
          className="mode-chip"
          onClick={onEstablishCenter100}
          title="Khung chuẩn Toàn cảnh (Establishing Shot 100%): Căn máy về chính giữa cảnh hiện tại với cỡ chuẩn 100%"
        >
          ⊡ Chuẩn 100%
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'cut' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('cut')}
          title="Cắt cảnh tức thì (Jump Cut): Đổi thẳng sang góc máy mới mà không lia máy ở giữa"
        >
          ⚡ Cắt cảnh
        </button>
      </div>
    </div>
  )
}
