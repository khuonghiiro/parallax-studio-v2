import { useEffect, useState, type MouseEvent } from 'react'
import type { Face3D } from './types'
import { resolveFaceTexture } from './textureResolver'
import { deleteFace, duplicateFace, reorderFace, toggleFaceFlag } from './assemblyFaceOps'
import { IconCopy, IconDown, IconEye, IconEyeOff, IconLock, IconPlus, IconTrash, IconUp } from '../../icons'

interface FaceListProps {
  faces: Face3D[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Structural list change (always its own undo step). */
  onChange: (faces: Face3D[]) => void
  onAdd: () => void
}

/** Resolves a small preview URL for a face image (shares the workshop texture cache). */
function useFaceThumb(assetPath?: string): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (!assetPath) {
      setUrl(null)
      return
    }
    resolveFaceTexture(assetPath).then((res) => {
      if (alive) setUrl(res?.url ?? null)
    })
    return () => {
      alive = false
    }
  }, [assetPath])
  return url
}

function FaceThumb({ face }: { face: Face3D }) {
  const url = useFaceThumb(face.assetPath)
  return (
    <span className="fl-thumb" aria-hidden="true">
      {url ? (
        <img src={url} alt="" draggable={false} />
      ) : (
        <span className="fl-thumb-swatch" style={{ background: face.color ?? 'var(--bg-4)' }} />
      )}
    </span>
  )
}

interface RowProps {
  face: Face3D
  index: number
  count: number
  active: boolean
  onSelect: () => void
  onAction: (action: 'hidden' | 'locked' | 'up' | 'down' | 'duplicate' | 'delete') => void
}

function FaceRow({ face, index, count, active, onSelect, onAction }: RowProps) {
  const stop = (action: Parameters<RowProps['onAction']>[0]) => (e: MouseEvent) => {
    e.stopPropagation()
    onAction(action)
  }
  const cls = `fl-row${active ? ' active' : ''}${face.hidden ? ' is-hidden' : ''}${face.locked ? ' is-locked' : ''}`
  return (
    <div className={cls} onClick={onSelect} role="option" aria-selected={active}>
      <span className="fl-idx">{index + 1}</span>
      <FaceThumb face={face} />
      <span className="fl-name" title={face.name}>{face.name}</span>
      <span className="fl-actions">
        <button type="button" className="fl-btn fl-hover" title="Đưa lên" disabled={index === 0} onClick={stop('up')}>
          <IconUp width={11} height={11} />
        </button>
        <button type="button" className="fl-btn fl-hover" title="Đưa xuống" disabled={index === count - 1} onClick={stop('down')}>
          <IconDown width={11} height={11} />
        </button>
        <button type="button" className="fl-btn fl-hover" title="Nhân bản (Ctrl+D)" onClick={stop('duplicate')}>
          <IconCopy width={11} height={11} />
        </button>
        <button type="button" className="fl-btn fl-hover fl-danger" title="Xóa (Delete)" disabled={count <= 1} onClick={stop('delete')}>
          <IconTrash width={11} height={11} />
        </button>
        <button type="button" className={`fl-btn${face.locked ? ' on' : ''}`} title={face.locked ? 'Mở khóa (L)' : 'Khóa (L)'} onClick={stop('locked')}>
          <IconLock width={11} height={11} />
        </button>
        <button type="button" className={`fl-btn${face.hidden ? ' on' : ''}`} title={face.hidden ? 'Hiện (H)' : 'Ẩn (H)'} onClick={stop('hidden')}>
          {face.hidden ? <IconEyeOff width={11} height={11} /> : <IconEye width={11} height={11} />}
        </button>
      </span>
    </div>
  )
}

/** Layer-style face list: thumbnail, visibility, lock, ordering, duplicate and delete. */
export function FaceList({ faces, selectedId, onSelect, onChange, onAdd }: FaceListProps) {
  const handleAction = (id: string, action: Parameters<RowProps['onAction']>[0]) => {
    if (action === 'hidden' || action === 'locked') return onChange(toggleFaceFlag(faces, id, action))
    if (action === 'up' || action === 'down') return onChange(reorderFace(faces, id, action === 'up' ? -1 : 1))
    if (action === 'duplicate') {
      const res = duplicateFace(faces, id)
      onChange(res.faces)
      if (res.newId) onSelect(res.newId)
      return
    }
    const res = deleteFace(faces, id)
    onChange(res.faces)
    if (selectedId === id) onSelect(res.nextSelected)
  }

  return (
    <div className="inspector-section faces-list-section">
      <div className="section-title">
        <span>Danh sách mặt ({faces.length})</span>
        <button type="button" className="fi-add-btn" onClick={onAdd} title="Thêm mặt phẳng mới">
          <IconPlus width={11} height={11} />
          <span>Thêm</span>
        </button>
      </div>
      <div className="fl-list" role="listbox" aria-label="Danh sách mặt">
        {faces.map((f, i) => (
          <FaceRow
            key={f.id}
            face={f}
            index={i}
            count={faces.length}
            active={f.id === selectedId}
            onSelect={() => onSelect(f.id)}
            onAction={(a) => handleAction(f.id, a)}
          />
        ))}
      </div>
    </div>
  )
}
