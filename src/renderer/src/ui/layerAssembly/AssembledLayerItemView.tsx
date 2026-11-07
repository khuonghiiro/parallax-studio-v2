import React, { useEffect, useMemo, useRef, useState } from 'react'
import { evaluateLoopLayerRhythm } from '../../project/gifHelper'
import type { AssemblyLighting } from '../assets/models3d/types'
import { getCachedLoopTemplateSheet } from '../loopAnimator/loopFrameExtractor'
import { BBOX_2D_HANDLES, type Bbox2DHandle } from './layerAssembly2DBbox'
import { computeLayer2DLighting } from './layerAssembly2DLighting'
import { LayerAssembly2DMeshOverlay } from './layerAssemblyAlphaMesh'
import { computeLayerMotion } from './layerAssemblyMotion'
import { SoftLayerImage } from './SoftLayerImage'
import type { AssembledLayerItem, AssetTable, LoopWorkshopLayerConfig } from './types'
import { useLayerAssetImage } from './useLayerAssetImage'

interface LoopSpriteCanvasProps {
  loopConfig: LoopWorkshopLayerConfig
  time: number
  filter?: string
  meshWidth?: number
  meshHeight?: number
}

const WorkshopLoopSpriteCanvas = React.memo(function WorkshopLoopSpriteCanvas({
  loopConfig,
  time,
  filter,
  meshWidth,
  meshHeight
}: LoopSpriteCanvasProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [sheetReady, setSheetReady] = useState(false)
  const sheetRef = useRef<Awaited<ReturnType<typeof getCachedLoopTemplateSheet>>>(null)

  useEffect(() => {
    if (!loopConfig.spriteSheetUrl) return
    let cancelled = false
    const mappedFrames = (loopConfig.frames ?? []).map((f, idx) => ({
      id: `f_${idx}`,
      index: idx,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      offsetX: f.offsetX ?? 0,
      offsetY: f.offsetY ?? 0,
      enabled: true,
      durationRatio: f.durationRatio ?? 1
    }))
    void getCachedLoopTemplateSheet({
      id: loopConfig.templateId || 'workshop_loop',
      imageUrl: loopConfig.spriteSheetUrl,
      gridConfig: { cols: 4, rows: 4, marginX: 0, marginY: 0, paddingX: 0, paddingY: 0 },
      chromaKey: loopConfig.chromaKey ?? {
        enabled: true,
        keyColor: '#00ff00',
        similarity: 0.34,
        smoothness: 0.12,
        spill: 0.45
      },
      frames: mappedFrames
    }).then((sheet) => {
      if (cancelled) return
      sheetRef.current = sheet
      setSheetReady((v) => !v)
    })
    return () => {
      cancelled = true
    }
  }, [
    loopConfig.templateId,
    loopConfig.spriteSheetUrl,
    loopConfig.chromaKey?.enabled,
    loopConfig.chromaKey?.keyColor,
    loopConfig.chromaKey?.similarity,
    loopConfig.frames?.length
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    const sheet = sheetRef.current
    if (!canvas || !sheet || sheet.frames.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const total = sheet.frames.length
    const effectiveFps = Math.max(1, (loopConfig.fps || 12) * (loopConfig.speed || 1))
    const elapsed = Math.max(0, time + (loopConfig.timeOffset || 0))
    const rawSlot = Math.floor(elapsed * effectiveFps)

    let frameIdx = 0
    if (time <= 0.001 || total <= 1) {
      frameIdx = 0
    } else if (loopConfig.loopMode === 'once') {
      frameIdx = Math.min(total - 1, rawSlot)
    } else if (loopConfig.loopMode === 'ping-pong') {
      const cycle = Math.max(1, (total - 1) * 2)
      const rem = rawSlot % cycle
      frameIdx = rem < total ? rem : cycle - rem
    } else if (loopConfig.loopMode === 'random') {
      const hash = Math.abs(Math.sin(rawSlot * 12.9898 + 78.233) * 43758.5453)
      frameIdx = Math.floor((hash - Math.floor(hash)) * total) % total
    } else {
      frameIdx = rawSlot % total
    }

    const f = sheet.frames[frameIdx] ?? sheet.frames[0]
    if (!f) return

    if (canvas.width !== sheet.frameW || canvas.height !== sheet.frameH) {
      canvas.width = sheet.frameW
      canvas.height = sheet.frameH
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const dx = Math.round((canvas.width - f.width) * 0.5 + (f.offsetX || 0))
    const dy = Math.round((canvas.height - f.height) * 0.5 + (f.offsetY || 0))
    ctx.drawImage(sheet.canvas, f.x, f.y, f.width, f.height, dx, dy, f.width, f.height)
  }, [
    sheetReady,
    time,
    loopConfig.fps,
    loopConfig.speed,
    loopConfig.loopMode,
    loopConfig.timeOffset
  ])

  const dispW = meshWidth && meshWidth > 0 ? meshWidth : loopConfig.meshWidth
  const dispH = meshHeight && meshHeight > 0 ? meshHeight : loopConfig.meshHeight

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={220}
      style={{
        display: 'block',
        pointerEvents: 'none',
        ...(dispW && dispH ? { width: `${dispW}px`, height: `${dispH}px` } : {}),
        filter
      }}
    />
  )
})

interface AssembledLayerItemViewProps {
  layer: AssembledLayerItem
  isSelected: boolean
  showBbox?: boolean
  showMesh?: boolean
  zoom?: number
  time: number
  maxZ: number
  lighting?: AssemblyLighting
  assetTable?: AssetTable
  show3DPerspective?: boolean
  isDimmed?: boolean
  isFocused?: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onStartDragHandle?: (
    e: React.PointerEvent,
    handle: Bbox2DHandle,
    layer: AssembledLayerItem,
    baseW: number,
    baseH: number
  ) => void
}

export function AssembledLayerItemView({
  layer,
  isSelected,
  showBbox = true,
  showMesh = false,
  time,
  maxZ,
  lighting,
  assetTable,
  show3DPerspective = true,
  isDimmed = false,
  isFocused = false,
  onPointerDown,
  onStartDragHandle
}: AssembledLayerItemViewProps) {
  const imageUrl = useLayerAssetImage(layer.asset || layer.assetPath, layer.imageUrl, assetTable)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const lightingResult = useMemo(() => {
    return computeLayer2DLighting(layer, maxZ, lighting)
  }, [layer.z, maxZ, lighting])

  const {
    animRotateDeg: animRotate,
    animScaleX,
    animScaleY,
    animTranslateX,
    animTranslateY
  } = computeLayerMotion(layer.motion, time)

  const loopRhythm = useMemo(() => {
    if (!layer.loopConfig?.enabled || !layer.loopConfig.rhythmMode || layer.loopConfig.rhythmMode === 'none' || time <= 0.001) {
      return { opacityMultiplier: 1, scaleMultiplier: 1 }
    }
    return evaluateLoopLayerRhythm(
      {
        loopRhythmMode: layer.loopConfig.rhythmMode,
        loopRhythmRateHz: layer.loopConfig.rhythmRateHz,
        loopRhythmIntensity: layer.loopConfig.rhythmIntensity,
        loopMinOpacity: layer.loopConfig.minOpacity,
        loopScaleBeatPct: layer.loopConfig.scaleBeatPct,
        timeOffset: layer.loopConfig.timeOffset,
        speed: layer.loopConfig.speed
      },
      time,
      0
    )
  }, [layer.loopConfig, time])

  const usesMeshCanvas = Boolean(
    (layer.bindingMode === 'soft' && (layer.boneId || layer.extraBoneIds?.length)) ||
      layer.previewPlantSpines?.length
  )
  const hasSpriteLoop = Boolean(
    layer.loopConfig?.enabled &&
      layer.loopConfig.spriteSheetUrl &&
      layer.loopConfig.frames &&
      layer.loopConfig.frames.length > 0
  )
  const anchor = layer.boneId ? 'center' : layer.motion.anchor

  const anchorOrigin =
    anchor === 'bottom'
      ? '50% 100%'
      : anchor === 'top'
        ? '50% 0%'
        : anchor === 'left'
          ? '0% 50%'
          : anchor === 'right'
            ? '100% 50%'
            : '50% 50%'

  const rotX = layer.rotationX || 0
  const rotY = layer.rotationY || 0
  const rotZ = layer.rotation || 0

  const baseScale = Math.max(0.05, layer.scale || 1)
  const squashScaleX = (layer.scaleX ?? 1) * animScaleX * loopRhythm.scaleMultiplier
  const squashScaleY = (layer.scaleY ?? 1) * animScaleY * loopRhythm.scaleMultiplier
  const invScale = 1 / Math.max(0.2, baseScale)

  const layerTransform = show3DPerspective
    ? `perspective(1400px) rotateY(${-rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ + animRotate}deg) scale(${squashScaleX}, ${squashScaleY})`
    : `rotate(${rotZ + animRotate}deg) scale(${squashScaleX}, ${squashScaleY})`

  const depthTranslateZ = 0

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate3d(${layer.x + animTranslateX}px, ${layer.y + animTranslateY}px, ${depthTranslateZ}px) scale(${baseScale})`,
        transformOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
        pointerEvents: 'none',
        willChange: 'transform',
        zIndex: isFocused ? 2500 : Math.round(1000 - layer.z)
      }}
    >
      <div
        ref={boxRef}
        data-layer-id={layer.id} className="lw-stage-layer-item" data-layer-name={layer.name} data-layer-z={layer.z} data-bone-id={layer.boneId || ''} title={`Bộ phận 2.5D: "${layer.name}" (Z: ${layer.z}px${layer.boneId ? ` · Gắn xương: ${layer.boneId}` : ''})`}
        style={{
          position: 'relative',
          display: 'inline-block',
          transform: layerTransform,
          transformOrigin: anchorOrigin,
          transformStyle: 'preserve-3d',
          opacity: isDimmed ? (layer.opacity * loopRhythm.opacityMultiplier) * 0.18 : layer.opacity * loopRhythm.opacityMultiplier,
          filter: isDimmed ? 'grayscale(0.65)' : undefined,
          transition: 'opacity 0.18s ease, filter 0.18s ease',
          cursor: layer.locked ? 'default' : 'move',
          outline: isFocused
            ? '2px solid var(--accent-cyan, #38bdf8)'
            : isSelected && !showBbox
              ? `${Math.max(1, 2 * invScale)}px solid var(--accent)`
              : 'none',
          outlineOffset: '2px',
          borderRadius: '3px',
          boxShadow: isFocused
            ? '0 0 16px rgba(56, 189, 248, 0.8), 0 0 0 2px var(--accent-cyan)'
            : isSelected
              ? '0 0 12px rgba(38, 128, 235, 0.5)'
              : 'none',
          pointerEvents: 'auto'
        }}
        onPointerDown={onPointerDown}
      >
        {hasSpriteLoop && layer.loopConfig ? (
          <WorkshopLoopSpriteCanvas
            loopConfig={layer.loopConfig}
            time={time}
            filter={lightingResult.combinedFilter}
            meshWidth={layer.meshWidth}
            meshHeight={layer.meshHeight}
          />
        ) : imageUrl && usesMeshCanvas ? (
          <SoftLayerImage
            url={imageUrl}
            layer={layer}
            time={time}
            showMesh={showMesh}
            filter={lightingResult.atmosphereFilter || undefined}
          />
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={layer.name}
            width={layer.meshWidth && layer.meshWidth > 0 ? layer.meshWidth : undefined}
            height={layer.meshHeight && layer.meshHeight > 0 ? layer.meshHeight : undefined}
            style={{
              display: 'block',
              pointerEvents: 'none',
              ...(layer.meshWidth && layer.meshHeight && layer.meshWidth > 0 && layer.meshHeight > 0
                ? { width: `${layer.meshWidth}px`, height: `${layer.meshHeight}px` }
                : {}),
              imageRendering: '-webkit-optimize-contrast',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              filter: lightingResult.combinedFilter
            }}
            draggable={false}
          />
        ) : (
          <div
            style={{
              width: '130px',
              height: '130px',
              background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
              border: '1.5px dashed var(--accent)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: 'var(--text)',
              filter: lightingResult.dropShadowFilter || undefined
            }}
          >
            <span>{layer.name}</span>
            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>Z: {layer.z}px</span>
          </div>
        )}

        <LayerAssembly2DMeshOverlay
          imageUrl={imageUrl}
          showMesh={showMesh && !usesMeshCanvas && !hasSpriteLoop}
        />

        {isSelected && (
          <div
            style={{
              position: 'absolute',
              left: anchor === 'left' ? '0%' : anchor === 'right' ? '100%' : '50%',
              top: anchor === 'top' ? '0%' : anchor === 'bottom' ? '100%' : '50%',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--key)',
              border: '2px solid var(--bg-0)',
              transform: `translate(-50%, -50%) scale(${invScale})`,
              boxShadow: '0 0 6px rgba(0,0,0,0.6)',
              pointerEvents: 'none',
              zIndex: 10
            }}
            title={`Điểm neo uốn: ${anchor}`}
          />
        )}

        {isSelected && showBbox && !layer.locked && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: '-2px',
                border: `${Math.max(1, 1.5 * invScale)}px solid var(--accent)`,
                borderRadius: '2px',
                pointerEvents: 'none',
                zIndex: 15
              }}
            />
            {BBOX_2D_HANDLES.map((h) => (
              <div
                key={h.handle}
                style={{
                  position: 'absolute',
                  top: h.top,
                  bottom: h.bottom,
                  left: h.left,
                  right: h.right,
                  transform: h.transform ? `${h.transform} scale(${invScale})` : `scale(${invScale})`,
                  width: '9px',
                  height: '9px',
                  background: 'var(--bg-0)',
                  border: '1.5px solid var(--accent)',
                  borderRadius: '1.5px',
                  boxShadow: '0 0 4px rgba(0,0,0,0.6)',
                  cursor: h.cursor,
                  pointerEvents: 'auto',
                  zIndex: 20
                }}
                title={h.title}
                onPointerDown={(e) => {
                  const el = boxRef.current
                  const bw = el ? el.offsetWidth : 130
                  const bh = el ? el.offsetHeight : 130
                  onStartDragHandle?.(e, h.handle, layer, bw, bh)
                }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
