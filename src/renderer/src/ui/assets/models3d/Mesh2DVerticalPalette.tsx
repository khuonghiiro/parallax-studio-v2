import { useState } from 'react'
import {
  IconMarquee,
  IconPin,
  IconScissors,
  IconUndo,
  IconHand,
  IconFit,
  IconX,
  IconWarpGrid,
  IconOrigamiFold
} from '../../icons'

export type EditorTool = 'bbox-select' | 'pin' | 'warp3x3' | 'fold' | 'erase' | 'restore' | 'pan'

interface TooltipMeta {
  title: string
  desc: string
  shortcut?: string
  tag?: string
  top: number
  right: number
}

interface Mesh2DVerticalPaletteProps {
  tool: EditorTool
  setTool: (t: EditorTool) => void
  selectedCellsCount: number
  onClearSelection: () => void
  onResetView: () => void
}

export function Mesh2DVerticalPalette({
  tool,
  setTool,
  selectedCellsCount,
  onClearSelection,
  onResetView
}: Mesh2DVerticalPaletteProps) {
  const [tooltip, setTooltip] = useState<TooltipMeta | null>(null)

  const showTooltip = (
    e: React.MouseEvent<HTMLElement>,
    info: { title: string; desc: string; shortcut?: string; tag?: string }
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      ...info,
      top: rect.top + rect.height / 2,
      right: rect.right
    })
  }

  const hideTooltip = () => setTooltip(null)

  return (
    <div className="mesh2d-vertical-palette" onMouseLeave={hideTooltip}>
      {/* 1. Marquee BBox Select Tool */}
      <button
        type="button"
        className={`mesh2d-v-tool-btn${tool === 'bbox-select' ? ' active' : ''}`}
        onClick={() => setTool('bbox-select')}
        onMouseEnter={(e) =>
          showTooltip(e, {
            title: 'Chọn ô lưới (Marquee Tool)',
            desc: 'Kéo chuột trái vẽ hộp để chọn hàng loạt ô lưới uốn (Giữ Alt để bỏ chọn)',
            shortcut: 'B',
            tag: 'Lưới Mesh'
          })
        }
        onMouseLeave={hideTooltip}
      >
        <IconMarquee size={18} />
      </button>

      {/* 2. Starch Pin (Puppet Pin) */}
      <button
        type="button"
        className={`mesh2d-v-tool-btn gold${tool === 'pin' ? ' active' : ''}`}
        onClick={() => setTool('pin')}
        onMouseEnter={(e) =>
          showTooltip(e, {
            title: 'Ghim cố định (Starch Pin)',
            desc: 'Nhấn hoặc kéo vào ô để ghim giữ nguyên vị trí, không bị đung đưa khi tạo hoạt ảnh (Alt để gỡ)',
            shortcut: 'P',
            tag: 'Puppet Pin'
          })
        }
        onMouseLeave={hideTooltip}
      >
        <IconPin size={18} />
      </button>

      <div className="mesh2d-palette-divider" />

      {/* 3. Photoshop 3x3 Warp Grid & Stairs */}
      <button
        type="button"
        className={`mesh2d-v-tool-btn cyan${tool === 'warp3x3' ? ' active' : ''}`}
        onClick={() => setTool('warp3x3')}
        onMouseEnter={(e) =>
          showTooltip(e, {
            title: 'Lưới uốn 3×3 & Bậc thang',
            desc: 'Khung lưới 3×3 chuẩn Photoshop Warp: Tạo nếp gấp cầu thang, vòm cong hoặc uốn góc dễ dàng',
            shortcut: '3',
            tag: 'Photoshop Warp'
          })
        }
        onMouseLeave={hideTooltip}
      >
        <IconWarpGrid size={18} />
      </button>

      {/* 4. Origami 3D Fold Line */}
      <button
        type="button"
        className={`mesh2d-v-tool-btn amber${tool === 'fold' ? ' active' : ''}`}
        onClick={() => setTool('fold')}
        onMouseEnter={(e) =>
          showTooltip(e, {
            title: 'Nếp gấp Origami 3D',
            desc: 'Kẻ đường line thẳng hoặc chéo qua ảnh, chọn 1 trong 2 nửa để gấp thành hộp hoặc mái dốc 3D',
            shortcut: 'L',
            tag: 'Gấp Origami'
          })
        }
        onMouseLeave={hideTooltip}
      >
        <IconOrigamiFold size={18} />
      </button>

      <div className="mesh2d-palette-divider" />

      {/* 5. Scissors Erase */}
      <button
        type="button"
        className={`mesh2d-v-tool-btn danger${tool === 'erase' ? ' active' : ''}`}
        onClick={() => setTool('erase')}
        onMouseEnter={(e) =>
          showTooltip(e, {
            title: 'Gọt ô thừa ngoài viền',
            desc: 'Kéo chuột để gọt bỏ các góc ô lưới thừa không mong muốn',
            shortcut: 'E',
            tag: 'Cắt tỉa'
          })
        }
        onMouseLeave={hideTooltip}
      >
        <IconScissors size={18} />
      </button>

      {/* 6. Undo Restore */}
      <button
        type="button"
        className={`mesh2d-v-tool-btn${tool === 'restore' ? ' active' : ''}`}
        onClick={() => setTool('restore')}
        onMouseEnter={(e) =>
          showTooltip(e, {
            title: 'Khôi phục ô lưới',
            desc: 'Kéo chuột để khôi phục lại các ô lưới đã bị gọt tỉa',
            shortcut: 'R',
            tag: 'Phục hồi'
          })
        }
        onMouseLeave={hideTooltip}
      >
        <IconUndo size={18} />
      </button>

      <div className="mesh2d-palette-divider" />

      {/* 7. Pan Hand */}
      <button
        type="button"
        className={`mesh2d-v-tool-btn${tool === 'pan' ? ' active' : ''}`}
        onClick={() => setTool('pan')}
        onMouseEnter={(e) =>
          showTooltip(e, {
            title: 'Di chuyển khung nhìn (Hand)',
            desc: 'Kéo chuột để di chuyển khung hình (hoặc giữ chuột giữa / chuột phải)',
            shortcut: 'V',
            tag: 'Điều hướng'
          })
        }
        onMouseLeave={hideTooltip}
      >
        <IconHand size={18} />
      </button>

      {/* 8. Reset Fit 100% */}
      <button
        type="button"
        className="mesh2d-v-tool-btn"
        onClick={onResetView}
        onMouseEnter={(e) =>
          showTooltip(e, {
            title: 'Khôi phục tỉ lệ 100%',
            desc: 'Đặt lại góc nhìn vừa vặn và tỉ lệ phóng 100%',
            shortcut: '0',
            tag: 'Góc nhìn'
          })
        }
        onMouseLeave={hideTooltip}
      >
        <IconFit size={18} />
      </button>

      {/* 9. Deselect All */}
      {selectedCellsCount > 0 && (
        <button
          type="button"
          className="mesh2d-v-tool-btn"
          onClick={onClearSelection}
          onMouseEnter={(e) =>
            showTooltip(e, {
              title: `Bỏ chọn (${selectedCellsCount} ô)`,
              desc: 'Hủy chọn toàn bộ các ô lưới đang chọn',
              shortcut: 'Esc',
              tag: 'Thao tác'
            })
          }
          onMouseLeave={hideTooltip}
        >
          <IconX size={18} />
        </button>
      )}

      {/* Floating Tooltip — identical to main screen vertical tab tooltip */}
      {tooltip && (
        <div
          className="vertical-tab-tooltip"
          role="tooltip"
          style={{
            position: 'fixed',
            left: tooltip.right + 10,
            top: tooltip.top,
            transform: 'translateY(-50%)',
            zIndex: 99999
          }}
        >
          <div
            className="tooltip-title"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text)'
            }}
          >
            <span>{tooltip.title}</span>
            {tooltip.tag && <span className="tooltip-tag-system tag-cyan">{tooltip.tag}</span>}
          </div>
          <div
            className="tooltip-desc"
            style={{
              fontSize: 10,
              color: 'var(--text-dim)',
              marginTop: 3,
              lineHeight: 1.35
            }}
          >
            {tooltip.desc}
          </div>
          {tooltip.shortcut && (
            <div
              className="tooltip-count"
              style={{
                fontSize: 9.5,
                color: 'var(--accent-cyan)',
                marginTop: 4,
                fontWeight: 600
              }}
            >
              ⌨️ Phím tắt: {tooltip.shortcut}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
