import { memo } from 'react'
import { assetStore } from '../../../project/assets'
import type { ProjectedLayer2D, ShotStageBox } from './animateCameraMath'

export function getLayer2DFilterStyle(layer: ProjectedLayer2D, scalePx = 1): string | undefined {
  const filters: string[] = []
  let brightness = 1
  if (layer.caveDarkness && layer.caveDarkness > 0.01) {
    brightness *= Math.max(0.08, 1 - layer.caveDarkness * 0.85)
  }
  if (layer.lightBoost && layer.lightBoost > 0.01) {
    brightness *= 1 + Math.min(0.65, layer.lightBoost * 0.34)
  }
  if (layer.vlight && layer.vlight.intensity > 0.01) {
    brightness *= 1 + Math.min(0.85, layer.vlight.intensity * 0.42)
  }
  if (Math.abs(brightness - 1) > 0.02) {
    filters.push(`brightness(${brightness.toFixed(2)})`)
  }
  if (layer.vlight && layer.vlight.intensity > 0.02) {
    const r = Math.max(3, Math.min(26, Math.round(13 * scalePx * Math.min(1.8, layer.vlight.intensity))))
    filters.push(`drop-shadow(0 0 ${r}px ${layer.vlight.color})`)
  }
  if (layer.glow && layer.glow.intensity > 0.05) {
    const r = Math.max(2, Math.min(20, Math.round(layer.glow.thickness * scalePx)))
    filters.push(`drop-shadow(0 0 ${r}px ${layer.glow.color})`)
  }
  return filters.length > 0 ? filters.join(' ') : undefined
}

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
  const surfOpacity = Math.max(0.22, Math.min(0.88, intensity * 0.64))
  const haloOpacity = Math.max(0.20, Math.min(0.90, intensity * 0.68))
  const reachPct = layer.vlight
    ? Math.max(52, Math.min(98, Math.round(layer.vlight.radiusRatio * 78)))
    : 74

  const coneDeg = layer.vlight?.coneAngleDeg ?? 360
  const beamDeg = layer.vlight?.beamAngleDeg ?? 0
  const isCone = coneDeg < 350
  const halfCone = Math.max(12, Math.min(170, coneDeg * 0.5))
  // Engine 0° = Right (+X), 90° = Up (+Y); CSS conic-gradient 0deg = Up (+Y), 90deg = Right (+X)
  const cssBeamDeg = 90 - beamDeg
  const startDeg = Math.round(cssBeamDeg - halfCone)

  const pUPct = layer.portal ? Math.round(layer.portal.centerU * 100) : 50
  const pVPct = layer.portal ? Math.round((1 - layer.portal.centerV) * 100) : 55
  const pRxPct = layer.portal ? Math.max(15, Math.min(85, Math.round(layer.portal.rxU * 100))) : 35
  const pRyPct = layer.portal ? Math.max(15, Math.min(85, Math.round(layer.portal.ryV * 100))) : 35
  const portalRescue = layer.portal
    ? Math.min(layer.portal.darkness, ((layer.lightBoost ?? 0) + intensity * 0.55) * 0.72)
    : 0
  const effectivePortalDarkness = layer.portal
    ? Math.max(0, layer.portal.darkness - portalRescue)
    : 0

  const color = layer.vlight?.color ?? '#ff9d3b'
  const radialBg = `radial-gradient(circle at ${uPct}% ${vPct}%, #fffbeb 0%, ${color} 32%, ${color}99 ${Math.round(reachPct * 0.72)}%, transparent ${reachPct}%)`
  const radialCoreBg = `radial-gradient(circle at ${uPct}% ${vPct}%, #fffdf2 0%, ${color}dd 26%, ${color}77 ${Math.round(reachPct * 0.52)}%, transparent ${Math.round(reachPct * 0.68)}%)`
  const coneBg = `conic-gradient(from ${startDeg}deg at ${uPct}% ${vPct}%, transparent 0deg, ${color}cc ${Math.round(halfCone * 0.45)}deg, #fffdf2 ${Math.round(halfCone)}deg, ${color}cc ${Math.round(halfCone * 1.55)}deg, transparent ${Math.round(coneDeg)}deg)`
  const coneMask = `radial-gradient(circle at ${uPct}% ${vPct}%, #000 0%, rgba(0,0,0,0.88) ${Math.round(reachPct * 0.68)}%, transparent ${reachPct}%)`

  return (
    <>
      {hasPortal && layer.portal && effectivePortalDarkness > 0.03 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(${pRxPct}% ${pRyPct}% at ${pUPct}% ${pVPct}%, ${layer.portal.shadowTint} 0%, ${layer.portal.shadowTint}dd 56%, transparent 96%)`,
            opacity: Math.max(0.08, Math.min(0.92, effectivePortalDarkness))
          }}
        />
      )}
      {/* Pass 1: Chiếu sáng bề mặt vật thể bám sát alpha PNG (Đồng bộ 1:1 với WebGL Camera) */}
      {hasVLight && layer.vlight && imgUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: isCone ? `${radialCoreBg}, ${coneBg}` : radialBg,
            WebkitMaskImage: `url("${imgUrl}")`,
            maskImage: `url("${imgUrl}")`,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            opacity: surfOpacity
          }}
        />
      )}
      {/* Pass 2: Quầng sáng / Chùm tia định hướng toả ra không gian xung quanh nguồn sáng */}
      {hasVLight && layer.vlight && !layer.vlight.isReceived && (
        <div
          style={{
            position: 'absolute',
            inset: isCone ? '-55%' : '-38%',
            pointerEvents: 'none',
            backgroundImage: isCone ? `${radialCoreBg}, ${coneBg}` : radialBg,
            WebkitMaskImage: isCone ? coneMask : undefined,
            maskImage: isCone ? coneMask : undefined,
            opacity: haloOpacity
          }}
        />
      )}
    </>
  )
}

interface AnimateShotPlane2DProps {
  box: ShotStageBox
  layers: ProjectedLayer2D[]
  background: string
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
      <div className="anim2d-shot-surface" style={{ background }}>
        {layers.map((layer) => {
          const lw = layer.width * zoom
          const lh = layer.height * zoom
          const lx = screenW / 2 + layer.offsetX * zoom - lw / 2
          const ly = screenH / 2 + layer.offsetY * zoom - lh / 2
          const baseStyle: React.CSSProperties = {
            position: 'absolute',
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
