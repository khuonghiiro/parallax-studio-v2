import type { Face3D } from './types'
import type { FaceEdge } from './assemblyGeometry'
import { EDGE_LABELS, aspectHeight } from './assemblyFaceOps'
import { FACE_ALPHA_CUTOFF } from './assemblyMeshFactory'

interface FaceShapeToolsProps {
  face: Face3D
  /** Natural size of the face image (null while loading / untextured). */
  imageSize: { width: number; height: number } | null
  onUpdate: (patch: Partial<Face3D>) => void
  onFold: (edge: FaceEdge) => void
  onCenterModel: () => void
}

const EDGES: FaceEdge[] = ['top', 'left', 'right', 'bottom']

/**
 * Quick construction tools for the selected face: fold a new plane from an edge (paper-
 * craft style), match the image aspect ratio, centre the model and set face opacity.
 */
export function FaceShapeTools({ face, imageSize, onUpdate, onFold, onCenterModel }: FaceShapeToolsProps) {
  const opacity = face.opacity ?? 1
  const alphaCutoff = face.alphaCutoff ?? FACE_ALPHA_CUTOFF
  const fitHeight = imageSize ? aspectHeight(face, imageSize.width, imageSize.height) : face.height
  const canFit = Boolean(imageSize) && fitHeight !== face.height

  return (
    <div className="fst-root">
      <div className="fst-label">Gập thêm mặt từ cạnh</div>
      <div className="fst-fold-pad" role="group" aria-label="Gập mặt mới từ cạnh">
        {EDGES.map((edge) => (
          <button
            key={edge}
            type="button"
            className={`fst-fold-btn fst-${edge}`}
            onClick={() => onFold(edge)}
            title={`Tạo mặt mới gập 90° ra sau từ cạnh ${EDGE_LABELS[edge]}`}
          >
            {EDGE_LABELS[edge]}
          </button>
        ))}
        <span className="fst-fold-face" aria-hidden="true" />
      </div>

      <div className="fst-actions">
        <button
          type="button"
          className="btn secondary fst-btn"
          disabled={!canFit}
          onClick={() => onUpdate({ height: fitHeight })}
          title={imageSize ? `Giữ chiều rộng, đặt chiều cao ${fitHeight} theo tỉ lệ ảnh ${imageSize.width}×${imageSize.height}` : 'Mặt chưa có ảnh'}
        >
          Khớp tỉ lệ ảnh
        </button>
        <button type="button" className="btn secondary fst-btn" onClick={onCenterModel} title="Dời toàn bộ mô hình để tâm khung bao về gốc tọa độ">
          Căn giữa mô hình
        </button>
      </div>

      <label className="fst-opacity" title="Độ mờ của mặt (dưới 100% sẽ hòa trộn trong suốt)">
        <span>Độ mờ</span>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
        />
        <span className="fst-value">{Math.round(opacity * 100)}%</span>
      </label>

      <label className="fst-opacity" title="Ngưỡng cắt alpha: hạ thấp (1-8%) để giữ ngọn cỏ, lông, lá cây mảnh; tăng lên nếu muốn viền cắt gọn">
        <span>Lọc alpha</span>
        <input
          type="range"
          min={0.01}
          max={0.5}
          step={0.01}
          value={alphaCutoff}
          onChange={(e) => onUpdate({ alphaCutoff: Number(e.target.value) })}
        />
        <span className="fst-value">{Math.round(alphaCutoff * 100)}%</span>
      </label>
    </div>
  )
}
