import { memo } from 'react'
import type { LookSettings } from '@shared/types'
import { assetStore } from '../../../project/assets'
import {
  getLayer2DFilterStyle,
  getLook2DCssFilter,
  type ProjectedLayer2D,
  type ShotStageBox
} from './animateCameraMath'

export function Layer2DLightOverlay({
  layer,
  imgUrl
}: {
  layer: ProjectedLayer2D
  imgUrl?: string
}) {
  const hasPortal = Boolean(layer.portal && layer.portal.darkness > 0.02)
  const hasVLight = Boolean(layer.vlight && layer.vlight.intensity > 0.01)
  if (!hasPortal && !hasVLight) return null

  const uPct = layer.vlight ? Math.round(layer.vlight.originU * 100) : 50
  const vPct = layer.vlight ? Math.round((1 - layer.vlight.originV) * 100) : 50
  const intensity = layer.vlight?.intensity ?? 0
  const intensityReach = Math.max(0.5, Math.min(1.6, 0.58 + Math.pow(intensity, 0.72) * 0.42))

  const isReceived = Boolean(layer.vlight?.isReceived)
  const surfOpacity = Math.max(0.28, Math.min(0.95, Math.pow(intensity, 0.78) * (isReceived ? 0.82 : 0.72)))
  const haloOpacity = Math.max(0.32, Math.min(0.95, Math.pow(intensity, 0.75) * 0.82))

  const haloDiamPct = layer.vlight
    ? Math.max(96, Math.min(220, Math.round(layer.vlight.radiusRatio * 135 * intensityReach)))
    : 125
  const surfRadPct = layer.vlight
    ? Math.max(30, Math.min(98, Math.round(layer.vlight.radiusRatio * 74 * intensityReach)))
    : 58

  const coneDeg = layer.vlight?.coneAngleDeg ?? 360
  const beamDeg = layer.vlight?.beamAngleDeg ?? 0
  const isCone = coneDeg < 350
  const spreadRatio = Math.max(0.22, Math.min(0.96, coneDeg / 180))
  const plumeRyPct = Math.max(14, Math.min(45, Math.round(43 * spreadRatio)))

  const pUPct = layer.portal ? Math.round(layer.portal.centerU * 100) : 50
  const pVPct = layer.portal ? Math.round((1 - layer.portal.centerV) * 100) : 55
  const pRxPct = layer.portal ? Math.max(15, Math.min(85, Math.round(layer.portal.rxU * 100))) : 35
  const pRyPct = layer.portal ? Math.max(15, Math.min(85, Math.round(layer.portal.ryV * 100))) : 35
  const portalRescue = layer.portal
    ? Math.min(layer.portal.darkness, ((layer.lightBoost ?? 0) + intensity * 0.65) * 0.78)
    : 0
  const effectivePortalDarkness = layer.portal
    ? Math.max(0, layer.portal.darkness - portalRescue)
    : 0

  const color = layer.vlight?.color ?? '#ff9d3b'
  // Phân bố Gaussian + Smoothstep đa tầng: tâm trắng ấm đậm đặc (0..14%), sáng rõ vùng giữa (30..50%) và tan mượt về 0 trước khi chạm biên (100%)
  const omniHaloBg = `radial-gradient(50% 50% at 50% 50%, #ffffff 0%, #fffbe8 14%, ${color}f2 30%, ${color}a8 50%, ${color}42 70%, ${color}0d 86%, transparent 100%)`
  const conePlumeBg = `radial-gradient(74% ${plumeRyPct}% at 22% 50%, #ffffff 0%, #fffbe8 14%, ${color}f5 30%, ${color}ad 50%, ${color}45 70%, ${color}0d 88%, transparent 100%)`
  const conePlumeMask = 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.32) 11%, #000 22%, #000 100%)'
  const surfDiamPct = Math.max(72, Math.min(230, surfRadPct * 2))

  const plumeBoxStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${uPct}%`,
    top: `${vPct}%`,
    width: `${isCone ? Math.round(haloDiamPct * 1.28) : haloDiamPct}%`,
    height: `${isCone ? Math.round(haloDiamPct * 1.28) : haloDiamPct}%`,
    transformOrigin: isCone ? '22% 50%' : '50% 50%',
    transform: isCone
      ? `translate(-22%, -50%) rotate(${-beamDeg}deg)`
      : 'translate(-50%, -50%)',
    borderRadius: isCone ? undefined : '50%',
    pointerEvents: 'none',
    backgroundImage: isCone ? conePlumeBg : omniHaloBg,
    WebkitMaskImage: isCone ? conePlumeMask : undefined,
    maskImage: isCone ? conePlumeMask : undefined
  }

  return (
    <>
      {/* Quầng sáng khí quyển đặt phía sau tấm ảnh (zIndex: 0) để tâm sáng rực từ trong ra ngoài mà không làm đục chi tiết gốc */}
      {hasVLight && layer.vlight && !isReceived && (
        <div
          style={{
            ...plumeBoxStyle,
            mixBlendMode: 'screen',
            opacity: haloOpacity,
            zIndex: 0
          }}
        />
      )}
      {/* Bóng tối cửa hang bám sát alpha PNG của vách đá, tuyệt đối không vẽ hình tròn vào vùng trong suốt */}
      {hasPortal && layer.portal && effectivePortalDarkness > 0.03 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(${pRxPct}% ${pRyPct}% at ${pUPct}% ${pVPct}%, ${layer.portal.shadowTint} 0%, ${layer.portal.shadowTint}e6 28%, ${layer.portal.shadowTint}80 56%, ${layer.portal.shadowTint}1f 80%, transparent 100%)`,
            WebkitMaskImage: imgUrl ? `url("${imgUrl}")` : undefined,
            maskImage: imgUrl ? `url("${imgUrl}")` : undefined,
            WebkitMaskSize: imgUrl ? '100% 100%' : undefined,
            maskSize: imgUrl ? '100% 100%' : undefined,
            WebkitMaskRepeat: imgUrl ? 'no-repeat' : undefined,
            maskRepeat: imgUrl ? 'no-repeat' : undefined,
            opacity: Math.max(0.08, Math.min(0.92, effectivePortalDarkness)),
            zIndex: 2
          }}
        />
      )}
      {/* Chiếu sáng bề mặt vật thể bám sát alpha PNG bằng chế độ hòa trộn screen giữ nguyên vân đá/tinh thể */}
      {hasVLight && layer.vlight && imgUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            WebkitMaskImage: `url("${imgUrl}")`,
            maskImage: `url("${imgUrl}")`,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            mixBlendMode: 'screen',
            opacity: surfOpacity,
            zIndex: 2
          }}
        >
          <div
            style={{
              ...plumeBoxStyle,
              width: `${isCone ? Math.round(surfDiamPct * 1.25) : surfDiamPct}%`,
              height: `${isCone ? Math.round(surfDiamPct * 1.25) : surfDiamPct}%`
            }}
          />
        </div>
      )}
    </>
  )
}

interface AnimateShotPlane2DProps {
  box: ShotStageBox
  layers: ProjectedLayer2D[]
  background: string
  look?: LookSettings
  isSelectedShot: boolean
  isActiveCameraShot: boolean
  aimMode: boolean
  zoom: number
  screenLeft: number
  screenTop: number
  onSelectShot: (shotId: string | null) => void
  onStartShotDrag: (e: React.PointerEvent, box: ShotStageBox) => void
  onAimCurrentAtShot: (box: ShotStageBox) => void
  onAddFrameAtShot: (box: ShotStageBox) => void
  onAimAtLayer: (box: ShotStageBox, layer: ProjectedLayer2D) => void
  onDoubleClickSpot: (stageX: number, stageY: number) => void
}

export const AnimateShotPlane2D = memo(function AnimateShotPlane2D({
  box,
  layers,
  background,
  look,
  isSelectedShot,
  isActiveCameraShot,
  aimMode,
  zoom,
  screenLeft,
  screenTop,
  onSelectShot,
  onStartShotDrag,
  onAimCurrentAtShot,
  onAddFrameAtShot,
  onAimAtLayer,
  onDoubleClickSpot
}: AnimateShotPlane2DProps) {
  const screenW = Math.max(8, box.width * zoom)
  const screenH = Math.max(6, box.height * zoom)
  const lookFilter = getLook2DCssFilter(look)
  const vignetteAlpha = look && (look.vignette ?? 0) > 0.02 ? Math.min(0.75, (look.vignette ?? 0) * 0.65) : 0

  const handleSurfaceDoubleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const localX = (e.clientX - rect.left) / zoom - box.width / 2
    const localY = (e.clientY - rect.top) / zoom - box.height / 2
    onDoubleClickSpot(Math.round(box.stageX + localX), Math.round(box.stageY + localY))
  }

  return (
    <div
      className={`anim2d-shot-card${isSelectedShot ? ' selected' : ''}${isActiveCameraShot ? ' cam-here' : ''}${box.visible ? '' : ' hidden-shot'}`}
      style={{
        left: screenLeft,
        top: screenTop,
        width: screenW,
        height: screenH,
        ['--shot-color' as string]: box.color
      }}
      onPointerDown={(e) => {
        if (e.button === 0) onSelectShot(box.shotId)
      }}
      onDoubleClick={handleSurfaceDoubleClick}
    >
      {/* Header gọn gàng của Cảnh 2D (Nhấn giữ để kéo dời Cảnh đồng bộ 2D & 3D) */}
      <div
        className="anim2d-shot-header"
        title={box.name}
        onPointerDown={(e) => onStartShotDrag(e, box)}
      >
        <span className="anim2d-shot-grip" aria-hidden="true">
          ✥
        </span>
        <span className="anim2d-shot-dot" style={{ background: box.color }} />
        <span className="anim2d-shot-title">
          {box.index + 1}. {box.name}
        </span>
        <span className="anim2d-shot-meta">{layers.length} lớp</span>
        <button
          type="button"
          className="anim2d-shot-btn"
          title={`Căn khung Camera đang chọn về chính giữa "${box.name}"`}
          onClick={(e) => {
            e.stopPropagation()
            onAimCurrentAtShot(box)
          }}
        >
          ⊡ Căn tâm
        </button>
        <button
          type="button"
          className="anim2d-shot-add-cam"
          title={`Tạo mốc lộ trình mới lia tới "${box.name}"`}
          onClick={(e) => {
            e.stopPropagation()
            onAddFrameAtShot(box)
          }}
        >
          + Lia tới
        </button>
      </div>

      {/* Mặt phẳng 2D hiển thị đầy đủ các layer xếp chồng của Cảnh */}
      <div
        className="anim2d-shot-surface"
        style={{ background, filter: lookFilter }}
      >
        {vignetteAlpha > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(circle, transparent 48%, rgba(0,0,0,${vignetteAlpha.toFixed(2)}) 100%)`,
              zIndex: 8
            }}
          />
        )}
        {layers.map((layer) => {
          const lw = layer.width * zoom
          const lh = layer.height * zoom
          const lx = screenW / 2 + layer.offsetX * zoom - lw / 2
          const ly = screenH / 2 + layer.offsetY * zoom - lh / 2
          const baseStyle: React.CSSProperties = {
            position: 'absolute',
            isolation: 'isolate',
            left: lx,
            top: ly,
            width: lw,
            height: lh,
            opacity: layer.opacity,
            transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
            pointerEvents: aimMode ? 'auto' : 'none'
          }

          const onLayerClick = aimMode
            ? (e: React.MouseEvent) => {
                e.stopPropagation()
                onAimAtLayer(box, layer)
              }
            : undefined

          if (layer.type === 'image' && layer.assetId) {
            const runtimeAsset = assetStore.get(layer.assetId)
            const imgUrl = runtimeAsset?.url || runtimeAsset?.thumbUrl
            if (!imgUrl) return null
            const filterCss = getLayer2DFilterStyle(layer, Math.max(0.35, zoom * 2.2))
            return (
              <div
                key={layer.id}
                className={`anim2d-layer-item${aimMode ? ' aimable' : ''}`}
                style={baseStyle}
                onClick={onLayerClick}
                title={aimMode ? `🎯 Bấm để ngắm Camera vào "${layer.name}"` : undefined}
              >
                <img
                  src={imgUrl}
                  alt={layer.name}
                  draggable={false}
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill',
                    userSelect: 'none',
                    display: 'block',
                    filter: filterCss
                  }}
                />
                <Layer2DLightOverlay layer={layer} imgUrl={imgUrl} />
                {aimMode && <span className="anim2d-layer-aim-tag">🎯 {layer.name}</span>}
              </div>
            )
          }

          if (layer.type === 'solid') {
            const bg = layer.solidColor2
              ? `linear-gradient(${layer.gradientAngle ?? 180}deg, ${layer.solidColor ?? '#000'}, ${layer.solidColor2})`
              : (layer.solidColor ?? '#000')
            return (
              <div
                key={layer.id}
                className={`anim2d-layer-item${aimMode ? ' aimable' : ''}`}
                style={{ ...baseStyle, background: bg }}
                onClick={onLayerClick}
              />
            )
          }

          if (layer.type === 'text') {
            const fSize = Math.max(8, (layer.fontSize ?? 48) * zoom)
            return (
              <div
                key={layer.id}
                className={`anim2d-layer-item${aimMode ? ' aimable' : ''}`}
                style={{
                  ...baseStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent:
                    layer.align === 'left' ? 'flex-start' : layer.align === 'right' ? 'flex-end' : 'center',
                  color: layer.textColor ?? '#ffffff',
                  fontFamily: layer.font ?? 'Inter, sans-serif',
                  fontSize: fSize,
                  fontWeight: layer.fontWeight ?? 700,
                  whiteSpace: 'pre-wrap',
                  textAlign: layer.align ?? 'center',
                  textShadow: '0 2px 8px rgba(0,0,0,0.65)',
                  lineHeight: 1.15
                }}
                onClick={onLayerClick}
                title={aimMode ? `🎯 Bấm để ngắm Camera vào chữ "${layer.name}"` : undefined}
              >
                {layer.text}
                {aimMode && <span className="anim2d-layer-aim-tag">🎯 {layer.name}</span>}
              </div>
            )
          }

          return null
        })}

        {/* Khi bật chế độ 🎯 Ngắm Layer: hiển thị lưới chọn nhanh Layer 2 cột gọn gàng không đè chữ */}
        {aimMode && layers.length > 0 && (
          <div className="anim2d-aim-pins-overlay">
            {isSelectedShot || isActiveCameraShot ? (
              <div className="anim2d-aim-pins-grid">
                {[...layers].reverse().map((layer) => (
                  <button
                    key={`aim-pin-${layer.id}`}
                    type="button"
                    className="anim2d-layer-pin"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAimAtLayer(box, layer)
                    }}
                    title={`🎯 Bấm để ngắm & lấy nét Camera vào "${layer.name}" (Chiều sâu Z = ${Math.round(layer.zDepth)})`}
                  >
                    <span className="pin-dot">🎯</span>
                    <span className="pin-name">{layer.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                className="anim2d-layer-pin shot-aim-switch"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectShot(box.shotId)
                  onAimCurrentAtShot(box)
                }}
                title={`🎯 Bấm để chuyển Camera sang "${box.name}" và chọn các Layer trong cảnh này`}
              >
                🎯 Ngắm {box.name} ({layers.length} lớp)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
