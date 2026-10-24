import React, { useRef, useState } from 'react'
import type { DepthPortalConfig, LayerVirtualLight } from '@shared/types'

interface VirtualLightInteractivePadProps {
  imageUrl?: string | null
  layerName?: string
  vlight: LayerVirtualLight
  isLightEnabled: boolean
  portal: DepthPortalConfig
  isPortalEnabled: boolean
  onPatchLight: (patch: Partial<LayerVirtualLight>, mergeKey?: string) => void
  onPatchPortal: (patch: Partial<DepthPortalConfig>, mergeKey?: string) => void
}

type DragTarget = 'light_origin' | 'light_aim' | 'portal_center' | 'portal_radius'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export function VirtualLightInteractivePad({
  imageUrl,
  layerName,
  vlight,
  isLightEnabled,
  portal,
  isPortalEnabled,
  onPatchLight,
  onPatchPortal
}: VirtualLightInteractivePadProps) {
  const padRef = useRef<HTMLDivElement | null>(null)
  const [activePrimary, setActivePrimary] = useState<'light' | 'portal'>(
    isLightEnabled ? 'light' : 'portal'
  )
  const [dragging, setDragging] = useState<DragTarget | null>(null)

  const primaryMode =
    isLightEnabled && isPortalEnabled
      ? activePrimary
      : isLightEnabled
        ? 'light'
        : 'portal'

  const lightU = clamp(vlight.originUV?.[0] ?? 0.5, 0, 1)
  const lightV = clamp(vlight.originUV?.[1] ?? 0.5, 0, 1)
  const coneDeg = clamp(vlight.coneAngleDeg ?? 360, 15, 360)
  const isCone = vlight.kind === 'flashlight' || coneDeg < 350
  const beamDeg = vlight.beamAngleDeg ?? (vlight.kind === 'flashlight' ? 0 : 90)
  const beamRad = (beamDeg * Math.PI) / 180

  const portalU = clamp(portal.centerUV?.[0] ?? 0.5, 0.05, 0.95)
  const portalV = clamp(portal.centerUV?.[1] ?? 0.42, 0.05, 0.95)
  const portalRx = clamp(
    Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : (portal.radiusUV ?? 0.28),
    0.05,
    0.8
  )
  const portalRy = clamp(
    Array.isArray(portal.radiusUV) ? portal.radiusUV[1] : (portal.radiusUV ?? 0.34),
    0.05,
    0.8
  )
  const archShape = portal.archShape ?? 'arch'

  // Aim handle position in pad normalized coords (x: 0..1 left-right, y: 0..1 top-bottom)
  const aimDistUV = 0.28
  const aimU = clamp(lightU + Math.cos(beamRad) * aimDistUV, 0.04, 0.96)
  const aimV = clamp(lightV + Math.sin(beamRad) * aimDistUV, 0.04, 0.96)

  const applyPointerAt = (clientX: number, clientY: number, target: DragTarget): void => {
    const el = padRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const normX = clamp((clientX - rect.left) / rect.width, 0, 1)
    const normY = clamp((clientY - rect.top) / rect.height, 0, 1)
    const u = round2(normX)
    const v = round2(1 - normY)

    if (target === 'light_origin') {
      onPatchLight({ originUV: [u, v] }, 'pad-light-origin')
    } else if (target === 'light_aim') {
      const du = normX - lightU
      const dv = 1 - normY - lightV
      if (Math.hypot(du, dv) > 0.015) {
        const deg = Math.round((Math.atan2(dv, du) * 180) / Math.PI)
        onPatchLight(
          {
            beamAngleDeg: deg,
            coneAngleDeg: coneDeg >= 350 ? 60 : coneDeg
          },
          'pad-light-aim'
        )
      }
    } else if (target === 'portal_center') {
      onPatchPortal(
        { centerUV: [clamp(u, 0.05, 0.95), clamp(v, 0.05, 0.95)] },
        'pad-portal-center'
      )
    } else if (target === 'portal_radius') {
      const rx = round2(clamp(Math.abs(normX - portalU), 0.06, 0.75))
      const ry = round2(clamp(Math.abs(1 - normY - portalV), 0.06, 0.75))
      onPatchPortal({ radiusUV: [rx, ry] }, 'pad-portal-radius')
    }
  }

  const startDrag = (e: React.PointerEvent, target: DragTarget): void => {
    e.stopPropagation()
    e.preventDefault()
    const el = padRef.current
    if (!el) return
    setDragging(target)
    if (target === 'light_origin' || target === 'light_aim') setActivePrimary('light')
    else setActivePrimary('portal')
    applyPointerAt(e.clientX, e.clientY, target)

    const onMove = (ev: PointerEvent): void => {
      applyPointerAt(ev.clientX, ev.clientY, target)
    }
    const onUp = (): void => {
      setDragging(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Build SVG cone path in 100x100 viewBox
  const lx100 = lightU * 100
  const ly100 = (1 - lightV) * 100
  const halfConeRad = ((coneDeg * 0.5) * Math.PI) / 180
  const coneLen = Math.min(82, Math.max(26, (vlight.radius / 950) * 65))
  const a1 = -beamRad - halfConeRad
  const a2 = -beamRad + halfConeRad
  const x1 = lx100 + Math.cos(a1) * coneLen
  const y1 = ly100 + Math.sin(a1) * coneLen
  const x2 = lx100 + Math.cos(a2) * coneLen
  const y2 = ly100 + Math.sin(a2) * coneLen
  const largeArc = coneDeg > 180 ? 1 : 0
  const conePath = `M ${lx100.toFixed(1)} ${ly100.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${coneLen.toFixed(1)} ${coneLen.toFixed(1)} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`

  const borderRadiusStyle =
    archShape === 'arch'
      ? '50% 50% 14% 14% / 62% 62% 12% 12%'
      : archShape === 'circle'
        ? '50%'
        : '50% / 50%'

  return (
    <div
      className="vlight-interactive-pad-wrap"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        marginBottom: 8,
        padding: 6,
        borderRadius: 6,
        background: 'var(--bg-2)',
        border: '1px solid var(--line-soft)'
      }}
    >
      {/* Header & Mode Switch */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          fontSize: 10,
          color: 'var(--text-dim)'
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          🎯 Khung Chỉnh 2.5D
        </span>
        {isLightEnabled && isPortalEnabled ? (
          <div style={{ display: 'flex', gap: 3 }}>
            <button
              type="button"
              className={`btn sm ${primaryMode === 'light' ? 'primary' : 'ghost'}`}
              style={{ padding: '1px 5px', fontSize: 9.5 }}
              onClick={() => setActivePrimary('light')}
              title="Nhấp lên nền khung để đặt tâm Ánh sáng ảo"
            >
              🕯️ Tâm Đèn
            </button>
            <button
              type="button"
              className={`btn sm ${primaryMode === 'portal' ? 'primary' : 'ghost'}`}
              style={{ padding: '1px 5px', fontSize: 9.5 }}
              onClick={() => setActivePrimary('portal')}
              title="Nhấp lên nền khung để đặt tâm Cửa hang"
            >
              🕳️ Cửa Hang
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 9.5 }}>
            {isLightEnabled ? 'Kéo 🕯️ tâm đèn / 🎯 hướng tia' : 'Kéo 🕳️ tâm hang / ⤡ cỡ vòm'}
          </span>
        )}
      </div>

      {/* Interactive 2D Stage */}
      <div
        ref={padRef}
        onPointerDown={(e) =>
          startDrag(e, primaryMode === 'light' ? 'light_origin' : 'portal_center')
        }
        style={{
          position: 'relative',
          width: '100%',
          height: 128,
          borderRadius: 5,
          overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'crosshair',
          background:
            'repeating-conic-gradient(var(--bg-3) 0% 25%, var(--bg-1) 0% 50%) 50% / 14px 14px',
          border: '1px solid var(--line)',
          userSelect: 'none',
          touchAction: 'none'
        }}
        title="Nhấp hoặc kéo trực tiếp trên ảnh để đặt vị trí Tâm sáng, Hướng chiếu hoặc Cửa hang"
      >
        {/* Layer thumbnail backdrop */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={layerName ?? 'layer'}
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              filter:
                isLightEnabled && (vlight.ambientDim ?? 0) > 0.02
                  ? `brightness(${Math.max(0.35, 1 - (vlight.ambientDim ?? 0.25) * 0.65).toFixed(2)})`
                  : undefined
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: 'var(--text-faint)',
              pointerEvents: 'none'
            }}
          >
            {layerName ?? 'Khung UV Layer (0..1)'}
          </div>
        )}

        {/* Cave Depth Portal Visual Overlay */}
        {isPortalEnabled && (
          <>
            <div
              style={{
                position: 'absolute',
                left: `${(portalU - portalRx) * 100}%`,
                top: `${(1 - portalV - portalRy) * 100}%`,
                width: `${portalRx * 200}%`,
                height: `${portalRy * 200}%`,
                borderRadius: borderRadiusStyle,
                background: `radial-gradient(ellipse at 50% 54%, ${portal.shadowTint ?? '#070913'} 0%, rgba(7,9,19,${clamp(portal.darkness * 0.88, 0.15, 0.92).toFixed(2)}) 62%, transparent 100%)`,
                border: '1.5px dashed rgba(165, 148, 249, 0.9)',
                boxShadow: 'inset 0 0 14px rgba(0,0,0,0.85)',
                pointerEvents: 'none'
              }}
            >
              {/* Inner receded minScale preview */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(1 - portal.minScale) * 50}%`,
                  top: `${(1 - portal.minScale) * 55}%`,
                  width: `${portal.minScale * 100}%`,
                  height: `${portal.minScale * 100}%`,
                  borderRadius: borderRadiusStyle,
                  border: '1px dotted rgba(86, 200, 232, 0.65)',
                   pointerEvents: 'none'
                }}
              />
            </div>

            {/* Cave Center Handle */}
            <div
              onPointerDown={(e) => startDrag(e, 'portal_center')}
              title={`Kéo tâm cửa hang UV (${portalU.toFixed(2)}, ${portalV.toFixed(2)})`}
              style={{
                position: 'absolute',
                left: `${portalU * 100}%`,
                top: `${(1 - portalV) * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'rgba(20, 16, 36, 0.92)',
                border: '1.5px solid #a594f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                cursor: 'grab',
                zIndex: 4,
                boxShadow: '0 1px 4px rgba(0,0,0,0.6)'
              }}
            >
              🕳️
            </div>

            {/* Cave Radius Resize Handle */}
            <div
              onPointerDown={(e) => startDrag(e, 'portal_radius')}
              title={`Kéo để chỉnh độ rộng/cao cửa hang Rx=${portalRx.toFixed(2)}, Ry=${portalRy.toFixed(2)}`}
              style={{
                position: 'absolute',
                left: `${clamp(portalU + portalRx * 0.85, 0.04, 0.96) * 100}%`,
                top: `${clamp(1 - portalV + portalRy * 0.75, 0.04, 0.96) * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 16,
                height: 16,
                borderRadius: 4,
                background: '#a594f9',
                color: '#090a10',
                fontWeight: 700,
                fontSize: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'nwse-resize',
                zIndex: 5,
                boxShadow: '0 1px 4px rgba(0,0,0,0.65)'
              }}
            >
              ⤡
            </div>
          </>
        )}

        {/* Virtual Light Visual Overlay */}
        {isLightEnabled && (
          <>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 2
              }}
            >
              <defs>
                <radialGradient id="vlightPadGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={vlight.color} stopOpacity="0.65" />
                  <stop offset="55%" stopColor={vlight.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={vlight.color} stopOpacity="0" />
                </radialGradient>
              </defs>
              {isCone ? (
                <>
                  <path
                    d={conePath}
                    fill={vlight.color}
                    fillOpacity={clamp(0.18 + vlight.intensity * 0.14, 0.15, 0.52)}
                    stroke={vlight.color}
                    strokeWidth="0.7"
                    strokeDasharray="2 1.5"
                  />
                  <line
                    x1={lx100}
                    y1={ly100}
                    x2={aimU * 100}
                    y2={(1 - aimV) * 100}
                    stroke={vlight.color}
                    strokeWidth="0.9"
                  />
                </>
              ) : (
                <circle
                  cx={lx100}
                  cy={ly100}
                  r={coneLen * 0.68}
                  fill="url(#vlightPadGrad)"
                  stroke={vlight.color}
                  strokeOpacity="0.65"
                  strokeWidth="0.6"
                  strokeDasharray="2 2"
                />
              )}
            </svg>

            {/* Light Origin Handle */}
            <div
              onPointerDown={(e) => startDrag(e, 'light_origin')}
              title={`Kéo tâm nguồn sáng UV (${lightU.toFixed(2)}, ${lightV.toFixed(2)})`}
              style={{
                position: 'absolute',
                left: `${lightU * 100}%`,
                top: `${(1 - lightV) * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: vlight.color,
                border: '2px solid #ffffff',
                boxShadow: `0 0 10px ${vlight.color}, 0 1px 4px rgba(0,0,0,0.7)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                cursor: 'grab',
                zIndex: 6
              }}
            >
              {vlight.kind === 'flashlight'
                ? '🔦'
                : vlight.kind === 'bulb'
                  ? '💡'
                  : vlight.kind === 'campfire'
                    ? '🔥'
                    : vlight.kind === 'cave_crystal'
                      ? '🔮'
                      : vlight.kind === 'magic_orb'
                        ? '✨'
                        : '🕯️'}
            </div>

            {/* Spotlight Aim Handle (visible when cone mode or flashlight) */}
            {isCone && (
              <div
                onPointerDown={(e) => startDrag(e, 'light_aim')}
                title={`Kéo để xoay hướng chùm tia đèn (${beamDeg}°)`}
                style={{
                  position: 'absolute',
                  left: `${aimU * 100}%`,
                  top: `${(1 - aimV) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(15, 20, 30, 0.9)',
                  border: `1.5px solid ${vlight.color}`,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  cursor: 'grab',
                  zIndex: 7,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.65)'
                }}
              >
                🎯
              </div>
            )}
          </>
        )}

        {/* Bottom HUD Coordinate Readout */}
        <div
          style={{
            position: 'absolute',
            left: 5,
            bottom: 3,
            right: 5,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9,
            color: '#e6edf8',
            background: 'rgba(10, 14, 24, 0.78)',
            borderRadius: 4,
            padding: '1px 5px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 3
          }}
        >
          {isLightEnabled ? (
            <span>
              🕯️({lightU.toFixed(2)},{lightV.toFixed(2)})
              {isCone ? ` ∠${beamDeg}° Δ${coneDeg}°` : ' 360°'}
            </span>
          ) : (
            <span />
          )}
          {isPortalEnabled ? (
            <span>
              🕳️({portalU.toFixed(2)},{portalV.toFixed(2)}) R({portalRx.toFixed(2)},{portalRy.toFixed(2)})
            </span>
          ) : null}
        </div>
      </div>

      {/* Quick 1-click UV Anchor Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9.5, color: 'var(--text-dim)', marginRight: 1 }}>
          Đặt nhanh:
        </span>
        {[
          { label: '⊙ Giữa', u: 0.5, v: 0.5 },
          { label: '⬆️ Đỉnh', u: 0.5, v: 0.78 },
          { label: '⬇️ Đáy', u: 0.5, v: 0.25 },
          { label: '⬅️ Trái', u: 0.25, v: 0.5 },
          { label: '➡️ Phải', u: 0.75, v: 0.5 }
        ].map((pos) => (
          <button
            key={pos.label}
            type="button"
            className="btn sm ghost"
            style={{ padding: '1px 5px', fontSize: 9.5 }}
            onClick={() => {
              if (primaryMode === 'light') {
                onPatchLight({ originUV: [pos.u, pos.v] })
              } else {
                onPatchPortal({ centerUV: [pos.u, pos.v] })
              }
            }}
          >
            {pos.label}
          </button>
        ))}
      </div>
    </div>
  )
}
