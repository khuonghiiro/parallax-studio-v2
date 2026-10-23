import { useView, type PrimaryView } from '../../store/view'
import { IconCamera, IconCube, IconCameraStage, IconRoute } from '../icons'
import { selectedViews } from './taggedLayout'

const tags = [
  { id: 'camera', dom: 'camera', label: 'Camera', Icon: IconCamera },
  { id: 'editor', dom: '3d', label: '3D', Icon: IconCube },
  { id: 'animate2d', dom: 'animate2d', label: 'Cam 2D', Icon: IconCameraStage },
  { id: 'topview', dom: 'topview', label: 'Độ sâu 2.5D', Icon: IconRoute }
] as const

export function ViewTags() {
  const view = useView()
  const active = selectedViews(view)
  const toggle = (id: PrimaryView) => {
    const next = active.includes(id) ? active.filter((item) => item !== id) : [...active, id]
    if (next.length) view.set({ activeViews: next })
  }
  return <div className="viewer-mode-seg viewer-view-tags" role="group" aria-label="Bật các khung xem">
    {tags.map(({ id, dom, label, Icon }) => <button key={id} id={`view-${dom}`} type="button"
      className={`seg-btn${active.includes(id) ? ' active' : ''}`} aria-pressed={active.includes(id)}
      disabled={active.length === 1 && active[0] === id}
      title={`${active.includes(id) ? 'Ẩn' : 'Hiện'} ${label} · Có thể bật nhiều khung cùng lúc`}
      onClick={() => toggle(id)}><Icon width={12} height={12} />{label}</button>)}
  </div>
}
