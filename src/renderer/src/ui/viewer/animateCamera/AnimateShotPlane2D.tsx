import { assetStore } from '../../../project/assets'
import type { ProjectedLayer2D, ShotStageBox } from './animateCameraMath'

interface AnimateShotPlane2DProps {
  box: ShotStageBox
  layers: ProjectedLayer2D[]
  background: string
  isSelectedShot: boolean
  zoom: number
  screenLeft: number
  screenTop: number
  onSelectShot: (shotId: string | null) => void
  onAddFrameAtShot: (box: ShotStageBox) => void
}

export function AnimateShotPlane2D({
  box,
  layers,
  background,
  isSelectedShot,
  zoom,
  screenLeft,
  screenTop,
  onSelectShot,
  onAddFrameAtShot
}: AnimateShotPlane2DProps) {
  const screenW = Math.max(8, box.width * zoom)
  const screenH = Math.max(6, box.height * zoom)

  return (
    <div
      className={`anim2d-shot-card${isSelectedShot ? ' selected' : ''}${box.visible ? '' : ' hidden-shot'}`}
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
    >
      {/* Header của Cảnh 2D */}
      <div
        className="anim2d-shot-header"
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelectShot(box.shotId)
        }}
      >
        <span className="anim2d-shot-dot" style={{ background: box.color }} />
        <span className="anim2d-shot-title">
          {box.index + 1}. {box.name}
        </span>
        <span className="anim2d-shot-meta">{layers.length} layer 2D</span>
        <button
          type="button"
          className="anim2d-shot-add-cam"
          title={`Thêm khung Camera mới lia tới "${box.name}"`}
          onClick={(e) => {
            e.stopPropagation()
            onAddFrameAtShot(box)
          }}
        >
          + Khung Cam
        </button>
      </div>

      {/* Mặt phẳng 2D hiển thị đầy đủ các layer xếp chồng của Cảnh */}
      <div className="anim2d-shot-surface" style={{ background }}>
        {layers.map((layer) => {
          const lw = layer.width * zoom
          const lh = layer.height * zoom
          const lx = screenW / 2 + layer.offsetX * zoom - lw / 2
          const ly = screenH / 2 + layer.offsetY * zoom - lh / 2
          const style: React.CSSProperties = {
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
            const imgUrl = runtimeAsset?.url || runtimeAsset?.thumbUrl
            if (!imgUrl) return null
            return (
              <img
                key={layer.id}
                src={imgUrl}
                alt={layer.name}
                draggable={false}
                style={{
                  ...style,
                  objectFit: 'fill',
                  userSelect: 'none'
                }}
              />
            )
          }

          if (layer.type === 'solid') {
            const bg = layer.solidColor2
              ? `linear-gradient(${layer.gradientAngle ?? 180}deg, ${layer.solidColor ?? '#000'}, ${layer.solidColor2})`
              : (layer.solidColor ?? '#000')
            return <div key={layer.id} style={{ ...style, background: bg }} />
          }

          if (layer.type === 'text') {
            const fSize = Math.max(8, (layer.fontSize ?? 48) * zoom)
            return (
              <div
                key={layer.id}
                style={{
                  ...style,
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
              >
                {layer.text}
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
