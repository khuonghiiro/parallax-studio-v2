import { assetStore } from '../../../project/assets'
import type { ProjectedLayer2D, ShotStageBox } from './animateCameraMath'

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

export function AnimateShotPlane2D({
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
        title={`✥ Nhấn giữ tiêu đề để kéo dời vị trí "${box.name}" (Trái/Phải/Trên/Dưới — đồng bộ 2D & 3D, giữ Shift khóa trục, giữ Alt chỉ dời Cảnh)`}
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
                    display: 'block'
                  }}
                />
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
      </div>
    </div>
  )
}
