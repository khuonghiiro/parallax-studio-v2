import React, { useRef, useState } from 'react'
import type { AssembledLayerItem, LayerComposite } from '../types'
import { useLayerAssetImage } from '../useLayerAssetImage'
import { BBOX_2D_HANDLES, type Bbox2DHandle } from '../layerAssembly2DBbox'

export interface CutterPlacedLayerItemProps {
  layer: AssembledLayerItem
  assets?: LayerComposite['assets']
  isSelected: boolean
  showBbox: boolean
  boardScale: number
  onPointerDown: (e: React.PointerEvent, layer: AssembledLayerItem) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onStartResizeHandle: (
    e: React.PointerEvent,
    handle: Bbox2DHandle,
    layer: AssembledLayerItem,
    baseWidth: number,
    baseHeight: number
  ) => void
}

export function CutterPlacedLayerItem({
  layer,
  assets,
  isSelected,
  showBbox,
  boardScale,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onStartResizeHandle
}: CutterPlacedLayerItemProps) {
  const resolvedUrl = useLayerAssetImage(
    layer.asset || layer.assetPath,
    layer.imageUrl,
    assets
  )
  const innerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 120, h: 120 })

  const baseScale = Math.max(0.05, layer.scale || 1)
  const squashScaleX = layer.scaleX ?? 1
  const squashScaleY = layer.scaleY ?? 1
  const anchor = layer.boneId ? 'center' : layer.motion?.anchor || 'center'
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
  const zVal = layer.z ?? 0

  const combinedScale = Math.max(0.12, baseScale * Math.max(0.2, boardScale))
  const handleInvScale = Math.min(4.5, Math.max(0.45, 1 / combinedScale))

  const getBaseDimensions = () => {
    const imgEl = imgRef.current
    if (imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
      return { w: imgEl.naturalWidth, h: imgEl.naturalHeight }
    }
    const el = innerRef.current
    if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
      return { w: el.offsetWidth, h: el.offsetHeight }
    }
    return imgSize
  }

  return (
    <div
      className={`layer-cutter-placed-layer ${isSelected ? 'selected' : ''} ${
        isSelected && showBbox ? 'bbox-enabled' : 'bbox-hidden'
      }`}
      style={{
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate3d(${layer.x}px, ${layer.y}px, 0px) scale(${baseScale})`,
        transformOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
        zIndex: Math.round(1000 - zVal)
      }}
      onPointerDown={(e) => onPointerDown(e, layer)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        ref={innerRef}
        className="layer-cutter-placed-inner"
        style={{
          position: 'relative',
          display: 'inline-block',
          transform: `rotateY(${-rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ}deg) scale(${squashScaleX}, ${squashScaleY})`,
          transformOrigin: anchorOrigin,
          transformStyle: 'preserve-3d',
          opacity: layer.opacity ?? 1
        }}
      >
        {isSelected && (
          <div
            className="layer-cutter-layer-zbadge"
            style={{
              transform: `translateY(-4px) scale(${handleInvScale})`,
              transformOrigin: 'right bottom'
            }}
            title={`Chiều sâu Z: ${zVal} · Tỉ lệ: ${Math.round(baseScale * 100)}% (Giữ nguyên 100% chất lượng ảnh gốc)`}
          >
            Z:{zVal} · {Math.round(baseScale * 100)}%
          </div>
        )}
        {resolvedUrl ? (
          <img
            ref={imgRef}
            src={resolvedUrl}
            alt={layer.name}
            draggable={false}
            onLoad={(e) => {
              const nw = e.currentTarget.naturalWidth
              const nh = e.currentTarget.naturalHeight
              if (nw > 0 && nh > 0) setImgSize({ w: nw, h: nh })
            }}
          />
        ) : (
          <div
            style={{
              padding: 8,
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 4,
              fontSize: 10
            }}
          >
            {layer.name}
          </div>
        )}

        {/* 8-Point Interactive BBox Resize Handles (Non-destructive scale) */}
        {isSelected && showBbox && !layer.locked && (
          <div className="layer-cutter-bbox-overlay">
            {BBOX_2D_HANDLES.map((h) => {
              const baseTransform = h.transform ? `${h.transform} ` : ''
              return (
                <div
                  key={h.handle}
                  className={`layer-cutter-bbox-handle handle-${h.handle}`}
                  title={`${h.title} — Kéo để chỉnh kích thước (giữ nguyên độ nét ảnh gốc)`}
                  style={{
                    top: h.top,
                    bottom: h.bottom,
                    left: h.left,
                    right: h.right,
                    cursor: h.cursor,
                    transform: `${baseTransform}scale(${handleInvScale})`
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    const dims = getBaseDimensions()
                    onStartResizeHandle(e, h.handle, layer, dims.w, dims.h)
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
