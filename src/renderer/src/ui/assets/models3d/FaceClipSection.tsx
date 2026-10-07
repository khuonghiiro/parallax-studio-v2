import type { Face3D } from './types'
import { applyClipSuggestions, suggestClipRules } from './assemblyClip'
import { IconScissors } from '../../icons'

interface FaceClipSectionProps {
  currentFace: Face3D
  allFaces: Face3D[]
  onUpdateFace: (patch: Partial<Face3D>) => void
  onUpdateAllFaces: (faces: Face3D[]) => void
}

export function FaceClipSection({ currentFace, allFaces, onUpdateFace, onUpdateAllFaces }: FaceClipSectionProps) {
  const otherFaces = allFaces.filter((f) => f.id !== currentFace.id)
  const currentClips = new Set(currentFace.clipBy || [])

  const handleToggleClipper = (clipperId: string) => {
    const next = new Set(currentClips)
    if (next.has(clipperId)) next.delete(clipperId)
    else next.add(clipperId)
    onUpdateFace({ clipBy: next.size > 0 ? Array.from(next) : undefined })
  }

  const handleAutoSuggestAll = () => {
    const suggestions = suggestClipRules(allFaces)
    if (suggestions.length === 0) return
    const updated = applyClipSuggestions(allFaces, suggestions)
    onUpdateAllFaces(updated)
  }

  return (
    <details className="inspector-section fi-collapsible">
      <summary className="section-title">
        <span className="section-title-with-icon">
          <IconScissors width={13} height={13} />
          <span>Cắt giao nhau (Loại bỏ pixel vượt mái/tường)</span>
        </span>
        {currentClips.size > 0 && <span className="fi-badge">{currentClips.size} mặt cắt</span>}
      </summary>

      <div className="adv-clip-content">
        <div className="adv-desc">
          Khi 2 mặt giao nhau (ví dụ tường nhô qua mái dốc), phần pixel vượt qua mặt phẳng cắt sẽ tự động bị ẩn đi để tránh lộ chỗ thừa.
        </div>

        <div className="adv-clipper-list">
          <div className="adv-label">Mặt phẳng cắt qua mặt này:</div>
          {otherFaces.length === 0 ? (
            <div className="adv-empty-note">Cần ít nhất 2 mặt phẳng trong mô hình.</div>
          ) : (
            otherFaces.map((f) => {
              const isChecked = currentClips.has(f.id)
              return (
                <label key={f.id} className="adv-clipper-item">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleClipper(f.id)}
                  />
                  <span>{f.name}</span>
                </label>
              )
            })
          )}
        </div>

        <button
          type="button"
          className="btn secondary adv-action-btn"
          onClick={handleAutoSuggestAll}
          title="Tự động phát hiện các mặt giao cắt (như tường giao mái) và bật cắt giao nhau tương ứng"
        >
          Tự động phát hiện giao nhau toàn mô hình
        </button>
      </div>
    </details>
  )
}
