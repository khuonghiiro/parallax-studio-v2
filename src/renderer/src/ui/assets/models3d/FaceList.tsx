import { useEffect, useState, useRef, useCallback, type MouseEvent, type DragEvent } from 'react'
import type { Face3D } from './types'
import { resolveFaceTexture } from './textureResolver'
import { deleteFace, duplicateFace, reorderFace, toggleFaceFlag } from './assemblyFaceOps'
import {
  getAssemblyDraggedAsset,
  setAssemblyDraggedAsset,
  subscribeAssemblyDraggedAsset
} from './assemblyDragState'
import { IconCopy, IconDown, IconEye, IconEyeOff, IconLock, IconPlus, IconTrash, IconUp } from '../../icons'

interface FaceListProps {
  faces: Face3D[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Structural list change (always its own undo step). */
  onChange: (faces: Face3D[]) => void
  onAdd: () => void
  onAssignTexture?: (faceId: string, assetPath: string, all?: boolean) => void
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
  isDragOver: boolean
  isAssigned: boolean
  isFlashing: boolean
  onSelect: () => void
  onAction: (action: 'hidden' | 'locked' | 'up' | 'down' | 'duplicate' | 'delete') => void
  onDragEnter: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}

function FaceRow({
  face,
  index,
  count,
  active,
  isDragOver,
  isAssigned,
  isFlashing,
  onSelect,
  onAction,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop
}: RowProps) {
  const stop = (action: Parameters<RowProps['onAction']>[0]) => (e: MouseEvent) => {
    e.stopPropagation()
    onAction(action)
  }
  const cls = `fl-row${active ? ' active' : ''}${face.hidden ? ' is-hidden' : ''}${face.locked ? ' is-locked' : ''}${
    isDragOver ? (isAssigned ? ' is-drag-over is-assigned' : ' is-drag-over') : ''
  }${isFlashing ? ' flash-success' : ''}`

  return (
    <div
      className={cls}
      onClick={onSelect}
      role="option"
      aria-selected={active}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className="fl-idx">{index + 1}</span>
      <FaceThumb face={face} />
      <span className="fl-name" title={face.name}>
        {face.name}
      </span>

      {isDragOver && (
        <span className={`fl-drop-badge ${isAssigned ? 'badge-success' : 'badge-pending'}`}>
          {isAssigned ? '✓ Đã nhận ảnh' : '+ Gán ảnh (Shift)'}
        </span>
      )}

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

/** Layer-style face list: thumbnail, visibility, lock, ordering, duplicate, delete and Drag-Drop texture assignment. */
export function FaceList({ faces, selectedId, onSelect, onChange, onAdd, onAssignTexture }: FaceListProps) {
  const [draggedAsset, setDraggedAsset] = useState(() => getAssemblyDraggedAsset())
  const [hoveredFaceId, setHoveredFaceId] = useState<string | null>(null)
  const [flashFaceIds, setFlashFaceIds] = useState<Set<string>>(new Set())

  const facesRef = useRef(faces)
  facesRef.current = faces
  const hoveredFaceIdRef = useRef<string | null>(null)
  hoveredFaceIdRef.current = hoveredFaceId
  const draggedAssetRef = useRef(draggedAsset)
  draggedAssetRef.current = draggedAsset

  const isAssetDragging = !!draggedAsset

  useEffect(() => {
    return subscribeAssemblyDraggedAsset((asset) => {
      setDraggedAsset(asset)
      if (!asset) setHoveredFaceId(null)
    })
  }, [])

  const triggerFlash = useCallback((targetIds: string[]) => {
    if (targetIds.length === 0) return
    setFlashFaceIds((prev) => {
      const next = new Set(prev)
      for (const id of targetIds) next.add(id)
      return next
    })
    setTimeout(() => {
      setFlashFaceIds((prev) => {
        const next = new Set(prev)
        for (const id of targetIds) next.delete(id)
        return next
      })
    }, 500)
  }, [])

  const handleApply = useCallback(
    (faceId: string, assetPath: string, all = false) => {
      if (!assetPath) return
      if (onAssignTexture) {
        onAssignTexture(faceId, assetPath, all)
      } else {
        const current = facesRef.current
        const next = all
          ? current.map((f) => ({ ...f, assetPath }))
          : current.map((f) => (f.id === faceId ? { ...f, assetPath } : f))
        onChange(next)
        if (!all) onSelect(faceId)
      }
      triggerFlash(all ? facesRef.current.map((f) => f.id) : [faceId])
    },
    [onAssignTexture, onChange, onSelect, triggerFlash]
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        const currentHoverId = hoveredFaceIdRef.current
        const dragged = draggedAssetRef.current || getAssemblyDraggedAsset()
        if (currentHoverId && dragged) {
          const target = facesRef.current.find((f) => f.id === currentHoverId)
          if (target && target.assetPath !== dragged.assetPath) {
            handleApply(currentHoverId, dragged.assetPath, false)
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [handleApply])

  const extractAssetPath = (e: DragEvent): string | null => {
    const dragged = draggedAssetRef.current || getAssemblyDraggedAsset()
    if (dragged?.assetPath) return dragged.assetPath

    try {
      const raw = e.dataTransfer.getData('application/json')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.assetPath) return parsed.assetPath
      }
    } catch {}

    const text = e.dataTransfer.getData('text/plain')
    if (text) return text

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        return (file as unknown as { path?: string }).path || URL.createObjectURL(file)
      }
    }
    return null
  }

  const handleDragEnter = (id: string, e: DragEvent) => {
    e.preventDefault()
    setHoveredFaceId(id)
    if (e.shiftKey) {
      const dragged = draggedAssetRef.current || getAssemblyDraggedAsset()
      if (dragged) {
        const target = facesRef.current.find((f) => f.id === id)
        if (target && target.assetPath !== dragged.assetPath) {
          handleApply(id, dragged.assetPath, false)
        }
      }
    }
  }

  const handleDragOver = (id: string, e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (hoveredFaceIdRef.current !== id) {
      setHoveredFaceId(id)
    }
    if (e.shiftKey) {
      const dragged = draggedAssetRef.current || getAssemblyDraggedAsset()
      if (dragged) {
        const target = facesRef.current.find((f) => f.id === id)
        if (target && target.assetPath !== dragged.assetPath) {
          handleApply(id, dragged.assetPath, false)
        }
      }
    }
  }

  const handleDragLeave = (id: string, e: DragEvent) => {
    const currentTarget = e.currentTarget as HTMLElement | null
    const relatedTarget = e.relatedTarget as Node | null
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return
    }
    if (hoveredFaceIdRef.current === id) {
      setHoveredFaceId(null)
    }
  }

  const handleDrop = (id: string, e: DragEvent) => {
    e.preventDefault()
    const assetPath = extractAssetPath(e)
    const isAll = e.shiftKey
    if (assetPath) {
      handleApply(id, assetPath, isAll)
    }
    setHoveredFaceId(null)
    setAssemblyDraggedAsset(null)
  }

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

      {isAssetDragging && (
        <div className="fl-drag-hint-banner">
          <span>💡 Kéo thả vào mặt để gán · Rê chuột và bấm <strong>Shift</strong> để gán nhanh</span>
        </div>
      )}

      <div className={`fl-list${isAssetDragging ? ' is-dragging-asset' : ''}`} role="listbox" aria-label="Danh sách mặt">
        {faces.map((f, i) => {
          const isAssigned = !!(isAssetDragging && draggedAsset && f.assetPath === draggedAsset.assetPath)
          return (
            <FaceRow
              key={f.id}
              face={f}
              index={i}
              count={faces.length}
              active={f.id === selectedId}
              isDragOver={isAssetDragging && hoveredFaceId === f.id}
              isAssigned={isAssigned}
              isFlashing={flashFaceIds.has(f.id)}
              onSelect={() => onSelect(f.id)}
              onAction={(a) => handleAction(f.id, a)}
              onDragEnter={(e) => handleDragEnter(f.id, e)}
              onDragOver={(e) => handleDragOver(f.id, e)}
              onDragLeave={(e) => handleDragLeave(f.id, e)}
              onDrop={(e) => handleDrop(f.id, e)}
            />
          )
        })}
      </div>
    </div>
  )
}
