import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  IconSelectPointer,
  IconEraser,
  IconFit,
  IconPerspective2D,
  IconCrop,
  IconBoundingBox,
  IconBone,
  IconMeshWireframe,
  IconSun
} from '../icons'
import type { Assembly2DTool, BrushSettings } from './useLayerBrushEraser'
import { LightingControlPopover } from './LightingControlPopover'
import type { AssemblyLighting } from '../assets/models3d/types'

export interface LayerAssembly2DToolbarProps {
  activeTool: Assembly2DTool
  onChangeTool: (tool: Assembly2DTool) => void
  brushSettings: BrushSettings
  onChangeBrushSettings: (settings: BrushSettings) => void
  onResetLayerImage: () => void
  hasSelectedLayer: boolean
  hasModifiedImage: boolean
  zoom: number
  onResetZoom: () => void
  onFitView: () => void
  show3DPerspective: boolean
  onToggle3DPerspective: () => void
  clipToCamera: boolean
  onToggleClipToCamera: () => void
  showBbox: boolean
  onToggleShowBbox: () => void
  hasBones?: boolean
  showBones?: boolean
  onToggleShowBones?: () => void
  showMesh?: boolean
  onToggleShowMesh?: () => void
  lighting?: AssemblyLighting
  onChangeLighting?: (lighting: AssemblyLighting) => void
  atmosphereLabel?: string
  atmosphereIcon?: string
}

interface TooltipInfo {
  title: string
  sub?: string
  desc: string
  tip?: string
  top: number
  left: number
}

export function LayerAssembly2DToolbar({
  activeTool,
  onChangeTool,
  brushSettings,
  onChangeBrushSettings,
  onResetLayerImage,
  hasSelectedLayer,
  hasModifiedImage,
  zoom,
  onResetZoom,
  onFitView,
  show3DPerspective,
  onToggle3DPerspective,
  clipToCamera,
  onToggleClipToCamera,
  showBbox,
  onToggleShowBbox,
  hasBones = false,
  showBones = false,
  onToggleShowBones,
  showMesh = false,
  onToggleShowMesh,
  lighting,
  onChangeLighting,
  atmosphereLabel = 'Ban ngày',
  atmosphereIcon = '☀️'
}: LayerAssembly2DToolbarProps) {
  const [isLightingOpen, setIsLightingOpen] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const lightingBtnRef = useRef<HTMLButtonElement | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)

  // Đóng popover an toàn khi click ra ngoài hoặc bấm phím Escape
  useEffect(() => {
    if (!isLightingOpen) return

    const handlePointerDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('.layer-workshop-popover-menu')) {
        return
      }
      if (lightingBtnRef.current?.contains(target as Node)) {
        return
      }
      setIsLightingOpen(false)
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsLightingOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLightingOpen])

  const showTooltip = (e: React.MouseEvent<HTMLElement>, key: string) => {
    if (isLightingOpen) return
    const rect = e.currentTarget.getBoundingClientRect()

    const map: Record<string, { title: string; sub?: string; desc: string; tip?: string }> = {
      select: {
        title: 'Công cụ Chọn & Di chuyển (V)',
        sub: 'Thao tác layer cơ bản',
        desc: 'Click để chọn layer, kéo thả di chuyển vị trí, căn chỉnh khung bao BBox và xoay góc.',
        tip: '🖱 Bấm để kích hoạt chế độ chọn'
      },
      eraser: {
        title: 'Cọ tẩy xoá pixel & Mờ xuyên thấu (B)',
        sub: 'Xoá chi tiết thừa / Làm mờ nhẹ',
        desc: 'Quẹt cọ lên layer đang chọn để tẩy xoá pixel thừa hoặc giảm mờ xuyên thấu nhẹ tại khớp nối.',
        tip: '🖌 Bấm để bật cấu hình cọ'
      },
      zoom: {
        title: `Thu phóng: ${Math.round(zoom * 100)}%`,
        sub: 'Tỉ lệ hiển thị canvas',
        desc: 'Bấm để đặt lại tỉ lệ 100% chuẩn gốc. Cuộn chuột để phóng to/thu nhỏ.',
        tip: '🔍 Bấm để đặt về 100%'
      },
      fit: {
        title: 'Căn giữa vừa vặn khung vẽ (Fit View)',
        sub: 'Khung nhìn 2D',
        desc: 'Tự động căn chỉnh và phóng to/thu nhỏ vừa vặn toàn bộ không gian khung vẽ.',
        tip: '📐 Bấm để căn giữa'
      },
      perspective: {
        title: show3DPerspective ? 'Phối cảnh 2.5D (Đang bật)' : 'Phẳng 2D chuẩn',
        sub: show3DPerspective ? 'Nghiêng sâu 3D' : 'Xem phẳng 2D',
        desc: 'Chuyển đổi giữa chế độ xem phẳng 2D truyền thống và chế độ phối cảnh chiều sâu nghiêng 2.5D.',
        tip: '📐 Bấm để chuyển đổi'
      },
      clip: {
        title: clipToCamera ? 'Cắt gọn khung Camera' : 'Xem tràn viền ngoài khung',
        sub: clipToCamera ? 'Đang cắt gọn viền' : 'Đang tràn viền',
        desc: 'Cắt gọn hình ảnh layer theo tầm nhìn khung camera, hoặc hiển thị tràn viền để dễ ghép nối.',
        tip: '✂️ Bấm để chuyển đổi'
      },
      bbox: {
        title: showBbox ? 'Khung bao BBox (Đang hiện)' : 'Khung bao BBox (Đang ẩn)',
        sub: '8 điểm neo co dãn',
        desc: 'Hiển thị khung chữ nhật với 8 điểm neo để kéo dãn, thay đổi kích thước và xoay layer trực tiếp.',
        tip: '🔲 Bấm để bật / ẩn BBox'
      },
      bones: {
        title: showBones ? 'Khung xương Blender (Đang hiện)' : 'Khung xương Blender (Đang ẩn)',
        sub: 'Rigging 2D',
        desc: 'Hiển thị khung xương và khớp nối Blender gắn liền với các bộ phận layer.',
        tip: '🦴 Bấm để bật / ẩn xương'
      },
      mesh: {
        title: showMesh ? 'Lưới tam giác Mesh 2D (Đang hiện)' : 'Lưới Mesh 2D (Đang ẩn)',
        sub: 'Deformation Mesh',
        desc: 'Hiển thị mạng lưới đa giác tam giác 2D phục vụ uốn cong mềm mại theo khung xương.',
        tip: '🕸 Bấm để bật / ẩn lưới mesh'
      },
      lighting: {
        title: `Hệ thống chiếu sáng: ${atmosphereLabel}`,
        sub: 'Ánh sáng & Đổ bóng',
        desc: 'Tùy chỉnh góc nắng mặt trời, tông màu ngày đêm và bóng đổ râm dịu trên các layer.',
        tip: '☀️ Bấm để mở bảng điều khiển ánh sáng'
      }
    }

    const item = map[key]
    if (item) {
      setTooltip({
        ...item,
        top: rect.top + rect.height / 2,
        left: rect.right + 10
      })
    }
  }

  const hideTooltip = () => setTooltip(null)

  return (
    <>
      <div
        className="layer-workshop-3d-vertical-dock"
        style={{ left: '12px', top: '12px' }}
        ref={dockRef}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
      >
        {/* 1. Công cụ Chọn (Select) */}
        <button
          type="button"
          className={`layer-3d-dock-btn${activeTool === 'select' ? ' active' : ''}`}
          onClick={() => {
            onChangeTool('select')
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'select')}
          onMouseLeave={hideTooltip}
          aria-label="Công cụ Chọn (Select)"
        >
          <IconSelectPointer width={15} height={15} />
        </button>

        {/* 2. Công cụ Cọ Tẩy (Eraser / Brush) */}
        <button
          type="button"
          className={`layer-3d-dock-btn${activeTool === 'eraser' ? ' active' : ''}`}
          onClick={() => {
            if (activeTool !== 'eraser') {
              onChangeTool('eraser')
            } else {
              onChangeTool('select')
            }
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'eraser')}
          onMouseLeave={hideTooltip}
          aria-label="Cọ tẩy xoá chi tiết & làm mờ xuyên thấu"
        >
          <IconEraser width={15} height={15} />
        </button>

        <div className="dock-divider" />

        {/* 3. Tỉ lệ % và Đặt lại 100% */}
        <button
          type="button"
          className="layer-3d-dock-btn"
          style={{ fontSize: '10px', fontWeight: 600, fontFamily: 'monospace' }}
          onClick={() => {
            onResetZoom()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'zoom')}
          onMouseLeave={hideTooltip}
          aria-label="Đặt lại tỉ lệ 100%"
        >
          {Math.round(zoom * 100)}%
        </button>

        {/* 4. Căn giữa vừa vặn (Fit) */}
        <button
          type="button"
          className="layer-3d-dock-btn"
          onClick={() => {
            onFitView()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'fit')}
          onMouseLeave={hideTooltip}
          aria-label="Căn giữa vừa vặn khung vẽ"
        >
          <IconFit width={15} height={15} />
        </button>

        {/* 5. Phối cảnh 2.5D (Perspective) */}
        <button
          type="button"
          className={`layer-3d-dock-btn${show3DPerspective ? ' active' : ''}`}
          onClick={() => {
            onToggle3DPerspective()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'perspective')}
          onMouseLeave={hideTooltip}
          aria-label="Phối cảnh 2.5D"
        >
          <IconPerspective2D width={15} height={15} />
        </button>

        {/* 6. Cắt khung camera */}
        <button
          type="button"
          className={`layer-3d-dock-btn${clipToCamera ? ' active' : ''}`}
          onClick={() => {
            onToggleClipToCamera()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'clip')}
          onMouseLeave={hideTooltip}
          aria-label="Cắt khung camera"
        >
          <IconCrop width={15} height={15} />
        </button>

        {/* 7. Khung bao BBox */}
        <button
          type="button"
          className={`layer-3d-dock-btn${showBbox ? ' active' : ''}`}
          onClick={() => {
            onToggleShowBbox()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'bbox')}
          onMouseLeave={hideTooltip}
          aria-label="Khung bao co dãn BBox"
        >
          <IconBoundingBox width={15} height={15} />
        </button>

        {/* 8. Khung xương Blender */}
        {hasBones && onToggleShowBones && (
          <button
            type="button"
            className={`layer-3d-dock-btn${showBones ? ' active' : ''}`}
            onClick={() => {
              onToggleShowBones()
              hideTooltip()
            }}
            onMouseEnter={(e) => showTooltip(e, 'bones')}
            onMouseLeave={hideTooltip}
            aria-label="Khung xương Blender"
          >
            <IconBone width={15} height={15} />
          </button>
        )}

        {/* 9. Lưới Mesh đa giác 2D */}
        {onToggleShowMesh && (
          <button
            type="button"
            className={`layer-3d-dock-btn${showMesh ? ' active' : ''}`}
            onClick={() => {
              onToggleShowMesh()
              hideTooltip()
            }}
            onMouseEnter={(e) => showTooltip(e, 'mesh')}
            onMouseLeave={hideTooltip}
            aria-label="Lưới Mesh 2D"
          >
            <IconMeshWireframe width={15} height={15} />
          </button>
        )}

        {/* 10. Hướng sáng & Đổ bóng ngày đêm */}
        {onChangeLighting && (
          <>
            <div className="dock-divider" />
            <button
              ref={lightingBtnRef}
              type="button"
              className={`layer-3d-dock-btn${isLightingOpen ? ' active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setIsLightingOpen((v) => !v)
                hideTooltip()
              }}
              onMouseEnter={(e) => showTooltip(e, 'lighting')}
              onMouseLeave={hideTooltip}
              aria-label="Chiếu sáng & Đổ bóng"
            >
              <IconSun width={15} height={15} />
            </button>
          </>
        )}
      </div>



      {/* Popover Chiếu sáng & Đổ bóng */}
      {isLightingOpen &&
        lighting &&
        onChangeLighting &&
        lightingBtnRef.current &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: Math.max(20, Math.min(window.innerHeight - 380, lightingBtnRef.current.getBoundingClientRect().top - 20)),
              left: lightingBtnRef.current.getBoundingClientRect().right + 12,
              zIndex: 50000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <LightingControlPopover
              lighting={lighting}
              onChangeLighting={onChangeLighting}
              onClose={() => setIsLightingOpen(false)}
            />
          </div>,
          document.body
        )}

      {/* Floating Tooltip */}
      {tooltip &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: `${tooltip.top}px`,
              left: `${tooltip.left}px`,
              transform: 'translateY(-50%)',
              zIndex: 60000,
              background: 'color-mix(in srgb, var(--bg-0) 96%, transparent)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--line-focus)',
              borderRadius: '6px',
              padding: '6px 10px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
              maxWidth: '240px',
              pointerEvents: 'none',
              userSelect: 'none',
              animation: 'fadeIn 0.12s ease'
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text)' }}>{tooltip.title}</div>
            {tooltip.sub && <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', marginTop: '1px' }}>{tooltip.sub}</div>}
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '3px', lineHeight: 1.35 }}>{tooltip.desc}</div>
            {tooltip.tip && <div style={{ fontSize: '9px', color: 'var(--text-faint)', marginTop: '4px', borderTop: '1px dashed var(--line)', paddingTop: '3px' }}>{tooltip.tip}</div>}
          </div>,
          document.body
        )}
    </>
  )
}
