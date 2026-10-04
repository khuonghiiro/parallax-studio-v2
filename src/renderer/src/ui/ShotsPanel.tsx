import { useEffect, useMemo, useRef, useState } from 'react'
import { addShot, autoBuildCameraTour, deleteShot, flyToShot, SHOT_DIRECTIONS, updateShot, type ShotDirection } from '../actions'
import { shotAtTime } from '../animation/cameraPath'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import { IconCamera, IconEye, IconFocus, IconPlane, IconPlus, IconRoute, IconTrash } from './icons'

/** List of shots (scenes placed in 3D space) — AE-style "comp regions" the camera flies between. */
export function ShotsPanel() {
  const shots = useEditor((s) => s.project.shots)
  const layers = useEditor((s) => s.project.layers)
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const selectShot = useEditor((s) => s.selectShot)
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const live = useMemo(() => shotAtTime(project, time), [project, time])
  const counts = useMemo(() => {
    const m = new Map<string | null, number>()
    for (const l of layers) m.set(l.shotId, (m.get(l.shotId) ?? 0) + 1)
    return m
  }, [layers])

  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

  const add = (dir: ShotDirection): void => {
    setMenu(false)
    const s = addShot(dir)
    useView.getState().requestFocus('shot', s.id)
  }

  return (
    <div className="shots">
      <div className="shots-actions">
        <div className="menu-wrap" ref={menuRef}>
          <button id="add-shot" className="btn sm primary" onClick={() => setMenu((m: boolean) => !m)} title="Thêm cảnh mới trong không gian 3D">
            <IconPlus /> Cảnh
          </button>
          {menu && (
            <div className="menu">
              <div className="menu-label">Đặt cảnh mới</div>
              {SHOT_DIRECTIONS.map((d) => (
                <button key={d.id} id={`add-shot-${d.id}`} className="menu-item" onClick={() => add(d.id)}>
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          id="auto-tour-btn"
          className="btn sm"
          disabled={shots.length === 0}
          onClick={autoBuildCameraTour}
          title="Tự động 1-click tạo toàn bộ đường bay camera điện ảnh qua các cảnh (vòng cung 3D + đẩy Ken Burns)"
        >
          ⚡ Tự động bay
        </button>
        <button
          id="open-path-builder"
          className="btn sm icon"
          disabled={shots.length === 0}
          onClick={() => useView.getState().openDialog('path')}
          title="Tùy chỉnh chi tiết đường bay camera qua các cảnh (bay thẳng / vòng cung / cắt / fade)"
        >
          <IconRoute />
        </button>
      </div>

      {shots.length === 0 ? (
        <div className="empty">
          Chưa có cảnh nào. Mỗi <b>cảnh</b> là một cụm layer đặt ở một vị trí trong không gian 3D —
          camera bay tới đâu thì cảnh đó mới được nạp &amp; render.
          <br />
          Bấm <b>+ Cảnh</b> để bắt đầu (layer hiện có sẽ được gom vào Cảnh 1).
        </div>
      ) : (
        <ul className="shot-list">
          <li
            className={`shot-row global${selectedShotId === null ? ' selected' : ''}`}
            onClick={() => selectShot(null)}
            title="Layer chung: không thuộc cảnh nào (đặt theo toạ độ thế giới)"
          >
            <span className="shot-dot" style={{ background: 'var(--text-faint)' }} />
            <span className="shot-name">Layer chung</span>
            <span className="shot-count">{counts.get(null) ?? 0}</span>
          </li>
          {shots.map((s) => (
            <li
              key={s.id}
              id={`shot-${s.id}`}
              className={`shot-row${selectedShotId === s.id ? ' selected' : ''}${s.visible ? '' : ' hidden'}`}
              style={{ ['--c' as string]: s.color }}
              onClick={() => selectShot(s.id)}
              onDoubleClick={() => setEditing(s.id)}
            >
              <label className="shot-dot" title="Đổi màu" onClick={(e) => e.stopPropagation()}>
                <input type="color" value={s.color} onChange={(e) => updateShot(s.id, { color: e.target.value }, `shot-color-${s.id}`)} />
              </label>
              {editing === s.id ? (
                <input
                  className="input shot-rename"
                  autoFocus
                  defaultValue={s.name}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== s.name) updateShot(s.id, { name: v })
                    setEditing(null)
                  }}
                />
              ) : (
                <span className="shot-name" title="Double-click để đổi tên">
                  {s.name}
                  {live === s.id && (
                    <span className="shot-live" title="Camera đang ở cảnh này">
                      <IconCamera />
                    </span>
                  )}
                </span>
              )}
              <span className="shot-count" title="Số layer">
                {counts.get(s.id) ?? 0}
              </span>
              <span className="shot-btns" onClick={(e) => e.stopPropagation()}>
                <button className="mini" title="Camera bay tới cảnh này tại thời điểm hiện tại (tạo keyframe)" onClick={() => flyToShot(s.id)}>
                  <IconPlane />
                </button>
                <button className="mini" title="Xem cảnh trong view 3D" onClick={() => useView.getState().requestFocus('shot', s.id)}>
                  <IconFocus />
                </button>
                <button className={`mini${s.visible ? '' : ' off'}`} title="Ẩn/hiện" onClick={() => updateShot(s.id, { visible: !s.visible })}>
                  <IconEye />
                </button>
                <button className="mini danger" title="Xoá cảnh" onClick={() => deleteShot(s.id)}>
                  <IconTrash />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
