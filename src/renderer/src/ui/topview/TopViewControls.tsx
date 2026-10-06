import type { Vec3 } from '@shared/types'
import {
  moveLayer,
  moveLayerToBottom,
  moveLayerToTop,
  nudgeLayerPosition
} from '../../actions'
import { evaluate } from '../../animation/keyframes'
import { useEditor } from '../../store/editor'
import {
  IconDown,
  IconUp
} from '../icons'

interface TopViewControlsProps {
  selectedLayerId: string | null
}

export function TopViewControls({ selectedLayerId }: TopViewControlsProps) {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)

  if (!selectedLayerId) return null

  const layer = project.layers.find((l) => l.id === selectedLayerId)
  if (!layer) return null

  const pos = evaluate(layer.transform.position, time) as Vec3
  const [posX, posY, posZ] = pos

  // Calculate layer index within its shot
  const shotLayers = project.layers.filter((l) => l.shotId === layer.shotId)
  const indexInShot = shotLayers.findIndex((l) => l.id === layer.id)
  const totalInShot = shotLayers.length

  const handleNudge = (dx: number, dy: number, dz: number) => {
    nudgeLayerPosition(layer.id, dx, dy, dz)
  }

  const handleCenter = () => {
    nudgeLayerPosition(layer.id, -posX, -posY, 0)
  }

  return (
    <div className="topview-floating-bar" onClick={(e) => e.stopPropagation()}>
      <div className="topview-bar-header">
        <span>Layer:</span>
        <span className="topview-bar-layer-name" title={layer.name}>
          {layer.name}
        </span>
        <span className="topview-bar-coords">
          X: {Math.round(posX)} · Y: {Math.round(posY)} · Z: {Math.round(posZ)} · Tầng: #{indexInShot + 1}/{totalInShot}
        </span>
      </div>

      <div className="topview-bar-actions">
        {/* Horizontal (X) Nudge */}
        <div className="topview-btn-group" title="Di chuyển Sang Trái / Sang Phải (Trục X)">
          <span className="topview-btn-group-label">X</span>
          <button
            type="button"
            className="btn sm icon"
            onClick={() => handleNudge(-50, 0, 0)}
            title="Sang Trái (-50px)"
          >
            ◀
          </button>
          <button
            type="button"
            className="btn sm icon"
            onClick={() => handleNudge(50, 0, 0)}
            title="Sang Phải (+50px)"
          >
            ▶
          </button>
        </div>

        {/* Vertical (Y) Nudge */}
        <div className="topview-btn-group" title="Di chuyển Lên / Xuống (Trục Y trong 3D)">
          <span className="topview-btn-group-label">Y</span>
          <button
            type="button"
            className="btn sm icon"
            onClick={() => handleNudge(0, -30, 0)}
            title="Lên Trên (-30px)"
          >
            ▲
          </button>
          <button
            type="button"
            className="btn sm icon"
            onClick={() => handleNudge(0, 30, 0)}
            title="Xuống Dưới (+30px)"
          >
            ▼
          </button>
        </div>

        {/* Depth (Z) Nudge */}
        <div className="topview-btn-group" title="Di chuyển Độ Sâu Trước / Sau (Trục Z)">
          <span className="topview-btn-group-label">Z</span>
          <button
            type="button"
            className="btn sm icon"
            onClick={() => handleNudge(0, 0, -100)}
            title="Gần Camera hơn (-100px Z)"
          >
            <IconUp width={12} height={12} />
          </button>
          <button
            type="button"
            className="btn sm icon"
            onClick={() => handleNudge(0, 0, 100)}
            title="Xa Camera hơn (+100px Z)"
          >
            <IconDown width={12} height={12} />
          </button>
        </div>

        {/* Z-Index / Stack Ordering */}
        <div className="topview-btn-group" title="Thứ tự hiển thị Z-Index (Xếp chồng layer)">
          <span className="topview-btn-group-label">Thứ tự</span>
          <button
            type="button"
            className="btn sm icon"
            onClick={() => moveLayer(layer.id, -1)}
            title="Đẩy lên trước 1 bậc"
            disabled={indexInShot === 0}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn sm icon"
            onClick={() => moveLayer(layer.id, 1)}
            title="Đẩy về sau 1 bậc"
            disabled={indexInShot === totalInShot - 1}
          >
            ↓
          </button>
          <button
            type="button"
            className="btn sm icon"
            onClick={() => moveLayerToTop(layer.id)}
            title="Lên trên cùng (Front)"
            disabled={indexInShot === 0}
          >
            ⤒
          </button>
          <button
            type="button"
            className="btn sm icon"
            onClick={() => moveLayerToBottom(layer.id)}
            title="Xuống dưới cùng (Back)"
            disabled={indexInShot === totalInShot - 1}
          >
            ⤓
          </button>
        </div>

        {/* Center Button */}
        <button
          type="button"
          className="btn sm"
          onClick={handleCenter}
          title="Đặt layer về tâm cảnh (X: 0, Y: 0)"
          style={{ marginLeft: 'auto' }}
        >
          🎯 Giữa
        </button>
      </div>
    </div>
  )
}
