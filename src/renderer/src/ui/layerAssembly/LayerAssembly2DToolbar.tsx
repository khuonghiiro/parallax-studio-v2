import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  IconSelectPointer,
  IconEraser,
  IconFit,
  IconPerspective2D,
  IconCrop,
  IconBoundingBox,
  IconFitCharacter,
  IconBone,
  IconText,
  IconMeshWireframe,
  IconSun,
  IconStageGuide
} from '../icons'
import { IconFlexiMeshBind } from './LayerWorkshopStudioIcons'
import type { Assembly2DTool, BrushSettings } from './useLayerBrushEraser'
import { LightingControlPopover } from './LightingControlPopover'
import type { AssemblyLighting } from '../assets/models3d/types'
import { useRigToolStore, toggleBoneLabels, openCutoutPartRig, closeCutoutPartRig } from './rigToolStore'

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
  onFitCharacter?: (mode?: 'scale' | 'frame') => void
  show3DPerspective: boolean
  onToggle3DPerspective: () => void
  clipToCamera: boolean
  onToggleClipToCamera: () => void
  showBbox: boolean
  onToggleShowBbox: () => void
  hasBones?: boolean
  showBones?: boolean
  onToggleShowBones?: () => void
  showBoneLabels?: boolean
  onToggleShowBoneLabels?: () => void
  showMesh?: boolean
  onToggleShowMesh?: () => void
  lighting?: AssemblyLighting
  onChangeLighting?: (lighting: AssemblyLighting) => void
  atmosphereLabel?: string
  atmosphereIcon?: string
  tab?: string
  selectedBoneName?: string | null
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
  zoom,
  onResetZoom,
  onFitView,
  onFitCharacter,
  show3DPerspective,
  onToggle3DPerspective,
  clipToCamera,
  onToggleClipToCamera,
  showBbox,
  onToggleShowBbox,
  hasBones = false,
  showBones = false,
  onToggleShowBones,
  showBoneLabels,
  onToggleShowBoneLabels,
  showMesh = false,
  onToggleShowMesh,
  lighting,
  onChangeLighting,
  atmosphereLabel = 'Ban ngày',
  tab = 'layers',
  selectedBoneName = null
}: LayerAssembly2DToolbarProps) {
  const [isLightingOpen, setIsLightingOpen] = useState(false)
  const [isGuidePinned, setIsGuidePinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pxs:stage-guide-pinned') === 'true'
    } catch {
      return false
    }
  })
  const toggleGuidePinned = () => {
    setIsGuidePinned((prev) => {
      const next = !prev
      try {
        localStorage.setItem('pxs:stage-guide-pinned', String(next))
      } catch {}
      return next
    })
  }
  const [isGuideHovered, setIsGuideHovered] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const rigTool = useRigToolStore()

  const lightingBtnRef = useRef<HTMLButtonElement | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)

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
        title: 'Cọ tẩy xoá pixel & Mờ xuyên thấu (E / B)',
        sub: 'Xoá chi tiết thừa / Làm mờ nhẹ',
        desc: 'Chỉnh pixel trong khung ảnh góc dưới trái: cọ mềm, tẩy nét cứng và bàn tay. Tự động chuyển sang tab Layer để chọn layer cần tẩy.',
        tip: '🖌 Bấm hoặc phím E/B để mở khung chỉnh pixel'
      },
      zoom: {
        title: `Thu phóng: ${Math.round(zoom * 100)}%`,
        sub: 'Tỉ lệ hiển thị canvas',
        desc: 'Bấm để đặt lại tỉ lệ 100% chuẩn gốc. Cuộn chuột để phóng to/thu nhỏ.',
        tip: '🔍 Bấm để đặt về 100%'
      },
      fitCharacter: {
        title: 'Căn vừa vặn nhân vật (Fit Character)',
        sub: 'Phóng to vừa sân khấu / Co khung',
        desc: 'Tự động phóng to nhân vật chiếm 84% khung sân khấu (Click). Giữ Alt để co khung canvas ôm sát nhân vật.',
        tip: '📐 Bấm để phóng vừa sân khấu · Alt+Click để co khung'
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
      boneLabels: {
        title: (showBoneLabels ?? rigTool.showBoneLabels ?? true) ? 'Tên nhãn xương (Đang hiện)' : 'Tên nhãn xương (Đang ẩn)',
        sub: 'Shift+T',
        desc: 'Hiển thị tên các xương trên sân khấu 2D. Bấm tắt để sân khấu gọn gàng, không bị chữ đè lên nhân vật.',
        tip: '🏷️ Bấm để bật / ẩn tên xương'
      },
      mesh: {
        title: showMesh ? 'Lưới tam giác Mesh 2D (Đang hiện)' : 'Lưới Mesh 2D (Đang ẩn)',
        sub: 'Deformation Mesh',
        desc: 'Hiển thị mạng lưới đa giác tam giác 2D phục vụ uốn cong mềm mại theo khung xương.',
        tip: '🕸 Bấm để bật / ẩn lưới mesh'
      },
      cutoutPart: {
        title: rigTool.cutoutStageMode ? 'Bộ phận 2D (Đang BẬT)' : 'Bộ phận 2D (Đang TẮT)',
        sub: 'Gắn Xương / Trục Gió Từng Mảnh',
        desc: 'Hiển thị các ô preview bộ phận 2 bên sân khấu 2D để focus và gắn xương Moho hoặc trục gió riêng biệt cho từng mảnh.',
        tip: '🧩 Bấm để bật / tắt chế độ Bộ phận 2D'
      },
      lighting: {
        title: `Hệ thống chiếu sáng: ${atmosphereLabel}`,
        sub: 'Ánh sáng & Đổ bóng',
        desc: 'Tùy chỉnh góc nắng mặt trời, tông màu ngày đêm và bóng đổ râm dịu trên các layer.',
        tip: '☀️ Bấm để mở bảng điều khiển ánh sáng'
      },
      guide: {
        title: 'Thông tin thao tác Vẽ & Focus Xương',
        sub: 'Hàn khớp · Nét đứt 2 bước · Xương tách rời (Esc)',
        desc: 'Hiển thị trạng thái focus xương hiện tại và quy tắc vẽ xương từ 2 tâm điểm, từ vỏ uốn (2 nét) hoặc ngoài vỏ uốn (1 nét).',
        tip: '💡 Bấm để ghim / thu gọn bảng chỉ dẫn thao tác'
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

  const pendingLink = rigTool.pendingDashedLink
  const showGuideCard = isGuideHovered || (isGuidePinned && (tab === 'bones' || Boolean(pendingLink)))

  const statusBadgeText = pendingLink
    ? `🔗 Đã chốt Nét 1 (${pendingLink.parentBoneName}) → Kéo Nét 2 tạo xương`
    : selectedBoneName
      ? `🎯 Đang focus: "${selectedBoneName}" (Nhấn Esc bỏ focus)`
      : '✨ Chưa focus xương (Vẽ tạo xương gốc tách rời)'

  const statusTone = pendingLink ? 'pending' : selectedBoneName ? 'focused' : 'detached'

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
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
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
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
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

        {/* 4b. Căn kích thước vừa nhân vật */}
        {onFitCharacter && (
          <button
            type="button"
            className="layer-3d-dock-btn"
            onClick={(e) => {
              onFitCharacter(e.altKey ? 'frame' : 'scale')
              hideTooltip()
            }}
            onMouseEnter={(e) => showTooltip(e, 'fitCharacter')}
            onMouseLeave={hideTooltip}
            aria-label="Căn vừa vặn nhân vật"
          >
            <IconFitCharacter width={15} height={15} />
          </button>
        )}

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

        {/* 8b. Bật/tắt nhãn tên xương */}
        {hasBones && (
          <button
            type="button"
            className={`layer-3d-dock-btn${(showBoneLabels ?? rigTool.showBoneLabels ?? true) ? ' active' : ''}`}
            onClick={() => {
              if (onToggleShowBoneLabels) onToggleShowBoneLabels()
              else toggleBoneLabels()
              hideTooltip()
            }}
            onMouseEnter={(e) => showTooltip(e, 'boneLabels')}
            onMouseLeave={hideTooltip}
            aria-label="Tên nhãn xương"
          >
            <IconText width={14} height={14} />
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

        {/* 9b. Bật/tắt chế độ gắn xương theo Bộ phận 2D */}
        <button
          type="button"
          className={`layer-3d-dock-btn${rigTool.cutoutStageMode ? ' active' : ''}`}
          onClick={() => {
            if (rigTool.cutoutStageMode) {
              closeCutoutPartRig()
            } else {
              openCutoutPartRig()
            }
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'cutoutPart')}
          onMouseLeave={hideTooltip}
          aria-label="Chế độ Bộ phận 2D"
        >
          <IconFlexiMeshBind width={15} height={15} />
        </button>

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

        {/* 11. Nút Chỉ dẫn thao tác Vẽ & Focus Xương (vị trí khoanh đỏ cuối thanh dock) */}
        <div className="dock-divider" />
        <button
          type="button"
          className={`layer-3d-dock-btn lw-dock-guide-btn${showGuideCard ? ' active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setIsGuidePinned((v) => !v)
            hideTooltip()
          }}
          onMouseEnter={(e) => {
            setIsGuideHovered(true)
            showTooltip(e, 'guide')
          }}
          onMouseLeave={() => {
            setIsGuideHovered(false)
            hideTooltip()
          }}
          aria-label="Thông tin hướng dẫn thao tác vẽ xương"
        >
          <IconStageGuide width={15} height={15} />
        </button>
      </div>

      {/* Bảng hiển thị thông tin thao tác tại vùng khoanh đỏ phía dưới thanh dock */}
      {showGuideCard && (
        <div
          className={`lw-stage-guide-card tone-${statusTone} is-expanded`}
          data-mcp-region="layer_assembly_stage_guide"
        >
          <div className="lw-stage-guide-status" onClick={toggleGuidePinned}>
            <span className={`lw-stage-guide-dot tone-${statusTone}`} />
            <span className="lw-stage-guide-status-text">{statusBadgeText}</span>
            <button
              type="button"
              className="lw-stage-guide-close-btn"
              onClick={(e) => {
                e.stopPropagation()
                setIsGuidePinned(false)
                try {
                  localStorage.setItem('pxs:stage-guide-pinned', 'false')
                } catch {}
              }}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '12px'
              }}
              title="Đóng bảng hướng dẫn"
            >
              ✕
            </button>
          </div>
          <div className="lw-stage-guide-body">
            {rigTool.statusHint && <div className="lw-stage-guide-live-hint">{rigTool.statusHint}</div>}
            <div className="lw-stage-guide-rules">
              <div className="lw-stage-guide-rule">
                <span className="lw-stage-guide-tag weld">Hàn khớp</span>
                <span>Rê gần bán kính 2 điểm gốc/ngọn (≤24px) rồi kéo → Hàn khớp (1 nét).</span>
              </div>
              <div className="lw-stage-guide-rule">
                <span className="lw-stage-guide-tag capsule">Vỏ uốn (2 nét)</span>
                <span>Kéo từ vỏ uốn → Nét 1 tạo nét đứt · Kéo Nét 2 tạo xương (Esc huỷ Nét 1).</span>
              </div>
              <div className="lw-stage-guide-rule">
                <span className="lw-stage-guide-tag outside">Ngoài vỏ (1 nét)</span>
                <span>Kéo ngoài vỏ khi đang focus → Tự bắt tâm gần nhất làm nét đứt & tạo xương luôn.</span>
              </div>
              <div className="lw-stage-guide-rule">
                <span className="lw-stage-guide-tag detach">Chọn / Esc</span>
                <span>Click vỏ/xương để focus · Nhấn Esc huỷ vẽ hoặc bỏ focus để tạo xương rời (cánh rồng).</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
