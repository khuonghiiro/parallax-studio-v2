import { useRef, useMemo } from 'react'
import type { AssembledLayerItem } from './types'
import type { AssemblyLighting } from '../assets/models3d/types'
import { useLayerAssetImage } from './useLayerAssetImage'
import { computeLayerMotion } from './layerAssemblyMotion'
import { computeLayer2DLighting } from './layerAssembly2DLighting'
import { BBOX_2D_HANDLES, type Bbox2DHandle } from './layerAssembly2DBbox'
import { LayerAssembly2DMeshOverlay } from './layerAssemblyAlphaMesh'
import { SoftLayerImage } from './SoftLayerImage'

interface AssembledLayerItemViewProps {
  layer: AssembledLayerItem
  isSelected: boolean
  showBbox?: boolean
  showMesh?: boolean
  zoom?: number
  time: number
  maxZ: number
  lighting?: AssemblyLighting
  show3DPerspective?: boolean
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
  zoom = 1.0,
  time,
  maxZ,
  lighting,
  show3DPerspective = true,
  onPointerDown,
  onStartDragHandle
}: AssembledLayerItemViewProps) {
  const imageUrl = useLayerAssetImage(layer.assetPath, layer.imageUrl)
  const boxRef = useRef<HTMLDivElement | null>(null)

  // Tính hiệu ứng hướng nắng, bóng đổ theo chiều sâu Z và màu sắc hấp thụ ánh sáng ngày/đêm
  const lightingResult = useMemo(() => {
    return computeLayer2DLighting(layer, maxZ, lighting)
  }, [layer, maxZ, lighting])

  // Tính chuyển động hoạt ảnh theo thời gian mượt mà
  const {
    animRotateDeg: animRotate,
    animScaleX,
    animScaleY,
    animTranslateX,
    animTranslateY
  } = computeLayerMotion(layer.motion, time)
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

  // Hỗ trợ co dãn đàn hồi Squash & Stretch 2D đồng bộ với xương
  const totalScaleX = layer.scale * (layer.scaleX ?? 1) * animScaleX
  const totalScaleY = layer.scale * (layer.scaleY ?? 1) * animScaleY

  const layerTransform = show3DPerspective
    ? `rotateY(${-rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ + animRotate}deg) scale(${totalScaleX}, ${totalScaleY})`
    : `rotate(${rotZ + animRotate}deg) scale(${totalScaleX}, ${totalScaleY})`

  const depthTranslateZ = show3DPerspective ? -layer.z * 0.75 : 0

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate3d(${layer.x + animTranslateX}px, ${layer.y + animTranslateY}px, ${depthTranslateZ}px)`,
        transformStyle: 'preserve-3d',
        pointerEvents: 'none',
        willChange: 'transform',
        zIndex: Math.round(1000 - layer.z)
      }}
    >
      <div
        ref={boxRef}
        style={{
          position: 'relative',
          display: 'inline-block',
          transform: layerTransform,
          transformOrigin: anchorOrigin,
          transformStyle: 'preserve-3d',
          opacity: layer.opacity,
          cursor: layer.locked ? 'default' : 'move',
          outline: isSelected && !showBbox ? '2px solid var(--accent)' : 'none',
          outlineOffset: '2px',
          borderRadius: '3px',
          boxShadow: isSelected ? '0 0 12px rgba(38, 128, 235, 0.5)' : 'none',
          pointerEvents: 'auto'
        }}
        onPointerDown={onPointerDown}
      >
        {imageUrl && layer.bindingMode === 'soft' && layer.boneId ? (
          <SoftLayerImage url={imageUrl} layer={layer} time={time} showMesh={showMesh} filter={lightingResult.combinedFilter} />
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={layer.name}
            style={{
              display: 'block',
              maxWidth: '380px',
              maxHeight: '380px',
              objectFit: 'contain',
              pointerEvents: 'none',
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

        {/* Lưới đa giác Mesh 2D bám sát pixel đục (loại bỏ hoàn toàn pixel trong suốt) */}
        <LayerAssembly2DMeshOverlay imageUrl={imageUrl} showMesh={showMesh && !(layer.bindingMode === 'soft' && layer.boneId)} />

        {/* Điểm neo (Anchor Dot Indicator) khi layer được chọn */}
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
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 6px rgba(0,0,0,0.6)',
              pointerEvents: 'none',
              zIndex: 10
            }}
            title={`Điểm neo uốn: ${anchor}`}
          />
        )}

        {/* Khung viền và 8 điểm mút Square co dãn Bbox theo chuẩn After Effects (cố định mép đối diện) */}
        {isSelected && showBbox && !layer.locked && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: '-2px',
                border: '1.5px solid var(--accent)',
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
                  transform: h.transform,
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
