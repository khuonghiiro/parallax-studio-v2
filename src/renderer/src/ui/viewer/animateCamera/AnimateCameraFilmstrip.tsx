import { focusCameraWaypoint } from './cameraWaypointFocus'
import { memo, useEffect, useRef } from 'react'
import type { LookSettings } from '@shared/types'
import { assetStore } from '../../../project/assets'
import {
  getLayer2DFilterStyle,
  getLook2DCssFilter,
  type ProjectedLayer2D,
  type ShotStageBox
} from './animateCameraMath'
import type { CameraActionMode, CameraWaypointItem } from './animateCameraRouteLogic'
import { Layer2DLightOverlay } from './AnimateShotPlane2D'

interface AnimateCameraFilmstripProps {
  waypoints: CameraWaypointItem[]
  activeFrameIndex: number
  stageLayout: ShotStageBox[]
  layersByShot: Map<string | null, ProjectedLayer2D[]>
  layersByWaypoint?: ProjectedLayer2D[][]
  background: string
  look?: LookSettings
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
export const AnimateCameraVerticalFilmstrip = memo(function AnimateCameraVerticalFilmstrip({
  waypoints,
  activeFrameIndex,
  stageLayout,
  layersByShot,
  layersByWaypoint,
  background,
  look,
  showPreview,
  onTogglePreview,
  onSelectWaypoint
}: AnimateCameraFilmstripProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const lookFilter = getLook2DCssFilter(look)
  const vignetteAlpha = look && (look.vignette ?? 0) > 0.02 ? Math.min(0.75, (look.vignette ?? 0) * 0.65) : 0

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const activeCard = el.querySelector<HTMLElement>('.anim2d-film-card.active')
    if (activeCard && typeof activeCard.scrollIntoView === 'function') {
      activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeFrameIndex, showPreview])

  if (!showPreview) return <button id="anim2d-toggle-filmstrip-preview" type="button"
    className="filmstrip-collapsed-toggle" data-mcp-region="viewer_route"
    aria-expanded={false} onClick={onTogglePreview} title="Hiện danh sách mốc lộ trình camera">Lộ trình</button>

  return (
    <aside
      id="anim2d-filmstrip"
      data-mcp-region="viewer_route"
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
          aria-expanded={showPreview}
          title={
            showPreview
              ? 'Ẩn danh sách lộ trình để mở rộng bàn dựng'
              : 'Đang TẮT ảnh Preview (Chế độ tiết kiệm cho máy yếu) · Bấm để BẬT lại ảnh'
          }
        >
          {showPreview ? 'Ẩn' : 'Lộ trình'}
        </button>
      </div>

      {/* Danh sách Kẻ phim dọc */}
      <div ref={listRef} className="anim2d-filmstrip-list">
        {waypoints.map((wp, idx) => {
          const isActive = idx === activeFrameIndex
          const box =
            (wp.shotId ? stageLayout.find((b) => b.shotId === wp.shotId) : null) ?? stageLayout[0]
          const shotLayers =
            layersByWaypoint?.[idx] ?? layersByShot.get(box?.shotId ?? null) ?? []
          const camRelX = box ? wp.stageX - box.stageX : wp.stageX
          const camRelY = box ? wp.stageY - box.stageY : wp.stageY
          const frameScaleX = THUMB_W / Math.max(1, wp.width)
          const frameScaleY = THUMB_H / Math.max(1, wp.height)
          const frameScaleToThumb = frameScaleY
          const prevWp = idx > 0 ? waypoints[idx - 1] : null
          const dispDur = prevWp ? prevWp.stepDuration : wp.stepDuration

          return (
            <div key={`film-wp-${idx}-${wp.time}`} className="anim2d-film-step-wrap">
              {/* Nhịp nối thời lượng giữa mốc trước với mốc này */}
              {idx > 0 && (
                <div
                  className="anim2d-film-connector"
                  title={`Chuyển sang Mốc #${wp.displayLabel} tại ${wp.time.toFixed(1)}s (${wp.ease})`}
                >
                  <span className="connector-line" />
                  <span className="connector-dur">
                    {wp.actionMode === 'cut'
                      ? '⚡ Cắt tức thì'
                      : `↓ ${dispDur.toFixed(1)}s (@${wp.time.toFixed(1)}s)`}
                  </span>
                </div>
              )}

              <div
                id={`anim2d-film-card-${idx + 1}`}
                className={`anim2d-film-card${wp.isFirstOfShot ? ' first-of-shot' : ''}${isActive ? ' active' : ''}`}
                onClick={e => { if (focusCameraWaypoint(e, wp.index)) onSelectWaypoint(wp) }}
                title={`${wp.isFirstOfShot ? `⚑ MỐC MỞ MÀN CẢNH: ${wp.shotName}\n` : ''}Mốc #${wp.displayLabel} (@${wp.time.toFixed(1)}s · Thời lượng chuyển: ${dispDur.toFixed(1)}s)\nCảnh: ${wp.shotName} · Zoom ${wp.zoomPct}% · ${wp.tagLabel}\n👉 Bấm để chọn mốc này và mở tab Lộ trình chỉnh sửa`}
              >
                {/* Dải tiêu đề trên cùng của thẻ phim (Căn chỉnh chuẩn 1 dòng gọn gàng) */}
                <div className="film-card-top">
                  <span className={`film-card-num${wp.isFirstOfShot ? ' first-of-shot' : ''}`}>
                    #{wp.displayLabel}
                  </span>
                  {wp.isFirstOfShot && (
                    <span className="film-card-first-tag" title="Mốc camera lộ trình đầu tiên của cảnh này">
                      ⚑ Đầu cảnh
                    </span>
                  )}
                  <span className="film-card-time">{wp.time.toFixed(1)}s</span>
                  <span className="film-card-dur">{idx === 0 ? 'Gốc' : `${dispDur.toFixed(1)}s`}</span>
                  <span className="film-card-zoom">{wp.zoomPct}%</span>
                </div>

                {/* Khung ảnh Preview trực tiếp góc máy tại mốc (Chỉ render khi Bật Preview) */}
                {showPreview && (
                  <div
                    className="anim2d-film-thumb"
                    style={{
                      width: THUMB_W,
                      height: THUMB_H,
                      background,
                      filter: lookFilter
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
                        const pFactor = 1483.64 / Math.max(80, 1483.64 + layer.zDepth)
                        const lw = layer.width * frameScaleX
                        const lh = layer.height * frameScaleY
                        const lx = THUMB_W / 2 + (layer.offsetX - camRelX * pFactor) * frameScaleX - lw / 2
                        const ly = THUMB_H / 2 + (layer.offsetY - camRelY * pFactor) * frameScaleY - lh / 2

                        const itemStyle: React.CSSProperties = {
                          position: 'absolute',
                          isolation: 'isolate',
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
                          const filterCss = getLayer2DFilterStyle(layer, 0.45)
                          return (
                            <div key={layer.id} style={itemStyle}>
                              <img
                                src={imgUrl}
                                alt=""
                                draggable={false}
                                loading="lazy"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'fill',
                                  display: 'block',
                                  filter: filterCss
                                }}
                              />
                              <Layer2DLightOverlay layer={layer} imgUrl={imgUrl} />
                            </div>
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
                    {vignetteAlpha > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          pointerEvents: 'none',
                          background: `radial-gradient(circle, transparent 48%, rgba(0,0,0,${vignetteAlpha.toFixed(2)}) 100%)`,
                          zIndex: 4
                        }}
                      />
                    )}
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
})

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
export const AnimateCameraProFooterBar = memo(function AnimateCameraProFooterBar({
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
  const activeDispDur = prevWp ? prevWp.stepDuration : activeFrame.stepDuration

  return (
    <div className="anim2d-footer">
      {/* Trạng thái mốc đang chọn & Nút lùi/tiến nhanh */}
      <div className="anim2d-footer-current">
        <button
          type="button"
          className="footer-nav-btn"
          disabled={!prevWp}
          onClick={e => { if (prevWp && focusCameraWaypoint(e, prevWp.index)) onSelectWaypoint(prevWp) }}
          title="Lùi về mốc trước"
        >
          ◀
        </button>
        <div
          className="footer-active-pill"
          title={`Mốc #${activeFrame.displayLabel} (@${activeFrame.time.toFixed(1)}s · Thời lượng chuyển: ${activeDispDur.toFixed(1)}s) · Cảnh: ${activeFrame.shotName}`}
        >
          <span className="pill-idx">Mốc #{activeFrame.displayLabel}</span>
          <span className="pill-time">{activeFrame.time.toFixed(1)}s</span>
          <span className="pill-dur">{prevWp ? `${activeDispDur.toFixed(1)}s` : 'Gốc'}</span>
        </div>
        <button
          type="button"
          className="footer-nav-btn"
          disabled={!nextWp}
          onClick={e => { if (nextWp && focusCameraWaypoint(e, nextWp.index)) onSelectWaypoint(nextWp) }}
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
          title="Lia cân bằng (Smooth Pan / Tracking): Giữ đường chân trời thẳng 0°"
        >
          ↔ Lia
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'push-in' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('push-in')}
          title="Đẩy cận (Push-in / Dolly In)"
        >
          🔍+ Cận
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'pull-out' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('pull-out')}
          title="Kéo rộng (Pull-out / Reveal)"
        >
          🔍- Rộng
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'hold' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('hold')}
          title="Dừng ngắm (Camera Hold)"
        >
          ⏸ Dừng
        </button>
        <button
          type="button"
          className="mode-chip"
          onClick={onEstablishCenter100}
          title="Khung chuẩn Toàn cảnh (100%)"
        >
          ⊡ 100%
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'cut' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('cut')}
          title="Cắt cảnh tức thì (Jump Cut)"
        >
          ⚡ Cắt
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'whip-pan' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('whip-pan')}
          title="Lia vút tốc độ cao (Whip Pan)"
        >
          💨 Vút
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'crane-up' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('crane-up')}
          title="Cần cẩu nâng lên (Crane Up)"
        >
          ⤴ Cần cẩu
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'hero-low' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('hero-low')}
          title="Góc thấp Anh hùng (Hero Low Angle)"
        >
          🦸 Hùng vĩ
        </button>
        <button
          type="button"
          className={`mode-chip${activeFrame.actionMode === 'corkscrew' ? ' active' : ''}`}
          onClick={() => onQuickActionMode('corkscrew')}
          title="Xoáy cận 3D (Corkscrew)"
        >
          🌀 Xoáy 3D
        </button>
      </div>
    </div>
  )
})
