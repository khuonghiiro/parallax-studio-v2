import type { ChromaKeySettings, CutToolMode } from './types'
import {
  IconWand,
  IconDropper,
  IconCrop,
  IconSelectPointer,
  IconEraser,
  IconBrush
} from '../../icons'

export type CutterTagVisibility = 'hover' | 'always' | 'hidden'

export interface SpriteCutterSourceToolbarProps {
  tool: CutToolMode
  islandCount: number
  minIslandArea: number
  tagVisibility: CutterTagVisibility
  chroma: ChromaKeySettings
  isPickingColor: boolean
  onSelectTool: (tool: CutToolMode) => void
  onChangeMinIslandArea: (value: number) => void
  onChangeTagVisibility: (value: CutterTagVisibility) => void
  onChangeChroma: (next: ChromaKeySettings) => void
  onTogglePicking: () => void
}

const TOOL_BUTTONS: Array<{
  id: CutToolMode
  label: string
  title: string
  Icon: typeof IconWand
}> = [
  { id: 'auto', label: 'Quét tự động', title: 'Tự động phát hiện các đảo pixel không dính nhau', Icon: IconWand },
  { id: 'box', label: 'Khung chữ nhật', title: 'Kéo chuột vẽ khung chữ nhật bao quanh bộ phận', Icon: IconCrop },
  { id: 'lasso', label: 'Lasso', title: 'Vẽ vùng chọn tự do theo hình dáng', Icon: IconSelectPointer },
  { id: 'eraser', label: 'Cọ tẩy', title: 'Cọ tẩy: Quét chuột để xóa viền xanh hoặc chi tiết thừa (Ctrl+Z để hoàn tác)', Icon: IconEraser },
  { id: 'restore', label: 'Khôi phục', title: 'Khôi phục: Quét chuột để lấy lại pixel gốc nguyên bản (Ctrl+Z để hoàn tác)', Icon: IconBrush }
]

const TAG_MODES: Array<{ id: CutterTagVisibility; label: string; title: string }> = [
  { id: 'hover', label: 'Rê chuột', title: 'Chỉ hiện nhãn khi rê chuột hoặc click chọn' },
  { id: 'always', label: 'Hiện', title: 'Luôn hiện tất cả nhãn kích thước' },
  { id: 'hidden', label: 'Ẩn', title: 'Ẩn toàn bộ nhãn để nhìn chi tiết rõ nhất' }
]

const PREVIEW_BGS: Array<{ id: ChromaKeySettings['previewBackground']; label: string }> = [
  { id: 'checkerboard', label: 'Caro' },
  { id: 'dark', label: 'Tối' },
  { id: 'light', label: 'Sáng' }
]

/** Hàng 1: chọn công cụ cắt + tuỳ chọn theo ngữ cảnh (lọc hạt, nhãn, gợi ý). */
function CutterToolRow(props: SpriteCutterSourceToolbarProps) {
  const { tool, islandCount, minIslandArea, tagVisibility } = props
  return (
    <div className="layer-cutter-toolbar layer-cutter-toolbar-row">
      <div className="layer-cutter-tool-group">
        {TOOL_BUTTONS.map(({ id, label, title, Icon }) => (
          <button
            key={id}
            id={`btn-tool-${id}`}
            type="button"
            className={`layer-cutter-tool-btn ${tool === id ? 'active' : ''}`}
            onClick={() => props.onSelectTool(id)}
            title={title}
          >
            <Icon width={12} height={12} /> {label}
            {id === 'auto' ? ` (${islandCount})` : ''}
          </button>
        ))}
      </div>

      {tool === 'auto' && (
        <div className="layer-cutter-toolbar-right">
          <div className="layer-cutter-control-pill" title="Lọc bỏ các hạt nhiễu nhỏ hơn diện tích này">
            <span>Lọc hạt:</span>
            <input
              type="range"
              min={40}
              max={400}
              step={10}
              value={minIslandArea}
              onChange={(e) => props.onChangeMinIslandArea(Number(e.target.value))}
            />
            <span className="layer-cutter-val-mono">{minIslandArea}px</span>
          </div>
          <div className="layer-cutter-seg-mini" title="Chế độ hiển thị nhãn kích thước trên từng mảnh">
            <span className="seg-label">Nhãn:</span>
            {TAG_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`seg-btn ${tagVisibility === m.id ? 'active' : ''}`}
                onClick={() => props.onChangeTagVisibility(m.id)}
                title={m.title}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(tool === 'box' || tool === 'lasso') && (
        <div className="layer-cutter-toolbar-right">
          <span className="layer-cutter-inline-tip">
            {tool === 'box'
              ? 'Kéo chuột bao quanh bộ phận cần cắt'
              : 'Vẽ đường viền khép kín quanh bộ phận cần tách'}
          </span>
        </div>
      )}
    </div>
  )
}

/** Hàng 2: thanh Chroma Key gọn (bật/tắt, màu khoá, độ nhạy, khử viền, nền xem trước). */
function CutterChromaRow(props: SpriteCutterSourceToolbarProps) {
  const { chroma, isPickingColor, onChangeChroma, onTogglePicking } = props
  return (
    <div className="layer-cutter-toolbar layer-cutter-chroma-bar">
      <label className="layer-cutter-switch-pill" title="Bật/tắt tự động tách phông nền màu đồng nhất">
        <input
          type="checkbox"
          checked={chroma.enabled}
          onChange={(e) => onChangeChroma({ ...chroma, enabled: e.target.checked })}
        />
        <span>Tách nền Chroma</span>
      </label>

      {chroma.enabled && (
        <>
          <div className="layer-cutter-control-pill">
            <span>Màu khóa:</span>
            <button
              type="button"
              className="layer-cutter-color-swatch"
              style={{ backgroundColor: chroma.keyColor }}
              title={`Màu nền đang tách: ${chroma.keyColor} (Click để hút màu trên ảnh)`}
              onClick={onTogglePicking}
            />
            <button
              type="button"
              className={`layer-cutter-eyedropper-btn ${isPickingColor ? 'active' : ''}`}
              title="Click lên vùng nền của ảnh để lấy màu tách nền chính xác"
              onClick={onTogglePicking}
            >
              <IconDropper width={11} height={11} />
              <span>{isPickingColor ? 'Chấm lên ảnh…' : 'Hút màu'}</span>
            </button>
          </div>
          <div className="layer-cutter-control-pill" title="Ngưỡng độ nhạy tách màu nền">
            <span>Độ nhạy:</span>
            <input
              type="range"
              min={1}
              max={100}
              value={chroma.tolerance}
              onChange={(e) => onChangeChroma({ ...chroma, tolerance: Number(e.target.value) })}
            />
            <span className="layer-cutter-val-mono">{chroma.tolerance}%</span>
          </div>
          <label className="layer-cutter-check-pill" title="Khử ám màu nền bám quanh mép bộ phận">
            <input
              type="checkbox"
              checked={chroma.despill}
              onChange={(e) => onChangeChroma({ ...chroma, despill: e.target.checked })}
            />
            <span>Khử viền</span>
          </label>
        </>
      )}

      <div className="layer-cutter-toolbar-right">
        <div className="layer-cutter-seg-mini" title="Đổi phông nền kiểm tra viền tách">
          <span className="seg-label">Nền:</span>
          {PREVIEW_BGS.map((bg) => (
            <button
              key={bg.id}
              type="button"
              className={`seg-btn ${chroma.previewBackground === bg.id ? 'active' : ''}`}
              onClick={() => onChangeChroma({ ...chroma, previewBackground: bg.id })}
            >
              {bg.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SpriteCutterSourceToolbar(props: SpriteCutterSourceToolbarProps) {
  return (
    <>
      <CutterToolRow {...props} />
      <CutterChromaRow {...props} />
    </>
  )
}
