import { useState } from 'react'
import type { Face3D } from './types'
import { joinFaces, JOIN_EDGE_LABELS, type JoinEdge, type JoinScaleMode } from './assemblyJoin'
import { IconLink } from '../../icons'

interface FaceJoinSectionProps {
  currentFace: Face3D
  allFaces: Face3D[]
  onApplyJoin: (updatedFaces: Face3D[]) => void
}

export function FaceJoinSection({ currentFace, allFaces, onApplyJoin }: FaceJoinSectionProps) {
  const otherFaces = allFaces.filter((f) => f.id !== currentFace.id)
  const [targetId, setTargetId] = useState<string>(otherFaces[0]?.id || '')
  const [targetEdge, setTargetEdge] = useState<JoinEdge>('left')
  const [sourceEdge, setSourceEdge] = useState<JoinEdge>('right')
  const [angle, setAngle] = useState<number>(90)
  const [scaleMode, setScaleMode] = useState<JoinScaleMode>('longest')
  const [flip, setFlip] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (otherFaces.length === 0) return null

  const handleExecuteJoin = () => {
    setErrorMsg(null)
    try {
      const res = joinFaces(allFaces, {
        targetId,
        sourceId: currentFace.id,
        targetEdge,
        sourceEdge,
        angle,
        scaleMode,
        flip
      })
      onApplyJoin(res.faces)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <details className="inspector-section fi-collapsible">
      <summary className="section-title">
        <span className="section-title-with-icon">
          <IconLink width={13} height={13} />
          <span>Ghép hít cạnh (Khớp kín góc)</span>
        </span>
      </summary>

      <div className="adv-join-content">
        <div className="adv-desc">
          Tự động căn khít Start/End giữa 2 cạnh ảnh. Cạnh ngắn hơn sẽ tự động tăng kích thước theo cạnh dài nhất để không lộ hở mép.
        </div>

        {/* Target face */}
        <div className="inspector-row">
          <label htmlFor="join-target-face">Ghép vào mặt</label>
          <select
            id="join-target-face"
            className="input-select"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            {otherFaces.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Edges */}
        <div className="adv-grid-2col">
          <div className="inspector-row">
            <label htmlFor="join-target-edge">Cạnh mặt đích</label>
            <select
              id="join-target-edge"
              className="input-select"
              value={targetEdge}
              onChange={(e) => setTargetEdge(e.target.value as JoinEdge)}
            >
              {(Object.keys(JOIN_EDGE_LABELS) as JoinEdge[]).map((k) => (
                <option key={k} value={k}>
                  {JOIN_EDGE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="inspector-row">
            <label htmlFor="join-source-edge">Cạnh mặt này</label>
            <select
              id="join-source-edge"
              className="input-select"
              value={sourceEdge}
              onChange={(e) => setSourceEdge(e.target.value as JoinEdge)}
            >
              {(Object.keys(JOIN_EDGE_LABELS) as JoinEdge[]).map((k) => (
                <option key={k} value={k}>
                  {JOIN_EDGE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Angle & Scale mode */}
        <div className="inspector-row">
          <label htmlFor="join-angle">Góc gập mép</label>
          <div className="range-with-value">
            <input
              id="join-angle"
              type="range"
              min="-180"
              max="180"
              step="5"
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
            />
            <span className="scale-badge">{angle}°</span>
          </div>
        </div>

        <div className="adv-grid-2col">
          <div className="inspector-row">
            <label htmlFor="join-scale-mode">Chế độ co giãn</label>
            <select
              id="join-scale-mode"
              className="input-select"
              value={scaleMode}
              onChange={(e) => setScaleMode(e.target.value as JoinScaleMode)}
            >
              <option value="longest">Theo cạnh dài nhất</option>
              <option value="source">Chỉ chỉnh mặt này</option>
              <option value="none">Giữ nguyên kích thước</option>
            </select>
          </div>

          <div className="inspector-row adv-center-checkbox">
            <label className="adv-checkbox-label">
              <input
                type="checkbox"
                checked={flip}
                onChange={(e) => setFlip(e.target.checked)}
              />
              <span>Đảo chiều Start/End</span>
            </label>
          </div>
        </div>

        {errorMsg && <div className="adv-error">{errorMsg}</div>}

        <button
          type="button"
          className="btn primary adv-action-btn"
          onClick={handleExecuteJoin}
        >
          Ghép hít cạnh ngay
        </button>
      </div>
    </details>
  )
}
