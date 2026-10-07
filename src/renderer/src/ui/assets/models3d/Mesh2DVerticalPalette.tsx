import { useState } from 'react'
import {
  IconEye,
  IconEyeOff,
  IconMarquee,
  IconPin,
  IconScissors,
  IconUndo,
  IconHand,
  IconFit,
  IconX
} from '../../icons'

export type EditorTool = 'bbox-select' | 'pin' | 'erase' | 'restore' | 'pan'

interface Mesh2DVerticalPaletteProps {
  tool: EditorTool
  setTool: (t: EditorTool) => void
  selectedCellsCount: number
  onClearSelection: () => void
  onResetView: () => void
  showMesh?: boolean
  onToggleMesh?: () => void
}

interface ToolItemDef {
  title: string
  tag: string
  tagType: 'cyan' | 'amber' | 'red' | 'green' | 'blue'
  desc: string
  tip?: string
}

const TOOL_DEFS: Record<string, ToolItemDef> = {
  'bbox-select': {
    title: 'Chọn ô lưới (BBox)',
    tag: 'Công cụ',
    tagType: 'cyan',
    desc: 'Kéo chuột trái vẽ hộp để chọn hàng loạt ô lưới trên mặt phẳng ảnh.',
    tip: '💡 Giữ phím Alt để chuyển sang bỏ chọn ô'
  },
  pin: {
    title: 'Ghim cố định (Pin Tool)',
    tag: 'Điểm neo',
    tagType: 'amber',
    desc: 'Nhấn hoặc quét chuột vào các ô lưới để ghim giữ cố định vị trí khi uốn cong 3D.',
    tip: '💡 Giữ phím Alt để gỡ ghim ô lưới'
  },
  erase: {
    title: 'Gọt ô thừa (Erase Mesh)',
    tag: 'Gọt tỉa',
    tagType: 'red',
    desc: 'Kéo chuột để gọt tỉa, ẩn các ô lưới ngoài viền hoặc phần ảnh trong suốt.',
    tip: '✂️ Giúp giảm tải mesh và bo mượt viền ảnh'
  },
  restore: {
    title: 'Khôi phục ô (Restore)',
    tag: 'Phục hồi',
    tagType: 'green',
    desc: 'Kéo chuột qua các ô đã gọt để khôi phục lại cấu trúc lưới ban đầu.',
    tip: '🔄 Hoàn tác phục hồi các ô lưới đã cắt'
  },
  pan: {
    title: 'Di chuyển (Pan Tool)',
    tag: 'Khung nhìn',
    tagType: 'cyan',
    desc: 'Kéo chuột trái để di chuyển toàn bộ vùng làm việc của mặt phẳng 2D.',
    tip: '✋ Hoặc giữ chuột giữa / chuột phải để Pan'
  },
  fit: {
    title: 'Căn vừa khung hình',
    tag: 'Tỉ lệ',
    tagType: 'cyan',
    desc: 'Tự động co giãn ảnh vừa vặn với kích thước màn hình làm việc.',
    tip: '🎯 Đặt lại tọa độ Pan về tâm (0, 0)'
  },
  clear: {
    title: 'Bỏ chọn toàn bộ',
    tag: 'Vùng chọn',
    tagType: 'amber',
    desc: 'Hủy bỏ toàn bộ các ô lưới đang được chọn hiện tại.',
    tip: '⚡ Xóa nhanh vùng chọn ô lưới'
  },
  'toggle-mesh': {
    title: 'Bật/tắt lưới Mesh 2D',
    tag: 'Hiển thị',
    tagType: 'cyan',
    desc: 'Bật hoặc ẩn các đường lưới chia ô Mesh trên bề mặt để xem ảnh texture nguyên bản rõ nét.',
    tip: '💡 Nhấn để ẩn / hiện lưới Mesh'
  }
}

interface TooltipState {
  title: string
  tag?: string
  tagType?: string
  desc: string
  tip?: string
  top: number
  right: number
}

export function Mesh2DVerticalPalette({
  tool,
  setTool,
  selectedCellsCount,
  onClearSelection,
  onResetView,
  showMesh = true,
  onToggleMesh
}: Mesh2DVerticalPaletteProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const showTooltip = (e: React.MouseEvent<HTMLElement>, key: string) => {
    const def = TOOL_DEFS[key]
    if (!def) return
    const rect = e.currentTarget.getBoundingClientRect()
    let dynamicTag = def.tag
    let dynamicTagType = def.tagType
    if (key === 'clear' && selectedCellsCount > 0) {
      dynamicTag = `${selectedCellsCount} ô`
    } else if (key === 'toggle-mesh') {
      dynamicTag = showMesh ? 'Đang bật' : 'Đang tắt'
      dynamicTagType = showMesh ? 'cyan' : 'amber'
    }

    setTooltip({
      title: def.title,
      tag: dynamicTag,
      tagType: dynamicTagType,
      desc: def.desc,
      tip: def.tip,
      top: rect.top + rect.height / 2,
      right: rect.right
    })
  }

  const hideTooltip = () => setTooltip(null)

  return (
    <div className="mesh2d-vertical-palette" onScroll={hideTooltip}>
      <button
        type="button"
        className={`mesh2d-v-tool-btn${tool === 'bbox-select' ? ' active' : ''}`}
        onClick={() => {
          setTool('bbox-select')
          hideTooltip()
        }}
        onMouseEnter={(e) => showTooltip(e, 'bbox-select')}
        onMouseLeave={hideTooltip}
        aria-label="Chọn ô lưới (BBox Tool)"
      >
        <IconMarquee size={18} />
      </button>

      <button
        type="button"
        className={`mesh2d-v-tool-btn gold${tool === 'pin' ? ' active' : ''}`}
        onClick={() => {
          setTool('pin')
          hideTooltip()
        }}
        onMouseEnter={(e) => showTooltip(e, 'pin')}
        onMouseLeave={hideTooltip}
        aria-label="Ghim cố định (Pin Tool)"
      >
        <IconPin size={18} />
      </button>

      <div className="mesh2d-palette-divider" />

      <button
        type="button"
        className={`mesh2d-v-tool-btn danger${tool === 'erase' ? ' active' : ''}`}
        onClick={() => {
          setTool('erase')
          hideTooltip()
        }}
        onMouseEnter={(e) => showTooltip(e, 'erase')}
        onMouseLeave={hideTooltip}
        aria-label="Gọt ô thừa (Erase Mesh)"
      >
        <IconScissors size={18} />
      </button>

      <button
        type="button"
        className={`mesh2d-v-tool-btn${tool === 'restore' ? ' active' : ''}`}
        onClick={() => {
          setTool('restore')
          hideTooltip()
        }}
        onMouseEnter={(e) => showTooltip(e, 'restore')}
        onMouseLeave={hideTooltip}
        aria-label="Khôi phục ô (Restore Mesh)"
      >
        <IconUndo size={18} />
      </button>

      <div className="mesh2d-palette-divider" />

      <button
        type="button"
        className={`mesh2d-v-tool-btn${tool === 'pan' ? ' active' : ''}`}
        onClick={() => {
          setTool('pan')
          hideTooltip()
        }}
        onMouseEnter={(e) => showTooltip(e, 'pan')}
        onMouseLeave={hideTooltip}
        aria-label="Di chuyển khung nhìn (Pan Tool)"
      >
        <IconHand size={18} />
      </button>

      <button
        type="button"
        className="mesh2d-v-tool-btn"
        onClick={() => {
          onResetView()
          hideTooltip()
        }}
        onMouseEnter={(e) => showTooltip(e, 'fit')}
        onMouseLeave={hideTooltip}
        aria-label="Căn vừa khung nhìn (Fit View)"
      >
        <IconFit size={18} />
      </button>

      {onToggleMesh && (
        <button
          type="button"
          className={`mesh2d-v-tool-btn${showMesh ? ' active' : ''}`}
          onClick={() => {
            onToggleMesh()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'toggle-mesh')}
          onMouseLeave={hideTooltip}
          aria-label="Bật/tắt hiển thị lưới Mesh"
        >
          {showMesh ? <IconEye size={18} /> : <IconEyeOff size={18} />}
        </button>
      )}

      {selectedCellsCount > 0 && (
        <button
          type="button"
          className="mesh2d-v-tool-btn"
          onClick={() => {
            onClearSelection()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'clear')}
          onMouseLeave={hideTooltip}
          aria-label="Bỏ chọn tất cả các ô"
        >
          <IconX size={18} />
        </button>
      )}

      {/* Floating Tooltip outside palette container matching BuiltInAssetBar */}
      {tooltip && (
        <div
          className="vertical-tab-tooltip"
          role="tooltip"
          style={{
            position: 'fixed',
            left: tooltip.right + 8,
            top: tooltip.top,
            transform: 'translateY(-50%)',
            zIndex: 20000
          }}
        >
          <div className="tooltip-title">
            <span>{tooltip.title}</span>
            {tooltip.tag && (
              <span className={`tooltip-tag-system tag-${tooltip.tagType || 'cyan'}`}>
                {tooltip.tag}
              </span>
            )}
          </div>
          <div className="tooltip-desc">{tooltip.desc}</div>
          {tooltip.tip && (
            <div className="tooltip-count">
              <span>{tooltip.tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
