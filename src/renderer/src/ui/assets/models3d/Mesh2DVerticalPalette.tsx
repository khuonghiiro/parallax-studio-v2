import {
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
}

export function Mesh2DVerticalPalette({
  tool,
  setTool,
  selectedCellsCount,
  onClearSelection,
  onResetView
}: Mesh2DVerticalPaletteProps) {
  return (
    <div className="mesh2d-vertical-palette">
      <button
        type="button"
        className={`mesh2d-v-tool-btn${tool === 'bbox-select' ? ' active' : ''}`}
        onClick={() => setTool('bbox-select')}
        title="Chọn ô (BBox): Kéo chuột trái vẽ hộp để chọn ô lưới (Giữ Alt để bỏ chọn)"
      >
        <IconMarquee size={18} />
      </button>

      <button
        type="button"
        className={`mesh2d-v-tool-btn gold${tool === 'pin' ? ' active' : ''}`}
        onClick={() => setTool('pin')}
        title="Ghim cố định (Pin Tool): Nhấn hoặc kéo vào ô để ghim giữ nguyên vị trí (Alt để gỡ ghim)"
      >
        <IconPin size={18} />
      </button>

      <div className="mesh2d-palette-divider" />

      <button
        type="button"
        className={`mesh2d-v-tool-btn danger${tool === 'erase' ? ' active' : ''}`}
        onClick={() => setTool('erase')}
        title="Gọt ô thừa (E): Kéo chuột để ẩn/loại bỏ các ô lưới ngoài viền"
      >
        <IconScissors size={18} />
      </button>

      <button
        type="button"
        className={`mesh2d-v-tool-btn${tool === 'restore' ? ' active' : ''}`}
        onClick={() => setTool('restore')}
        title="Khôi phục ô (R): Kéo chuột để phục hồi các ô đã bị gọt"
      >
        <IconUndo size={18} />
      </button>

      <div className="mesh2d-palette-divider" />

      <button
        type="button"
        className={`mesh2d-v-tool-btn${tool === 'pan' ? ' active' : ''}`}
        onClick={() => setTool('pan')}
        title="Di chuyển khung nhìn (V): Kéo chuột để Pan (hoặc giữ chuột giữa / chuột phải)"
      >
        <IconHand size={18} />
      </button>

      <button
        type="button"
        className="mesh2d-v-tool-btn"
        onClick={onResetView}
        title="Khôi phục góc nhìn 100% (Fit)"
      >
        <IconFit size={18} />
      </button>

      {selectedCellsCount > 0 && (
        <button
          type="button"
          className="mesh2d-v-tool-btn"
          onClick={onClearSelection}
          title="Bỏ chọn tất cả các ô"
        >
          <IconX size={18} />
        </button>
      )}
    </div>
  )
}
