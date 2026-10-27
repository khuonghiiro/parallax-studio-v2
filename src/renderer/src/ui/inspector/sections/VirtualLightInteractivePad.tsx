import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { DepthPortalConfig, LayerVirtualLight } from '@shared/types'
import { computeUnified25DLightAtOffset, hexToRgb01 } from '../../../engine/virtualLight'

interface VirtualLightInteractivePadProps {
  imageUrl?: string | null
  layerName?: string
  layerSize?: [number, number]
  vlight: LayerVirtualLight
  isLightEnabled: boolean
  portal: DepthPortalConfig
  isPortalEnabled: boolean
  onPatchLight: (patch: Partial<LayerVirtualLight>, mergeKey?: string) => void
  onPatchPortal: (patch: Partial<DepthPortalConfig>, mergeKey?: string) => void
}

type DragTarget =
  | 'light_origin'
  | 'light_aim'
  | 'light_curve'
  | 'portal_center'
  | 'portal_radius'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export interface PadFittedBox {
  leftNorm: number
  topNorm: number
  wNorm: number
  hNorm: number
}

/**
 * Tính toán khung tỉ lệ chuẩn 1:1 theo layer gốc (worldW / worldH) bên trong stage.
 * Giữ lề an toàn ngoài khung để người dùng thấy quầng sáng và tay kéo tia sáng chiếu xuyên ra ngoài layer.
 */
export function computePadFittedBox(
  stageW: number,
  stageH: number,
  worldW: number,
  worldH: number,
  maxPadSpan = 0.82
): PadFittedBox {
  const safeStageW = Math.max(80, stageW)
  const safeStageH = Math.max(80, stageH)
  const aspect = Math.max(0.05, Math.min(20, worldW / Math.max(1, worldH)))
  const maxW = safeStageW * maxPadSpan
  const maxH = safeStageH * maxPadSpan

  let boxW = maxW
  let boxH = boxW / aspect
  if (boxH > maxH) {
    boxH = maxH
    boxW = boxH * aspect
  }

  const boxLeft = (safeStageW - boxW) / 2
  const boxTop = (safeStageH - boxH) / 2

  return {
    leftNorm: boxLeft / safeStageW,
    topNorm: boxTop / safeStageH,
    wNorm: boxW / safeStageW,
    hNorm: boxH / safeStageH
  }
}

export function VirtualLightInteractivePad({
  imageUrl,
  layerName,
  layerSize,
  vlight,
  isLightEnabled,
  portal,
  isPortalEnabled,
  onPatchLight,
  onPatchPortal
}: VirtualLightInteractivePadProps) {
  const padRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [activePrimary, setActivePrimary] = useState<'light' | 'portal'>(
    isLightEnabled ? 'light' : 'portal'
  )
  const [dragging, setDragging] = useState<DragTarget | null>(null)
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 320, h: 176 })
  const [naturalSize, setNaturalSize] = useState<[number, number] | null>(null)
  const pendingCoordsRef = useRef<{ clientX: number; clientY: number; target: DragTarget } | null>(null)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    const el = padRef.current
    if (!el) return
    const updateSize = () => {
      const w = el.clientWidth || 320
      const h = el.clientHeight || 176
      setStageSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const primaryMode =
    isLightEnabled && isPortalEnabled
      ? activePrimary
      : isLightEnabled
        ? 'light'
        : 'portal'

  const worldW = Math.max(120, layerSize?.[0] ?? naturalSize?.[0] ?? 960)
  const worldH = Math.max(120, layerSize?.[1] ?? naturalSize?.[1] ?? 540)
  const refSpanPx = Math.max(240, Math.hypot(worldW, worldH) * 0.72)

  const box = useMemo(
    () => computePadFittedBox(stageSize.w, stageSize.h, worldW, worldH, 0.82),
    [stageSize.w, stageSize.h, worldW, worldH]
  )

  const uvToPadPct = (u: number, v: number): [number, number] => {
    const px = (box.leftNorm + u * box.wNorm) * 100
    const py = (box.topNorm + (1 - v) * box.hNorm) * 100
    return [px, py]
  }

  const padNormToUV = (normX: number, normY: number): [number, number] => {
    const u = (normX - box.leftNorm) / box.wNorm
    const v = 1 - (normY - box.topNorm) / box.hNorm
    return [u, v]
  }

  const lightU = clamp(vlight.originUV?.[0] ?? 0.5, -0.2, 1.2)
  const lightV = clamp(vlight.originUV?.[1] ?? 0.5, -0.2, 1.2)
  const coneDeg = clamp(vlight.coneAngleDeg ?? 360, 15, 360)
  const isCone = vlight.kind === 'flashlight' || coneDeg < 350
  const beamDeg = vlight.beamAngleDeg ?? (vlight.kind === 'flashlight' ? -90 : -90)
  const beamRad = (beamDeg * Math.PI) / 180
  const beamCurvature = clamp(vlight.beamCurvature ?? 0, -0.8, 1.0)
  const radiusPx = clamp(vlight.radius ?? 450, 40, 2600)

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

  // Normalized beam length in UV units (can exceed 0..1 when shining across layers)
  const beamLenUV = clamp(radiusPx / refSpanPx, 0.16, 1.15)
  const aimHandleLenUV = clamp(beamLenUV * 0.72, 0.16, 0.68)
  const aimU = lightU + Math.cos(beamRad) * aimHandleLenUV
  const aimV = lightV + Math.sin(beamRad) * aimHandleLenUV

  // Side handle for adjusting beamCurvature / coneAngleDeg
  const halfConeRad = (Math.max(14, Math.min(165, coneDeg * 0.5)) * Math.PI) / 180
  const sideDistUV = clamp(aimHandleLenUV * 0.6, 0.13, 0.48)
  const bowMid = Math.pow(0.6, Math.max(0.35, 1 - beamCurvature * 0.6)) / 0.6
  const curveAngleRad = beamRad + halfConeRad * clamp(bowMid, 0.45, 1.65)
  const curveU = lightU + Math.cos(curveAngleRad) * sideDistUV
  const curveV = lightV + Math.sin(curveAngleRad) * sideDistUV

  // Synchronized 1:1 Shader Canvas Renderer (Throttled via rAF, 96x56 resolution for 60fps responsiveness)
  useEffect(() => {
    let animId: number | null = null
    const canvas = canvasRef.current
    if (!canvas) return

    animId = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const W = 96
      const H = 56
      if (canvas.width !== W) canvas.width = W
      if (canvas.height !== H) canvas.height = H

      const imgData = ctx.createImageData(W, H)
      const data = imgData.data

      const [lr, lg, lb] = hexToRgb01(vlight.color || '#ff9d3b')
      const [sr, sg, sb] = hexToRgb01(portal.shadowTint || '#060812')
      const intensity = isLightEnabled ? clamp(vlight.intensity ?? 1.2, 0, 3) : 0
      const intensityReach = 0.65 + Math.pow(Math.max(intensity, 0.05), 0.65) * 0.42
      const effRadius = Math.max(24, radiusPx * intensityReach)
      const coneCos =
        coneDeg >= 355 ? -1 : Math.cos((clamp(coneDeg, 8, 355) * 0.5 * Math.PI) / 180)
      const bDir: [number, number] = [Math.cos(beamRad), Math.sin(beamRad)]
      const softness = clamp(vlight.softness ?? 0.68, 0.05, 1)
      const ambDim = isLightEnabled ? clamp(vlight.ambientDim ?? 0.22, 0, 0.92) : 0
      const pDark = isPortalEnabled ? clamp(portal.darkness ?? 0.78, 0, 1) : 0
      const pFeather = clamp(portal.feather ?? 0.55, 0.08, 0.98)

      for (let py = 0; py < H; py++) {
        const normY = (py + 0.5) / H
        for (let px = 0; px < W; px++) {
          const normX = (px + 0.5) / W
          const [u, v] = padNormToUV(normX, normY)
          const inLayer = u >= 0 && u <= 1 && v >= 0 && v <= 1

          // Compute cave portal mask inside layer
          let caveAlpha = 0
          if (inLayer && pDark > 0.01) {
            let dx = (u - portalU) / Math.max(0.04, portalRx)
            const dy = (v - portalV) / Math.max(0.04, portalRy)
            if (archShape === 'arch') {
              dx /= 1 - clamp(dy, -0.6, 0.6) * 0.16
              if (dy < 0) dx *= 0.92
            }
            const d = Math.hypot(dx, dy)
            const innerR = Math.max(0.08, 1 - pFeather * 0.88)
            if (d < 1.08) {
              const t = clamp((d - innerR) / Math.max(0.06, 1.05 - innerR), 0, 1)
              const mask = 1 - t * t * (3 - 2 * t)
              caveAlpha = mask * pDark
            }
          }

          // Compute 1:1 physical 2.5D light at this offset (even outside layer bounds!)
          let lightR = 0
          let lightG = 0
          let lightB = 0
          let lightA = 0
          let rescue = 0

          if (intensity > 0.01) {
            const dxPx = (u - lightU) * worldW
            const dyPx = (v - lightV) * worldH
            const evalL = computeUnified25DLightAtOffset(
              dxPx,
              dyPx,
              effRadius,
              intensity,
              coneCos,
              bDir,
              softness,
              beamCurvature
            )
            const surf = inLayer ? evalL.localLightHalo * 0.48 : 0
            const air = evalL.localLightHalo * (inLayer ? 0.52 : 0.72)
            const core = evalL.wickCore * 0.95
            const totalGlow = clamp(surf + air + core, 0, 1.35)
            rescue = clamp(evalL.localLightHalo * 0.85 + evalL.wickCore * 1.2, 0, 0.95)

            // Core shifts toward warm white, matching LAYER_FRAG & VOLUMETRIC_LIGHT_FRAG
            const whiteMix = clamp(evalL.wickCore * 0.72, 0, 0.82)
            lightR = lr * (1 - whiteMix) + whiteMix
            lightG = lg * (1 - whiteMix) + whiteMix * 0.98
            lightB = lb * (1 - whiteMix) + whiteMix * 0.92
            lightA = clamp(totalGlow * 0.86, 0, 0.94)
          }

          // Ambient darkening outside beam on layer + cave portal darkness rescued by light
          const effCaveA = Math.max(0, caveAlpha * (1 - rescue * 0.82))
          const ambDarkA = inLayer ? Math.max(0, ambDim * (1 - rescue) * 0.62) : 0
          const darkA = clamp(Math.max(effCaveA, ambDarkA), 0, 0.92)

          // Blend shadow base + additive light plume
          const outA = clamp(darkA + lightA * (1 - darkA * 0.35), 0, 0.95)
          let outR = 0
          let outG = 0
          let outB = 0
          if (outA > 0.002) {
            const darkWeight = (darkA * (1 - lightA * 0.65)) / outA
            const lightWeight = clamp(1 - darkWeight, 0, 1)
            outR = sr * darkWeight + lightR * lightWeight
            outG = sg * darkWeight + lightG * lightWeight
            outB = sb * darkWeight + lightB * lightWeight
          }

          const idx = (py * W + px) * 4
          data[idx] = Math.round(clamp(outR, 0, 1) * 255)
          data[idx + 1] = Math.round(clamp(outG, 0, 1) * 255)
          data[idx + 2] = Math.round(clamp(outB, 0, 1) * 255)
          data[idx + 3] = Math.round(outA * 255)
        }
      }

      ctx.putImageData(imgData, 0, 0)
    })

    return () => {
      if (animId !== null) cancelAnimationFrame(animId)
    }
  }, [
    isLightEnabled,
    isPortalEnabled,
    vlight.color,
    vlight.intensity,
    vlight.radius,
    vlight.coneAngleDeg,
    vlight.beamAngleDeg,
    vlight.beamCurvature,
    vlight.softness,
    vlight.ambientDim,
    lightU,
    lightV,
    portal.darkness,
    portal.feather,
    portal.shadowTint,
    portalU,
    portalV,
    portalRx,
    portalRy,
    archShape,
    refSpanPx,
    coneDeg,
    beamRad,
    beamCurvature,
    radiusPx,
    box,
    worldW,
    worldH
  ])

  const applyPointerAt = (clientX: number, clientY: number, target: DragTarget): void => {
    const el = padRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const normX = clamp((clientX - rect.left) / rect.width, 0.005, 0.995)
    const normY = clamp((clientY - rect.top) / rect.height, 0.005, 0.995)
    const [rawU, rawV] = padNormToUV(normX, normY)
    const u = round2(clamp(rawU, -0.15, 1.15))
    const v = round2(clamp(rawV, -0.15, 1.15))

    if (target === 'light_origin') {
      onPatchLight({ originUV: [clamp(u, 0, 1), clamp(v, 0, 1)] }, 'pad-light-origin')
    } else if (target === 'light_aim') {
      const du = rawU - lightU
      const dv = rawV - lightV
      const distUV = Math.hypot(du, dv)
      if (distUV > 0.02) {
        const deg = Math.round((Math.atan2(dv, du) * 180) / Math.PI)
        const newRadius = Math.round(clamp((distUV / 0.72) * refSpanPx, 80, 2200))
        onPatchLight(
          {
            beamAngleDeg: deg,
            radius: newRadius,
            coneAngleDeg: coneDeg >= 350 ? 68 : coneDeg
          },
          'pad-light-aim'
        )
      }
    } else if (target === 'light_curve') {
      const du = rawU - lightU
      const dv = rawV - lightV
      const distUV = Math.hypot(du, dv)
      if (distUV > 0.02) {
        const pointerRad = Math.atan2(dv, du)
        let deltaRad = pointerRad - beamRad
        while (deltaRad > Math.PI) deltaRad -= Math.PI * 2
        while (deltaRad < -Math.PI) deltaRad += Math.PI * 2
        const absDeg = clamp(Math.round((Math.abs(deltaRad) * 180) / Math.PI * 2), 18, 175)
        const normDist = clamp(distUV / Math.max(0.15, aimHandleLenUV), 0.25, 1.2)
        const newCurv = round2(clamp((0.68 - normDist) * 1.4, -0.8, 1.0))
        onPatchLight(
          {
            coneAngleDeg: absDeg,
            beamCurvature: newCurv
          },
          'pad-light-curve'
        )
      }
    } else if (target === 'portal_center') {
      onPatchPortal(
        { centerUV: [clamp(u, 0.05, 0.95), clamp(v, 0.05, 0.95)] },
        'pad-portal-center'
      )
    } else if (target === 'portal_radius') {
      const rx = round2(clamp(Math.abs(rawU - portalU), 0.06, 0.75))
      const ry = round2(clamp(Math.abs(rawV - portalV), 0.06, 0.75))
      onPatchPortal({ radiusUV: [rx, ry] }, 'pad-portal-radius')
    }
  }

  const startDrag = (e: React.PointerEvent, target: DragTarget): void => {
    e.stopPropagation()
    e.preventDefault()
    setDragging(target)
    if (target === 'light_origin' || target === 'light_aim' || target === 'light_curve') {
      setActivePrimary('light')
    } else {
      setActivePrimary('portal')
    }
    applyPointerAt(e.clientX, e.clientY, target)

    const onMove = (ev: PointerEvent): void => {
      pendingCoordsRef.current = { clientX: ev.clientX, clientY: ev.clientY, target }
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          if (pendingCoordsRef.current) {
            applyPointerAt(
              pendingCoordsRef.current.clientX,
              pendingCoordsRef.current.clientY,
              pendingCoordsRef.current.target
            )
          }
        })
      }
    }
    const onUp = (): void => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      if (pendingCoordsRef.current) {
        applyPointerAt(
          pendingCoordsRef.current.clientX,
          pendingCoordsRef.current.clientY,
          pendingCoordsRef.current.target
        )
        pendingCoordsRef.current = null
      }
      setDragging(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Build SVG curved beam frame outline in 100x100 viewBox
  const [lxPct, lyPct] = uvToPadPct(lightU, lightV)
  const [aimPctX, aimPctY] = uvToPadPct(aimU, aimV)
  const [curvePctX, curvePctY] = uvToPadPct(curveU, curveV)
  const [pCenterPctX, pCenterPctY] = uvToPadPct(portalU, portalV)
  const [pSizePctX, pSizePctY] = uvToPadPct(
    clamp(portalU + portalRx * 0.85, 0.02, 0.98),
    clamp(portalV - portalRy * 0.78, 0.02, 0.98)
  )

  const buildCurvedBeamSvgPath = (): string => {
    const steps = 12
    const leftPts: [number, number][] = []
    const rightPts: [number, number][] = []
    for (let i = 1; i <= steps; i++) {
      const f = i / steps
      const bow = Math.pow(f, Math.max(0.35, 1 - beamCurvature * 0.6))
      const locHalfA = halfConeRad * clamp(bow / Math.max(0.08, f), 0.35, 1.75)
      const rUV = beamLenUV * 0.78 * f
      const aL = beamRad - locHalfA
      const aR = beamRad + locHalfA
      leftPts.push(uvToPadPct(lightU + Math.cos(aL) * rUV, lightV + Math.sin(aL) * rUV))
      rightPts.push(uvToPadPct(lightU + Math.cos(aR) * rUV, lightV + Math.sin(aR) * rUV))
    }
    const arcPts: [number, number][] = []
    const arcSteps = 14
    const endBow = Math.pow(1, Math.max(0.35, 1 - beamCurvature * 0.6))
    const endHalfA = halfConeRad * clamp(endBow, 0.35, 1.75)
    const endR = beamLenUV * 0.78
    for (let j = 0; j <= arcSteps; j++) {
      const a = beamRad - endHalfA + (endHalfA * 2 * j) / arcSteps
      arcPts.push(uvToPadPct(lightU + Math.cos(a) * endR, lightV + Math.sin(a) * endR))
    }
    const parts = [`M ${lxPct.toFixed(1)} ${lyPct.toFixed(1)}`]
    for (const [x, y] of leftPts) parts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`)
    for (const [x, y] of arcPts) parts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`)
    for (let i = rightPts.length - 1; i >= 0; i--) {
      parts.push(`L ${rightPts[i][0].toFixed(1)} ${rightPts[i][1].toFixed(1)}`)
    }
    parts.push('Z')
    return parts.join(' ')
  }

  const borderRadiusStyle =
    archShape === 'arch'
      ? '50% 50% 14% 14% / 62% 62% 12% 12%'
      : archShape === 'circle'
        ? '50%'
        : '50% / 50%'

  return (
    <div className="vl-pad-card">
      {/* Header Bar */}
      <div className="vl-pad-header">
        <span className="vl-pad-title">
          🎯 Khung Chỉnh 2.5D (Đồng Bộ Camera 1:1)
        </span>
        <div className="vl-pad-badges">
          {isLightEnabled && (
            <span className="vl-badge-light" title="Độ sáng thực tế trên Camera">
              🕯️ {Math.round((vlight.intensity ?? 1) * 100)}%
            </span>
          )}
          {isPortalEnabled && (
            <span className="vl-badge-cave" title="Độ tối vòm hang trên Camera">
              🕳️ {Math.round((portal.darkness ?? 0.8) * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Interactive 2.5D Stage with Shot Margin & Real-Time Shader Canvas */}
      <div
        ref={padRef}
        className="vl-pad-stage"
        onPointerDown={(e) =>
          startDrag(e, primaryMode === 'light' ? 'light_origin' : 'portal_center')
        }
        title="Kéo 🕯️ Tâm đèn, 🎯 Hướng & Độ dài tia, ⌒ Độ cong/góc mở khung sáng, hoặc 🕳️ Tâm & Cỡ cửa hang"
      >
        {/* Layer Bounds Box (khung tỉ lệ thật 1:1 theo layer gốc, không méo, không letterbox lệch UV) */}
        <div
          style={{
            position: 'absolute',
            left: `${box.leftNorm * 100}%`,
            top: `${box.topNorm * 100}%`,
            width: `${box.wNorm * 100}%`,
            height: `${box.hNorm * 100}%`,
            border: '1.5px dashed rgba(255, 255, 255, 0.42)',
            boxShadow: '0 0 10px rgba(0, 0, 0, 0.55)',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 1,
            overflow: 'hidden'
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={layerName ?? 'layer'}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget
                if (img.naturalWidth && img.naturalHeight) {
                  setNaturalSize([img.naturalWidth, img.naturalHeight])
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                pointerEvents: 'none'
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: 'rgba(226, 232, 240, 0.65)'
              }}
            >
              {layerName ?? 'Khung Layer (0..1)'}
            </div>
          )}
        </div>

        {/* Outer Shot Margin Label */}
        <div
          style={{
            position: 'absolute',
            right: 6,
            top: 4,
            fontSize: 8.5,
            padding: '1px 5px',
            borderRadius: 3,
            background: 'rgba(15, 23, 42, 0.78)',
            color: '#cbd5e1',
            border: '1px solid rgba(255,255,255,0.14)',
            pointerEvents: 'none',
            zIndex: 4
          }}
        >
          Viền ngoài: Chiếu xuyên sang Layer khác
        </div>

        {/* Real-time 1:1 Shader Light & Cave Canvas */}
        <canvas ref={canvasRef} className="vl-pad-canvas" />

        {/* Cave Portal Wireframe Outline */}
        {isPortalEnabled && (
          <div
            style={{
              position: 'absolute',
              left: `${(box.leftNorm + (portalU - portalRx) * box.wNorm) * 100}%`,
              top: `${(box.topNorm + (1 - portalV - portalRy) * box.hNorm) * 100}%`,
              width: `${portalRx * 2 * box.wNorm * 100}%`,
              height: `${portalRy * 2 * box.hNorm * 100}%`,
              borderRadius: borderRadiusStyle,
              border: '1.5px dashed #38bdf8',
              pointerEvents: 'none',
              zIndex: 3
            }}
          />
        )}

        {/* Curved Beam Wireframe SVG Overlay */}
        {isLightEnabled && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="vl-pad-svg">
            {isCone ? (
              <>
                <path
                  d={buildCurvedBeamSvgPath()}
                  fill="none"
                  stroke="#fde047"
                  strokeOpacity="0.82"
                  strokeWidth="0.65"
                  strokeDasharray="2.2 1.4"
                />
                <line
                  x1={lxPct}
                  y1={lyPct}
                  x2={aimPctX}
                  y2={aimPctY}
                  stroke="#ffffff"
                  strokeOpacity="0.85"
                  strokeWidth="0.7"
                />
              </>
            ) : (
              <ellipse
                cx={lxPct}
                cy={lyPct}
                rx={beamLenUV * box.wNorm * 100 * 0.78}
                ry={beamLenUV * box.hNorm * 100 * 0.78}
                fill="none"
                stroke="#fde047"
                strokeOpacity="0.75"
                strokeWidth="0.65"
                strokeDasharray="2.2 1.6"
              />
            )}
          </svg>
        )}

        {/* Handle 1: Light Origin 🕯️ */}
        {isLightEnabled && (
          <div
            className={`vl-handle vl-handle-light ${dragging === 'light_origin' ? 'dragging' : ''}`}
            style={{ left: `${lxPct}%`, top: `${lyPct}%`, background: vlight.color }}
            onPointerDown={(e) => startDrag(e, 'light_origin')}
            title={`Kéo tâm đèn UV (${lightU.toFixed(2)}, ${lightV.toFixed(2)})`}
          >
            {vlight.kind === 'flashlight' ? '🔦' : vlight.kind === 'bulb' ? '💡' : '🕯️'}
          </div>
        )}

        {/* Handle 2: Beam Direction & Length 🎯 */}
        {isLightEnabled && isCone && (
          <div
            className={`vl-handle vl-handle-aim ${dragging === 'light_aim' ? 'dragging' : ''}`}
            style={{ left: `${clamp(aimPctX, 4, 96)}%`, top: `${clamp(aimPctY, 6, 94)}%` }}
            onPointerDown={(e) => startDrag(e, 'light_aim')}
            title={`Kéo để chỉnh Hướng chiếu (${beamDeg}°) & Độ dài khung sáng (${Math.round(radiusPx)}px)`}
          >
            🎯
          </div>
        )}

        {/* Handle 3: Beam Curvature & Cone Spread ⌒ */}
        {isLightEnabled && isCone && (
          <div
            className={`vl-handle vl-handle-curve ${dragging === 'light_curve' ? 'dragging' : ''}`}
            style={{ left: `${clamp(curvePctX, 4, 96)}%`, top: `${clamp(curvePctY, 6, 94)}%` }}
            onPointerDown={(e) => startDrag(e, 'light_curve')}
            title={`Kéo để uốn Độ cong khung sáng (${Math.round(beamCurvature * 100)}%) & Góc mở (${coneDeg}°)`}
          >
            ⌒
          </div>
        )}

        {/* Handle 4: Cave Portal Center 🕳️ */}
        {isPortalEnabled && (
          <div
            className={`vl-handle vl-handle-cave ${dragging === 'portal_center' ? 'dragging' : ''}`}
            style={{ left: `${pCenterPctX}%`, top: `${pCenterPctY}%` }}
            onPointerDown={(e) => startDrag(e, 'portal_center')}
            title={`Kéo tâm cửa hang UV (${portalU.toFixed(2)}, ${portalV.toFixed(2)})`}
          >
            🕳️
          </div>
        )}

        {/* Handle 5: Cave Portal Radius ⤡ */}
        {isPortalEnabled && (
          <div
            className={`vl-handle vl-handle-cave-size ${dragging === 'portal_radius' ? 'dragging' : ''}`}
            style={{ left: `${pSizePctX}%`, top: `${pSizePctY}%` }}
            onPointerDown={(e) => startDrag(e, 'portal_radius')}
            title={`Kéo chỉnh cỡ vòm hang Rx=${portalRx.toFixed(2)}, Ry=${portalRy.toFixed(2)}`}
          >
            ⤡
          </div>
        )}
      </div>

      {/* High-Contrast Footer Readout */}
      <div className="vl-pad-footer">
        {isLightEnabled && (
          <span className="vl-pad-stat">
            🕯️ Dài {Math.round(radiusPx)}px • Hướng {beamDeg}° • Mở {coneDeg}° • Cong{' '}
            {beamCurvature > 0 ? `+${Math.round(beamCurvature * 100)}%` : `${Math.round(beamCurvature * 100)}%`}
          </span>
        )}
        {isPortalEnabled && (
          <span className="vl-pad-stat">
            🕳️ Vòm ({portalU.toFixed(2)}, {portalV.toFixed(2)}) • Cỡ {Math.round(portalRx * 100)}×
            {Math.round(portalRy * 100)}%
          </span>
        )}
        {!isLightEnabled && !isPortalEnabled && (
          <span className="vl-pad-hint">Bật Ánh sáng ảo hoặc Cửa hang bên dưới để căn chỉnh trực quan</span>
        )}
      </div>
    </div>
  )
}
